import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  ArrowLeft, Smartphone, Tv, Zap, Flame, Building, Banknote,
  CheckCircle, Clock, XCircle, AlertCircle, Info, ChevronRight,
  Wallet, Receipt, Loader2, RefreshCw
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Service configurations with icons and colors
const SERVICE_CONFIG = {
  mobile_recharge: { 
    name: 'Mobile Recharge', 
    icon: Smartphone, 
    color: 'blue',
    gradient: 'from-blue-500 to-cyan-500',
    fields: ['mobile_number', 'operator', 'circle', 'recharge_type']
  },
  dth: { 
    name: 'DTH Recharge', 
    icon: Tv, 
    color: 'purple',
    gradient: 'from-purple-500 to-pink-500',
    fields: ['consumer_number', 'operator']
  },
  electricity: { 
    name: 'Electricity', 
    icon: Zap, 
    color: 'yellow',
    gradient: 'from-yellow-500 to-orange-500',
    fields: ['consumer_number', 'operator']
  },
  gas: { 
    name: 'Gas Bill', 
    icon: Flame, 
    color: 'orange',
    gradient: 'from-orange-500 to-red-500',
    fields: ['consumer_number', 'operator']
  },
  emi: { 
    name: 'EMI Payment', 
    icon: Building, 
    color: 'red',
    gradient: 'from-red-500 to-rose-500',
    fields: ['loan_account', 'bank_name', 'ifsc_code', 'borrower_name', 'mobile', 'loan_type', 'emi_amount']
  },
  dmt: { 
    name: 'Bank Transfer', 
    icon: Banknote, 
    color: 'green',
    gradient: 'from-green-500 to-emerald-500',
    fields: ['account_number', 'ifsc_code', 'account_holder', 'mobile']
  }
};

// Static operator data (will be replaced with Eko API data)
const OPERATORS = {
  mobile_recharge: [
    { id: 'JIO', name: 'Jio' },
    { id: 'AIRTEL', name: 'Airtel' },
    { id: 'VI', name: 'Vi (Vodafone Idea)' },
    { id: 'BSNL', name: 'BSNL' }
  ],
  dth: [
    { id: 'TATA_PLAY', name: 'Tata Play' },
    { id: 'AIRTEL_DTH', name: 'Airtel Digital TV' },
    { id: 'DISH_TV', name: 'Dish TV' },
    { id: 'D2H', name: 'D2H' },
    { id: 'SUN_DIRECT', name: 'Sun Direct' }
  ],
  electricity: [],
  gas: [],
  emi: [],
  dmt: []
};

const CIRCLES = [
  { id: 'ALL', name: 'All India' },
  { id: 'MH', name: 'Maharashtra' },
  { id: 'DL', name: 'Delhi NCR' },
  { id: 'KA', name: 'Karnataka' },
  { id: 'TN', name: 'Tamil Nadu' },
  { id: 'GJ', name: 'Gujarat' },
  { id: 'UP_E', name: 'UP East' },
  { id: 'UP_W', name: 'UP West' },
  { id: 'WB', name: 'West Bengal' },
  { id: 'RJ', name: 'Rajasthan' },
  { id: 'PB', name: 'Punjab' },
  { id: 'HR', name: 'Haryana' },
  { id: 'MP', name: 'Madhya Pradesh' },
  { id: 'BH', name: 'Bihar' },
  { id: 'KL', name: 'Kerala' },
  { id: 'AP', name: 'Andhra Pradesh' },
  { id: 'TS', name: 'Telangana' },
  { id: 'OR', name: 'Odisha' },
  { id: 'AS', name: 'Assam' },
  { id: 'JK', name: 'Jammu & Kashmir' },
  { id: 'HP', name: 'Himachal Pradesh' },
  { id: 'UK', name: 'Uttarakhand' },
  { id: 'JH', name: 'Jharkhand' },
  { id: 'CG', name: 'Chhattisgarh' },
  { id: 'NE', name: 'North East' },
  { id: 'GA', name: 'Goa' }
];

