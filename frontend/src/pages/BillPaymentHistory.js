import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle,
  Loader2, RefreshCw, Zap, Tv, Flame, Droplet, Building,
  CreditCard, Shield, Car, Wifi, Phone, IndianRupee, 
  RotateCcw, Calendar, Receipt
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Service icons mapping
const SERVICE_ICONS = {
  electricity: Zap,
  gas: Flame,
  water: Droplet,
  dth: Tv,
  mobile_recharge: Phone,
  mobile_postpaid: Phone,
  broadband: Wifi,
  landline: Phone,
  emi: Building,
  credit_card: CreditCard,
  insurance: Shield,
  fastag: Car,
  lpg: Flame
};

// Service colors
const SERVICE_COLORS = {
  electricity: 'from-yellow-500 to-orange-500',
  gas: 'from-orange-500 to-red-500',
  water: 'from-cyan-500 to-blue-500',
  dth: 'from-purple-500 to-pink-500',
  mobile_recharge: 'from-blue-500 to-cyan-500',
  mobile_postpaid: 'from-indigo-500 to-blue-500',
  broadband: 'from-teal-500 to-green-500',
  landline: 'from-slate-500 to-gray-500',
  emi: 'from-rose-500 to-pink-500',
  credit_card: 'from-amber-500 to-yellow-500',
  insurance: 'from-emerald-500 to-green-500',
  fastag: 'from-sky-500 to-blue-500',
  lpg: 'from-red-500 to-orange-500'
};

const BillPaymentHistory = ({ user }) => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const fetchHistory = async () => {
    if (!user?.uid) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${API}/redeem/user/${user.uid}/requests?limit=20&skip=${(page-1)*20}`);
      
      if (response.data.success) {
        let filteredRequests = response.data.requests || [];
        
        // Apply status filter
        if (statusFilter !== 'all') {
          filteredRequests = filteredRequests.filter(r => r.status === statusFilter);
        }
        
        setRequests(filteredRequests);
        // Calculate pagination from response
        const total = response.data.total || 0;
        const limit = 20;
        setPagination({
          page: page,
          limit: limit,
          total: total,
          pages: Math.ceil(total / limit)
        });
      }
    } catch (error) {
      toast.error('Failed to load payment history');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user?.uid, page, statusFilter]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'processing': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'rejected': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case 'processing': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'completed': return 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'failed': return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'rejected': return 'bg-red-500/10 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  const getServiceIcon = (serviceType) => {
    const Icon = SERVICE_ICONS[serviceType] || Receipt;
    return Icon;
  };

  const getServiceColor = (serviceType) => {
    return SERVICE_COLORS[serviceType] || 'from-gray-500 to-gray-600';
  };

  const formatServiceName = (serviceType) => {
    const names = {
      electricity: 'Electricity',
      gas: 'Gas (PNG)',
      water: 'Water',
      dth: 'DTH',
      mobile_recharge: 'Mobile Prepaid',
      mobile_postpaid: 'Mobile Postpaid',
      broadband: 'Broadband',
      landline: 'Landline',
      emi: 'EMI/Loan',
      credit_card: 'Credit Card',
      insurance: 'Insurance',
      fastag: 'FASTag',
      lpg: 'LPG'
    };
    return names[serviceType] || serviceType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Pay Again - navigate to redeem page with pre-filled data
  const handlePayAgain = (req) => {
    const details = req.details || {};
    const params = new URLSearchParams();
    params.set('service', req.service_type);
    params.set('operator', details.operator_id || details.operator || '');
    params.set('account', details.consumer_number || details.mobile_number || details.card_number || details.loan_account || '');
    
    navigate(`/redeem?${params.toString()}`);
    toast.success('Previous payment details loaded!');
  };

  // Calculate status counts
  const statusCounts = requests.reduce((acc, req) => {
    acc[req.status] = (acc[req.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 pb-24 pt-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Bill Payment History</h1>
          <p className="text-gray-500 text-sm">View past payments & pay again</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchHistory}
          disabled={loading}
          className="border-gray-700 text-gray-400"
          data-testid="refresh-btn"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Status Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {['all', 'completed', 'pending', 'processing', 'failed'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              statusFilter === status
                ? 'bg-amber-500 text-black'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
            data-testid={`filter-${status}`}
          >
            {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            {status !== 'all' && statusCounts[status] ? ` (${statusCounts[status]})` : ''}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <Card className="p-8 bg-gray-800/50 border-gray-700 text-center">
          <Receipt className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">No bill payments found</p>
          <p className="text-gray-500 text-sm mb-4">Start paying bills to see your history here</p>
          <Button
            className="bg-amber-500 hover:bg-amber-600 text-black"
            onClick={() => navigate('/redeem')}
            data-testid="new-payment-btn"
          >
            Pay a Bill
          </Button>
        </Card>
      ) : (
        /* Payment List */
        <div className="space-y-3">
          {requests.map((req) => {
            const Icon = getServiceIcon(req.service_type);
            const colorClass = getServiceColor(req.service_type);
            const details = req.details || {};
            const accountNumber = details.consumer_number || details.mobile_number || 
                                  details.card_number || details.loan_account || 'N/A';
            
            return (
              <Card 
                key={req.request_id} 
                className="p-4 bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-all"
                data-testid={`payment-${req.request_id}`}
              >
                <div className="flex items-start gap-3">
                  {/* Service Icon */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  
                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-medium">
                        {formatServiceName(req.service_type)}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 ${getStatusColor(req.status)}`}>
                        {getStatusIcon(req.status)}
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </span>
                    </div>
                    
                    <p className="text-gray-400 text-sm truncate">
                      {details.operator_name || `Account: ${accountNumber.slice(-6)}`}
                    </p>
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1 text-amber-400 font-semibold">
                        <IndianRupee className="w-4 h-4" />
                        <span>{req.amount?.toLocaleString() || '0'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-500 text-xs">
                        <Calendar className="w-3 h-3" />
                        {new Date(req.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit'
                        })}
                      </div>
                    </div>
                    
                    {/* Transaction Reference */}
                    {req.eko_response?.tid && (
                      <p className="text-xs text-gray-500 mt-1">
                        Ref: {req.eko_response.tid}
                      </p>
                    )}
                    
                    {/* Pay Again Button - Only for completed payments */}
                    {req.status === 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePayAgain(req)}
                        className="mt-3 w-full border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                        data-testid={`pay-again-${req.request_id}`}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Pay Again
                      </Button>
                    )}
                    
                    {/* Error Message for Failed */}
                    {(req.status === 'failed' || req.status === 'rejected') && req.eko_response?.message && (
                      <p className="text-xs text-red-400 mt-2 bg-red-500/10 px-2 py-1 rounded">
                        {req.eko_response.message}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="border-gray-700 text-gray-400"
          >
            Previous
          </Button>
          <span className="text-gray-400 text-sm">
            Page {page} of {pagination.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages}
            className="border-gray-700 text-gray-400"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default BillPaymentHistory;
