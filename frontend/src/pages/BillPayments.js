import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  ArrowLeft, Smartphone, Tv, Zap, CreditCard, Building,
  Send, Clock, CheckCircle, XCircle, AlertCircle, Receipt, ChevronDown, ChevronUp, Info, ChevronRight
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import RequestTimeline from '../components/RequestTimeline';
import { RedemptionProfilePrompt } from '../components/ProfileCompletionComponents';
import { RequestJourney, LiveTimer, SpeedBadge } from '../components/BillPaymentJourney';
import { 
  formatMobile, formatIFSC, formatBankAccount,
  validateMobile, validateIFSC, validateBankAccount
} from '@/utils/indianValidation';
import { InfoTooltip } from '@/components/InfoTooltip';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BillPayments = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [currentUser, setCurrentUser] = useState(user);
  
  // Get service type from URL query param or default to mobile_recharge
  const initialType = searchParams.get('type') || 'mobile_recharge';
  const [selectedType, setSelectedType] = useState(initialType);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all'); // NEW: Status filter
  const [expandedRequest, setExpandedRequest] = useState(null); // For timeline expansion
  const itemsPerPage = 10;
  
  // Eko API loaded data
  const [ekoOperators, setEkoOperators] = useState([]);
  const [ekoCircles, setEkoCircles] = useState([]);
  const [ekoDthOperators, setEkoDthOperators] = useState([]);
  const [ekoPlans, setEkoPlans] = useState([]);
  const [loadingOperators, setLoadingOperators] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  
  const [formData, setFormData] = useState({
    amount_inr: '',
    phone_number: '',
    operator: '',
    recharge_type: '',  // prepaid or postpaid
    circle: '',         // telecom circle
    account_number: '',
    consumer_number: '',
    card_last4: '',
    cardholder_name: '',
    card_type: '',
    linked_mobile: '',  // Credit card linked mobile
    loan_account: '',
    borrower_name: '',
    loan_type: '',
    bank_name: '',
    bank_lender_name: '',  // Combined Bank/Lender Name
    biller_name: '',
    // Loan/EMI fields
    ifsc_code: '',
    registered_mobile: '',
    emi_due_date: '',
    customer_id: '',
    loan_tenure: '',
    emi_amount: '',
    // DMT Bank Transfer fields
    beneficiary_name: '',
    recipient_mobile: '',
    // Selected plan
    selected_plan: null
  });

  // ==================== EKO API DATA LOADING ====================
  
  // Load mobile operators from Eko API
  const fetchMobileOperators = async () => {
    try {
      setLoadingOperators(true);
      const response = await axios.get(`${API}/eko/recharge/operators`);
      if (response.data.operators?.length > 0) {
        setEkoOperators(response.data.operators);
      }
    } catch (error) {
      console.error('Error fetching operators:', error);
    } finally {
      setLoadingOperators(false);
    }
  };
  
  // Load circles from Eko API
  const fetchCircles = async () => {
    try {
      const response = await axios.get(`${API}/eko/recharge/circles`);
      if (response.data.circles?.length > 0) {
        setEkoCircles(response.data.circles);
      }
    } catch (error) {
      console.error('Error fetching circles:', error);
    }
  };
  
  // Load DTH operators from Eko API
  const fetchDthOperators = async () => {
    try {
      setLoadingOperators(true);
      const response = await axios.get(`${API}/eko/dth/operators`);
      if (response.data.operators?.length > 0) {
        setEkoDthOperators(response.data.operators);
      }
    } catch (error) {
      console.error('Error fetching DTH operators:', error);
    } finally {
      setLoadingOperators(false);
    }
  };
  
  // Load DTH plans from API
  const fetchDthPlans = async (operator) => {
    if (!operator) return;
    try {
      setLoadingPlans(true);
      const response = await axios.get(`${API}/eko/dth/plans/${operator}`);
      if (response.data.plans?.length > 0) {
        setEkoPlans(response.data.plans);
      }
    } catch (error) {
      console.error('Error fetching DTH plans:', error);
      setEkoPlans([]);
    } finally {
      setLoadingPlans(false);
    }
  };
  
  // Load recharge plans from Eko API
  const fetchRechargePlans = async (operator, circle) => {
    if (!operator || !circle) return;
    try {
      setLoadingPlans(true);
      const response = await axios.get(`${API}/eko/recharge/plans/${operator}/${circle}`);
      if (response.data.plans?.length > 0) {
        setEkoPlans(response.data.plans);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
      setEkoPlans([]);
    } finally {
      setLoadingPlans(false);
    }
  };
  
  // Load operators when service type changes
  useEffect(() => {
    if (selectedType === 'mobile_recharge') {
      fetchMobileOperators();
      fetchCircles();
    } else if (selectedType === 'dish_recharge') {
      fetchDthOperators();
    }
    // Reset plans when type changes
    setEkoPlans([]);
  }, [selectedType]);
  
  // Load plans when operator and circle are selected
  useEffect(() => {
    if (selectedType === 'mobile_recharge' && formData.operator && formData.circle) {
      fetchRechargePlans(formData.operator, formData.circle);
    } else if (selectedType === 'dish_recharge' && formData.operator) {
      // Fetch DTH plans when operator is selected
      fetchDthPlans(formData.operator.replace(/\s+/g, '_').toUpperCase());
    }
  }, [formData.operator, formData.circle, selectedType]);
  
  // Use Eko operators if available, else fallback to static
  const mobileOperators = ekoOperators.length > 0 ? ekoOperators : [
    { id: 'JIO', name: 'Jio' },
    { id: 'AIRTEL', name: 'Airtel' },
    { id: 'VI', name: 'Vi (Vodafone Idea)' },
    { id: 'BSNL', name: 'BSNL' }
  ];
  
  // Use Eko circles if available, else fallback to static
  const telecomCircles = ekoCircles.length > 0 ? ekoCircles : [
    { id: 'andhra_pradesh', name: 'Andhra Pradesh & Telangana' },
    { id: 'assam', name: 'Assam' },
    { id: 'bihar_jharkhand', name: 'Bihar & Jharkhand' },
    { id: 'chennai', name: 'Chennai' },
    { id: 'delhi', name: 'Delhi & NCR' },
    { id: 'gujarat', name: 'Gujarat' },
    { id: 'haryana', name: 'Haryana' },
    { id: 'himachal_pradesh', name: 'Himachal Pradesh' },
    { id: 'jammu_kashmir', name: 'Jammu & Kashmir' },
    { id: 'karnataka', name: 'Karnataka' },
    { id: 'kerala', name: 'Kerala' },
    { id: 'kolkata', name: 'Kolkata' },
    { id: 'madhya_pradesh', name: 'Madhya Pradesh & Chhattisgarh' },
    { id: 'maharashtra', name: 'Maharashtra & Goa' },
    { id: 'mumbai', name: 'Mumbai' },
    { id: 'north_east', name: 'North East' },
    { id: 'orissa', name: 'Odisha' },
    { id: 'punjab', name: 'Punjab' },
    { id: 'rajasthan', name: 'Rajasthan' },
    { id: 'tamil_nadu', name: 'Tamil Nadu' },
    { id: 'up_east', name: 'UP East' },
    { id: 'up_west', name: 'UP West & Uttarakhand' },
    { id: 'west_bengal', name: 'West Bengal' }
  ];

  // Update selected type when URL param changes
  useEffect(() => {
    const typeFromUrl = searchParams.get('type');
    if (typeFromUrl && ['mobile_recharge', 'dish_recharge', 'electricity_bill', 'credit_card_payment', 'loan_emi', 'bank_transfer'].includes(typeFromUrl)) {
      setSelectedType(typeFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    // Check subscription plan for bill payment access
    const isVipOrPaidSubscription = 
      ['startup', 'growth', 'elite'].includes(user.subscription_plan?.toLowerCase());
    
    if (!isVipOrPaidSubscription) {
      toast.error(t('paidSubscriptionRequiredBillPayments'), {
        duration: 4000,
        style: { fontSize: '16px', fontWeight: '500' }
      });
      setTimeout(() => navigate('/subscription'), 2000);
      return;
    }
    
    fetchUserData();
    fetchRequests();
  }, [user, navigate]);

  const fetchUserData = async () => {
    try {
      const response = await axios.get(`${API}/auth/user/${user.uid}`);
      setCurrentUser(response.data);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchRequests = async () => {
    try {
      const response = await axios.get(`${API}/bill-payment/requests/${user.uid}`);
      setRequests(response.data.requests || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const requestTypes = [
    { id: 'mobile_recharge', label: 'Mobile Recharge', icon: Smartphone, color: 'blue', fields: ['phone_number', 'recharge_type', 'operator', 'circle'] },
    { id: 'dish_recharge', label: 'DTH/Dish Recharge', icon: Tv, color: 'purple', fields: ['consumer_number', 'operator'] },
    { id: 'electricity_bill', label: 'Electricity Bill', icon: Zap, color: 'yellow', fields: ['consumer_number', 'biller_name'] },
    { id: 'bank_transfer', label: 'Bank Transfer', sublabel: 'Instant Money Transfer', icon: Building, color: 'emerald', fields: ['beneficiary_name', 'account_number', 'ifsc_code', 'recipient_mobile'] },
    { id: 'credit_card_payment', label: 'Credit Card', icon: CreditCard, color: 'green', fields: ['card_last4', 'cardholder_name', 'bank_name', 'linked_mobile', 'card_type'] },
    { id: 'loan_emi', label: 'Pay EMI', sublabel: 'Pay your existing loan EMIs', icon: Building, color: 'red', fields: ['loan_account', 'bank_lender_name', 'ifsc_code', 'borrower_name', 'registered_mobile', 'loan_type', 'emi_amount', 'emi_due_date'] }
  ];

  const currentType = requestTypes.find(t => t.id === selectedType);
  
  // New charge calculation: Amount + Processing Fee + 20% Admin
  const amountINR = formData.amount_inr ? parseFloat(formData.amount_inr) : 0;
  
  // EMI Special Processing Fee Logic:
  // - For loan_emi with amount <= 499: Processing Fee = 50% of amount
  // - For loan_emi with amount > 499: Flat ₹10
  // - For all other services: Flat ₹10
  let processingFeeINR = 10; // Default flat ₹10
  if (selectedType === 'loan_emi') {
    if (amountINR <= 499) {
      processingFeeINR = amountINR * 0.50; // 50% of amount
    } else {
      processingFeeINR = 10; // Flat ₹10 for amounts > 499
    }
  }
  
  const adminChargePercent = 20; // 20%
  const adminChargeINR = amountINR * (adminChargePercent / 100);
  const totalINR = amountINR + processingFeeINR + adminChargeINR;
  
  // Convert to PRC (10 PRC = ₹1)
  const prcRate = 10;
  const amountPRC = amountINR * prcRate;
  const processingFeePRC = processingFeeINR * prcRate;
  const adminChargePRC = adminChargeINR * prcRate;
  const totalPRC = totalINR * prcRate;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.amount_inr || parseFloat(formData.amount_inr) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    // Validate required fields
    const requiredFields = currentType.fields;
    for (const field of requiredFields) {
      if (!formData[field]) {
        toast.error(`Please enter ${field.replace('_', ' ')}`);
        return;
      }
    }

    // Check PRC balance
    if (currentUser.prc_balance < totalPRC) {
      toast.error(`Insufficient PRC balance. Required: ${totalPRC.toFixed(2)} PRC, Available: ${currentUser.prc_balance?.toFixed(2) || 0} PRC`);
      return;
    }

    setLoading(true);
    try {
      const details = {};
      currentType.fields.forEach(field => {
        details[field] = formData[field];
      });

      const response = await axios.post(`${API}/bill-payment/request`, {
        user_id: user.uid,
        request_type: selectedType,
        amount_inr: parseFloat(formData.amount_inr),
        details
      });

      // Different processing time for different request types
      const processingTimeMsg = selectedType === 'loan_emi' 
        ? '✅ EMI Payment Request Submitted!\n\nProcessing Time: 3 to 7 days. Your EMI will be paid after admin approval.'
        : '✅ Bill Payment Request Submitted!\n\nProcessing Time: 48 hours. You will receive a notification once completed.';
      
      toast.success(processingTimeMsg, {
        duration: 6000,
      });

      // Reset form
      setFormData({
        amount_inr: '',
        phone_number: '',
        operator: '',
        recharge_type: '',
        circle: '',
        account_number: '',
        consumer_number: '',
        card_last4: '',
        cardholder_name: '',
        card_type: '',
        linked_mobile: '',
        loan_account: '',
        borrower_name: '',
        loan_type: '',
        bank_name: '',
        biller_name: '',
        ifsc_code: '',
        registered_mobile: '',
        emi_due_date: '',
        customer_id: '',
        loan_tenure: '',
        emi_amount: ''
      });

      fetchRequests();
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error(error.response?.data?.detail || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
      processing: { color: 'bg-blue-100 text-blue-800', icon: AlertCircle, label: 'Approved' },
      approved: { color: 'bg-blue-100 text-blue-800', icon: AlertCircle, label: 'Approved' },
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Completed' },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rejected' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    );
  };

  const getTypeLabel = (type) => {
    const typeObj = requestTypes.find(t => t.id === type);
    return typeObj ? typeObj.label : type;
  };

  // Get color classes for service type
  const getServiceColor = (color, isSelected) => {
    const colors = {
      blue: isSelected ? 'from-blue-500 to-cyan-500 border-blue-400' : 'border-blue-500/30 hover:border-blue-500/60',
      purple: isSelected ? 'from-purple-500 to-pink-500 border-purple-400' : 'border-purple-500/30 hover:border-purple-500/60',
      yellow: isSelected ? 'from-yellow-500 to-orange-500 border-yellow-400' : 'border-yellow-500/30 hover:border-yellow-500/60',
      green: isSelected ? 'from-green-500 to-emerald-500 border-green-400' : 'border-green-500/30 hover:border-green-500/60',
      red: isSelected ? 'from-red-500 to-rose-500 border-red-400' : 'border-red-500/30 hover:border-red-500/60'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 pb-24 pt-16">
      {/* Animated Background Pattern */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="container mx-auto px-4 max-w-6xl pt-4 relative z-10" style={{ paddingBottom: '1.5rem' }}>
        {/* Premium Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 flex items-center justify-center hover:border-amber-500/50 transition-all group shadow-lg"
          >
            <ArrowLeft className="h-5 w-5 text-gray-400 group-hover:text-amber-400 transition-colors" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-amber-100 to-amber-200 bg-clip-text text-transparent">
              Bill Payments & Recharge
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">Pay bills instantly using your PRC balance</p>
          </div>
          {/* PRC Balance Badge */}
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
              <span className="text-white text-xs font-bold">₹</span>
            </div>
            <div>
              <p className="text-[10px] text-amber-300/70 uppercase tracking-wide">Balance</p>
              <p className="text-sm font-bold text-amber-400">{currentUser?.prc_balance?.toLocaleString() || 0} PRC</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Create Request Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Completion Prompt - Show before form */}
            <RedemptionProfilePrompt 
              user={user}
              userData={currentUser}
              onContinue={() => {}}
            />
            
            {/* AI Smart Tip for Bill Payments */}
            
            {/* Service Type Selection - Premium Cards */}
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl rounded-3xl p-6 border border-gray-800/50 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-white">Select Service</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Choose bill type to pay</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl flex items-center justify-center">
                  <Receipt className="h-5 w-5 text-amber-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {requestTypes.map((type) => {
                  const Icon = type.icon;
                  const isSelected = selectedType === type.id;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setSelectedType(type.id)}
                      className={`relative p-4 rounded-2xl border-2 transition-all duration-300 transform hover:scale-[1.02] ${
                        isSelected
                          ? `bg-gradient-to-br ${getServiceColor(type.color, true)} shadow-lg shadow-${type.color}-500/20`
                          : `bg-gray-800/30 ${getServiceColor(type.color, false)} hover:bg-gray-800/50`
                      }`}
                      data-testid={`service-${type.id}`}
                    >
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-lg">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        </div>
                      )}
                      <div className={`w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center ${
                        isSelected 
                          ? 'bg-white/20 backdrop-blur' 
                          : 'bg-gray-700/50'
                      }`}>
                        <Icon className={`h-6 w-6 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                      </div>
                      <p className={`text-xs font-semibold text-center ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                        {type.label}
                      </p>
                      {type.sublabel && (
                        <p className={`text-[9px] text-center mt-1 ${isSelected ? 'text-white/70' : 'text-gray-500'}`}>
                          {type.sublabel}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payment Form - Premium Card - All services use admin approval flow */}
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl rounded-3xl p-6 border border-gray-800/50 shadow-2xl">
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${getServiceColor(currentType?.color || 'blue', true)} flex items-center justify-center`}>
                  {currentType && <currentType.icon className="h-6 w-6 text-white" />}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{currentType?.label || 'Payment'} Details</h2>
                  <p className="text-xs text-gray-500">Fill in the payment information</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Amount Input - Premium Style */}
                <div className="relative">
                  <Label htmlFor="amount" className="text-gray-300 text-sm font-medium mb-2 block">Amount (₹) *</Label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-amber-400">₹</div>
                    <Input
                      id="amount"
                      type="number"
                      value={formData.amount_inr}
                      onChange={(e) => setFormData({ ...formData, amount_inr: e.target.value })}
                      placeholder="0.00"
                      min="1"
                      step="0.01"
                      required
                      className="pl-12 h-14 text-xl font-semibold bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-amber-500 focus:ring-amber-500/20"
                    />
                  </div>
                  
                  {/* Charge Breakdown - Premium */}
                  {formData.amount_inr && amountINR > 0 && (
                    <div className="mt-4 bg-gradient-to-br from-gray-800/50 to-gray-800/30 rounded-2xl p-4 border border-gray-700/50">
                      <div className="flex items-center gap-2 mb-3">
                        <Info className="h-4 w-4 text-amber-400" />
                        <p className="text-xs text-amber-300 font-semibold">Charge Breakdown</p>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Bill Amount</span>
                          <div className="text-right">
                            <span className="text-white font-medium">₹{amountINR.toFixed(2)}</span>
                            <span className="text-gray-500 text-xs ml-2">({amountPRC.toFixed(0)} PRC)</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Processing Fee</span>
                          <div className="text-right">
                            <span className="text-orange-400 font-medium">+₹{processingFeeINR.toFixed(2)}</span>
                            <span className="text-gray-500 text-xs ml-2">({processingFeePRC.toFixed(0)} PRC)</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Admin Charges ({adminChargePercent}%)</span>
                          <div className="text-right">
                            <span className="text-orange-400 font-medium">+₹{adminChargeINR.toFixed(2)}</span>
                            <span className="text-gray-500 text-xs ml-2">({adminChargePRC.toFixed(0)} PRC)</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-gray-700">
                          <span className="text-amber-400 font-bold">Total to Pay</span>
                          <div className="text-right">
                            <span className="text-xl font-bold text-amber-400">₹{totalINR.toFixed(2)}</span>
                            <span className="text-amber-300/70 text-sm ml-2">= {totalPRC.toFixed(0)} PRC</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Dynamic Fields Based on Service Type */}
                {currentType?.fields.includes('phone_number') && (
                  <div>
                    <Label htmlFor="phone" className="text-gray-300 text-sm font-medium mb-2 block">Mobile Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: formatMobile(e.target.value) })}
                      placeholder="10-digit mobile number"
                      maxLength={10}
                      required
                      className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-amber-500"
                    />
                    {formData.phone_number && formData.phone_number.length > 0 && !validateMobile(formData.phone_number).isValid && (
                      <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Enter valid 10-digit mobile (starts with 6-9)
                      </p>
                    )}
                  </div>
                )}

                {currentType?.fields.includes('consumer_number') && (
                  <div>
                    <Label htmlFor="consumer" className="text-white text-sm font-medium mb-2 block">Consumer Number *</Label>
                    <Input
                      id="consumer"
                      value={formData.consumer_number}
                      onChange={(e) => setFormData({ ...formData, consumer_number: e.target.value })}
                      placeholder="Enter consumer number"
                      required
                      className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-amber-500"
                    />
                  </div>
                )}

                {currentType?.fields.includes('card_last4') && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="card_last4" className="text-white text-sm font-medium mb-2 block">Card Number (Last 4 digits) *</Label>
                        <Input
                          id="card_last4"
                          value={formData.card_last4}
                          onChange={(e) => setFormData({ ...formData, card_last4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                          placeholder="XXXX"
                          maxLength={4}
                          required
                          className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="cardholder_name" className="text-white text-sm font-medium mb-2 block">Cardholder Name *</Label>
                        <Input
                          id="cardholder_name"
                          value={formData.cardholder_name}
                          onChange={(e) => setFormData({ ...formData, cardholder_name: e.target.value })}
                          placeholder="Name on card"
                          required
                          className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-amber-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="bank_name" className="text-white text-sm font-medium mb-2 block">Issuing Bank *</Label>
                        <Input
                          id="bank_name"
                          value={formData.bank_name}
                          onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                          placeholder="e.g., HDFC Bank, SBI, ICICI"
                          required
                          className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="linked_mobile" className="text-white text-sm font-medium mb-2 block">Linked Mobile Number *</Label>
                        <Input
                          id="linked_mobile"
                          type="tel"
                          value={formData.linked_mobile}
                          onChange={(e) => setFormData({ ...formData, linked_mobile: formatMobile(e.target.value) })}
                          placeholder="10-digit mobile number"
                          maxLength={10}
                          required
                          className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-amber-500"
                        />
                        {formData.linked_mobile && formData.linked_mobile.length > 0 && !validateMobile(formData.linked_mobile).isValid && (
                          <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Enter valid 10-digit mobile (starts with 6-9)
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="card_type" className="text-white text-sm font-medium mb-2 block">Card Type *</Label>
                      <select
                        id="card_type"
                        value={formData.card_type}
                        onChange={(e) => setFormData({ ...formData, card_type: e.target.value })}
                        className="w-full h-12 px-4 border border-gray-700/50 rounded-xl bg-gray-800/50 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        required
                      >
                        <option value="">Select card type</option>
                        <option value="visa">Visa</option>
                        <option value="mastercard">Mastercard</option>
                        <option value="rupay">RuPay</option>
                        <option value="amex">American Express</option>
                      </select>
                    </div>
                  </>
                )}

                {currentType?.fields.includes('loan_account') && (
                  <>
                    {/* Row 1: Loan Account & Bank/Lender Name */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="loan_account" className="text-white text-sm font-medium mb-2 block">Loan Account Number *</Label>
                        <Input
                          id="loan_account"
                          value={formData.loan_account}
                          onChange={(e) => setFormData({ ...formData, loan_account: e.target.value })}
                          placeholder="Enter loan account number"
                          required
                          className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="bank_lender_name" className="text-white text-sm font-medium mb-2 block">Bank/Lender Name *</Label>
                        <Input
                          id="bank_lender_name"
                          value={formData.bank_lender_name}
                          onChange={(e) => setFormData({ ...formData, bank_lender_name: e.target.value })}
                          placeholder="e.g., HDFC Bank, Bajaj Finance, Tata Capital"
                          required
                          className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* Row 2: Loan Type & IFSC Code */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="loan_type" className="text-white text-sm font-medium mb-2 block">Loan Type *</Label>
                        <select
                          id="loan_type"
                          value={formData.loan_type}
                          onChange={(e) => setFormData({ ...formData, loan_type: e.target.value })}
                          required
                          className="w-full h-12 bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 focus:border-amber-500 focus:outline-none"
                        >
                          <option value="">Select Loan Type</option>
                          <option value="home_loan">Home Loan</option>
                          <option value="personal_loan">Personal Loan</option>
                          <option value="car_loan">Car/Vehicle Loan</option>
                          <option value="education_loan">Education Loan</option>
                          <option value="gold_loan">Gold Loan</option>
                          <option value="business_loan">Business Loan</option>
                          <option value="consumer_durable">Consumer Durable Loan</option>
                          <option value="two_wheeler">Two Wheeler Loan</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="ifsc_code" className="text-white text-sm font-medium mb-2 block">IFSC Code *</Label>
                        <Input
                          id="ifsc_code"
                          value={formData.ifsc_code}
                          onChange={(e) => setFormData({ ...formData, ifsc_code: formatIFSC(e.target.value) })}
                          placeholder="e.g., HDFC0001234"
                          maxLength={11}
                          required
                          className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-amber-500"
                        />
                        {formData.ifsc_code && formData.ifsc_code.length > 0 && !validateIFSC(formData.ifsc_code).isValid && (
                          <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Enter valid IFSC (e.g., SBIN0001234)
                          </p>
                        )}
                        {formData.ifsc_code && validateIFSC(formData.ifsc_code).isValid && (
                          <p className="text-green-400 text-xs mt-1.5 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Bank: {validateIFSC(formData.ifsc_code).bankCode}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Row 3: Borrower Name & Registered Mobile */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="borrower_name" className="text-white text-sm font-medium mb-2 block">Borrower Name *</Label>
                        <Input
                          id="borrower_name"
                          value={formData.borrower_name}
                          onChange={(e) => setFormData({ ...formData, borrower_name: e.target.value })}
                          placeholder="Full name as per bank records"
                          required
                          className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="registered_mobile" className="text-white text-sm font-medium mb-2 block">Registered Mobile *</Label>
                        <Input
                          id="registered_mobile"
                          type="tel"
                          value={formData.registered_mobile}
                          onChange={(e) => setFormData({ ...formData, registered_mobile: formatMobile(e.target.value) })}
                          placeholder="10-digit mobile number"
                          maxLength={10}
                          required
                          className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-amber-500"
                        />
                        {formData.registered_mobile && formData.registered_mobile.length > 0 && !validateMobile(formData.registered_mobile).isValid && (
                          <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Enter valid 10-digit mobile (starts with 6-9)
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Row 4: EMI Amount & EMI Due Date */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="emi_amount" className="text-white text-sm font-medium mb-2 block">EMI Amount (₹) *</Label>
                        <Input
                          id="emi_amount"
                          type="number"
                          value={formData.emi_amount}
                          onChange={(e) => setFormData({ ...formData, emi_amount: e.target.value })}
                          placeholder="Monthly EMI amount"
                          required
                          className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-amber-500"
                        />
                        <p className="text-gray-400 text-xs mt-1">Enter your monthly EMI amount</p>
                      </div>
                      <div>
                        <Label htmlFor="emi_due_date" className="text-white text-sm font-medium mb-2 block">EMI Due Date *</Label>
                        <Input
                          id="emi_due_date"
                          type="date"
                          value={formData.emi_due_date}
                          onChange={(e) => setFormData({ ...formData, emi_due_date: e.target.value })}
                          required
                          className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-amber-500"
                        />
                        <p className="text-gray-400 text-xs mt-1">Select the EMI due date</p>
                      </div>
                    </div>

                    {/* Info Box */}
                    <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-2xl p-4 mt-2">
                      <p className="text-sm text-blue-300">
                        <strong className="text-blue-200">📋 Required Documents:</strong> Loan account statement, EMI schedule, or any document showing your loan details.
                      </p>
                      <p className="text-xs text-blue-300/70 mt-2">
                        ⚠️ All fields are mandatory. Please ensure details match your loan documents exactly.
                      </p>
                    </div>
                  </>
                )}

                {/* Mobile Recharge - Recharge Type (Prepaid/Postpaid) */}
                {currentType?.fields.includes('recharge_type') && (
                  <div>
                    <Label htmlFor="recharge_type" className="text-gray-300 text-sm font-medium mb-2 block">Recharge Type *</Label>
                    <select
                      id="recharge_type"
                      value={formData.recharge_type}
                      onChange={(e) => setFormData({ ...formData, recharge_type: e.target.value })}
                      required
                      className="w-full h-12 px-4 border border-gray-700/50 rounded-xl bg-gray-800/50 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      data-testid="recharge-type-select"
                    >
                      <option value="">-- Select Recharge Type --</option>
                      <option value="prepaid">📱 Prepaid</option>
                      <option value="postpaid">📞 Postpaid</option>
                    </select>
                  </div>
                )}

                {/* Mobile Recharge - Operator Selection */}
                {currentType?.fields.includes('operator') && selectedType === 'mobile_recharge' && (
                  <div>
                    <Label htmlFor="operator" className="text-gray-300 text-sm font-medium mb-2 block">
                      Mobile Operator *
                      {loadingOperators && <span className="text-amber-400 text-xs ml-2">(Loading...)</span>}
                    </Label>
                    <select
                      id="operator"
                      value={formData.operator}
                      onChange={(e) => setFormData({ ...formData, operator: e.target.value, selected_plan: null })}
                      required
                      className="w-full h-12 px-4 border border-gray-700/50 rounded-xl bg-gray-800/50 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      data-testid="operator-select"
                    >
                      <option value="">-- Select Operator --</option>
                      {mobileOperators.map(op => (
                        <option key={op.id} value={op.id}>{op.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Mobile Recharge - Circle Selection */}
                {currentType?.fields.includes('circle') && (
                  <div>
                    <Label htmlFor="circle" className="text-gray-300 text-sm font-medium mb-2 block">Telecom Circle *</Label>
                    <select
                      id="circle"
                      value={formData.circle}
                      onChange={(e) => setFormData({ ...formData, circle: e.target.value, selected_plan: null })}
                      required
                      className="w-full h-12 px-4 border border-gray-700/50 rounded-xl bg-gray-800/50 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      data-testid="circle-select"
                    >
                      <option value="">-- Select Circle --</option>
                      {telecomCircles.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* DTH Operator - Dropdown from Eko API */}
                {currentType?.fields.includes('operator') && selectedType === 'dish_recharge' && (
                  <div>
                    <Label htmlFor="dth_operator" className="text-gray-300 text-sm font-medium mb-2 block">
                      DTH Provider *
                      {loadingOperators && <span className="text-amber-400 text-xs ml-2">(Loading...)</span>}
                    </Label>
                    <select
                      id="dth_operator"
                      value={formData.operator}
                      onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                      required
                      className="w-full h-12 px-4 border border-gray-700/50 rounded-xl bg-gray-800/50 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      data-testid="dth-operator-select"
                    >
                      <option value="">-- Select DTH Provider --</option>
                      {(ekoDthOperators.length > 0 ? ekoDthOperators : [
                        { id: 'TATA_SKY', name: 'Tata Play (Tata Sky)' },
                        { id: 'AIRTEL_DTH', name: 'Airtel Digital TV' },
                        { id: 'DISH_TV', name: 'Dish TV' },
                        { id: 'D2H', name: 'D2H Videocon' },
                        { id: 'SUN_DIRECT', name: 'Sun Direct' }
                      ]).map(op => (
                        <option key={op.id} value={op.name}>{op.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Other Operator (not mobile/DTH) - Text Input */}
                {currentType?.fields.includes('operator') && !['mobile_recharge', 'dish_recharge'].includes(selectedType) && (
                  <div>
                    <Label htmlFor="operator" className="text-gray-300 text-sm font-medium mb-2 block">Operator/Provider *</Label>
                    <Input
                      id="operator"
                      value={formData.operator}
                      onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                      placeholder="e.g., Provider name"
                      required
                      className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-amber-500"
                    />
                  </div>
                )}

                {/* ==================== RECHARGE PLANS SECTION ==================== */}
                {selectedType === 'mobile_recharge' && formData.operator && formData.circle && (
                  <div className="bg-gradient-to-br from-blue-900/30 to-blue-900/10 rounded-2xl p-4 border border-blue-500/30">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-blue-300 text-sm font-semibold flex items-center gap-2">
                        📋 Available Plans
                        {loadingPlans && <span className="text-amber-400 text-xs">(Loading...)</span>}
                      </Label>
                      {formData.selected_plan && (
                        <button 
                          type="button"
                          onClick={() => setFormData({ ...formData, selected_plan: null, amount_inr: '' })}
                          className="text-xs text-gray-400 hover:text-white"
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>
                    
                    {ekoPlans.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                        {ekoPlans.map((plan) => (
                          <button
                            key={plan.id}
                            type="button"
                            onClick={() => setFormData({ 
                              ...formData, 
                              amount_inr: plan.amount.toString(),
                              selected_plan: plan
                            })}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              formData.selected_plan?.id === plan.id
                                ? 'border-amber-500 bg-amber-500/20'
                                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                            }`}
                          >
                            <p className="text-lg font-bold text-amber-400">₹{plan.amount}</p>
                            <p className="text-xs text-gray-300 line-clamp-2">{plan.description}</p>
                            {plan.validity && (
                              <p className="text-[10px] text-gray-500 mt-1">{plan.validity}</p>
                            )}
                            {plan.data && (
                              <span className="text-[10px] text-blue-400">{plan.data}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : !loadingPlans ? (
                      <p className="text-gray-500 text-sm text-center py-4">
                        No plans available. Enter amount manually.
                      </p>
                    ) : null}
                  </div>
                )}

                {/* ==================== DMT BANK TRANSFER FIELDS ==================== */}
                {selectedType === 'bank_transfer' && (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-900/10 rounded-2xl p-4 border border-emerald-500/30 mb-4">
                      <p className="text-emerald-300 text-sm flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Instant Bank Transfer via IMPS/NEFT
                      </p>
                      <p className="text-gray-400 text-xs mt-1">Money will be transferred directly to beneficiary's bank account after admin approval.</p>
                    </div>
                    
                    <div>
                      <Label htmlFor="beneficiary_name" className="text-gray-300 text-sm font-medium mb-2 block">
                        Beneficiary Name * 
                        <span className="text-gray-500 text-xs ml-2">(As per bank records)</span>
                      </Label>
                      <Input
                        id="beneficiary_name"
                        value={formData.beneficiary_name}
                        onChange={(e) => setFormData({ ...formData, beneficiary_name: e.target.value.toUpperCase() })}
                        placeholder="Enter name as per bank account"
                        required
                        className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-emerald-500 uppercase"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="account_number" className="text-gray-300 text-sm font-medium mb-2 block">
                        Bank Account Number *
                      </Label>
                      <Input
                        id="account_number"
                        value={formData.account_number}
                        onChange={(e) => setFormData({ ...formData, account_number: formatBankAccount(e.target.value) })}
                        placeholder="Enter account number"
                        required
                        className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-emerald-500"
                      />
                      {formData.account_number && !validateBankAccount(formData.account_number).isValid && (
                        <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Account number should be 9-18 digits
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="ifsc_code" className="text-gray-300 text-sm font-medium mb-2 block">
                        IFSC Code *
                      </Label>
                      <Input
                        id="ifsc_code"
                        value={formData.ifsc_code}
                        onChange={(e) => setFormData({ ...formData, ifsc_code: formatIFSC(e.target.value) })}
                        placeholder="e.g., HDFC0001234"
                        maxLength={11}
                        required
                        className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-emerald-500 uppercase"
                      />
                      {formData.ifsc_code && !validateIFSC(formData.ifsc_code).isValid && (
                        <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Invalid IFSC format (4 letters + 7 alphanumeric)
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="recipient_mobile" className="text-gray-300 text-sm font-medium mb-2 block">
                        Beneficiary Mobile Number *
                      </Label>
                      <Input
                        id="recipient_mobile"
                        type="tel"
                        value={formData.recipient_mobile}
                        onChange={(e) => setFormData({ ...formData, recipient_mobile: formatMobile(e.target.value) })}
                        placeholder="10-digit mobile number"
                        maxLength={10}
                        required
                        className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-emerald-500"
                      />
                      {formData.recipient_mobile && !validateMobile(formData.recipient_mobile).isValid && (
                        <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Enter valid 10-digit mobile (starts with 6-9)
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {currentType?.fields.includes('biller_name') && (
                  <div>
                    <Label htmlFor="biller" className="text-gray-300 text-sm font-medium mb-2 block">
                      Electricity Provider *
                      <span className="text-gray-500 text-xs ml-2">(Select your state electricity board)</span>
                    </Label>
                    <select
                      id="biller"
                      value={formData.biller_name}
                      onChange={(e) => setFormData({ ...formData, biller_name: e.target.value })}
                      required
                      className="w-full h-12 px-4 border border-gray-700/50 rounded-xl bg-gray-800/50 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      data-testid="electricity-provider-select"
                    >
                      <option value="">-- Select Electricity Provider --</option>
                      <optgroup label="Northern India">
                        <option value="UPPCL - Uttar Pradesh">UPPCL - Uttar Pradesh Power Corporation Ltd</option>
                        <option value="DHBVN - Haryana">DHBVN - Dakshin Haryana Bijli Vitran Nigam</option>
                        <option value="UHBVN - Haryana">UHBVN - Uttar Haryana Bijli Vitran Nigam</option>
                        <option value="PSPCL - Punjab">PSPCL - Punjab State Power Corporation Ltd</option>
                        <option value="JVVNL - Rajasthan">JVVNL - Jaipur Vidyut Vitran Nigam Ltd</option>
                        <option value="AVVNL - Rajasthan">AVVNL - Ajmer Vidyut Vitran Nigam Ltd</option>
                        <option value="JdVVNL - Rajasthan">JdVVNL - Jodhpur Vidyut Vitran Nigam Ltd</option>
                        <option value="HPSEBL - Himachal Pradesh">HPSEBL - Himachal Pradesh State Electricity Board</option>
                        <option value="JKPDD - Jammu & Kashmir">JKPDD - Jammu & Kashmir Power Development Dept</option>
                        <option value="BSES Delhi - Rajdhani">BSES Rajdhani Power Ltd - Delhi</option>
                        <option value="BSES Delhi - Yamuna">BSES Yamuna Power Ltd - Delhi</option>
                        <option value="NDPL - Tata Power Delhi">Tata Power Delhi Distribution Ltd (NDPL)</option>
                        <option value="NDMC - Delhi">New Delhi Municipal Council (NDMC)</option>
                        <option value="UPCL - Uttarakhand">UPCL - Uttarakhand Power Corporation Ltd</option>
                      </optgroup>
                      <optgroup label="Western India">
                        <option value="MSEDCL - Maharashtra">MSEDCL - Maharashtra State Electricity Distribution Co. Ltd</option>
                        <option value="BEST - Mumbai">BEST - Brihanmumbai Electric Supply & Transport</option>
                        <option value="Tata Power - Mumbai">Tata Power Company Ltd - Mumbai</option>
                        <option value="Adani Electricity - Mumbai">Adani Electricity Mumbai Ltd</option>
                        <option value="MGVCL - Gujarat">MGVCL - Madhya Gujarat Vij Company Ltd</option>
                        <option value="PGVCL - Gujarat">PGVCL - Paschim Gujarat Vij Company Ltd</option>
                        <option value="UGVCL - Gujarat">UGVCL - Uttar Gujarat Vij Company Ltd</option>
                        <option value="DGVCL - Gujarat">DGVCL - Dakshin Gujarat Vij Company Ltd</option>
                        <option value="Torrent Power - Ahmedabad">Torrent Power Ltd - Ahmedabad</option>
                        <option value="Torrent Power - Surat">Torrent Power Ltd - Surat</option>
                        <option value="MPMKVVCL - Madhya Pradesh">MPMKVVCL - MP Madhya Kshetra Vidyut Vitaran Co. Ltd</option>
                        <option value="MPPKVVCL - Madhya Pradesh">MPPKVVCL - MP Paschim Kshetra Vidyut Vitaran Co. Ltd</option>
                        <option value="MPPOKVVCL - Madhya Pradesh">MPPOKVVCL - MP Poorv Kshetra Vidyut Vitaran Co. Ltd</option>
                        <option value="CSPDCL - Chhattisgarh">CSPDCL - Chhattisgarh State Power Distribution Co. Ltd</option>
                        <option value="Goa Electricity - Goa">Goa Electricity Department</option>
                      </optgroup>
                      <optgroup label="Southern India">
                        <option value="TANGEDCO - Tamil Nadu">TANGEDCO - Tamil Nadu Generation & Distribution Corporation</option>
                        <option value="BESCOM - Karnataka">BESCOM - Bangalore Electricity Supply Company Ltd</option>
                        <option value="MESCOM - Karnataka">MESCOM - Mangalore Electricity Supply Company Ltd</option>
                        <option value="HESCOM - Karnataka">HESCOM - Hubli Electricity Supply Company Ltd</option>
                        <option value="GESCOM - Karnataka">GESCOM - Gulbarga Electricity Supply Company Ltd</option>
                        <option value="CESC - Karnataka">CESC - Chamundeshwari Electricity Supply Corp Ltd</option>
                        <option value="KSEB - Kerala">KSEB - Kerala State Electricity Board Ltd</option>
                        <option value="APSPDCL - Andhra Pradesh">APSPDCL - AP Southern Power Distribution Co. Ltd</option>
                        <option value="APEPDCL - Andhra Pradesh">APEPDCL - AP Eastern Power Distribution Co. Ltd</option>
                        <option value="TSSPDCL - Telangana">TSSPDCL - Telangana Southern Power Distribution Co. Ltd</option>
                        <option value="TSNPDCL - Telangana">TSNPDCL - Telangana Northern Power Distribution Co. Ltd</option>
                        <option value="Electricity Dept - Puducherry">Electricity Department - Puducherry</option>
                      </optgroup>
                      <optgroup label="Eastern India">
                        <option value="WBSEDCL - West Bengal">WBSEDCL - West Bengal State Electricity Distribution Co. Ltd</option>
                        <option value="CESC - Kolkata">CESC Ltd - Kolkata</option>
                        <option value="BSPHCL - Bihar">BSPHCL - Bihar State Power Holding Company Ltd</option>
                        <option value="NBPDCL - Bihar">NBPDCL - North Bihar Power Distribution Co. Ltd</option>
                        <option value="SBPDCL - Bihar">SBPDCL - South Bihar Power Distribution Co. Ltd</option>
                        <option value="JBVNL - Jharkhand">JBVNL - Jharkhand Bijli Vitran Nigam Ltd</option>
                        <option value="OSEB - Odisha">TPCODL/TPWODL/TPSODL/TPNODL - Odisha Discoms (Tata Power)</option>
                        <option value="APDCL - Assam">APDCL - Assam Power Distribution Company Ltd</option>
                        <option value="TSECL - Tripura">TSECL - Tripura State Electricity Corporation Ltd</option>
                        <option value="MePDCL - Meghalaya">MePDCL - Meghalaya Power Distribution Corporation Ltd</option>
                        <option value="MSPCL - Manipur">MSPCL - Manipur State Power Company Ltd</option>
                        <option value="DoP - Nagaland">Department of Power - Nagaland</option>
                        <option value="DoP - Mizoram">Power & Electricity Department - Mizoram</option>
                        <option value="DoP - Arunachal">Department of Power - Arunachal Pradesh</option>
                        <option value="DoP - Sikkim">Energy & Power Department - Sikkim</option>
                      </optgroup>
                      <optgroup label="Union Territories">
                        <option value="Electricity Dept - Chandigarh">Electricity Department - Chandigarh</option>
                        <option value="DNH Power - Dadra & Nagar Haveli">DNH Power Distribution Corporation Ltd</option>
                        <option value="Electricity Dept - Daman & Diu">Electricity Department - Daman & Diu</option>
                        <option value="Electricity Dept - Lakshadweep">Electricity Department - Lakshadweep</option>
                        <option value="Electricity Dept - Andaman">Electricity Department - Andaman & Nicobar</option>
                        <option value="Electricity Dept - Ladakh">Electricity Department - Ladakh</option>
                      </optgroup>
                      <optgroup label="Other">
                        <option value="Other">Other Provider (Enter in notes)</option>
                      </optgroup>
                    </select>
                    <p className="text-gray-500 text-xs mt-2">
                      Can't find your provider? Select "Other" and mention in your request notes.
                    </p>
                  </div>
                )}

                {/* Submit Button - Premium */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 mt-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:via-orange-400 hover:to-amber-400 text-gray-900 font-bold rounded-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Send className="h-5 w-5" />
                  {loading ? 'Processing...' : `Pay ${totalPRC > 0 ? totalPRC.toFixed(0) + ' PRC' : 'Now'}`}
                </button>
              </form>
            </div>
          </div>

          {/* Right: Balance & Previous Requests */}
          <div className="space-y-6">
            {/* PRC Balance Card - Premium */}
            <div className="bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-amber-600/20 rounded-3xl p-6 border border-amber-500/30 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl"></div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-xl font-bold">₹</span>
                  </div>
                  <div>
                    <p className="text-amber-300/70 text-xs uppercase tracking-wide">Available Balance</p>
                    <p className="text-3xl font-bold text-white">{currentUser?.prc_balance?.toLocaleString() || 0}</p>
                  </div>
                </div>
                <p className="text-amber-300/70 text-xs">PRC (10 PRC = ₹1)</p>
              </div>
            </div>

            {/* How it Works - Premium Card */}
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl rounded-3xl p-6 border border-gray-800/50">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-lg flex items-center justify-center">
                  <Receipt className="h-4 w-4 text-amber-400" />
                </div>
                How It Works
              </h3>
              <ol className="text-sm text-gray-400 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-full flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">1</span>
                  <span>Select service type</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-full flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">2</span>
                  <span>Enter amount and details</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-full flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">3</span>
                  <span>PRC deducted immediately</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-full flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">4</span>
                  <span>Admin processes request</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center text-xs font-bold text-green-400 flex-shrink-0">✓</span>
                  <span>Recharge/payment completed</span>
                </li>
              </ol>
              <div className="mt-5 p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl border border-amber-500/20">
                <p className="text-xs text-amber-300">
                  <strong>Note:</strong> Service charges apply. PRC will be refunded if request is rejected.
                </p>
              </div>
            </div>

            {/* Security Note for Important Services */}
            {(selectedType === 'credit_card_payment' || selectedType === 'loan_emi') && (
              <div className="bg-gradient-to-br from-red-500/10 to-rose-500/10 rounded-3xl p-6 border border-red-500/20">
                <h3 className="font-bold text-red-400 mb-3 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  {selectedType === 'loan_emi' ? 'Pay Your Existing EMIs' : 'Security Notice'}
                </h3>
                {selectedType === 'loan_emi' ? (
                  <div className="space-y-3">
                    <p className="text-xs text-amber-300 bg-amber-500/10 p-2 rounded-lg">
                      ⚠️ This is NOT a loan service. Use this to pay your existing loan EMIs using PRC.
                    </p>
                    <ul className="text-xs text-red-300 space-y-2">
                      <li>✓ Enter your loan account number</li>
                      <li>✓ Provide bank/NBFC name</li>
                      <li>✓ We will pay the EMI on your behalf</li>
                    </ul>
                  </div>
                ) : (
                  <ul className="text-xs text-red-300 space-y-2">
                    <li>✓ Only provide last 4 digits of card</li>
                    <li>✓ Never share full card number or CVV</li>
                    <li>✓ Verify bank/lender name correctly</li>
                    <li>✓ Double-check account details</li>
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Link to My Orders */}
        <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl rounded-3xl p-6 border border-gray-800/50 shadow-2xl mt-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center">
                <Receipt className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Request History</h2>
                <p className="text-xs text-gray-500">View all your bill payment requests</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/orders?tab=bill_payment')}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all flex items-center gap-2"
            >
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillPayments;
