import { useRef } from 'react';
import { X, Printer, Download } from 'lucide-react';
import DOMPurify from 'dompurify';

const COMPANY = {
  name: 'PARAS REWARD',
  legal: 'PARAS REWARD TECHNOLOGIES PRIVATE LIMITED',
  gstin: '27AAQCP6686E1ZR',
  address: 'A-38, Bizz Tower, Chatrapati Sambhaji Nagar, Maharashtra 431006',
  state: 'Maharashtra',
  stateCode: '27',
  hsn: '998314',
};

const generateInvoiceNumber = (payment) => {
  const date = payment.created_at ? new Date(payment.created_at) : new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  // Generate a clean alphanumeric suffix from the order/payment id
  const rawId = payment.order_id || payment.payment_id || '';
  const cleaned = rawId.replace(/[^A-Za-z0-9]/g, '');
  const suffix = cleaned.length >= 6 ? cleaned.slice(-6).toUpperCase() : crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `PR-${y}${m}${d}-${suffix}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric', year: 'numeric' });
};

const InvoiceModal = ({ payment, user, onClose }) => {
  const printRef = useRef(null);

  if (!payment) return null;

  const invoiceNo = generateInvoiceNumber(payment);
  const rawPayId = payment.payment_id || payment.order_id || '-';
  // Clean up payment ID display
  const paymentId = rawPayId.startsWith('sub_')
    ? `PRC-${invoiceNo.split('-').pop()}`
    : rawPayId;
  const isPRC = payment.payment_method === 'prc';

  // Calculate amounts
  const breakdown = payment.pricing_breakdown || {};
  const baseAmount = breakdown.base_inr || payment.amount || 999;
  const gstRate = breakdown.gst_rate || 18;
  const halfGstRate = gstRate / 2; // 9% each for CGST and SGST
  const totalGst = breakdown.gst_inr || (baseAmount * gstRate / 100);
  const cgst = Math.round(totalGst / 2 * 100) / 100;
  const sgst = Math.round(totalGst / 2 * 100) / 100;
  const total = payment.inr_equivalent || (baseAmount + totalGst);
  const planLabel = `${(payment.plan_name || 'Elite').charAt(0).toUpperCase() + (payment.plan_name || 'elite').slice(1)} Subscription - ${(payment.plan_type || 'Monthly').charAt(0).toUpperCase() + (payment.plan_type || 'monthly').slice(1)}`;

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoiceNo}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; padding: 40px; background: #fff; }
          .invoice-container { max-width: 700px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 28px; border-bottom: 2px solid #10b981; padding-bottom: 16px; }
          .company-name { font-size: 26px; font-weight: 800; letter-spacing: 1px; color: #064e3b; }
          .company-legal { font-size: 11px; color: #6b7280; margin-top: 2px; }
          .company-address { font-size: 10px; color: #9ca3af; margin-top: 4px; }
          .company-gstin { font-size: 10px; color: #6b7280; margin-top: 3px; font-weight: 600; }
          .invoice-title { font-size: 14px; font-weight: 700; color: #374151; margin-bottom: 20px; }
          .meta-row { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .meta-block label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; display: block; }
          .meta-block span { font-size: 13px; font-weight: 600; color: #1f2937; }
          .bill-to { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin-bottom: 20px; }
          .bill-to label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
          .bill-to .name { font-size: 14px; font-weight: 700; color: #111827; margin-top: 4px; }
          .bill-to .detail { font-size: 11px; color: #6b7280; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          thead { background: #064e3b; color: #fff; }
          th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
          th:last-child { text-align: right; }
          td { padding: 12px; font-size: 12px; color: #374151; border-bottom: 1px solid #e5e7eb; }
          td:last-child { text-align: right; font-weight: 600; }
          .totals { margin-left: auto; width: 280px; }
          .totals .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #6b7280; }
          .totals .row.total { border-top: 2px solid #10b981; padding-top: 10px; margin-top: 6px; font-size: 16px; font-weight: 800; color: #064e3b; }
          .paid-badge { text-align: center; margin-top: 28px; }
          .paid-badge span { display: inline-block; padding: 10px 48px; border: 2px solid #10b981; border-radius: 8px; color: #10b981; font-size: 16px; font-weight: 800; letter-spacing: 2px; }
          .footer { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; }
          .prc-note { background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 12px; font-size: 10px; color: #92400e; margin-bottom: 16px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        ${DOMPurify.sanitize(content.innerHTML)}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-[440px] max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="invoice-modal"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <p className="text-zinc-800 font-bold text-sm">Invoice #{invoiceNo}</p>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center transition-colors" data-testid="invoice-print-btn">
              <Printer className="w-4 h-4 text-emerald-700" />
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors" data-testid="invoice-close-btn">
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
        </div>

        {/* Printable content */}
        <div ref={printRef} className="px-5 pb-5">
          <div className="invoice-container">
            {/* Header */}
            <div className="header" style={{ textAlign: 'center', marginBottom: 20, borderBottom: '2px solid #10b981', paddingBottom: 12 }}>
              <div className="company-name" style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1, color: '#064e3b' }}>{COMPANY.name}</div>
              <div className="company-legal" style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{COMPANY.legal}</div>
              <div className="company-address" style={{ fontSize: 9, color: '#9ca3af', marginTop: 3 }}>{COMPANY.address}</div>
              <div className="company-gstin" style={{ fontSize: 9, color: '#6b7280', marginTop: 3, fontWeight: 600 }}>GSTIN: {COMPANY.gstin} | State: {COMPANY.state} ({COMPANY.stateCode})</div>
            </div>

            {/* Invoice meta */}
            <div className="meta-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div className="meta-block">
                <label style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>Invoice Date</label>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1f2937' }}>{formatDate(payment.created_at)}</span>
              </div>
              <div className="meta-block" style={{ textAlign: 'right' }}>
                <label style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>Payment ID</label>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#1f2937', wordBreak: 'break-all' }}>{paymentId}</span>
              </div>
            </div>

            {/* Bill To */}
            <div className="bill-to" style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <label style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bill To</label>
              <div className="name" style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginTop: 3 }}>{user?.name || payment.user_name || '-'}</div>
              <div className="detail" style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{user?.email || payment.email || ''}</div>
              <div className="detail" style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>{user?.mobile || user?.phone || payment.mobile || ''}</div>
            </div>

            {/* PRC payment note */}
            {isPRC && (
              <div className="prc-note" style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 12px', fontSize: 10, color: '#92400e', marginBottom: 14 }}>
                Paid via PRC: {payment.prc_amount?.toFixed(2)} PRC @ rate {payment.prc_rate_used} PRC/INR
              </div>
            )}

            {/* Description table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
              <thead>
                <tr style={{ background: '#064e3b', color: '#fff' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>HSN</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '10px', fontSize: 11, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{planLabel}</td>
                  <td style={{ padding: '10px', fontSize: 11, color: '#374151', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>{COMPANY.hsn}</td>
                  <td style={{ padding: '10px', fontSize: 11, color: '#374151', borderBottom: '1px solid #e5e7eb', textAlign: 'right', fontWeight: 600 }}>&#8377;{baseAmount.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            {/* Totals */}
            <div className="totals" style={{ marginLeft: 'auto', width: 240 }}>
              <div className="row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11, color: '#6b7280' }}>
                <span>Subtotal</span>
                <span>&#8377;{baseAmount.toFixed(2)}</span>
              </div>
              <div className="row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11, color: '#6b7280' }}>
                <span>CGST ({halfGstRate}%)</span>
                <span>&#8377;{cgst.toFixed(2)}</span>
              </div>
              <div className="row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11, color: '#6b7280' }}>
                <span>SGST ({halfGstRate}%)</span>
                <span>&#8377;{sgst.toFixed(2)}</span>
              </div>
              <div className="row total" style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 6, borderTop: '2px solid #10b981', fontSize: 15, fontWeight: 800, color: '#064e3b' }}>
                <span>Total</span>
                <span>&#8377;{total.toFixed(2)}</span>
              </div>
            </div>

            {/* Paid badge */}
            <div className="paid-badge" style={{ textAlign: 'center', marginTop: 20 }}>
              <span style={{ display: 'inline-block', padding: '8px 40px', border: '2px solid #10b981', borderRadius: 8, color: '#10b981', fontSize: 15, fontWeight: 800, letterSpacing: 2 }}>
                &#10003; PAID
              </span>
            </div>

            {/* Footer */}
            <div className="footer" style={{ textAlign: 'center', marginTop: 24, paddingTop: 12, borderTop: '1px solid #e5e7eb', fontSize: 8, color: '#9ca3af' }}>
              <p>This is a computer-generated invoice and does not require a physical signature.</p>
              <p style={{ marginTop: 3 }}>{COMPANY.legal} | GSTIN: {COMPANY.gstin}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
