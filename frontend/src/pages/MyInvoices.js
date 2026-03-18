import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, FileText, Download, Calendar, CreditCard, 
  Building2, Receipt, ChevronRight, Loader2, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MyInvoices = ({ user }) => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    if (user?.uid) {
      fetchInvoices();
    }
  }, [user?.uid]);

  const fetchInvoices = async () => {
    try {
      const response = await axios.get(`${API}/invoice/user/${user.uid}`);
      if (response.data.success) {
        setInvoices(response.data.invoices || []);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const downloadInvoice = async (invoiceId, invoiceNumber) => {
    setDownloadingId(invoiceId);
    try {
      const response = await axios.get(`${API}/invoice/${invoiceId}/pdf`);
      
      if (response.data.success && response.data.pdf_base64) {
        // Convert base64 to blob
        const byteCharacters = atob(response.data.pdf_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${invoiceNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success('Invoice downloaded successfully');
      } else {
        toast.error('Invoice PDF not available');
      }
    } catch (error) {
      console.error('Error downloading invoice:', error);
      toast.error('Failed to download invoice');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950" data-testid="my-invoices-page">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 backdrop-blur-lg border-b border-white/10">
        <div className="flex items-center justify-between p-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
            data-testid="invoices-back-btn"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-white font-bold text-lg" data-testid="invoices-page-title">My Invoices</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4">
        {/* Info Banner */}
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Receipt className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">GST Tax Invoices</h3>
              <p className="text-gray-400 text-xs mt-1">
                Download GST-compliant invoices for all your subscription payments.
                GSTIN: 27AAQCP6686E1ZR
              </p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12" data-testid="invoices-loading">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-4" />
            <p className="text-gray-400 text-sm">Loading invoices...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && invoices.length === 0 && (
          <div className="text-center py-12" data-testid="invoices-empty-state">
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-white font-semibold mb-2">No Invoices Yet</h3>
            <p className="text-gray-400 text-sm">
              Invoices will appear here after you make subscription payments.
            </p>
            <button
              onClick={() => navigate('/subscription')}
              className="mt-4 px-6 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium"
              data-testid="view-plans-btn"
            >
              View Plans
            </button>
          </div>
        )}

        {/* Invoice List */}
        {!loading && invoices.length > 0 && (
          <div className="space-y-3" data-testid="invoices-list">
            {invoices.map((invoice, index) => (
              <div
                key={invoice.invoice_id}
                className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden"
                data-testid={`invoice-card-${index}`}
              >
                {/* Invoice Header */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm" data-testid={`invoice-number-${index}`}>{invoice.invoice_number}</p>
                        <p className="text-gray-500 text-xs" data-testid={`invoice-date-${index}`}>{formatDate(invoice.created_at)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold" data-testid={`invoice-amount-${index}`}>{formatAmount(invoice.amount)}</p>
                      <p className="text-green-400 text-xs" data-testid={`invoice-status-${index}`}>Paid</p>
                    </div>
                  </div>

                  {/* Invoice Details */}
                  <div className="bg-gray-800/50 rounded-lg p-3 space-y-2" data-testid={`invoice-details-${index}`}>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Plan</span>
                      <span className="text-white capitalize" data-testid={`invoice-plan-${index}`}>{invoice.plan_name} ({invoice.plan_type})</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Base Amount</span>
                      <span className="text-white" data-testid={`invoice-base-amount-${index}`}>{formatAmount(invoice.gst_breakdown?.base_amount)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">GST (18%)</span>
                      <span className="text-white" data-testid={`invoice-gst-amount-${index}`}>{formatAmount(invoice.gst_breakdown?.gst_amount)}</span>
                    </div>
                    <div className="flex justify-between text-xs pt-2 border-t border-gray-700">
                      <span className="text-gray-400">Payment ID</span>
                      <span className="text-gray-300 font-mono text-[10px]" data-testid={`invoice-payment-id-${index}`}>{invoice.payment_id?.slice(0, 20)}...</span>
                    </div>
                  </div>
                </div>

                {/* Download Button */}
                <button
                  onClick={() => downloadInvoice(invoice.invoice_id, invoice.invoice_number)}
                  disabled={downloadingId === invoice.invoice_id}
                  className="w-full py-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-t border-gray-800 flex items-center justify-center gap-2 text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                  data-testid={`download-invoice-btn-${index}`}
                >
                  {downloadingId === invoice.invoice_id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm font-medium">Downloading...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span className="text-sm font-medium">Download Invoice PDF</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Company Info Footer */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-xs">
            PARAS REWARD TECHNOLOGIES PRIVATE LIMITED
          </p>
          <p className="text-gray-600 text-[10px] mt-1">
            GSTIN: 27AAQCP6686E1ZR | Maharashtra, India
          </p>
        </div>
      </div>
    </div>
  );
};

export default MyInvoices;
