"""
GST Invoice System for Paras Reward
- Generate GST-compliant invoices
- PDF generation with reportlab
- Sequential invoice numbering
- Database storage
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import os
import logging
from io import BytesIO
import base64

# PDF generation
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

router = APIRouter(prefix="/invoice", tags=["GST Invoice"])

# Company Details
COMPANY_NAME = "PARAS REWARD TECHNOLOGIES PRIVATE LIMITED"
COMPANY_GSTIN = "27AAQCP6686E1ZR"
COMPANY_ADDRESS = "Maharashtra, India"
COMPANY_EMAIL = "support@parasreward.com"
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
        rightMargin=20*mm,
        leftMargin=20*mm,
        topMargin=20*mm,
        bottomMargin=20*mm
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=18,
        alignment=TA_CENTER,
        spaceAfter=10
    )
    
    header_style = ParagraphStyle(
        'Header',
        parent=styles['Normal'],
        fontSize=10,
        alignment=TA_CENTER
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10
    )
    
    bold_style = ParagraphStyle(
        'Bold',
        parent=styles['Normal'],
        fontSize=10,
        fontName='Helvetica-Bold'
    )
    
    elements = []
    
    # Company Header
    elements.append(Paragraph(COMPANY_NAME, title_style))
    elements.append(Paragraph(f"GSTIN: {COMPANY_GSTIN}", header_style))
    elements.append(Paragraph(COMPANY_ADDRESS, header_style))
    elements.append(Spacer(1, 20))
    
    # TAX INVOICE Title
    elements.append(Paragraph("<b>TAX INVOICE</b>", ParagraphStyle(
        'InvoiceTitle',
        parent=styles['Heading2'],
        fontSize=14,
        alignment=TA_CENTER,
        textColor=colors.darkblue
    )))
    elements.append(Spacer(1, 15))
    
    # Invoice Details Table
    invoice_info = [
        ["Invoice Number:", invoice_data["invoice_number"], "Date:", invoice_data["date"]],
        ["Payment ID:", invoice_data["payment_id"], "", ""]
    ]
    
    info_table = Table(invoice_info, colWidths=[80, 150, 50, 100])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 15))
    
    # Customer Details
    elements.append(Paragraph("<b>Bill To:</b>", bold_style))
    elements.append(Paragraph(f"Name: {invoice_data['customer_name']}", normal_style))
    elements.append(Paragraph(f"Email: {invoice_data['customer_email']}", normal_style))
    if invoice_data.get('customer_phone'):
        elements.append(Paragraph(f"Phone: {invoice_data['customer_phone']}", normal_style))
    elements.append(Spacer(1, 20))
    
    # Service Details Table
    gst = invoice_data["gst_breakdown"]
    
    service_data = [
        ["Description", "SAC Code", "Amount (₹)"],
        [f"Digital Platform Subscription - {invoice_data['plan_name'].title()} Plan ({invoice_data['plan_type'].title()})", "998314", f"₹{gst['base_amount']:,.2f}"],
        ["", "", ""],
        ["Subtotal", "", f"₹{gst['base_amount']:,.2f}"],
        [f"CGST @ {gst['cgst_rate']}%", "", f"₹{gst['cgst']:,.2f}"],
        [f"SGST @ {gst['sgst_rate']}%", "", f"₹{gst['sgst']:,.2f}"],
        ["", "", ""],
        ["Total Amount", "", f"₹{gst['total_amount']:,.2f}"]
    ]
    
    service_table = Table(service_data, colWidths=[280, 80, 100])
    service_table.setStyle(TableStyle([
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.2, 0.3, 0.5)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        
        # Body
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        
        # Total row
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
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
    elements.append(Spacer(1, 30))
    
    # Amount in Words
    amount_words = number_to_words(int(gst['total_amount']))
    elements.append(Paragraph(f"<b>Amount in Words:</b> {amount_words} Only", normal_style))
    elements.append(Spacer(1, 20))
    
    # Terms
    terms_style = ParagraphStyle(
        'Terms',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.grey
    )
    elements.append(Paragraph("<b>Terms & Conditions:</b>", terms_style))
    elements.append(Paragraph("1. This is a computer-generated invoice and does not require a signature.", terms_style))
    elements.append(Paragraph("2. Payment once made is non-refundable.", terms_style))
    elements.append(Paragraph("3. This invoice is for digital platform access services only.", terms_style))
    elements.append(Spacer(1, 20))
    
    # Footer
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=9,
        alignment=TA_CENTER,
        textColor=colors.darkblue
    )
    elements.append(Paragraph("Thank you for your subscription!", footer_style))
    elements.append(Paragraph(f"Contact: {COMPANY_EMAIL} | {COMPANY_PHONE}", footer_style))
    
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
    
    # Prepare invoice data
    invoice_data = {
        "invoice_id": invoice_id,
        "invoice_number": invoice_number,
        "user_id": request.user_id,
        "customer_name": user.get("name", "Customer"),
        "customer_email": user.get("email", ""),
        "customer_phone": user.get("phone", ""),
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
    year: Optional[int] = None
):
    """Admin: Get all invoices for GST reporting"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    query = {}
    
    # Filter by month/year if provided
    if month and year:
        start_date = f"{year}-{month:02d}-01"
        if month == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{month + 1:02d}-01"
        query["created_at"] = {"$gte": start_date, "$lt": end_date}
    elif year:
        query["created_at"] = {"$gte": f"{year}-01-01", "$lt": f"{year + 1}-01-01"}
    
    skip = (page - 1) * limit
    
    invoices = await db.invoices.find(
        query,
        {"_id": 0, "pdf_base64": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.invoices.count_documents(query)
    
    # Calculate totals for GST reporting
    if invoices:
        total_base = sum(inv.get("gst_breakdown", {}).get("base_amount", 0) for inv in invoices)
        total_gst = sum(inv.get("gst_breakdown", {}).get("gst_amount", 0) for inv in invoices)
        total_amount = sum(inv.get("amount", 0) for inv in invoices)
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
