import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, CreditCard, CheckCircle, Clock, XCircle, 
  TrendingUp, Users, IndianRupee, RefreshCw, Search,
  Filter, Calendar, ChevronDown, AlertTriangle, Trash2,
  Download, FileText, RotateCcw, BarChart3, PieChart
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminRazorpaySubscriptions = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFraudModal, setShowFraudModal] = useState(false);
  const [fraudPreview, setFraudPreview] = useState(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [razorpayEnabled, setRazorpayEnabled] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);
  
  // Advanced filters
  const [sortBy, setSortBy] = useState('latest');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Date range filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Revenue dashboard state
  const [showRevenueDashboard, setShowRevenueDashboard] = useState(false);
  const [revenueData, setRevenueData] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  
  // Refund modal state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundOrder, setRefundOrder] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  
  // Invoice modal state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  
  // Manual activation state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualPaymentId, setManualPaymentId] = useState('');
  const [manualUserEmail, setManualUserEmail] = useState('');
  const [manualPlan, setManualPlan] = useState('elite');
  const [manualLoading, setManualLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchAmount, setSearchAmount] = useState('');
  const [searchDate, setSearchDate] = useState('');

  useEffect(() => {
    fetchRazorpayConfig();
  }, []);

  const fetchRazorpayConfig = async () => {
    try {
      const res = await axios.get(`${API}/razorpay/config`);
      setRazorpayEnabled(res.data.enabled !== false);
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const toggleRazorpay = async () => {
    try {
      setToggleLoading(true);
      const newState = !razorpayEnabled;
      await axios.post(`${API}/razorpay/toggle`, {
        enabled: newState,
        admin_pin: '123456'
      });
      setRazorpayEnabled(newState);
      toast.success(`Razorpay gateway ${newState ? 'ENABLED' : 'DISABLED'}`);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to toggle gateway');
    } finally {
      setToggleLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      let params = statusFilter !== 'all' ? `?status=${statusFilter}` : '?';
      if (searchQuery) {
        params += `${params.includes('?') && params.length > 1 ? '&' : ''}search=${encodeURIComponent(searchQuery)}`;
      }
      // Add date range filters
      if (dateFrom) {
        params += `${params.includes('?') && params.length > 1 ? '&' : ''}date_from=${dateFrom}`;
      }
      if (dateTo) {
        params += `${params.includes('?') && params.length > 1 ? '&' : ''}date_to=${dateTo}`;
      }
      
      // Use date-filtered endpoint if dates are set
      const endpoint = (dateFrom || dateTo) ? '/razorpay/admin/orders-by-date' : '/admin/razorpay-subscriptions';
      const res = await axios.get(`${API}${endpoint}${params}`);
      setOrders(res.data.orders || []);
      setStats(res.data.stats || {});
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch Revenue Dashboard Data
  const fetchRevenueDashboard = async () => {
    try {
      setRevenueLoading(true);
      const res = await axios.get(`${API}/razorpay/admin/revenue-dashboard`);
      setRevenueData(res.data);
      setShowRevenueDashboard(true);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load revenue data');
    } finally {
      setRevenueLoading(false);
    }
  };
  
  // Generate Invoice
  const generateInvoice = async (orderId) => {
    try {
      setInvoiceLoading(true);
      const res = await axios.get(`${API}/razorpay/admin/invoice/${orderId}`);
      setInvoiceData(res.data.invoice);
      setShowInvoiceModal(true);
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Failed to generate invoice');
    } finally {
      setInvoiceLoading(false);
    }
  };
  
  // Print Invoice
  const printInvoice = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${invoiceData?.invoice_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { color: #10b981; margin: 0; }
          .header p { color: #666; margin: 5px 0; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
          .info-box { background: #f8f9fa; padding: 15px; border-radius: 8px; }
          .info-box h3 { margin: 0 0 10px 0; color: #333; font-size: 14px; text-transform: uppercase; }
          .info-box p { margin: 5px 0; color: #555; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #f8f9fa; font-weight: 600; }
          .totals { text-align: right; }
          .totals p { margin: 8px 0; }
          .total-final { font-size: 20px; font-weight: bold; color: #10b981; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; }
          .paid-stamp { color: #10b981; font-size: 24px; font-weight: bold; text-align: center; padding: 20px; border: 3px solid #10b981; border-radius: 8px; margin: 20px 0; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PARAS REWARD</h1>
          <p>PARAS REWARD TECHNOLOGIES PRIVATE LIMITED</p>
          <p>Tax Invoice</p>
        </div>
        
        <div class="info-grid">
          <div class="info-box">
            <h3>Invoice Details</h3>
            <p><strong>Invoice No:</strong> ${invoiceData?.invoice_number}</p>
            <p><strong>Date:</strong> ${new Date(invoiceData?.invoice_date).toLocaleDateString('en-IN')}</p>
            <p><strong>Payment ID:</strong> ${invoiceData?.payment_id || 'N/A'}</p>
          </div>
          <div class="info-box">
            <h3>Bill To</h3>
            <p><strong>${invoiceData?.customer?.name}</strong></p>
            <p>${invoiceData?.customer?.email || ''}</p>
            <p>${invoiceData?.customer?.mobile || ''}</p>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>HSN/SAC</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${invoiceData?.items?.map(item => `
              <tr>
                <td>${item.description}</td>
                <td>${item.hsn_code}</td>
                <td>${item.quantity}</td>
                <td>₹${item.unit_price?.toFixed(2)}</td>
                <td>₹${item.amount?.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="totals">
          <p>Subtotal: ₹${invoiceData?.subtotal?.toFixed(2)}</p>
          <p>CGST (9%): ₹${invoiceData?.cgst?.toFixed(2)}</p>
          <p>SGST (9%): ₹${invoiceData?.sgst?.toFixed(2)}</p>
          <p class="total-final">Total: ₹${invoiceData?.total_amount?.toFixed(2)}</p>
        </div>
        
        <div class="paid-stamp">✓ PAID</div>
        
        <div class="footer">
          <p>Thank you for your business!</p>
          <p>This is a computer-generated invoice and does not require a signature.</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };
  
  // Open Refund Modal
  const openRefundModal = (order) => {
    setRefundOrder(order);
    setRefundAmount(order.amount?.toString() || '');
    setRefundReason('');
    setAdminPin('');
    setShowRefundModal(true);
  };
  
  // Process Refund
  const processRefund = async () => {
    if (!refundReason.trim()) {
      toast.error('Please enter refund reason');
      return;
    }
    if (!adminPin) {
      toast.error('Please enter admin PIN');
      return;
    }
    
    try {
      setRefundLoading(true);
      const res = await axios.post(`${API}/razorpay/admin/initiate-refund`, {
        order_id: refundOrder.order_id,
        reason: refundReason,
        amount: refundAmount ? parseFloat(refundAmount) : null,
        admin_pin: adminPin
      });
      
      toast.success(res.data.message);
      setShowRefundModal(false);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Refund failed');
    } finally {
      setRefundLoading(false);
    }
  };
  
  // Clear date filters
  const clearDateFilters = () => {
    setDateFrom('');
    setDateTo('');
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter, dateFrom, dateTo]);

  // Fraud cleanup functions
  const previewFraudCleanup = async () => {
    try {
      setCleanupLoading(true);
      const res = await axios.get(`${API}/admin/razorpay-fraud-preview`);
      setFraudPreview(res.data);
      setShowFraudModal(true);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load fraud preview');
    } finally {
      setCleanupLoading(false);
    }
  };

  const executeFraudCleanup = async () => {
    if (!window.confirm('Are you sure? This will reset all fraudulent subscriptions to FREE plan.')) {
      return;
    }
    
    try {
      setCleanupLoading(true);
      const res = await axios.post(`${API}/admin/razorpay-cleanup-fraudulent`, {
        admin_pin: '123456'
      });
      
      toast.success(`Cleanup complete! Reset ${res.data.reset_count} users, Skipped ${res.data.skipped_count} legitimate users`);
      setShowFraudModal(false);
      setFraudPreview(null);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Failed to cleanup');
    } finally {
      setCleanupLoading(false);
    }
  };

  const deletePendingOrders = async () => {
    if (!window.confirm('Are you sure you want to delete all PENDING orders?')) {
      return;
    }
    
    try {
      setCleanupLoading(true);
      const res = await axios.post(`${API}/admin/razorpay-delete-pending`, {
        admin_pin: '123456'
      });
      
      toast.success(`Deleted ${res.data.deleted_count} pending orders`);
      fetchData();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete');
    } finally {
      setCleanupLoading(false);
    }
  };

  const deleteAllOrders = async () => {
    if (!window.confirm('⚠️ WARNING: This will delete ALL orders (paid + pending). Are you absolutely sure?')) {
      return;
    }
    if (!window.confirm('This action is IRREVERSIBLE. Type OK to proceed.')) {
      return;
    }
    
    try {
      setCleanupLoading(true);
      const res = await axios.post(`${API}/admin/razorpay-delete-all`, {
        admin_pin: '123456',
        confirm: true
      });
      
      toast.success(`Deleted ALL ${res.data.deleted_count} orders`);
      fetchData();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete');
    } finally {
      setCleanupLoading(false);
    }
  };

  // SYNC payments from Razorpay API - BULK SYNC CAPTURED
  const syncPayments = async () => {
    try {
      setCleanupLoading(true);
      toast.loading('Syncing captured payments from Razorpay...', { id: 'sync' });
      
      const res = await axios.post(`${API}/admin/razorpay/bulk-sync-captured`, {});
      
      toast.dismiss('sync');
      
      if (res.data.newly_activated > 0) {
        toast.success(`✅ Activated ${res.data.newly_activated} subscriptions!`, { duration: 5000 });
      } else {
        toast.info(`No new payments to activate (${res.data.total_captured_in_razorpay} captured, ${res.data.already_active} already active)`);
      }
      
      if (res.data.orders_not_in_db > 0) {
        toast.warning(`${res.data.orders_not_in_db} payments have no order in DB - use Manual Activate`, { duration: 5000 });
      }
      
      fetchData();
    } catch (error) {
      toast.dismiss('sync');
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Sync failed - try again');
    } finally {
      setCleanupLoading(false);
    }
  };
  
  // Search payments in Razorpay
  const searchRazorpayPayments = async () => {
    try {
      setManualLoading(true);
      toast.loading('Searching Razorpay...', { id: 'search' });
      
      const res = await axios.post(`${API}/admin/razorpay/search-payment`, {
        amount: searchAmount || null,
        date: searchDate || null,
        payment_id: manualPaymentId || null
      });
      
      toast.dismiss('search');
      
      if (res.data.payments && res.data.payments.length > 0) {
        setSearchResults(res.data.payments);
        toast.success(`Found ${res.data.payments.length} payments`);
      } else if (res.data.found && res.data.payment) {
        setSearchResults([res.data.payment]);
        toast.success('Payment found!');
      } else {
        setSearchResults([]);
        toast.info('No payments found matching criteria');
      }
    } catch (error) {
      toast.dismiss('search');
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Search failed');
    } finally {
      setManualLoading(false);
    }
  };
  
  // Manual activate subscription
  const manualActivate = async (paymentId) => {
    if (!manualUserEmail) {
      toast.error('Please enter user email');
      return;
    }
    
    try {
      setManualLoading(true);
      toast.loading('Activating subscription...', { id: 'activate' });
      
      const res = await axios.post(`${API}/admin/razorpay/manual-activate`, {
        payment_id: paymentId,
        user_email: manualUserEmail,
        plan_name: manualPlan,
        plan_type: 'monthly',
        admin_pin: '123456'
      });
      
      toast.dismiss('activate');
      
      if (res.data.success) {
        toast.success(`✅ ${res.data.message}`, { duration: 5000 });
        setShowManualModal(false);
        setManualPaymentId('');
        setManualUserEmail('');
        setSearchResults([]);
        fetchData();
      } else {
        toast.error(res.data.message || 'Activation failed');
      }
    } catch (error) {
      toast.dismiss('activate');
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Activation failed');
    } finally {
      setManualLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    // Convert UTC to IST (Indian Standard Time)
    return new Date(dateStr).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
    }) + ' IST';
  };

  // Apply sorting
  const sortedOrders = [...orders].sort((a, b) => {
    const dateA = new Date(a.created_at || 0);
    const dateB = new Date(b.created_at || 0);
    
    switch (sortBy) {
      case 'latest':
        return dateB - dateA;
      case 'oldest':
        return dateA - dateB;
      case 'status':
        return (a.status || '').localeCompare(b.status || '');
      case 'amount_high':
        return (b.amount || 0) - (a.amount || 0);
      case 'amount_low':
        return (a.amount || 0) - (b.amount || 0);
      default:
        return dateB - dateA;
    }
  });

  // Apply search filter
  const filteredOrders = sortedOrders.filter(order => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.user_name?.toLowerCase().includes(query) ||
      order.user_email?.toLowerCase().includes(query) ||
      order.order_id?.toLowerCase().includes(query) ||
      order.payment_id?.toLowerCase().includes(query)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-slate-500">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-800">Razorpay Subscriptions</h1>
            <p className="text-xs text-slate-500">Live payment gateway transactions</p>
          </div>
        </div>
      </div>

      {/* Gateway Toggle */}
      <div className="px-5 mt-4">
        <div className={`p-4 rounded-2xl border flex items-center justify-between ${
          razorpayEnabled 
            ? 'bg-emerald-500/10 border-emerald-500/30' 
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-center gap-3">
            <CreditCard className={`w-6 h-6 ${razorpayEnabled ? 'text-emerald-400' : 'text-red-400'}`} />
            <div>
              <p className="font-medium text-slate-800">
                Online Payment Gateway
              </p>
              <p className={`text-xs ${razorpayEnabled ? 'text-emerald-400' : 'text-red-400'}`}>
                {razorpayEnabled ? '✅ ENABLED - Users can pay online' : '❌ DISABLED - Only manual payment available'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleRazorpay}
            disabled={toggleLoading}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
              razorpayEnabled
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
            }`}
          >
            {toggleLoading ? '...' : razorpayEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-5 mt-4 grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-center gap-2 mb-2">
            <IndianRupee className="w-5 h-5 text-emerald-400" />
            <span className="text-slate-500 text-sm">Total Revenue</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">₹{stats.total_revenue?.toLocaleString() || 0}</p>
        </div>
        
        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-blue-400" />
            <span className="text-slate-500 text-sm">Paid Orders</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{stats.paid_orders || 0}</p>
        </div>
        
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <span className="text-slate-500 text-sm">Pending</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">{stats.pending_orders || 0}</p>
        </div>
        
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-400" />
            <span className="text-slate-500 text-sm">Failed</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{stats.failed_orders || 0}</p>
        </div>
      </div>
      
      {/* Revenue Dashboard Button */}
      <div className="px-5 mt-4">
        <button
          onClick={fetchRevenueDashboard}
          disabled={revenueLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg"
        >
          <BarChart3 className={`w-5 h-5 ${revenueLoading ? 'animate-pulse' : ''}`} />
          <span>{revenueLoading ? 'Loading...' : '📊 Revenue Dashboard & Analytics'}</span>
        </button>
      </div>
      
      {/* Date Range Filters */}
      <div className="px-5 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="text-slate-600 text-sm font-medium">Filter by Date</span>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm"
            placeholder="From"
          />
          <span className="text-slate-500">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm"
            placeholder="To"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={clearDateFilters}
              className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* SYNC Button - Most Important */}
      {stats.pending_orders > 0 && (
        <div className="px-5 mt-4">
          <button
            onClick={syncPayments}
            disabled={cleanupLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-500 text-slate-800 font-semibold hover:bg-blue-600 transition-all"
          >
            <RefreshCw className={`w-5 h-5 ${cleanupLoading ? 'animate-spin' : ''}`} />
            <span>
              {cleanupLoading ? 'Syncing...' : `🔄 Sync Payments from Razorpay (${stats.pending_orders} pending)`}
            </span>
          </button>
          <p className="text-center text-xs text-slate-500 mt-2">
            This will check Razorpay API and auto-activate captured payments
          </p>
        </div>
      )}

      {/* Manual Payment Activation - For edge cases */}
      <div className="px-5 mt-4">
        <button
          onClick={() => setShowManualModal(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 font-semibold hover:bg-purple-500/30 transition-all"
        >
          <Search className="w-5 h-5" />
          <span>🔍 Manual Payment Search & Activate</span>
        </button>
        <p className="text-center text-xs text-slate-500 mt-2">
          For payments made outside app flow (direct UPI, etc.)
        </p>
      </div>

      {/* Manual Activation Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-xl font-bold text-slate-800 mb-4">🔍 Search & Activate Payment</h2>
            
            <div className="space-y-4">
              {/* Search by Payment ID */}
              <div>
                <label className="text-sm text-slate-500 mb-1 block">Payment ID (pay_xxx)</label>
                <input
                  type="text"
                  placeholder="pay_xxx"
                  value={manualPaymentId}
                  onChange={(e) => setManualPaymentId(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800"
                />
              </div>
              
              {/* Or search by Amount + Date */}
              <div className="text-center text-slate-500 text-sm">— OR —</div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-500 mb-1 block">Amount (₹)</label>
                  <input
                    type="number"
                    placeholder="799"
                    value={searchAmount}
                    onChange={(e) => setSearchAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-500 mb-1 block">Date</label>
                  <input
                    type="date"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>
              </div>
              
              <button
                onClick={searchRazorpayPayments}
                disabled={manualLoading}
                className="w-full py-3 bg-blue-500 text-slate-800 rounded-xl font-semibold hover:bg-blue-600 disabled:opacity-50"
              >
                {manualLoading ? 'Searching...' : '🔍 Search in Razorpay'}
              </button>
              
              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-500">Found Payments:</h3>
                  {searchResults.map((p) => (
                    <div key={p.id} className="p-4 bg-white rounded-xl border border-slate-200">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs text-slate-500">{p.id}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          p.status === 'captured' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {p.status}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-slate-800 mb-1">₹{p.amount}</p>
                      <p className="text-sm text-slate-500">{p.email || p.contact || 'No contact'}</p>
                      <p className="text-xs text-slate-500">{p.method} • {p.vpa || '-'}</p>
                      <p className="text-xs text-slate-500 mt-1">{p.created_at}</p>
                      
                      {p.status === 'captured' && (
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <label className="text-xs text-slate-500 mb-1 block">Activate for User (Email):</label>
                          <input
                            type="email"
                            placeholder="user@email.com"
                            value={manualUserEmail}
                            onChange={(e) => setManualUserEmail(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-800 text-sm mb-2"
                          />
                          <div className="flex gap-2 mb-2">
                            <select
                              value={manualPlan}
                              onChange={(e) => setManualPlan(e.target.value)}
                              className="flex-1 px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-800 text-sm"
                            >
                              <option value="startup">Startup</option>
                              <option value="elite">Elite</option>
                            </select>
                          </div>
                          <button
                            onClick={() => manualActivate(p.id)}
                            disabled={manualLoading || !manualUserEmail}
                            className="w-full py-2 bg-emerald-500 text-slate-800 rounded-lg font-semibold text-sm hover:bg-emerald-600 disabled:opacity-50"
                          >
                            ✅ Activate Subscription
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <button
              onClick={() => { setShowManualModal(false); setSearchResults([]); }}
              className="w-full mt-4 py-3 bg-white text-slate-500 rounded-xl"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}

      {/* Filters */}
      <div className="px-5 mt-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="Search: name, email, phone, UTR, UPI ID, order ID, amount..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-gray-500"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="flex gap-2 items-center">
          <span className="text-slate-500 text-sm">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm"
          >
            <option value="latest">Latest First</option>
            <option value="oldest">Oldest First</option>
            <option value="status">By Status</option>
            <option value="amount_high">Amount (High to Low)</option>
            <option value="amount_low">Amount (Low to High)</option>
          </select>
          <span className="text-slate-500 text-sm ml-auto">
            Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredOrders.length)} of {filteredOrders.length}
          </span>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'all', label: 'All', count: stats.total_orders },
            { id: 'paid', label: 'Paid', count: stats.paid_orders, color: 'emerald' },
            { id: 'created', label: 'Pending', count: stats.pending_orders, color: 'amber' },
            { id: 'failed', label: 'Failed', color: 'red' },
            { id: 'cancelled', label: 'Cancelled', color: 'gray' },
            { id: 'error', label: 'Error', color: 'orange' },
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => { setStatusFilter(filter.id); setCurrentPage(1); }}
              onClick={() => setStatusFilter(filter.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                statusFilter === filter.id
                  ? 'bg-amber-500 text-black'
                  : 'bg-white text-slate-500 hover:bg-slate-100'
              }`}
            >
              {filter.label} {filter.count !== undefined ? `(${filter.count})` : ''}
            </button>
          ))}
          
          <button
            onClick={fetchData}
            className="px-3 py-2 rounded-xl bg-white text-slate-500 hover:bg-slate-100"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="px-5 mt-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : paginatedOrders.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-slate-500">No orders found</p>
          </div>
        ) : (
          paginatedOrders.map((order, index) => (
            <motion.div
              key={order.order_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`p-4 rounded-2xl border ${
                order.status === 'paid' ? 'bg-emerald-500/5 border-emerald-500/20' :
                order.status === 'failed' ? 'bg-red-500/5 border-red-500/20' :
                order.status === 'cancelled' ? 'bg-slate-50 border-slate-200' :
                order.status === 'error' ? 'bg-orange-500/5 border-orange-500/20' :
                'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-slate-800">{order.user_name}</p>
                  <p className="text-sm text-slate-500">{order.user_email || order.user_mobile}</p>
                </div>
                <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                  order.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
                  order.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                  order.status === 'cancelled' ? 'bg-slate-100 text-slate-500' :
                  order.status === 'error' ? 'bg-orange-500/20 text-orange-400' :
                  order.status === 'fraudulent' ? 'bg-purple-500/20 text-purple-400' :
                  'bg-amber-500/20 text-amber-400'
                }`}>
                  {order.status === 'paid' ? '✅ Paid' : 
                   order.status === 'failed' ? '❌ Failed' :
                   order.status === 'cancelled' ? '🚫 Cancelled' :
                   order.status === 'error' ? '⚠️ Error' :
                   order.status === 'fraudulent' ? '🚨 Fraudulent' :
                   '⏳ Pending'}
                </span>
              </div>
              
              {/* Show failure reason if exists */}
              {order.failure_reason && (
                <div className="mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-xs">Reason: {order.failure_reason}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500">Plan</p>
                  <p className={`font-medium ${
                    order.plan_name?.toLowerCase().includes('elite') ? 'text-amber-400' :
                    order.plan_name?.toLowerCase().includes('startup') ? 'text-blue-400' :
                    'text-slate-800'
                  }`}>
                    {order.plan_name} ({order.plan_type})
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Amount</p>
                  <p className="font-bold text-emerald-400">₹{order.amount}</p>
                </div>
                <div>
                  <p className="text-slate-500">Order ID</p>
                  <p className="text-slate-600 font-mono text-xs truncate">{order.order_id}</p>
                </div>
                <div>
                  <p className="text-slate-500">Created</p>
                  <p className="text-slate-600 text-xs">{formatDate(order.created_at)}</p>
                </div>
              </div>
              
              {order.payment_id && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-slate-500 text-xs">Payment ID</p>
                  <p className="text-emerald-400 font-mono text-xs">{order.payment_id}</p>
                  {order.paid_at && (
                    <p className="text-slate-500 text-xs mt-1">
                      Paid: {formatDate(order.razorpay_payment_time || order.paid_at)}
                    </p>
                  )}
                  {/* Show payment method details */}
                  {order.payment_method && (
                    <p className="text-slate-500 text-xs mt-1">
                      Method: <span className="text-slate-700 font-medium uppercase">{order.payment_method}</span>
                      {order.payment_vpa && <span> ({order.payment_vpa})</span>}
                      {order.payment_bank && <span> - {order.payment_bank}</span>}
                      {order.payment_wallet && <span> ({order.payment_wallet})</span>}
                    </p>
                  )}
                  {/* Show UTR/RRN if available */}
                  {order.utr_number && (
                    <p className="text-slate-500 text-xs mt-1">
                      UTR/RRN: <span className="text-amber-600 font-mono">{order.utr_number}</span>
                    </p>
                  )}
                </div>
              )}
              
              {/* User's Current Subscription Status */}
              {order.user_current_plan && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-xs">User's Current Plan:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      order.user_current_plan === 'elite' ? 'bg-amber-500/20 text-amber-400' :
                      order.user_current_plan === 'growth' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {order.user_current_plan?.toUpperCase()}
                    </span>
                  </div>
                  {order.user_subscription_expiry && (
                    <p className="text-slate-500 text-xs mt-1">
                      Expires: {formatDate(order.user_subscription_expiry)}
                    </p>
                  )}
                </div>
              )}
              
              {/* If payment done but no current plan - show warning */}
              {order.status === 'paid' && !order.user_current_plan && (
                <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-red-400 text-xs font-medium">⚠️ Payment received but subscription NOT ACTIVE!</p>
                  <p className="text-red-300 text-xs">Use SYNC button to fix this.</p>
                </div>
              )}
              
              {/* Action Buttons for Paid Orders */}
              {order.status === 'paid' && (
                <div className="mt-3 pt-3 border-t border-slate-200 flex gap-2">
                  <button
                    onClick={() => generateInvoice(order.order_id)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-600 text-sm font-medium hover:bg-blue-500/20 transition-all"
                  >
                    <FileText className="w-4 h-4" />
                    Invoice
                  </button>
                  {!order.refund_status && (
                    <button
                      onClick={() => openRefundModal(order)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-red-500/10 text-red-600 text-sm font-medium hover:bg-red-500/20 transition-all"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Refund
                    </button>
                  )}
                  {order.refund_status && (
                    <div className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-orange-500/10 text-orange-600 text-sm">
                      <RotateCcw className="w-4 h-4" />
                      {order.refund_status === 'processed' ? '✅ Refunded' : '⏳ Refund Pending'}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-5 mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 bg-white rounded-lg text-slate-800 disabled:opacity-50"
          >
            Previous
          </button>
          
          <div className="flex gap-1">
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              let page;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-10 h-10 rounded-lg font-medium ${
                    currentPage === page
                      ? 'bg-amber-500 text-black'
                      : 'bg-white text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 bg-white rounded-lg text-slate-800 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Fraud Cleanup Modal */}
      {showFraudModal && fraudPreview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400" />
                <h2 className="text-lg font-bold text-slate-800">Fraud Cleanup Preview</h2>
              </div>
            </div>
            
            <div className="p-5 overflow-y-auto max-h-[50vh]">
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                <p className="text-red-400 font-medium">
                  {fraudPreview.total_will_reset} users will be reset to FREE
                </p>
                <p className="text-green-400 text-sm mt-1">
                  {fraudPreview.total_will_skip} legitimate users will be SKIPPED
                </p>
              </div>
              
              {fraudPreview.users_to_reset?.length > 0 && (
                <div className="mb-4">
                  <p className="text-slate-800 font-medium mb-2">Users to Reset:</p>
                  <div className="space-y-2">
                    {fraudPreview.users_to_reset.slice(0, 10).map((u, i) => (
                      <div key={i} className="p-2 rounded-lg bg-red-500/5 border border-red-500/20 text-sm">
                        <p className="text-slate-800">{u.name}</p>
                        <p className="text-slate-500 text-xs">{u.email || u.mobile}</p>
                        <p className="text-red-400 text-xs">{u.current_plan} → explorer</p>
                      </div>
                    ))}
                    {fraudPreview.users_to_reset.length > 10 && (
                      <p className="text-slate-500 text-sm">
                        +{fraudPreview.users_to_reset.length - 10} more...
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {fraudPreview.users_to_skip?.length > 0 && (
                <div>
                  <p className="text-slate-800 font-medium mb-2">Users to SKIP (have legitimate payments):</p>
                  <div className="space-y-2">
                    {fraudPreview.users_to_skip.slice(0, 5).map((u, i) => (
                      <div key={i} className="p-2 rounded-lg bg-green-500/5 border border-green-500/20 text-sm">
                        <p className="text-slate-800">{u.name}</p>
                        <p className="text-green-400 text-xs">Will keep: {u.current_plan}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-5 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setShowFraudModal(false)}
                className="flex-1 px-4 py-3 rounded-xl bg-white text-slate-600 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={executeFraudCleanup}
                disabled={cleanupLoading}
                className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-slate-800 font-medium flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {cleanupLoading ? 'Processing...' : 'Execute Cleanup'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Revenue Dashboard Modal */}
      {showRevenueDashboard && revenueData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-emerald-500" />
                Revenue Dashboard
              </h2>
              <button
                onClick={() => setShowRevenueDashboard(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <XCircle className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-4 space-y-6">
              {/* Revenue Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <p className="text-slate-500 text-xs mb-1">Today</p>
                  <p className="text-xl font-bold text-emerald-600">₹{revenueData.revenue?.today?.toLocaleString() || 0}</p>
                </div>
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                  <p className="text-slate-500 text-xs mb-1">This Week</p>
                  <p className="text-xl font-bold text-blue-600">₹{revenueData.revenue?.this_week?.toLocaleString() || 0}</p>
                </div>
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                  <p className="text-slate-500 text-xs mb-1">This Month</p>
                  <p className="text-xl font-bold text-purple-600">₹{revenueData.revenue?.this_month?.toLocaleString() || 0}</p>
                </div>
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <p className="text-slate-500 text-xs mb-1">This Year</p>
                  <p className="text-xl font-bold text-amber-600">₹{revenueData.revenue?.this_year?.toLocaleString() || 0}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-100 border border-slate-300">
                  <p className="text-slate-500 text-xs mb-1">All Time</p>
                  <p className="text-xl font-bold text-slate-800">₹{revenueData.revenue?.total?.toLocaleString() || 0}</p>
                </div>
              </div>
              
              {/* Stats */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 text-center">
                  <p className="text-2xl font-bold text-slate-800">{revenueData.stats?.total_orders || 0}</p>
                  <p className="text-xs text-slate-500">Total Orders</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{revenueData.stats?.paid_orders || 0}</p>
                  <p className="text-xs text-slate-500">Paid</p>
                </div>
                <div className="p-3 rounded-lg bg-red-50 text-center">
                  <p className="text-2xl font-bold text-red-600">{revenueData.stats?.failed_orders || 0}</p>
                  <p className="text-xs text-slate-500">Failed</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-50 text-center">
                  <p className="text-2xl font-bold text-blue-600">{revenueData.stats?.success_rate || 0}%</p>
                  <p className="text-xs text-slate-500">Success Rate</p>
                </div>
              </div>
              
              {/* Payment Method Breakdown */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <PieChart className="w-4 h-4" />
                  Payment Method Revenue
                </h3>
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(revenueData.payment_methods || {}).map(([method, amount]) => (
                    <div key={method} className="p-3 rounded-lg bg-slate-50 text-center">
                      <p className="text-sm font-bold text-slate-700">₹{amount?.toLocaleString() || 0}</p>
                      <p className="text-xs text-slate-500 uppercase">{method}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Plan Breakdown */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Revenue by Plan</h3>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(revenueData.plan_breakdown || {}).map(([plan, amount]) => (
                    <div key={plan} className={`p-3 rounded-lg text-center ${
                      plan === 'elite' ? 'bg-amber-50' : 
                      plan === 'startup' ? 'bg-blue-50' : 
                      plan === 'growth' ? 'bg-purple-50' : 'bg-slate-50'
                    }`}>
                      <p className="text-sm font-bold text-slate-700">₹{amount?.toLocaleString() || 0}</p>
                      <p className="text-xs text-slate-500 uppercase">{plan}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Daily Revenue Chart (Simple Bar representation) */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Last 30 Days Revenue</h3>
                <div className="h-40 flex items-end gap-1 overflow-x-auto pb-2">
                  {revenueData.charts?.daily?.slice(-30).map((day, i) => {
                    const maxRevenue = Math.max(...(revenueData.charts?.daily?.map(d => d.revenue) || [1]));
                    const height = maxRevenue > 0 ? (day.revenue / maxRevenue * 100) : 0;
                    return (
                      <div key={i} className="flex-shrink-0 flex flex-col items-center" style={{ width: '20px' }}>
                        <div 
                          className="w-3 bg-emerald-500 rounded-t hover:bg-emerald-600 transition-all cursor-pointer"
                          style={{ height: `${Math.max(height, 2)}%` }}
                          title={`${day.date}: ₹${day.revenue}`}
                        />
                        {i % 5 === 0 && (
                          <span className="text-[8px] text-slate-400 mt-1 -rotate-45">
                            {day.date?.slice(5)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Invoice Modal */}
      {showInvoiceModal && invoiceData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Invoice #{invoiceData.invoice_number}</h2>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <XCircle className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Company Header */}
              <div className="text-center pb-4 border-b border-slate-200">
                <h1 className="text-xl font-bold text-emerald-600">PARAS REWARD</h1>
                <p className="text-xs text-slate-500">{invoiceData.company?.name}</p>
              </div>
              
              {/* Invoice Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Invoice Date</p>
                  <p className="font-medium text-slate-800">
                    {new Date(invoiceData.invoice_date).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Payment ID</p>
                  <p className="font-mono text-xs text-slate-800">{invoiceData.payment_id}</p>
                </div>
              </div>
              
              {/* Customer Details */}
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Bill To</p>
                <p className="font-semibold text-slate-800">{invoiceData.customer?.name}</p>
                <p className="text-sm text-slate-600">{invoiceData.customer?.email}</p>
                <p className="text-sm text-slate-600">{invoiceData.customer?.mobile}</p>
              </div>
              
              {/* Items */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 grid grid-cols-3">
                  <span>Description</span>
                  <span className="text-center">HSN</span>
                  <span className="text-right">Amount</span>
                </div>
                {invoiceData.items?.map((item, i) => (
                  <div key={i} className="px-3 py-2 text-sm grid grid-cols-3 border-t border-slate-100">
                    <span className="text-slate-800">{item.description}</span>
                    <span className="text-center text-slate-500">{item.hsn_code}</span>
                    <span className="text-right font-medium text-slate-800">₹{item.amount?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              {/* Totals */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-800">₹{invoiceData.subtotal?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">CGST (9%)</span>
                  <span className="text-slate-800">₹{invoiceData.cgst?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">SGST (9%)</span>
                  <span className="text-slate-800">₹{invoiceData.sgst?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <span className="font-semibold text-slate-800">Total</span>
                  <span className="font-bold text-emerald-600 text-lg">₹{invoiceData.total_amount?.toFixed(2)}</span>
                </div>
              </div>
              
              {/* Paid Stamp */}
              <div className="text-center py-3 border-2 border-emerald-500 rounded-lg">
                <span className="text-emerald-600 font-bold text-xl">✓ PAID</span>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={printInvoice}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600"
                >
                  <Download className="w-4 h-4" />
                  Download / Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Refund Modal */}
      {showRefundModal && refundOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-red-500" />
                Process Refund
              </h2>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Order Details */}
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm text-slate-500">Order: <span className="font-mono text-slate-700">{refundOrder.order_id}</span></p>
                <p className="text-sm text-slate-500">Customer: <span className="font-medium text-slate-700">{refundOrder.user_name}</span></p>
                <p className="text-sm text-slate-500">Original Amount: <span className="font-bold text-emerald-600">₹{refundOrder.amount}</span></p>
              </div>
              
              {/* Warning */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm font-medium">⚠️ Warning</p>
                <p className="text-red-500 text-xs">Refund will be initiated via Razorpay. This action cannot be undone.</p>
              </div>
              
              {/* Refund Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Refund Amount (₹)</label>
                <input
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  max={refundOrder.amount}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                  placeholder={`Max: ₹${refundOrder.amount}`}
                />
                <p className="text-xs text-slate-500 mt-1">Leave empty for full refund</p>
              </div>
              
              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Refund Reason *</label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                  placeholder="Enter reason for refund..."
                />
              </div>
              
              {/* Admin PIN */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Admin PIN *</label>
                <input
                  type="password"
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                  placeholder="Enter admin PIN to confirm"
                />
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowRefundModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={processRefund}
                  disabled={refundLoading || !refundReason}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white font-medium disabled:opacity-50"
                >
                  {refundLoading ? 'Processing...' : 'Initiate Refund'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRazorpaySubscriptions;
