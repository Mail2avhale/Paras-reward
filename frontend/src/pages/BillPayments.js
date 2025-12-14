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
  Send, Clock, CheckCircle, XCircle, AlertCircle, Receipt
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const BillPayments = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [selectedType, setSelectedType] = useState('mobile_recharge');
  const [formData, setFormData] = useState({
    amount_inr: '',
    phone_number: '',
    operator: '',
    account_number: '',
    consumer_number: '',
    card_last4: '',
    cardholder_name: '',
    card_type: '',
    loan_account: '',
    borrower_name: '',
    loan_type: '',
    bank_name: '',
    biller_name: ''
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    // Check VIP membership
    if (user.membership_type !== 'vip') {
      toast.error('VIP membership required to use bill payment services');
      setTimeout(() => navigate('/vip-membership'), 2000);
      return;
    }
    
    fetchRequests();
  }, [user, navigate]);

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
    { id: 'credit_card_payment', label: 'Credit Card', icon: CreditCard, color: 'green', fields: ['card_last4', 'cardholder_name', 'bank_name', 'card_type'] },
    { id: 'loan_emi', label: 'Loan/EMI', icon: Building, color: 'red', fields: ['loan_account', 'bank_name', 'borrower_name', 'loan_type'] }
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
    if (user.prc_balance < totalPRC) {
      toast.error(`Insufficient PRC balance. Required: ${totalPRC.toFixed(2)} PRC, Available: ${user.prc_balance?.toFixed(2) || 0} PRC`);
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
        loan_account: '',
        borrower_name: '',
        loan_type: '',
        bank_name: '',
        biller_name: ''
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
      processing: { color: 'bg-blue-100 text-blue-800', icon: AlertCircle, label: 'Processing' },
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Bill Payments & Recharge
              </h1>
              <p className="text-gray-600 text-sm mt-1">Pay bills and recharge using your PRC balance</p>
            </div>
          </div>
          <Button
            onClick={() => {
              if (window.confirm('Are you sure you want to logout?')) {
                onLogout();
                navigate('/login');
              }
            }}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Create Request Form */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Request</h2>

              {/* Service Type Selection */}
              <div className="mb-6">
                <Label className="mb-3 block">Select Service Type</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {requestTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.id}
                        onClick={() => setSelectedType(type.id)}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          selectedType === type.id
                            ? `border-${type.color}-500 bg-${type.color}-50`
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`h-6 w-6 mx-auto mb-2 text-${type.color}-600`} />
                        <p className="text-xs font-medium text-gray-900">{type.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Amount */}
                <div>
                  <Label htmlFor="amount">Amount (₹) *</Label>
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
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      placeholder="10-digit mobile number"
                      maxLength={10}
                      required
                    />
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
                    <div>
                      <Label htmlFor="card_type">Card Type *</Label>
                      <select
                        id="card_type"
                        value={formData.card_type}
                        onChange={(e) => setFormData({ ...formData, card_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select card type</option>
                        <option value="visa">Visa</option>
                        <option value="mastercard">Mastercard</option>
                        <option value="rupay">RuPay</option>
                        <option value="amex">American Express</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="bank_name">Issuing Bank *</Label>
                      <Input
                        id="bank_name"
                        value={formData.bank_name}
                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                        placeholder="e.g., HDFC Bank, SBI"
                        required
                      />
                    </div>
                  </>
                )}

                {currentType.fields.includes('loan_account') && (
                  <>
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
                      <Label htmlFor="borrower_name">Borrower Name *</Label>
                      <Input
                        id="borrower_name"
                        value={formData.borrower_name}
                        onChange={(e) => setFormData({ ...formData, borrower_name: e.target.value })}
                        placeholder="Name of borrower"
                        required
                      />
                    </div>
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
                        <option value="car_loan">Car Loan</option>
                        <option value="education_loan">Education Loan</option>
                        <option value="business_loan">Business Loan</option>
                        <option value="other">Other</option>
                      </select>
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

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {loading ? 'Submitting...' : 'Submit Request'}
                </Button>
              </form>
            </Card>
          </div>

          {/* Right: Balance & Info */}
          <div className="space-y-6">
            {/* PRC Balance */}
            <Card className="p-6 bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              <p className="text-sm opacity-90 mb-2">Available PRC Balance</p>
              <p className="text-4xl font-bold">{user.prc_balance?.toFixed(2) || '0.00'}</p>
              <p className="text-xs opacity-75 mt-2">100 INR = 1000 PRC</p>
            </Card>

            {/* How it Works */}
            <Card className="p-6">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-600" />
                How It Works
              </h3>
              <ol className="text-sm text-gray-700 space-y-2">
                <li>1. Select service type</li>
                <li>2. Enter amount and details</li>
                <li>3. PRC deducted immediately</li>
                <li>4. Admin processes request</li>
                <li>5. Recharge/payment completed</li>
              </ol>
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                <p className="text-xs text-yellow-800">
                  <strong>Note:</strong> Service charges apply. PRC will be refunded if request is rejected.
                </p>
              </div>
            </Card>

            {/* Security Note for Important Services */}
            {(selectedType === 'credit_card_payment' || selectedType === 'loan_emi') && (
              <Card className="p-6 bg-red-50 border-2 border-red-200">
                <h3 className="font-bold text-red-900 mb-3 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  Important Security Notice
                </h3>
                <ul className="text-xs text-red-800 space-y-2">
                  <li>✓ Only provide last 4 digits of card</li>
                  <li>✓ Never share full card number or CVV</li>
                  <li>✓ Verify bank/lender name correctly</li>
                  <li>✓ Double-check account details before submitting</li>
                  <li>✓ Admin will verify with bank/NBFC before processing</li>
                </ul>
              </Card>
            )}
          </div>
        </div>

        {/* Request History */}
        <Card className="p-6 mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Request History</h2>
          
          {requests.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No requests yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">PRC Deducted</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.request_id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm">{getTypeLabel(req.request_type)}</td>
                      <td className="py-3 px-4 text-sm font-medium">₹{req.amount_inr}</td>
                      <td className="py-3 px-4 text-sm">{req.total_prc_deducted.toFixed(2)} PRC</td>
                      <td className="py-3 px-4">{getStatusBadge(req.status)}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default BillPayments;