const RedeemPageV2 = ({ user }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // States
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userData, setUserData] = useState(null);
  const [selectedService, setSelectedService] = useState(searchParams.get('service') || 'mobile_recharge');
  const [requests, setRequests] = useState([]);
  const [operators, setOperators] = useState({});
  const [loadingOperators, setLoadingOperators] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    amount: '',
    mobile_number: '',
    operator: '',
    circle: '',
    recharge_type: 'prepaid',
    consumer_number: '',
    loan_account: '',
    bank_name: '',
    ifsc_code: '',
    borrower_name: '',
    mobile: '',
    loan_type: '',
    emi_amount: '',
    account_number: '',
    account_holder: ''
  });
  
  // Charges calculation
  const [charges, setCharges] = useState(null);
  
  // Check subscription and KYC
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    const validPlans = ['startup', 'growth', 'elite'];
    const userPlan = (user.subscription_plan || '').toLowerCase();
    
    if (!validPlans.includes(userPlan)) {
      toast.error('Paid subscription required for Redeem services');
      setTimeout(() => navigate('/subscription'), 1500);
      return;
    }
    
    fetchUserData();
    fetchRequests();
  }, [user, navigate]);
  
  // Fetch operators when service changes
  useEffect(() => {
    fetchOperators(selectedService);
  }, [selectedService]);
  
  // Calculate charges when amount changes
  useEffect(() => {
    if (formData.amount && parseFloat(formData.amount) > 0) {
      calculateCharges(parseFloat(formData.amount));
    } else {
      setCharges(null);
    }
  }, [formData.amount]);
  
  const fetchUserData = async () => {
    try {
      const response = await axios.get(`${API}/auth/user/${user.uid}`);
      setUserData(response.data);
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };
  
  const fetchRequests = async () => {
    try {
      const response = await axios.get(`${API}/redeem/user/${user.uid}/requests?limit=10`);
      setRequests(response.data.requests || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };
  
  const fetchOperators = async (serviceType) => {
    // Map service types to Eko categories
    const categoryMap = {
      mobile_recharge: 'mobile_prepaid',
      dth: 'dth',
      electricity: 'electricity',
      gas: 'gas',
      emi: 'loan_emi'
    };
    
    const category = categoryMap[serviceType];
    if (!category) return;
    
    setLoadingOperators(true);
    try {
      const response = await axios.get(`${API}/eko/bbps/operators/${category}`);
      if (response.data.operators) {
        setOperators(prev => ({
          ...prev,
          [serviceType]: response.data.operators
        }));
      }
    } catch (error) {
      console.error('Error fetching operators:', error);
      // Use fallback operators
      setOperators(prev => ({
        ...prev,
        [serviceType]: OPERATORS[serviceType] || []
      }));
    } finally {
      setLoadingOperators(false);
    }
  };
  
  const calculateCharges = async (amount) => {
    try {
      const response = await axios.get(`${API}/redeem/calculate-charges?amount=${amount}`);
      setCharges(response.data.charges);
    } catch (error) {
      console.error('Error calculating charges:', error);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    // Validate based on service type
    const config = SERVICE_CONFIG[selectedService];
    const details = {};
    
    for (const field of config.fields) {
      if (formData[field]) {
        details[field] = formData[field];
      }
    }
    
    // Check PRC balance
    if (charges && userData) {
      if (userData.prc_balance < charges.total_prc_required) {
        toast.error(`Insufficient PRC balance. Required: ${charges.total_prc_required} PRC`);
        return;
      }
    }
    
    setSubmitting(true);
    try {
      const response = await axios.post(`${API}/redeem/request`, {
        user_id: user.uid,
        service_type: selectedService,
        amount: parseFloat(formData.amount),
        details
      });
      
      toast.success(response.data.message || 'Request submitted successfully!');
      
      // Reset form
      setFormData({
        amount: '',
        mobile_number: '',
        operator: '',
        circle: '',
        recharge_type: 'prepaid',
        consumer_number: '',
        loan_account: '',
        bank_name: '',
        ifsc_code: '',
        borrower_name: '',
        mobile: '',
        loan_type: '',
        emi_amount: '',
        account_number: '',
        account_holder: ''
      });
      setCharges(null);
      
      // Refresh data
      fetchUserData();
      fetchRequests();
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };
  
  const getStatusBadge = (status) => {
    const config = {
      pending: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
      approved: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: CheckCircle },
      processing: { color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: RefreshCw },
      completed: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
      failed: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
      rejected: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle }
    };
    const c = config[status] || config.pending;
    const Icon = c.icon;
    
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.color}`}>
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };
  
  const currentConfig = SERVICE_CONFIG[selectedService];
  const currentOperators = operators[selectedService] || OPERATORS[selectedService] || [];
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 pb-24 pt-16">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>
      
      <div className="container mx-auto px-4 max-w-6xl pt-4 relative z-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 flex items-center justify-center hover:border-amber-500/50 transition-all"
            data-testid="redeem-back-btn"
          >
            <ArrowLeft className="h-5 w-5 text-gray-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-amber-100 to-amber-200 bg-clip-text text-transparent">
              Redeem PRC
            </h1>
            <p className="text-gray-400 text-sm">Pay bills & recharge using your PRC balance</p>
          </div>
          {/* Balance */}
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl">
            <Wallet className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-[10px] text-amber-300/70 uppercase">Balance</p>
              <p className="text-sm font-bold text-amber-400">{(userData?.prc_balance || 0).toLocaleString()} PRC</p>
            </div>
          </div>
        </div>
        
        {/* KYC Warning */}
        {userData && userData.kyc_status !== 'verified' && (
          <div className="mb-6 p-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-2xl">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-orange-400" />
              <div className="flex-1">
                <p className="text-orange-400 font-semibold">KYC Required</p>
                <p className="text-orange-300/70 text-sm">Complete KYC verification to use Redeem services</p>
              </div>
              <Button onClick={() => navigate('/kyc')} className="bg-orange-500 hover:bg-orange-600 text-black">
                Complete KYC
              </Button>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Service Selection & Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Service Selection - PhonePe Style Grid */}
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl rounded-3xl p-6 border border-gray-800/50">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-white">Select Service</h2>
                  <p className="text-xs text-gray-500">Choose what you want to pay</p>
                </div>
                <Receipt className="h-6 w-6 text-amber-400" />
              </div>
              
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {Object.entries(SERVICE_CONFIG).map(([id, config]) => {
                  const Icon = config.icon;
                  const isSelected = selectedService === id;
                  
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedService(id)}
                      className={`relative p-4 rounded-2xl border-2 transition-all duration-300 ${
                        isSelected
                          ? `bg-gradient-to-br ${config.gradient} border-white/30 shadow-lg`
                          : 'bg-gray-800/30 border-gray-700/50 hover:border-gray-600'
                      }`}
                      data-testid={`service-${id}`}
                    >
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        </div>
                      )}
                      <div className={`w-10 h-10 mx-auto mb-2 rounded-xl flex items-center justify-center ${
                        isSelected ? 'bg-white/20' : 'bg-gray-700/50'
                      }`}>
                        <Icon className={`h-5 w-5 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                      </div>
                      <p className={`text-[10px] font-medium text-center leading-tight ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                        {config.name}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Form */}
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl rounded-3xl p-6 border border-gray-800/50">
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${currentConfig.gradient} flex items-center justify-center`}>
                  {currentConfig && <currentConfig.icon className="h-6 w-6 text-white" />}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{currentConfig?.name} Details</h2>
                  <p className="text-xs text-gray-500">Fill in the required information</p>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Amount */}
                <div>
                  <Label className="text-gray-300 text-sm mb-2 block">Amount (₹) *</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-amber-400">₹</span>
                    <Input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.00"
                      min="1"
                      className="pl-12 h-14 text-xl font-semibold bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                      data-testid="amount-input"
                    />
                  </div>
                  
                  {/* Charges Breakdown */}
                  {charges && (
                    <div className="mt-4 bg-gradient-to-br from-gray-800/50 to-gray-800/30 rounded-2xl p-4 border border-gray-700/50">
                      <div className="flex items-center gap-2 mb-3">
                        <Info className="h-4 w-4 text-amber-400" />
                        <p className="text-xs text-amber-300 font-semibold">Charge Breakdown</p>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Amount</span>
                          <span className="text-white">₹{charges.amount_inr} ({charges.amount_prc} PRC)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Platform Fee</span>
                          <span className="text-orange-400">+₹{charges.platform_fee_inr} ({charges.platform_fee_prc} PRC)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Admin Charges (20%)</span>
                          <span className="text-orange-400">+₹{charges.admin_charge_inr} ({charges.admin_charge_prc} PRC)</span>
                        </div>
                        <div className="flex justify-between pt-3 border-t border-gray-700">
                          <span className="text-amber-400 font-bold">Total</span>
                          <span className="text-xl font-bold text-amber-400">{charges.total_prc_required} PRC</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Mobile Recharge Fields */}
                {selectedService === 'mobile_recharge' && (
                  <>
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">Mobile Number *</Label>
                      <Input
                        type="tel"
                        value={formData.mobile_number}
                        onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        placeholder="10-digit mobile number"
                        maxLength={10}
                        className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                        data-testid="mobile-input"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-300 text-sm mb-2 block">
                          Operator *
                          {loadingOperators && <Loader2 className="inline h-3 w-3 ml-2 animate-spin" />}
                        </Label>
                        <select
                          value={formData.operator}
                          onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                          className="w-full h-12 px-4 bg-gray-800/50 border border-gray-700/50 text-white rounded-xl"
                          data-testid="operator-select"
                        >
                          <option value="">Select Operator ({currentOperators.length} available)</option>
                          {currentOperators.map((op, index) => (
                            <option key={op.operator_id || op.id || index} value={op.operator_id || op.id}>{op.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-gray-300 text-sm mb-2 block">Circle *</Label>
                        <select
                          value={formData.circle}
                          onChange={(e) => setFormData({ ...formData, circle: e.target.value })}
                          className="w-full h-12 px-4 bg-gray-800/50 border border-gray-700/50 text-white rounded-xl"
                          data-testid="circle-select"
                        >
                          <option value="">Select Circle</option>
                          {CIRCLES.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">Recharge Type</Label>
                      <div className="flex gap-3">
                        {['prepaid', 'postpaid'].map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setFormData({ ...formData, recharge_type: type })}
                            className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                              formData.recharge_type === type
                                ? 'bg-amber-500 text-black'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                          >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                
                {/* DTH Fields */}
                {selectedService === 'dth' && (
                  <>
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">Consumer/Customer ID *</Label>
                      <Input
                        value={formData.consumer_number}
                        onChange={(e) => setFormData({ ...formData, consumer_number: e.target.value })}
                        placeholder="Enter DTH Customer ID"
                        className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                        data-testid="consumer-input"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">
                        DTH Provider *
                        {loadingOperators && <Loader2 className="inline h-3 w-3 ml-2 animate-spin" />}
                      </Label>
                      <select
                        value={formData.operator}
                        onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                        className="w-full h-12 px-4 bg-gray-800/50 border border-gray-700/50 text-white rounded-xl"
                        data-testid="dth-operator-select"
                      >
                        <option value="">Select Provider ({currentOperators.length} available)</option>
                        {currentOperators.map((op, index) => (
                          <option key={op.operator_id || op.id || index} value={op.operator_id || op.id}>{op.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                
                {/* Electricity / Gas Fields */}
                {(selectedService === 'electricity' || selectedService === 'gas') && (
                  <>
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">Consumer Number *</Label>
                      <Input
                        value={formData.consumer_number}
                        onChange={(e) => setFormData({ ...formData, consumer_number: e.target.value })}
                        placeholder="Enter consumer number"
                        className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                        data-testid="consumer-input"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">
                        Provider *
                        {loadingOperators && <Loader2 className="inline h-3 w-3 ml-2 animate-spin" />}
                      </Label>
                      <select
                        value={formData.operator}
                        onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                        className="w-full h-12 px-4 bg-gray-800/50 border border-gray-700/50 text-white rounded-xl"
                        data-testid="provider-select"
                      >
                        <option value="">Select Provider ({currentOperators.length} available)</option>
                        {currentOperators.map((op, index) => (
                          <option key={op.operator_id || op.id || index} value={op.operator_id || op.id}>{op.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                
                {/* EMI Fields */}
                {selectedService === 'emi' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-300 text-sm mb-2 block">Bank/Lender Name *</Label>
                        <Input
                          value={formData.bank_name}
                          onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                          placeholder="e.g., HDFC Bank"
                          className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300 text-sm mb-2 block">Loan Account Number *</Label>
                        <Input
                          value={formData.loan_account}
                          onChange={(e) => setFormData({ ...formData, loan_account: e.target.value })}
                          placeholder="Loan account number"
                          className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-300 text-sm mb-2 block">IFSC Code *</Label>
                        <Input
                          value={formData.ifsc_code}
                          onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase() })}
                          placeholder="e.g., HDFC0001234"
                          maxLength={11}
                          className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl uppercase"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300 text-sm mb-2 block">Borrower Name *</Label>
                        <Input
                          value={formData.borrower_name}
                          onChange={(e) => setFormData({ ...formData, borrower_name: e.target.value })}
                          placeholder="Name as per bank records"
                          className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-300 text-sm mb-2 block">Registered Mobile *</Label>
                        <Input
                          type="tel"
                          value={formData.mobile}
                          onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                          placeholder="10-digit mobile"
                          maxLength={10}
                          className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300 text-sm mb-2 block">Loan Type *</Label>
                        <select
                          value={formData.loan_type}
                          onChange={(e) => setFormData({ ...formData, loan_type: e.target.value })}
                          className="w-full h-12 px-4 bg-gray-800/50 border border-gray-700/50 text-white rounded-xl"
                        >
                          <option value="">Select Loan Type</option>
                          <option value="home_loan">Home Loan</option>
                          <option value="personal_loan">Personal Loan</option>
                          <option value="car_loan">Car/Vehicle Loan</option>
                          <option value="education_loan">Education Loan</option>
                          <option value="gold_loan">Gold Loan</option>
                          <option value="business_loan">Business Loan</option>
                          <option value="two_wheeler">Two Wheeler Loan</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}
                
                {/* DMT (Bank Transfer) Fields */}
                {selectedService === 'dmt' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-300 text-sm mb-2 block">Account Holder Name *</Label>
                        <Input
                          value={formData.account_holder}
                          onChange={(e) => setFormData({ ...formData, account_holder: e.target.value })}
                          placeholder="Name as per bank"
                          className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300 text-sm mb-2 block">Account Number *</Label>
                        <Input
                          value={formData.account_number}
                          onChange={(e) => setFormData({ ...formData, account_number: e.target.value.replace(/\D/g, '') })}
                          placeholder="Bank account number"
                          className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-300 text-sm mb-2 block">IFSC Code *</Label>
                        <Input
                          value={formData.ifsc_code}
                          onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase() })}
                          placeholder="e.g., SBIN0001234"
                          maxLength={11}
                          className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl uppercase"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300 text-sm mb-2 block">Recipient Mobile *</Label>
                        <Input
                          type="tel"
                          value={formData.mobile}
                          onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                          placeholder="10-digit mobile"
                          maxLength={10}
                          className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                        />
                      </div>
                    </div>
                  </>
                )}
                
                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={submitting || !formData.amount || (userData?.kyc_status !== 'verified')}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:via-orange-400 hover:to-amber-400 text-gray-900 font-bold rounded-2xl"
                  data-testid="submit-redeem-btn"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>Submit Request</>
                  )}
                </Button>
                
                <p className="text-xs text-gray-500 text-center">
                  Admin will process your request within 24-48 hours
                </p>
              </form>
            </div>
          </div>
          
          {/* Right: Balance & Recent Requests */}
          <div className="space-y-6">
            {/* Balance Card */}
            <div className="bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-amber-600/20 rounded-3xl p-6 border border-amber-500/30">
              <div className="flex items-center gap-3 mb-4">
                <Wallet className="h-8 w-8 text-amber-400" />
                <div>
                  <p className="text-amber-300/70 text-xs uppercase">Available Balance</p>
                  <p className="text-3xl font-bold text-white">{(userData?.prc_balance || 0).toLocaleString()}</p>
                </div>
              </div>
              <p className="text-amber-300/70 text-xs">PRC (10 PRC = ₹1)</p>
            </div>
            
            {/* Charges Info */}
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-3xl p-6 border border-blue-500/20">
              <h3 className="font-bold text-blue-400 mb-3 flex items-center gap-2">
                <Info className="h-5 w-5" />
                Charges
              </h3>
              <ul className="text-xs text-blue-300 space-y-2">
                <li className="flex justify-between">
                  <span>Platform Fee</span>
                  <span className="font-semibold">₹10 (flat)</span>
                </li>
                <li className="flex justify-between">
                  <span>Admin Charges</span>
                  <span className="font-semibold">20% of amount</span>
                </li>
                <li className="flex justify-between border-t border-blue-500/20 pt-2 mt-2">
                  <span>PRC Rate</span>
                  <span className="font-semibold">10 PRC = ₹1</span>
                </li>
              </ul>
            </div>
            
            {/* Recent Requests */}
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 rounded-3xl p-6 border border-gray-800/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-gray-400" />
                  Recent Requests
                </h3>
                <button
                  onClick={() => navigate('/orders?tab=redeem')}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  View All <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              
              {requests.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No requests yet</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {requests.slice(0, 5).map(req => (
                    <div
                      key={req.request_id}
                      className="p-3 bg-gray-800/30 rounded-xl border border-gray-700/30"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium text-sm">{req.service_name}</span>
                        {getStatusBadge(req.status)}
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">{req.request_id}</span>
                        <span className="text-amber-400 font-semibold">₹{req.amount_inr}</span>
                      </div>
                      <p className="text-gray-600 text-[10px] mt-1">
                        {new Date(req.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* How It Works */}
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 rounded-3xl p-6 border border-gray-800/50">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Info className="h-5 w-5 text-green-400" />
                How It Works
              </h3>
              <ol className="text-sm text-gray-400 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center text-xs font-bold text-green-400 flex-shrink-0">1</span>
                  <span>Select service & enter details</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center text-xs font-bold text-green-400 flex-shrink-0">2</span>
                  <span>PRC deducted from your balance</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center text-xs font-bold text-green-400 flex-shrink-0">3</span>
                  <span>Admin approves & processes</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center text-xs font-bold text-green-400 flex-shrink-0">4</span>
                  <span>Transaction completed!</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RedeemPageV2;
