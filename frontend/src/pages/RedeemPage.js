import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Smartphone, Tv, Zap, Flame, Cylinder, CreditCard, Building, ArrowRight,
  ChevronLeft, Check, Loader2, AlertCircle, History, Search
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Service Configuration
const SERVICES = [
  { id: 'mobile_recharge', name: 'Mobile', icon: Smartphone, color: '#4CAF50', gradient: 'from-green-500 to-green-600' },
  { id: 'dth', name: 'DTH', icon: Tv, color: '#9C27B0', gradient: 'from-purple-500 to-purple-600' },
  { id: 'electricity', name: 'Electricity', icon: Zap, color: '#FF9800', gradient: 'from-amber-500 to-amber-600' },
  { id: 'gas', name: 'Gas', icon: Flame, color: '#F44336', gradient: 'from-red-500 to-red-600' },
  { id: 'lpg', name: 'LPG', icon: Cylinder, color: '#E91E63', gradient: 'from-pink-500 to-pink-600' },
  { id: 'emi', name: 'EMI', icon: Building, color: '#2196F3', gradient: 'from-blue-500 to-blue-600' },
  { id: 'credit_card', name: 'Credit Card', icon: CreditCard, color: '#00BCD4', gradient: 'from-cyan-500 to-cyan-600' },
  { id: 'dmt', name: 'Bank Transfer', icon: Building, color: '#607D8B', gradient: 'from-slate-500 to-slate-600' },
];

