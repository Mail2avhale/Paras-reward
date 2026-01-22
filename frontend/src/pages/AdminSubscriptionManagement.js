import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Crown, CheckCircle, XCircle, Clock, Eye, RefreshCw, Settings,
  Users, TrendingUp, Zap, Rocket, Award, DollarSign, Calendar,
  Search, Filter, ChevronDown, AlertCircle, Bell, ArrowUpRight,
  ArrowDownRight, Edit2, Save, X
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminSubscriptionManagement = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    explorer: 0,
    startup: 0,
    growth: 0,
    elite: 0,
    pendingPayments: 0,
    monthlyRevenue: 0,
    expiringThisWeek: 0
  });
  
  // Payments
  const [payments, setPayments] = useState([]);
  const [paymentFilter, setPaymentFilter] = useState('pending');
  
  // Pricing
  const [pricing, setPricing] = useState({});
  const [editingPricing, setEditingPricing] = useState(false);
  const [pricingForm, setPricingForm] = useState({});
  
  // Users list
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState('all');
  
  // Selected payment for action
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [actionNotes, setActionNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  
  // Fraud prevention - Plan correction
  const [correctPlan, setCorrectPlan] = useState('');
  const [correctDuration, setCorrectDuration] = useState('');
  const [pricingReference, setPricingReference] = useState(null);
  const [showPlanCorrection, setShowPlanCorrection] = useState(false);
  
  // Manual subscription update
  const [editingUser, setEditingUser] = useState(null);
  const [manualSubForm, setManualSubForm] = useState({
    plan: 'explorer',
    days: 30,
    use_manual_expiry: false,
    manual_expiry_date: '',
    payment_method: 'admin_manual',
    payment_reference: '',
    amount_paid: 0,
    is_free: true,
    notes: ''
  });

  // Calculate expiry date from days
  const calculateExpiryDate = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const planIcons = {
    explorer: Users,
    startup: Rocket,
    growth: TrendingUp,
    elite: Crown
  };

  const planColors = {
    explorer: 'bg-gray-800/500',
    startup: 'bg-blue-500/10',
    growth: 'bg-emerald-500/10',
    elite: 'bg-amber-500/10'
  };

  useEffect(() => {
    // Wait for user to be loaded before checking role
    if (user === null || user === undefined) {
      return; // Still loading user
    }
    
    if (user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchAllData();
  }, [user, navigate]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchStats(),
      fetchPayments(),
      fetchPricing(),
      fetchUsers(),
      fetchPricingReference()
    ]);
    setLoading(false);
  };

  const fetchPricingReference = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/subscription-pricing-reference`);
      setPricingReference(response.data);
    } catch (error) {
      console.error('Error fetching pricing reference:', error);
    }
  };

  const fetchStats = async () => {
    try {
      // Get user counts by subscription plan
      const usersRes = await axios.get(`${API}/api/admin/users?limit=1000`);
      const allUsers = usersRes.data.users || usersRes.data || [];
      
      const planCounts = {
        explorer: 0,
        startup: 0,
        growth: 0,
        elite: 0
      };
      
      allUsers.forEach(u => {
        const plan = u.subscription_plan || 'explorer';
        if (planCounts[plan] !== undefined) {
          planCounts[plan]++;
        } else {
          planCounts.explorer++;
        }
      });
      
      // Get pending payments count
      const pendingRes = await axios.get(`${API}/api/admin/vip-payments?status=pending`);
      const pendingCount = Array.isArray(pendingRes.data) ? pendingRes.data.length : pendingRes.data.total || 0;
      
      setStats({
        totalUsers: allUsers.length,
        ...planCounts,
        pendingPayments: pendingCount,
        monthlyRevenue: (planCounts.startup * 299) + (planCounts.growth * 549) + (planCounts.elite * 799),
        expiringThisWeek: 0 // TODO: Calculate from subscription_expiry
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchPayments = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/vip-payments?status=${paymentFilter}`);
      setPayments(Array.isArray(response.data) ? response.data : response.data.payments || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  const fetchPricing = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/subscription/pricing`);
      setPricing(response.data.pricing || {});
      setPricingForm(response.data.pricing || {});
    } catch (error) {
      console.error('Error fetching pricing:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/users?limit=100`);
      setUsers(response.data.users || response.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  // Get expected plan from amount
  const getExpectedPlanFromAmount = (amount) => {
    if (!pricingReference?.amount_to_plan_map) return null;
    return pricingReference.amount_to_plan_map[String(amount)];
  };

  // Check if payment amount matches claimed plan
  const isPotentialFraud = (payment) => {
    const expected = getExpectedPlanFromAmount(payment.amount);
    if (!expected) return false;
    return expected.plan !== payment.subscription_plan || expected.duration !== payment.plan_type;
  };

  const handleApprovePayment = async (payment) => {
    try {
      setProcessing(true);
      
      // Build request with fraud prevention data
      const requestData = {
        notes: actionNotes,
        admin_id: user?.uid
      };
      
      // If plan correction is enabled, add corrected values
      if (showPlanCorrection && (correctPlan || correctDuration)) {
        requestData.correct_plan = correctPlan || payment.subscription_plan;
        requestData.correct_duration = correctDuration || payment.plan_type;
      }
      
      await axios.post(`${API}/api/admin/vip-payment/${payment.payment_id}/approve`, requestData);
      
      if (showPlanCorrection && (correctPlan || correctDuration)) {
        toast.success(`Payment approved with corrected plan: ${correctPlan || payment.subscription_plan} (${correctDuration || payment.plan_type})`);
      } else {
        toast.success('Payment approved! User subscription activated.');
      }
      
      // Reset state
      setSelectedPayment(null);
      setActionNotes('');
      setCorrectPlan('');
      setCorrectDuration('');
      setShowPlanCorrection(false);
      fetchPayments();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectPayment = async (payment) => {
    try {
      setProcessing(true);
      await axios.post(`${API}/api/admin/vip-payment/${payment.payment_id}/reject`, {
        notes: actionNotes
      });
      toast.success('Payment rejected');
      setSelectedPayment(null);
      setActionNotes('');
      setCorrectPlan('');
      setCorrectDuration('');
      setShowPlanCorrection(false);
      fetchPayments();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleSavePricing = async () => {
    try {
      setProcessing(true);
      await axios.post(`${API}/api/admin/subscription/pricing`, pricingForm);
      toast.success('Pricing updated successfully!');
      setPricing(pricingForm);
      setEditingPricing(false);
    } catch (error) {
      toast.error('Failed to update pricing');
    } finally {
      setProcessing(false);
    }
  };

  const handleRunBurnJob = async () => {
    try {
      setProcessing(true);
      const response = await axios.post(`${API}/api/admin/run-explorer-burn`);
      const result = response.data.result || {};
      toast.success(`Burn job complete: ${result.users_affected || 0} users, ${result.total_burned || 0} PRC burned`);
    } catch (error) {
      toast.error('Failed to run burn job');
    } finally {
      setProcessing(false);
    }
  };

  const handleManualSubscriptionUpdate = async () => {
    if (!editingUser) return;
    
    try {
      setProcessing(true);
      
      // Calculate expiry date
      const expiryDate = manualSubForm.use_manual_expiry 
        ? manualSubForm.manual_expiry_date 
        : calculateExpiryDate(manualSubForm.days);
      
      await axios.post(`${API}/api/admin/users/${editingUser.uid}/subscription`, {
        plan: manualSubForm.plan,
        days: manualSubForm.days,
        expiry_date: expiryDate,
        use_manual_expiry: manualSubForm.use_manual_expiry,
        payment_method: manualSubForm.is_free ? 'admin_free' : manualSubForm.payment_method,
        payment_reference: manualSubForm.payment_reference,
        amount_paid: manualSubForm.is_free ? 0 : manualSubForm.amount_paid,
        notes: manualSubForm.notes
      });
      
      toast.success(`Subscription updated for ${editingUser.name || editingUser.email}!`);
      setEditingUser(null);
      setManualSubForm({
        plan: 'explorer',
        days: 30,
        use_manual_expiry: false,
        manual_expiry_date: '',
        payment_method: 'admin_manual',
        payment_reference: '',
        amount_paid: 0,
        is_free: true,
        notes: ''
      });
      fetchUsers();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update subscription');
    } finally {
      setProcessing(false);
    }
  };

  const openEditSubscription = (userItem) => {
    // Calculate remaining days if user has active subscription
    let remainingDays = 30;
    if (userItem.subscription_expiry) {
      const expiry = new Date(userItem.subscription_expiry);
      const now = new Date();
      remainingDays = Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)));
    }
    
    setEditingUser(userItem);
    setManualSubForm({
      plan: userItem.subscription_plan || 'explorer',
      days: remainingDays > 0 ? remainingDays : 30,
      use_manual_expiry: false,
      manual_expiry_date: userItem.subscription_expiry ? userItem.subscription_expiry.split('T')[0] : calculateExpiryDate(30),
      payment_method: 'admin_manual',
      payment_reference: '',
      amount_paid: pricing[userItem.subscription_plan || 'explorer']?.monthly || 0,
      is_free: true,
      notes: ''
    });
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = !userSearch || 
      u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.name?.toLowerCase().includes(userSearch.toLowerCase());
    const matchesPlan = userPlanFilter === 'all' || (u.subscription_plan || 'explorer') === userPlanFilter;
    return matchesSearch && matchesPlan;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const handleCleanDatabase = async () => {
    if (!window.confirm('⚠️ WARNING: This will delete ALL users except admin!\n\nAre you sure?')) {
      return;
    }
    
    const confirmCode = window.prompt('Type "DELETE" to confirm:');
    if (confirmCode !== 'DELETE') {
      toast.error('Cleanup cancelled');
      return;
    }
    
    try {
      setProcessing(true);
      const response = await axios.post(`${API}/api/admin/database/cleanup`, {
        confirmation: 'CONFIRM_DELETE_ALL',
        keep_emails: ['admin@paras.com']
      });
      
      const deleted = response.data.deleted || {};
      toast.success(`Database cleaned! Deleted: ${deleted.users} users, ${deleted.transactions} transactions`);
      fetchAllData();
    } catch (error) {
      toast.error('Failed to clean database');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Subscription Management</h1>
          <p className="text-gray-400">Manage subscription plans, payments, and pricing</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleRunBurnJob}
            disabled={processing}
            className="border-red-500/50 text-red-400 hover:bg-red-500/10/10"
          >
            <Zap className="w-4 h-4 mr-2" />
            Run Explorer Burn
          </Button>
          <Button onClick={fetchAllData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">Explorer</p>
              <p className="text-xl font-bold text-white">{stats.explorer}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Rocket className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">Startup</p>
              <p className="text-xl font-bold text-white">{stats.startup}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">Growth</p>
              <p className="text-xl font-bold text-white">{stats.growth}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <Crown className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">Elite</p>
              <p className="text-xl font-bold text-white">{stats.elite}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">Pending</p>
              <p className="text-xl font-bold text-white">{stats.pendingPayments}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">Est. Monthly</p>
              <p className="text-xl font-bold text-white">₹{stats.monthlyRevenue.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        {['overview', 'payments', 'pricing', 'users'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === tab
                ? 'bg-amber-500/10 text-black'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Payments */}
          <Card className="p-6 bg-gray-900 border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Recent Payments</h3>
              <button onClick={() => setActiveTab('payments')} className="text-amber-500 text-sm hover:underline">
                View All →
              </button>
            </div>
            <div className="space-y-3">
              {payments.slice(0, 5).map((payment, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      payment.status === 'approved' ? 'bg-green-500/20' :
                      payment.status === 'rejected' ? 'bg-red-500/20' : 'bg-orange-500/20'
                    }`}>
                      {payment.status === 'approved' ? <CheckCircle className="w-4 h-4 text-green-500" /> :
                       payment.status === 'rejected' ? <XCircle className="w-4 h-4 text-red-500" /> :
                       <Clock className="w-4 h-4 text-orange-500" />}
                    </div>
                    <div>
                      <p className="text-white text-sm">{payment.user_id?.slice(0, 8)}...</p>
                      <p className="text-gray-500 text-xs">{payment.subscription_plan || payment.plan_type || 'VIP'}</p>
                    </div>
                  </div>
                  <p className="text-amber-500 font-semibold">₹{payment.amount}</p>
                </div>
              ))}
              {payments.length === 0 && (
                <p className="text-gray-500 text-center py-4">No payments found</p>
              )}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="p-6 bg-gray-900 border-gray-800">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button
                onClick={() => setActiveTab('pricing')}
                className="w-full p-4 bg-gray-800/50 rounded-lg flex items-center gap-3 hover:bg-gray-700/50 transition-all"
              >
                <Settings className="w-5 h-5 text-amber-500" />
                <div className="text-left">
                  <p className="text-white font-medium">Configure Pricing</p>
                  <p className="text-gray-500 text-sm">Update subscription plan prices</p>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className="w-full p-4 bg-gray-800/50 rounded-lg flex items-center gap-3 hover:bg-gray-700/50 transition-all"
              >
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div className="text-left">
                  <p className="text-white font-medium">Verify Payments</p>
                  <p className="text-gray-500 text-sm">{stats.pendingPayments} pending approvals</p>
                </div>
              </button>
              <button
                onClick={handleRunBurnJob}
                disabled={processing}
                className="w-full p-4 bg-gray-800/50 rounded-lg flex items-center gap-3 hover:bg-gray-700/50 transition-all"
              >
                <Zap className="w-5 h-5 text-red-500" />
                <div className="text-left">
                  <p className="text-white font-medium">Run Explorer Burn Job</p>
                  <p className="text-gray-500 text-sm">Burn inactive explorer PRC (2+ days)</p>
                </div>
              </button>
              <button
                onClick={handleCleanDatabase}
                disabled={processing}
                className="w-full p-4 bg-red-500/10/10 border border-red-500/30 rounded-lg flex items-center gap-3 hover:bg-red-500/20 transition-all"
              >
                <AlertCircle className="w-5 h-5 text-red-500" />
                <div className="text-left">
                  <p className="text-red-400 font-medium">🗑️ Clean Database</p>
                  <p className="text-gray-500 text-sm">Delete all test users (keeps admin only)</p>
                </div>
              </button>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'payments' && (
        <Card className="p-6 bg-gray-900 border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Payment Verification</h3>
            <div className="flex gap-2">
              {['pending', 'approved', 'rejected'].map(status => (
                <button
                  key={status}
                  onClick={() => { setPaymentFilter(status); fetchPayments(); }}
                  className={`px-3 py-1 rounded-full text-sm ${
                    paymentFilter === status
                      ? 'bg-amber-500/10 text-black'
                      : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {payments.map((payment, idx) => (
              <div key={idx} className="p-4 bg-gray-800/50 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      planColors[payment.subscription_plan] || 'bg-amber-500/10'
                    }/20`}>
                      {(() => {
                        const Icon = planIcons[payment.subscription_plan] || Crown;
                        return <Icon className={`w-5 h-5 text-${payment.subscription_plan === 'elite' ? 'amber' : payment.subscription_plan === 'growth' ? 'emerald' : 'blue'}-500`} />;
                      })()}
                    </div>
                    <div>
                      <p className="text-white font-medium">{payment.subscription_plan?.toUpperCase() || 'VIP'} - {payment.plan_type}</p>
                      <p className="text-purple-400 font-medium">{payment.user_name || 'Unknown User'}</p>
                      <p className="text-gray-400 text-sm">{payment.user_email || payment.user_id?.slice(0, 20)}</p>
                      {payment.user_phone && <p className="text-gray-500 text-xs">📱 {payment.user_phone}</p>}
                      <p className="text-gray-500 text-xs">UTR: {payment.utr_number}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-500 font-bold text-lg">₹{payment.amount}</p>
                    <p className="text-gray-500 text-xs">{new Date(payment.submitted_at || payment.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                {paymentFilter === 'pending' && (
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => setSelectedPayment(payment)}
                      variant="outline"
                      className="flex-1"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Review
                    </Button>
                    <Button
                      onClick={() => handleApprovePayment(payment)}
                      disabled={processing}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleRejectPayment(payment)}
                      disabled={processing}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {payments.length === 0 && (
              <p className="text-gray-500 text-center py-8">No {paymentFilter} payments</p>
            )}
          </div>
        </Card>
      )}

      {activeTab === 'pricing' && (
        <Card className="p-6 bg-gray-900 border-gray-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Subscription Pricing</h3>
            {!editingPricing ? (
              <Button onClick={() => setEditingPricing(true)} variant="outline">
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Pricing
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button onClick={() => { setEditingPricing(false); setPricingForm(pricing); }} variant="outline">
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSavePricing} disabled={processing} className="bg-amber-500/10 hover:bg-amber-600">
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {['startup', 'growth', 'elite'].map(plan => {
              const planPricing = editingPricing ? pricingForm[plan] || {} : pricing[plan] || {};
              return (
                <div key={plan} className={`p-6 rounded-xl border ${
                  plan === 'elite' ? 'bg-amber-500/10/10 border-amber-500/30' :
                  plan === 'growth' ? 'bg-emerald-500/10/10 border-emerald-500/30' :
                  'bg-blue-500/10/10 border-blue-500/30'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    {(() => {
                      const Icon = planIcons[plan];
                      return <Icon className={`w-6 h-6 ${
                        plan === 'elite' ? 'text-amber-500' :
                        plan === 'growth' ? 'text-emerald-500' : 'text-blue-500'
                      }`} />;
                    })()}
                    <h4 className="text-white font-bold text-lg">{plan.charAt(0).toUpperCase() + plan.slice(1)}</h4>
                  </div>
                  <div className="space-y-3">
                    {['monthly', 'quarterly', 'half_yearly', 'yearly'].map(duration => (
                      <div key={duration} className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">{duration.replace('_', ' ').charAt(0).toUpperCase() + duration.replace('_', ' ').slice(1)}</span>
                        {editingPricing ? (
                          <Input
                            type="number"
                            value={pricingForm[plan]?.[duration] || ''}
                            onChange={(e) => setPricingForm({
                              ...pricingForm,
                              [plan]: { ...pricingForm[plan], [duration]: parseFloat(e.target.value) || 0 }
                            })}
                            className="w-24 bg-gray-800 border-gray-700 text-white text-right"
                          />
                        ) : (
                          <span className="text-white font-medium">₹{planPricing[duration] || 0}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {activeTab === 'users' && (
        <Card className="p-6 bg-gray-900 border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Subscription Users</h3>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users..."
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <select
                value={userPlanFilter}
                onChange={(e) => setUserPlanFilter(e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              >
                <option value="all">All Plans</option>
                <option value="explorer">Explorer</option>
                <option value="startup">Startup</option>
                <option value="growth">Growth</option>
                <option value="elite">Elite</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-gray-400 text-sm border-b border-gray-800">
                  <th className="text-left py-3">User</th>
                  <th className="text-left py-3">Plan</th>
                  <th className="text-left py-3">Expiry</th>
                  <th className="text-left py-3">Status</th>
                  <th className="text-left py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.slice(0, 20).map((u, idx) => {
                  const plan = u.subscription_plan || 'explorer';
                  const expiry = u.subscription_expiry || u.vip_expiry;
                  const isExpired = expiry && new Date(expiry) < new Date();
                  
                  return (
                    <tr key={idx} className="border-b border-gray-800/50">
                      <td className="py-3">
                        <p className="text-white">{u.name || u.email}</p>
                        <p className="text-gray-500 text-xs">{u.email}</p>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          plan === 'elite' ? 'bg-amber-500/20 text-amber-400' :
                          plan === 'growth' ? 'bg-emerald-500/20 text-emerald-400' :
                          plan === 'startup' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-800/500/20 text-gray-400'
                        }`}>
                          {plan.charAt(0).toUpperCase() + plan.slice(1)}
                        </span>
                      </td>
                      <td className="py-3 text-gray-400 text-sm">
                        {expiry ? new Date(expiry).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-3">
                        {plan === 'explorer' ? (
                          <span className="text-gray-500 text-sm">Free</span>
                        ) : isExpired ? (
                          <span className="text-red-400 text-sm">Expired</span>
                        ) : (
                          <span className="text-green-400 text-sm">Active</span>
                        )}
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => openEditSubscription(u)}
                          className="px-3 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-lg hover:bg-purple-500/10/30 transition-colors"
                        >
                          <Edit2 className="w-3 h-3 inline mr-1" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Manual Subscription Update Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg p-6 bg-gray-900 border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Update Subscription</h3>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* User Info */}
            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <p className="text-white font-medium">{editingUser.name || 'User'}</p>
              <p className="text-gray-400 text-sm">{editingUser.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-gray-500 text-xs">Current Plan:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  editingUser.subscription_plan === 'elite' ? 'bg-amber-500/20 text-amber-400' :
                  editingUser.subscription_plan === 'growth' ? 'bg-emerald-500/20 text-emerald-400' :
                  editingUser.subscription_plan === 'startup' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-gray-700 text-gray-400'
                }`}>
                  {(editingUser.subscription_plan || 'explorer').charAt(0).toUpperCase() + (editingUser.subscription_plan || 'explorer').slice(1)}
                </span>
                {editingUser.subscription_expiry && (
                  <span className="text-gray-500 text-xs">
                    Expires: {new Date(editingUser.subscription_expiry).toLocaleDateString('en-IN')}
                  </span>
                )}
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Step 1: Select Plan */}
              <div>
                <label className="text-gray-400 text-sm block mb-2">Step 1: Select Plan</label>
                <div className="grid grid-cols-4 gap-2">
                  {['explorer', 'startup', 'growth', 'elite'].map(plan => (
                    <button
                      key={plan}
                      onClick={() => setManualSubForm({...manualSubForm, plan})}
                      className={`p-3 rounded-lg border text-xs font-medium transition-colors ${
                        manualSubForm.plan === plan 
                          ? plan === 'elite' ? 'bg-amber-500/20 border-amber-500 text-amber-400' :
                            plan === 'growth' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' :
                            plan === 'startup' ? 'bg-blue-500/20 border-blue-500 text-blue-400' :
                            'bg-gray-700 border-gray-600 text-gray-300'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {plan.charAt(0).toUpperCase() + plan.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Step 2: Set Duration / Days */}
              <div>
                <label className="text-gray-400 text-sm block mb-2">Step 2: Set Duration</label>
                
                {/* Quick Duration Buttons */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[
                    { days: 30, label: '30 Days' },
                    { days: 90, label: '90 Days' },
                    { days: 180, label: '180 Days' },
                    { days: 365, label: '1 Year' }
                  ].map(({ days, label }) => (
                    <button
                      key={days}
                      onClick={() => setManualSubForm({
                        ...manualSubForm, 
                        days, 
                        use_manual_expiry: false,
                        manual_expiry_date: calculateExpiryDate(days)
                      })}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        manualSubForm.days === days && !manualSubForm.use_manual_expiry
                          ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                
                {/* Custom Days Input */}
                <div className="flex gap-2 items-center mb-3">
                  <span className="text-gray-500 text-sm">Or enter days:</span>
                  <Input
                    type="number"
                    min="1"
                    max="3650"
                    value={manualSubForm.days}
                    onChange={(e) => {
                      const days = parseInt(e.target.value) || 30;
                      setManualSubForm({
                        ...manualSubForm, 
                        days,
                        use_manual_expiry: false,
                        manual_expiry_date: calculateExpiryDate(days)
                      });
                    }}
                    className="w-24 bg-gray-800 border-gray-700 text-white text-center"
                  />
                  <span className="text-gray-500 text-sm">days</span>
                </div>
              </div>
              
              {/* Step 3: Expiry Date */}
              <div>
                <label className="text-gray-400 text-sm block mb-2">Step 3: Expiry Date</label>
                
                {/* Auto Expiry (calculated) */}
                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={() => setManualSubForm({...manualSubForm, use_manual_expiry: false})}
                    className={`flex-1 p-3 rounded-lg border text-sm transition-colors ${
                      !manualSubForm.use_manual_expiry
                        ? 'bg-green-500/20 border-green-500 text-green-400'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>Auto: {calculateExpiryDate(manualSubForm.days)}</span>
                    </div>
                    <p className="text-xs opacity-70 mt-1">From today + {manualSubForm.days} days</p>
                  </button>
                  
                  <button
                    onClick={() => setManualSubForm({...manualSubForm, use_manual_expiry: true})}
                    className={`flex-1 p-3 rounded-lg border text-sm transition-colors ${
                      manualSubForm.use_manual_expiry
                        ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Edit2 className="w-4 h-4" />
                      <span>Manual Date</span>
                    </div>
                    <p className="text-xs opacity-70 mt-1">Set specific date</p>
                  </button>
                </div>
                
                {/* Manual Date Input */}
                {manualSubForm.use_manual_expiry && (
                  <Input
                    type="date"
                    value={manualSubForm.manual_expiry_date}
                    onChange={(e) => setManualSubForm({...manualSubForm, manual_expiry_date: e.target.value})}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-gray-800 border-gray-700 text-white"
                  />
                )}
              </div>
              
              {/* Free Subscription Toggle */}
              <div className="flex items-center justify-between bg-gray-800 p-3 rounded-lg">
                <div>
                  <p className="text-white text-sm">Free Subscription</p>
                  <p className="text-gray-500 text-xs">Grant without payment</p>
                </div>
                <button
                  onClick={() => setManualSubForm({...manualSubForm, is_free: !manualSubForm.is_free, amount_paid: 0})}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    manualSubForm.is_free ? 'bg-green-500/10' : 'bg-gray-700'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-gray-900 transition-transform ${
                    manualSubForm.is_free ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>
              
              {/* Payment Details (only if not free) */}
              {!manualSubForm.is_free && (
                <div className="space-y-3 p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-gray-400 text-sm font-medium">Payment Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-500 text-xs block mb-1">Method</label>
                      <select
                        value={manualSubForm.payment_method}
                        onChange={(e) => setManualSubForm({...manualSubForm, payment_method: e.target.value})}
                        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cheque">Cheque</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs block mb-1">Amount (₹)</label>
                      <Input
                        type="number"
                        value={manualSubForm.amount_paid}
                        onChange={(e) => setManualSubForm({...manualSubForm, amount_paid: parseFloat(e.target.value) || 0})}
                        className="bg-gray-800 border-gray-700 text-white h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs block mb-1">Reference / Transaction ID</label>
                    <Input
                      value={manualSubForm.payment_reference}
                      onChange={(e) => setManualSubForm({...manualSubForm, payment_reference: e.target.value})}
                      placeholder="e.g., UPI ID, Cheque No"
                      className="bg-gray-800 border-gray-700 text-white h-8 text-sm"
                    />
                  </div>
                </div>
              )}
              
              {/* Notes */}
              <div>
                <label className="text-gray-400 text-sm block mb-1">Admin Notes (Optional)</label>
                <textarea
                  value={manualSubForm.notes}
                  onChange={(e) => setManualSubForm({...manualSubForm, notes: e.target.value})}
                  placeholder="Notes about this subscription update..."
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm resize-none"
                />
              </div>
              
              {/* Summary */}
              <div className="bg-purple-500/10/10 border border-purple-500/30 rounded-lg p-4">
                <h4 className="text-purple-400 font-medium mb-2">Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">Plan</p>
                    <p className="text-white font-medium">{manualSubForm.plan.charAt(0).toUpperCase() + manualSubForm.plan.slice(1)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Duration</p>
                    <p className="text-white font-medium">{manualSubForm.days} days</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Expiry Date</p>
                    <p className="text-white font-medium">
                      {manualSubForm.use_manual_expiry 
                        ? new Date(manualSubForm.manual_expiry_date).toLocaleDateString('en-IN')
                        : new Date(calculateExpiryDate(manualSubForm.days)).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Amount</p>
                    <p className={`font-medium ${manualSubForm.is_free ? 'text-green-400' : 'text-amber-400'}`}>
                      {manualSubForm.is_free ? 'FREE' : `₹${manualSubForm.amount_paid}`}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => setEditingUser(null)}
                  variant="outline"
                  className="flex-1 bg-gray-800 border-gray-700 text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleManualSubscriptionUpdate}
                  disabled={processing}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  {processing ? 'Updating...' : 'Update Subscription'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Payment Review Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 bg-gray-900 border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Review Payment</h3>
              <button onClick={() => setSelectedPayment(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {/* User Information Section */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <h4 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" /> User Information
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Name</p>
                    <p className="text-white font-medium">{selectedPayment.user_name || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-white text-sm truncate">{selectedPayment.user_email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Mobile</p>
                    <p className="text-white">{selectedPayment.user_phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Location</p>
                    <p className="text-white">
                      {selectedPayment.user_city ? `${selectedPayment.user_city}, ${selectedPayment.user_state || ''}` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Current Plan</p>
                    <p className="text-amber-400 capitalize">{selectedPayment.current_plan || 'Explorer'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">User ID</p>
                    <p className="text-gray-400 text-xs truncate">{selectedPayment.user_id}</p>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 text-sm">Requested Plan</p>
                  <p className="text-white font-bold capitalize">{selectedPayment.subscription_plan || 'VIP'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Duration</p>
                  <p className="text-white">{selectedPayment.plan_type}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Amount Paid</p>
                  <p className="text-amber-500 font-bold text-lg">₹{selectedPayment.amount}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">UTR Number</p>
                  <p className="text-white font-mono">{selectedPayment.utr_number}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Payment Method</p>
                  <p className="text-white capitalize">{selectedPayment.payment_method || 'UPI'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Submitted</p>
                  <p className="text-white">{new Date(selectedPayment.submitted_at || selectedPayment.created_at).toLocaleString()}</p>
                </div>
              </div>
              
              {selectedPayment.screenshot_url && (
                <div>
                  <p className="text-gray-500 text-sm mb-2">Payment Screenshot</p>
                  <img 
                    src={selectedPayment.screenshot_url} 
                    alt="Payment Screenshot" 
                    className="w-full rounded-lg border border-gray-700"
                  />
                </div>
              )}

              {/* Fraud Detection Alert */}
              {isPotentialFraud(selectedPayment) && (
                <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-400 font-bold mb-2">
                    <AlertCircle className="w-5 h-5" />
                    ⚠️ Amount Mismatch Detected!
                  </div>
                  <div className="text-sm text-gray-300 space-y-1">
                    <p>
                      <span className="text-gray-500">Amount Paid:</span>{' '}
                      <span className="text-amber-400 font-bold">₹{selectedPayment.amount}</span>
                    </p>
                    <p>
                      <span className="text-gray-500">Expected Plan for ₹{selectedPayment.amount}:</span>{' '}
                      <span className="text-green-400 font-bold capitalize">
                        {getExpectedPlanFromAmount(selectedPayment.amount)?.plan || 'Unknown'} ({getExpectedPlanFromAmount(selectedPayment.amount)?.duration || 'Unknown'})
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-500">User Claimed:</span>{' '}
                      <span className="text-red-400 font-bold capitalize">
                        {selectedPayment.subscription_plan} ({selectedPayment.plan_type})
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* Plan Correction Section */}
              <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 text-blue-400 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPlanCorrection}
                      onChange={(e) => setShowPlanCorrection(e.target.checked)}
                      className="rounded border-gray-600"
                    />
                    Approve with Correct Plan (Fraud Prevention)
                  </label>
                </div>
                
                {showPlanCorrection && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Correct Plan</label>
                        <select
                          value={correctPlan}
                          onChange={(e) => setCorrectPlan(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                        >
                          <option value="">-- Select Plan --</option>
                          <option value="startup">Startup (₹299/mo)</option>
                          <option value="growth">Growth (₹549/mo)</option>
                          <option value="elite">Elite (₹799/mo)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Correct Duration</label>
                        <select
                          value={correctDuration}
                          onChange={(e) => setCorrectDuration(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                        >
                          <option value="">-- Select Duration --</option>
                          <option value="monthly">Monthly (30 days)</option>
                          <option value="quarterly">Quarterly (90 days)</option>
                          <option value="half_yearly">Half Yearly (180 days)</option>
                          <option value="yearly">Yearly (365 days)</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* Pricing Reference */}
                    <div className="bg-gray-800/50 rounded p-2 text-xs">
                      <p className="text-gray-400 mb-1">💡 Pricing Reference:</p>
                      <div className="grid grid-cols-3 gap-2 text-gray-300">
                        <span>₹299 = Startup</span>
                        <span>₹549 = Growth</span>
                        <span>₹799 = Elite</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className="text-gray-500 text-sm mb-2">Admin Notes (Optional)</p>
                <Input
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Add notes..."
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleApprovePayment(selectedPayment)}
                  disabled={processing}
                  className={`flex-1 ${showPlanCorrection && correctPlan ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {showPlanCorrection && correctPlan ? `Approve as ${correctPlan}` : 'Approve'}
                </Button>
                <Button
                  onClick={() => handleRejectPayment(selectedPayment)}
                  disabled={processing}
                  variant="destructive"
                  className="flex-1"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminSubscriptionManagement;
