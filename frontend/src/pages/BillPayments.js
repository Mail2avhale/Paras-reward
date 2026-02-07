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
  Send, Clock, CheckCircle, XCircle, AlertCircle, Receipt, ChevronDown, ChevronUp, Info
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

const API = process.env.REACT_APP_BACKEND_URL || '';

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
  const [formData, setFormData] = useState({
    amount_inr: '',
    phone_number: '',
    operator: '',
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
    biller_name: '',
    // New Loan/EMI fields
    ifsc_code: '',
    registered_mobile: '',
    emi_due_date: '',
    customer_id: '',
    loan_tenure: '',
    emi_amount: ''
  });

  // Update selected type when URL param changes
  useEffect(() => {
    const typeFromUrl = searchParams.get('type');
    if (typeFromUrl && ['mobile_recharge', 'dish_recharge', 'electricity_bill', 'credit_card_payment', 'loan_emi'].includes(typeFromUrl)) {
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
      const response = await axios.get(`${API}/api/auth/user/${user.uid}`);
      setCurrentUser(response.data);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchRequests = async () => {
    try {
      const response = await axios.get(`${API}/api/bill-payment/requests/${user.uid}`);
      setRequests(response.data.requests || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const requestTypes = [
    { id: 'mobile_recharge', label: 'Mobile Recharge', icon: Smartphone, color: 'blue', fields: ['phone_number', 'operator'] },
    { id: 'dish_recharge', label: 'DTH/Dish Recharge', icon: Tv, color: 'purple', fields: ['consumer_number', 'operator'] },
    { id: 'electricity_bill', label: 'Electricity Bill', icon: Zap, color: 'yellow', fields: ['consumer_number', 'biller_name'] },
    { id: 'credit_card_payment', label: 'Credit Card', icon: CreditCard, color: 'green', fields: ['card_last4', 'cardholder_name', 'bank_name', 'linked_mobile', 'card_type'] },
    { id: 'loan_emi', label: 'Pay EMI', sublabel: 'Pay your existing loan EMIs', icon: Building, color: 'red', fields: ['loan_account', 'bank_name', 'ifsc_code', 'borrower_name', 'registered_mobile'] }
  ];

  const currentType = requestTypes.find(t => t.id === selectedType);
  
  // New charge calculation: Amount + ₹10 Processing + 20% Admin
  const amountINR = formData.amount_inr ? parseFloat(formData.amount_inr) : 0;
  const processingFeeINR = 10; // Flat ₹10
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

      const response = await axios.post(`${API}/api/bill-payment/request`, {
        user_id: user.uid,
        request_type: selectedType,
        amount_inr: parseFloat(formData.amount_inr),
        details
      });

      toast.success('Request submitted successfully!', {
        description: 'Admin will process your request shortly'
      });

      // Reset form
      setFormData({
        amount_inr: '',
        phone_number: '',
        operator: '',
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

            {/* Payment Form - Premium Card */}
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
                    <Label htmlFor="consumer">Consumer Number *</Label>
                    <Input
                      id="consumer"
                      value={formData.consumer_number}
                      onChange={(e) => setFormData({ ...formData, consumer_number: e.target.value })}
                      placeholder="Enter consumer number"
                      required
                    />
                  </div>
                )}

                {currentType.fields.includes('card_last4') && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="card_last4">Card Number (Last 4 digits) *</Label>
                        <Input
                          id="card_last4"
                          value={formData.card_last4}
                          onChange={(e) => setFormData({ ...formData, card_last4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                          placeholder="XXXX"
                          maxLength={4}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="cardholder_name">Cardholder Name *</Label>
                        <Input
                          id="cardholder_name"
                          value={formData.cardholder_name}
                          onChange={(e) => setFormData({ ...formData, cardholder_name: e.target.value })}
                          placeholder="Name on card"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="bank_name">Issuing Bank *</Label>
                        <Input
                          id="bank_name"
                          value={formData.bank_name}
                          onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                          placeholder="e.g., HDFC Bank, SBI, ICICI"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="linked_mobile">Linked Mobile Number *</Label>
                        <Input
                          id="linked_mobile"
                          type="tel"
                          value={formData.linked_mobile}
                          onChange={(e) => setFormData({ ...formData, linked_mobile: formatMobile(e.target.value) })}
                          placeholder="10-digit mobile number"
                          maxLength={10}
                          required
                        />
                        {formData.linked_mobile && formData.linked_mobile.length > 0 && !validateMobile(formData.linked_mobile).isValid && (
                          <p className="text-red-500 text-xs mt-1">Enter valid 10-digit mobile (starts with 6-9)</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="card_type" className="text-gray-300">Card Type *</Label>
                      <select
                        id="card_type"
                        value={formData.card_type}
                        onChange={(e) => setFormData({ ...formData, card_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
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

                {currentType.fields.includes('loan_account') && (
                  <>
                    {/* Row 1: Loan Account & Bank Name */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="loan_account">Loan Account Number *</Label>
                        <Input
                          id="loan_account"
                          value={formData.loan_account}
                          onChange={(e) => setFormData({ ...formData, loan_account: e.target.value })}
                          placeholder="Enter loan account number"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="bank_name">Bank/NBFC Name *</Label>
                        <Input
                          id="bank_name"
                          value={formData.bank_name}
                          onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                          placeholder="e.g., HDFC Bank, Bajaj Finance"
                          required
                        />
                      </div>
                    </div>

                    {/* Row 2: IFSC Code & Borrower Name */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="ifsc_code">IFSC Code *</Label>
                        <Input
                          id="ifsc_code"
                          value={formData.ifsc_code}
                          onChange={(e) => setFormData({ ...formData, ifsc_code: formatIFSC(e.target.value) })}
                          placeholder="e.g., HDFC0001234"
                          maxLength={11}
                          required
                        />
                        {formData.ifsc_code && formData.ifsc_code.length > 0 && !validateIFSC(formData.ifsc_code).isValid && (
                          <p className="text-red-500 text-xs mt-1">Enter valid IFSC (e.g., SBIN0001234)</p>
                        )}
                        {formData.ifsc_code && validateIFSC(formData.ifsc_code).isValid && (
                          <p className="text-green-500 text-xs mt-1">✓ Bank: {validateIFSC(formData.ifsc_code).bankCode}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="borrower_name">Borrower Name *</Label>
                        <Input
                          id="borrower_name"
                          value={formData.borrower_name}
                          onChange={(e) => setFormData({ ...formData, borrower_name: e.target.value })}
                          placeholder="Full name as per bank records"
                          required
                        />
                      </div>
                    </div>

                    {/* Row 3: Registered Mobile */}
                    <div>
                      <Label htmlFor="registered_mobile">Registered Mobile *</Label>
                      <Input
                        id="registered_mobile"
                        type="tel"
                        value={formData.registered_mobile}
                        onChange={(e) => setFormData({ ...formData, registered_mobile: formatMobile(e.target.value) })}
                        placeholder="10-digit mobile number"
                        maxLength={10}
                        required
                      />
                      {formData.registered_mobile && formData.registered_mobile.length > 0 && !validateMobile(formData.registered_mobile).isValid && (
                        <p className="text-red-500 text-xs mt-1">Enter valid 10-digit mobile (starts with 6-9)</p>
                      )}
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> Please ensure all details match your loan documents. IFSC code is required for payment processing.
                      </p>
                    </div>
                  </>
                )}

                {currentType.fields.includes('operator') && (
                  <div>
                    <Label htmlFor="operator">Operator/Provider *</Label>
                    <Input
                      id="operator"
                      value={formData.operator}
                      onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                      placeholder="e.g., Airtel, Jio, Vi"
                      required
                    />
                  </div>
                )}

                {currentType.fields.includes('biller_name') && (
                  <div>
                    <Label htmlFor="biller">Biller Name *</Label>
                    <Input
                      id="biller"
                      value={formData.biller_name}
                      onChange={(e) => setFormData({ ...formData, biller_name: e.target.value })}
                      placeholder="Enter biller/provider name"
                      required
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-900 font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {loading ? 'Processing...' : 'Redeem'}
                </button>
              </form>
            </div>
          </div>

          {/* Right: Balance & Info */}
          <div className="space-y-4">
            {/* PRC Balance */}
            <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 rounded-2xl p-5 border border-amber-500/30">
              <p className="text-gray-400 text-sm mb-2">Available PRC Balance</p>
              <p className="text-3xl font-bold text-amber-500">{currentUser?.prc_balance?.toFixed(2) || '0.00'}</p>
              <p className="text-gray-500 text-xs mt-2">100 INR = 1000 PRC</p>
            </div>

            {/* How it Works */}
            <div className="bg-gray-900/50 rounded-2xl p-5 border border-gray-800">
              <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-amber-500" />
                How It Works
              </h3>
              <ol className="text-sm text-gray-400 space-y-2">
                <li>1. Select service type</li>
                <li>2. Enter amount and details</li>
                <li>3. PRC deducted immediately</li>
                <li>4. Admin processes request</li>
                <li>5. Recharge/payment completed</li>
              </ol>
              <div className="mt-4 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                <p className="text-xs text-amber-300">
                  <strong>Note:</strong> Service charges apply. PRC will be refunded if request is rejected.
                </p>
              </div>
            </div>

            {/* Security Note for Important Services */}
            {(selectedType === 'credit_card_payment' || selectedType === 'loan_emi') && (
              <div className="bg-red-500/10 rounded-2xl p-5 border border-red-500/20">
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

        {/* Request History */}
        <div className="bg-gray-900/50 rounded-2xl p-5 border border-gray-800 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Request History</h2>
            <p className="text-sm text-gray-500">Processing: 3-7 days</p>
          </div>
          
          {/* Status Filter Tabs */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {[
              { id: 'all', label: 'All', count: requests.length },
              { id: 'pending', label: 'Pending', count: requests.filter(r => r.status === 'pending').length, color: 'yellow' },
              { id: 'approved', label: 'Approved', count: requests.filter(r => r.status === 'approved' || r.status === 'processing').length, color: 'blue' },
              { id: 'completed', label: 'Completed', count: requests.filter(r => r.status === 'completed').length, color: 'green' },
              { id: 'rejected', label: 'Rejected', count: requests.filter(r => r.status === 'rejected').length, color: 'red' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setStatusFilter(tab.id); setCurrentPage(1); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  statusFilter === tab.id
                    ? tab.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    : tab.color === 'blue' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : tab.color === 'green' ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : tab.color === 'red' ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-gray-700 text-white border border-gray-600'
                    : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:bg-gray-800'
                }`}
              >
                {tab.label}
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  statusFilter === tab.id ? 'bg-white/20' : 'bg-gray-700'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
          
          {(() => {
            const filteredRequests = statusFilter === 'all' 
              ? requests 
              : statusFilter === 'approved'
              ? requests.filter(r => r.status === 'approved' || r.status === 'processing')
              : requests.filter(r => r.status === statusFilter);
            
            return filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-16 w-16 mx-auto text-gray-700 mb-4" />
              <p className="text-gray-500">{statusFilter === 'all' ? 'No requests yet' : `No ${statusFilter} requests`}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Amount</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">PRC</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map((req) => (
                      <React.Fragment key={req.request_id}>
                        <tr 
                          className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                          onClick={() => setExpandedRequest(expandedRequest === req.request_id ? null : req.request_id)}
                        >
                          <td className="py-3 px-4 text-sm text-gray-300">{getTypeLabel(req.request_type)}</td>
                          <td className="py-3 px-4 text-sm font-medium text-white">₹{req.amount_inr}</td>
                          <td className="py-3 px-4 text-sm text-amber-500">{req.total_prc_deducted?.toFixed(2) || '0.00'}</td>
                          <td className="py-3 px-4">{getStatusBadge(req.status)}</td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            {new Date(req.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-400">
                            {expandedRequest === req.request_id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </td>
                        </tr>
                        {/* Expanded Timeline Row */}
                        {expandedRequest === req.request_id && (
                          <tr>
                            <td colSpan={6} className="px-4 py-3 bg-gray-800/30">
                              {/* NEW: Request Journey Animation */}
                              <RequestJourney
                                status={req.status}
                                createdAt={req.created_at}
                                approvedAt={req.approved_at}
                                completedAt={req.completed_at}
                                processingTime={req.processing_time}
                              />
                              
                              {/* TXN Number for completed */}
                              {req.status === 'completed' && req.txn_number && (
                                <div className="mt-3 text-center">
                                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs">
                                    TXN: {req.txn_number}
                                  </span>
                                </div>
                              )}
                              
                              {/* Show rejection reason prominently */}
                              {req.status === 'rejected' && (req.reject_reason || req.admin_notes) && (
                                <div className="mt-3 p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                                  <p className="text-red-400 text-xs font-medium">❌ Rejection Reason:</p>
                                  <p className="text-red-300 text-sm mt-1">{req.reject_reason || req.admin_notes}</p>
                                </div>
                              )}
                              
                              {/* Show admin notes for processing status */}
                              {req.status === 'processing' && req.admin_notes && (
                                <div className="mt-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                                  <p className="text-blue-400 text-xs">Admin Note:</p>
                                  <p className="text-blue-300 text-sm">{req.admin_notes}</p>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {filteredRequests.length > itemsPerPage && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
                  <p className="text-sm text-gray-500">
                    {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredRequests.length)} of {filteredRequests.length}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-sm disabled:opacity-50"
                      data-testid="bill-payments-prev-page"
                    >
                      Prev
                    </button>
                    <span className="px-3 py-1.5 bg-amber-500/20 text-amber-500 rounded-lg text-sm font-medium">
                      {currentPage}/{Math.ceil(filteredRequests.length / itemsPerPage)}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredRequests.length / itemsPerPage), p + 1))}
                      disabled={currentPage >= Math.ceil(filteredRequests.length / itemsPerPage)}
                      className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-sm disabled:opacity-50"
                      data-testid="bill-payments-next-page"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          );
          })()}
        </div>
      </div>
    </div>
  );
};

export default BillPayments;
