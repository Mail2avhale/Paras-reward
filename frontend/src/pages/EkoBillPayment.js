import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  ArrowLeft, Zap, Droplets, Flame, Smartphone, Tv, Wifi, Car,
  Shield, CreditCard, GraduationCap, Building, Phone, Search,
  Loader2, CheckCircle, AlertCircle, Receipt, ChevronRight
} from 'lucide-react';
import SEO from '@/components/SEO';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Category Icons
const categoryIcons = {
  electricity: Zap,
  water: Droplets,
  gas: Flame,
  mobile_postpaid: Smartphone,
  landline: Phone,
  broadband: Wifi,
  dth: Tv,
  fastag: Car,
  insurance: Shield,
  loan_emi: CreditCard,
  credit_card: CreditCard,
  education: GraduationCap,
  municipal_tax: Building,
};

const EkoBillPayment = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Category, 2: Biller, 3: Details, 4: Confirm
  const [categories, setCategories] = useState([]);
  const [billers, setBillers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedBiller, setSelectedBiller] = useState(null);
  const [billDetails, setBillDetails] = useState(null);
  const [customerNumber, setCustomerNumber] = useState('');
  const [fetchingBill, setFetchingBill] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [ekoConfig, setEkoConfig] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch Eko config and categories on mount
  useEffect(() => {
    fetchEkoConfig();
    fetchCategories();
  }, []);

  const fetchEkoConfig = async () => {
    try {
      const response = await axios.get(`${API}/eko/config`);
      setEkoConfig(response.data);
    } catch (error) {
      console.error('Error fetching Eko config:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API}/eko/bbps/categories`);
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load bill categories');
    }
  };

  const fetchBillers = async (category) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/eko/bbps/billers/${category}`);
      setBillers(response.data.billers || []);
      setStep(2);
    } catch (error) {
      console.error('Error fetching billers:', error);
      toast.error('Failed to load billers');
    } finally {
      setLoading(false);
    }
  };

  const fetchBill = async () => {
    if (!customerNumber.trim()) {
      toast.error('Please enter customer/consumer number');
      return;
    }

    setFetchingBill(true);
    try {
      const response = await axios.post(`${API}/eko/bbps/fetch-bill`, {
        category: selectedCategory.id,
        biller_id: selectedBiller.id,
        customer_params: { consumer_number: customerNumber }
      });

      if (response.data.status === 0 || response.data.data) {
        setBillDetails(response.data.data || response.data);
        setStep(4);
        toast.success('Bill details fetched successfully');
      } else {
        toast.error(response.data.message || 'Failed to fetch bill');
      }
    } catch (error) {
      console.error('Error fetching bill:', error);
      toast.error(error.response?.data?.detail || 'Failed to fetch bill details');
    } finally {
      setFetchingBill(false);
    }
  };

  const handlePayBill = async () => {
    if (!billDetails) {
      toast.error('Please fetch bill details first');
      return;
    }

    setPaymentProcessing(true);
    try {
      const response = await axios.post(`${API}/eko/bbps/pay-bill`, {
        user_id: user.uid,
        category: selectedCategory.id,
        biller_id: selectedBiller.id,
        customer_params: { consumer_number: customerNumber },
        amount: parseFloat(billDetails.amount || billDetails.bill_amount),
        bill_fetch_ref: billDetails.ref_id
      });

      if (response.data.success) {
        toast.success('Bill payment initiated successfully!');
        // Show success screen
        setBillDetails(prev => ({ ...prev, payment_status: 'success', txn_ref: response.data.txn_ref }));
      } else {
        toast.error(response.data.message || 'Payment failed');
      }
    } catch (error) {
      console.error('Error paying bill:', error);
      toast.error(error.response?.data?.detail || 'Payment failed');
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    fetchBillers(category.id);
  };

  const handleBillerSelect = (biller) => {
    setSelectedBiller(biller);
    setStep(3);
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      if (step === 2) {
        setSelectedCategory(null);
        setBillers([]);
      } else if (step === 3) {
        setSelectedBiller(null);
        setCustomerNumber('');
      } else if (step === 4) {
        setBillDetails(null);
      }
    } else {
      navigate(-1);
    }
  };

  const resetFlow = () => {
    setStep(1);
    setSelectedCategory(null);
    setSelectedBiller(null);
    setBillDetails(null);
    setCustomerNumber('');
  };

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredBillers = billers.filter(biller =>
    biller.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <SEO 
        title="Pay Bills - BBPS"
        description="Pay your bills instantly using BBPS - Electricity, Water, Gas, Mobile, DTH and more"
        url="https://www.parasreward.com/eko-bills"
      />
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-gray-800">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={handleBack} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">Pay Bills</h1>
              <p className="text-xs text-gray-400">BBPS Instant Payments</p>
            </div>
            {ekoConfig?.configured && (
              <span className="ml-auto px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                LIVE
              </span>
            )}
          </div>

          {/* Progress Steps */}
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2">
              {['Category', 'Biller', 'Details', 'Pay'].map((label, i) => (
                <React.Fragment key={label}>
                  <div className={`flex items-center gap-1 ${step > i ? 'text-green-400' : step === i + 1 ? 'text-purple-400' : 'text-gray-600'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-purple-500 text-white' : 'bg-gray-800 text-gray-500'
                    }`}>
                      {step > i + 1 ? <CheckCircle className="w-4 h-4" /> : i + 1}
                    </div>
                    <span className="text-xs hidden sm:block">{label}</span>
                  </div>
                  {i < 3 && <div className={`flex-1 h-0.5 ${step > i + 1 ? 'bg-green-500' : 'bg-gray-800'}`} />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 py-4">
          {/* Step 1: Select Category */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Search category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-800/50 border-gray-700 text-white"
                />
              </div>

              {/* Categories Grid */}
              <div className="grid grid-cols-3 gap-3">
                {filteredCategories.map((category) => {
                  const Icon = categoryIcons[category.id] || Receipt;
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleCategorySelect(category)}
                      className="flex flex-col items-center gap-2 p-4 bg-gray-800/50 hover:bg-gray-800 rounded-xl border border-gray-700 hover:border-purple-500 transition-all"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-purple-400" />
                      </div>
                      <span className="text-xs text-gray-300 text-center">{category.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Select Biller */}
          {step === 2 && (
            <div className="space-y-4">
              <Card className="bg-gray-800/50 border-gray-700 p-3">
                <div className="flex items-center gap-3">
                  {React.createElement(categoryIcons[selectedCategory?.id] || Receipt, { className: "w-8 h-8 text-purple-400" })}
                  <div>
                    <p className="text-sm text-gray-400">Selected Category</p>
                    <p className="font-medium text-white">{selectedCategory?.name}</p>
                  </div>
                </div>
              </Card>

              {/* Search Billers */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Search biller..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-800/50 border-gray-700 text-white"
                />
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredBillers.map((biller) => (
                    <button
                      key={biller.id}
                      onClick={() => handleBillerSelect(biller)}
                      className="w-full flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-800 rounded-xl border border-gray-700 hover:border-purple-500 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                          <Building className="w-5 h-5 text-blue-400" />
                        </div>
                        <span className="text-sm text-white">{biller.name}</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    </button>
                  ))}
                  {filteredBillers.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No billers found</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Enter Details */}
          {step === 3 && (
            <div className="space-y-4">
              <Card className="bg-gray-800/50 border-gray-700 p-3">
                <div className="flex items-center gap-3">
                  <Building className="w-8 h-8 text-blue-400" />
                  <div>
                    <p className="text-sm text-gray-400">{selectedCategory?.name}</p>
                    <p className="font-medium text-white">{selectedBiller?.name}</p>
                  </div>
                </div>
              </Card>

              <div className="space-y-3">
                <Label className="text-gray-300">Consumer/Account Number</Label>
                <Input
                  placeholder="Enter your consumer number"
                  value={customerNumber}
                  onChange={(e) => setCustomerNumber(e.target.value)}
                  className="bg-gray-800/50 border-gray-700 text-white text-lg"
                />
                <p className="text-xs text-gray-500">
                  Enter the number as shown on your bill
                </p>
              </div>

              <Button
                onClick={fetchBill}
                disabled={fetchingBill || !customerNumber.trim()}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-6"
              >
                {fetchingBill ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Fetching Bill...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" />
                    Fetch Bill Details
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step 4: Confirm & Pay */}
          {step === 4 && billDetails && (
            <div className="space-y-4">
              {billDetails.payment_status === 'success' ? (
                // Success Screen
                <div className="text-center py-8 space-y-4">
                  <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-green-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Payment Successful!</h2>
                  <p className="text-gray-400">Your bill payment has been initiated</p>
                  <Card className="bg-gray-800/50 border-gray-700 p-4 text-left">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Transaction Ref</span>
                        <span className="text-white font-mono">{billDetails.txn_ref}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Amount</span>
                        <span className="text-green-400 font-bold">₹{billDetails.amount || billDetails.bill_amount}</span>
                      </div>
                    </div>
                  </Card>
                  <Button onClick={resetFlow} className="w-full bg-purple-500 hover:bg-purple-600">
                    Pay Another Bill
                  </Button>
                </div>
              ) : (
                // Bill Details & Pay
                <>
                  <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30 p-4">
                    <h3 className="text-lg font-bold text-white mb-4">Bill Details</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Biller</span>
                        <span className="text-white">{selectedBiller?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Consumer No.</span>
                        <span className="text-white font-mono">{customerNumber}</span>
                      </div>
                      {billDetails.customer_name && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Customer Name</span>
                          <span className="text-white">{billDetails.customer_name}</span>
                        </div>
                      )}
                      {billDetails.due_date && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Due Date</span>
                          <span className="text-yellow-400">{billDetails.due_date}</span>
                        </div>
                      )}
                      <div className="border-t border-gray-700 pt-3 mt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Amount</span>
                          <span className="text-2xl font-bold text-green-400">
                            ₹{billDetails.amount || billDetails.bill_amount || '0'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                      <div>
                        <p className="text-yellow-400 font-medium">Important</p>
                        <p className="text-yellow-400/70 text-sm">
                          Payment will be processed instantly. Please verify the details before proceeding.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handlePayBill}
                    disabled={paymentProcessing}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white py-6 text-lg font-bold"
                  >
                    {paymentProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing Payment...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5 mr-2" />
                        Pay ₹{billDetails.amount || billDetails.bill_amount || '0'}
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default EkoBillPayment;
