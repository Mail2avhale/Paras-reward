"""
Careers Phase F — Performance Management + Incentives
Spec: §34 (target management), §35-37 (performance mgmt + evaluation), §39 (increment),
      §40 (promotion), §41 (incentive management)

Collections
-----------
performance_targets    : {target_id, employee_id, period, kind, metrics, assigned_by, assigned_at}
performance_appraisals : {appraisal_id, employee_id, cycle, self_review, manager_review,
                          kpi_scores, overall_score, rating, recommendation, status, reviewer, finalised_at}
incentive_rules        : {rule_id, name, department, kpi_name, tiers, effective_from, is_active}
incentive_awards       : {award_id, employee_id, cycle, rule_id, achievement, amount, status}
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from utils.audit_log import log_action

router = APIRouter(prefix="/public", tags=["Careers Phase F"])
db = None


def set_db(database):
    global db
    db = database


# =========================================================================
# Constants
# =========================================================================

TARGET_KINDS = ["daily", "weekly", "monthly", "quarterly", "annual"]

RATINGS = [
    "outstanding",           # 5
    "exceeds_expectations",  # 4
    "meets_expectations",    # 3
    "needs_improvement",     # 2
    "unsatisfactory",        # 1
]
RATING_SCORE = {"outstanding": 5, "exceeds_expectations": 4, "meets_expectations": 3, "needs_improvement": 2, "unsatisfactory": 1}

# Score % → auto-recommended rating (spec §35)
def _auto_rating(overall_pct: float) -> str:
    if overall_pct >= 90:
        return "outstanding"
    if overall_pct >= 75:
        return "exceeds_expectations"
    if overall_pct >= 60:
        return "meets_expectations"
    if overall_pct >= 40:
        return "needs_improvement"
    return "unsatisfactory"


RECOMMENDATIONS = ["increment", "promotion", "increment_and_promotion", "pip", "none"]
APPRAISAL_STATUSES = ["draft", "self_submitted", "manager_reviewed", "finalised"]

INCENTIVE_STATUSES = ["calculated", "approved", "rejected", "paid"]


# =========================================================================
#                            TARGETS (§34)
# =========================================================================

class Metric(BaseModel):
    name: str
    target_value: float
    unit: str = ""
    weight_pct: float = Field(..., ge=0, le=100)


class TargetRequest(BaseModel):
    employee_id: str
    period: str          # e.g. "2026-Q1", "2026-03", "2026-W12"
    kind: str = "monthly"
    metrics: List[Metric]
    admin_id: str = "admin"


@router.post("/performance/targets")
async def assign_targets(data: TargetRequest):
    if data.kind not in TARGET_KINDS:
        raise HTTPException(status_code=400, detail=f"Invalid kind. Use one of: {TARGET_KINDS}")
    emp = await db.employees.find_one({"employee_id": data.employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    total_weight = sum(m.weight_pct for m in data.metrics)
    if abs(total_weight - 100) > 0.01:
        raise HTTPException(status_code=400, detail=f"Metric weights must sum to 100 (got {total_weight})")

    now = datetime.now(timezone.utc).isoformat()
    target = {
        "target_id": f"TGT-{str(uuid.uuid4())[:10].upper()}",
        "employee_id": data.employee_id,
        "employee_name": emp.get("name"),
        "department": emp.get("department"),
        "period": data.period,
        "kind": data.kind,
        "metrics": [m.model_dump() for m in data.metrics],
        "assigned_by": data.admin_id,
        "assigned_at": now,
    }
    await db.performance_targets.insert_one(target)
    await log_action(db, data.admin_id, "target.assign", "performance_target", target["target_id"], None, target)
    target.pop("_id", None)
    return {"success": True, "target": target}


@router.get("/performance/targets")
async def list_targets(employee_id: Optional[str] = None, period: Optional[str] = None):
    q = {}
    if employee_id: q["employee_id"] = employee_id
    if period: q["period"] = period
    rows = await db.performance_targets.find(q, {"_id": 0}).sort("assigned_at", -1).to_list(500)
    return {"targets": rows, "total": len(rows)}


# =========================================================================
#                       APPRAISAL CYCLE (§35-37)
# =========================================================================

class KPIScore(BaseModel):
    name: str
    target: float
    achieved: float
    weight_pct: float = 0


class AppraisalCreate(BaseModel):
    employee_id: str
    cycle: str           # e.g. "2026-Q1"
    admin_id: str = "admin"


@router.post("/performance/appraisals")
async def create_appraisal(data: AppraisalCreate):
    emp = await db.employees.find_one({"employee_id": data.employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    # Idempotent per (employee_id, cycle)
    existing = await db.performance_appraisals.find_one({"employee_id": data.employee_id, "cycle": data.cycle}, {"_id": 0})
    if existing:
        return {"success": True, "already_exists": True, "appraisal": existing}

    now = datetime.now(timezone.utc).isoformat()
    record = {
        "appraisal_id": f"APR-{str(uuid.uuid4())[:10].upper()}",
        "employee_id": data.employee_id,
        "employee_name": emp.get("name"),
        "department": emp.get("department"),
        "cycle": data.cycle,
        "self_review": "",
        "manager_review": "",
        "kpi_scores": [],
        "overall_score": 0.0,
        "rating": None,
        "recommendation": "none",
        "status": "draft",
        "reviewer": None,
        "created_by": data.admin_id,
        "created_at": now,
        "updated_at": now,
        "finalised_at": None,
    }
    await db.performance_appraisals.insert_one(record)
    await log_action(db, data.admin_id, "appraisal.create", "performance_appraisal", record["appraisal_id"], None, record)
    record.pop("_id", None)
    return {"success": True, "already_exists": False, "appraisal": record}


class AppraisalUpdate(BaseModel):
    self_review: Optional[str] = None
    manager_review: Optional[str] = None
    kpi_scores: Optional[List[KPIScore]] = None
    admin_id: str = "admin"
    status_action: Optional[str] = None  # 'submit_self' | 'manager_review'


def _compute_overall(kpi_scores: List[dict]) -> float:
    if not kpi_scores:
        return 0.0
    total_w = sum(k.get("weight_pct", 0) for k in kpi_scores)
    if total_w <= 0:
        # unweighted average of achievement %
        vals = []
        for k in kpi_scores:
            t = k.get("target") or 0
            a = k.get("achieved") or 0
            vals.append(min(150, (a / t * 100) if t else 0))
        return round(sum(vals) / len(vals), 2)
    weighted = 0.0
    for k in kpi_scores:
        t = k.get("target") or 0
        a = k.get("achieved") or 0
        pct = min(150, (a / t * 100) if t else 0)
        weighted += pct * (k.get("weight_pct", 0) / 100.0)
    return round(weighted, 2)


@router.patch("/performance/appraisals/{appraisal_id}")
async def update_appraisal(appraisal_id: str, data: AppraisalUpdate):
    row = await db.performance_appraisals.find_one({"appraisal_id": appraisal_id})
    if not row:
        raise HTTPException(status_code=404, detail="Appraisal not found")
    if row["status"] == "finalised":
        raise HTTPException(status_code=400, detail="Appraisal already finalised — cannot update")

    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.self_review is not None:
        updates["self_review"] = data.self_review
    if data.manager_review is not None:
        updates["manager_review"] = data.manager_review
        updates["reviewer"] = data.admin_id
    if data.kpi_scores is not None:
        scores = [k.model_dump() for k in data.kpi_scores]
        updates["kpi_scores"] = scores
        overall = _compute_overall(scores)
        updates["overall_score"] = overall
        updates["rating"] = _auto_rating(overall)
    if data.status_action == "submit_self" and row["status"] == "draft":
        updates["status"] = "self_submitted"
    elif data.status_action == "manager_review" and row["status"] in ("draft", "self_submitted"):
        updates["status"] = "manager_reviewed"

    await db.performance_appraisals.update_one({"appraisal_id": appraisal_id}, {"$set": updates})
    await log_action(db, data.admin_id, "appraisal.update", "performance_appraisal", appraisal_id, row, updates)
    fresh = await db.performance_appraisals.find_one({"appraisal_id": appraisal_id}, {"_id": 0})
    return {"success": True, "appraisal": fresh}


class AppraisalFinalize(BaseModel):
    recommendation: str = "none"
    admin_id: str = "admin"


@router.post("/performance/appraisals/{appraisal_id}/finalize")
async def finalize_appraisal(appraisal_id: str, data: AppraisalFinalize):
    if data.recommendation not in RECOMMENDATIONS:
        raise HTTPException(status_code=400, detail=f"Invalid recommendation. Use one of: {RECOMMENDATIONS}")
    row = await db.performance_appraisals.find_one({"appraisal_id": appraisal_id})
    if not row:
        raise HTTPException(status_code=404, detail="Appraisal not found")
    if row["status"] == "finalised":
        raise HTTPException(status_code=400, detail="Already finalised")

    now = datetime.now(timezone.utc).isoformat()
    await db.performance_appraisals.update_one(
        {"appraisal_id": appraisal_id},
        {"$set": {"status": "finalised", "recommendation": data.recommendation, "finalised_at": now, "reviewer": data.admin_id, "updated_at": now}},
    )
    await log_action(db, data.admin_id, "appraisal.finalize", "performance_appraisal", appraisal_id, row, {"recommendation": data.recommendation, "rating": row.get("rating")})
    fresh = await db.performance_appraisals.find_one({"appraisal_id": appraisal_id}, {"_id": 0})
    return {"success": True, "appraisal": fresh}


@router.get("/performance/appraisals")
async def list_appraisals(employee_id: Optional[str] = None, cycle: Optional[str] = None, status: Optional[str] = None):
    q = {}
    if employee_id: q["employee_id"] = employee_id
    if cycle: q["cycle"] = cycle
    if status: q["status"] = status
    rows = await db.performance_appraisals.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"appraisals": rows, "total": len(rows)}


# =========================================================================
#                          INCENTIVES (§41)
# =========================================================================

class IncentiveTier(BaseModel):
    threshold_pct: float  # e.g. 100 = at target, 120 = 20% over target
    amount: float = 0
    pct_of_ctc: float = 0


class IncentiveRuleRequest(BaseModel):
    name: str
    department: Optional[str] = None
    kpi_name: str
    tiers: List[IncentiveTier]
    effective_from: Optional[str] = None
    is_active: bool = True
    admin_id: str = "admin"


@router.post("/incentive/rules")
async def create_incentive_rule(data: IncentiveRuleRequest):
    if not data.tiers:
        raise HTTPException(status_code=400, detail="At least one tier required")
    # Sort tiers by threshold descending — highest match wins on calc
    tiers = sorted([t.model_dump() for t in data.tiers], key=lambda x: x["threshold_pct"], reverse=True)
    rule = {
        "rule_id": f"INR-{str(uuid.uuid4())[:10].upper()}",
        "name": data.name,
        "department": data.department,
        "kpi_name": data.kpi_name,
        "tiers": tiers,
        "effective_from": data.effective_from or datetime.now(timezone.utc).isoformat(),
        "is_active": data.is_active,
        "created_by": data.admin_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.incentive_rules.insert_one(rule)
    await log_action(db, data.admin_id, "incentive_rule.create", "incentive_rule", rule["rule_id"], None, rule)
    rule.pop("_id", None)
    return {"success": True, "rule": rule}


@router.get("/incentive/rules")
async def list_incentive_rules(active_only: bool = False, department: Optional[str] = None):
    q = {}
    if active_only:
        q["is_active"] = True
    if department:
        q["$or"] = [{"department": department}, {"department": None}]
    rows = await db.incentive_rules.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"rules": rows, "total": len(rows)}


class IncentiveCalcRequest(BaseModel):
    employee_id: str
    cycle: str
    admin_id: str = "admin"


@router.post("/incentive/calculate")
async def calculate_incentives(data: IncentiveCalcRequest):
    """Compute incentive awards for an employee based on the latest appraisal
    KPI scores against every active rule for the employee's department."""
    emp = await db.employees.find_one({"employee_id": data.employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    appraisal = await db.performance_appraisals.find_one({"employee_id": data.employee_id, "cycle": data.cycle})
    if not appraisal:
        raise HTTPException(status_code=404, detail=f"No appraisal for {data.employee_id} in {data.cycle}")

    dept = emp.get("department")
    rules = await db.incentive_rules.find({
        "is_active": True,
        "$or": [{"department": dept}, {"department": None}, {"department": ""}],
    }).to_list(200)

    kpi_map = {k.get("name"): k for k in appraisal.get("kpi_scores", [])}
    ctc = None  # optional CTC pull if needed
    now = datetime.now(timezone.utc).isoformat()
    awards = []

    for rule in rules:
        kpi = kpi_map.get(rule["kpi_name"])
        if not kpi:
            continue
        target = kpi.get("target") or 0
        achieved = kpi.get("achieved") or 0
        pct = (achieved / target * 100) if target else 0

        matched_tier = None
        for t in rule["tiers"]:  # already sorted desc
            if pct >= t["threshold_pct"]:
                matched_tier = t
                break
        if not matched_tier:
            continue

        amount = matched_tier.get("amount", 0)
        if matched_tier.get("pct_of_ctc", 0) > 0 and ctc:
            amount = max(amount, ctc * matched_tier["pct_of_ctc"] / 100)

        award = {
            "award_id": f"AWD-{str(uuid.uuid4())[:10].upper()}",
            "employee_id": data.employee_id,
            "employee_name": emp.get("name"),
            "cycle": data.cycle,
            "rule_id": rule["rule_id"],
            "rule_name": rule["name"],
            "kpi_name": rule["kpi_name"],
            "achievement_pct": round(pct, 2),
            "matched_tier": matched_tier,
            "amount": round(amount, 2),
            "status": "calculated",
            "calculated_at": now,
            "calculated_by": data.admin_id,
        }
        await db.incentive_awards.insert_one(award)
        award.pop("_id", None)
        awards.append(award)

    await log_action(db, data.admin_id, "incentive.calculate", "incentive_award", data.employee_id, None, {"cycle": data.cycle, "count": len(awards)})
    return {"success": True, "awards": awards, "count": len(awards)}


class AwardDecision(BaseModel):
    action: str  # approve | reject | pay
    admin_id: str = "admin"
    comment: str = ""


@router.post("/incentive/awards/{award_id}/decide")
async def decide_award(award_id: str, data: AwardDecision):
    row = await db.incentive_awards.find_one({"award_id": award_id})
    if not row:
        raise HTTPException(status_code=404, detail="Award not found")
    action = data.action.strip().lower()
    if action not in ("approve", "reject", "pay"):
        raise HTTPException(status_code=400, detail="action must be one of approve/reject/pay")

    # Enforce a sensible state machine
    allowed = {
        "calculated": {"approve", "reject"},
        "approved": {"pay", "reject"},
    }
    current = row["status"]
    if action not in allowed.get(current, set()):
        raise HTTPException(status_code=400, detail=f"Cannot {action} an award currently in state '{current}'")

    new_status = {"approve": "approved", "reject": "rejected", "pay": "paid"}[action]
    now = datetime.now(timezone.utc).isoformat()
    await db.incentive_awards.update_one(
        {"award_id": award_id},
        {"$set": {"status": new_status, "decided_at": now, "decided_by": data.admin_id, "decision_comment": data.comment}},
    )
    await log_action(db, data.admin_id, f"incentive.{action}", "incentive_award", award_id, row, {"status": new_status})
    return {"success": True, "status": new_status}


@router.get("/incentive/awards")
async def list_awards(employee_id: Optional[str] = None, status: Optional[str] = None, cycle: Optional[str] = None):
    q = {}
    if employee_id: q["employee_id"] = employee_id
    if status: q["status"] = status
    if cycle: q["cycle"] = cycle
    rows = await db.incentive_awards.find(q, {"_id": 0}).sort("calculated_at", -1).to_list(1000)
    return {"awards": rows, "total": len(rows)}
