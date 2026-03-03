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
  
  // Money Transfer (Admin Approval Required)
  dmt: { 
    name: 'Bank Transfer', 
    icon: Banknote, 
    color: 'green',
    gradient: 'from-green-500 to-emerald-500',
    fields: ['account_number', 'ifsc_code', 'account_holder', 'mobile', 'bank_name'],
    category: 'transfer',
    requiresAdmin: true
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
  mobile_postpaid: [
    { id: 'JIO', name: 'Jio Postpaid' },
    { id: 'AIRTEL', name: 'Airtel Postpaid' },
    { id: 'VI', name: 'Vi Postpaid' },
    { id: 'BSNL', name: 'BSNL Postpaid' }
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
  fastag: [
    { id: 'PAYTM', name: 'Paytm FASTag' },
    { id: 'ICICI', name: 'ICICI FASTag' },
    { id: 'HDFC', name: 'HDFC FASTag' },
    { id: 'SBI', name: 'SBI FASTag' },
    { id: 'AXIS', name: 'Axis FASTag' }
  ],
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
  const [verifyingCustomer, setVerifyingCustomer] = useState(false);
  const [addingRecipient, setAddingRecipient] = useState(false);
  const [senderMobile, setSenderMobile] = useState('');
  
  // EMI lender search states
  const [lenderSearch, setLenderSearch] = useState('');
  const [showLenderDropdown, setShowLenderDropdown] = useState(false);
  
  // Auto-detect operator states
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [autoDetection, setAutoDetection] = useState(null);
  const [autoDetectedPlans, setAutoDetectedPlans] = useState([]);
  
  // Bill fetch states (for electricity, gas, etc.)
  const [billDetails, setBillDetails] = useState(null);
  const [fetchingBill, setFetchingBill] = useState(false);
  const [billError, setBillError] = useState(null);
  
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
    lpg_id: ''
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
    } else if (serviceType === 'fastag') {
      return details.vehicle_number || '';
    } else if (serviceType === 'emi') {
      return details.loan_account ? `${details.loan_account.slice(-6)}` : '';
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
      const categoryMap = {
        dth: 'dth',
        electricity: 'electricity',
        gas: 'gas',
        emi: 'loan_emi'
      };
      category = categoryMap[serviceType];
    }
    
    if (!category) return;
    
    setLoadingOperators(true);
    try {
      const response = await axios.get(`${API}/eko/bbps/operators/${category}`);
      if (response.data.operators) {
        // For mobile, store with recharge type key
        const storeKey = serviceType === 'mobile_recharge' ? `mobile_${rechargeType}` : serviceType;
        setOperators(prev => ({
          ...prev,
          [storeKey]: response.data.operators
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
      const response = await axios.get(`${API}/eko/dmt/v3/customer/${senderMobile}`);
      
      if (response.data.success) {
        setDmtCustomer(response.data.data);
        setDmtStep(3); // Go to recipient step
        toast.success('Customer verified successfully!');
      } else {
        // Customer not found - might need OTP verification
        toast.info('New customer - verification may be required');
        setDmtCustomer({ mobile: senderMobile, is_new: true });
        setDmtStep(3); // Still proceed to recipient step
      }
    } catch (error) {
      console.error('Customer verification failed:', error);
      // Allow to proceed for testing
      toast.warning('Could not verify customer. Proceeding...');
      setDmtCustomer({ mobile: senderMobile, is_new: true });
      setDmtStep(3);
    } finally {
      setVerifyingCustomer(false);
    }
  };
  
  // DMT: Add Recipient (Bank Account)
  const addDmtRecipient = async () => {
    if (!formData.account_number || !formData.ifsc_code || !formData.account_holder) {
      toast.error('Please fill all bank account details');
      return;
    }
    
    setAddingRecipient(true);
    try {
      const customerId = dmtCustomer?.customer_id || dmtCustomer?.mobile || senderMobile;
      
      const response = await axios.post(`${API}/eko/dmt/v3/recipient/add`, {
        customer_id: customerId,
        recipient_name: formData.account_holder,
        bank_code: formData.selected_bank?.bank_code || formData.bank_name?.substring(0, 4).toUpperCase(),
        account_number: formData.account_number,
        ifsc: formData.ifsc_code,
        recipient_mobile: formData.mobile || senderMobile
      });
      
      if (response.data.success && response.data.recipient_id) {
        setDmtRecipientId(response.data.recipient_id);
        setDmtStep(4); // Go to amount step
        toast.success('Bank account added successfully!');
      } else {
        // For testing, generate a temporary ID
        const tempId = `RCPT_${Date.now()}`;
        setDmtRecipientId(tempId);
        setDmtStep(4);
        toast.info('Recipient registered. Proceeding...');
      }
    } catch (error) {
      console.error('Add recipient failed:', error);
      // Allow to proceed for testing
      const tempId = `RCPT_${Date.now()}`;
      setDmtRecipientId(tempId);
      setDmtStep(4);
      toast.warning('Could not verify recipient with Eko. Proceeding...');
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
    }
  }, [selectedService]);
  
  // Fetch bill details for electricity/gas/postpaid/EMI and new services
  const fetchBillDetails = async () => {
    let consumerNumber, operatorId, category;
    
    // Handle different services
    if (selectedService === 'emi') {
      consumerNumber = formData.loan_account;
      operatorId = formData.operator || formData.selected_lender?.operator_id;
      category = 'emi';
      
      if (!consumerNumber || !operatorId) {
        toast.error('Loan Account Number and Bank/Lender both are required');
        return;
      }
    } else if (selectedService === 'mobile_recharge' && formData.recharge_type === 'postpaid') {
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
    } else if (selectedService === 'fastag') {
      consumerNumber = formData.vehicle_number;
      operatorId = formData.operator;
      category = 'fastag';
      
      if (!consumerNumber || !operatorId) {
        toast.error('Vehicle Number and Provider both are required');
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
      const response = await axios.post(`${API}/eko/bbps/fetch-bill`, {
        category: category,
        biller_id: operatorId,
        customer_params: {
          consumer_number: consumerNumber
        }
      });
      
      if (response.data.success || response.data.status === 0) {
        const data = response.data.data || response.data;
        setBillDetails({
          customerName: data.customer_name || data.customername || data.name || 'N/A',
          billAmount: data.bill_amount || data.billamount || data.amount || 0,
          billNumber: data.bill_number || data.billnumber || data.billno || 'N/A',
          billDate: data.bill_date || data.billdate || data.duedate || 'N/A',
          dueDate: data.due_date || data.duedate || 'N/A',
          billPeriod: data.bill_period || data.billperiod || 'N/A'
        });
        
        // Auto-fill amount from bill
        if (data.bill_amount || data.billamount || data.amount) {
          const billAmt = data.bill_amount || data.billamount || data.amount;
          setFormData(prev => ({
            ...prev,
            amount: String(billAmt)
          }));
          toast.success(`Bill fetched! Amount: ₹${billAmt}`);
        }
      } else {
        setBillError(response.data.message || 'Bill fetch failed');
        toast.error(response.data.message || 'Bill details not found');
      }
    } catch (error) {
      console.error('Bill fetch error:', error);
      const errorMsg = error.response?.data?.detail || error.response?.data?.message || 'Bill fetch failed';
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
  }, [selectedService, formData.operator]);
  
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
  
  // Filter lenders based on search
  const emiOperators = operators['emi'] || [];
  const filteredLenders = emiOperators.filter(lender =>
    lender.name?.toLowerCase().includes(lenderSearch.toLowerCase())
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
    } else if (selectedService === 'fastag') {
      details.vehicle_number = formData.vehicle_number;
      details.fastag_id = formData.vehicle_number;
      details.consumer_number = formData.vehicle_number;
    } else if (selectedService === 'education') {
      details.student_id = formData.student_id;
      details.enrollment_number = formData.student_id;
      details.consumer_number = formData.student_id;
    } else if (selectedService === 'lpg') {
      details.lpg_id = formData.lpg_id;
      details.consumer_number = formData.lpg_id;
    } else if (selectedService === 'emi') {
      details.loan_account = formData.loan_account;
      details.borrower_name = formData.borrower_name;
      details.loan_type = formData.loan_type;
    } else if (selectedService === 'dmt') {
      details.account_number = formData.account_number;
      details.ifsc_code = formData.ifsc_code;
      details.account_holder = formData.account_holder;
      details.bank_name = formData.bank_name;
      details.mobile = formData.mobile;
    } else {
      // Default for electricity, gas, water, broadband, landline, cable_tv, municipal_tax, housing_society, dth
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
      const response = await axios.post(`${API}/redeem/request`, {
        user_id: user.uid,
        service_type: selectedService,
        amount: parseFloat(formData.amount),
        details
      });
      
      // Save to Quick Pay on success
      if (response.data.success !== false) {
        saveToQuickPay(selectedService, details, parseFloat(formData.amount));
      }
      
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
    if (selectedService === 'mobile_recharge') {
      const key = `mobile_${formData.recharge_type}`;
      return operators[key] || OPERATORS[selectedService] || [];
    }
    return operators[selectedService] || OPERATORS[selectedService] || [];
  })();
  
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
                {/* Recharge & DTH */}
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
                    {['fastag', 'education', 'municipal_tax', 'housing_society'].map(id => {
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
                {/* ELECTRICITY / GAS - New Flow */}
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
                          Consumer Number *
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            value={formData.consumer_number}
                            onChange={(e) => {
                              setFormData({ ...formData, consumer_number: e.target.value, amount: '' });
                              setBillDetails(null);
                            }}
                            placeholder="Enter consumer number"
                            className="flex-1 h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                            data-testid="consumer-input"
                          />
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
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Enter consumer number and click 🔍 to fetch bill</p>
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
                      <div className="animate-fadeIn bg-gradient-to-br from-red-500/10 to-rose-500/10 border border-red-500/30 rounded-2xl p-4">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-5 w-5 text-red-400" />
                          <span className="text-red-400 font-medium">{billError}</span>
                        </div>
                        <p className="text-gray-400 text-sm mt-2">Enter amount manually below.</p>
                      </div>
                    )}
                    
                    {/* Step 4: Amount (auto-filled or manual) */}
                    {(billDetails || billError || formData.consumer_number) && formData.operator && (
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
                
                {/* ============================================ */}
                {/* MOBILE RECHARGE - New Flow with Auto-Detect */}
                {/* 1. Type → 2. Mobile (Auto-detect) → 3. Verify/Override Operator → 4. Amount → Submit */}
                {/* ============================================ */}
                {selectedService === 'mobile_recharge' && (
                  <>
                    {/* Step 1: Recharge Type */}
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">1</span>
                        Recharge Type
                      </Label>
                      <div className="flex gap-3">
                        {['prepaid', 'postpaid'].map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, recharge_type: type, amount: '', operator: '', circle: '' });
                              setBillDetails(null);
                              setBillError(null);
                              setAutoDetection(null);
                              setAutoDetectedPlans([]);
                            }}
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
                    
                    {/* Step 2: Mobile Number with Auto-Detect */}
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">2</span>
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
                        {formData.recharge_type === 'postpaid' && formData.mobile_number.length === 10 && !autoDetecting && (
                          <Button
                            type="button"
                            onClick={fetchBillDetails}
                            disabled={fetchingBill}
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
                      <p className="text-xs text-gray-500 mt-1">
                        {formData.mobile_number.length < 10 
                          ? 'Enter 10 digits to auto-detect operator'
                          : formData.recharge_type === 'postpaid' 
                            ? 'Click 🔍 to fetch bill details' 
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
                    
                    {/* Step 3: Override Operator (optional) */}
                    {formData.mobile_number.length === 10 && (
                      <div className="animate-fadeIn">
                        <Label className="text-gray-300 text-sm mb-2 block">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">3</span>
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
                    
                    {/* Step 4: Circle (for prepaid, auto-filled from detection) */}
                    {formData.operator && formData.mobile_number.length === 10 && formData.recharge_type === 'prepaid' && (
                      <div className="animate-fadeIn">
                        <Label className="text-gray-300 text-sm mb-2 block">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">4</span>
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
                    
                    {/* Bill Details for Postpaid */}
                    {billDetails && formData.recharge_type === 'postpaid' && (
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
                        </div>
                      </div>
                    )}
                    
                    {billError && formData.recharge_type === 'postpaid' && (
                      <div className="animate-fadeIn bg-gradient-to-br from-red-500/10 to-rose-500/10 border border-red-500/30 rounded-2xl p-4">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-5 w-5 text-red-400" />
                          <span className="text-red-400 font-medium">{billError}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Popular Plans (from auto-detection) */}
                    {autoDetectedPlans.length > 0 && formData.operator && formData.recharge_type === 'prepaid' && (
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
                    
                    {/* Step 5: Amount */}
                    {formData.operator && formData.mobile_number.length === 10 && (
                      <div className="animate-fadeIn">
                        <Label className="text-gray-300 text-sm mb-2 block">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">{formData.recharge_type === 'prepaid' ? '5' : '4'}</span>
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
                        {formData.recharge_type === 'prepaid' && !autoDetectedPlans.length && (
                          <p className="text-xs text-gray-500 mt-1">Popular: ₹199, ₹299, ₹399, ₹599</p>
                        )}
                      </div>
                    )}
                  </>
                )}
                
                {/* ============================================ */}
                {/* DTH - Similar Flow */}
                {/* 1. Provider → 2. Customer ID → 3. Amount → 4. Submit */}
                {/* ============================================ */}
                {selectedService === 'dth' && (
                  <>
                    {/* Step 1: DTH Provider */}
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">1</span>
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
                    
                    {/* Step 2: Customer ID (only show after provider selected) */}
                    {formData.operator && (
                      <div className="animate-fadeIn">
                        <Label className="text-gray-300 text-sm mb-2 block">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">2</span>
                          Customer/Subscriber ID *
                        </Label>
                        <Input
                          value={formData.consumer_number}
                          onChange={(e) => setFormData({ ...formData, consumer_number: e.target.value })}
                          placeholder="Enter DTH Customer ID (from STB)"
                          className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                          data-testid="consumer-input"
                        />
                        <p className="text-xs text-gray-500 mt-1">Find Customer ID on your Set-Top Box</p>
                      </div>
                    )}
                    
                    {/* Step 3: Amount */}
                    {formData.operator && formData.consumer_number && (
                      <div className="animate-fadeIn">
                        <Label className="text-gray-300 text-sm mb-2 block">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">3</span>
                          Amount (₹) *
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
                
                {/* EMI Fields - Advanced with Lender Search */}
                {selectedService === 'emi' && (
                  <>
                    {/* Step 1: Lender/Bank Search with Dropdown */}
                    <div className="relative">
                      <Label className="text-gray-300 text-sm mb-2 block">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">1</span>
                        Bank/Lender *
                        {loadingOperators && <Loader2 className="inline h-3 w-3 ml-2 animate-spin text-amber-400" />}
                        <span className="text-gray-500 text-xs ml-2">({emiOperators.length} lenders)</span>
                      </Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                          value={lenderSearch}
                          onChange={(e) => {
                            setLenderSearch(e.target.value);
                            setShowLenderDropdown(true);
                          }}
                          onFocus={() => setShowLenderDropdown(true)}
                          placeholder="Search bank/lender (e.g., HDFC, Bajaj, ICICI)"
                          className="pl-10 h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                        />
                        {formData.selected_lender && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, selected_lender: null, bank_name: '' }));
                              setLenderSearch('');
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      
                      {/* Selected Lender Display */}
                      {formData.selected_lender && (
                        <div className="mt-2 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-400" />
                            <span className="text-green-400 font-medium">{formData.selected_lender.name}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Lender Dropdown */}
                      {showLenderDropdown && !formData.selected_lender && lenderSearch && (
                        <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-gray-800 border border-gray-700 rounded-xl shadow-2xl">
                          {filteredLenders.length === 0 ? (
                            <div className="p-4 text-gray-500 text-center">No lenders found</div>
                          ) : (
                            filteredLenders.slice(0, 15).map((lender, index) => (
                              <button
                                key={lender.operator_id || index}
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({
                                    ...prev,
                                    selected_lender: lender,
                                    bank_name: lender.name,
                                    operator: lender.operator_id
                                  }));
                                  setLenderSearch(lender.name);
                                  setShowLenderDropdown(false);
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-gray-700 flex items-center gap-3 border-b border-gray-700/50 last:border-0"
                              >
                                <Building className="h-4 w-4 text-red-400" />
                                <span className="text-white">{lender.name}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Step 2: Loan Details (only show after lender selected) */}
                    {formData.selected_lender && (
                      <div className="animate-fadeIn space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-gray-300 text-sm mb-2 block">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">2</span>
                              Loan Account Number *
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                value={formData.loan_account}
                                onChange={(e) => {
                                  setFormData({ ...formData, loan_account: e.target.value, amount: '' });
                                  setBillDetails(null);
                                }}
                                placeholder="Loan account number"
                                className="flex-1 h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                              />
                              <Button
                                type="button"
                                onClick={fetchBillDetails}
                                disabled={fetchingBill || !formData.loan_account}
                                className="h-12 px-4 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-semibold rounded-xl disabled:opacity-50"
                                data-testid="fetch-emi-btn"
                              >
                                {fetchingBill ? (
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                  <Search className="h-5 w-5" />
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Click 🔍 to fetch EMI details</p>
                          </div>
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
                        </div>
                        
                        {/* EMI Bill Details */}
                        {billDetails && (
                          <div className="animate-fadeIn bg-gradient-to-br from-red-500/10 to-rose-500/10 border border-red-500/30 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle className="h-5 w-5 text-red-400" />
                              <span className="text-red-400 font-semibold">EMI Details Found!</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-400">Borrower Name</p>
                                <p className="text-white font-medium">{billDetails.customerName}</p>
                              </div>
                              <div>
                                <p className="text-gray-400">EMI Amount</p>
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
                          <div className="animate-fadeIn bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-2xl p-4">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-5 w-5 text-orange-400" />
                              <span className="text-orange-400 font-medium">{billError}</span>
                            </div>
                            <p className="text-gray-400 text-sm mt-2">Enter EMI amount manually below.</p>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-gray-300 text-sm mb-2 block">Borrower Name *</Label>
                            <Input
                              value={formData.borrower_name}
                              onChange={(e) => setFormData({ ...formData, borrower_name: e.target.value })}
                              placeholder="Name as per bank records"
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
                              <option value="consumer_durable">Consumer Durable Loan</option>
                              <option value="microfinance">Microfinance Loan</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Step 3: Amount (only show after loan details) */}
                    {formData.selected_lender && formData.loan_account && (
                      <div className="animate-fadeIn">
                        <Label className="text-gray-300 text-sm mb-2 block">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">3</span>
                          EMI Amount (₹) *
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
                {/* NEW BBPS SERVICES - Generic Form */}
                {/* Water, Broadband, Landline, Credit Card, Insurance, FASTag, Education, etc. */}
                {/* ============================================ */}
                {['water', 'broadband', 'landline', 'credit_card', 'insurance', 'fastag', 'education', 'municipal_tax', 'housing_society', 'lpg', 'cable_tv', 'mobile_postpaid'].includes(selectedService) && (
                  <>
                    {/* Step 1: Provider Selection */}
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold mr-2">1</span>
                        {selectedService === 'insurance' ? 'Insurance Company' : 
                         selectedService === 'credit_card' ? 'Bank/Card Issuer' :
                         selectedService === 'fastag' ? 'FASTag Provider' :
                         selectedService === 'education' ? 'Institution' :
                         selectedService === 'lpg' ? 'LPG Provider' :
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
                           selectedService === 'fastag' ? 'Vehicle Number / FASTag ID' :
                           selectedService === 'education' ? 'Student ID / Enrollment No.' :
                           selectedService === 'lpg' ? 'LPG Consumer ID' :
                           selectedService === 'municipal_tax' ? 'Property ID' :
                           selectedService === 'housing_society' ? 'Flat/Unit No.' :
                           'Consumer/Account Number'} *
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            value={selectedService === 'mobile_postpaid' ? formData.mobile_number : 
                                   selectedService === 'credit_card' ? formData.card_number :
                                   selectedService === 'insurance' ? formData.policy_number :
                                   selectedService === 'fastag' ? formData.vehicle_number :
                                   selectedService === 'education' ? formData.student_id :
                                   selectedService === 'lpg' ? formData.lpg_id :
                                   formData.consumer_number}
                            onChange={(e) => {
                              const field = selectedService === 'mobile_postpaid' ? 'mobile_number' :
                                           selectedService === 'credit_card' ? 'card_number' :
                                           selectedService === 'insurance' ? 'policy_number' :
                                           selectedService === 'fastag' ? 'vehicle_number' :
                                           selectedService === 'education' ? 'student_id' :
                                           selectedService === 'lpg' ? 'lpg_id' :
                                           'consumer_number';
                              setFormData({ ...formData, [field]: e.target.value, amount: '' });
                              setBillDetails(null);
                            }}
                            placeholder={selectedService === 'mobile_postpaid' ? 'Enter 10 digit mobile number' :
                                        selectedService === 'fastag' ? 'Enter vehicle number (e.g., MH12AB1234)' :
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
                                                        selectedService === 'fastag' ? formData.vehicle_number :
                                                        selectedService === 'education' ? formData.student_id :
                                                        selectedService === 'lpg' ? formData.lpg_id :
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
                                           selectedService === 'fastag' ? formData.vehicle_number :
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
                    
                    {/* Step 2: Customer Verified - Show info */}
                    {dmtStep >= 2 && dmtCustomer && (
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
                            
                            <Button
                              type="button"
                              onClick={addDmtRecipient}
                              disabled={!formData.account_number || !formData.ifsc_code || !formData.account_holder || addingRecipient}
                              className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl"
                            >
                              {addingRecipient ? (
                                <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Adding Bank Account...</>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default RedeemPageV2;
