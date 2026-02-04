import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  ArrowLeft, Smartphone, Tv, Zap, CreditCard, Building,
  Send, Clock, CheckCircle, XCircle, AlertCircle, Receipt, ChevronDown, ChevronUp
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import RequestTimeline from '../components/RequestTimeline';
import { RedemptionProfilePrompt } from '../components/ProfileCompletionComponents';
import { RequestJourney, LiveTimer, SpeedBadge } from '../components/BillPaymentJourney';
import { 
  formatMobile, formatIFSC, formatBankAccount,
  validateMobile, validateIFSC, validateBankAccount
} from '@/utils/indianValidation';

const API = process.env.REACT_APP_BACKEND_URL || '';

const BillPayments = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [currentUser, setCurrentUser] = useState(user);
  const [selectedType, setSelectedType] = useState('mobile_recharge');
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
    { id: 'loan_emi', label: 'Loan/EMI', icon: Building, color: 'red', fields: ['loan_account', 'bank_name', 'ifsc_code', 'borrower_name', 'registered_mobile', 'loan_type', 'emi_due_date', 'customer_id', 'loan_tenure', 'emi_amount'] }
  ];

  const currentType = requestTypes.find(t => t.id === selectedType);
  const prcRequired = formData.amount_inr ? parseFloat(formData.amount_inr) * 10 : 0;
  const estimatedServiceCharge = prcRequired * 0.02; // Default 2%
  const totalPRC = prcRequired + estimatedServiceCharge;

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24 pt-16">
      <div className="container mx-auto px-5 max-w-6xl pt-4" style={{ paddingBottom: '1.5rem' }}>
        {/* Header - with safe area padding */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">
              Bill Payments & Recharge
            </h1>
            <p className="text-gray-500 text-sm">Pay bills using your PRC balance</p>
            </div>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Create Request Form */}
          <div className="lg:col-span-2">
            {/* Profile Completion Prompt - Show before form */}
            <RedemptionProfilePrompt 
              user={user}
              userData={currentUser}
              onContinue={() => {}}
            />
            
            <div className="bg-gray-900/50 rounded-2xl p-5 border border-gray-800">
              <h2 className="text-lg font-bold text-white mb-4">Create New Request</h2>

              {/* Service Type Selection */}
              <div className="mb-6">
                <label className="mb-3 block text-gray-400 text-sm">Select Service Type</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {requestTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.id}
                        onClick={() => setSelectedType(type.id)}
                        className={`p-4 rounded-xl border transition-all ${
                          selectedType === type.id
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-gray-800 bg-gray-800/50 hover:border-gray-700'
                        }`}
                      >
                        <Icon className={`h-6 w-6 mx-auto mb-2 ${selectedType === type.id ? 'text-amber-500' : 'text-gray-500'}`} />
                        <p className={`text-xs font-medium ${selectedType === type.id ? 'text-amber-400' : 'text-gray-400'}`}>{type.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 [&_input]:bg-gray-800 [&_input]:border-gray-700 [&_input]:text-white [&_input]:placeholder:text-gray-500 [&_select]:bg-gray-800 [&_select]:border-gray-700 [&_select]:text-white [&_label]:text-gray-300">
                {/* Amount */}
                <div>
                  <Label htmlFor="amount" className="text-gray-300">Amount (₹) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={formData.amount_inr}
                    onChange={(e) => setFormData({ ...formData, amount_inr: e.target.value })}
                    placeholder="Enter amount in INR"
                    min="1"
                    step="0.01"
                    required
                  />
                  {formData.amount_inr && (
                    <p className="text-xs text-gray-600 mt-1">
                      PRC Required: {prcRequired.toFixed(2)} + Service Charge: ~{estimatedServiceCharge.toFixed(2)} = {totalPRC.toFixed(2)} PRC
                    </p>
                  )}
                </div>

                {/* Dynamic Fields Based on Service Type */}
                {currentType.fields.includes('phone_number') && (
                  <div>
                    <Label htmlFor="phone">Mobile Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: formatMobile(e.target.value) })}
                      placeholder="10-digit mobile number"
                      maxLength={10}
                      required
                    />
                    {formData.phone_number && formData.phone_number.length > 0 && !validateMobile(formData.phone_number).isValid && (
                      <p className="text-red-500 text-xs mt-1">Enter valid 10-digit mobile (starts with 6-9)</p>
                    )}
                  </div>
                )}

                {currentType.fields.includes('consumer_number') && (
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

                    {/* Row 2: IFSC Code & Customer ID */}
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
                        <Label htmlFor="customer_id">Customer ID (Optional)</Label>
                        <Input
                          id="customer_id"
                          value={formData.customer_id}
                          onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                          placeholder="Bank customer ID if available"
                        />
                      </div>
                    </div>

                    {/* Row 3: Borrower Name & Registered Mobile */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <div>
                        <Label htmlFor="registered_mobile">Registered Mobile Number *</Label>
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
                    </div>

                    {/* Row 4: Loan Type & Loan Tenure */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="loan_type">Loan Type *</Label>
                        <select
                          id="loan_type"
                          value={formData.loan_type}
                          onChange={(e) => setFormData({ ...formData, loan_type: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Select loan type</option>
                          <option value="home_loan">Home Loan</option>
                          <option value="personal_loan">Personal Loan</option>
                          <option value="car_loan">Car/Vehicle Loan</option>
                          <option value="two_wheeler_loan">Two Wheeler Loan</option>
                          <option value="education_loan">Education Loan</option>
                          <option value="business_loan">Business Loan</option>
                          <option value="gold_loan">Gold Loan</option>
                          <option value="consumer_durable">Consumer Durable Loan</option>
                          <option value="agriculture_loan">Agriculture Loan</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="loan_tenure">Remaining Tenure (Optional)</Label>
                        <Input
                          id="loan_tenure"
                          value={formData.loan_tenure}
                          onChange={(e) => setFormData({ ...formData, loan_tenure: e.target.value })}
                          placeholder="e.g., 24 months"
                        />
                      </div>
                    </div>

                    {/* Row 5: EMI Due Date & EMI Amount */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="emi_due_date">EMI Due Date *</Label>
                        <Input
                          id="emi_due_date"
                          type="date"
                          value={formData.emi_due_date}
                          onChange={(e) => setFormData({ ...formData, emi_due_date: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="emi_amount">Monthly EMI Amount (₹)</Label>
                        <Input
                          id="emi_amount"
                          type="number"
                          value={formData.emi_amount}
                          onChange={(e) => setFormData({ ...formData, emi_amount: e.target.value })}
                          placeholder="Regular EMI amount"
                        />
                        <p className="text-xs text-gray-500 mt-1">For reference only</p>
                      </div>
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
                  Security Notice
                </h3>
                <ul className="text-xs text-red-300 space-y-2">
                  <li>✓ Only provide last 4 digits of card</li>
                  <li>✓ Never share full card number or CVV</li>
                  <li>✓ Verify bank/lender name correctly</li>
                  <li>✓ Double-check account details</li>
                </ul>
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
