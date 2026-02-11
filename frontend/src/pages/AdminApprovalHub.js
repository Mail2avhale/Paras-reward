import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Shield, Crown, CreditCard, Gift, Gem, Clock, CheckCircle, XCircle,
  Search, RefreshCw, Eye, ChevronRight, User, FileText, Image,
  AlertCircle, Filter, X
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminApprovalHub = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('kyc');
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState(null);
  
  // Data states
  const [kycPending, setKycPending] = useState([]);
  const [subscriptionPending, setSubscriptionPending] = useState([]);
  const [billPayments, setBillPayments] = useState([]);
  const [giftVouchers, setGiftVouchers] = useState([]);
  const [luxuryClaims, setLuxuryClaims] = useState([]);
  
  // Counts for badges
  const [counts, setCounts] = useState({
    kyc: 0, subscription: 0, bills: 0, gifts: 0, luxury: 0
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [kycRes, subRes, billRes, giftRes, luxuryRes] = await Promise.all([
        axios.get(`${API}/api/admin/kyc/pending?limit=50`).catch(() => ({ data: { users: [] } })),
        axios.get(`${API}/api/admin/vip-payments?status=pending&limit=50`).catch(() => ({ data: { payments: [] } })),
        axios.get(`${API}/api/admin/bill-payments?status=pending&limit=50`).catch(() => ({ data: { payments: [] } })),
        axios.get(`${API}/api/admin/gift-vouchers?status=pending&limit=50`).catch(() => ({ data: { requests: [] } })),
        axios.get(`${API}/api/admin/luxury-claims?status=pending&limit=50`).catch(() => ({ data: { claims: [] } }))
      ]);
      
      const kycData = kycRes.data?.users || [];
      const subData = subRes.data?.payments || [];
      const billData = billRes.data?.payments || billRes.data || [];
      const giftData = giftRes.data?.requests || giftRes.data || [];
      const luxuryData = luxuryRes.data?.claims || luxuryRes.data || [];
      
      setKycPending(kycData);
      setSubscriptionPending(subData);
      setBillPayments(Array.isArray(billData) ? billData : []);
      setGiftVouchers(Array.isArray(giftData) ? giftData : []);
      setLuxuryClaims(Array.isArray(luxuryData) ? luxuryData : []);
      
      setCounts({
        kyc: kycData.length,
        subscription: subData.length,
        bills: Array.isArray(billData) ? billData.length : 0,
        gifts: Array.isArray(giftData) ? giftData.length : 0,
        luxury: Array.isArray(luxuryData) ? luxuryData.length : 0
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // KYC Actions
  const handleKycApprove = async (uid) => {
    setProcessing(uid);
    try {
      await axios.post(`${API}/api/admin/kyc/${uid}/approve`);
      toast.success('KYC Approved!');
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    } finally {
      setProcessing(null);
    }
  };

  const handleKycReject = async (uid) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    setProcessing(uid);
    try {
      await axios.post(`${API}/api/admin/kyc/${uid}/reject`, { reason });
      toast.success('KYC Rejected');
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    } finally {
      setProcessing(null);
    }
  };

  // Subscription Actions
  const handleSubApprove = async (paymentId) => {
    setProcessing(paymentId);
    try {
      await axios.post(`${API}/api/admin/vip-payments/${paymentId}/approve`);
      toast.success('Subscription Approved!');
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    } finally {
      setProcessing(null);
    }
  };

  const handleSubReject = async (paymentId) => {
    if (!confirm('Reject this payment?')) return;
    setProcessing(paymentId);
    try {
      await axios.post(`${API}/api/admin/vip-payments/${paymentId}/reject`, { reason: 'Payment verification failed' });
      toast.success('Payment Rejected');
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    } finally {
      setProcessing(null);
    }
  };

  // Generic Approve/Reject for Bills, Gifts, Luxury
  const handleGenericApprove = async (type, id) => {
    setProcessing(id);
    try {
      const endpoints = {
        bill: `/api/admin/bill-payments/${id}/approve`,
        gift: `/api/admin/gift-vouchers/${id}/approve`,
        luxury: `/api/admin/luxury-claims/${id}/approve`
      };
      await axios.post(`${API}${endpoints[type]}`);
      toast.success('Approved!');
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    } finally {
      setProcessing(null);
    }
  };

  const handleGenericReject = async (type, id) => {
    if (!confirm('Reject this request?')) return;
    setProcessing(id);
    try {
      const endpoints = {
        bill: `/api/admin/bill-payments/${id}/reject`,
        gift: `/api/admin/gift-vouchers/${id}/reject`,
        luxury: `/api/admin/luxury-claims/${id}/reject`
      };
      await axios.post(`${API}${endpoints[type]}`, { reason: 'Request rejected by admin' });
      toast.success('Rejected');
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    } finally {
      setProcessing(null);
    }
  };

  const totalPending = counts.kyc + counts.subscription + counts.bills + counts.gifts + counts.luxury;

  const tabs = [
    { id: 'kyc', label: 'KYC', icon: Shield, count: counts.kyc, color: 'blue' },
    { id: 'subscription', label: 'Subscriptions', icon: Crown, count: counts.subscription, color: 'amber' },
    { id: 'bills', label: 'Bill Payments', icon: CreditCard, count: counts.bills, color: 'emerald' },
    { id: 'gifts', label: 'Gift Vouchers', icon: Gift, count: counts.gifts, color: 'purple' },
    { id: 'luxury', label: 'Luxury Claims', icon: Gem, count: counts.luxury, color: 'pink' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-2" />
          <p className="text-gray-400">Loading approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Approval Hub</h1>
          <p className="text-gray-400 text-sm">
            {totalPending} pending approvals
          </p>
        </div>
        <Button onClick={fetchAllData} variant="outline" size="sm" className="border-gray-700">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const colorClasses = {
            blue: isActive ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700',
            amber: isActive ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700',
            emerald: isActive ? 'bg-emerald-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700',
            purple: isActive ? 'bg-purple-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700',
            pink: isActive ? 'bg-pink-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          };
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${colorClasses[tab.color]}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  isActive ? 'bg-white/20' : 'bg-red-500 text-white'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input
          placeholder="Search by name, email, ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-gray-900 border-gray-800 text-white"
        />
      </div>

      {/* Content Area */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        {/* KYC Tab */}
        {activeTab === 'kyc' && (
          <div className="divide-y divide-gray-800">
            {kycPending.length === 0 ? (
              <EmptyState icon={Shield} message="No pending KYC verifications" />
            ) : (
              kycPending.filter(filterBySearch).map((user) => (
                <ApprovalRow
                  key={user.uid}
                  avatar={user.name?.charAt(0) || 'U'}
                  title={user.name || 'Unknown'}
                  subtitle={user.email || user.mobile}
                  badge="KYC"
                  badgeColor="blue"
                  info={`UID: ${user.uid}`}
                  onApprove={() => handleKycApprove(user.uid)}
                  onReject={() => handleKycReject(user.uid)}
                  processing={processing === user.uid}
                  documents={user.kyc_documents}
                />
              ))
            )}
          </div>
        )}

        {/* Subscription Tab */}
        {activeTab === 'subscription' && (
          <div className="divide-y divide-gray-800">
            {subscriptionPending.length === 0 ? (
              <EmptyState icon={Crown} message="No pending subscriptions" />
            ) : (
              subscriptionPending.filter(filterBySearch).map((payment) => (
                <ApprovalRow
                  key={payment.payment_id}
                  avatar={payment.user_name?.charAt(0) || 'U'}
                  title={payment.user_name || 'Unknown'}
                  subtitle={payment.user_email}
                  badge={payment.plan?.toUpperCase()}
                  badgeColor="amber"
                  info={`₹${payment.amount} • UTR: ${payment.utr_number || 'N/A'}`}
                  onApprove={() => handleSubApprove(payment.payment_id)}
                  onReject={() => handleSubReject(payment.payment_id)}
                  processing={processing === payment.payment_id}
                  screenshot={payment.screenshot_url}
                />
              ))
            )}
          </div>
        )}

        {/* Bill Payments Tab */}
        {activeTab === 'bills' && (
          <div className="divide-y divide-gray-800">
            {billPayments.length === 0 ? (
              <EmptyState icon={CreditCard} message="No pending bill payments" />
            ) : (
              billPayments.filter(filterBySearch).map((bill) => (
                <ApprovalRow
                  key={bill.payment_id || bill._id}
                  avatar={bill.user_name?.charAt(0) || 'B'}
                  title={bill.user_name || bill.biller_name || 'Bill Payment'}
                  subtitle={bill.user_email || bill.consumer_number}
                  badge={bill.category || 'BILL'}
                  badgeColor="emerald"
                  info={`₹${bill.amount} • ${bill.biller_name || ''}`}
                  onApprove={() => handleGenericApprove('bill', bill.payment_id || bill._id)}
                  onReject={() => handleGenericReject('bill', bill.payment_id || bill._id)}
                  processing={processing === (bill.payment_id || bill._id)}
                />
              ))
            )}
          </div>
        )}

        {/* Gift Vouchers Tab */}
        {activeTab === 'gifts' && (
          <div className="divide-y divide-gray-800">
            {giftVouchers.length === 0 ? (
              <EmptyState icon={Gift} message="No pending gift vouchers" />
            ) : (
              giftVouchers.filter(filterBySearch).map((gift) => (
                <ApprovalRow
                  key={gift.request_id || gift._id}
                  avatar={gift.user_name?.charAt(0) || 'G'}
                  title={gift.user_name || 'Gift Request'}
                  subtitle={gift.user_email || gift.voucher_type}
                  badge={gift.voucher_type || 'GIFT'}
                  badgeColor="purple"
                  info={`₹${gift.amount || gift.value} • ${gift.brand || ''}`}
                  onApprove={() => handleGenericApprove('gift', gift.request_id || gift._id)}
                  onReject={() => handleGenericReject('gift', gift.request_id || gift._id)}
                  processing={processing === (gift.request_id || gift._id)}
                />
              ))
            )}
          </div>
        )}

        {/* Luxury Claims Tab */}
        {activeTab === 'luxury' && (
          <div className="divide-y divide-gray-800">
            {luxuryClaims.length === 0 ? (
              <EmptyState icon={Gem} message="No pending luxury claims" />
            ) : (
              luxuryClaims.filter(filterBySearch).map((claim) => (
                <ApprovalRow
                  key={claim.claim_id || claim._id}
                  avatar={claim.user_name?.charAt(0) || 'L'}
                  title={claim.user_name || 'Luxury Claim'}
                  subtitle={claim.user_email || claim.item_name}
                  badge={claim.category || 'LUXURY'}
                  badgeColor="pink"
                  info={`${claim.item_name || claim.product} • ${claim.prc_value || ''} PRC`}
                  onApprove={() => handleGenericApprove('luxury', claim.claim_id || claim._id)}
                  onReject={() => handleGenericReject('luxury', claim.claim_id || claim._id)}
                  processing={processing === (claim.claim_id || claim._id)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );

  function filterBySearch(item) {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const searchableFields = [
      item.name, item.user_name, item.email, item.user_email,
      item.uid, item.payment_id, item.utr_number, item.mobile
    ];
    return searchableFields.some(field => 
      field?.toString().toLowerCase().includes(query)
    );
  }
};

// Empty State Component
const EmptyState = ({ icon: Icon, message }) => (
  <div className="p-12 text-center">
    <Icon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
    <p className="text-gray-400">{message}</p>
    <p className="text-gray-500 text-sm">All caught up! ✨</p>
  </div>
);

// Approval Row Component
const ApprovalRow = ({ 
  avatar, title, subtitle, badge, badgeColor, info, 
  onApprove, onReject, processing, documents, screenshot 
}) => {
  const badgeColors = {
    blue: 'bg-blue-500/20 text-blue-400',
    amber: 'bg-amber-500/20 text-amber-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    purple: 'bg-purple-500/20 text-purple-400',
    pink: 'bg-pink-500/20 text-pink-400'
  };

  const avatarColors = {
    blue: 'from-blue-500 to-indigo-600',
    amber: 'from-amber-500 to-orange-600',
    emerald: 'from-emerald-500 to-teal-600',
    purple: 'from-purple-500 to-pink-600',
    pink: 'from-pink-500 to-rose-600'
  };

  return (
    <div className="p-4 hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarColors[badgeColor]} flex items-center justify-center text-white font-bold text-lg`}>
          {avatar}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-white font-medium truncate">{title}</p>
            <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${badgeColors[badgeColor]}`}>
              {badge}
            </span>
          </div>
          <p className="text-gray-500 text-sm truncate">{subtitle}</p>
          <p className="text-gray-600 text-xs mt-1">{info}</p>
        </div>

        {/* Documents/Screenshot */}
        <div className="flex items-center gap-2">
          {documents && Object.keys(documents).length > 0 && (
            <a 
              href={documents.aadhaar_front || documents.pan_card || Object.values(documents)[0]}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors"
              title="View Documents"
            >
              <FileText className="w-4 h-4" />
            </a>
          )}
          {screenshot && (
            <a 
              href={screenshot}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors"
              title="View Screenshot"
            >
              <Image className="w-4 h-4" />
            </a>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={onApprove}
            disabled={processing}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white h-10 px-4"
          >
            {processing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-1" />
                Approve
              </>
            )}
          </Button>
          <Button
            onClick={onReject}
            disabled={processing}
            size="sm"
            variant="outline"
            className="border-red-500/50 text-red-400 hover:bg-red-500/10 h-10 px-4"
          >
            <XCircle className="w-4 h-4 mr-1" />
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminApprovalHub;
