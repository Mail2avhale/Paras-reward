import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { 
  Package, Clock, CheckCircle, Truck, ShoppingBag, Trash2, AlertCircle, 
  ArrowLeft, Copy, TrendingUp, Coins, Wallet, Gift, Smartphone, Tv, Zap,
  CreditCard, Building, Flame, Droplet, Wifi, Shield, Receipt, ChevronLeft,
  ChevronRight, Filter, RefreshCw, XCircle, Loader2, Info, HelpCircle, X,
  PiggyBank, AlertTriangle, Percent, Gamepad2, Sparkles, Landmark
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
import { InfoTooltip, InfoCard } from '@/components/InfoTooltip';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Orders = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteOrderId, setDeleteOrderId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [userStats, setUserStats] = useState(null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'all');
  const [summary, setSummary] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState('date_desc'); // date_desc, date_asc, type_asc, type_desc, amount_desc, amount_asc
  const [showSortMenu, setShowSortMenu] = useState(false);
  const itemsPerPage = 10;

  // Sort options
  const sortOptions = [
    { value: 'date_desc', label: 'Latest First', icon: '📅↓' },
    { value: 'date_asc', label: 'Oldest First', icon: '📅↑' },
    { value: 'type_asc', label: 'Service A-Z', icon: '🔤↓' },
    { value: 'type_desc', label: 'Service Z-A', icon: '🔤↑' },
    { value: 'amount_desc', label: 'Amount High-Low', icon: '💰↓' },
    { value: 'amount_asc', label: 'Amount Low-High', icon: '💰↑' },
  ];

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

  // Get performance tag based on completion time
  const getPerformanceTag = (request) => {
    if (request.status !== 'completed' && request.status !== 'approved' && request.status !== 'delivered') {
      return null;
    }
    
    const createdAt = new Date(request.created_at);
    const completedAt = new Date(request.processed_at || request.updated_at || request.completed_at);
    const hoursToComplete = (completedAt - createdAt) / (1000 * 60 * 60);
    
    // Get expected time based on type
    let expectedHours = 72; // Default 3 days
    if (request.type === 'subscription' || request.type === 'vip_payment') {
      expectedHours = 24;
    } else if (request.type === 'bill_payment' || request.type === 'gift_voucher') {
      expectedHours = 48;
    } else if (request.type === 'bank_redeem' || request.type === 'rd_redeem') {
      expectedHours = 168; // 7 days
    }
    
    // Lightning Fast: < 25% of expected time
    if (hoursToComplete <= expectedHours * 0.25) {
      return { label: '⚡ Lightning Fast', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
    }
    
    // On Time: within expected time
    if (hoursToComplete <= expectedHours) {
      return { label: '✓ On Time', color: 'bg-green-500/20 text-green-400 border-green-500/30' };
    }
    
    // Completed: just show completed
    return { label: '✓ Completed', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
  };

  // Get processing time based on request type
  const getProcessingTime = (type, subType) => {
    // Subscription/Renewal - 24 hours
    if (type === 'subscription' || type === 'vip_payment') {
      return { time: '24 hours', color: 'text-green-400' };
    }
    
    // Bill Payment (except EMI) - 48 hours
    if (type === 'bill_payment') {
      if (subType === 'loan_emi') {
        return { time: '3 to 7 days', color: 'text-amber-400' };
      }
      return { time: '48 hours', color: 'text-blue-400' };
    }
    
    // Gift Cards - 48 hours
    if (type === 'gift_voucher') {
      return { time: '48 hours', color: 'text-blue-400' };
    }
    
    // EMI, Bank Redeem, RD Redeem - 3 to 7 days
    if (type === 'bank_redeem' || type === 'rd_redeem' || type === 'loan_emi') {
      return { time: '3 to 7 days', color: 'text-amber-400' };
    }
    
    // Default
    return { time: '3-7 days', color: 'text-gray-400' };
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'order':
        return 'bg-purple-500/20 text-purple-400';
      case 'bill_payment':
        return 'bg-amber-500/20 text-amber-400';
      case 'gift_voucher':
        return 'bg-pink-500/20 text-pink-400';
      case 'bank_redeem':
        return 'bg-emerald-500/20 text-emerald-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const fetchRequests = useCallback(async (page = 1, type = 'all', sort = 'date_desc') => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/user/${user.uid}/all-requests`, {
        params: { page, limit: itemsPerPage, request_type: type }
      });
      
      let sortedRequests = response.data.requests || [];
      
      // Sort on frontend based on sortBy
      sortedRequests = [...sortedRequests].sort((a, b) => {
        switch (sort) {
          case 'date_desc':
            return new Date(b.created_at) - new Date(a.created_at);
          case 'date_asc':
            return new Date(a.created_at) - new Date(b.created_at);
          case 'type_asc':
            return (a.type || '').localeCompare(b.type || '');
          case 'type_desc':
            return (b.type || '').localeCompare(a.type || '');
          case 'amount_desc':
            return (b.amount_inr || b.total_prc || 0) - (a.amount_inr || a.total_prc || 0);
          case 'amount_asc':
            return (a.amount_inr || a.total_prc || 0) - (b.amount_inr || b.total_prc || 0);
          default:
            return new Date(b.created_at) - new Date(a.created_at);
        }
      });
      
      setRequests(sortedRequests);
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
    fetchRequests(currentPage, activeTab, sortBy);
    fetchUserStats();
  }, [currentPage, activeTab, sortBy, fetchRequests, fetchUserStats]);

  const handleTabChange = (value) => {
    setActiveTab(value);
    setCurrentPage(1);
    // Update URL with tab parameter for deep linking
    if (value === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: value });
    }
  };

  const handleSortChange = (value) => {
    setSortBy(value);
    setCurrentPage(1);
    setShowSortMenu(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRequests(currentPage, activeTab, sortBy);
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
                  <InfoTooltip>
                    <p>Total PRC spent on bill payments, gift vouchers, and marketplace orders</p>
                  </InfoTooltip>
                </div>
                <p className="text-white font-bold text-lg">{(userStats.total_prc_redeemed || 0).toLocaleString()}</p>
                <p className="text-gray-500 text-xs">≈ ₹{((userStats.total_prc_redeemed || 0) * 0.1).toFixed(2)}</p>
              </div>
              
              {/* Lifetime Earnings */}
              <div className="bg-gray-900/50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="w-4 h-4 text-emerald-500" />
                  <p className="text-gray-400 text-xs">Total Earned</p>
                  <InfoTooltip>
                    <p className="font-semibold mb-1">All PRC ever earned:</p>
                    <p>Mining + Games + Referrals + Cashback</p>
                    <p className="text-amber-400 mt-1 text-[10px]">Note: This ≠ Balance + Redeemed (see breakdown below)</p>
                  </InfoTooltip>
                </div>
                <p className="text-emerald-400 font-bold text-lg">{(userStats.total_earned || 0).toLocaleString()}</p>
                <p className="text-gray-500 text-xs">≈ ₹{((userStats.total_earned || 0) * 0.1).toFixed(2)}</p>
              </div>
              
              {/* Cashback Received */}
              <div className="bg-gray-900/50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="w-4 h-4 text-purple-500" />
                  <p className="text-gray-400 text-xs">Cashback</p>
                  <InfoTooltip>
                    <p>Cashback earned from completed bill payments and purchases</p>
                  </InfoTooltip>
                </div>
                <p className="text-purple-400 font-bold text-lg">₹{(userStats.total_cashback || 0).toFixed(2)}</p>
              </div>
              
              {/* Current Balance */}
              <div className="bg-gray-900/50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Coins className="w-4 h-4 text-blue-500" />
                  <p className="text-gray-400 text-xs">Balance</p>
                  <InfoTooltip>
                    <p>Your current available PRC for redemptions</p>
                  </InfoTooltip>
                </div>
                <p className="text-blue-400 font-bold text-lg">{(userStats.current_balance || 0).toFixed(2)}</p>
                <p className="text-gray-500 text-xs">PRC available</p>
              </div>
            </div>
            
            {/* RD Savings Card (replacing Luxury Life) */}
            {userStats.luxury_life && userStats.luxury_life.total_savings > 0 && (
              <div className="mt-4 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-xl p-4 border border-emerald-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <PiggyBank className="w-5 h-5 text-emerald-500" />
                      <p className="text-white font-semibold">RD Savings</p>
                      <InfoTooltip>
                        <p className="font-semibold mb-1">Your PRC Savings!</p>
                        <p>20% of your mining earnings are automatically saved in your RD account. Earn up to 9.25% interest on your savings!</p>
                      </InfoTooltip>
                    </div>
                    <p className="text-2xl font-bold text-emerald-400">{(userStats.luxury_life.total_savings || 0).toLocaleString()} PRC</p>
                    <p className="text-gray-400 text-xs">≈ ₹{(userStats.luxury_life.savings_inr || 0).toFixed(2)} saved</p>
                  </div>
                  <div className="text-right">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-1">
                      <Sparkles className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-xs text-emerald-400">20% Auto-Save</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Complete PRC Breakdown */}
            {userStats.deductions_breakdown && (
              <div className="mt-4 bg-gray-900/70 rounded-xl p-3 border border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                  <HelpCircle className="w-4 h-4 text-amber-500" />
                  <p className="text-white text-sm font-semibold">Complete PRC Breakdown</p>
                </div>
                
                <div className="space-y-1 text-xs">
                  {/* ===== CREDITS SECTION ===== */}
                  <p className="text-emerald-500 text-[10px] font-semibold uppercase tracking-wider pt-1">Credits (+)</p>
                  
                  {/* Total Earned */}
                  <div className="flex justify-between items-center py-1.5 bg-emerald-500/10 rounded px-2">
                    <span className="text-emerald-400 flex items-center gap-2">
                      <TrendingUp className="w-3 h-3" /> Total Earned (Mining + Games + Referrals)
                    </span>
                    <span className="text-emerald-400 font-mono font-bold">+{(userStats.total_earned || 0).toLocaleString()}</span>
                  </div>
                  
                  {/* Admin Credits */}
                  {userStats.credits_breakdown?.admin_credits > 0 && (
                    <div className="flex justify-between items-center py-1 text-gray-400 px-2">
                      <span className="flex items-center gap-2">
                        <Shield className="w-3 h-3 text-cyan-500" /> Admin Credits/Bonuses
                        <InfoTooltip>
                          <p>Bonus PRC credited by admin for promotions, corrections, or rewards</p>
                        </InfoTooltip>
                      </span>
                      <span className="text-cyan-400 font-mono">+{(userStats.credits_breakdown?.admin_credits || 0).toLocaleString()}</span>
                    </div>
                  )}
                  
                  {/* ===== DEDUCTIONS SECTION ===== */}
                  <p className="text-red-500 text-[10px] font-semibold uppercase tracking-wider pt-3">Deductions (-)</p>
                  
                  {/* Redeemed */}
                  <div className="flex justify-between items-center py-1 text-gray-400 px-2">
                    <span className="flex items-center gap-2">
                      <Receipt className="w-3 h-3 text-amber-500" /> Redeemed (Bills/Vouchers/Orders)
                    </span>
                    <span className="text-red-400 font-mono">-{(userStats.deductions_breakdown?.redeemed || 0).toLocaleString()}</span>
                  </div>
                  
                  {/* Luxury Savings */}
                  {userStats.deductions_breakdown?.luxury_savings > 0 && (
                    <div className="flex justify-between items-center py-1 text-gray-400 px-2">
                      <span className="flex items-center gap-2">
                        <PiggyBank className="w-3 h-3 text-emerald-500" /> RD Savings (20%)
                        <InfoTooltip>
                          <p>20% auto-saved from mining to your RD account. Earn up to 9.25% interest!</p>
                        </InfoTooltip>
                      </span>
                      <span className="text-emerald-400 font-mono">-{(userStats.deductions_breakdown?.luxury_savings || 0).toLocaleString()}</span>
                    </div>
                  )}
                  
                  {/* Service Charges */}
                  {userStats.deductions_breakdown?.service_charges > 0 && (
                    <div className="flex justify-between items-center py-1 text-gray-400 px-2">
                      <span className="flex items-center gap-2">
                        <Percent className="w-3 h-3 text-orange-500" /> Service Charges (2-5%)
                      </span>
                      <span className="text-orange-400 font-mono">-{(userStats.deductions_breakdown?.service_charges || 0).toLocaleString()}</span>
                    </div>
                  )}
                  
                  {/* Expired/Burned */}
                  {userStats.deductions_breakdown?.expired_burned > 0 && (
                    <div className="flex justify-between items-center py-1 text-gray-400 px-2">
                      <span className="flex items-center gap-2">
                        <Flame className="w-3 h-3 text-red-500" /> Expired / Burned PRC
                        <InfoTooltip>
                          <p>PRC that expired (free users) or was burned. Upgrade to prevent expiry!</p>
                        </InfoTooltip>
                      </span>
                      <span className="text-red-400 font-mono">-{(userStats.deductions_breakdown?.expired_burned || 0).toLocaleString()}</span>
                    </div>
                  )}
                  
                  {/* Tap Game Losses */}
                  {userStats.deductions_breakdown?.tap_game_losses > 0 && (
                    <div className="flex justify-between items-center py-1 text-gray-400 px-2">
                      <span className="flex items-center gap-2">
                        <Gamepad2 className="w-3 h-3 text-purple-500" /> Tap Game Losses
                      </span>
                      <span className="text-red-400 font-mono">-{(userStats.deductions_breakdown?.tap_game_losses || 0).toLocaleString()}</span>
                    </div>
                  )}
                  
                  {/* Admin Debits */}
                  {userStats.deductions_breakdown?.admin_debits > 0 && (
                    <div className="flex justify-between items-center py-1 text-gray-400 px-2">
                      <span className="flex items-center gap-2">
                        <Shield className="w-3 h-3 text-gray-500" /> Admin Adjustments
                        <InfoTooltip>
                          <p>Corrections or adjustments made by admin</p>
                        </InfoTooltip>
                      </span>
                      <span className="text-gray-400 font-mono">-{(userStats.deductions_breakdown?.admin_debits || 0).toLocaleString()}</span>
                    </div>
                  )}
                  
                  {/* Unaccounted */}
                  {userStats.deductions_breakdown?.unaccounted > 0 && (
                    <div className="flex justify-between items-center py-1 text-gray-400 px-2">
                      <span className="flex items-center gap-2">
                        <Info className="w-3 h-3" /> Other/Rounding
                      </span>
                      <span className="text-gray-500 font-mono">-{(userStats.deductions_breakdown?.unaccounted || 0).toLocaleString()}</span>
                    </div>
                  )}
                  
                  {/* ===== RESULT ===== */}
                  <div className="flex justify-between items-center py-2 border-t border-gray-700 mt-3 bg-blue-500/10 rounded px-2">
                    <span className="text-blue-400 font-semibold flex items-center gap-2">
                      <Wallet className="w-4 h-4" /> = Available Balance
                    </span>
                    <span className="text-blue-400 font-mono font-bold text-base">{(userStats.current_balance || 0).toLocaleString()} PRC</span>
                  </div>
                </div>
              </div>
            )}
            
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
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs and Sort Controls */}
      <div className="px-5 mb-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1">
            <TabsList className="grid w-full grid-cols-5 bg-gray-800/50 rounded-xl p-1">
              <TabsTrigger 
                value="all" 
                className="rounded-lg text-xs data-[state=active]:bg-amber-500 data-[state=active]:text-white"
              >
                All ({(summary?.total_orders || 0) + (summary?.total_bill_payments || 0) + (summary?.total_vouchers || 0) + (summary?.total_bank_redeems || 0)})
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
              <TabsTrigger 
                value="bank_redeem"
                className="rounded-lg text-xs data-[state=active]:bg-emerald-500 data-[state=active]:text-white"
              >
                Bank ({summary?.total_bank_redeems || 0})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-800/70 hover:bg-gray-700/70 rounded-xl border border-gray-700 text-sm text-gray-300 transition-colors"
              data-testid="sort-button"
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Sort</span>
              <ChevronRight className={`w-4 h-4 transition-transform ${showSortMenu ? 'rotate-90' : ''}`} />
            </button>
            
            {showSortMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-gray-800 rounded-xl border border-gray-700 shadow-xl z-50 overflow-hidden">
                <div className="p-2 border-b border-gray-700">
                  <p className="text-xs text-gray-400 font-semibold px-2">Sort By</p>
                </div>
                <div className="p-1">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleSortChange(option.value)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        sortBy === option.value 
                          ? 'bg-amber-500/20 text-amber-400' 
                          : 'text-gray-300 hover:bg-gray-700/50'
                      }`}
                      data-testid={`sort-${option.value}`}
                    >
                      <span>{option.icon}</span>
                      <span>{option.label}</span>
                      {sortBy === option.value && <CheckCircle className="w-4 h-4 ml-auto" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
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
            <p className="text-gray-600 text-sm mb-6">Start using Bill Payments, Gift Vouchers, or Redeem to Bank to see your requests here!</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button 
                onClick={() => navigate('/bill-payments')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors text-sm"
              >
                📱 Bill Payments
              </button>
              <button 
                onClick={() => navigate('/gift-vouchers')}
                className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-xl font-medium transition-colors text-sm"
              >
                🎁 Gift Vouchers
              </button>
              <button 
                onClick={() => navigate('/bank-redeem')}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors text-sm"
              >
                🏦 Redeem to Bank
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => {
              const IconComponent = iconMap[request.icon] || Package;
              const performanceTag = getPerformanceTag(request);
              
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
                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)} flex items-center gap-1`}>
                            {getStatusIcon(request.status)}
                            {getStatusLabel(request.status)}
                          </span>
                          {/* Performance Tag for completed requests */}
                          {performanceTag && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${performanceTag.color}`}>
                              {performanceTag.label}
                            </span>
                          )}
                        </div>
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
                      {request.status === 'rejected' && (request.admin_notes || request.reject_reason || request.rejection_reason) && (
                        <div className="mt-2 p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                          <p className="text-red-400 text-xs font-semibold mb-1">❌ Rejection Reason:</p>
                          <p className="text-red-300 text-sm">{request.admin_notes || request.reject_reason || request.rejection_reason}</p>
                        </div>
                      )}
                      
                      {/* Processing Time Info for Pending Requests */}
                      {(request.status === 'pending' || request.status === 'processing' || request.status === 'approved') && (
                        <div className="mt-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                          <div className="flex items-start gap-2">
                            <Clock className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-amber-400 text-xs font-semibold mb-1">
                                ⏱️ Estimated Processing Time:
                              </p>
                              <p className={`text-sm font-medium ${getProcessingTime(request.type, request.request_type).color}`}>
                                {getProcessingTime(request.type, request.request_type).time}
                              </p>
                              {/* Check if request is taking longer than expected */}
                              {request.created_at && (() => {
                                const daysSinceCreation = Math.floor((new Date() - new Date(request.created_at)) / (1000 * 60 * 60 * 24));
                                const expectedDays = (request.type === 'bank_redeem' || request.type === 'rd_redeem' || request.request_type === 'loan_emi') ? 7 
                                  : (request.type === 'bill_payment' || request.type === 'gift_voucher') ? 2 
                                  : 1;
                                if (daysSinceCreation >= expectedDays) {
                                  return (
                                    <div className="mt-2 p-2 bg-blue-500/10 rounded border border-blue-500/30">
                                      <p className="text-blue-300 text-xs">
                                        🙏 <strong>Thank you for your patience!</strong> Your request is taking a bit longer than usual. Our team is working on it.
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
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
          <div className="mt-6 pb-4">
            {/* Current Sort Indicator */}
            <div className="flex items-center justify-center mb-4">
              <span className="text-xs text-gray-500 bg-gray-800/50 px-3 py-1 rounded-full">
                Sorted: {sortOptions.find(s => s.value === sortBy)?.label || 'Latest First'}
              </span>
            </div>
            
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                data-testid="pagination-prev"
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
                      data-testid={`pagination-page-${pageNum}`}
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
                data-testid="pagination-next"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            </div>
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
