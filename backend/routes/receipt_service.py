"""
Receipt Generation Service
Generates PDF receipts for BBPS and DMT transactions
"""

import os
import io
import base64
import logging
from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

router = APIRouter(prefix="/receipt", tags=["Receipt"])

# ==================== MODELS ====================

class BBPSReceiptRequest(BaseModel):
    """Request model for BBPS receipt generation"""
    tid: str
    operator_name: str
    amount: str
    account: str
    mobile: str
    status: str
    timestamp: Optional[str] = None
    customer_name: Optional[str] = None
    bbps_ref: Optional[str] = None
    bank_ref: Optional[str] = None
    fee: Optional[str] = "0"
    service_type: Optional[str] = "Bill Payment"


class DMTReceiptRequest(BaseModel):
    """Request model for DMT receipt generation"""
    tid: str
    amount: str
    sender_mobile: str
    sender_name: Optional[str] = "Customer"
    recipient_name: str
    recipient_account: str
    recipient_bank: str
    recipient_ifsc: str
    status: str
    timestamp: Optional[str] = None
    bank_ref: Optional[str] = None
    fee: Optional[str] = "0"
    channel: Optional[str] = "IMPS"


# ==================== RECEIPT GENERATION ====================

def generate_receipt_pdf(receipt_data: Dict[str, Any], receipt_type: str = "BBPS") -> bytes:
    """
    Generate PDF receipt for transactions
    
    Args:
        receipt_data: Dictionary containing transaction details
        receipt_type: "BBPS" or "DMT"
    
    Returns:
        PDF bytes
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=30,
        leftMargin=30,
        topMargin=30,
        bottomMargin=30
    )
    
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=18,
        alignment=TA_CENTER,
        spaceAfter=20,
        textColor=colors.HexColor('#1a365d')
    )
    
    header_style = ParagraphStyle(
        'Header',
        parent=styles['Normal'],
        fontSize=12,
        alignment=TA_CENTER,
        spaceAfter=10,
        textColor=colors.HexColor('#4a5568')
    )
    
    # Header
    elements.append(Paragraph("PARAS REWARD", title_style))
    elements.append(Paragraph(f"{'BBPS Bill Payment' if receipt_type == 'BBPS' else 'Money Transfer'} Receipt", header_style))
    elements.append(Spacer(1, 20))
    
    # Transaction ID and Status
    status = receipt_data.get('status', 'SUCCESS')
    status_color = colors.green if status.upper() == 'SUCCESS' else colors.red
    
    status_table = Table([
        [Paragraph(f"<b>Transaction ID:</b> {receipt_data.get('tid', 'N/A')}", styles['Normal']),
         Paragraph(f"<b>Status:</b> <font color='{status_color}'>{status.upper()}</font>", styles['Normal'])]
    ], colWidths=[250, 250])
    status_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    elements.append(status_table)
    elements.append(Spacer(1, 15))
    
    # Transaction Details Table
    if receipt_type == "BBPS":
        details = [
            ['Service Type', receipt_data.get('service_type', 'Bill Payment')],
            ['Operator', receipt_data.get('operator_name', 'N/A')],
            ['Account/Consumer No', receipt_data.get('account', 'N/A')],
            ['Mobile Number', receipt_data.get('mobile', 'N/A')],
            ['Customer Name', receipt_data.get('customer_name', 'N/A')],
            ['Amount', f"₹ {receipt_data.get('amount', '0')}"],
            ['Convenience Fee', f"₹ {receipt_data.get('fee', '0')}"],
            ['BBPS Reference', receipt_data.get('bbps_ref', 'N/A')],
            ['Bank Reference', receipt_data.get('bank_ref', 'N/A')],
            ['Date & Time', receipt_data.get('timestamp', datetime.now().strftime('%d-%m-%Y %H:%M:%S'))],
        ]
    else:  # DMT
        details = [
            ['Transfer Mode', receipt_data.get('channel', 'IMPS')],
            ['Sender Name', receipt_data.get('sender_name', 'N/A')],
            ['Sender Mobile', receipt_data.get('sender_mobile', 'N/A')],
            ['Beneficiary Name', receipt_data.get('recipient_name', 'N/A')],
            ['Bank Name', receipt_data.get('recipient_bank', 'N/A')],
            ['Account Number', receipt_data.get('recipient_account', 'N/A')],
            ['IFSC Code', receipt_data.get('recipient_ifsc', 'N/A')],
            ['Amount', f"₹ {receipt_data.get('amount', '0')}"],
            ['Transaction Fee', f"₹ {receipt_data.get('fee', '0')}"],
            ['Bank Reference', receipt_data.get('bank_ref', 'N/A')],
            ['Date & Time', receipt_data.get('timestamp', datetime.now().strftime('%d-%m-%Y %H:%M:%S'))],
        ]
    
    # Create details table
    detail_table = Table(details, colWidths=[180, 320])
    detail_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f7fafc')),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#2d3748')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(detail_table)
    elements.append(Spacer(1, 30))
    
    # Footer
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=9,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#718096')
    )
    
    elements.append(Paragraph("This is a computer generated receipt and does not require signature.", footer_style))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph("For any queries, please contact customer support.", footer_style))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(f"Generated on: {datetime.now().strftime('%d-%m-%Y %H:%M:%S')}", footer_style))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


# ==================== API ENDPOINTS ====================

@router.post("/bbps")
async def generate_bbps_receipt(request: BBPSReceiptRequest):
    """
    Generate PDF receipt for BBPS transaction
    
    Returns base64 encoded PDF
    """
    try:
        receipt_data = {
            "tid": request.tid,
            "operator_name": request.operator_name,
            "amount": request.amount,
            "account": request.account,
            "mobile": request.mobile,
            "status": request.status,
            "timestamp": request.timestamp or datetime.now().strftime('%d-%m-%Y %H:%M:%S'),
            "customer_name": request.customer_name or "Customer",
            "bbps_ref": request.bbps_ref or request.tid,
            "bank_ref": request.bank_ref or "N/A",
            "fee": request.fee or "0",
            "service_type": request.service_type or "Bill Payment"
        }
        
        pdf_bytes = generate_receipt_pdf(receipt_data, "BBPS")
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        return {
            "success": True,
            "receipt_pdf": pdf_base64,
            "filename": f"BBPS_Receipt_{request.tid}.pdf",
            "message": "Receipt generated successfully"
        }
        
    except Exception as e:
        logging.error(f"[RECEIPT] BBPS receipt error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate receipt: {str(e)}")


@router.post("/dmt")
async def generate_dmt_receipt(request: DMTReceiptRequest):
    """
    Generate PDF receipt for DMT transaction
    
    Returns base64 encoded PDF
    """
    try:
        receipt_data = {
            "tid": request.tid,
            "amount": request.amount,
            "sender_mobile": request.sender_mobile,
            "sender_name": request.sender_name or "Customer",
            "recipient_name": request.recipient_name,
            "recipient_account": request.recipient_account,
            "recipient_bank": request.recipient_bank,
            "recipient_ifsc": request.recipient_ifsc,
            "status": request.status,
            "timestamp": request.timestamp or datetime.now().strftime('%d-%m-%Y %H:%M:%S'),
            "bank_ref": request.bank_ref or "N/A",
            "fee": request.fee or "0",
            "channel": request.channel or "IMPS"
        }
        
        pdf_bytes = generate_receipt_pdf(receipt_data, "DMT")
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        return {
            "success": True,
            "receipt_pdf": pdf_base64,
            "filename": f"DMT_Receipt_{request.tid}.pdf",
            "message": "Receipt generated successfully"
        }
        
    except Exception as e:
        logging.error(f"[RECEIPT] DMT receipt error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate receipt: {str(e)}")
