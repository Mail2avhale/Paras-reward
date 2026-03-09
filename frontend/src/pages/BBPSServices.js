import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  ArrowLeft, Smartphone, Tv, Zap, CreditCard, Car, Building2,
  Wallet, Shield, Droplets, Search, Loader2, CheckCircle2,
  XCircle, Clock, AlertCircle, RefreshCw, Receipt, ChevronRight
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Service categories with icons
const SERVICE_CATEGORIES = [
  { id: 'mobile_prepaid', name: 'Mobile Prepaid', icon: Smartphone, color: 'from-blue-500 to-blue-600' },
  { id: 'dth', name: 'DTH', icon: Tv, color: 'from-purple-500 to-purple-600' },
  { id: 'electricity', name: 'Electricity', icon: Zap, color: 'from-yellow-500 to-orange-500' },
  { id: 'fastag', name: 'FASTag', icon: Car, color: 'from-green-500 to-green-600' },
  { id: 'emi', name: 'Loan / EMI', icon: Building2, color: 'from-red-500 to-red-600' },
  { id: 'credit_card', name: 'Credit Card', icon: CreditCard, color: 'from-pink-500 to-pink-600' },
  { id: 'insurance', name: 'Insurance', icon: Shield, color: 'from-indigo-500 to-indigo-600' },
  { id: 'water', name: 'Water', icon: Droplets, color: 'from-cyan-500 to-cyan-600' },
];

// Transaction status colors
const TX_STATUS = {
  0: { label: 'Success', color: 'text-green-400', bg: 'bg-green-500/20', icon: CheckCircle2 },
  1: { label: 'Failed', color: 'text-red-400', bg: 'bg-red-500/20', icon: XCircle },
  2: { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: Clock },
  3: { label: 'Refund Pending', color: 'text-orange-400', bg: 'bg-orange-500/20', icon: RefreshCw },
  4: { label: 'Refunded', color: 'text-blue-400', bg: 'bg-blue-500/20', icon: RefreshCw },
  5: { label: 'On Hold', color: 'text-purple-400', bg: 'bg-purple-500/20', icon: AlertCircle },
};

