import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import PRCRateDisplay from '../components/PRCRateDisplay';
import CategoryLimitsDisplay from '../components/CategoryLimitsDisplay';
import {
  ArrowLeft, ArrowRight, Smartphone, Tv, Zap, Flame, Building, Banknote,
  CheckCircle, Clock, XCircle, AlertCircle, Info, ChevronRight,
  Wallet, Receipt, Loader2, RefreshCw, Search, X, Phone, Droplet, Wifi,
  PhoneCall, CreditCard, Shield, Car, GraduationCap, Monitor, Landmark, Home, Cylinder,
  Stethoscope, Play, Bus, IndianRupee, FileText
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Service configurations with icons and colors - ALL BBPS SERVICES
const SERVICE_CONFIG = {
  // Recharge Services
  mobile_recharge: { 
    name: 'Mobile Recharge', 
    icon: Smartphone, 
    color: 'blue',
    gradient: 'from-blue-500 to-cyan-500',
    fields: ['mobile_number', 'operator', 'circle', 'recharge_type'],
    category: 'recharge'
  },
  mobile_postpaid: { 
    name: 'Mobile Postpaid', 
    icon: Phone, 
    color: 'indigo',
    gradient: 'from-indigo-500 to-blue-500',
    fields: ['mobile_number', 'operator'],
    category: 'recharge'
  },
  dth: { 
    name: 'DTH Recharge', 
    icon: Tv, 
    color: 'purple',
    gradient: 'from-purple-500 to-pink-500',
    fields: ['consumer_number', 'operator'],
    category: 'recharge'
  },
  
  // Utility Bills
  electricity: { 
    name: 'Electricity', 
    icon: Zap, 
    color: 'yellow',
    gradient: 'from-yellow-500 to-orange-500',
    fields: ['consumer_number', 'operator'],
    category: 'utility'
  },
  gas: { 
    name: 'Gas Bill (PNG)', 
    icon: Flame, 
    color: 'orange',
    gradient: 'from-orange-500 to-red-500',
    fields: ['consumer_number', 'operator'],
    category: 'utility'
  },
  water: { 
    name: 'Water Bill', 
    icon: Droplet, 
    color: 'cyan',
    gradient: 'from-cyan-500 to-blue-500',
    fields: ['consumer_number', 'operator'],
    category: 'utility'
  },
  lpg: { 
    name: 'LPG Cylinder', 
    icon: Cylinder, 
    color: 'red',
    gradient: 'from-red-500 to-orange-500',
    fields: ['consumer_number', 'operator'],
    category: 'utility'
  },
  
  // Telecom
  broadband: { 
    name: 'Broadband', 
    icon: Wifi, 
    color: 'teal',
    gradient: 'from-teal-500 to-green-500',
    fields: ['consumer_number', 'operator'],
    category: 'telecom'
  },
  landline: { 
    name: 'Landline', 
    icon: PhoneCall, 
    color: 'slate',
    gradient: 'from-slate-500 to-gray-500',
    fields: ['consumer_number', 'operator'],
    category: 'telecom'
  },
  cable_tv: { 
    name: 'Cable TV', 
    icon: Monitor, 
    color: 'violet',
    gradient: 'from-violet-500 to-purple-500',
    fields: ['consumer_number', 'operator'],
    category: 'telecom'
  },
  
  // Financial Services
  emi: { 
    name: 'EMI Payment', 
    icon: Building, 
    color: 'rose',
    gradient: 'from-rose-500 to-pink-500',
    fields: ['loan_account', 'operator'],
    category: 'finance'
  },
  credit_card: { 
    name: 'Credit Card', 
    icon: CreditCard, 
    color: 'amber',
    gradient: 'from-amber-500 to-yellow-500',
    fields: ['card_number', 'operator'],
    category: 'finance'
  },
  insurance: { 
    name: 'Insurance', 
    icon: Shield, 
    color: 'emerald',
    gradient: 'from-emerald-500 to-green-500',
    fields: ['policy_number', 'operator'],
    category: 'finance'
  },
  
  // Transport & Others
  fastag: { 
    name: 'FASTag', 
    icon: Car, 
    color: 'sky',
    gradient: 'from-sky-500 to-blue-500',
    fields: ['vehicle_number', 'operator'],
    category: 'transport'
  },
  education: { 
    name: 'Education Fees', 
    icon: GraduationCap, 
    color: 'fuchsia',
    gradient: 'from-fuchsia-500 to-pink-500',
    fields: ['student_id', 'operator'],
    category: 'education'
  },
  municipal_tax: { 
    name: 'Municipal Tax', 
    icon: Landmark, 
    color: 'stone',
    gradient: 'from-stone-500 to-gray-500',
    fields: ['consumer_number', 'operator'],
    category: 'tax'
  },
  housing_society: { 
    name: 'Housing Society', 
    icon: Home, 
    color: 'lime',
    gradient: 'from-lime-500 to-green-500',
    fields: ['consumer_number', 'operator'],
    category: 'housing'
  },
  
  // Healthcare
  hospital: { 
    name: 'Hospital Payment', 
    icon: Stethoscope, 
    color: 'red',
    gradient: 'from-red-500 to-rose-500',
    fields: ['patient_id', 'operator'],
    category: 'healthcare'
  },
  
  // OTT & Subscriptions
  subscription: { 
    name: 'OTT & Subscription', 
    icon: Play, 
    color: 'pink',
    gradient: 'from-pink-500 to-rose-500',
    fields: ['subscriber_id', 'operator'],
    category: 'entertainment'
  },
  
  // Transport Services
  transport: { 
    name: 'Traffic Challan', 
    icon: Bus, 
    color: 'blue',
    gradient: 'from-blue-600 to-indigo-500',
    fields: ['challan_number', 'operator'],
    category: 'transport'
  },
  
  // Loan Repayment
  loan_repayment: { 
    name: 'Loan Repayment', 
    icon: IndianRupee, 
    color: 'green',
    gradient: 'from-green-500 to-emerald-500',
    fields: ['loan_account', 'operator'],
    category: 'finance'
  },
  
  // Municipal Corporation (Metro cities)
  municipal_corp: { 
    name: 'Municipal Corp (Metro)', 
    icon: Landmark, 
    color: 'gray',
    gradient: 'from-gray-500 to-slate-500',
    fields: ['consumer_number', 'operator'],
    category: 'tax'
  },
  
  // V1 Fund Transfer - DISABLED - Eko API not working
  // dmt: { 
  //   name: 'Bank Transfer', 
  //   icon: Banknote, 
  //   color: 'emerald',
  //   gradient: 'from-emerald-500 to-green-500',
  //   fields: ['recipient_name', 'account_number', 'ifsc_code'],
  //   category: 'transfer',
  //   requiresAdmin: false,
  //   isInstant: true,
  //   description: 'Direct IMPS transfer - No OTP required'
  // }
};

// Static operator data (will be replaced with Eko API data)
const OPERATORS = {
  mobile_recharge: [
    { id: 'JIO', name: 'Jio' },
    { id: 'AIRTEL', name: 'Airtel' },
    { id: 'VI', name: 'Vi (Vodafone Idea)' },
    { id: 'BSNL', name: 'BSNL' }
  ],
  mobile_postpaid: [
    { id: 'JIO', name: 'Jio Postpaid' },
    { id: 'AIRTEL', name: 'Airtel Postpaid' },
    { id: 'VI', name: 'Vi Postpaid' },
    { id: 'BSNL', name: 'BSNL Postpaid' }
  ],
  dth: [],
  electricity: [],
  gas: [],
  water: [],
  lpg: [
    { id: 'INDANE', name: 'Indane Gas' },
    { id: 'HP_GAS', name: 'HP Gas' },
    { id: 'BHARAT_GAS', name: 'Bharat Gas' }
  ],
  broadband: [],
  landline: [],
  cable_tv: [],
  emi: [],
  credit_card: [],
  insurance: [],
  fastag: [],
  education: [],
  municipal_tax: [],
  housing_society: [],
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

// Reusable Service Category Section Component - Premium Glass Design
const ServiceCategorySection = ({ title, services, selectedService, setSelectedService }) => {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-4 bg-gradient-to-b from-amber-400 to-orange-500 rounded-full" />
        <p className="text-sm text-gray-300 font-semibold tracking-wide">{title}</p>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {services.map(id => {
          const config = SERVICE_CONFIG[id];
          if (!config) return null;
          const Icon = config.icon;
          const isSelected = selectedService === id;
          
          return (
            <button
              key={id}
              onClick={() => setSelectedService(id)}
              className={`group relative overflow-hidden rounded-2xl transition-all duration-300 ${
                isSelected
                  ? 'scale-[1.02] shadow-xl'
                  : 'hover:scale-[1.02] hover:shadow-lg'
              }`}
              data-testid={`service-${id}`}
            >
              {/* Background with gradient */}
              <div className={`absolute inset-0 transition-opacity duration-300 ${
                isSelected 
                  ? 'opacity-100' 
                  : 'opacity-0 group-hover:opacity-50'
              }`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient}`} />
              </div>
              
              {/* Glass card */}
              <div className={`relative p-4 backdrop-blur-sm border transition-all duration-300 ${
                isSelected
                  ? 'bg-white/10 border-white/30'
                  : 'bg-gray-800/60 border-gray-700/50 group-hover:bg-gray-800/80 group-hover:border-gray-600/50'
              }`} style={{ borderRadius: 'inherit' }}>
                
                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  </div>
                )}
                
                {/* Icon container with glow effect */}
                <div className={`relative w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  isSelected 
                    ? 'bg-white/20 shadow-lg' 
                    : `bg-gradient-to-br ${config.gradient} opacity-80 group-hover:opacity-100`
                }`}>
                  {/* Glow effect */}
                  {isSelected && (
                    <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${config.gradient} blur-md opacity-50`} />
                  )}
                  <Icon className={`relative h-6 w-6 transition-all duration-300 ${
                    isSelected ? 'text-white' : 'text-white'
                  }`} />
                </div>
                
                {/* Service name */}
                <p className={`text-xs font-medium text-center leading-tight transition-colors duration-300 ${
                  isSelected ? 'text-white' : 'text-gray-300 group-hover:text-white'
                }`}>
                  {config.name}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

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
  const [operatorsError, setOperatorsError] = useState(null); // Track operator loading errors
  
  // Quick Pay - Recently used payments
  const [quickPayItems, setQuickPayItems] = useState([]);
  
  // Bank/IFSC search states
  const [bankSearch, setBankSearch] = useState('');
  const [bankList, setBankList] = useState([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [ifscDetails, setIfscDetails] = useState(null);
  const [loadingIfsc, setLoadingIfsc] = useState(false);
  
  // DMT Customer & Recipient states
  const [dmtStep, setDmtStep] = useState(1); // 1=Mobile, 2=Verify, 3=Recipient, 4=Amount
  const [dmtCustomer, setDmtCustomer] = useState(null);
  const [dmtRecipientId, setDmtRecipientId] = useState(null);
  const [existingRecipients, setExistingRecipients] = useState([]);
  const [verifyingCustomer, setVerifyingCustomer] = useState(false);
  const [addingRecipient, setAddingRecipient] = useState(false);
  const [senderMobile, setSenderMobile] = useState('');
  
  // Account Verification states (Pre-transfer verification)
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [accountVerified, setAccountVerified] = useState(false);
  const [verifiedAccountDetails, setVerifiedAccountDetails] = useState(null);
  
  // EMI lender search states
  const [lenderSearch, setLenderSearch] = useState('');
  const [showLenderDropdown, setShowLenderDropdown] = useState(false);
  
  // Auto-detect operator states
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [autoDetection, setAutoDetection] = useState(null);
  const [autoDetectedPlans, setAutoDetectedPlans] = useState([]);
  
  // Bill fetch states (for gas, water, etc.)
  const [billDetails, setBillDetails] = useState(null);
  const [fetchingBill, setFetchingBill] = useState(false);
  const [billError, setBillError] = useState(null);
  const [operatorParams, setOperatorParams] = useState(null); // Operator specific parameters from Eko
  
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
    account_holder: '',
    selected_bank: null,
    selected_lender: null,
    // New service fields
    card_number: '',
    policy_number: '',
    vehicle_number: '',
    student_id: '',
    lpg_id: '',
    // New categories fields
    patient_id: '',        // Hospital
    subscriber_id: '',     // OTT/Subscription
    challan_number: '',    // Traffic Challan/Transport
    // Additional operator params (like BU for MSEDCL)
    additional_param_1: '',
    additional_param_2: ''
  });
  
  // Charges calculation
  const [charges, setCharges] = useState(null);
  
  // Global Redeem Limit
  const [redeemLimit, setRedeemLimit] = useState(null);
  
  // PRC Rate for INR conversion (fetched from settings)
  const [prcRate, setPrcRate] = useState(10);
  
  // Fetch PRC Rate from public settings
  useEffect(() => {
    const fetchPrcRate = async () => {
      try {
        const res = await axios.get(`${API}/settings/public`);
        if (res.data?.prc_to_inr_rate) {
          setPrcRate(res.data.prc_to_inr_rate);
        }
      } catch (error) {
        console.error('Error fetching PRC rate:', error);
      }
    };
    fetchPrcRate();
  }, []);
  
  // Fetch Global Redeem Limit
  useEffect(() => {
    const fetchRedeemLimit = async () => {
      if (!user?.uid) return;
      try {
        const res = await axios.get(`${API}/user/${user.uid}/redeem-limit`);
        if (res.data?.success) {
          setRedeemLimit(res.data.limit);
        }
      } catch (error) {
        console.error('Error fetching redeem limit:', error);
      }
    };
    fetchRedeemLimit();
  }, [user?.uid]);
  
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
    loadQuickPayItems();
    
    // Handle "Pay Again" from URL params
    const operatorFromUrl = searchParams.get('operator');
    const accountFromUrl = searchParams.get('account');
    if (operatorFromUrl || accountFromUrl) {
      setFormData(prev => ({
        ...prev,
        operator: operatorFromUrl || '',
        consumer_number: accountFromUrl || '',
        mobile_number: accountFromUrl || '',
        loan_account: accountFromUrl || ''
      }));
    }
  }, [user, navigate]);
  
  // Load Quick Pay items from localStorage
  const loadQuickPayItems = () => {
    try {
      const saved = localStorage.getItem(`quickpay_${user.uid}`);
      if (saved) {
        const items = JSON.parse(saved);
        setQuickPayItems(items.slice(0, 5)); // Keep only last 5
      }
    } catch (e) {
      console.error('Error loading quick pay:', e);
    }
  };
  
  // Save to Quick Pay after successful transaction
  const saveToQuickPay = (serviceType, details, amount) => {
    try {
      const config = SERVICE_CONFIG[serviceType];
      if (!config) return;
      
      const newItem = {
        id: Date.now(),
        service_type: serviceType,
        service_name: config.name,
        details: details,
        amount: amount,
        display_text: getQuickPayDisplayText(serviceType, details),
        timestamp: new Date().toISOString()
      };
      
      // Get existing items
      const saved = localStorage.getItem(`quickpay_${user.uid}`);
      let items = saved ? JSON.parse(saved) : [];
      
      // Remove duplicate if exists (same service + same account)
      items = items.filter(item => 
        !(item.service_type === serviceType && 
          item.display_text === newItem.display_text)
      );
      
      // Add new item at beginning
      items.unshift(newItem);
      
      // Keep only last 5
      items = items.slice(0, 5);
      
      localStorage.setItem(`quickpay_${user.uid}`, JSON.stringify(items));
      setQuickPayItems(items);
    } catch (e) {
      console.error('Error saving quick pay:', e);
    }
  };
  
  // Get display text for quick pay item
  const getQuickPayDisplayText = (serviceType, details) => {
    if (serviceType === 'mobile_recharge' || serviceType === 'mobile_postpaid') {
      return details.mobile_number ? `${details.mobile_number.slice(-4)}` : '';
    } else if (serviceType === 'credit_card') {
      return details.card_number ? `****${details.card_number.slice(-4)}` : '';
    } else if (serviceType === 'insurance') {
      return details.policy_number ? `${details.policy_number.slice(-6)}` : '';
    } else {
      return details.consumer_number ? `${details.consumer_number.slice(-6)}` : '';
    }
  };
  
  // Use Quick Pay item
  const useQuickPay = (item) => {
    setSelectedService(item.service_type);
    setFormData(prev => ({
      ...prev,
      ...item.details,
      amount: item.amount.toString()
    }));
    toast.success(`${item.service_name} details loaded!`);
  };
  
  // Fetch operators when service or recharge type changes
  useEffect(() => {
    if (selectedService === 'mobile_recharge') {
      fetchOperators(selectedService, formData.recharge_type);
    } else {
      fetchOperators(selectedService);
    }
  }, [selectedService, formData.recharge_type]);
  
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
      // Use correct endpoint: /api/user/{uid} (not /auth/user/)
      const response = await axios.get(`${API}/user/${user.uid}`);
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
  
  const fetchOperators = async (serviceType, rechargeType = 'prepaid') => {
    // Map service types to Eko categories
    let category;
    
    if (serviceType === 'mobile_recharge') {
      // For mobile, use recharge type to determine category
      category = rechargeType === 'postpaid' ? 'mobile_postpaid' : 'mobile_prepaid';
    } else {
      // Complete category mapping for ALL BBPS services
      const categoryMap = {
        // Recharge
        dth: 'dth',
        
        // Utility
        electricity: 'electricity',
        gas: 'gas',
        water: 'water',
        lpg: 'lpg',
        
        // Telecom
        mobile_postpaid: 'mobile_postpaid',
        broadband: 'broadband',
        landline: 'landline',
        cable_tv: 'cable_tv',
        
        // Financial
        emi: 'emi',
        credit_card: 'credit_card',
        insurance: 'insurance',
        
        // Transport & Others
        fastag: 'fastag',
        education: 'education',
        municipal_tax: 'municipal_tax'
      };
      category = categoryMap[serviceType];
    }
    
    if (!category) {
      console.log(`[BBPS] No category mapping for service: ${serviceType}`);
      return;
    }
    
    console.log(`[BBPS] Fetching operators for ${serviceType} -> category: ${category}`);
    
    setLoadingOperators(true);
    setOperatorsError(null); // Clear previous error
    
    // Retry logic for intermittent failures
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Use new clean BBPS API: GET /api/bbps/operators/{category}
        const response = await axios.get(`${API}/bbps/operators/${category}`, {
          timeout: 15000 // 15 second timeout
        });
        console.log(`[BBPS] API Response for ${category} (attempt ${attempt}):`, response.data);
        
        if (response.data.operators && response.data.operators.length > 0) {
          // For mobile, store with recharge type key
          const storeKey = serviceType === 'mobile_recharge' ? `mobile_${rechargeType}` : serviceType;
          console.log(`[BBPS] Storing ${response.data.operators.length} operators in key: ${storeKey}`);
          
          setOperators(prev => {
            const updated = {
              ...prev,
              [storeKey]: response.data.operators
            };
            console.log('[BBPS] Updated operators state:', Object.keys(updated));
            return updated;
          });
          setLoadingOperators(false);
          return; // Success, exit retry loop
        } else {
          console.log(`[BBPS] No operators returned for ${category}, attempt ${attempt}`);
          lastError = new Error('No operators returned');
        }
      } catch (error) {
        console.error(`[BBPS] Error fetching operators (attempt ${attempt}/${maxRetries}):`, error.message);
        lastError = error;
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    // All retries failed - use fallback operators
    console.error('[BBPS] All retries failed, using fallback operators');
    setOperatorsError('Unable to load providers. Please refresh the page.');
    setOperators(prev => ({
      ...prev,
      [serviceType]: OPERATORS[serviceType] || []
    }));
    setLoadingOperators(false);
  };
  
  // Fetch bank list for DMT
  const fetchBankList = async () => {
    setLoadingBanks(true);
    try {
      const response = await axios.get(`${API}/eko/dmt/v3/banks`);
      if (response.data.banks) {
        setBankList(response.data.banks);
      }
    } catch (error) {
      console.error('Error fetching banks:', error);
      // Fallback to common banks
      setBankList([
        { bank_id: 'SBI', name: 'State Bank of India', ifsc_prefix: 'SBIN' },
        { bank_id: 'HDFC', name: 'HDFC Bank', ifsc_prefix: 'HDFC' },
        { bank_id: 'ICICI', name: 'ICICI Bank', ifsc_prefix: 'ICIC' },
        { bank_id: 'AXIS', name: 'Axis Bank', ifsc_prefix: 'UTIB' },
        { bank_id: 'PNB', name: 'Punjab National Bank', ifsc_prefix: 'PUNB' },
        { bank_id: 'BOB', name: 'Bank of Baroda', ifsc_prefix: 'BARB' },
        { bank_id: 'KOTAK', name: 'Kotak Mahindra Bank', ifsc_prefix: 'KKBK' },
        { bank_id: 'YES', name: 'Yes Bank', ifsc_prefix: 'YESB' },
        { bank_id: 'IDBI', name: 'IDBI Bank', ifsc_prefix: 'IBKL' },
        { bank_id: 'CANARA', name: 'Canara Bank', ifsc_prefix: 'CNRB' },
        { bank_id: 'UNION', name: 'Union Bank of India', ifsc_prefix: 'UBIN' },
        { bank_id: 'IOB', name: 'Indian Overseas Bank', ifsc_prefix: 'IOBA' },
        { bank_id: 'INDIAN', name: 'Indian Bank', ifsc_prefix: 'IDIB' },
        { bank_id: 'BOI', name: 'Bank of India', ifsc_prefix: 'BKID' },
        { bank_id: 'CENTRAL', name: 'Central Bank of India', ifsc_prefix: 'CBIN' }
      ]);
    } finally {
      setLoadingBanks(false);
    }
  };
  
  // IFSC Code lookup
  const lookupIfsc = async (ifsc) => {
    if (!ifsc || ifsc.length !== 11) {
      setIfscDetails(null);
      return;
    }
    
    setLoadingIfsc(true);
    try {
      // Use Razorpay's IFSC API (public)
      const response = await axios.get(`https://ifsc.razorpay.com/${ifsc}`);
      setIfscDetails({
        bank: response.data.BANK,
        branch: response.data.BRANCH,
        address: response.data.ADDRESS,
        city: response.data.CITY,
        state: response.data.STATE
      });
      // Auto-fill bank name
      setFormData(prev => ({
        ...prev,
        bank_name: response.data.BANK
      }));
    } catch (error) {
      console.error('IFSC lookup failed:', error);
      setIfscDetails(null);
      toast.error('Invalid IFSC Code');
    } finally {
      setLoadingIfsc(false);
    }
  };
  
  // Auto-detect operator and fetch plans from mobile number
  const autoDetectOperator = async (mobile) => {
    if (!mobile || mobile.length !== 10) return;
    
    setAutoDetecting(true);
    setAutoDetection(null);
    setAutoDetectedPlans([]);
    
    try {
      const response = await axios.get(`${API}/eko/recharge/detect/${mobile}`);
      
      if (response.data.success && response.data.detection?.operator) {
        setAutoDetection(response.data.detection);
        setAutoDetectedPlans(response.data.plans || []);
        
        // Auto-fill operator and circle
        setFormData(prev => ({
          ...prev,
          operator: response.data.detection.operator,
          circle: response.data.detection.circle || 'MH'
        }));
        
        toast.success(`Detected: ${response.data.detection.operator_name} (${response.data.detection.circle_name})`);
      } else {
        toast.info('Could not auto-detect. Please select manually.');
      }
    } catch (error) {
      console.error('Auto-detect failed:', error);
    } finally {
      setAutoDetecting(false);
    }
  };
  
  // DMT: Verify/Check Customer
  const verifyDmtCustomer = async () => {
    if (!senderMobile || senderMobile.length !== 10) {
      toast.error('Please enter valid 10-digit mobile number');
      return;
    }
    
    setVerifyingCustomer(true);
    try {
      // Use working v1 API for customer search
      const response = await axios.post(`${API}/eko/dmt/customer/search`, {
        mobile: senderMobile,
        user_id: user?.uid || 'guest'
      });
      
      if (response.data.success && response.data.data?.customer_exists) {
        const customerData = response.data.data;
        setDmtCustomer(customerData);
        
        // Check if customer needs OTP verification (state: 1 = Verification Pending)
        if (customerData.state === '1' || customerData.state === 1 || customerData.kyc_status === 'Verification Pending') {
          // Customer exists but OTP verification is pending
          toast.info('OTP verification pending - Please complete verification');
          
          // Auto-send OTP for verification
          try {
            await axios.post(`${API}/eko/dmt/customer/resend-otp`, {
              user_id: user?.uid || 'guest',
              mobile: senderMobile
            });
            toast.success('OTP sent to your mobile');
            setDmtCustomer(prev => ({ ...prev, otp_sent: true, verification_pending: true }));
            setDmtStep(2); // Go to OTP verification step
          } catch (e) {
            console.error('[DMT] Failed to send OTP:', e);
            toast.error('Failed to send OTP. Please try again.');
          }
          return;
        }
        
        // Customer fully verified - go to recipient step
        setDmtStep(3);
        toast.success('Customer verified successfully!');
        
        // Fetch existing recipients
        try {
          const recipientsRes = await axios.get(`${API}/eko/dmt/recipients/${senderMobile}?user_id=${user?.uid || 'guest'}`);
          console.log('[DMT] Recipients response:', recipientsRes.data);
          if (recipientsRes.data.success && recipientsRes.data.data?.recipients?.length > 0) {
            setExistingRecipients(recipientsRes.data.data.recipients);
            console.log('[DMT] Loaded recipients:', recipientsRes.data.data.recipients);
          } else {
            console.log('[DMT] No recipients in response:', recipientsRes.data);
            setExistingRecipients([]);
          }
        } catch (e) {
          console.log('[DMT] Recipients fetch error:', e.response?.data || e.message);
          setExistingRecipients([]);
        }
      } else if (response.data.success && !response.data.data?.customer_exists) {
        // Customer not found - needs registration
        toast.info('New customer - Please register to continue');
        setDmtCustomer({ mobile: senderMobile, is_new: true, needs_registration: true });
        setDmtStep(2); // Go to registration/OTP step
      } else {
        // API returned error
        const errorMsg = response.data.user_message || response.data.message || 'Service temporarily unavailable';
        toast.error(errorMsg);
        console.error('[DMT] Customer search error:', response.data);
      }
    } catch (error) {
      console.error('[DMT] Customer verification failed:', error.response?.data || error);
      const errorMsg = error.response?.data?.user_message || error.response?.data?.message || 'Customer verification failed. Please try again.';
      toast.error(errorMsg);
    } finally {
      setVerifyingCustomer(false);
    }
  };
  
  // DMT: Verify Bank Account (MANDATORY before adding recipient)
  const verifyBankAccount = async () => {
    if (!formData.account_number || !formData.ifsc_code) {
      toast.error('Please enter Account Number and IFSC Code');
      return;
    }
    
    // Reset previous verification
    setAccountVerified(false);
    setVerifiedAccountDetails(null);
    setVerifyingAccount(true);
    
    try {
      const response = await axios.post(`${API}/eko/dmt/verify-account`, {
        account: formData.account_number,
        ifsc: formData.ifsc_code,
        user_id: user?.uid || 'guest'
      });
      
      if (response.data.success && response.data.data?.verified) {
        const details = response.data.data;
        setAccountVerified(true);
        setVerifiedAccountDetails(details);
        // Auto-fill account holder name from verification
        if (details.account_holder_name && !formData.account_holder) {
          setFormData(prev => ({ ...prev, account_holder: details.account_holder_name }));
        }
        toast.success(`✅ Account Verified: ${details.account_holder_name}`);
      } else {
        toast.error(response.data.user_message || 'Account verification failed. Please check details.');
      }
    } catch (error) {
      console.error('[DMT] Account verification error:', error);
      const errorMsg = error.response?.data?.user_message || error.response?.data?.detail || 'Account verification failed';
      toast.error(errorMsg);
    } finally {
      setVerifyingAccount(false);
    }
  };
  
  // DMT: Add Recipient (Bank Account) - ONLY after verification
  const addDmtRecipient = async () => {
    if (!formData.account_number || !formData.ifsc_code || !formData.account_holder) {
      toast.error('Please fill all bank account details');
      return;
    }
    
    // MANDATORY: Account must be verified before adding
    if (!accountVerified) {
      toast.error('⚠️ Please verify the bank account first');
      return;
    }
    
    setAddingRecipient(true);
    try {
      // Use working v1 API for adding recipient
      const response = await axios.post(`${API}/eko/dmt/recipient/add`, {
        user_id: user?.uid || 'guest',
        mobile: senderMobile,
        recipient_name: formData.account_holder,
        account_number: formData.account_number,
        ifsc: formData.ifsc_code
      });
      
      if (response.data.success && response.data.data?.recipient_id) {
        setDmtRecipientId(response.data.data.recipient_id);
        setDmtStep(4); // Go to amount step
        toast.success('Bank account added successfully!');
      } else {
        toast.error(response.data.user_message || 'Failed to add recipient');
      }
    } catch (error) {
      console.error('Add recipient failed:', error);
      toast.error('Failed to add bank account. Please check details.');
    } finally {
      setAddingRecipient(false);
    }
  };
  
  // Reset DMT flow when service changes
  useEffect(() => {
    if (selectedService === 'dmt') {
      setDmtStep(1);
      setDmtCustomer(null);
      setDmtRecipientId(null);
      setSenderMobile('');
      // Reset verification states
      setAccountVerified(false);
      setVerifiedAccountDetails(null);
    }
  }, [selectedService]);
  
  // Fetch bill details for gas/postpaid/EMI and new services
  const fetchBillDetails = async () => {
    let consumerNumber, operatorId, category;
    
    // Handle different services (DTH, EMI, FASTag removed)
    if (selectedService === 'mobile_recharge' && formData.recharge_type === 'postpaid') {
      consumerNumber = formData.mobile_number;
      operatorId = formData.operator;
      category = 'mobile_postpaid';
      
      if (!consumerNumber || !operatorId) {
        toast.error('Mobile Number and Operator both are required');
        return;
      }
    } else if (selectedService === 'mobile_postpaid') {
      consumerNumber = formData.mobile_number;
      operatorId = formData.operator;
      category = 'mobile_postpaid';
      
      if (!consumerNumber || !operatorId) {
        toast.error('Mobile Number and Operator both are required');
        return;
      }
    } else if (selectedService === 'credit_card') {
      consumerNumber = formData.card_number;
      operatorId = formData.operator;
      category = 'credit_card';
      
      if (!consumerNumber || !operatorId) {
        toast.error('Card Number and Bank both are required');
        return;
      }
    } else if (selectedService === 'insurance') {
      consumerNumber = formData.policy_number;
      operatorId = formData.operator;
      category = 'insurance';
      
      if (!consumerNumber || !operatorId) {
        toast.error('Policy Number and Insurance Company both are required');
        return;
      }
    } else if (selectedService === 'education') {
      consumerNumber = formData.student_id;
      operatorId = formData.operator;
      category = 'education';
      
      if (!consumerNumber || !operatorId) {
        toast.error('Student ID and Institution both are required');
        return;
      }
    } else if (selectedService === 'lpg') {
      consumerNumber = formData.lpg_id;
      operatorId = formData.operator;
      category = 'lpg';
      
      if (!consumerNumber || !operatorId) {
        toast.error('LPG Consumer ID and Provider both are required');
        return;
      }
    } else if (selectedService === 'emi') {
      // EMI/Loan payments use loan_account field
      consumerNumber = formData.loan_account;
      operatorId = formData.operator;
      category = 'emi';
      
      if (!consumerNumber || !operatorId) {
        toast.error('Loan Account Number and Lender both are required');
        return;
      }
    } else if (selectedService === 'fastag') {
      // FASTag uses vehicle_number field
      consumerNumber = formData.vehicle_number || formData.consumer_number;
      operatorId = formData.operator;
      category = 'fastag';
      
      if (!consumerNumber || !operatorId) {
        toast.error('Vehicle Number and FASTag Issuer both are required');
        return;
      }
    } else if (selectedService === 'dth') {
      // DTH uses subscriber_id or consumer_number
      consumerNumber = formData.subscriber_id || formData.consumer_number;
      operatorId = formData.operator;
      category = 'dth';
      
      if (!consumerNumber || !operatorId) {
        toast.error('Subscriber ID and DTH Provider both are required');
        return;
      }
    } else if (selectedService === 'electricity') {
      // Electricity bill
      consumerNumber = formData.consumer_number;
      operatorId = formData.operator;
      category = 'electricity';
      
      if (!consumerNumber || !operatorId) {
        toast.error('Consumer Number and Electricity Provider both are required');
        return;
      }
    } else if (selectedService === 'water') {
      // Water bill
      consumerNumber = formData.consumer_number;
      operatorId = formData.operator;
      category = 'water';
      
      if (!consumerNumber || !operatorId) {
        toast.error('Consumer/RR Number and Water Provider both are required');
        return;
      }
    } else if (selectedService === 'gas') {
      // Gas (PNG) bill
      consumerNumber = formData.consumer_number;
      operatorId = formData.operator;
      category = 'gas';
      
      if (!consumerNumber || !operatorId) {
        toast.error('Consumer Number and Gas Provider both are required');
        return;
      }
    } else if (selectedService === 'broadband') {
      // Broadband
      consumerNumber = formData.consumer_number;
      operatorId = formData.operator;
      category = 'broadband';
      
      if (!consumerNumber || !operatorId) {
        toast.error('Account Number and Broadband Provider both are required');
        return;
      }
    } else if (selectedService === 'landline') {
      // Landline
      consumerNumber = formData.consumer_number;
      operatorId = formData.operator;
      category = 'landline';
      
      if (!consumerNumber || !operatorId) {
        toast.error('Phone Number and Provider both are required');
        return;
      }
    } else {
      // Generic fallback for any other services
      consumerNumber = formData.consumer_number || formData.loan_account || formData.vehicle_number || formData.subscriber_id || formData.patient_id || formData.challan_number;
      operatorId = formData.operator;
      category = selectedService;
      
      if (!consumerNumber || !operatorId) {
        toast.error('Account/Consumer Number and Provider both are required');
        return;
      }
    }
    
    setFetchingBill(true);
    setBillDetails(null);
    setBillError(null);
    
    try {
      // Use new clean BBPS API: POST /api/bbps/fetch
      // Request format: { operator_id, account, mobile, ...additional_params }
      // For postpaid, mobile number IS the account number
      const mobileForRequest = category === 'mobile_postpaid' ? consumerNumber : formData.mobile_number || "9999999999";
      
      // Build request with additional params if available
      const fetchRequest = {
        operator_id: operatorId,
        account: consumerNumber,
        mobile: mobileForRequest
      };
      
      // Add additional parameters (like cycle_number for MSEDCL)
      if (formData.additional_param_1) {
        // Get the param name from operatorParams
        const paramName = operatorParams?.parameters?.[1]?.param_name || 'cycle_number';
        fetchRequest.extra_params = {
          [paramName]: formData.additional_param_1
        };
        // Also add as direct field for backward compatibility
        fetchRequest[paramName] = formData.additional_param_1;
      }
      if (formData.additional_param_2) {
        const paramName = operatorParams?.parameters?.[2]?.param_name || 'additional_param_2';
        fetchRequest.extra_params = fetchRequest.extra_params || {};
        fetchRequest.extra_params[paramName] = formData.additional_param_2;
        fetchRequest[paramName] = formData.additional_param_2;
      }
      
      console.log('[BBPS FETCH] Request:', fetchRequest);
      
      const response = await axios.post(`${API}/bbps/fetch`, fetchRequest);
      
      if (response.data.success) {
        const data = response.data;
        setBillDetails({
          customerName: data.customer_name || 'N/A',
          billAmount: data.bill_amount || 0,
          billNumber: data.bill_number || 'N/A',
          billDate: data.bill_date || 'N/A',
          dueDate: data.due_date || 'N/A',
          billPeriod: 'N/A'
        });
        
        // Auto-fill amount from bill
        if (data.bill_amount) {
          setFormData(prev => ({
            ...prev,
            amount: String(data.bill_amount)
          }));
          toast.success(`Bill fetched! Amount: ₹${data.bill_amount}`);
        }
      } else {
        // Error from Eko
        const errorMsg = response.data.message || 'Bill fetch failed';
        setBillError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error('Bill fetch error:', error);
      const errorMsg = error.response?.data?.detail || error.response?.data?.message || 'Unable to fetch bill';
      setBillError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setFetchingBill(false);
    }
  };
  
  // Clear bill details when service or operator changes
  useEffect(() => {
    setBillDetails(null);
    setBillError(null);
    setOperatorParams(null);
  }, [selectedService, formData.operator]);
  
  // Fetch operator parameters when operator is selected for bill services
  useEffect(() => {
    const fetchOperatorParams = async () => {
      if (!formData.operator) return;
      
      const billServices = ['electricity', 'gas', 'water', 'broadband', 'landline', 'insurance', 'dth', 'fastag', 'emi'];
      if (!billServices.includes(selectedService)) return;
      
      try {
        // Use new clean BBPS API: GET /api/bbps/operator-params/{operator_id}
        const response = await axios.get(`${API}/bbps/operator-params/${formData.operator}`);
        if (response.data.success && response.data.parameters) {
          setOperatorParams(response.data);
          console.log('[BBPS] Operator params:', response.data);
        }
      } catch (error) {
        console.error('Failed to fetch operator params:', error);
      }
    };
    
    fetchOperatorParams();
  }, [formData.operator, selectedService]);
  
  // Fetch bank list when DMT is selected
  useEffect(() => {
    if (selectedService === 'dmt') {
      fetchBankList();
    }
  }, [selectedService]);
  
  // Filter banks based on search
  const filteredBanks = bankList.filter(bank => 
    bank.name?.toLowerCase().includes(bankSearch.toLowerCase())
  );
  
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
    
    // Build details based on service type
    const details = {
      operator: formData.operator,
      operator_id: formData.operator
    };
    
    // Add service-specific fields
    if (selectedService === 'mobile_recharge' || selectedService === 'mobile_postpaid') {
      details.mobile_number = formData.mobile_number;
      if (selectedService === 'mobile_recharge') {
        details.circle = formData.circle;
        details.recharge_type = formData.recharge_type;
      }
    } else if (selectedService === 'credit_card') {
      details.card_number = formData.card_number;
      details.consumer_number = formData.card_number;
    } else if (selectedService === 'insurance') {
      details.policy_number = formData.policy_number;
      details.consumer_number = formData.policy_number;
    } else if (selectedService === 'education') {
      details.student_id = formData.student_id;
      details.enrollment_number = formData.student_id;
      details.consumer_number = formData.student_id;
    } else if (selectedService === 'lpg') {
      details.lpg_id = formData.lpg_id;
      details.consumer_number = formData.lpg_id;
    } else if (selectedService === 'dmt') {
      details.account_number = formData.account_number;
      details.ifsc_code = formData.ifsc_code;
      details.account_holder = formData.account_holder;
      details.bank_name = formData.bank_name;
      details.mobile = formData.mobile;
    } else {
      // Default for gas, water, broadband, landline, cable_tv, municipal_tax, housing_society
      details.consumer_number = formData.consumer_number;
    }
    
    // Add additional operator parameters (like cycle_number for MSEDCL)
    if (formData.additional_param_1 && operatorParams?.parameters?.[1]) {
      const paramName = operatorParams.parameters[1].param_name;
      details[paramName] = formData.additional_param_1;
      details.additional_params = details.additional_params || {};
      details.additional_params[paramName] = formData.additional_param_1;
    }
    if (formData.additional_param_2 && operatorParams?.parameters?.[2]) {
      const paramName = operatorParams.parameters[2].param_name;
      details[paramName] = formData.additional_param_2;
      details.additional_params = details.additional_params || {};
      details.additional_params[paramName] = formData.additional_param_2;
    }
    
    // Check Available Redeem Limit (NOT prc_balance)
    if (charges && redeemLimit) {
      const availableLimit = redeemLimit.remaining_limit || redeemLimit.remaining || 0;
      if (availableLimit < charges.total_prc_required) {
        toast.error(`Insufficient Redeem Limit. Available: ${availableLimit.toLocaleString()} PRC, Required: ${charges.total_prc_required.toLocaleString()} PRC`);
        return;
      }
    }
    
    setSubmitting(true);
    try {
      // For DMT/Bank Transfer, use V1 Fund Transfer API - Direct IMPS, No OTP
      if (selectedService === 'dmt') {
        // Check required fields for V1 Fund Transfer
        if (!formData.recipient_name || !formData.recipient_name.trim()) {
          toast.error('Please enter recipient name');
          setSubmitting(false);
          return;
        }
        
        if (!formData.account_number || formData.account_number.length < 9) {
          toast.error('Please enter valid account number (min 9 digits)');
          setSubmitting(false);
          return;
        }
        
        if (!formData.ifsc_code || formData.ifsc_code.length !== 11) {
          toast.error('Please enter valid IFSC code (11 characters)');
          setSubmitting(false);
          return;
        }
        
        const amountInr = parseFloat(formData.amount);
        if (!amountInr || amountInr < 10) {
          toast.error('Minimum transfer amount is ₹10');
          setSubmitting(false);
          return;
        }
        
        if (amountInr > 200000) {
          toast.error('Maximum transfer amount is ₹2,00,000');
          setSubmitting(false);
          return;
        }
        
        // Call V1 Fund Transfer API
        const transferResponse = await axios.post(`${API}/fund-transfer/initiate`, {
          recipient_name: formData.recipient_name.trim(),
          account: formData.account_number,
          ifsc: formData.ifsc_code.toUpperCase(),
          amount: String(Math.round(amountInr)),
          payment_mode: 'IMPS',
          account_type: formData.account_type || 'SAVINGS',
          // PRC deduction will be handled by backend
          user_id: user.uid,
          prc_amount: charges?.total_prc_required || Math.round(amountInr * 10)
        });
        
        if (transferResponse.data.success) {
          toast.success(`₹${amountInr} transferred successfully!`);
          // Show transaction details
          if (transferResponse.data.tid) {
            toast.info(`Transaction ID: ${transferResponse.data.tid}`);
          }
          // Reset form
          setFormData(prev => ({ 
            ...prev, 
            amount: '', 
            recipient_name: '',
            account_number: '', 
            ifsc_code: '',
            account_type: 'SAVINGS'
          }));
          fetchUserData();
        } else {
          toast.error(transferResponse.data.user_message || transferResponse.data.message || 'Transfer failed');
          // Check if PRC was refunded
          if (transferResponse.data.prc_refunded) {
            toast.info(`${transferResponse.data.prc_refunded} PRC has been refunded`);
            fetchUserData();
          }
        }
        setSubmitting(false);
        return;
      }
      
      // For other services (NOT DMT), use redeem request
      const response = await axios.post(`${API}/redeem/request`, {
        user_id: user.uid,
        service_type: selectedService,
        amount: parseFloat(formData.amount),
        details
      });
      
      // Check if request was successful
      if (response.data.success === false) {
        // Payment failed - show error
        toast.error(response.data.message || 'Payment failed. Please check your details and try again.');
        
        // If PRC was refunded, show that info
        if (response.data.prc_refunded) {
          toast.info(`${response.data.prc_refunded} PRC has been refunded to your account.`);
        }
        return;
      }
      
      // Save to Quick Pay on success
      saveToQuickPay(selectedService, details, parseFloat(formData.amount));
      
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
        account_holder: '',
        card_number: '',
        policy_number: '',
        vehicle_number: '',
        student_id: '',
        lpg_id: ''
      });
      setCharges(null);
      setBillDetails(null);
      setBillError(null);
      
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
  
  // Get current operators based on service and recharge type
  const currentOperators = (() => {
    let ops = [];
    if (selectedService === 'mobile_recharge') {
      const key = `mobile_${formData.recharge_type}`;
      ops = operators[key] || OPERATORS[selectedService] || [];
    } else {
      ops = operators[selectedService] || OPERATORS[selectedService] || [];
    }
    console.log(`[BBPS] currentOperators for ${selectedService}:`, ops.length, 'operators available');
    return ops;
  })();
  
  // Check if selected operator supports bill fetch
  const selectedOperatorData = currentOperators.find(op => 
    String(op.id) === String(formData.operator) || String(op.operator_id) === String(formData.operator)
  );
  
  // For electricity, gas, water - ALWAYS allow bill fetch (Eko API supports it)
  // billFetchResponse from Eko may be 0 but the API still works
  const billFetchServices = ['electricity', 'gas', 'water', 'landline', 'broadband', 'credit_card', 'insurance', 'emi'];
  const supportsBillFetch = billFetchServices.includes(selectedService) ||
                            operatorParams?.billFetchResponse === 1 ||
                            selectedOperatorData?.billFetchResponse === 1 ||
                            selectedOperatorData?.supports_bill_fetch === true;
  
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
          {/* My Requests Button */}
          <button
            onClick={() => navigate('/withdrawal-history')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-2xl hover:border-purple-400 transition-all"
            data-testid="my-requests-btn"
          >
            <Clock className="h-5 w-5 text-purple-400" />
            <span className="text-sm font-medium text-purple-300 hidden sm:inline">Withdrawals</span>
          </button>
          {/* Bill History Button */}
          <button
            onClick={() => navigate('/bill-history')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30 rounded-2xl hover:border-emerald-400 transition-all"
            data-testid="bill-history-btn"
          >
            <Receipt className="h-5 w-5 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-300 hidden sm:inline">Bill History</span>
          </button>
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
            
            {/* Quick Pay Section - Recently Used */}
            {quickPayItems.length > 0 && (
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 backdrop-blur-xl rounded-3xl p-5 border border-amber-500/30">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-400" />
                    <h2 className="text-base font-bold text-white">Quick Pay</h2>
                    <span className="text-xs text-gray-400">Recently used</span>
                  </div>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {quickPayItems.map((item) => {
                    const config = SERVICE_CONFIG[item.service_type];
                    if (!config) return null;
                    const Icon = config.icon;
                    
                    return (
                      <button
                        key={item.id}
                        onClick={() => useQuickPay(item)}
                        className="flex-shrink-0 bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/50 hover:border-amber-500/50 rounded-2xl p-3 transition-all duration-300 min-w-[140px]"
                        data-testid={`quickpay-${item.id}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-medium text-white leading-tight">{config.name}</p>
                            <p className="text-[10px] text-gray-400">{item.display_text}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-amber-400 font-bold text-sm">₹{item.amount}</span>
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Service Selection - PhonePe Style Grid */}
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl rounded-3xl p-6 border border-gray-800/50">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-white">Select Service</h2>
                  <p className="text-xs text-gray-500">Choose what you want to pay</p>
                </div>
                <Receipt className="h-6 w-6 text-amber-400" />
              </div>
              
              {/* Service Categories - Optimized Grid */}
              <div className="space-y-4">
                {/* Recharge */}
                <ServiceCategorySection
                  title="Mobile Recharge"
                  services={['mobile_recharge', 'mobile_postpaid']}
                  selectedService={selectedService}
                  setSelectedService={setSelectedService}
                />
                
                {/* Entertainment & TV */}
                <ServiceCategorySection
                  title="Entertainment & TV"
                  services={['dth', 'cable_tv', 'subscription']}
                  selectedService={selectedService}
                  setSelectedService={setSelectedService}
                />
                
                {/* Utility Bills */}
                <ServiceCategorySection
                  title="Utility Bills"
                  services={['electricity', 'water', 'gas', 'lpg']}
                  selectedService={selectedService}
                  setSelectedService={setSelectedService}
                />

                {/* Telecom */}
                <ServiceCategorySection
                  title="Telecom"
                  services={['broadband', 'landline']}
                  selectedService={selectedService}
                  setSelectedService={setSelectedService}
                />
                
                {/* Transport & Travel */}
                <ServiceCategorySection
                  title="Transport & Travel"
                  services={['fastag', 'transport']}
                  selectedService={selectedService}
                  setSelectedService={setSelectedService}
                />
                
                {/* Financial Services */}
                <ServiceCategorySection
                  title="Financial Services"
                  services={['emi', 'loan_repayment', 'credit_card', 'insurance']}
                  selectedService={selectedService}
                  setSelectedService={setSelectedService}
                />
                
                {/* Tax & Property */}
                <ServiceCategorySection
                  title="Tax & Property"
                  services={['municipal_tax', 'municipal_corp', 'housing_society']}
                  selectedService={selectedService}
                  setSelectedService={setSelectedService}
                />
                
                {/* Education & Healthcare */}
                <ServiceCategorySection
                  title="Education & Healthcare"
                  services={['education', 'hospital']}
                  selectedService={selectedService}
                  setSelectedService={setSelectedService}
                />
                
                {/* Note: Bank Transfer (DMT) moved to Chatbot flow */}
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
                
                {/* ============================================ */}
                {/* ELECTRICITY & GAS - Bill Payment Flow */}
                {/* 1. Provider → 2. Consumer → 3. Fetch Bill → 4. Amount → 5. Submit */}
                {/* ============================================ */}
                {(selectedService === 'electricity' || selectedService === 'gas') && (
                  <>
                    {/* Step 1: Provider Selection */}
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">1</span>
                        Provider *
                        {loadingOperators && <Loader2 className="inline h-3 w-3 ml-2 animate-spin" />}
                      </Label>
                      {operatorsError && currentOperators.length === 0 && (
                        <div className="mb-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between">
                          <span className="text-red-400 text-sm">{operatorsError}</span>
                          <Button
                            type="button"
                            onClick={() => fetchOperators(selectedService, formData.recharge_type)}
                            className="px-3 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg"
                          >
                            Retry
                          </Button>
                        </div>
                      )}
                      <select
                        value={formData.operator}
                        onChange={(e) => {
                          setFormData({ ...formData, operator: e.target.value, amount: '' });
                          setBillDetails(null);
                          setBillError(null);
                        }}
                        className="w-full h-12 px-4 bg-gray-800/50 border border-gray-700/50 text-white rounded-xl"
                        data-testid="provider-select"
                      >
                        <option value="">Select Provider ({currentOperators.length} available)</option>
                        {currentOperators.map((op, index) => (
                          <option key={op.operator_id || op.id || index} value={op.operator_id || op.id}>{op.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Step 2: Consumer Number (only show after provider selected) */}
                    {formData.operator && (
                      <div className="animate-fadeIn">
                        <Label className="text-gray-300 text-sm mb-2 block">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">2</span>
                          {operatorParams?.parameters?.[0]?.param_label || 'Consumer Number'} *
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            value={formData.consumer_number}
                            onChange={(e) => {
                              setFormData({ ...formData, consumer_number: e.target.value, amount: '' });
                              setBillDetails(null);
                            }}
                            placeholder={operatorParams?.parameters?.[0]?.error_message || "Enter consumer number"}
                            className={`flex-1 h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl ${
                              formData.consumer_number && operatorParams?.parameters?.[0]?.regex && 
                              !new RegExp(operatorParams.parameters[0].regex).test(formData.consumer_number) 
                                ? 'border-red-500/50 focus:border-red-500' : ''
                            }`}
                            data-testid="consumer-input"
                          />
                          {supportsBillFetch && (
                            <Button
                              type="button"
                              onClick={fetchBillDetails}
                              disabled={fetchingBill || !formData.consumer_number}
                              className="h-12 px-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-xl disabled:opacity-50"
                              data-testid="fetch-bill-btn"
                            >
                              {fetchingBill ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <Search className="h-5 w-5" />
                              )}
                            </Button>
                          )}
                        </div>
                        {/* Real-time validation error */}
                        {formData.consumer_number && operatorParams?.parameters?.[0]?.regex && 
                         !new RegExp(operatorParams.parameters[0].regex).test(formData.consumer_number) && (
                          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                            ❌ Invalid format! {operatorParams.parameters[0].error_message}
                          </p>
                        )}
                        {formData.consumer_number && operatorParams?.parameters?.[0]?.regex && 
                         new RegExp(operatorParams.parameters[0].regex).test(formData.consumer_number) && (
                          <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                            ✅ Valid format
                          </p>
                        )}
                        {/* Show operator-specific format hint */}
                        {operatorParams?.parameters?.[0] && (
                          <div className="mt-2 p-2 bg-gray-800/30 rounded-lg border border-gray-700/50">
                            <p className="text-xs text-cyan-400">
                              💡 {operatorParams.parameters[0].error_message || 
                                  (operatorParams.parameters[0].regex === '^[0-9]{13}$' ? 'Enter 13 digit number' : 
                                   operatorParams.parameters[0].regex === '^[0-9]{10}$' ? 'Enter 10 digit number' :
                                   operatorParams.parameters[0].regex === '^[0-9]{12}$' ? 'Enter 12 digit number' :
                                   operatorParams.parameters[0].regex === '^[0-9]{9}$' ? 'Enter 9 digit number' :
                                   `Format: ${operatorParams.parameters[0].regex}`)}
                            </p>
                          </div>
                        )}
                        {supportsBillFetch ? (
                          <p className="text-xs text-gray-500 mt-1">Enter consumer number and click 🔍 to fetch bill</p>
                        ) : (
                          <p className="text-xs text-amber-500 mt-1">⚡ Bill fetch not available for this provider. Enter amount manually.</p>
                        )}
                      </div>
                    )}
                    
                    {/* Additional Parameters (like BU for MSEDCL) */}
                    {formData.operator && operatorParams?.parameters?.length > 1 && (
                      <div className="animate-fadeIn space-y-3">
                        {operatorParams.parameters.slice(1).map((param, idx) => (
                          <div key={param.param_id || idx}>
                            <Label className="text-gray-300 text-sm mb-2 block">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500 text-black text-xs font-bold mr-2">+</span>
                              {param.param_label} *
                            </Label>
                            <Input
                              value={idx === 0 ? formData.additional_param_1 : formData.additional_param_2}
                              onChange={(e) => setFormData({ 
                                ...formData, 
                                [idx === 0 ? 'additional_param_1' : 'additional_param_2']: e.target.value 
                              })}
                              placeholder={param.error_message || `Enter ${param.param_label}`}
                              className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                            />
                            {param.regex && (
                              <p className="text-xs text-cyan-400 mt-1">
                                {param.error_message || `Format: ${param.regex}`}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Step 3: Bill Details Display */}
                    {billDetails && (
                      <div className="animate-fadeIn bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle className="h-5 w-5 text-green-400" />
                          <span className="text-green-400 font-semibold">Bill Details Found!</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-gray-400">Customer Name</p>
                            <p className="text-white font-medium">{billDetails.customerName}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Bill Amount</p>
                            <p className="text-2xl font-bold text-amber-400">₹{billDetails.billAmount}</p>
                          </div>
                          {billDetails.dueDate !== 'N/A' && (
                            <div>
                              <p className="text-gray-400">Due Date</p>
                              <p className="text-white">{billDetails.dueDate}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {billError && (
                      <div className="animate-fadeIn bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-4">
                        <div className="flex items-center gap-2">
                          <Info className="h-5 w-5 text-amber-400" />
                          <span className="text-amber-400 font-medium">Bill Fetch Issue</span>
                        </div>
                        <p className="text-white text-sm mt-2 font-medium">{billError}</p>
                        <p className="text-gray-400 text-xs mt-2">You can still enter amount manually.</p>
                      </div>
                    )}
                    
                    {/* Step 4: Amount (auto-filled or manual) */}
                    {(billDetails || billError || !supportsBillFetch || formData.consumer_number) && formData.operator && formData.consumer_number && (
                      <div className="animate-fadeIn">
                        <Label className="text-gray-300 text-sm mb-2 block">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">3</span>
                          Amount (₹) *
                          {billDetails && <span className="text-green-400 text-xs ml-2">(Auto-filled from bill)</span>}
                          {!supportsBillFetch && !billDetails && <span className="text-amber-400 text-xs ml-2">(Enter manually)</span>}
                        </Label>
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
                      </div>
                    )}
                  </>
                )}
                
                {/* ============================================ */}
                {/* MOBILE RECHARGE - New Flow with Auto-Detect */}
                {/* 1. Type → 2. Mobile (Auto-detect) → 3. Verify/Override Operator → 4. Amount → Submit */}
                {/* ============================================ */}
                {selectedService === 'mobile_recharge' && (
                  <>
                    {/* Mobile Prepaid Recharge - No type selection needed */}
                    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-3 mb-2">
                      <p className="text-amber-400 text-sm font-medium">📱 Mobile Prepaid Recharge</p>
                      <p className="text-gray-400 text-xs">For postpaid bills, use Bill Payments section</p>
                    </div>
                    
                    {/* Step 1: Mobile Number with Auto-Detect */}
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">1</span>
                        Mobile Number * <span className="text-blue-400 text-xs ml-1">(Auto-detects operator)</span>
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type="tel"
                          value={formData.mobile_number}
                          onChange={(e) => {
                            const mobile = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setFormData({ ...formData, mobile_number: mobile, amount: '' });
                            setBillDetails(null);
                            // Auto-detect when 10 digits entered
                            if (mobile.length === 10) {
                              autoDetectOperator(mobile);
                            } else {
                              setAutoDetection(null);
                              setAutoDetectedPlans([]);
                            }
                          }}
                          placeholder="10-digit mobile number"
                          maxLength={10}
                          className="flex-1 h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                          data-testid="mobile-input"
                        />
                        {autoDetecting && (
                          <div className="h-12 px-4 flex items-center justify-center bg-blue-500/20 border border-blue-500/30 rounded-xl">
                            <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {formData.mobile_number.length < 10 
                          ? 'Enter 10 digits to auto-detect operator'
                          : 'Operator auto-detected below'}
                      </p>
                    </div>
                    
                    {/* Auto-Detection Result */}
                    {autoDetection && formData.mobile_number.length === 10 && (
                      <div className="animate-fadeIn bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-2xl p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                              <Smartphone className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                              <p className="text-white font-semibold">{autoDetection.operator_name}</p>
                              <p className="text-gray-400 text-xs">{autoDetection.circle_name}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            autoDetection.confidence === 'high' ? 'bg-green-500/20 text-green-400' :
                            autoDetection.confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {autoDetection.confidence === 'high' ? '✓ Verified' : 'Estimated'}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Step 2: Override Operator (optional) */}
                    {formData.mobile_number.length === 10 && (
                      <div className="animate-fadeIn">
                        <Label className="text-gray-300 text-sm mb-2 block">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">2</span>
                          Operator {autoDetection ? '(Auto-filled, change if incorrect)' : '*'}
                          {loadingOperators && <Loader2 className="inline h-3 w-3 ml-2 animate-spin" />}
                        </Label>
                        <select
                          value={formData.operator}
                          onChange={(e) => {
                            setFormData({ ...formData, operator: e.target.value, amount: '' });
                            setBillDetails(null);
                          }}
                          className="w-full h-12 px-4 bg-gray-800/50 border border-gray-700/50 text-white rounded-xl"
                          data-testid="operator-select"
                        >
                          <option value="">Select Operator ({currentOperators.length} available)</option>
                          {currentOperators.map((op, index) => (
                            <option key={op.operator_id || op.id || index} value={op.operator_id || op.id}>{op.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    {/* Step 3: Circle (for prepaid, auto-filled from detection) */}
                    {formData.operator && formData.mobile_number.length === 10 && (
                      <div className="animate-fadeIn">
                        <Label className="text-gray-300 text-sm mb-2 block">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">3</span>
                          Circle {autoDetection?.circle ? '(Auto-detected)' : '*'}
                        </Label>
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
                    )}
                    
                    {/* Popular Plans (from auto-detection) */}
                    {autoDetectedPlans.length > 0 && formData.operator && (
                      <div className="animate-fadeIn">
                        <Label className="text-gray-300 text-sm mb-2 block">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-black text-xs font-bold mr-2">✓</span>
                          Quick Select Plan
                        </Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                          {autoDetectedPlans.slice(0, 12).map((plan, idx) => (
                            <button
                              key={plan.id || idx}
                              type="button"
                              onClick={() => setFormData({ ...formData, amount: plan.amount.toString() })}
                              className={`p-3 rounded-xl border text-left transition-all ${
                                formData.amount === plan.amount.toString()
                                  ? 'bg-amber-500/20 border-amber-500/50'
                                  : 'bg-gray-800/30 border-gray-700/50 hover:border-gray-600'
                              }`}
                            >
                              <p className="text-amber-400 font-bold">₹{plan.amount}</p>
                              <p className="text-gray-400 text-xs line-clamp-2">{plan.description}</p>
                              <p className="text-gray-500 text-[10px]">{plan.validity}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Step 4: Amount */}
                    {formData.operator && formData.mobile_number.length === 10 && (
                      <div className="animate-fadeIn">
                        <Label className="text-gray-300 text-sm mb-2 block">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">4</span>
                          Amount (₹) *
                          {billDetails && <span className="text-green-400 text-xs ml-2">(Auto-filled)</span>}
                        </Label>
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
                        {!autoDetectedPlans.length && (
                          <p className="text-xs text-gray-500 mt-1">Popular: ₹199, ₹299, ₹399, ₹599</p>
                        )}
                      </div>
                    )}
                  </>
                )}
                
                {/* ============================================ */}
                {/* BBPS SERVICES - Generic Form */}
                {/* DTH, EMI, FASTag, Water, Broadband, Landline, Credit Card, Insurance, Education, etc. */}
                {/* NOTE: Electricity and Gas have their own specific section above, exclude them here */}
                {/* ============================================ */}
                {['dth', 'emi', 'fastag', 'water', 'broadband', 'landline', 'credit_card', 'insurance', 'education', 'municipal_tax', 'lpg', 'cable_tv', 'mobile_postpaid', 'housing_society'].includes(selectedService) && (
                  <>
                    {/* Step 1: Provider Selection */}
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">1</span>
                        {selectedService === 'insurance' ? 'Insurance Company' : 
                         selectedService === 'credit_card' ? 'Bank/Card Issuer' :
                         selectedService === 'education' ? 'Institution' :
                         selectedService === 'lpg' ? 'LPG Provider' :
                         selectedService === 'dth' ? 'DTH Provider' :
                         selectedService === 'emi' ? 'Bank / Lender' :
                         selectedService === 'fastag' ? 'FASTag Issuer' :
                         'Provider'} *
                        {loadingOperators && <Loader2 className="inline h-3 w-3 ml-2 animate-spin" />}
                      </Label>
                      <select
                        value={formData.operator}
                        onChange={(e) => {
                          setFormData({ ...formData, operator: e.target.value, amount: '' });
                          setBillDetails(null);
                          setBillError(null);
                        }}
                        className="w-full h-12 px-4 bg-gray-800/50 border border-gray-700/50 text-white rounded-xl"
                        data-testid="provider-select"
                      >
                        <option value="">Select Provider ({currentOperators.length} available)</option>
                        {currentOperators.map((op, index) => (
                          <option key={op.operator_id || op.id || index} value={op.operator_id || op.id}>{op.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Step 2: Account/Consumer Number */}
                    {formData.operator && (
                      <div className="animate-fadeIn">
                        <Label className="text-gray-300 text-sm mb-2 block">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">2</span>
                          {selectedService === 'mobile_postpaid' ? 'Mobile Number' :
                           selectedService === 'credit_card' ? 'Card Number (Last 4 digits)' :
                           selectedService === 'insurance' ? 'Policy Number' :
                           selectedService === 'education' ? 'Student ID / Enrollment No.' :
                           selectedService === 'lpg' ? 'LPG Consumer ID' :
                           selectedService === 'municipal_tax' ? 'Property ID' :
                           selectedService === 'housing_society' ? 'Flat/Unit No.' :
                           selectedService === 'dth' ? 'Customer ID / Subscriber ID' :
                           selectedService === 'emi' ? 'Loan Account Number' :
                           selectedService === 'fastag' ? 'Vehicle Number' :
                           'Consumer/Account Number'} *
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            value={selectedService === 'mobile_postpaid' ? formData.mobile_number : 
                                   selectedService === 'credit_card' ? formData.card_number :
                                   selectedService === 'insurance' ? formData.policy_number :
                                   selectedService === 'education' ? formData.student_id :
                                   selectedService === 'lpg' ? formData.lpg_id :
                                   selectedService === 'emi' ? formData.loan_account :
                                   selectedService === 'fastag' ? formData.vehicle_number :
                                   formData.consumer_number}
                            onChange={(e) => {
                              const field = selectedService === 'mobile_postpaid' ? 'mobile_number' :
                                           selectedService === 'credit_card' ? 'card_number' :
                                           selectedService === 'insurance' ? 'policy_number' :
                                           selectedService === 'education' ? 'student_id' :
                                           selectedService === 'lpg' ? 'lpg_id' :
                                           selectedService === 'emi' ? 'loan_account' :
                                           selectedService === 'fastag' ? 'vehicle_number' :
                                           'consumer_number';
                              setFormData({ ...formData, [field]: e.target.value, amount: '' });
                              setBillDetails(null);
                            }}
                            placeholder={selectedService === 'mobile_postpaid' ? 'Enter 10 digit mobile number' :
                                        selectedService === 'dth' ? 'Enter DTH Customer ID' :
                                        selectedService === 'emi' ? 'Enter Loan Account Number' :
                                        selectedService === 'fastag' ? 'Enter Vehicle Number (e.g., MH12AB1234)' :
                                        'Enter account/consumer number'}
                            className="flex-1 h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                            data-testid="consumer-input"
                          />
                          <Button
                            type="button"
                            onClick={fetchBillDetails}
                            disabled={fetchingBill || !(selectedService === 'mobile_postpaid' ? formData.mobile_number : 
                                                        selectedService === 'credit_card' ? formData.card_number :
                                                        selectedService === 'insurance' ? formData.policy_number :
                                                        selectedService === 'education' ? formData.student_id :
                                                        selectedService === 'lpg' ? formData.lpg_id :
                                                        selectedService === 'emi' ? formData.loan_account :
                                                        selectedService === 'fastag' ? formData.vehicle_number :
                                                        formData.consumer_number)}
                            className="h-12 px-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-xl disabled:opacity-50"
                            data-testid="fetch-bill-btn"
                          >
                            {fetchingBill ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <Search className="h-5 w-5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Bill Details Display */}
                    {billDetails && (
                      <div className="animate-fadeIn bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle className="h-5 w-5 text-green-400" />
                          <span className="text-green-400 font-medium">Bill Fetched Successfully!</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500">Customer Name:</span>
                            <p className="text-white font-medium">{billDetails.customerName || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Bill Amount:</span>
                            <p className="text-amber-400 font-bold text-lg">₹{billDetails.amount || billDetails.billAmount || '0'}</p>
                          </div>
                          {billDetails.dueDate && (
                            <div>
                              <span className="text-gray-500">Due Date:</span>
                              <p className="text-white font-medium">{billDetails.dueDate}</p>
                            </div>
                          )}
                          {billDetails.billNumber && (
                            <div>
                              <span className="text-gray-500">Bill Number:</span>
                              <p className="text-white font-medium">{billDetails.billNumber}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {billError && (
                      <div className="animate-fadeIn bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-2xl p-4">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-orange-400" />
                          <span className="text-orange-400 font-medium">{billError}</span>
                        </div>
                        <p className="text-gray-400 text-sm mt-2">You can still enter amount manually.</p>
                      </div>
                    )}
                    
                    {/* Step 3: Amount */}
                    {formData.operator && (selectedService === 'mobile_postpaid' ? formData.mobile_number : 
                                           selectedService === 'credit_card' ? formData.card_number :
                                           selectedService === 'insurance' ? formData.policy_number :
                                           selectedService === 'education' ? formData.student_id :
                                           selectedService === 'lpg' ? formData.lpg_id :
                                           formData.consumer_number) && (
                      <div className="animate-fadeIn">
                        <Label className="text-gray-300 text-sm mb-2 block">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">3</span>
                          Amount (₹) *
                          {billDetails && <span className="text-green-400 text-xs ml-2">(Auto-filled from bill)</span>}
                        </Label>
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
                      </div>
                    )}
                  </>
                )}
                
                {/* DMT (Bank Transfer) Fields - V1 Fund Transfer (Simple, No OTP) */}
                {selectedService === 'dmt' && (
                  <div className="space-y-5 animate-fadeIn">
                    {/* Info Banner */}
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <Zap className="h-5 w-5" />
                        <span className="font-semibold">Instant Bank Transfer (IMPS)</span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        Direct transfer to any bank account • No OTP required • Fee: ₹5
                      </p>
                    </div>
                    
                    {/* Step 1: Recipient Name */}
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">1</span>
                        Recipient Name (Account Holder) *
                      </Label>
                      <Input
                        type="text"
                        value={formData.recipient_name || ''}
                        onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
                        placeholder="Enter account holder name"
                        className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                        data-testid="dmt-recipient-name"
                      />
                    </div>
                    
                    {/* Step 2: Account Number */}
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">2</span>
                        Bank Account Number *
                      </Label>
                      <Input
                        type="text"
                        value={formData.account_number || ''}
                        onChange={(e) => setFormData({ ...formData, account_number: e.target.value.replace(/\D/g, '') })}
                        placeholder="Enter bank account number"
                        className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                        data-testid="dmt-account-number"
                      />
                    </div>
                    
                    {/* Step 3: IFSC Code */}
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">3</span>
                        IFSC Code *
                      </Label>
                      <Input
                        type="text"
                        value={formData.ifsc_code || ''}
                        onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase().slice(0, 11) })}
                        placeholder="Enter 11-character IFSC code"
                        maxLength={11}
                        className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl uppercase"
                        data-testid="dmt-ifsc-code"
                      />
                      {formData.ifsc_code?.length === 11 && (
                        <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Valid IFSC format
                        </p>
                      )}
                    </div>
                    
                    {/* Step 4: Account Type */}
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">4</span>
                        Account Type
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, account_type: 'SAVINGS' })}
                          className={`p-3 rounded-xl border text-center transition-all ${
                            (formData.account_type || 'SAVINGS') === 'SAVINGS'
                              ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                              : 'border-gray-700 bg-gray-800/50 text-gray-400'
                          }`}
                        >
                          Savings Account
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, account_type: 'CURRENT' })}
                          className={`p-3 rounded-xl border text-center transition-all ${
                            formData.account_type === 'CURRENT'
                              ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                              : 'border-gray-700 bg-gray-800/50 text-gray-400'
                          }`}
                        >
                          Current Account
                        </button>
                      </div>
                    </div>
                    
                    {/* Step 5: Amount */}
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">5</span>
                        Transfer Amount (₹10 - ₹2,00,000) *
                      </Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-amber-400">₹</span>
                        <Input
                          type="number"
                          value={formData.amount}
                          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                          placeholder="Enter amount"
                          min="10"
                          max="200000"
                          className="pl-12 h-14 text-xl font-semibold bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                          data-testid="dmt-amount"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Min: ₹10 • Max: ₹2,00,000 • Transfer Fee: ₹5</p>
                    </div>
                  </div>
                )}
                
                {/* ============================================ */}
                {/* ============================================ */}
                {/* PRC RATE DISPLAY - Shows current rate & alert */}
                {/* ============================================ */}
                {formData.amount && parseFloat(formData.amount) > 0 && (
                  <PRCRateDisplay 
                    amount={parseFloat(formData.amount) || 0}
                    processingFee={10}
                    adminChargePercent={20}
                    showBreakdown={false}
                    showRateAlert={true}
                    serviceType="redeem"
                  />
                )}
                
                {/* ============================================ */}
                {/* ============================================ */}
                {/* CHARGES BREAKDOWN - Common for all services */}
                {/* ============================================ */}
                {charges && formData.amount && (
                  <div className="animate-fadeIn bg-gradient-to-br from-gray-800/50 to-gray-800/30 rounded-2xl p-4 border border-gray-700/50">
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
                
                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={submitting || !formData.amount || (userData?.kyc_status !== 'verified') || (selectedService === 'dmt' && (!formData.recipient_name || !formData.account_number || !formData.ifsc_code || formData.ifsc_code?.length !== 11))}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:via-orange-400 hover:to-amber-400 text-gray-900 font-bold rounded-2xl"
                  data-testid="submit-redeem-btn"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      {selectedService === 'dmt' ? 'Processing Transfer...' : 'Processing Payment...'}
                    </>
                  ) : selectedService === 'dmt' ? (
                    <>Transfer to Bank</>
                  ) : (
                    <>Pay Now</>
                  )}
                </Button>
                
                <p className="text-xs text-green-400 text-center">
                  {selectedService === 'dmt' ? 'Direct instant transfer via IMPS • No OTP required' : 'Instant payment via BBPS'}
                </p>
              </form>
            </div>
          </div>
          
          {/* Right: Redeem Limit & Recent Requests */}
          <div className="space-y-6">
            {/* Global Redeem Limit Card - PRIMARY */}
            {redeemLimit && (
              <div data-testid="bbps-redeem-limit" className="bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-emerald-600/20 rounded-3xl p-6 border border-emerald-500/30">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-emerald-400 font-semibold text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Monthly Redeem Limit
                  </h3>
                  <span className="text-emerald-300/60 text-xs">{Math.round(redeemLimit.usage_percentage || 0)}% used</span>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-emerald-900/50 rounded-full h-2 mb-4">
                  <div 
                    className="bg-gradient-to-r from-emerald-400 to-teal-400 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(redeemLimit.usage_percentage || 0, 100)}%` }}
                  />
                </div>
                
                {/* Limit Values */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-emerald-300/50 text-[10px] uppercase">Total</p>
                    <p className="text-white font-bold text-sm">{(redeemLimit.total_limit || 0).toLocaleString()}</p>
                    <p className="text-emerald-300/40 text-[10px]">≈ ₹{Math.floor((redeemLimit.total_limit || 0) / prcRate).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-yellow-300/50 text-[10px] uppercase">Used</p>
                    <p className="text-yellow-400 font-bold text-sm">{(redeemLimit.total_redeemed || 0).toLocaleString()}</p>
                    <p className="text-yellow-300/40 text-[10px]">≈ ₹{Math.floor((redeemLimit.total_redeemed || 0) / prcRate).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-emerald-300/50 text-[10px] uppercase">Available</p>
                    <p className="text-emerald-400 font-bold text-sm">{(redeemLimit.remaining_limit || redeemLimit.remaining || 0).toLocaleString()}</p>
                    <p className="text-emerald-300/40 text-[10px]">≈ ₹{Math.floor((redeemLimit.remaining_limit || redeemLimit.remaining || 0) / prcRate).toLocaleString()}</p>
                  </div>
                </div>
                
                {redeemLimit.active_referrals > 0 && (
                  <p className="text-emerald-300/50 text-[10px] mt-3 pt-2 border-t border-emerald-500/20">
                    Referral Bonus: +{redeemLimit.referral_percentage_increase || 0}% limit
                  </p>
                )}
              </div>
            )}

            {/* Category-wise Limit - UTILITY ONLY */}
            {user?.uid && (
              <CategoryLimitsDisplay userId={user.uid} category="utility" />
            )}
            
            {/* Charges Info */}
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-3xl p-6 border border-blue-500/20">
              <h3 className="font-bold text-blue-400 mb-3 flex items-center gap-2">
                <Info className="h-5 w-5" />
                Service Charges
              </h3>
              <ul className="text-xs text-blue-300 space-y-2">
                <li className="flex justify-between">
                  <span>Platform Fee</span>
                  <span className="font-semibold">₹10 (flat)</span>
                </li>
                <li className="flex justify-between">
                  <span>Service Charges</span>
                  <span className="font-semibold">20% of amount</span>
                </li>
                <li className="flex justify-between border-t border-blue-500/20 pt-2 mt-2">
                  <span>Est. Redeem Value</span>
                  <span className="font-semibold">~₹1 per 10 PRC*</span>
                </li>
              </ul>
              <p className="text-[10px] text-blue-400/60 mt-2">*Subject to terms & availability</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RedeemPageV2;
