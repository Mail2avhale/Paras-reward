import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  ArrowLeft, ArrowRight, Smartphone, Tv, Zap, Flame, Building, Banknote,
  CheckCircle, Clock, XCircle, AlertCircle, Info, ChevronRight,
  Wallet, Receipt, Loader2, RefreshCw, Search, X, Phone, Droplet, Wifi,
  PhoneCall, CreditCard, Shield, Car, GraduationCap, Monitor, Landmark, Home, Cylinder
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
  
  // Money Transfer (REMOVED - Now handled via Chatbot)
  // dmt service disabled - users can request bank withdrawal via chatbot
  // dmt: { 
  //   name: 'Bank Transfer', 
  //   icon: Banknote, 
  //   color: 'green',
  //   gradient: 'from-green-500 to-emerald-500',
  //   fields: ['account_number', 'ifsc_code', 'account_holder', 'mobile', 'bank_name'],
  //   category: 'transfer',
  //   requiresAdmin: false
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
    // Additional operator params (like BU for MSEDCL)
    additional_param_1: '',
    additional_param_2: ''
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
    loadQuickPayItems();
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
    } else {
      consumerNumber = formData.consumer_number;
      operatorId = formData.operator;
      category = selectedService;
      
      if (!consumerNumber || !operatorId) {
        toast.error('Consumer Number and Provider both are required');
        return;
      }
    }
    
    setFetchingBill(true);
    setBillDetails(null);
    setBillError(null);
    
    try {
      // Use new clean BBPS API: POST /api/bbps/fetch
      // Request format: { operator_id, account, mobile }
      // For postpaid, mobile number IS the account number
      const mobileForRequest = category === 'mobile_postpaid' ? consumerNumber : formData.mobile_number || "9999999999";
      
      const response = await axios.post(`${API}/bbps/fetch`, {
        operator_id: operatorId,
        account: consumerNumber,
        mobile: mobileForRequest
      });
      
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
    
    // Check PRC balance
    if (charges && userData) {
      if (userData.prc_balance < charges.total_prc_required) {
        toast.error(`Insufficient PRC balance. Required: ${charges.total_prc_required} PRC`);
        return;
      }
    }
    
    setSubmitting(true);
    try {
      // For DMT, ALWAYS use direct EKO transfer API - NO ADMIN APPROVAL EVER
      if (selectedService === 'dmt') {
        // Check if we have a recipient selected
        if (!dmtRecipientId) {
          toast.error('Please select or add a bank account first');
          setSubmitting(false);
          return;
        }
        
        // Check if we have sender mobile
        if (!senderMobile || senderMobile.length !== 10) {
          toast.error('Please verify your mobile number first');
          setDmtStep(1);
          setSubmitting(false);
          return;
        }
        
        const transferResponse = await axios.post(`${API}/eko/dmt/transfer`, {
          user_id: user.uid,
          mobile: senderMobile,
          recipient_id: dmtRecipientId,
          prc_amount: Math.round(parseFloat(formData.amount) * 100) // Convert INR to PRC
        });
        
        if (transferResponse.data.success) {
          toast.success(transferResponse.data.message || 'Transfer successful!');
          // Reset DMT flow
          setDmtStep(1);
          setDmtCustomer(null);
          setDmtRecipientId(null);
          setSenderMobile('');
          setExistingRecipients([]);
          setFormData(prev => ({ ...prev, amount: '', account_number: '', ifsc_code: '', account_holder: '' }));
          fetchUserData();
        } else {
          toast.error(transferResponse.data.user_message || transferResponse.data.message || 'Transfer failed');
          if (transferResponse.data.data?.prc_refunded) {
            toast.info('PRC has been refunded');
            fetchUserData();
          }
        }
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
            <span className="text-sm font-medium text-purple-300 hidden sm:inline">My Requests</span>
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
              
              {/* Service Categories */}
              <div className="space-y-4">
                {/* Recharge & TV */}
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Recharge & TV</p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {['mobile_recharge', 'mobile_postpaid', 'dth', 'cable_tv'].map(id => {
                      const config = SERVICE_CONFIG[id];
                      if (!config) return null;
                      const Icon = config.icon;
                      const isSelected = selectedService === id;
                      
                      return (
                        <button
                          key={id}
                          onClick={() => setSelectedService(id)}
                          className={`relative p-3 rounded-xl border transition-all duration-300 ${
                            isSelected
                              ? `bg-gradient-to-br ${config.gradient} border-white/30 shadow-lg scale-105`
                              : 'bg-gray-800/30 border-gray-700/50 hover:border-gray-600'
                          }`}
                          data-testid={`service-${id}`}
                        >
                          {isSelected && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            </div>
                          )}
                          <div className={`w-8 h-8 mx-auto mb-1 rounded-lg flex items-center justify-center ${
                            isSelected ? 'bg-white/20' : 'bg-gray-700/50'
                          }`}>
                            <Icon className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                          </div>
                          <p className={`text-[9px] font-medium text-center leading-tight ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                            {config.name}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Utility Bills */}
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Utility Bills</p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {['electricity', 'water', 'gas', 'lpg'].map(id => {
                      const config = SERVICE_CONFIG[id];
                      if (!config) return null;
                      const Icon = config.icon;
                      const isSelected = selectedService === id;
                      
                      return (
                        <button
                          key={id}
                          onClick={() => setSelectedService(id)}
                          className={`relative p-3 rounded-xl border transition-all duration-300 ${
                            isSelected
                              ? `bg-gradient-to-br ${config.gradient} border-white/30 shadow-lg scale-105`
                              : 'bg-gray-800/30 border-gray-700/50 hover:border-gray-600'
                          }`}
                          data-testid={`service-${id}`}
                        >
                          {isSelected && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            </div>
                          )}
                          <div className={`w-8 h-8 mx-auto mb-1 rounded-lg flex items-center justify-center ${
                            isSelected ? 'bg-white/20' : 'bg-gray-700/50'
                          }`}>
                            <Icon className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                          </div>
                          <p className={`text-[9px] font-medium text-center leading-tight ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                            {config.name}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Telecom */}
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Telecom</p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {['broadband', 'landline'].map(id => {
                      const config = SERVICE_CONFIG[id];
                      if (!config) return null;
                      const Icon = config.icon;
                      const isSelected = selectedService === id;
                      
                      return (
                        <button
                          key={id}
                          onClick={() => setSelectedService(id)}
                          className={`relative p-3 rounded-xl border transition-all duration-300 ${
                            isSelected
                              ? `bg-gradient-to-br ${config.gradient} border-white/30 shadow-lg scale-105`
                              : 'bg-gray-800/30 border-gray-700/50 hover:border-gray-600'
                          }`}
                          data-testid={`service-${id}`}
                        >
                          {isSelected && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            </div>
                          )}
                          <div className={`w-8 h-8 mx-auto mb-1 rounded-lg flex items-center justify-center ${
                            isSelected ? 'bg-white/20' : 'bg-gray-700/50'
                          }`}>
                            <Icon className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                          </div>
                          <p className={`text-[9px] font-medium text-center leading-tight ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                            {config.name}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Financial Services */}
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Financial Services</p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {['emi', 'credit_card', 'insurance'].map(id => {
                      const config = SERVICE_CONFIG[id];
                      if (!config) return null;
                      const Icon = config.icon;
                      const isSelected = selectedService === id;
                      
                      return (
                        <button
                          key={id}
                          onClick={() => setSelectedService(id)}
                          className={`relative p-3 rounded-xl border transition-all duration-300 ${
                            isSelected
                              ? `bg-gradient-to-br ${config.gradient} border-white/30 shadow-lg scale-105`
                              : 'bg-gray-800/30 border-gray-700/50 hover:border-gray-600'
                          }`}
                          data-testid={`service-${id}`}
                        >
                          {isSelected && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            </div>
                          )}
                          <div className={`w-8 h-8 mx-auto mb-1 rounded-lg flex items-center justify-center ${
                            isSelected ? 'bg-white/20' : 'bg-gray-700/50'
                          }`}>
                            <Icon className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                          </div>
                          <p className={`text-[9px] font-medium text-center leading-tight ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                            {config.name}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Transport & Others */}
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Transport & Others</p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {['fastag', 'education', 'municipal_tax'].map(id => {
                      const config = SERVICE_CONFIG[id];
                      if (!config) return null;
                      const Icon = config.icon;
                      const isSelected = selectedService === id;
                      
                      return (
                        <button
                          key={id}
                          onClick={() => setSelectedService(id)}
                          className={`relative p-3 rounded-xl border transition-all duration-300 ${
                            isSelected
                              ? `bg-gradient-to-br ${config.gradient} border-white/30 shadow-lg scale-105`
                              : 'bg-gray-800/30 border-gray-700/50 hover:border-gray-600'
                          }`}
                          data-testid={`service-${id}`}
                        >
                          {isSelected && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            </div>
                          )}
                          <div className={`w-8 h-8 mx-auto mb-1 rounded-lg flex items-center justify-center ${
                            isSelected ? 'bg-white/20' : 'bg-gray-700/50'
                          }`}>
                            <Icon className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                          </div>
                          <p className={`text-[9px] font-medium text-center leading-tight ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                            {config.name}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Bank Transfer */}
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Money Transfer</p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {['dmt'].map(id => {
                      const config = SERVICE_CONFIG[id];
                      if (!config) return null;
                      const Icon = config.icon;
                      const isSelected = selectedService === id;
                      
                      return (
                        <button
                          key={id}
                          onClick={() => setSelectedService(id)}
                          className={`relative p-3 rounded-xl border transition-all duration-300 ${
                            isSelected
                              ? `bg-gradient-to-br ${config.gradient} border-white/30 shadow-lg scale-105`
                              : 'bg-gray-800/30 border-gray-700/50 hover:border-gray-600'
                          }`}
                          data-testid={`service-${id}`}
                        >
                          {isSelected && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            </div>
                          )}
                          {config.requiresAdmin && (
                            <div className="absolute -top-1 -left-1 px-1 bg-amber-500 rounded text-[8px] font-bold text-black">
                              Admin
                            </div>
                          )}
                          <div className={`w-8 h-8 mx-auto mb-1 rounded-lg flex items-center justify-center ${
                            isSelected ? 'bg-white/20' : 'bg-gray-700/50'
                          }`}>
                            <Icon className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                          </div>
                          <p className={`text-[9px] font-medium text-center leading-tight ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                            {config.name}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
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
                
                {/* DMT (Bank Transfer) Fields - Step-by-Step Flow */}
                {selectedService === 'dmt' && (
                  <>
                    {/* DMT Progress Indicator */}
                    <div className="flex items-center justify-between mb-6 px-2">
                      {['Mobile', 'Verify', 'Bank Details', 'Amount'].map((step, idx) => (
                        <div key={step} className="flex items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            dmtStep > idx + 1 ? 'bg-green-500 text-white' :
                            dmtStep === idx + 1 ? 'bg-amber-500 text-black' :
                            'bg-gray-700 text-gray-400'
                          }`}>
                            {dmtStep > idx + 1 ? <CheckCircle className="h-4 w-4" /> : idx + 1}
                          </div>
                          <span className={`ml-2 text-xs hidden sm:inline ${dmtStep >= idx + 1 ? 'text-white' : 'text-gray-500'}`}>
                            {step}
                          </span>
                          {idx < 3 && <div className={`w-8 h-0.5 mx-2 ${dmtStep > idx + 1 ? 'bg-green-500' : 'bg-gray-700'}`} />}
                        </div>
                      ))}
                    </div>
                    
                    {/* Step 1: Enter Sender Mobile */}
                    {dmtStep === 1 && (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl mb-4">
                          <p className="text-blue-400 text-sm">
                            <Info className="inline h-4 w-4 mr-2" />
                            Enter your mobile number to start the bank transfer process
                          </p>
                        </div>
                        <Label className="text-gray-300 text-sm mb-2 block">
                          Your Mobile Number *
                        </Label>
                        <Input
                          type="tel"
                          value={senderMobile}
                          onChange={(e) => setSenderMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="Enter 10-digit mobile number"
                          maxLength={10}
                          className="h-14 text-lg bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                        />
                        <Button
                          type="button"
                          onClick={verifyDmtCustomer}
                          disabled={senderMobile.length !== 10 || verifyingCustomer}
                          className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl"
                        >
                          {verifyingCustomer ? (
                            <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Verifying...</>
                          ) : (
                            <>Continue <ArrowRight className="h-5 w-5 ml-2" /></>
                          )}
                        </Button>
                      </div>
                    )}
                    
                    {/* Step 2: Customer Registration/OTP (for new customers) */}
                    {dmtStep === 2 && dmtCustomer?.needs_registration && (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-4">
                          <p className="text-amber-400 text-sm">
                            <Info className="inline h-4 w-4 mr-2" />
                            New customer. Enter your name to register.
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-gray-300 text-sm mb-2 block">First Name *</Label>
                            <Input
                              value={formData.first_name || ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                              placeholder="First Name"
                              className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                            />
                          </div>
                          <div>
                            <Label className="text-gray-300 text-sm mb-2 block">Last Name *</Label>
                            <Input
                              value={formData.last_name || ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                              placeholder="Last Name"
                              className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                            />
                          </div>
                        </div>
                        
                        <Button
                          type="button"
                          onClick={async () => {
                            if (!formData.first_name || !formData.last_name) {
                              toast.error('Please enter your name');
                              return;
                            }
                            setVerifyingCustomer(true);
                            try {
                              // Register customer
                              const regRes = await axios.post(`${API}/eko/dmt/customer/register`, {
                                user_id: user?.uid || 'guest',
                                mobile: senderMobile,
                                first_name: formData.first_name,
                                last_name: formData.last_name
                              });
                              
                              if (regRes.data.success) {
                                // Send OTP
                                await axios.post(`${API}/eko/dmt/customer/resend-otp`, {
                                  user_id: user?.uid || 'guest',
                                  mobile: senderMobile
                                });
                                toast.success('OTP sent to your mobile');
                                setDmtCustomer(prev => ({ ...prev, otp_sent: true, needs_registration: false }));
                              } else {
                                toast.error(regRes.data.user_message || 'Registration failed');
                              }
                            } catch (error) {
                              toast.error('Registration failed. Please try again.');
                            } finally {
                              setVerifyingCustomer(false);
                            }
                          }}
                          disabled={!formData.first_name || !formData.last_name || verifyingCustomer}
                          className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl"
                        >
                          {verifyingCustomer ? (
                            <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Registering...</>
                          ) : (
                            <>Register & Send OTP</>
                          )}
                        </Button>
                      </div>
                    )}
                    
                    {/* Step 2: OTP Verification */}
                    {dmtStep === 2 && dmtCustomer?.otp_sent && (
                      <div className="space-y-4 animate-fadeIn">
                        {dmtCustomer?.verification_pending && (
                          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-2">
                            <p className="text-amber-400 text-sm font-medium">
                              ⏳ Verification Pending
                            </p>
                            <p className="text-amber-300/70 text-xs mt-1">
                              {dmtCustomer?.name ? `Name: ${dmtCustomer.name}` : ''}
                            </p>
                          </div>
                        )}
                        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl mb-4">
                          <p className="text-green-400 text-sm">
                            <CheckCircle className="inline h-4 w-4 mr-2" />
                            OTP sent to {senderMobile}
                          </p>
                          <p className="text-green-300/70 text-xs mt-1">
                            Check SMS on your registered mobile. OTP valid for 10 minutes.
                          </p>
                          <p className="text-amber-300/70 text-xs mt-2">
                            💡 OTP न आल्यास: DND बंद करा, network check करा, किंवा 2 मिनिटानंतर Resend करा
                          </p>
                        </div>
                        
                        <Label className="text-gray-300 text-sm mb-2 block">Enter OTP *</Label>
                        <Input
                          type="tel"
                          value={formData.otp || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, otp: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                          placeholder="Enter 6-digit OTP"
                          maxLength={6}
                          className="h-14 text-lg bg-gray-800/50 border-gray-700/50 text-white rounded-xl text-center tracking-widest"
                        />
                        
                        <Button
                          type="button"
                          onClick={async () => {
                            if (!formData.otp || formData.otp.length < 4) {
                              toast.error('Please enter OTP');
                              return;
                            }
                            setVerifyingCustomer(true);
                            try {
                              const verifyRes = await axios.post(`${API}/eko/dmt/customer/verify-otp`, {
                                user_id: user?.uid || 'guest',
                                mobile: senderMobile,
                                otp: formData.otp
                              });
                              
                              if (verifyRes.data.success) {
                                toast.success('Customer verified!');
                                setDmtCustomer(verifyRes.data.data);
                                setDmtStep(3);
                              } else {
                                toast.error(verifyRes.data.user_message || 'Invalid OTP');
                              }
                            } catch (error) {
                              toast.error('Verification failed');
                            } finally {
                              setVerifyingCustomer(false);
                            }
                          }}
                          disabled={!formData.otp || formData.otp.length < 4 || verifyingCustomer}
                          className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl"
                        >
                          {verifyingCustomer ? (
                            <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Verifying...</>
                          ) : (
                            <>Verify OTP</>
                          )}
                        </Button>
                        
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await axios.post(`${API}/eko/dmt/customer/resend-otp`, {
                                user_id: user?.uid || 'guest',
                                mobile: senderMobile
                              });
                              toast.success('OTP resent');
                            } catch (e) {
                              toast.error('Could not resend OTP');
                            }
                          }}
                          className="w-full text-amber-400 hover:text-amber-300 text-sm"
                        >
                          Resend OTP
                        </button>
                      </div>
                    )}
                    
                    {/* Step 2: Customer Verified - Show info */}
                    {dmtStep >= 2 && dmtCustomer && !dmtCustomer.needs_registration && !dmtCustomer.otp_sent && (
                      <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl mb-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-400" />
                          <span className="text-green-400 text-sm">Customer: {senderMobile}</span>
                          <button
                            type="button"
                            onClick={() => { setDmtStep(1); setDmtCustomer(null); setSenderMobile(''); }}
                            className="ml-auto text-gray-400 hover:text-white text-xs"
                          >
                            Change
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Step 3: Bank Account Details */}
                    {dmtStep === 3 && (
                      <div className="space-y-4 animate-fadeIn">
                        {/* Show Existing Recipients */}
                        {existingRecipients.length > 0 && (
                          <div className="mb-4">
                            <Label className="text-gray-300 text-sm mb-2 block">
                              Your Saved Bank Accounts
                            </Label>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {existingRecipients.map((recipient) => (
                                <button
                                  key={recipient.recipient_id}
                                  type="button"
                                  onClick={() => {
                                    setDmtRecipientId(recipient.recipient_id);
                                    setFormData(prev => ({
                                      ...prev,
                                      account_holder: recipient.recipient_name,
                                      account_number: recipient.account || recipient.acc_no
                                    }));
                                    setDmtStep(4);
                                    toast.success('Bank account selected');
                                  }}
                                  className="w-full p-3 bg-gray-800/50 border border-gray-700 rounded-xl hover:border-amber-500 transition-colors text-left"
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-white font-medium">{recipient.recipient_name}</p>
                                      <p className="text-gray-400 text-sm">
                                        {recipient.bank} • ****{(recipient.account || recipient.acc_no || '').slice(-4)}
                                      </p>
                                    </div>
                                    <ArrowRight className="h-5 w-5 text-amber-500" />
                                  </div>
                                </button>
                              ))}
                            </div>
                            <div className="relative my-4">
                              <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-gray-700" />
                              </div>
                              <div className="relative flex justify-center text-xs">
                                <span className="bg-gray-900 px-2 text-gray-500">OR ADD NEW</span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <Label className="text-gray-300 text-sm mb-2 block">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">2</span>
                          Select Bank *
                        </Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                          <Input
                            value={bankSearch}
                            onChange={(e) => { setBankSearch(e.target.value); setShowBankDropdown(true); }}
                            onFocus={() => setShowBankDropdown(true)}
                            placeholder="Search bank (e.g., SBI, HDFC)"
                            className="pl-10 h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                          />
                        </div>
                        
                        {/* Bank Dropdown */}
                        {showBankDropdown && bankSearch && !formData.selected_bank && (
                          <div className="max-h-48 overflow-y-auto bg-gray-800 border border-gray-700 rounded-xl">
                            {bankList.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase())).slice(0, 10).map((bank, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, selected_bank: bank, bank_name: bank.name }));
                                  setBankSearch(bank.name);
                                  setShowBankDropdown(false);
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-gray-700 text-white border-b border-gray-700/50 last:border-0"
                              >
                                {bank.name}
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {formData.selected_bank && (
                          <div className="space-y-4 animate-fadeIn">
                            <div className="p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                              <span className="text-green-400 text-sm">{formData.selected_bank.name}</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-gray-300 text-sm mb-2 block">Account Holder *</Label>
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
                                  placeholder="Account number"
                                  className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                                />
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-gray-300 text-sm mb-2 block">
                                  IFSC Code *
                                  {loadingIfsc && <Loader2 className="inline h-3 w-3 ml-2 animate-spin" />}
                                </Label>
                                <Input
                                  value={formData.ifsc_code}
                                  onChange={(e) => {
                                    const ifsc = e.target.value.toUpperCase();
                                    setFormData({ ...formData, ifsc_code: ifsc });
                                    if (ifsc.length === 11) lookupIfsc(ifsc);
                                  }}
                                  placeholder="e.g., SBIN0001234"
                                  maxLength={11}
                                  className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl uppercase"
                                />
                                {ifscDetails && (
                                  <p className="text-xs text-green-400 mt-1">{ifscDetails.branch}, {ifscDetails.city}</p>
                                )}
                              </div>
                              <div>
                                <Label className="text-gray-300 text-sm mb-2 block">Recipient Mobile</Label>
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
                            
                            {/* Account Verification Section */}
                            <div className="mt-4 p-4 bg-gray-800/70 border border-gray-700/50 rounded-xl">
                              <div className="flex items-center gap-2 mb-3">
                                <Shield className="h-4 w-4 text-blue-400" />
                                <span className="text-gray-300 text-sm font-medium">Bank Account Verification</span>
                                <span className="text-xs text-amber-400 ml-auto">* Mandatory</span>
                              </div>
                              
                              {!accountVerified ? (
                                <div className="space-y-3">
                                  <p className="text-gray-400 text-xs">
                                    Verify the bank account details before adding. This ensures successful transfers.
                                  </p>
                                  <Button
                                    type="button"
                                    onClick={verifyBankAccount}
                                    disabled={!formData.account_number || !formData.ifsc_code || verifyingAccount}
                                    className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                                  >
                                    {verifyingAccount ? (
                                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Verifying Account...</>
                                    ) : (
                                      <><Shield className="h-4 w-4 mr-2" /> Verify Bank Account</>
                                    )}
                                  </Button>
                                </div>
                              ) : (
                                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle className="h-5 w-5 text-green-400" />
                                    <span className="text-green-400 font-medium">Account Verified</span>
                                  </div>
                                  <p className="text-white text-sm">{verifiedAccountDetails?.account_holder_name}</p>
                                  {verifiedAccountDetails?.bank_name && (
                                    <p className="text-gray-400 text-xs mt-1">{verifiedAccountDetails.bank_name}</p>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            <Button
                              type="button"
                              onClick={addDmtRecipient}
                              disabled={!formData.account_number || !formData.ifsc_code || !formData.account_holder || addingRecipient || !accountVerified}
                              className={`w-full h-12 font-semibold rounded-xl ${accountVerified ? 'bg-amber-500 hover:bg-amber-600 text-black' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
                            >
                              {addingRecipient ? (
                                <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Adding Bank Account...</>
                              ) : !accountVerified ? (
                                <>Verify Account First</>
                              ) : (
                                <>Add Bank Account & Continue <ArrowRight className="h-5 w-5 ml-2" /></>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Step 4: Amount Entry */}
                    {dmtStep === 4 && (
                      <div className="space-y-4 animate-fadeIn">
                        {/* Show recipient info */}
                        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                          <p className="text-blue-400 text-sm font-medium">Transfer To:</p>
                          <p className="text-white">{formData.account_holder}</p>
                          <p className="text-gray-400 text-xs">{formData.bank_name} - A/C: XXXX{formData.account_number?.slice(-4)}</p>
                        </div>
                        
                        {/* Transfer Mode */}
                        <div>
                          <Label className="text-gray-300 text-sm mb-2 block">Transfer Mode</Label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, transfer_mode: 'IMPS' }))}
                              className={`p-3 rounded-xl border-2 ${
                                formData.transfer_mode === 'IMPS' || !formData.transfer_mode
                                  ? 'bg-green-500/20 border-green-500/50 text-green-400'
                                  : 'bg-gray-800/50 border-gray-700/50 text-gray-400'
                              }`}
                            >
                              <p className="font-medium">IMPS</p>
                              <p className="text-xs opacity-70">Instant</p>
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, transfer_mode: 'NEFT' }))}
                              className={`p-3 rounded-xl border-2 ${
                                formData.transfer_mode === 'NEFT'
                                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                                  : 'bg-gray-800/50 border-gray-700/50 text-gray-400'
                              }`}
                            >
                              <p className="font-medium">NEFT</p>
                              <p className="text-xs opacity-70">2-4 hours</p>
                            </button>
                          </div>
                        </div>
                        
                        {/* Amount */}
                        <div>
                          <Label className="text-gray-300 text-sm mb-2 block">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">3</span>
                            Transfer Amount (₹) *
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
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
                
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
                  disabled={submitting || !formData.amount || (userData?.kyc_status !== 'verified') || (selectedService === 'dmt' && !dmtRecipientId)}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:via-orange-400 hover:to-amber-400 text-gray-900 font-bold rounded-2xl"
                  data-testid="submit-redeem-btn"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      {selectedService === 'dmt' ? 'Processing Transfer...' : 'Submitting...'}
                    </>
                  ) : selectedService === 'dmt' ? (
                    <>Transfer to Bank</>
                  ) : (
                    <>Submit Request</>
                  )}
                </Button>
                
                {selectedService !== 'dmt' && (
                  <p className="text-xs text-gray-500 text-center">
                    Admin will process your request within 24-48 hours
                  </p>
                )}
                {selectedService === 'dmt' && (
                  <p className="text-xs text-green-400 text-center">
                    Direct instant transfer via IMPS
                  </p>
                )}
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
                  <p className="text-amber-300/70 text-xs uppercase">Reward Points</p>
                  <p className="text-3xl font-bold text-white">{(userData?.prc_balance || 0).toLocaleString()} PRC</p>
                </div>
              </div>
              <p className="text-amber-300/70 text-xs">Use for bill payments, vouchers & more</p>
            </div>
            
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
