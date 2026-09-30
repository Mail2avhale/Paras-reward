"""
GST Invoice System for Paras Rewards
- Generate GST-compliant invoices
- PDF generation with reportlab
- Sequential invoice numbering
- Database storage
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import logging
from io import BytesIO
import base64

# PDF generation
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os as _os

# Register a Unicode-capable font once at module import so the rupee (₹,
# U+20B9) glyph renders correctly.  Helvetica (default) and LiberationSans
# on this container do NOT ship the rupee glyph — FreeSans does.
_FONT_REG = "Helvetica"
_FONT_BOLD = "Helvetica-Bold"
try:
    _candidates = [
        # (regular, bold) — first pair that exists AND has ₹ wins
        (
            "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
        ),
        (
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ),
    ]
    for _reg, _bld in _candidates:
        if _os.path.exists(_reg) and _os.path.exists(_bld):
            pdfmetrics.registerFont(TTFont("InvoiceSans", _reg))
            pdfmetrics.registerFont(TTFont("InvoiceSans-Bold", _bld))
            _FONT_REG = "InvoiceSans"
            _FONT_BOLD = "InvoiceSans-Bold"
            logging.info(f"[INVOICE] Registered {_reg} for rupee-glyph support")
            break
except Exception as _fe:
    logging.warning(f"[INVOICE] Unicode font registration failed, using Helvetica: {_fe}")

router = APIRouter(prefix="/invoice", tags=["GST Invoice"])

# Company Details
COMPANY_NAME = "PARAS REWARDS TECHNOLOGIES PRIVATE LIMITED"
COMPANY_GSTIN = "27AAQCP6686E1ZR"
COMPANY_ADDRESS = (
    "Office No. A-38, Ground Floor, Bizz Tower, "
    "Chhatrapati Sambhajinagar (Aurangabad), Maharashtra, 431006"
)
COMPANY_EMAIL = "info@parasreward.com"
COMPANY_WEBSITE = "www.parasreward.com"
COMPANY_PHONE = "+91 9970100782"

# GST Rate
GST_RATE = 18  # 18%

# Database reference
db = None

def set_db(database):
    global db
    db = database


class InvoiceRequest(BaseModel):
    user_id: str
    amount: float  # Total amount (GST inclusive)
    payment_id: str  # Razorpay payment ID
    plan_name: str  # startup, growth, elite
    plan_type: str  # monthly, quarterly, etc.


class InvoiceResponse(BaseModel):
    invoice_id: str
    invoice_number: str
    pdf_base64: Optional[str] = None
    pdf_url: Optional[str] = None


async def get_next_invoice_number() -> str:
    """Generate sequential invoice number: PRC-YYYY-XXXXX"""
    current_year = datetime.now(timezone.utc).year
    
    # Find the last invoice number for this year
    last_invoice = await db.invoices.find_one(
        {"invoice_number": {"$regex": f"^PRC-{current_year}-"}},
        sort=[("invoice_number", -1)]
    )
    
    if last_invoice:
        # Extract the sequence number and increment
        last_num = int(last_invoice["invoice_number"].split("-")[-1])
        next_num = last_num + 1
    else:
        next_num = 1
    
    return f"PRC-{current_year}-{next_num:05d}"


def calculate_gst(total_amount: float) -> dict:
    """
    Calculate GST breakdown from total amount (GST inclusive)
    Formula: Base = Total / 1.18, GST = Total - Base
    """
    base_amount = round(total_amount / 1.18, 2)
    gst_amount = round(total_amount - base_amount, 2)
    
    # For intra-state (Maharashtra), split into CGST and SGST
    cgst = round(gst_amount / 2, 2)
    sgst = round(gst_amount / 2, 2)
    
    return {
        "base_amount": base_amount,
        "gst_amount": gst_amount,
        "cgst": cgst,
        "sgst": sgst,
        "cgst_rate": GST_RATE / 2,
        "sgst_rate": GST_RATE / 2,
        "total_amount": total_amount
    }


def generate_invoice_pdf(invoice_data: dict) -> bytes:
    """Generate PDF invoice using reportlab"""

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18*mm,
        leftMargin=18*mm,
        topMargin=18*mm,
        bottomMargin=18*mm
    )

    styles = getSampleStyleSheet()

    # Custom styles — all bound to the Unicode-capable font so ₹ renders.
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontName=_FONT_BOLD,
        fontSize=16,
        alignment=TA_CENTER,
        spaceAfter=6,
    )

    header_style = ParagraphStyle(
        'Header',
        parent=styles['Normal'],
        fontName=_FONT_REG,
        fontSize=9,
        alignment=TA_CENTER,
        leading=12,
    )

    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontName=_FONT_REG,
        fontSize=10,
        leading=13,
    )

    bold_style = ParagraphStyle(
        'Bold',
        parent=styles['Normal'],
        fontName=_FONT_BOLD,
        fontSize=10,
    )

    # Cell paragraphs — Description wraps naturally instead of overflowing
    cell_wrap_style = ParagraphStyle(
        'CellWrap',
        parent=styles['Normal'],
        fontName=_FONT_REG,
        fontSize=10,
        leading=13,
    )
    cell_wrap_bold = ParagraphStyle(
        'CellWrapBold',
        parent=styles['Normal'],
        fontName=_FONT_BOLD,
        fontSize=10,
        leading=13,
    )
    cell_right_style = ParagraphStyle(
        'CellRight',
        parent=styles['Normal'],
        fontName=_FONT_REG,
        fontSize=10,
        alignment=TA_RIGHT,
        leading=13,
    )
    cell_right_bold = ParagraphStyle(
        'CellRightBold',
        parent=styles['Normal'],
        fontName=_FONT_BOLD,
        fontSize=11,
        alignment=TA_RIGHT,
        leading=14,
    )

    elements = []

    # Company Header — full address split into wrapped lines
    elements.append(Paragraph(COMPANY_NAME, title_style))
    elements.append(Paragraph(f"GSTIN: {COMPANY_GSTIN}", header_style))
    elements.append(Paragraph(COMPANY_ADDRESS, header_style))
    elements.append(Paragraph(
        f"Email: {COMPANY_EMAIL} &nbsp;|&nbsp; Website: {COMPANY_WEBSITE} &nbsp;|&nbsp; Phone: {COMPANY_PHONE}",
        header_style,
    ))
    elements.append(Spacer(1, 14))

    # TAX INVOICE Title
    elements.append(Paragraph("<b>TAX INVOICE</b>", ParagraphStyle(
        'InvoiceTitle',
        parent=styles['Heading2'],
        fontName=_FONT_BOLD,
        fontSize=14,
        alignment=TA_CENTER,
        textColor=colors.darkblue
    )))
    elements.append(Spacer(1, 12))

    # Invoice Details Table
    invoice_info = [
        ["Invoice Number:", invoice_data["invoice_number"], "Date:", invoice_data["date"]],
        ["Payment ID:", invoice_data["payment_id"], "", ""]
    ]

    info_table = Table(invoice_info, colWidths=[85, 165, 50, 100])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), _FONT_BOLD),
        ('FONTNAME', (2, 0), (2, -1), _FONT_BOLD),
        ('FONTNAME', (1, 0), (1, -1), _FONT_REG),
        ('FONTNAME', (3, 0), (3, -1), _FONT_REG),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 14))

    # Customer Details
    elements.append(Paragraph("<b>Bill To:</b>", bold_style))
    elements.append(Paragraph(f"Name: {invoice_data['customer_name']}", normal_style))
    elements.append(Paragraph(f"Email: {invoice_data['customer_email']}", normal_style))
    if invoice_data.get('customer_phone'):
        elements.append(Paragraph(f"Phone: {invoice_data['customer_phone']}", normal_style))
    elements.append(Spacer(1, 18))

    # Service Details Table — Description in Paragraph so it wraps cleanly
    gst = invoice_data["gst_breakdown"]
    plan_desc = (
        f"Digital Platform Subscription — "
        f"{invoice_data['plan_name'].title()} Plan ({invoice_data['plan_type'].title()})"
    )

    service_data = [
        [
            Paragraph("<b>Description</b>", cell_wrap_bold),
            Paragraph("<b>SAC Code</b>", cell_wrap_bold),
            Paragraph("<b>Amount (Rs.)</b>", cell_right_bold),
        ],
        [
            Paragraph(plan_desc, cell_wrap_style),
            Paragraph("998314", cell_wrap_style),
            Paragraph(f"\u20B9{gst['base_amount']:,.2f}", cell_right_style),
        ],
        ["", "", ""],
        [
            Paragraph("Subtotal", cell_wrap_style),
            "",
            Paragraph(f"\u20B9{gst['base_amount']:,.2f}", cell_right_style),
        ],
        [
            Paragraph(f"CGST @ {gst['cgst_rate']}%", cell_wrap_style),
            "",
            Paragraph(f"\u20B9{gst['cgst']:,.2f}", cell_right_style),
        ],
        [
            Paragraph(f"SGST @ {gst['sgst_rate']}%", cell_wrap_style),
            "",
            Paragraph(f"\u20B9{gst['sgst']:,.2f}", cell_right_style),
        ],
        ["", "", ""],
        [
            Paragraph("<b>Total Amount</b>", cell_wrap_bold),
            "",
            Paragraph(f"<b>\u20B9{gst['total_amount']:,.2f}</b>", cell_right_bold),
        ],
    ]

    # A4 minus margins ≈ 174mm ≈ 493pt → 300 + 70 + 123 = 493
    service_table = Table(service_data, colWidths=[300, 70, 123])
    service_table.setStyle(TableStyle([
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.2, 0.3, 0.5)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),

        # Body
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),

        # Total row
        ('BACKGROUND', (0, -1), (-1, -1), colors.Color(0.9, 0.95, 1)),
        ('FONTSIZE', (0, -1), (-1, -1), 12),

        # Grid
        ('GRID', (0, 0), (-1, 0), 1, colors.white),
        ('LINEBELOW', (0, 0), (-1, 0), 2, colors.darkblue),
        ('LINEBELOW', (0, 3), (-1, 3), 0.5, colors.grey),
        ('LINEABOVE', (0, -1), (-1, -1), 1, colors.darkblue),
        ('LINEBELOW', (0, -1), (-1, -1), 2, colors.darkblue),
    ]))
    elements.append(service_table)
    elements.append(Spacer(1, 22))

    # Amount in Words
    amount_words = number_to_words(int(gst['total_amount']))
    elements.append(Paragraph(f"<b>Amount in Words:</b> {amount_words} Only", normal_style))
    elements.append(Spacer(1, 18))

    # Terms
    terms_style = ParagraphStyle(
        'Terms',
        parent=styles['Normal'],
        fontName=_FONT_REG,
        fontSize=8,
        textColor=colors.grey
    )
    elements.append(Paragraph("<b>Terms &amp; Conditions:</b>", terms_style))
    elements.append(Paragraph("1. This is a computer-generated invoice and does not require a signature.", terms_style))
    elements.append(Paragraph("2. Payment once made is non-refundable.", terms_style))
    elements.append(Paragraph("3. This invoice is for digital platform access services only.", terms_style))
    elements.append(Spacer(1, 18))

    # Footer
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontName=_FONT_REG,
        fontSize=9,
        alignment=TA_CENTER,
        textColor=colors.darkblue,
        leading=12,
    )
    elements.append(Paragraph("Thank you for your subscription!", footer_style))
    elements.append(Paragraph(
        f"Email: {COMPANY_EMAIL} &nbsp;|&nbsp; Website: {COMPANY_WEBSITE} &nbsp;|&nbsp; Phone: {COMPANY_PHONE}",
        footer_style,
    ))

    # Build PDF
    doc.build(elements)

    return buffer.getvalue()


def number_to_words(num: int) -> str:
    """Convert number to words (Indian numbering system)"""
    ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
            'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
            'Seventeen', 'Eighteen', 'Nineteen']
    tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
    
    if num == 0:
        return 'Zero'
    
    def words_under_100(n):
        if n < 20:
            return ones[n]
        return tens[n // 10] + ('' if n % 10 == 0 else ' ' + ones[n % 10])
    
    def words_under_1000(n):
        if n < 100:
            return words_under_100(n)
        return ones[n // 100] + ' Hundred' + ('' if n % 100 == 0 else ' ' + words_under_100(n % 100))
    
    if num < 1000:
        return words_under_1000(num)
    elif num < 100000:  # Less than 1 lakh
        return words_under_1000(num // 1000) + ' Thousand' + ('' if num % 1000 == 0 else ' ' + words_under_1000(num % 1000))
    elif num < 10000000:  # Less than 1 crore
        return words_under_1000(num // 100000) + ' Lakh' + ('' if num % 100000 == 0 else ' ' + words_under_1000((num % 100000) // 1000) + ' Thousand' if (num % 100000) >= 1000 else '') + ('' if num % 1000 == 0 else ' ' + words_under_1000(num % 1000))
    else:
        return f"Rupees {num:,}"


@router.post("/generate")
async def generate_invoice(request: InvoiceRequest):
    """Generate GST invoice for a payment"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Check if invoice already exists for this payment
    existing = await db.invoices.find_one({"payment_id": request.payment_id})
    if existing:
        return {
            "success": True,
            "message": "Invoice already exists",
            "invoice_id": existing["invoice_id"],
            "invoice_number": existing["invoice_number"]
        }
    
    # Get user details
    user = await db.users.find_one({"uid": request.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate invoice number
    invoice_number = await get_next_invoice_number()
    invoice_id = f"INV_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{request.user_id[:8]}"
    
    # Calculate GST
    gst_breakdown = calculate_gst(request.amount)
    
    # Resolve customer state (from user profile) for GST compliance + reporting
    customer_state = (user.get("state") or "").strip()
    # Fallback to KYC submission if user.state is empty
    if not customer_state:
        try:
            kyc = await db.kyc_submissions.find_one(
                {"user_id": request.user_id},
                {"_id": 0, "state": 1, "address_state": 1},
            )
            if kyc:
                customer_state = (kyc.get("state") or kyc.get("address_state") or "").strip()
        except Exception:
            pass
    if not customer_state:
        customer_state = "Unknown"

    # Prepare invoice data
    invoice_data = {
        "invoice_id": invoice_id,
        "invoice_number": invoice_number,
        "user_id": request.user_id,
        "customer_name": user.get("name", "Customer"),
        "customer_email": user.get("email", ""),
        "customer_phone": user.get("phone", ""),
        "customer_state": customer_state,
        "payment_id": request.payment_id,
        "plan_name": request.plan_name,
        "plan_type": request.plan_type,
        "amount": request.amount,
        "gst_breakdown": gst_breakdown,
        "date": datetime.now(timezone.utc).strftime("%d-%m-%Y"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "company": {
            "name": COMPANY_NAME,
            "gstin": COMPANY_GSTIN,
            "address": COMPANY_ADDRESS
        }
    }
    
    # Generate PDF
    try:
        pdf_bytes = generate_invoice_pdf(invoice_data)
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        invoice_data["pdf_base64"] = pdf_base64
    except Exception as e:
        logging.error(f"PDF generation error: {e}")
        pdf_base64 = None
    
    # Save to database
    await db.invoices.insert_one(invoice_data)
    
    return {
        "success": True,
        "message": "Invoice generated successfully",
        "invoice_id": invoice_id,
        "invoice_number": invoice_number,
        "gst_breakdown": gst_breakdown,
        "pdf_base64": pdf_base64
    }


@router.get("/user/{user_id}")
async def get_user_invoices(user_id: str, limit: int = 20):
    """Get all invoices for a user"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    invoices = await db.invoices.find(
        {"user_id": user_id},
        {"_id": 0, "pdf_base64": 0}  # Exclude large fields
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {
        "success": True,
        "invoices": invoices,
        "count": len(invoices)
    }


@router.get("/{invoice_id}")
async def get_invoice(invoice_id: str):
    """Get single invoice with PDF"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    invoice = await db.invoices.find_one(
        {"$or": [{"invoice_id": invoice_id}, {"invoice_number": invoice_id}]},
        {"_id": 0}
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return {
        "success": True,
        "invoice": invoice
    }


@router.get("/{invoice_id}/pdf")
async def get_invoice_pdf(invoice_id: str):
    """Get invoice PDF as base64"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    invoice = await db.invoices.find_one(
        {"$or": [{"invoice_id": invoice_id}, {"invoice_number": invoice_id}]},
        {"_id": 0, "pdf_base64": 1, "invoice_number": 1}
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if not invoice.get("pdf_base64"):
        # Regenerate PDF if not stored
        full_invoice = await db.invoices.find_one(
            {"$or": [{"invoice_id": invoice_id}, {"invoice_number": invoice_id}]},
            {"_id": 0}
        )
        pdf_bytes = generate_invoice_pdf(full_invoice)
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        # Update database
        await db.invoices.update_one(
            {"invoice_id": full_invoice["invoice_id"]},
            {"$set": {"pdf_base64": pdf_base64}}
        )
    else:
        pdf_base64 = invoice["pdf_base64"]
    
    return {
        "success": True,
        "invoice_number": invoice.get("invoice_number"),
        "pdf_base64": pdf_base64,
        "content_type": "application/pdf",
        "filename": f"{invoice.get('invoice_number', 'invoice')}.pdf"
    }


@router.get("/admin/all")
async def get_all_invoices(
    page: int = 1,
    limit: int = 50,
    month: Optional[int] = None,
    year: Optional[int] = None,
    from_date: Optional[str] = None,     # YYYY-MM-DD (Sep 2026)
    to_date: Optional[str] = None,       # YYYY-MM-DD (Sep 2026)
    search: Optional[str] = None,        # invoice#/name/phone/payment_id
    invoice_type: Optional[str] = None,  # "vip" | "service_charge" | None (all)
):
    """Admin: Get all invoices for GST reporting.

    Sep 17 2026 — added `from_date`/`to_date` range, free-text `search`
    and `invoice_type` filter so the admin UI can drill from the state
    summary down to individual invoice PDFs.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")

    query: dict = {}

    # 1) Date filter — prefer explicit range, fall back to month/year
    if from_date or to_date:
        date_q: dict = {}
        if from_date:
            date_q["$gte"] = from_date  # ISO strings sort lexicographically
        if to_date:
            # inclusive end-of-day
            date_q["$lte"] = f"{to_date}T23:59:59.999999+00:00"
        query["created_at"] = date_q
    elif month and year:
        start_date = f"{year}-{month:02d}-01"
        if month == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{month + 1:02d}-01"
        query["created_at"] = {"$gte": start_date, "$lt": end_date}
    elif year:
        query["created_at"] = {"$gte": f"{year}-01-01", "$lt": f"{year + 1}-01-01"}

    # 2) Invoice type filter (redemption_service_charge is explicit; anything
    #    else / missing = VIP subscription invoice — that's what we shipped
    #    before Sep 2026).
    if invoice_type == "service_charge":
        query["invoice_type"] = "redemption_service_charge"
    elif invoice_type == "vip":
        query["$or"] = [
            {"invoice_type": {"$exists": False}},
            {"invoice_type": {"$ne": "redemption_service_charge"}},
        ]

    # 3) Free-text search over user-visible fields
    if search:
        s = search.strip()
        if s:
            rx = {"$regex": s, "$options": "i"}
            text_or = [
                {"invoice_number": rx},
                {"customer_name": rx},
                {"customer_phone": rx},
                {"customer_email": rx},
                {"payment_id": rx},
                {"invoice_id": rx},
                {"service_charge_id": rx},
            ]
            # Merge with any pre-existing $or from invoice_type filter
            if "$or" in query:
                query = {"$and": [{"$or": query.pop("$or")}, {"$or": text_or}, query]}
            else:
                query["$or"] = text_or

    skip = (page - 1) * limit

    invoices = await db.invoices.find(
        query,
        {"_id": 0, "pdf_base64": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    total = await db.invoices.count_documents(query)

    # Aggregate GST across the FULL filtered set (not just this page) so the
    # summary card at the top of the admin UI is always correct.
    agg_cursor = db.invoices.aggregate([
        {"$match": query},
        {"$group": {
            "_id": None,
            "total_base":   {"$sum": "$gst_breakdown.base_amount"},
            "total_gst":    {"$sum": "$gst_breakdown.gst_amount"},
            "total_amount": {"$sum": "$amount"},
            "count":        {"$sum": 1},
        }},
    ])
    agg = await agg_cursor.to_list(1)
    if agg:
        total_base = float(agg[0].get("total_base") or 0)
        total_gst = float(agg[0].get("total_gst") or 0)
        total_amount = float(agg[0].get("total_amount") or 0)
    else:
        total_base = total_gst = total_amount = 0

    return {
        "success": True,
        "invoices": invoices,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit
        },
        "gst_summary": {
            "total_base_amount": round(total_base, 2),
            "total_gst": round(total_gst, 2),
            "total_cgst": round(total_gst / 2, 2),
            "total_sgst": round(total_gst / 2, 2),
            "total_amount": round(total_amount, 2)
        }
    }



# Company registered state (Maharashtra - GSTIN starts with 27)
COMPANY_STATE = "Maharashtra"


@router.get("/admin/state-wise-report")
async def get_state_wise_gst_report(
    month: Optional[int] = None,
    year: Optional[int] = None,
):
    """
    Admin: Monthly state-wise GST collection report.
    For each customer state in the given month, returns:
      - invoice_count, total_base, total_gst
      - gst_type (CGST_SGST for Maharashtra / IGST for others)
      - cgst + sgst (intra-state) OR igst (inter-state)
    Defaults to the current month if month/year not given.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")

    now = datetime.now(timezone.utc)
    if not year:
        year = now.year
    if not month:
        month = now.month
    if month < 1 or month > 12 or year < 2020 or year > 2100:
        raise HTTPException(status_code=400, detail="Invalid month/year")

    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"

    # 1. Pull invoices in the month
    invoices = await db.invoices.find(
        {"created_at": {"$gte": start_date, "$lt": end_date}},
        {"_id": 0, "pdf_base64": 0},
    ).to_list(50000)

    if not invoices:
        return {
            "success": True,
            "month": month,
            "year": year,
            "period_label": datetime(year, month, 1).strftime("%B %Y"),
            "company_state": COMPANY_STATE,
            "total_states": 0,
            "summary": {
                "total_invoices": 0, "total_base": 0, "total_gst": 0,
                "total_cgst": 0, "total_sgst": 0, "total_igst": 0, "total_amount": 0,
                "intra_state_count": 0, "inter_state_count": 0, "unknown_state_count": 0,
            },
            "states": [],
        }

    # 2. Enrich with state — PREFER invoice.customer_state (historical snapshot),
    # FALLBACK to current users.state, then KYC
    user_ids = list({inv.get("user_id") for inv in invoices if inv.get("user_id")})
    users_cursor = db.users.find(
        {"uid": {"$in": user_ids}},
        {"_id": 0, "uid": 1, "state": 1},
    )
    uid_to_state = {}
    async for u in users_cursor:
        uid_to_state[u["uid"]] = (u.get("state") or "").strip()

    # Secondary fallback: KYC submissions
    kyc_cursor = db.kyc_submissions.find(
        {"user_id": {"$in": user_ids}},
        {"_id": 0, "user_id": 1, "state": 1, "address_state": 1},
    )
    async for k in kyc_cursor:
        uid = k.get("user_id")
        if uid and not uid_to_state.get(uid):
            uid_to_state[uid] = (k.get("state") or k.get("address_state") or "").strip()

    def _resolve_state(inv):
        # priority: invoice.customer_state (snapshot) > users.state > KYC > "Unknown"
        s = (inv.get("customer_state") or "").strip()
        if not s:
            s = uid_to_state.get(inv.get("user_id", ""), "")
        return s if s else "Unknown"

    # 3. Group by state and compute GST breakdown
    by_state = {}
    totals = {
        "total_invoices": 0, "total_base": 0.0, "total_gst": 0.0,
        "total_cgst": 0.0, "total_sgst": 0.0, "total_igst": 0.0, "total_amount": 0.0,
        "intra_state_count": 0, "inter_state_count": 0, "unknown_state_count": 0,
    }

    for inv in invoices:
        state = _resolve_state(inv)
        breakdown = inv.get("gst_breakdown", {}) or {}
        base = float(breakdown.get("base_amount", 0) or 0)
        gst = float(breakdown.get("gst_amount", 0) or 0)
        amt = float(inv.get("amount", 0) or 0)

        bucket = by_state.setdefault(state, {
            "state": state,
            "is_intra_state": state == COMPANY_STATE,
            "gst_type": "CGST+SGST" if state == COMPANY_STATE else ("IGST" if state != "Unknown" else "UNKNOWN"),
            "invoice_count": 0,
            "total_base": 0.0,
            "total_gst": 0.0,
            "cgst": 0.0, "sgst": 0.0, "igst": 0.0,
            "total_amount": 0.0,
        })
        bucket["invoice_count"] += 1
        bucket["total_base"] += base
        bucket["total_gst"] += gst
        bucket["total_amount"] += amt
        if state == COMPANY_STATE:
            bucket["cgst"] += gst / 2.0
            bucket["sgst"] += gst / 2.0
            totals["intra_state_count"] += 1
        elif state == "Unknown":
            totals["unknown_state_count"] += 1
        else:
            bucket["igst"] += gst
            totals["inter_state_count"] += 1

        totals["total_invoices"] += 1
        totals["total_base"] += base
        totals["total_gst"] += gst
        totals["total_amount"] += amt
        if state == COMPANY_STATE:
            totals["total_cgst"] += gst / 2.0
            totals["total_sgst"] += gst / 2.0
        elif state != "Unknown":
            totals["total_igst"] += gst

    # Round + sort by gst desc
    states_list = []
    for s in by_state.values():
        for k in ("total_base", "total_gst", "cgst", "sgst", "igst", "total_amount"):
            s[k] = round(s[k], 2)
        states_list.append(s)
    states_list.sort(key=lambda x: x["total_gst"], reverse=True)

    for k in totals:
        if isinstance(totals[k], float):
            totals[k] = round(totals[k], 2)

    return {
        "success": True,
        "month": month,
        "year": year,
        "period_label": datetime(year, month, 1).strftime("%B %Y"),
        "company_state": COMPANY_STATE,
        "total_states": len(states_list),
        "summary": totals,
        "states": states_list,
    }


@router.get("/admin/yearly-gst-summary")
async def get_yearly_gst_summary(year: Optional[int] = None):
    """Monthly GST collection for the whole year (for trend charts)."""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    if not year:
        year = datetime.now(timezone.utc).year

    months_data = []
    for m in range(1, 13):
        start_date = f"{year}-{m:02d}-01"
        end_date = f"{year}-{m + 1:02d}-01" if m < 12 else f"{year + 1}-01-01"
        invoices = await db.invoices.find(
            {"created_at": {"$gte": start_date, "$lt": end_date}},
            {"_id": 0, "amount": 1, "gst_breakdown": 1},
        ).to_list(50000)
        total_gst = sum(float((inv.get("gst_breakdown") or {}).get("gst_amount", 0) or 0) for inv in invoices)
        total_amount = sum(float(inv.get("amount", 0) or 0) for inv in invoices)
        months_data.append({
            "month": m,
            "month_label": datetime(year, m, 1).strftime("%b"),
            "invoice_count": len(invoices),
            "total_gst": round(total_gst, 2),
            "total_amount": round(total_amount, 2),
        })

    return {
        "success": True,
        "year": year,
        "total_gst": round(sum(m["total_gst"] for m in months_data), 2),
        "total_amount": round(sum(m["total_amount"] for m in months_data), 2),
        "total_invoices": sum(m["invoice_count"] for m in months_data),
        "months": months_data,
    }


# ============================================================================
# Service-Charge Invoice Helper (Sep 2026) — shared entry-point used by
# `redemption_service_charge` when a 20% cash service charge is marked
# PAID via Razorpay. Also used by the backfill admin endpoint for
# retroactive invoices on already-paid historical charges.
# ============================================================================


async def _is_razorpay_payment_captured(payment_id: str) -> bool:
    """Fetch payment from Razorpay and return True only if captured.

    Returns False on any error / non-captured status so we FAIL SAFE —
    a missed invoice is recoverable by the backfill endpoint; a wrongly
    issued GST bill is a compliance headache.
    """
    if not payment_id:
        return False
    # A Razorpay client is initialised inside razorpay_payments.py. Reuse
    # it to avoid re-creating on every call.
    try:
        from routes.razorpay_payments import razorpay_client
    except Exception:
        razorpay_client = None
    if not razorpay_client:
        logging.warning("[SVC-CHG INVOICE] Razorpay client unavailable — skipping capture check")
        return False
    try:
        p = razorpay_client.payment.fetch(payment_id)
    except Exception as e:
        logging.warning(f"[SVC-CHG INVOICE] Razorpay fetch({payment_id}) failed: {e}")
        return False
    status = (p or {}).get("status", "").lower()
    captured = bool((p or {}).get("captured"))
    ok = (status == "captured") and captured
    if not ok:
        logging.info(
            f"[SVC-CHG INVOICE] Payment {payment_id} not captured "
            f"(status={status}, captured={captured})"
        )
    return ok


async def create_service_charge_invoice(
    charge: dict,
    payment_id: str,
) -> Optional[dict]:
    """Generate a GST invoice for a paid redemption-service-charge.

    Idempotent — if an invoice already exists for the given `payment_id`
    OR the given `charge_id` we return the existing row without touching
    the DB. Safe to call from webhooks, reconcile sweeps, and backfill.

    Only creates the invoice when Razorpay reports the payment as truly
    `captured` (i.e. money has settled into our account). Pending /
    authorized-only / failed / refunded payments are skipped so we never
    emit a GST bill for money we do not have.

    Returns the invoice doc (without pdf_base64) or None on failure.
    """
    if db is None or not charge or not payment_id:
        return None

    charge_id = charge.get("charge_id")
    user_id = charge.get("user_id")
    total_payable = float(charge.get("total_payable") or 0)
    if not user_id or total_payable <= 0:
        return None

    # Idempotency: one invoice per payment OR per charge
    existing = await db.invoices.find_one(
        {"$or": [{"payment_id": payment_id}, {"service_charge_id": charge_id}]},
        {"_id": 0, "pdf_base64": 0},
    )
    if existing:
        return existing

    # ─── Razorpay captured-only gate (Sep 17 2026) ─────────────────────
    # Refuse to bill a customer if the payment is not captured. This is a
    # compliance requirement — no GST invoice for pending/failed money.
    if not await _is_razorpay_payment_captured(payment_id):
        logging.info(
            f"[SVC-CHG INVOICE] SKIP {charge_id} — payment {payment_id} "
            "not captured on Razorpay yet"
        )
        return None

    # Customer + state lookup (same logic as VIP invoice)
    user = await db.users.find_one({"uid": user_id}) or {}
    customer_state = (user.get("state") or "").strip()
    if not customer_state:
        try:
            kyc = await db.kyc_submissions.find_one(
                {"user_id": user_id},
                {"_id": 0, "state": 1, "address_state": 1},
            )
            if kyc:
                customer_state = (kyc.get("state") or kyc.get("address_state") or "").strip()
        except Exception:
            pass
    if not customer_state:
        customer_state = "Unknown"

    invoice_number = await get_next_invoice_number()
    invoice_id = (
        f"INV_SVC_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_"
        f"{user_id[:8]}"
    )
    gst_breakdown = calculate_gst(total_payable)

    # Descriptive plan_name so the PDF and admin list read cleanly.
    r_type = (charge.get("redemption_type") or "generic").replace("_", " ").title()
    plan_name = f"Redemption Service Charge — {r_type}"

    invoice_data = {
        "invoice_id": invoice_id,
        "invoice_number": invoice_number,
        "user_id": user_id,
        "customer_name": user.get("name", "Customer"),
        "customer_email": user.get("email", ""),
        "customer_phone": user.get("phone", "") or user.get("mobile", ""),
        "customer_state": customer_state,
        "payment_id": payment_id,
        "plan_name": plan_name,
        "plan_type": "service_charge",
        "invoice_type": "redemption_service_charge",
        # Cross-reference back to the service charge and its parent redemption
        "service_charge_id": charge_id,
        "redemption_id": charge.get("redemption_id"),
        "redemption_type": charge.get("redemption_type"),
        "prc_amount": charge.get("prc_amount"),
        "amount": total_payable,
        "gst_breakdown": gst_breakdown,
        "date": datetime.now(timezone.utc).strftime("%d-%m-%Y"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "company": {
            "name": COMPANY_NAME,
            "gstin": COMPANY_GSTIN,
            "address": COMPANY_ADDRESS,
        },
    }

    # Generate PDF (best-effort — a failure still stores the row so the
    # admin download endpoint can regenerate on demand)
    try:
        pdf_bytes = generate_invoice_pdf(invoice_data)
        invoice_data["pdf_base64"] = base64.b64encode(pdf_bytes).decode("utf-8")
    except Exception as e:
        logging.error(f"[SVC-CHG INVOICE] PDF gen failed for {charge_id}: {e}")

    try:
        await db.invoices.insert_one(invoice_data)
    except Exception as e:
        # Duplicate on unique index (payment_id) — race with concurrent
        # webhook. Return the winner.
        existing = await db.invoices.find_one(
            {"payment_id": payment_id}, {"_id": 0, "pdf_base64": 0}
        )
        if existing:
            return existing
        logging.error(f"[SVC-CHG INVOICE] insert failed {charge_id}: {e}")
        return None

    logging.info(
        f"[SVC-CHG INVOICE] {invoice_number} generated for charge {charge_id} "
        f"(₹{total_payable}, user {user_id[:8]})"
    )
    # Return without pdf_base64 for lightweight logging
    out = dict(invoice_data)
    out.pop("pdf_base64", None)
    return out


@router.post("/admin/backfill-service-charges")
async def admin_backfill_service_charge_invoices(request: Request):
    """One-shot admin backfill — generate GST invoices for every PAID
    `redemption_service_charges` row that does not yet have an invoice.

    Body: {"admin_pin": "969696", "dry_run": true|false, "limit": 500}
    """
    if db is None:
        raise HTTPException(status_code=500, detail="DB not configured")
    try:
        data = await request.json()
    except Exception:
        data = {}
    if data.get("admin_pin") != "969696":
        raise HTTPException(status_code=403, detail="Admin PIN required")

    dry_run = bool(data.get("dry_run", True))
    limit = int(data.get("limit", 500))

    cursor = db.redemption_service_charges.find(
        {"status": "PAID", "payment_id": {"$ne": None}},
        {"_id": 0},
    ).sort("paid_at", 1).limit(limit)

    stats = {"scanned": 0, "already_invoiced": 0, "created": 0, "errors": 0, "sample": []}
    async for charge in cursor:
        stats["scanned"] += 1
        pid = charge.get("payment_id")
        cid = charge.get("charge_id")
        exists = await db.invoices.find_one(
            {"$or": [{"payment_id": pid}, {"service_charge_id": cid}]},
            {"_id": 1},
        )
        if exists:
            stats["already_invoiced"] += 1
            continue
        if dry_run:
            if len(stats["sample"]) < 10:
                stats["sample"].append({
                    "charge_id": cid,
                    "user_id": charge.get("user_id"),
                    "payment_id": pid,
                    "total_payable": charge.get("total_payable"),
                    "paid_at": charge.get("paid_at"),
                })
            stats["created"] += 1  # will-create count in dry-run
            continue
        try:
            inv = await create_service_charge_invoice(charge, pid)
            if inv:
                stats["created"] += 1
            else:
                stats["errors"] += 1
        except Exception as e:
            logging.error(f"[BACKFILL SVC-INV] {cid}: {e}")
            stats["errors"] += 1

    return {
        "success": True,
        "dry_run": dry_run,
        "stats": stats,
        "message": (
            f"DRY-RUN: would create {stats['created']} invoices "
            f"(already-invoiced: {stats['already_invoiced']})"
            if dry_run else
            f"Created {stats['created']} invoices "
            f"(skipped {stats['already_invoiced']} already-invoiced, {stats['errors']} errors)"
        ),
    }


@router.post("/admin/regenerate-pdfs")
async def admin_regenerate_invoice_pdfs(request: Request):
    """Re-render every invoice's PDF with the CURRENT generator (font,
    address, columns, email, website) and refresh `pdf_base64` in
    `db.invoices`. Safe to re-run — pure PDF regeneration, no DB
    schema changes; already-fresh PDFs are overwritten harmlessly.

    Body: {
      "admin_pin": "969696",   # required
      "dry_run":    true,      # default true — count only
      "limit":      500,       # per-call batch cap so client doesn't time out
      "offset":     0,         # skip N already-processed rows
      "invoice_type": "all"    # "all" | "service_charge" | "vip"
    }
    """
    if db is None:
        raise HTTPException(status_code=500, detail="DB not configured")
    try:
        data = await request.json()
    except Exception:
        data = {}
    if data.get("admin_pin") != "969696":
        raise HTTPException(status_code=403, detail="Admin PIN required")

    dry_run = bool(data.get("dry_run", True))
    limit = int(data.get("limit", 500))
    offset = int(data.get("offset", 0))
    inv_type = (data.get("invoice_type") or "all").lower()

    query: dict = {}
    if inv_type == "service_charge":
        query["invoice_type"] = "redemption_service_charge"
    elif inv_type == "vip":
        query["$or"] = [
            {"invoice_type": {"$exists": False}},
            {"invoice_type": {"$ne": "redemption_service_charge"}},
        ]

    total = await db.invoices.count_documents(query)
    cursor = db.invoices.find(query).sort("created_at", 1).skip(offset).limit(limit)

    stats = {
        "total_matching": total,
        "processed": 0,
        "regenerated": 0,
        "errors": 0,
        "skipped_missing_data": 0,
        "next_offset": offset + limit,
    }

    async for inv in cursor:
        stats["processed"] += 1
        # Required fields to rebuild PDF
        if not inv.get("gst_breakdown") or not inv.get("invoice_number"):
            stats["skipped_missing_data"] += 1
            continue

        if dry_run:
            stats["regenerated"] += 1
            continue

        try:
            # Ensure plan_name/plan_type present (older rows may miss them)
            payload = dict(inv)
            payload.pop("_id", None)
            payload.pop("pdf_base64", None)
            payload.setdefault("plan_name", "Subscription")
            payload.setdefault("plan_type", "Service")
            payload.setdefault("date", (payload.get("created_at") or "")[:10])

            pdf_bytes = generate_invoice_pdf(payload)
            new_b64 = base64.b64encode(pdf_bytes).decode("utf-8")
            await db.invoices.update_one(
                {"invoice_id": inv["invoice_id"]},
                {"$set": {
                    "pdf_base64": new_b64,
                    "pdf_regenerated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            stats["regenerated"] += 1
        except Exception as e:
            logging.error(f"[INVOICE regen] {inv.get('invoice_id')}: {e}")
            stats["errors"] += 1

    stats["has_more"] = stats["next_offset"] < total
    return {
        "success": True,
        "dry_run": dry_run,
        "stats": stats,
        "message": (
            f"DRY-RUN: {stats['regenerated']} would be regenerated "
            f"(offset {offset}, total {total})"
            if dry_run else
            f"Regenerated {stats['regenerated']} PDFs "
            f"(offset {offset}, errors {stats['errors']}, has_more={stats['has_more']})"
        ),
    }

@router.post("/admin/audit-invoices-captured")
async def admin_audit_invoices_captured(request: Request):
    """Audit every existing invoice — call Razorpay to verify the linked
    payment is actually `captured`. Optionally DELETE invoices for
    payments that are pending/authorized/failed/refunded so we never
    hold a GST bill for money we do not have.

    Body: {
      "admin_pin": "969696",   # required
      "dry_run":    true,      # default true — audit only, no deletes
      "limit":      500,       # batch cap
      "offset":     0
    }
    """
    if db is None:
        raise HTTPException(status_code=500, detail="DB not configured")
    try:
        data = await request.json()
    except Exception:
        data = {}
    if data.get("admin_pin") != "969696":
        raise HTTPException(status_code=403, detail="Admin PIN required")

    dry_run = bool(data.get("dry_run", True))
    limit = int(data.get("limit", 500))
    offset = int(data.get("offset", 0))

    total = await db.invoices.count_documents({"payment_id": {"$exists": True}})
    cursor = db.invoices.find(
        {"payment_id": {"$exists": True}},
        {"_id": 0, "invoice_id": 1, "invoice_number": 1, "payment_id": 1,
         "user_id": 1, "amount": 1, "invoice_type": 1},
    ).sort("created_at", 1).skip(offset).limit(limit)

    stats = {
        "total": total,
        "scanned": 0,
        "captured": 0,
        "not_captured": 0,
        "razorpay_unreachable": 0,
        "deleted": 0,
        "sample_not_captured": [],
        "next_offset": offset + limit,
    }

    try:
        from routes.razorpay_payments import razorpay_client
    except Exception:
        razorpay_client = None
    if not razorpay_client:
        raise HTTPException(status_code=503, detail="Razorpay client unavailable")

    async for inv in cursor:
        stats["scanned"] += 1
        pid = inv.get("payment_id")
        if not pid:
            continue
        try:
            p = razorpay_client.payment.fetch(pid)
            status = (p or {}).get("status", "").lower()
            captured = bool((p or {}).get("captured"))
            if status == "captured" and captured:
                stats["captured"] += 1
                continue
            # Not captured — record + optionally delete
            stats["not_captured"] += 1
            if len(stats["sample_not_captured"]) < 15:
                stats["sample_not_captured"].append({
                    "invoice_number": inv.get("invoice_number"),
                    "payment_id": pid,
                    "razorpay_status": status,
                    "captured_flag": captured,
                    "amount": inv.get("amount"),
                    "invoice_type": inv.get("invoice_type", "vip"),
                })
            if not dry_run:
                await db.invoices.delete_one({"invoice_id": inv["invoice_id"]})
                stats["deleted"] += 1
        except Exception as e:
            logging.warning(f"[INVOICE audit] {pid}: {e}")
            stats["razorpay_unreachable"] += 1

    stats["has_more"] = stats["next_offset"] < total
    return {
        "success": True,
        "dry_run": dry_run,
        "stats": stats,
        "message": (
            f"DRY-RUN: {stats['not_captured']} non-captured invoices found "
            f"(offset {offset}, would delete)"
            if dry_run else
            f"Deleted {stats['deleted']} non-captured invoices "
            f"(offset {offset}, unreachable {stats['razorpay_unreachable']}, has_more={stats['has_more']})"
        ),
    }

