"""
Payroll & Compliance module — Salary structure, Monthly payroll run,
Payslip PDF, Statutory registers (PF/ESI/PT/TDS) and Bank NEFT CSV export.

Prefix: /api/public/payroll/*

Indian statutory defaults (Feb 2026, new tax regime):
- Basic         = 50% of monthly CTC
- HRA           = 40% of Basic
- Special       = Monthly CTC - Basic - HRA
- PF (employee) = 12% of min(Basic, 15000)
- ESI (employee)= 0.75% of Gross if Gross <= 21000/month
- Professional Tax (Maharashtra) = 200/month if gross >= 10000, 300 in Feb
- TDS           = New-regime slabs on (annual gross - 75000 std deduction), / 12
- LOP           = (Gross / working_days) * unpaid_leave_days

All rates configurable via /api/public/payroll/config.
"""
import os
import csv
import uuid
import logging
import calendar
from datetime import datetime, timezone
from typing import Optional, List
from io import StringIO
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

router = APIRouter(prefix="/public/payroll", tags=["Payroll & Compliance"])
db = None

PAYSLIPS_DIR = "/app/backend/uploads/payslips"
os.makedirs(PAYSLIPS_DIR, exist_ok=True)


def set_db(database):
    global db
    db = database


# Default statutory config
DEFAULTS = {
    "basic_pct": 0.50,
    "hra_pct_of_basic": 0.40,
    "pf_pct": 0.12,
    "pf_wage_cap": 15000,
    "esi_pct": 0.0075,
    "esi_gross_cap": 21000,
    "pt_amount": 200,
    "pt_amount_feb": 300,
    "pt_min_gross": 10000,
    "std_deduction_annual": 75000,
    "tds_slabs_new_regime": [
        [300000, 0.00],
        [600000, 0.05],
        [900000, 0.10],
        [1200000, 0.15],
        [1500000, 0.20],
        [10 ** 12, 0.30],
    ],
}


async def _config() -> dict:
    row = await db.payroll_config.find_one({"_id": "default"})
    if not row:
        cfg = {**DEFAULTS, "_id": "default"}
        await db.payroll_config.insert_one(cfg)
        return DEFAULTS
    row.pop("_id", None)
    # Ensure any newly added keys pick default values
    return {**DEFAULTS, **row}


def _working_days(year: int, month: int) -> int:
    """Working days in month excluding Sundays (simple approx)."""
    _, days_in_month = calendar.monthrange(year, month)
    total = 0
    for d in range(1, days_in_month + 1):
        wd = calendar.weekday(year, month, d)
        if wd != 6:   # exclude Sunday
            total += 1
    return total


def _compute_annual_tax(annual_taxable: float, slabs) -> float:
    if annual_taxable <= 0:
        return 0.0
    tax = 0.0
    prev = 0.0
    for cap, rate in slabs:
        if annual_taxable > cap:
            tax += (cap - prev) * rate
            prev = cap
        else:
            tax += (annual_taxable - prev) * rate
            return round(tax, 2)
    return round(tax, 2)