export default function RedeemPage() {
  // Get user from localStorage
  const [user, setUser] = useState(null);
  const [prcBalance, setPrcBalance] = useState(0);
  
  useEffect(() => {
    const storedUser = localStorage.getItem('paras_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        setPrcBalance(parsed.prc_balance || 0);
      } catch (e) {
        console.error('Error parsing user:', e);
      }
    }
  }, []);
  
  const [activeTab, setActiveTab] = useState('services'); // services, form, confirm, history
  const [selectedService, setSelectedService] = useState(null);
  const [operators, setOperators] = useState([]);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [operatorParams, setOperatorParams] = useState([]);
  const [formData, setFormData] = useState({
    utility_acc_no: '',
    amount: '',
    beneficiary_name: '',
    bank_account: '',
    ifsc_code: '',
    sender_name: 'Customer'
  });
  const [charges, setCharges] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingOperators, setLoadingOperators] = useState(false);
  const [myRequests, setMyRequests] = useState([]);

  // Fetch operators when service is selected
  useEffect(() => {
    if (selectedService && selectedService.id !== 'dmt') {
      fetchOperators(selectedService.id);
    }
  }, [selectedService]);

  // Fetch operator parameters when operator is selected
  useEffect(() => {
    if (selectedOperator) {
      fetchOperatorParams(selectedOperator.id);
    }
  }, [selectedOperator]);

  // Calculate charges when amount changes
  useEffect(() => {
    if (selectedService && formData.amount && parseFloat(formData.amount) > 0) {
      calculateCharges();
    }
  }, [selectedService, formData.amount]);

  const fetchOperators = async (serviceType) => {
    setLoadingOperators(true);
    try {
      const res = await axios.get(`${API}/redeem/operators/${serviceType}`);
      if (res.data.success) {
        setOperators(res.data.operators || []);
      }
    } catch (error) {
      console.error('Error fetching operators:', error);
      toast.error('Failed to load operators');
    } finally {
      setLoadingOperators(false);
    }
  };

  const fetchOperatorParams = async (operatorId) => {
    try {
      const res = await axios.get(`${API}/redeem/operator-params/${operatorId}`);
      if (res.data.success) {
        setOperatorParams(res.data.parameters || []);
      }
    } catch (error) {
      console.error('Error fetching parameters:', error);
    }
  };

  const calculateCharges = async () => {
    try {
      const res = await axios.post(`${API}/redeem/calculate-charges`, {
        service_type: selectedService.id,
        amount: parseFloat(formData.amount)
      });
      if (res.data.success) {
        setCharges(res.data);
      }
    } catch (error) {
      console.error('Error calculating charges:', error);
    }
  };

  const fetchMyRequests = async () => {
    try {
      const res = await axios.get(`${API}/redeem/my-requests?user_id=${user?.uid}`);
      if (res.data.success) {
        setMyRequests(res.data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const handleServiceSelect = (service) => {
    setSelectedService(service);
    setSelectedOperator(null);
    setOperatorParams([]);
    setFormData({ ...formData, utility_acc_no: '', amount: '' });
    setCharges(null);
    setActiveTab('form');
  };

  const handleSubmit = async () => {
    if (!charges || !selectedService) return;
    
    // Validate
    if (!formData.utility_acc_no) {
      toast.error('Please enter account/mobile number');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) < 10) {
      toast.error('Minimum amount is ₹10');
      return;
    }
    if (selectedService.id !== 'dmt' && !selectedOperator) {
      toast.error('Please select operator');
      return;
    }
    if (charges.total_prc_required > prcBalance) {
      toast.error(`Insufficient PRC balance. Required: ${charges.total_prc_required.toFixed(2)}`);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/redeem/request`, {
        user_id: user.uid,
        service_type: selectedService.id,
        operator_id: selectedOperator?.id || 'dmt',
        utility_acc_no: formData.utility_acc_no,
        amount: parseFloat(formData.amount),
        beneficiary_name: formData.beneficiary_name,
        bank_account: formData.bank_account,
        ifsc_code: formData.ifsc_code,
        sender_name: formData.sender_name || user?.name
      });

      if (res.data.success) {
        toast.success('Request submitted successfully!');
        // Reset
        setSelectedService(null);
        setSelectedOperator(null);
        setFormData({ utility_acc_no: '', amount: '', beneficiary_name: '', bank_account: '', ifsc_code: '', sender_name: '' });
        setCharges(null);
        setActiveTab('services');
        fetchMyRequests();
      } else {
        toast.error(res.data.message || 'Failed to submit request');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-500 bg-green-500/10';
      case 'pending': return 'text-amber-500 bg-amber-500/10';
      case 'processing': return 'text-blue-500 bg-blue-500/10';
      case 'failed': return 'text-red-500 bg-red-500/10';
      case 'rejected': return 'text-red-500 bg-red-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {activeTab !== 'services' && (
              <button
                onClick={() => {
                  if (activeTab === 'form') setActiveTab('services');
                  else if (activeTab === 'confirm') setActiveTab('form');
                  else setActiveTab('services');
                }}
                className="p-2 rounded-full hover:bg-white/10 transition"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
            )}
            <h1 className="text-xl font-bold text-white flex-1 text-center">
              {activeTab === 'services' && 'Redeem PRC'}
              {activeTab === 'form' && selectedService?.name}
              {activeTab === 'confirm' && 'Confirm'}
              {activeTab === 'history' && 'History'}
            </h1>
            <button
              onClick={() => { setActiveTab('history'); fetchMyRequests(); }}
              className={`p-2 rounded-full transition ${activeTab === 'history' ? 'bg-purple-500' : 'hover:bg-white/10'}`}
            >
              <History className="w-6 h-6 text-white" />
            </button>
          </div>
          
          {/* Balance Card */}
          <div className="mt-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-4">
            <p className="text-white/70 text-sm">Available PRC Balance</p>
            <p className="text-3xl font-bold text-white">{prcBalance?.toFixed(2) || '0.00'}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Services Grid */}
        {activeTab === 'services' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white/80">Select Service</h2>
            <div className="grid grid-cols-4 gap-3">
              {SERVICES.map(service => {
                const Icon = service.icon;
                return (
                  <button
                    key={service.id}
                    onClick={() => handleServiceSelect(service)}
                    className="flex flex-col items-center p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all duration-300 group"
                  >
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${service.gradient} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xs text-white/80 font-medium text-center">{service.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Stats */}
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-white/50 text-sm">Platform Fee</p>
                <p className="text-xl font-bold text-white">₹10 <span className="text-sm text-white/50">flat</span></p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-white/50 text-sm">Admin Charges</p>
                <p className="text-xl font-bold text-white">20% <span className="text-sm text-white/50">of amount</span></p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        {activeTab === 'form' && selectedService && (
          <div className="space-y-6">
            {/* Service Header */}
            <div className="flex items-center gap-4 bg-white/5 rounded-xl p-4 border border-white/10">
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${selectedService.gradient} flex items-center justify-center`}>
                {React.createElement(selectedService.icon, { className: "w-7 h-7 text-white" })}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedService.name}</h3>
                <p className="text-white/50 text-sm">Enter details below</p>
              </div>
            </div>

            {/* Operator Selection (not for DMT) */}
            {selectedService.id !== 'dmt' && (
              <div className="space-y-2">
                <label className="text-white/70 text-sm font-medium">Select Operator</label>
                {loadingOperators ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {operators.map(op => (
                      <button
                        key={op.id}
                        onClick={() => setSelectedOperator(op)}
                        className={`p-3 rounded-xl text-left transition-all ${
                          selectedOperator?.id === op.id
                            ? 'bg-purple-500 border-purple-400'
                            : 'bg-white/5 hover:bg-white/10 border-white/10'
                        } border`}
                      >
                        <span className={`text-sm font-medium ${selectedOperator?.id === op.id ? 'text-white' : 'text-white/80'}`}>
                          {op.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Account Number Field */}
            <div className="space-y-2">
              <label className="text-white/70 text-sm font-medium">
                {selectedService.id === 'mobile_recharge' ? 'Mobile Number' : 
                 selectedService.id === 'dmt' ? 'Beneficiary Mobile' : 'Account/Consumer Number'}
              </label>
              <input
                type="text"
                value={formData.utility_acc_no}
                onChange={(e) => setFormData({ ...formData, utility_acc_no: e.target.value })}
                placeholder={selectedService.id === 'mobile_recharge' ? '10 digit mobile' : 'Enter number'}
                className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-purple-500 text-lg"
                data-testid="utility-acc-input"
              />
            </div>

            {/* DMT specific fields */}
            {selectedService.id === 'dmt' && (
              <>
                <div className="space-y-2">
                  <label className="text-white/70 text-sm font-medium">Beneficiary Name</label>
                  <input
                    type="text"
                    value={formData.beneficiary_name}
                    onChange={(e) => setFormData({ ...formData, beneficiary_name: e.target.value })}
                    placeholder="Enter beneficiary name"
                    className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                    data-testid="beneficiary-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-white/70 text-sm font-medium">Bank Account Number</label>
                  <input
                    type="text"
                    value={formData.bank_account}
                    onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                    placeholder="Enter account number"
                    className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                    data-testid="bank-account-input"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-white/70 text-sm font-medium">IFSC Code</label>
                  <input
                    type="text"
                    value={formData.ifsc_code}
                    onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase() })}
                    placeholder="e.g., SBIN0001234"
                    className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-purple-500 uppercase"
                    data-testid="ifsc-input"
                  />
                </div>
              </>
            )}

            {/* Amount Field */}
            <div className="space-y-2">
              <label className="text-white/70 text-sm font-medium">Amount (₹)</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="Enter amount"
                min="10"
                className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-purple-500 text-2xl font-bold"
                data-testid="amount-input"
              />
            </div>

            {/* Charges Breakdown */}
            {charges && (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
                <h4 className="text-white font-medium">Charges Breakdown</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-white/70">
                    <span>Service Amount</span>
                    <span>₹{charges.breakdown.service_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-white/70">
                    <span>Eko Fee (est.)</span>
                    <span>₹{charges.breakdown.eko_fee_estimate.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-white/70">
                    <span>Platform Fee</span>
                    <span>₹{charges.breakdown.flat_fee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-white/70">
                    <span>Admin Charges (20%)</span>
                    <span>₹{charges.breakdown.admin_charges.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 mt-2">
                    <div className="flex justify-between text-white font-bold text-lg">
                      <span>Total PRC Required</span>
                      <span>₹{charges.total_prc_required.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                {charges.total_prc_required > prcBalance && (
                  <div className="flex items-center gap-2 text-red-400 bg-red-500/10 rounded-lg p-3 mt-3">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm">Insufficient balance</span>
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={loading || !charges || charges.total_prc_required > prcBalance}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-semibold text-lg flex items-center justify-center gap-2 transition-all"
              data-testid="submit-redeem-btn"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  Submit Request
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <p className="text-center text-white/40 text-xs">
              Request will be processed after admin approval
            </p>
          </div>
        )}

        {/* History */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {myRequests.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <p className="text-white/50">No requests yet</p>
              </div>
            ) : (
              myRequests.map(req => (
                <div key={req.request_id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{req.service_name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(req.status)}`}>
                        {req.status}
                      </span>
                    </div>
                    <span className="text-white font-bold">₹{req.service_amount}</span>
                  </div>
                  <div className="text-white/50 text-sm space-y-1">
                    <p>{req.operator_name} • {req.utility_acc_no}</p>
                    <p className="text-xs">{new Date(req.created_at).toLocaleString()}</p>
                  </div>
                  {req.eko_tid && (
                    <p className="text-green-400 text-xs mt-2">TID: {req.eko_tid}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