const BBPSServices = ({ user }) => {
  const navigate = useNavigate();
  
  // State
  const [step, setStep] = useState(1); // 1: Category, 2: Operator, 3: Form, 4: Confirm, 5: Result
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [operators, setOperators] = useState([]);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [operatorParams, setOperatorParams] = useState([]);
  const [formData, setFormData] = useState({});
  const [billData, setBillData] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [transaction, setTransaction] = useState(null);
  const [pollingTxId, setPollingTxId] = useState(null);
  
  // Fetch operators for category
  const fetchOperators = useCallback(async (category) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/bbps/operators/${category}`);
      if (response.data.success !== false) {
        setOperators(response.data.operators || []);
      } else {
        toast.error(response.data.message || 'Failed to load operators');
      }
    } catch (error) {
      console.error('Error fetching operators:', error);
      toast.error('Failed to load service providers');
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Fetch operator params
  const fetchOperatorParams = useCallback(async (operatorId) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/bbps/operator-params/${operatorId}`);
      if (response.data.success) {
        setOperatorParams(response.data.parameters || []);
        setSelectedOperator({
          ...selectedOperator,
          operator_name: response.data.operator_name,
          supports_bill_fetch: response.data.supports_bill_fetch,
          is_bbps: response.data.is_bbps
        });
      }
    } catch (error) {
      console.error('Error fetching params:', error);
      toast.error('Failed to load form fields');
    } finally {
      setLoading(false);
    }
  }, [selectedOperator]);
  
  // Fetch bill
  const fetchBill = async () => {
    if (!selectedOperator) return;
    
    setLoading(true);
    try {
      const payload = {
        operator_id: selectedOperator.operator_id,
        account: formData.utility_acc_no || formData.account || '',
        mobile: formData.confirmation_mobile_no || user?.mobile || '9999999999',
        sender_name: user?.name || 'Customer',
        additional_params: {}
      };
      
      // Add additional params from form
      operatorParams.forEach(param => {
        if (param.param_name !== 'utility_acc_no' && formData[param.param_name]) {
          payload.additional_params[param.param_name] = formData[param.param_name];
        }
      });
      
      const response = await axios.post(`${API}/bbps/fetch`, payload);
      
      if (response.data.success) {
        setBillData(response.data);
        setAmount(response.data.bill_amount || '');
        toast.success('Bill fetched successfully!');
        setStep(4);
      } else {
        toast.error(response.data.user_message || 'Failed to fetch bill');
        // Allow manual amount entry
        if (response.data.status === 'NO_BILL_DUE') {
          toast.info('No pending bill. You can enter amount for advance payment.');
          setStep(4);
        }
      }
    } catch (error) {
      console.error('Error fetching bill:', error);
      toast.error('Failed to fetch bill details');
    } finally {
      setLoading(false);
    }
  };
  
  // Pay bill
  const payBill = async () => {
    if (!amount || parseFloat(amount) < 1) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        operator_id: selectedOperator.operator_id,
        account: formData.utility_acc_no || formData.account || '',
        amount: amount,
        mobile: formData.confirmation_mobile_no || user?.mobile || '9999999999',
        sender_name: user?.name || 'Customer',
        bill_fetch_response: billData?.bill_fetch_response || ''
      };
      
      const response = await axios.post(`${API}/bbps/pay`, payload);
      
      setTransaction(response.data);
      setStep(5);
      
      if (response.data.success) {
        toast.success('Payment successful!');
      } else if (response.data.tx_status === 2) {
        toast.info('Payment is being processed...');
        // Start polling
        if (response.data.tid) {
          setPollingTxId(response.data.tid);
        }
      } else {
        toast.error(response.data.user_message || 'Payment failed');
      }
    } catch (error) {
      console.error('Error paying bill:', error);
      toast.error('Payment failed. Please try again.');
      setTransaction({ success: false, message: error.message });
      setStep(5);
    } finally {
      setLoading(false);
    }
  };
  
  // Poll transaction status
  useEffect(() => {
    if (!pollingTxId) return;
    
    const pollInterval = setInterval(async () => {
      try {
        const response = await axios.get(`${API}/bbps/status/${pollingTxId}`);
        if (response.data.tx_status !== 2 && response.data.tx_status !== 5) {
          // Final state reached
          setTransaction(response.data);
          setPollingTxId(null);
          if (response.data.tx_status === 0) {
            toast.success('Payment confirmed!');
          } else if (response.data.tx_status === 1) {
            toast.error('Payment failed');
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 10000); // Poll every 10 seconds
    
    // Stop polling after 5 minutes
    const timeout = setTimeout(() => {
      setPollingTxId(null);
      toast.info('Status check stopped. Please check transaction history.');
    }, 300000);
    
    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [pollingTxId]);
  
  // Filter operators by search
  const filteredOperators = operators.filter(op =>
    op.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Handle category selection
  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setSelectedOperator(null);
    setOperatorParams([]);
    setFormData({});
    setBillData(null);
    setAmount('');
    fetchOperators(category.id);
    setStep(2);
  };
  
  // Handle operator selection
  const handleOperatorSelect = (operator) => {
    setSelectedOperator(operator);
    setFormData({});
    setBillData(null);
    setAmount('');
    fetchOperatorParams(operator.operator_id);
    setStep(3);
  };
  
  // Handle form input
  const handleInputChange = (paramName, value) => {
    setFormData(prev => ({ ...prev, [paramName]: value }));
  };
  
  // Validate form
  const validateForm = () => {
    for (const param of operatorParams) {
      const value = formData[param.param_name] || '';
      if (param.is_mandatory !== false && !value) {
        toast.error(`${param.param_label} is required`);
        return false;
      }
      if (param.regex && value) {
        const regex = new RegExp(param.regex);
        if (!regex.test(value)) {
          toast.error(param.error_message || `Invalid ${param.param_label}`);
          return false;
        }
      }
    }
    return true;
  };
  
  // Handle form submit
  const handleFormSubmit = () => {
    if (!validateForm()) return;
    
    if (selectedOperator?.supports_bill_fetch) {
      fetchBill();
    } else {
      // Direct payment (no bill fetch)
      setStep(4);
    }
  };
  
  // Reset to start
  const resetFlow = () => {
    setStep(1);
    setSelectedCategory(null);
    setSelectedOperator(null);
    setOperatorParams([]);
    setFormData({});
    setBillData(null);
    setAmount('');
    setTransaction(null);
    setPollingTxId(null);
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}
            className="p-2 hover:bg-zinc-800 rounded-xl transition-colors"
            data-testid="back-button"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold">Bill Payments</h1>
            <p className="text-xs text-zinc-500">
              {step === 1 && 'Select Service'}
              {step === 2 && selectedCategory?.name}
              {step === 3 && selectedOperator?.name}
              {step === 4 && 'Confirm Payment'}
              {step === 5 && 'Payment Status'}
            </p>
          </div>
        </div>
      </div>
      
      <div className="max-w-lg mx-auto px-4 py-4">
        
        {/* Step 1: Category Selection */}
        {step === 1 && (
          <div className="space-y-4" data-testid="category-selection">
            <p className="text-zinc-400 text-sm">Choose a service to pay</p>
            <div className="grid grid-cols-2 gap-3">
              {SERVICE_CATEGORIES.map((category) => {
                const Icon = category.icon;
                return (
                  <Card
                    key={category.id}
                    className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 cursor-pointer transition-all hover:scale-[1.02]"
                    onClick={() => handleCategorySelect(category)}
                    data-testid={`category-${category.id}`}
                  >
                    <div className="p-4 flex flex-col items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${category.color} flex items-center justify-center`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-medium text-center">{category.name}</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Step 2: Operator Selection */}
        {step === 2 && (
          <div className="space-y-4" data-testid="operator-selection">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                placeholder="Search provider..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-900 border-zinc-800"
                data-testid="operator-search"
              />
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {filteredOperators.map((operator) => (
                  <Card
                    key={operator.operator_id}
                    className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors"
                    onClick={() => handleOperatorSelect(operator)}
                    data-testid={`operator-${operator.operator_id}`}
                  >
                    <div className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{operator.name}</p>
                        <p className="text-xs text-zinc-500">
                          {operator.supports_bill_fetch ? 'Bill Fetch Available' : 'Direct Payment'}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-500" />
                    </div>
                  </Card>
                ))}
                {filteredOperators.length === 0 && (
                  <p className="text-center text-zinc-500 py-8">No providers found</p>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Step 3: Form */}
        {step === 3 && (
          <div className="space-y-4" data-testid="payment-form">
            <Card className="bg-zinc-900/50 border-zinc-800 p-4">
              <div className="flex items-center gap-3 mb-4">
                {selectedCategory && (
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${selectedCategory.color} flex items-center justify-center`}>
                    {React.createElement(selectedCategory.icon, { className: 'w-5 h-5 text-white' })}
                  </div>
                )}
                <div>
                  <p className="font-medium">{selectedOperator?.operator_name || selectedOperator?.name}</p>
                  <p className="text-xs text-zinc-500">{selectedCategory?.name}</p>
                </div>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                </div>
              ) : (
                <div className="space-y-4">
                  {operatorParams.map((param) => (
                    <div key={param.param_name} className="space-y-2">
                      <Label className="text-sm text-zinc-400">{param.param_label}</Label>
                      <Input
                        type={param.param_type === 'Numeric' ? 'tel' : 'text'}
                        placeholder={param.error_message?.match(/eg\.\s*([^\)]+)/)?.[1] || param.param_label}
                        value={formData[param.param_name] || ''}
                        onChange={(e) => handleInputChange(param.param_name, e.target.value)}
                        className="bg-zinc-800 border-zinc-700"
                        data-testid={`input-${param.param_name}`}
                      />
                      {param.error_message && (
                        <p className="text-xs text-zinc-500">{param.error_message}</p>
                      )}
                    </div>
                  ))}
                  
                  {/* Mobile number for confirmation */}
                  <div className="space-y-2">
                    <Label className="text-sm text-zinc-400">Mobile Number (for updates)</Label>
                    <Input
                      type="tel"
                      placeholder="10 digit mobile number"
                      value={formData.confirmation_mobile_no || ''}
                      onChange={(e) => handleInputChange('confirmation_mobile_no', e.target.value)}
                      className="bg-zinc-800 border-zinc-700"
                      maxLength={10}
                      data-testid="input-mobile"
                    />
                  </div>
                  
                  {/* If no bill fetch, show amount field */}
                  {!selectedOperator?.supports_bill_fetch && (
                    <div className="space-y-2">
                      <Label className="text-sm text-zinc-400">Amount (₹)</Label>
                      <Input
                        type="number"
                        placeholder="Enter amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-zinc-800 border-zinc-700"
                        data-testid="input-amount"
                      />
                    </div>
                  )}
                  
                  <Button
                    onClick={handleFormSubmit}
                    className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                    disabled={loading}
                    data-testid="submit-form"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    {selectedOperator?.supports_bill_fetch ? 'Fetch Bill' : 'Continue'}
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}
        
        {/* Step 4: Confirm Payment */}
        {step === 4 && (
          <div className="space-y-4" data-testid="confirm-payment">
            <Card className="bg-zinc-900/50 border-zinc-800 p-4">
              <h3 className="font-semibold mb-4">Payment Details</h3>
              
              {billData && (
                <div className="space-y-3 mb-4 p-3 bg-zinc-800/50 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Customer Name</span>
                    <span className="font-medium">{billData.customer_name || 'N/A'}</span>
                  </div>
                  {billData.bill_date && (
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Bill Date</span>
                      <span>{billData.bill_date}</span>
                    </div>
                  )}
                  {billData.due_date && (
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Due Date</span>
                      <span className="text-orange-400">{billData.due_date}</span>
                    </div>
                  )}
                </div>
              )}
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Service</span>
                  <span>{selectedCategory?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Provider</span>
                  <span>{selectedOperator?.operator_name || selectedOperator?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Account</span>
                  <span>{formData.utility_acc_no || formData.account || 'N/A'}</span>
                </div>
              </div>
              
              {/* Amount input */}
              <div className="mt-4 space-y-2">
                <Label className="text-sm text-zinc-400">Amount (₹)</Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-2xl font-bold text-center"
                  data-testid="confirm-amount"
                />
              </div>
              
              {/* Warning for non-BBPS */}
              {!selectedOperator?.is_bbps && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-xs text-yellow-400">
                    This provider is not BBPS registered. Payment will be processed directly.
                  </p>
                </div>
              )}
              
              <Button
                onClick={payBill}
                className="w-full mt-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 h-12 text-lg"
                disabled={loading || !amount}
                data-testid="pay-button"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Wallet className="w-5 h-5 mr-2" />
                )}
                Pay ₹{amount || '0'}
              </Button>
            </Card>
          </div>
        )}
        
        {/* Step 5: Result */}
        {step === 5 && transaction && (
          <div className="space-y-4" data-testid="payment-result">
            <Card className="bg-zinc-900/50 border-zinc-800 p-6 text-center">
              {/* Status Icon */}
              {(() => {
                const status = TX_STATUS[transaction.tx_status] || TX_STATUS[transaction.success ? 0 : 1];
                const Icon = status?.icon || AlertCircle;
                return (
                  <div className={`w-20 h-20 mx-auto rounded-full ${status?.bg} flex items-center justify-center mb-4`}>
                    <Icon className={`w-10 h-10 ${status?.color}`} />
                  </div>
                );
              })()}
              
              <h2 className="text-xl font-bold mb-2">
                {TX_STATUS[transaction.tx_status]?.label || (transaction.success ? 'Success' : 'Failed')}
              </h2>
              
              <p className="text-zinc-400 mb-4">
                {transaction.user_message || transaction.message}
              </p>
              
              {/* Transaction Details */}
              <div className="bg-zinc-800/50 rounded-lg p-4 text-left space-y-2">
                {transaction.tid && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Transaction ID</span>
                    <span className="font-mono text-xs">{transaction.tid}</span>
                  </div>
                )}
                {transaction.bbps_ref && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">BBPS Ref</span>
                    <span className="font-mono text-xs">{transaction.bbps_ref}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Amount</span>
                  <span className="font-semibold">₹{amount}</span>
                </div>
              </div>
              
              {/* Polling indicator */}
              {pollingTxId && (
                <div className="mt-4 flex items-center justify-center gap-2 text-yellow-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Checking payment status...</span>
                </div>
              )}
              
              {/* Actions */}
              <div className="mt-6 space-y-2">
                <Button
                  onClick={resetFlow}
                  className="w-full bg-zinc-800 hover:bg-zinc-700"
                  data-testid="new-payment"
                >
                  <Receipt className="w-4 h-4 mr-2" />
                  New Payment
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  className="w-full border-zinc-700"
                >
                  Go to Dashboard
                </Button>
              </div>
            </Card>
          </div>
        )}
        
      </div>
    </div>
  );
};

export default BBPSServices;