def compute_payslip_components(monthly_ctc: float, unpaid_days: int, working_days: int, month: str, cfg: dict) -> dict:
    """Pure function — deterministic component computation for tests."""
    basic = round(monthly_ctc * cfg["basic_pct"], 2)
    hra = round(basic * cfg["hra_pct_of_basic"], 2)
    special = round(max(0, monthly_ctc - basic - hra), 2)
    gross = round(basic + hra + special, 2)

    lop = round((gross / working_days) * unpaid_days, 2) if unpaid_days > 0 and working_days > 0 else 0.0
    effective_gross = round(gross - lop, 2)

    pf = round(min(basic, cfg["pf_wage_cap"]) * cfg["pf_pct"], 2)
    esi = round(effective_gross * cfg["esi_pct"], 2) if effective_gross <= cfg["esi_gross_cap"] else 0.0

    # Professional tax
    is_feb = month.endswith("-02")
    pt = 0.0
    if effective_gross >= cfg["pt_min_gross"]:
        pt = cfg["pt_amount_feb"] if is_feb else cfg["pt_amount"]

    # TDS — monthly = annual tax / 12 on (annual gross - std deduction)
    annual_gross = effective_gross * 12
    annual_taxable = max(0, annual_gross - cfg["std_deduction_annual"])
    annual_tax = _compute_annual_tax(annual_taxable, cfg["tds_slabs_new_regime"])
    # 4% health & education cess
    annual_tax_with_cess = round(annual_tax * 1.04, 2)
    tds = round(annual_tax_with_cess / 12, 2)

    total_deductions = round(pf + esi + pt + tds + lop, 2)
    net_pay = round(gross - total_deductions, 2)

    return {
        "earnings": {"basic": basic, "hra": hra, "special_allowance": special, "gross": gross},
        "deductions": {"pf": pf, "esi": esi, "professional_tax": pt, "tds": tds, "lop": lop, "total": total_deductions},
        "net_pay": net_pay,
        "unpaid_days": unpaid_days,
        "working_days": working_days,
    }


# ============================================================================
# SALARY STRUCTURE
# ============================================================================

class SalaryStructure(BaseModel):
    monthly_ctc: float = Field(gt=0)
    annual_ctc: Optional[float] = None
    bank_account: Optional[str] = None
    ifsc: Optional[str] = None
    pan: Optional[str] = None
    pf_uan: Optional[str] = None
    esi_number: Optional[str] = None
    admin_id: str = "admin"


