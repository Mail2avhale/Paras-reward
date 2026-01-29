import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Package, Clock, CheckCircle, Truck, ShoppingBag, Trash2, AlertCircle, 
  ArrowLeft, Copy, TrendingUp, Coins, Wallet, Gift, Smartphone, Tv, Zap,
  CreditCard, Building, Flame, Droplet, Wifi, Shield, Receipt, ChevronLeft,
  ChevronRight, Filter, RefreshCw, XCircle, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Orders = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteOrderId, setDeleteOrderId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [userStats, setUserStats] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [summary, setSummary] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const itemsPerPage = 10;

  // Icon mapping
  const iconMap = {
    'package': Package,
    'smartphone': Smartphone,
    'tv': Tv,
    'zap': Zap,
    'credit-card': CreditCard,
    'building': Building,
    'flame': Flame,
    'droplet': Droplet,
    'wifi': Wifi,
    'shield': Shield,
    'gift': Gift,
    'receipt': Receipt
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'approved':
      case 'processing':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'completed':
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'shipped':
        return <Truck className="h-4 w-4 text-blue-500" />;
      case 'rejected':
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Package className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'approved':
      case 'processing':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'completed':
      case 'delivered':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'shipped':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'rejected':
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  // Display friendly status name
  const getStatusLabel = (status) => {
    switch (status?.toLowerCase()) {
      case 'processing':
        return 'Approved';
      case 'completed':
        return 'Completed';
      case 'delivered':
        return 'Delivered';
      case 'pending':
        return 'Pending';
      case 'rejected':
        return 'Rejected';
      case 'cancelled':
        return 'Cancelled';
      case 'shipped':
        return 'Shipped';
      default:
        return status || 'Unknown';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'order':
        return 'bg-purple-500/20 text-purple-400';
      case 'bill_payment':
        return 'bg-amber-500/20 text-amber-400';
      case 'gift_voucher':
        return 'bg-pink-500/20 text-pink-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const fetchRequests = useCallback(async (page = 1, type = 'all') => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/user/${user.uid}/all-requests`, {
        params: { page, limit: itemsPerPage, request_type: type }
      });
      
      setRequests(response.data.requests || []);
      setTotalPages(response.data.pagination?.total_pages || 1);
      setTotalCount(response.data.pagination?.total_count || 0);
      setSummary(response.data.summary || null);
    } catch (error) {
      console.error('Error fetching requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [user.uid]);

  const fetchUserStats = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/user/${user.uid}/redemption-stats`);
      setUserStats(response.data);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  }, [user.uid]);

  useEffect(() => {
    fetchRequests(currentPage, activeTab);
    fetchUserStats();
  }, [currentPage, activeTab, fetchRequests, fetchUserStats]);

  const handleTabChange = (value) => {
    setActiveTab(value);
    setCurrentPage(1);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRequests(currentPage, activeTab);
    await fetchUserStats();
    setRefreshing(false);
    toast.success('Refreshed!');
  };

  const handleDeleteOrder = async (orderId) => {
    try {
      await axios.delete(`${API}/orders/${orderId}`);
      toast.success('Order cancelled successfully');
      fetchRequests(currentPage, activeTab);
      setDeleteOrderId(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel order');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div data-testid="orders-page" className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 sticky top-0 z-10 bg-gray-950/80 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white text-xl font-bold">My Requests</h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* User Stats Summary */}
      {userStats && (
        <div className="px-5 mb-4">
          <div className="bg-gradient-to-r from-amber-500/10 to-purple-500/10 rounded-2xl p-4 border border-amber-500/20">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-500" />
              Your Redemption Summary
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Total PRC Redeemed */}
              <div className="bg-gray-900/50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Coins className="w-4 h-4 text-amber-500" />
                  <p className="text-gray-400 text-xs">PRC Redeemed</p>
                </div>
                <p className="text-white font-bold text-lg">{(userStats.total_prc_redeemed || 0).toLocaleString()}</p>
                <p className="text-gray-500 text-xs">≈ ₹{((userStats.total_prc_redeemed || 0) * 0.1).toFixed(2)}</p>
              </div>
              
              {/* Total Earned */}
              <div className="bg-gray-900/50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="w-4 h-4 text-emerald-500" />
                  <p className="text-gray-400 text-xs">Total Earned</p>
                </div>
                <p className="text-emerald-400 font-bold text-lg">{(userStats.total_earned || 0).toLocaleString()}</p>
                <p className="text-gray-500 text-xs">≈ ₹{((userStats.total_earned || 0) * 0.1).toFixed(2)}</p>
              </div>
              
              {/* Cashback Received */}
              <div className="bg-gray-900/50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="w-4 h-4 text-purple-500" />
                  <p className="text-gray-400 text-xs">Cashback</p>
                </div>
                <p className="text-purple-400 font-bold text-lg">₹{(userStats.total_cashback || 0).toFixed(2)}</p>
              </div>
              
              {/* Current Balance */}
              <div className="bg-gray-900/50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Coins className="w-4 h-4 text-blue-500" />
                  <p className="text-gray-400 text-xs">Balance</p>
                </div>
                <p className="text-blue-400 font-bold text-lg">{(userStats.current_balance || 0).toFixed(2)}</p>
                <p className="text-gray-500 text-xs">PRC available</p>
              </div>
            </div>
            
            {/* Earnings Breakdown */}
            {userStats.earnings_breakdown && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <p className="text-gray-400 text-xs mb-2">Earnings Breakdown</p>
                <div className="flex flex-wrap gap-2">
                  {userStats.earnings_breakdown.mining > 0 && (
                    <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs">
                      Mining: {userStats.earnings_breakdown.mining.toFixed(2)}
                    </span>
                  )}
                  {userStats.earnings_breakdown.referral > 0 && (
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs">
                      Referral: {userStats.earnings_breakdown.referral.toFixed(2)}
                    </span>
                  )}
                  {userStats.earnings_breakdown.tap_game > 0 && (
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">
                      Tap Game: {userStats.earnings_breakdown.tap_game.toFixed(2)}
                    </span>
                  )}
                  {userStats.earnings_breakdown.rain_game > 0 && (
                    <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded-full text-xs">
                      Rain Game: {userStats.earnings_breakdown.rain_game.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs for Request Types */}
      <div className="px-5 mb-4">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-gray-800/50 rounded-xl p-1">
            <TabsTrigger 
              value="all" 
              className="rounded-lg text-xs data-[state=active]:bg-amber-500 data-[state=active]:text-white"
            >
              All ({summary?.total_orders + summary?.total_bill_payments + summary?.total_vouchers || totalCount})
            </TabsTrigger>
            <TabsTrigger 
              value="orders"
              className="rounded-lg text-xs data-[state=active]:bg-purple-500 data-[state=active]:text-white"
            >
              Orders ({summary?.total_orders || 0})
            </TabsTrigger>
            <TabsTrigger 
              value="bill_payment"
              className="rounded-lg text-xs data-[state=active]:bg-amber-500 data-[state=active]:text-white"
            >
              Bills ({summary?.total_bill_payments || 0})
            </TabsTrigger>
            <TabsTrigger 
              value="gift_voucher"
              className="rounded-lg text-xs data-[state=active]:bg-pink-500 data-[state=active]:text-white"
            >
              Vouchers ({summary?.total_vouchers || 0})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Request Stats Bar */}
      {summary && (
        <div className="px-5 mb-4">
          <div className="flex gap-3 overflow-x-auto pb-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 rounded-lg whitespace-nowrap">
              <Clock className="w-4 h-4 text-yellow-500" />
              <span className="text-yellow-400 text-sm">{summary.pending_count} Pending</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 rounded-lg whitespace-nowrap">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-green-400 text-sm">{summary.completed_count} Completed</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 rounded-lg whitespace-nowrap">
              <Coins className="w-4 h-4 text-purple-500" />
              <span className="text-purple-400 text-sm">{summary.total_prc_used?.toFixed(0)} PRC Used</span>
            </div>
          </div>
        </div>
      )}

      <div className="px-5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div data-testid="no-requests" className="bg-gray-900/50 rounded-2xl p-8 border border-gray-800 text-center">
            <Package className="h-16 w-16 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-2">No requests yet</p>
            <p className="text-gray-600 text-sm mb-6">Visit the marketplace to redeem your first product!</p>
            <button 
              onClick={() => navigate('/marketplace')}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors"
            >
              Browse Marketplace
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => {
              const IconComponent = iconMap[request.icon] || Package;
              
              return (
                <div 
                  key={request.id}
                  data-testid={`request-${request.id}`}
                  className="bg-gray-900/50 rounded-2xl p-4 border border-gray-800 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl ${getTypeColor(request.type)} flex items-center justify-center flex-shrink-0`}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-white font-semibold text-sm line-clamp-1">{request.title}</h3>
                          <p className="text-gray-500 text-xs">{request.type_label}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)} flex items-center gap-1`}>
                          {getStatusIcon(request.status)}
                          {getStatusLabel(request.status)}
                        </span>
                      </div>
                      
                      {/* Amount Info */}
                      <div className="flex items-center gap-4 mt-2">
                        <div>
                          <p className="text-amber-400 font-bold">{request.amount_prc?.toFixed(2)} PRC</p>
                          <p className="text-gray-500 text-xs">≈ ₹{request.amount_inr?.toFixed(2)}</p>
                        </div>
                        {request.service_charge > 0 && (
                          <div className="text-xs text-gray-500">
                            +{request.service_charge?.toFixed(2)} PRC fee
                          </div>
                        )}
                      </div>
                      
                      {/* Date & ID */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
                        <p className="text-gray-500 text-xs">{formatDate(request.created_at)}</p>
                        <button
                          onClick={() => copyToClipboard(request.id)}
                          className="flex items-center gap-1 text-gray-500 hover:text-gray-400 text-xs"
                        >
                          <Copy className="w-3 h-3" />
                          {request.id?.substring(0, 8)}...
                        </button>
                      </div>
                      
                      {/* Admin Notes if rejected */}
                      {request.admin_notes && request.status === 'rejected' && (
                        <div className="mt-2 p-2 bg-red-500/10 rounded-lg">
                          <p className="text-red-400 text-xs">Note: {request.admin_notes}</p>
                        </div>
                      )}
                      
                      {/* Voucher Code if available */}
                      {request.type === 'gift_voucher' && request.details?.voucher_code && (
                        <div className="mt-2 p-2 bg-green-500/10 rounded-lg flex items-center justify-between">
                          <span className="text-green-400 text-sm font-mono">{request.details.voucher_code}</span>
                          <button
                            onClick={() => copyToClipboard(request.details.voucher_code)}
                            className="text-green-400 hover:text-green-300"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      
                      {/* Cancel button for pending orders */}
                      {request.type === 'order' && request.status === 'pending' && (
                        <button
                          onClick={() => setDeleteOrderId(request.id)}
                          className="mt-2 flex items-center gap-1 text-red-400 hover:text-red-300 text-xs"
                        >
                          <Trash2 className="w-3 h-3" />
                          Cancel Order
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6 pb-6">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </div>
        )}
        
        {/* Page Info */}
        {totalCount > 0 && (
          <p className="text-center text-gray-500 text-sm pb-6">
            Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} requests
          </p>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteOrderId} onOpenChange={() => setDeleteOrderId(null)}>
        <AlertDialogContent className="bg-gray-900 border border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Cancel Order?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to cancel this order? Your PRC will be refunded to your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700">
              Keep Order
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteOrder(deleteOrderId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Orders;
