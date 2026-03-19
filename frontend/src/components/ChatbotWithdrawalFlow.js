/**
 * PARAS REWARD - Chatbot Bank Withdrawal Flow Component
 * =====================================================
 * 
 * IMPORTANT: This is the PRIMARY method for bank withdrawals!
 * Users request withdrawals through AI Chatbot, NOT through a direct page.
 * 
 * E2E FLOW DOCUMENTATION: /app/DMT_CHATBOT_FLOW.md
 * 
 * FLOW STEPS:
 * 1. Check eligibility (KYC verified, balance >= ₹500, valid subscription)
 * 2. Choose verification: Mobile OTP or Aadhaar eKYC
 * 3. Mobile OTP Flow:
 *    - Check customer status in Eko
 *    - Register if new (OTP sent automatically)
 *    - Verify OTP (3 attempts max)
 * 4. Collect bank details (account, IFSC - auto-lookup)
 * 5. Enter amount, show fee breakdown
 * 6. Confirm and submit withdrawal request
 * 7. Request goes to Admin for DMT processing
 * 
 * FEES:
 * - Processing Fee: ₹10 (flat)
 * - Admin Charge: 20%
 * - Example: ₹1000 → User receives ₹790
 * 
 * LIMITS:
 * - Mobile OTP: ₹25,000/day
 * - Aadhaar eKYC: ₹1,00,000/day
 * 
 * RELATED FILES:
 * - Backend API: /app/backend/routes/chatbot_withdrawal.py
 * - Admin Panel: /app/frontend/src/pages/AdminChatbotWithdrawals.js
 * - Parent Chatbot: /app/frontend/src/components/AIChatbotEnhanced.js
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Loader2, CheckCircle, XCircle, RefreshCw, Phone, 
  Banknote, Building, User, Lock, ArrowRight, ArrowLeft,
  AlertTriangle, Info, Shield, CreditCard, Smartphone, Fingerprint
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const MAX_OTP_ATTEMPTS = 3;

// Step definitions for withdrawal flow
const STEPS = {
  ELIGIBILITY: 'eligibility',
  VERIFICATION_CHOICE: 'verification_choice',  // NEW: Choose Mobile OTP or Aadhaar
  CUSTOMER_CHECK: 'customer_check',
  REGISTRATION: 'registration',
  OTP_VERIFY: 'otp_verify',
  AADHAAR_ENTRY: 'aadhaar_entry',  // NEW: Enter Aadhaar number
  AADHAAR_OTP: 'aadhaar_otp',      // NEW: Verify Aadhaar OTP
  BANK_DETAILS: 'bank_details',
  AMOUNT: 'amount',
  CONFIRM: 'confirm',
  SUBMITTED: 'submitted'
};

const ChatbotWithdrawalFlow = ({ user, onComplete, onCancel }) => {
  // Flow state
  const [currentStep, setCurrentStep] = useState(STEPS.ELIGIBILITY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // User eligibility
  const [eligibility, setEligibility] = useState(null);
  
  // Eko customer state
  const [ekoCustomer, setEkoCustomer] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  
  // OTP state
  const [otp, setOtp] = useState('');
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  
  // Bank details
  const [bankDetails, setBankDetails] = useState({
    account_holder_name: '',
    account_number: '',
    confirm_account_number: '',
    bank_name: '',
    ifsc_code: ''
  });
  
  // Amount
  const [amount, setAmount] = useState('');
  const [feeDetails, setFeeDetails] = useState(null);
  
  // IFSC lookup
  const [ifscLoading, setIfscLoading] = useState(false);
  const [ifscDetails, setIfscDetails] = useState(null);
  
  // Withdrawal result
  const [withdrawalResult, setWithdrawalResult] = useState(null);
  
  // Aadhaar verification state (NEW)
  const [verificationType, setVerificationType] = useState(null); // 'mobile' or 'aadhaar'
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarOtp, setAadhaarOtp] = useState('');
  const [aadhaarOtpRefId, setAadhaarOtpRefId] = useState('');
  const [aadhaarVerified, setAadhaarVerified] = useState(false);
  const [aadhaarKycName, setAadhaarKycName] = useState('');
  const [dmtLimit, setDmtLimit] = useState(25000); // Default: ₹25,000

  // Cooldown timer for OTP resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Check eligibility on mount
  useEffect(() => {
    checkEligibility();
  }, []);

  // ==================== API CALLS ====================

  const checkEligibility = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API}/chatbot-redeem/eligibility/${user.uid}`);
      setEligibility(response.data);
      
      if (response.data.eligible) {
        // Pre-fill name if available
        setBankDetails(prev => ({
          ...prev,
          account_holder_name: response.data.user_name || user.name || ''
        }));
        
        // Check Aadhaar verification status
        try {
          const aadhaarStatus = await axios.get(`${API}/aadhaar-dmt/status/${user.uid}`);
          if (aadhaarStatus.data.aadhaar_verified) {
            setAadhaarVerified(true);
            setDmtLimit(aadhaarStatus.data.dmt_limit || 200000);
            setAadhaarKycName(aadhaarStatus.data.kyc_name || '');
          }
        } catch (e) {
          // console.log('Aadhaar status check failed, using default limit');
        }
        
        // Go to verification choice step
        setCurrentStep(STEPS.VERIFICATION_CHOICE);
      }
    } catch (err) {
      console.error('Eligibility check failed:', err);
      setError(err.response?.data?.detail || 'Failed to check eligibility');
    } finally {
      setLoading(false);
    }
  };

  const checkEkoCustomer = async (mobile) => {
    if (!mobile) {
      setError('Mobile number not found');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API}/chatbot-redeem/eko/check-customer`, {
        uid: user.uid,
        mobile: mobile
      });
      
      const data = response.data;
      setEkoCustomer({ ...data, mobile });
      
      if (data.skip_otp || data.verified) {
        // Already verified or verification skipped
        setIsVerified(true);
        setCurrentStep(STEPS.BANK_DETAILS);
        toast.success('✅ Verification complete!');
      } else if (data.needs_registration) {
        // New customer - needs registration
        setCurrentStep(STEPS.REGISTRATION);
      } else if (data.otp_required) {
        // Existing customer but OTP pending
        setOtpSent(true);
        setCurrentStep(STEPS.OTP_VERIFY);
        toast.info('OTP verification pending');
      } else if (data.customer_exists) {
        // Customer verified
        setIsVerified(true);
        setCurrentStep(STEPS.BANK_DETAILS);
      }
    } catch (err) {
      console.error('Customer check failed:', err);
      setError(err.response?.data?.detail || 'Failed to verify customer');
    } finally {
      setLoading(false);
    }
  };

  const registerCustomer = async () => {
    if (!ekoCustomer?.mobile) {
      setError('Mobile number not found');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API}/chatbot-redeem/eko/register-customer`, {
        uid: user.uid,
        mobile: ekoCustomer.mobile,
        name: bankDetails.account_holder_name || user.name
      });
      
      if (response.data.success) {
        setOtpSent(true);
        setResendCooldown(60);
        setCurrentStep(STEPS.OTP_VERIFY);
        toast.success(response.data.message || 'OTP sent to your mobile!');
      } else {
        setError(response.data.message || 'Registration failed');
      }
    } catch (err) {
      console.error('Registration failed:', err);
      setError(err.response?.data?.detail || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp || otp.length < 4) {
      toast.error('Please enter valid OTP');
      return;
    }
    
    if (otpAttempts >= MAX_OTP_ATTEMPTS) {
      setError(`Maximum ${MAX_OTP_ATTEMPTS} attempts exceeded. Please try again later.`);
      return;
    }
    
    setLoading(true);
    setError(null);
    setOtpAttempts(prev => prev + 1);
    
    try {
      const response = await axios.post(`${API}/chatbot-redeem/eko/verify-otp`, {
        uid: user.uid,
        mobile: ekoCustomer.mobile,
        otp: otp
      });
      
      if (response.data.success && response.data.verified) {
        setIsVerified(true);
        setCurrentStep(STEPS.BANK_DETAILS);
        toast.success(response.data.message || '✅ OTP verified successfully!');
      } else {
        const errorMsg = response.data.message || 'Invalid OTP';
        setError(errorMsg);
        toast.error(errorMsg);
        setOtp('');
        
        if (otpAttempts + 1 >= MAX_OTP_ATTEMPTS) {
          setError(`Maximum attempts (${MAX_OTP_ATTEMPTS}) exceeded. Please resend OTP.`);
        }
      }
    } catch (err) {
      console.error('OTP verification failed:', err);
      setError(err.response?.data?.detail || 'Verification failed');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API}/chatbot-redeem/eko/resend-otp`, {
        uid: user.uid,
        mobile: ekoCustomer.mobile
      });
      
      if (response.data.success) {
        setOtpAttempts(0);
        setResendCooldown(60);
        setOtp('');
        toast.success(response.data.message || 'New OTP sent!');
      } else {
        setError(response.data.message || 'Failed to resend OTP');
      }
    } catch (err) {
      console.error('Resend OTP failed:', err);
      setError(err.response?.data?.detail || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const lookupIfsc = async (ifsc) => {
    if (!ifsc || ifsc.length !== 11) {
      setIfscDetails(null);
      return;
    }
    
    setIfscLoading(true);
    try {
      const response = await axios.get(`https://ifsc.razorpay.com/${ifsc}`);
      setIfscDetails({
        bank: response.data.BANK,
        branch: response.data.BRANCH,
        city: response.data.CITY
      });
      setBankDetails(prev => ({
        ...prev,
        bank_name: response.data.BANK
      }));
    } catch (err) {
      setIfscDetails(null);
      toast.error('Invalid IFSC Code');
    } finally {
      setIfscLoading(false);
    }
  };

  const calculateFees = async (amt) => {
    if (!amt || parseFloat(amt) < 500) {
      setFeeDetails(null);
      return;
    }
    
    try {
      const response = await axios.get(`${API}/chatbot-redeem/calculate-fees?amount=${amt}`);
      setFeeDetails(response.data);
    } catch (err) {
      console.error('Fee calculation failed:', err);
    }
  };

  // ==================== AADHAAR VERIFICATION APIs ====================

  const sendAadhaarOtp = async () => {
    if (!aadhaarNumber || aadhaarNumber.replace(/\s/g, '').length !== 12) {
      toast.error('Please enter 12 digit Aadhaar number');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API}/aadhaar-dmt/send-otp`, {
        uid: user.uid,
        mobile: eligibility?.mobile,
        aadhaar_number: aadhaarNumber.replace(/\s/g, ''),
        consent: true
      });
      
      if (response.data.success) {
        if (response.data.already_verified) {
          // Already verified, skip to bank details
          setAadhaarVerified(true);
          setDmtLimit(200000);
          toast.success('Aadhaar already verified! ₹2,00,000 limit active.');
          setCurrentStep(STEPS.BANK_DETAILS);
        } else if (response.data.otp_sent) {
          setAadhaarOtpRefId(response.data.otp_ref_id || '');
          setCurrentStep(STEPS.AADHAAR_OTP);
          toast.success('OTP sent to your Aadhaar-linked mobile!');
        }
      } else {
        setError(response.data.message || 'Failed to send OTP');
      }
    } catch (err) {
      console.error('Aadhaar OTP send failed:', err);
      setError(err.response?.data?.detail || 'Failed to send Aadhaar OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyAadhaarOtp = async () => {
    if (!aadhaarOtp || aadhaarOtp.length < 4) {
      toast.error('Please enter a valid OTP');
      return;
    }
    
    if (otpAttempts >= MAX_OTP_ATTEMPTS) {
      setError(`Maximum ${MAX_OTP_ATTEMPTS} attempts exceeded. Please try again.`);
      return;
    }
    
    setLoading(true);
    setError(null);
    setOtpAttempts(prev => prev + 1);
    
    try {
      const response = await axios.post(`${API}/aadhaar-dmt/verify-otp`, {
        uid: user.uid,
        mobile: eligibility?.mobile,
        aadhaar_number: aadhaarNumber.replace(/\s/g, ''),
        otp: aadhaarOtp,
        otp_ref_id: aadhaarOtpRefId
      });
      
      if (response.data.success && response.data.verified) {
        setAadhaarVerified(true);
        setDmtLimit(200000);
        setAadhaarKycName(response.data.kyc_name || '');
        toast.success('🎉 Aadhaar verified! ₹2,00,000/month limit unlocked!');
        setCurrentStep(STEPS.BANK_DETAILS);
      } else {
        setError(response.data.message || 'Invalid OTP');
        setAadhaarOtp('');
      }
    } catch (err) {
      console.error('Aadhaar OTP verify failed:', err);
      setError(err.response?.data?.detail || 'Verification failed');
      setAadhaarOtp('');
    } finally {
      setLoading(false);
    }
  };

  const resendAadhaarOtp = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API}/aadhaar-dmt/resend-otp`, {
        uid: user.uid,
        mobile: eligibility?.mobile,
        aadhaar_number: aadhaarNumber.replace(/\s/g, ''),
        consent: true
      });
      
      if (response.data.success && response.data.otp_sent) {
        setOtpAttempts(0);
        setResendCooldown(60);
        setAadhaarOtp('');
        setAadhaarOtpRefId(response.data.otp_ref_id || '');
        toast.success('New OTP sent!');
      } else {
        setError(response.data.message || 'Failed to resend OTP');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // Handle verification type selection
  const handleVerificationChoice = (type) => {
    setVerificationType(type);
    if (type === 'mobile') {
      // Standard mobile OTP flow
      setCurrentStep(STEPS.CUSTOMER_CHECK);
      checkEkoCustomer(eligibility?.mobile);
    } else if (type === 'aadhaar') {
      // Aadhaar verification flow
      if (aadhaarVerified) {
        // Already verified, skip to bank details
        setCurrentStep(STEPS.BANK_DETAILS);
      } else {
        setCurrentStep(STEPS.AADHAAR_ENTRY);
      }
    }
  };

  const submitWithdrawal = async () => {
    // Validate all fields
    if (!bankDetails.account_holder_name || !bankDetails.account_number || 
        !bankDetails.ifsc_code || !bankDetails.bank_name) {
      toast.error('Please fill all bank details');
      return;
    }
    
    if (bankDetails.account_number !== bankDetails.confirm_account_number) {
      toast.error('Account numbers do not match');
      return;
    }
    
    if (!amount || parseFloat(amount) < 500) {
      toast.error('Minimum withdrawal amount is ₹500');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API}/chatbot-redeem/request`, {
        uid: user.uid,
        amount_inr: parseFloat(amount),
        account_holder_name: bankDetails.account_holder_name,
        account_number: bankDetails.account_number,
        bank_name: bankDetails.bank_name,
        ifsc_code: bankDetails.ifsc_code.toUpperCase(),
        eko_verified: true
      });
      
      if (response.data.success) {
        setWithdrawalResult(response.data);
        setCurrentStep(STEPS.SUBMITTED);
        toast.success('🎉 Withdrawal request submitted!');
      } else {
        setError(response.data.detail || 'Submission failed');
      }
    } catch (err) {
      console.error('Withdrawal submission failed:', err);
      setError(err.response?.data?.detail || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  // ==================== RENDER HELPERS ====================

  const renderStepIndicator = () => {
    // Dynamic steps based on verification type
    let steps;
    if (verificationType === 'aadhaar') {
      steps = [
        { key: STEPS.ELIGIBILITY, label: 'Check' },
        { key: STEPS.AADHAAR_ENTRY, label: 'Aadhaar' },
        { key: STEPS.AADHAAR_OTP, label: 'OTP' },
        { key: STEPS.BANK_DETAILS, label: 'Bank' },
        { key: STEPS.AMOUNT, label: 'Amount' },
        { key: STEPS.CONFIRM, label: 'Confirm' }
      ];
    } else {
      steps = [
        { key: STEPS.ELIGIBILITY, label: 'Check' },
        { key: STEPS.CUSTOMER_CHECK, label: 'Verify' },
        { key: STEPS.OTP_VERIFY, label: 'OTP' },
        { key: STEPS.BANK_DETAILS, label: 'Bank' },
        { key: STEPS.AMOUNT, label: 'Amount' },
        { key: STEPS.CONFIRM, label: 'Confirm' }
      ];
    }
    
    const currentIndex = steps.findIndex(s => s.key === currentStep);
    
    return (
      <div className="flex items-center justify-between mb-4 px-2">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${index < currentIndex ? 'bg-green-500 text-white' : 
                index === currentIndex ? 'bg-purple-600 text-white' : 
                'bg-gray-200 text-gray-500'}`}>
              {index < currentIndex ? '✓' : index + 1}
            </div>
            {index < steps.length - 1 && (
              <div className={`w-6 h-0.5 ${index < currentIndex ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  // ==================== STEP RENDERERS ====================

  const renderEligibilityStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="text-center py-4">
        <Loader2 className="w-10 h-10 text-purple-600 animate-spin mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Checking eligibility...</p>
      </div>
      
      {error && (
        <div className="p-4 bg-red-50 rounded-xl border border-red-200">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-700 font-medium">Not Eligible</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
          <Button 
            onClick={onCancel} 
            variant="outline" 
            className="mt-3 w-full"
          >
            Go Back
          </Button>
        </div>
      )}
      
      {eligibility && !eligibility.eligible && (
        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-700 font-medium">Cannot Proceed</p>
              <p className="text-amber-600 text-sm mt-1">{eligibility.reason}</p>
            </div>
          </div>
          <Button 
            onClick={onCancel} 
            variant="outline" 
            className="mt-3 w-full"
          >
            Go Back
          </Button>
        </div>
      )}
    </motion.div>
  );

  // NEW: Verification Choice Step
  const renderVerificationChoiceStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="text-center pb-2">
        <Shield className="w-12 h-12 text-purple-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-gray-800">Select Verification Method</h3>
        <p className="text-gray-500 text-sm mt-1">
          Aadhaar verification recommended for higher limits
        </p>
      </div>
      
      {/* Option Cards */}
      <div className="space-y-3">
        {/* Aadhaar Option - Recommended */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleVerificationChoice('aadhaar')}
          className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
            aadhaarVerified 
              ? 'border-green-500 bg-green-50' 
              : 'border-purple-500 bg-purple-50 hover:bg-purple-100'
          }`}
          data-testid="aadhaar-option-btn"
        >
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              aadhaarVerified ? 'bg-green-100' : 'bg-purple-100'
            }`}>
              <Fingerprint className={`w-6 h-6 ${aadhaarVerified ? 'text-green-600' : 'text-purple-600'}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800">Aadhaar Verification</span>
                {aadhaarVerified ? (
                  <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">Verified</span>
                ) : (
                  <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">Recommended</span>
                )}
              </div>
              <p className="text-green-600 font-semibold text-sm mt-1">
                Limit: ₹2,00,000/month
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {aadhaarVerified 
                  ? '✅ Already verified! Higher limit active.'
                  : 'OTP on Aadhaar-linked mobile'}
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
        </motion.button>

        {/* Mobile Option */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleVerificationChoice('mobile')}
          className="w-full p-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-left hover:bg-gray-100 transition-all"
          data-testid="mobile-option-btn"
        >
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-gray-600" />
            </div>
            <div className="flex-1">
              <span className="font-bold text-gray-800">Mobile OTP</span>
              <p className="text-yellow-600 font-semibold text-sm mt-1">
                Limit: ₹25,000/month
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Basic verification with mobile OTP
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
        </motion.button>
      </div>
      
      {/* Balance Info */}
      <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
        <p className="text-blue-700 text-sm text-center">
          <Info className="w-4 h-4 inline mr-1" />
          Balance: <span className="font-bold">₹{eligibility?.balance_inr?.toFixed(0) || 0}</span>
        </p>
      </div>
    </motion.div>
  );

  // NEW: Aadhaar Entry Step
  const renderAadhaarEntryStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="text-center pb-2">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <CreditCard className="w-8 h-8 text-purple-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">Enter Aadhaar Number</h3>
        <p className="text-gray-500 text-sm mt-1">
          OTP will be sent to your Aadhaar-linked mobile
        </p>
      </div>
      
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Aadhaar Number (12 digits)</label>
        <Input
          type="text"
          value={aadhaarNumber}
          onChange={(e) => {
            // Format with spaces: XXXX XXXX XXXX
            const clean = e.target.value.replace(/\D/g, '').slice(0, 12);
            const formatted = clean.replace(/(\d{4})(?=\d)/g, '$1 ');
            setAadhaarNumber(formatted);
          }}
          placeholder="XXXX XXXX XXXX"
          className="text-center text-xl tracking-widest h-14"
          maxLength={14}
          autoFocus
          data-testid="aadhaar-input"
        />
      </div>
      
      {/* Consent Checkbox */}
      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
        <div className="flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-amber-700 text-xs">
            By proceeding, you consent to Aadhaar verification as per UIDAI guidelines. 
            Your data will be securely verified for DMT services.
          </p>
        </div>
      </div>
      
      <div className="flex gap-3">
        <Button 
          variant="outline"
          onClick={() => setCurrentStep(STEPS.VERIFICATION_CHOICE)}
          className="flex-1"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button 
          onClick={sendAadhaarOtp}
          disabled={loading || aadhaarNumber.replace(/\s/g, '').length !== 12}
          className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600"
          data-testid="send-aadhaar-otp-btn"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <ArrowRight className="w-5 h-5 mr-2" />
          )}
          Send OTP
        </Button>
      </div>
      
      {error && (
        <p className="text-red-600 text-sm text-center">{error}</p>
      )}
    </motion.div>
  );

  // NEW: Aadhaar OTP Step
  const renderAadhaarOtpStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="text-center pb-2">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Lock className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">Verify Aadhaar OTP</h3>
        <p className="text-gray-500 text-sm">
          OTP has been sent to your <span className="font-semibold text-purple-600">Aadhaar-linked mobile</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Aadhaar: {aadhaarNumber.slice(0, 4)} XXXX XXXX
        </p>
      </div>
      
      <div>
        <Input
          type="text"
          maxLength={6}
          value={aadhaarOtp}
          onChange={(e) => setAadhaarOtp(e.target.value.replace(/\D/g, ''))}
          placeholder="Enter 6 digit OTP"
          className="text-center text-2xl tracking-widest h-14"
          autoFocus
          data-testid="aadhaar-otp-input"
        />
        <p className="text-gray-400 text-xs text-center mt-2">
          Attempts: {otpAttempts}/{MAX_OTP_ATTEMPTS}
        </p>
      </div>
      
      <Button 
        onClick={verifyAadhaarOtp}
        disabled={loading || aadhaarOtp.length < 4 || otpAttempts >= MAX_OTP_ATTEMPTS}
        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 py-5"
        data-testid="verify-aadhaar-otp-btn"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
        ) : (
          <CheckCircle className="w-5 h-5 mr-2" />
        )}
        Verify & Unlock ₹2L Limit
      </Button>
      
      <div className="flex justify-center">
        <Button 
          variant="ghost"
          onClick={resendAadhaarOtp}
          disabled={resendCooldown > 0 || loading}
          className="text-purple-600"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
        </Button>
      </div>
      
      {error && (
        <div className="p-3 bg-red-50 rounded-xl border border-red-200">
          <p className="text-red-600 text-sm text-center">{error}</p>
        </div>
      )}
      
      <Button 
        variant="outline"
        onClick={() => {
          setAadhaarOtp('');
          setOtpAttempts(0);
          setCurrentStep(STEPS.AADHAAR_ENTRY);
        }}
        className="w-full"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Change Aadhaar Number
      </Button>
    </motion.div>
  );

  const renderCustomerCheckStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="text-center py-4">
        <Shield className="w-10 h-10 text-purple-600 mx-auto mb-3" />
        <p className="text-gray-700 font-semibold">Verifying your identity...</p>
        <p className="text-gray-500 text-sm mt-1">This ensures secure bank transfers</p>
      </div>
      
      {loading && (
        <div className="flex items-center justify-center gap-2 text-purple-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Connecting to banking service...</span>
        </div>
      )}
      
      {error && (
        <div className="p-4 bg-red-50 rounded-xl border border-red-200">
          <p className="text-red-700 text-sm">{error}</p>
          <Button 
            onClick={() => checkEkoCustomer(eligibility?.mobile)} 
            variant="outline" 
            className="mt-3 w-full"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      )}
    </motion.div>
  );

  const renderRegistrationStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="text-center pb-2">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Phone className="w-8 h-8 text-purple-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">First Time Setup</h3>
        <p className="text-gray-500 text-sm">We'll send OTP to verify your mobile</p>
        <p className="text-purple-600 font-semibold mt-2">
          {ekoCustomer?.mobile ? `+91 ${ekoCustomer.mobile}` : ''}
        </p>
      </div>
      
      <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-blue-700 text-sm">
            This one-time verification enables secure bank transfers. 
            OTP will be sent to your registered mobile.
          </p>
        </div>
      </div>
      
      <Button 
        onClick={registerCustomer}
        disabled={loading}
        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 py-5"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
        ) : (
          <ArrowRight className="w-5 h-5 mr-2" />
        )}
        Send OTP & Verify
      </Button>
      
      {error && (
        <p className="text-red-600 text-sm text-center">{error}</p>
      )}
    </motion.div>
  );

  const renderOtpStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="text-center pb-2">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Lock className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">Enter OTP</h3>
        <p className="text-gray-500 text-sm">
          OTP sent to <span className="font-semibold text-purple-600">+91 {ekoCustomer?.mobile}</span>
        </p>
      </div>
      
      <div>
        <Input
          type="text"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          placeholder="Enter 4-6 digit OTP"
          className="text-center text-2xl tracking-widest h-14"
          autoFocus
          data-testid="otp-input"
        />
        <p className="text-gray-400 text-xs text-center mt-2">
          Attempts: {otpAttempts}/{MAX_OTP_ATTEMPTS}
        </p>
      </div>
      
      <Button 
        onClick={verifyOtp}
        disabled={loading || otp.length < 4 || otpAttempts >= MAX_OTP_ATTEMPTS}
        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 py-5"
        data-testid="verify-otp-btn"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
        ) : (
          <CheckCircle className="w-5 h-5 mr-2" />
        )}
        Verify OTP
      </Button>
      
      <div className="flex justify-center">
        <Button 
          variant="ghost"
          onClick={resendOtp}
          disabled={resendCooldown > 0 || loading}
          className="text-purple-600"
          data-testid="resend-otp-btn"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
        </Button>
      </div>
      
      {error && (
        <div className="p-3 bg-red-50 rounded-xl border border-red-200">
          <p className="text-red-600 text-sm text-center">{error}</p>
        </div>
      )}
    </motion.div>
  );

  const renderBankDetailsStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="text-center pb-2">
        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
          <Building className="w-6 h-6 text-purple-600" />
        </div>
        <h3 className="text-base font-bold text-gray-800">Bank Account Details</h3>
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Account Holder Name</label>
          <Input
            value={bankDetails.account_holder_name}
            onChange={(e) => setBankDetails(prev => ({ 
              ...prev, 
              account_holder_name: e.target.value.toUpperCase() 
            }))}
            placeholder="As per bank records"
            className="h-11"
            data-testid="account-holder-input"
          />
        </div>
        
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Account Number</label>
          <Input
            type="text"
            value={bankDetails.account_number}
            onChange={(e) => setBankDetails(prev => ({ 
              ...prev, 
              account_number: e.target.value.replace(/\D/g, '') 
            }))}
            placeholder="Enter account number"
            className="h-11"
            data-testid="account-number-input"
          />
        </div>
        
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Confirm Account Number</label>
          <Input
            type="text"
            value={bankDetails.confirm_account_number}
            onChange={(e) => setBankDetails(prev => ({ 
              ...prev, 
              confirm_account_number: e.target.value.replace(/\D/g, '') 
            }))}
            placeholder="Re-enter account number"
            className={`h-11 ${
              bankDetails.confirm_account_number && 
              bankDetails.account_number !== bankDetails.confirm_account_number
                ? 'border-red-500'
                : ''
            }`}
            data-testid="confirm-account-input"
          />
        </div>
        
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">IFSC Code</label>
          <div className="relative">
            <Input
              value={bankDetails.ifsc_code}
              onChange={(e) => {
                const value = e.target.value.toUpperCase();
                setBankDetails(prev => ({ ...prev, ifsc_code: value }));
                if (value.length === 11) {
                  lookupIfsc(value);
                }
              }}
              placeholder="E.g., SBIN0001234"
              maxLength={11}
              className="h-11"
              data-testid="ifsc-input"
            />
            {ifscLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
            )}
          </div>
          {ifscDetails && (
            <p className="text-xs text-green-600 mt-1">
              ✓ {ifscDetails.bank}, {ifscDetails.branch}
            </p>
          )}
        </div>
        
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Bank Name</label>
          <Input
            value={bankDetails.bank_name}
            onChange={(e) => setBankDetails(prev => ({ ...prev, bank_name: e.target.value }))}
            placeholder="Auto-filled from IFSC"
            className="h-11"
            readOnly={!!ifscDetails}
            data-testid="bank-name-input"
          />
        </div>
      </div>
      
      <Button 
        onClick={() => setCurrentStep(STEPS.AMOUNT)}
        disabled={
          !bankDetails.account_holder_name || 
          !bankDetails.account_number ||
          bankDetails.account_number !== bankDetails.confirm_account_number ||
          !bankDetails.ifsc_code ||
          bankDetails.ifsc_code.length !== 11 ||
          !bankDetails.bank_name
        }
        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 py-5"
        data-testid="bank-details-continue-btn"
      >
        Continue <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </motion.div>
  );

  const renderAmountStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="text-center pb-2">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
          <Banknote className="w-6 h-6 text-green-600" />
        </div>
        <h3 className="text-base font-bold text-gray-800">Withdrawal Amount</h3>
        <p className="text-gray-500 text-sm">
          Balance: <span className="font-bold text-green-600">₹{eligibility?.balance_inr?.toFixed(0) || 0}</span>
        </p>
      </div>
      
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Amount (₹)</label>
        <Input
          type="number"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            calculateFees(e.target.value);
          }}
          placeholder="Min ₹500"
          min={500}
          max={eligibility?.balance_inr || 0}
          className="h-14 text-xl text-center font-bold"
          data-testid="amount-input"
        />
      </div>
      
      {/* Quick amount buttons */}
      <div className="flex gap-2">
        {[500, 1000, 2000, 5000].map(amt => (
          <Button
            key={amt}
            variant="outline"
            onClick={() => {
              setAmount(String(amt));
              calculateFees(amt);
            }}
            disabled={amt > (eligibility?.balance_inr || 0)}
            className="flex-1 text-sm"
          >
            ₹{amt}
          </Button>
        ))}
      </div>
      
      {feeDetails && (
        <div className="p-4 bg-gray-50 rounded-xl space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Amount</span>
            <span className="font-medium">₹{feeDetails.amount_inr}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Processing Fee</span>
            <span className="text-red-500">-₹{feeDetails.processing_fee}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Admin Charge ({feeDetails.admin_charge_percent}%)</span>
            <span className="text-red-500">-₹{feeDetails.admin_charge?.toFixed(0)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between font-bold">
            <span>You'll Receive</span>
            <span className="text-green-600">₹{feeDetails.net_amount?.toFixed(0)}</span>
          </div>
          <div className="text-xs text-gray-400 text-center">
            PRC Deduction: {feeDetails.prc_required?.toFixed(0)} PRC
          </div>
        </div>
      )}
      
      <div className="flex gap-3">
        <Button 
          variant="outline"
          onClick={() => setCurrentStep(STEPS.BANK_DETAILS)}
          className="flex-1"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button 
          onClick={() => setCurrentStep(STEPS.CONFIRM)}
          disabled={!amount || parseFloat(amount) < 500 || parseFloat(amount) > (eligibility?.balance_inr || 0)}
          className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600"
          data-testid="amount-continue-btn"
        >
          Continue <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  );

  const renderConfirmStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="text-center pb-2">
        <h3 className="text-base font-bold text-gray-800">Confirm Withdrawal</h3>
      </div>
      
      <div className="p-4 bg-gray-50 rounded-xl space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-500 text-sm">Account</span>
          <span className="font-medium text-sm">{bankDetails.bank_name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 text-sm">A/C Number</span>
          <span className="font-mono text-sm">****{bankDetails.account_number.slice(-4)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 text-sm">IFSC</span>
          <span className="font-mono text-sm">{bankDetails.ifsc_code}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 text-sm">Holder</span>
          <span className="font-medium text-sm">{bankDetails.account_holder_name}</span>
        </div>
        <div className="border-t pt-2 flex justify-between">
          <span className="text-gray-700 font-medium">Amount</span>
          <span className="font-bold text-lg">₹{amount}</span>
        </div>
        <div className="flex justify-between text-green-600">
          <span className="font-medium">You'll Receive</span>
          <span className="font-bold">₹{feeDetails?.net_amount?.toFixed(0)}</span>
        </div>
      </div>
      
      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-amber-700 text-xs">
            Please verify bank details. Wrong details may result in failed transfer. Processing time: 5-7 working days.
          </p>
        </div>
      </div>
      
      {error && (
        <div className="p-3 bg-red-50 rounded-xl border border-red-200">
          <p className="text-red-600 text-sm text-center">{error}</p>
        </div>
      )}
      
      <div className="flex gap-3">
        <Button 
          variant="outline"
          onClick={() => setCurrentStep(STEPS.AMOUNT)}
          className="flex-1"
          disabled={loading}
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button 
          onClick={submitWithdrawal}
          disabled={loading}
          className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600"
          data-testid="submit-withdrawal-btn"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <CheckCircle className="w-5 h-5 mr-2" />
          )}
          Submit Request
        </Button>
      </div>
    </motion.div>
  );

  const renderSubmittedStep = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-4 text-center"
    >
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>
      
      <div>
        <h3 className="text-xl font-bold text-gray-800">Request Submitted!</h3>
        <p className="text-gray-500 text-sm mt-1">Your withdrawal request has been submitted</p>
      </div>
      
      {withdrawalResult && (
        <div className="p-4 bg-green-50 rounded-xl border border-green-200 text-left">
          <p className="text-green-700 font-medium text-sm">Request ID: {withdrawalResult.request_id}</p>
          <div className="mt-2 space-y-1 text-xs text-green-600">
            <p>Amount: ₹{withdrawalResult.details?.amount}</p>
            <p>Net Amount: ₹{withdrawalResult.details?.net_amount}</p>
            <p>Bank: {withdrawalResult.details?.bank}</p>
            <p>Expected: {withdrawalResult.details?.expected_days}</p>
          </div>
        </div>
      )}
      
      <Button 
        onClick={() => onComplete?.(withdrawalResult)}
        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 py-5"
        data-testid="done-btn"
      >
        Done
      </Button>
    </motion.div>
  );

  // ==================== MAIN RENDER ====================

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold">Bank Withdrawal</h2>
              <p className="text-xs text-white/70">
                {aadhaarVerified 
                  ? '✅ Aadhaar Verified • ₹2L limit' 
                  : 'Secure transfer via Eko'}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onCancel}
            className="text-white hover:bg-white/20"
          >
            <XCircle className="w-5 h-5" />
          </Button>
        </div>
      </div>
      
      {/* Step Indicator */}
      {currentStep !== STEPS.SUBMITTED && currentStep !== STEPS.VERIFICATION_CHOICE && (
        <div className="p-4 bg-gray-50 border-b">
          {renderStepIndicator()}
        </div>
      )}
      
      {/* Content */}
      <div className="p-4 max-h-[60vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {currentStep === STEPS.ELIGIBILITY && renderEligibilityStep()}
          {currentStep === STEPS.VERIFICATION_CHOICE && renderVerificationChoiceStep()}
          {currentStep === STEPS.AADHAAR_ENTRY && renderAadhaarEntryStep()}
          {currentStep === STEPS.AADHAAR_OTP && renderAadhaarOtpStep()}
          {currentStep === STEPS.CUSTOMER_CHECK && renderCustomerCheckStep()}
          {currentStep === STEPS.REGISTRATION && renderRegistrationStep()}
          {currentStep === STEPS.OTP_VERIFY && renderOtpStep()}
          {currentStep === STEPS.BANK_DETAILS && renderBankDetailsStep()}
          {currentStep === STEPS.AMOUNT && renderAmountStep()}
          {currentStep === STEPS.CONFIRM && renderConfirmStep()}
          {currentStep === STEPS.SUBMITTED && renderSubmittedStep()}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ChatbotWithdrawalFlow;