@router.post("/salary-structure/{employee_id}")
async def set_salary_structure(employee_id: str, data: SalaryStructure):
    emp = await db.employees.find_one({"employee_id": employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    now = datetime.now(timezone.utc).isoformat()
    record = data.dict()
    record.pop("admin_id", None)
    if not record.get("annual_ctc"):
        record["annual_ctc"] = round(record["monthly_ctc"] * 12, 2)
    record.update({"employee_id": employee_id, "updated_at": now, "updated_by": data.admin_id})
    await db.salary_structures.update_one(
        {"employee_id": employee_id},
        {"$set": record, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return {"success": True, "salary_structure": record}


@router.get("/salary-structure/{employee_id}")
async def get_salary_structure(employee_id: str):
    row = await db.salary_structures.find_one({"employee_id": employee_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Salary structure not set")
    return {"salary_structure": row}


# ============================================================================
# PAYROLL RUN
# ============================================================================

class PayrollRunRequest(BaseModel):
    month: str   # YYYY-MM
    employee_ids: Optional[List[str]] = None   # if omitted, all active employees
    admin_id: str = "admin"


@router.post("/run")
async def run_payroll(data: PayrollRunRequest):
    try:
        yr, mo = data.month.split("-"); year = int(yr); month = int(mo)
        assert 1 <= month <= 12
    except Exception:
        raise HTTPException(status_code=400, detail="month must be YYYY-MM")

    cfg = await _config()
    wd = _working_days(year, month)

    existing = await db.payroll_runs.find_one({"month": data.month, "status": {"$ne": "cancelled"}})
    if existing:
        raise HTTPException(status_code=400, detail=f"Payroll for {data.month} already ran (run_id={existing['run_id']}). Delete first if you want to re-run.")

    q = {"status": "active"}
    if data.employee_ids:
        q = {"employee_id": {"$in": data.employee_ids}, "status": {"$ne": "separated"}}
    employees = await db.employees.find(q).to_list(5000)

    run_id = f"PR-{data.month.replace('-', '')}-{str(uuid.uuid4())[:6].upper()}"
    now = datetime.now(timezone.utc).isoformat()

    payslip_docs = []
    total_gross = 0.0
    total_deductions = 0.0
    total_net = 0.0
    skipped: List[dict] = []

    for emp in employees:
        struct = await db.salary_structures.find_one({"employee_id": emp["employee_id"]})
        if not struct:
            skipped.append({"employee_id": emp["employee_id"], "name": emp.get("name"), "reason": "no salary structure"})
            continue

        # Count LOP days from attendance (unpaid leave = 'absent' or leaves that are 'lop' type approved)
        lop_days = await db.attendance.count_documents({
            "employee_id": emp["employee_id"],
            "date": {"$regex": f"^{data.month}"},
            "status": "absent",
        })
        lop_leaves = await db.leaves.count_documents({
            "employee_id": emp["employee_id"],
            "leave_type": "lop",
            "status": "approved",
            "from_date": {"$regex": f"^{data.month}"},
        })
        # Note: counting documents; if you need summed days, iterate. Kept as count for simplicity.
        # Add absent days + approved LOP leave day count is more accurate:
        lop_leaves_docs = await db.leaves.find(
            {"employee_id": emp["employee_id"], "leave_type": "lop", "status": "approved",
             "from_date": {"$regex": f"^{data.month}"}},
            {"days": 1, "_id": 0},
        ).to_list(50)
        lop_leave_total = sum(d.get("days", 0) for d in lop_leaves_docs)
        unpaid_days = lop_days + lop_leave_total

        comps = compute_payslip_components(struct["monthly_ctc"], unpaid_days, wd, data.month, cfg)
        payslip_id = f"PS-{data.month.replace('-', '')}-{emp['employee_id']}"

        payslip = {
            "payslip_id": payslip_id,
            "run_id": run_id,
            "month": data.month,
            "employee_id": emp["employee_id"],
            "employee_name": emp.get("name"),
            "department": emp.get("department"),
            "designation": emp.get("designation"),
            "pan": struct.get("pan"),
            "pf_uan": struct.get("pf_uan"),
            "esi_number": struct.get("esi_number"),
            "bank_account": struct.get("bank_account"),
            "ifsc": struct.get("ifsc"),
            "monthly_ctc": struct["monthly_ctc"],
            **comps,
            "status": "generated",
            "computed_at": now,
            "pdf_path": None,
        }
        payslip_docs.append(payslip)
        total_gross += comps["earnings"]["gross"]
        total_deductions += comps["deductions"]["total"]
        total_net += comps["net_pay"]

    if payslip_docs:
        await db.payslips.insert_many(payslip_docs)

    run_doc = {
        "run_id": run_id,
        "month": data.month,
        "working_days": wd,
        "total_employees": len(payslip_docs),
        "total_skipped": len(skipped),
        "total_gross": round(total_gross, 2),
        "total_deductions": round(total_deductions, 2),
        "total_net": round(total_net, 2),
        "status": "generated",
        "run_by": data.admin_id,
        "run_at": now,
        "skipped": skipped,
    }
    await db.payroll_runs.insert_one(run_doc)
    run_doc.pop("_id", None)
    return {"success": True, "run": run_doc, "payslips_generated": len(payslip_docs)}


@router.get("/runs")
async def list_runs():
    rows = await db.payroll_runs.find({}, {"_id": 0}).sort("month", -1).to_list(60)
    return {"runs": rows, "total": len(rows)}


@router.get("/run/{run_id}")
async def get_run(run_id: str):
    run = await db.payroll_runs.find_one({"run_id": run_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    payslips = await db.payslips.find({"run_id": run_id}, {"_id": 0, "pdf_path": 0, "computed_at": 0}).sort("employee_id", 1).to_list(5000)
    return {"run": run, "payslips": payslips}


@router.delete("/run/{run_id}")
async def delete_run(run_id: str):
    run = await db.payroll_runs.find_one({"run_id": run_id})
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    await db.payroll_runs.update_one({"run_id": run_id}, {"$set": {"status": "cancelled"}})
    await db.payslips.delete_many({"run_id": run_id})
    return {"success": True, "message": "Run cancelled and payslips removed"}


# ============================================================================
# PAYSLIP PDF
# ============================================================================

def build_payslip_pdf(ps: dict) -> str:
    fpath = os.path.join(PAYSLIPS_DIR, f"{ps['payslip_id']}.pdf")
    doc = SimpleDocTemplate(fpath, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=1.6 * cm, bottomMargin=1.6 * cm,
                            title=f"Payslip {ps['month']} — {ps['employee_name']}")
    ss = getSampleStyleSheet()
    title_s = ParagraphStyle("t", parent=ss["Title"], alignment=TA_CENTER, fontSize=16, spaceAfter=4)
    sub_s = ParagraphStyle("s", parent=ss["Normal"], alignment=TA_CENTER, fontSize=9, textColor=colors.HexColor("#6b7280"), spaceAfter=10)
    hdr_s = ParagraphStyle("h", parent=ss["Heading3"], textColor=colors.HexColor("#111827"), spaceBefore=8, spaceAfter=6)
    lbl_s = ParagraphStyle("l", parent=ss["Normal"], fontSize=10)

    story = []
    story.append(Paragraph("PARAS REWARD TECHNOLOGIES PRIVATE LIMITED", title_s))
    story.append(Paragraph("B-18, Bizz Tower, Chatrapati Sambhaji Nagar, Maharashtra 431006", sub_s))

    yr, mo = ps["month"].split("-")
    month_name = calendar.month_name[int(mo)]
    story.append(Paragraph(f"<b>Salary Slip — {month_name} {yr}</b>", hdr_s))

    # Employee block
    emp_rows = [
        ["Employee ID", ps["employee_id"], "Department", ps.get("department", "—")],
        ["Name", ps.get("employee_name", "—"), "Designation", ps.get("designation", "—")],
        ["PAN", ps.get("pan") or "—", "UAN (PF)", ps.get("pf_uan") or "—"],
        ["Bank A/c", ps.get("bank_account") or "—", "IFSC", ps.get("ifsc") or "—"],
        ["Working Days", str(ps.get("working_days", "—")), "Unpaid Days", str(ps.get("unpaid_days", 0))],
    ]
    emp_tbl = Table(emp_rows, colWidths=[3.5 * cm, 5.5 * cm, 3.5 * cm, 4 * cm])
    emp_tbl.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e5e7eb")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f3f4f6")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#f3f4f6")),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(emp_tbl)
    story.append(Spacer(1, 10))

    # Earnings / Deductions side-by-side
    e = ps["earnings"]; d = ps["deductions"]
    earn = [
        ["EARNINGS", "AMOUNT (₹)"],
        ["Basic Salary", f"{e['basic']:,.2f}"],
        ["HRA", f"{e['hra']:,.2f}"],
        ["Special Allowance", f"{e['special_allowance']:,.2f}"],
        ["", ""],
        ["Gross Earnings", f"{e['gross']:,.2f}"],
    ]
    deduc = [
        ["DEDUCTIONS", "AMOUNT (₹)"],
        ["Provident Fund (PF)", f"{d['pf']:,.2f}"],
        ["ESI", f"{d['esi']:,.2f}"],
        ["Professional Tax", f"{d['professional_tax']:,.2f}"],
        ["TDS (Income Tax)", f"{d['tds']:,.2f}"],
        ["Loss of Pay (LOP)", f"{d['lop']:,.2f}"],
        ["Total Deductions", f"{d['total']:,.2f}"],
    ]
    # Pad earnings to same length
    while len(earn) < len(deduc):
        earn.insert(-1, ["", ""])
    combined = [[earn[i][0], earn[i][1], deduc[i][0], deduc[i][1]] for i in range(len(deduc))]
    ed_tbl = Table(combined, colWidths=[4.5 * cm, 3.5 * cm, 4.5 * cm, 3.5 * cm])
    ed_tbl.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e5e7eb")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f3f4f6")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("ALIGN", (1, 1), (1, -1), "RIGHT"),
        ("ALIGN", (3, 1), (3, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(ed_tbl)
    story.append(Spacer(1, 12))

    # Net Pay
    net_tbl = Table([["NET PAY", f"₹ {ps['net_pay']:,.2f}"]], colWidths=[12 * cm, 4 * cm])
    net_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#10b981")),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 13),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(net_tbl)
    story.append(Spacer(1, 14))
    story.append(Paragraph("<font size=8 color='#6b7280'>This is a system-generated payslip and does not require a signature.</font>", lbl_s))

    doc.build(story)
    return fpath


@router.get("/payslip/{payslip_id}/pdf")
async def payslip_pdf(payslip_id: str):
    ps = await db.payslips.find_one({"payslip_id": payslip_id})
    if not ps:
        raise HTTPException(status_code=404, detail="Payslip not found")
    if not ps.get("pdf_path") or not os.path.exists(ps.get("pdf_path", "")):
        path = build_payslip_pdf(ps)
        await db.payslips.update_one({"payslip_id": payslip_id}, {"$set": {"pdf_path": path}})
    else:
        path = ps["pdf_path"]
    return FileResponse(path, filename=f"{payslip_id}.pdf", media_type="application/pdf")


# ============================================================================
# STATUTORY REPORTS  (CSV)
# ============================================================================

def _csv_response(filename: str, rows: list, headers: list) -> StreamingResponse:
    buf = StringIO()
    w = csv.writer(buf)
    w.writerow(headers)
    for r in rows:
        w.writerow([r.get(h, "") for h in headers])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/reports/pf")
async def report_pf(month: str):
    """PF Register — employee wage, PF wage (capped), employee PF, employer PF (12% split)."""
    cfg = await _config()
    payslips = await db.payslips.find({"month": month, "status": {"$ne": "cancelled"}}, {"_id": 0}).sort("employee_id", 1).to_list(5000)
    rows = []
    for p in payslips:
        basic = p["earnings"]["basic"]
        pf_wage = min(basic, cfg["pf_wage_cap"])
        emp_pf = round(pf_wage * cfg["pf_pct"], 2)
        # Employer PF split (India): 8.33% EPS (capped) + 3.67% EPF = 12%
        eps = round(min(pf_wage, 15000) * 0.0833, 2)
        epf_er = round(pf_wage * cfg["pf_pct"] - eps, 2)
        rows.append({
            "employee_id": p["employee_id"], "name": p["employee_name"], "uan": p.get("pf_uan") or "",
            "basic": basic, "pf_wage": pf_wage,
            "employee_pf": emp_pf, "employer_eps": eps, "employer_epf": epf_er,
        })
    return _csv_response(
        f"PF_Register_{month}.csv", rows,
        ["employee_id", "name", "uan", "basic", "pf_wage", "employee_pf", "employer_eps", "employer_epf"],
    )


@router.get("/reports/esi")
async def report_esi(month: str):
    payslips = await db.payslips.find({"month": month, "status": {"$ne": "cancelled"}}, {"_id": 0}).sort("employee_id", 1).to_list(5000)
    rows = []
    for p in payslips:
        gross = p["earnings"]["gross"]
        emp_esi = p["deductions"]["esi"]
        er_esi = round(gross * 0.0325, 2) if emp_esi > 0 else 0.0
        rows.append({
            "employee_id": p["employee_id"], "name": p["employee_name"],
            "esi_number": p.get("esi_number") or "",
            "gross": gross, "employee_esi": emp_esi, "employer_esi": er_esi,
        })
    return _csv_response(
        f"ESI_Register_{month}.csv", rows,
        ["employee_id", "name", "esi_number", "gross", "employee_esi", "employer_esi"],
    )


@router.get("/reports/tds")
async def report_tds(quarter: str):
    """quarter format: YYYY-Q1 / Q2 / Q3 / Q4 (Apr-Jun / Jul-Sep / Oct-Dec / Jan-Mar)."""
    try:
        yr, q = quarter.split("-Q"); y = int(yr); qn = int(q)
        assert 1 <= qn <= 4
    except Exception:
        raise HTTPException(status_code=400, detail="quarter must be YYYY-Q1..Q4")
    q_months = {
        1: [(y, 4), (y, 5), (y, 6)],
        2: [(y, 7), (y, 8), (y, 9)],
        3: [(y, 10), (y, 11), (y, 12)],
        4: [(y, 1), (y, 2), (y, 3)],
    }[qn]
    month_regex = "|".join(f"{yy}-{mm:02d}" for yy, mm in q_months)
    payslips = await db.payslips.find(
        {"month": {"$regex": month_regex}, "status": {"$ne": "cancelled"}},
        {"_id": 0},
    ).sort([("employee_id", 1), ("month", 1)]).to_list(20000)

    agg: dict = {}
    for p in payslips:
        eid = p["employee_id"]
        if eid not in agg:
            agg[eid] = {
                "employee_id": eid, "name": p["employee_name"], "pan": p.get("pan") or "",
                "gross": 0.0, "tds": 0.0,
            }
        agg[eid]["gross"] = round(agg[eid]["gross"] + p["earnings"]["gross"], 2)
        agg[eid]["tds"] = round(agg[eid]["tds"] + p["deductions"]["tds"], 2)
    rows = sorted(agg.values(), key=lambda x: x["employee_id"])
    return _csv_response(
        f"TDS_24Q_{quarter}.csv", rows,
        ["employee_id", "name", "pan", "gross", "tds"],
    )


@router.get("/reports/pt")
async def report_pt(month: str):
    payslips = await db.payslips.find({"month": month, "status": {"$ne": "cancelled"}}, {"_id": 0}).sort("employee_id", 1).to_list(5000)
    rows = [{
        "employee_id": p["employee_id"], "name": p["employee_name"],
        "gross": p["earnings"]["gross"], "professional_tax": p["deductions"]["professional_tax"],
    } for p in payslips]
    return _csv_response(f"PT_Register_{month}.csv", rows, ["employee_id", "name", "gross", "professional_tax"])


# ============================================================================
# BANK NEFT CSV
# ============================================================================

@router.get("/reports/neft")
async def bank_neft_csv(run_id: str):
    run = await db.payroll_runs.find_one({"run_id": run_id})
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    payslips = await db.payslips.find({"run_id": run_id, "status": {"$ne": "cancelled"}}, {"_id": 0}).sort("employee_id", 1).to_list(5000)
    rows = []
    for p in payslips:
        rows.append({
            "beneficiary_account": p.get("bank_account") or "",
            "beneficiary_ifsc": p.get("ifsc") or "",
            "beneficiary_name": p.get("employee_name") or "",
            "amount": f"{p['net_pay']:.2f}",
            "reference": p["payslip_id"],
            "remarks": f"Salary {p['month']}",
        })
    return _csv_response(
        f"NEFT_{run_id}.csv", rows,
        ["beneficiary_account", "beneficiary_ifsc", "beneficiary_name", "amount", "reference", "remarks"],
    )


# ============================================================================
# CONFIG endpoints
# ============================================================================

@router.get("/config")
async def get_config():
    cfg = await _config()
    return {"config": cfg}


class ConfigUpdate(BaseModel):
    basic_pct: Optional[float] = None
    hra_pct_of_basic: Optional[float] = None
    pf_pct: Optional[float] = None
    pf_wage_cap: Optional[int] = None
    esi_pct: Optional[float] = None
    esi_gross_cap: Optional[int] = None
    pt_amount: Optional[int] = None
    pt_amount_feb: Optional[int] = None
    std_deduction_annual: Optional[int] = None


@router.put("/config")
async def update_config(data: ConfigUpdate):
    body = {k: v for k, v in data.dict().items() if v is not None}
    if not body:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.payroll_config.update_one({"_id": "default"}, {"$set": body}, upsert=True)
    return {"success": True, "updated": body}
