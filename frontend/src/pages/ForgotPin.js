import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Shield, ArrowLeft, Mail, Phone, CreditCard, Lock, 
  CheckCircle, RefreshCw, AlertCircle, ArrowRight, HelpCircle 
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ForgotPin = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Email, 2: Mobile, 3: Aadhaar/PAN, 4: Security Question, 5: New PIN
  const [loading, setLoading] = useState(false);
  const [verifiedFields, setVerifiedFields] = useState({
    email: false,
    mobile: false,
    document: false,
    security: false
  });
  
  // User data
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentType, setDocumentType] = useState('aadhaar'); // aadhaar or pan
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  
  // Security Question
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [hasSecurityQuestion, setHasSecurityQuestion] = useState(false);
  
  // Verification token from backend
  const [verificationToken, setVerificationToken] = useState('');
  const [userName, setUserName] = useState('');

  // Step 1: Verify Email
  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter valid email');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API}/auth/forgot-pin/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setVerifiedFields(prev => ({ ...prev, email: true }));
        setUserName(data.user_name || 'User');
        setVerificationToken(data.token || '');
        toast.success(`✓ Email verified! Hello ${data.user_name || 'User'}`);
        setStep(2);
      } else {
        toast.error(data.detail || 'Email not found in our records');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify Mobile
  const handleVerifyMobile = async (e) => {
    e.preventDefault();
    if (!mobile || mobile.length < 10) {
      toast.error('Please enter valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API}/auth/forgot-pin/verify-mobile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(),
          mobile: mobile.trim(),
          token: verificationToken
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setVerifiedFields(prev => ({ ...prev, mobile: true }));
        setVerificationToken(data.token || verificationToken);
        toast.success('✓ Mobile number verified!');
        setStep(3);
      } else {
        toast.error(data.detail || 'Mobile number does not match our records');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Verify Aadhaar/PAN
  const handleVerifyDocument = async (e) => {
    e.preventDefault();
    
    const docNum = documentNumber.trim().replace(/\s/g, '');
    
    if (documentType === 'aadhaar' && docNum.length !== 12) {
      toast.error('Aadhaar must be 12 digits');
      return;
    }
    if (documentType === 'pan' && docNum.length !== 10) {
      toast.error('PAN must be 10 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API}/auth/forgot-pin/verify-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(),
          document_type: documentType,
          document_number: docNum,
          token: verificationToken
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setVerifiedFields(prev => ({ ...prev, document: true }));
        setVerificationToken(data.reset_token || verificationToken);
        
        // Check if user has security question
        if (data.has_security_question && data.security_question) {
          setHasSecurityQuestion(true);
          setSecurityQuestion(data.security_question);
          toast.success(`✓ ${documentType.toUpperCase()} verified! Now answer your security question`);
          setStep(4); // Security Question step
        } else {
          toast.success(`✓ ${documentType.toUpperCase()} verified! Now set your new PIN`);
          setStep(5); // Direct to Set New PIN
        }
      } else {
        toast.error(data.detail || 'Document number does not match our records');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Verify Security Question
  const handleVerifySecurityQuestion = async (e) => {
    e.preventDefault();
    
    if (!securityAnswer.trim()) {
      toast.error('Please enter your security answer');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API}/auth/forgot-pin/verify-security`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(),
          answer: securityAnswer.trim(),
          reset_token: verificationToken
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setVerifiedFields(prev => ({ ...prev, security: true }));
        setVerificationToken(data.reset_token || verificationToken);
        toast.success('✓ Security answer verified! Now set your new PIN');
        setStep(5);
      } else {
        toast.error(data.detail || 'Incorrect security answer');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Set New PIN
  const handleSetNewPin = async (e) => {
    e.preventDefault();
    
    if (!newPin || newPin.length !== 6) {
      toast.error('PIN must be 6 digits');
      return;
    }
    
    if (newPin !== confirmPin) {
      toast.error('PINs do not match');
      return;
    }
    
    // Check for weak PINs
    if (newPin === '000000' || newPin === '111111' || newPin === '123456') {
      toast.error('Please choose a stronger PIN');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API}/auth/forgot-pin/set-new-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(),
          new_pin: newPin,
          reset_token: verificationToken
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        toast.success('🎉 PIN reset successful! Please login with your new PIN');
        navigate('/login');
      } else {
        toast.error(data.detail || 'Failed to reset PIN');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to reset PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get step icon and color
  const getStepInfo = (stepNum) => {
    const icons = {
      1: { icon: Mail, color: 'purple' },
      2: { icon: Phone, color: 'blue' },
      3: { icon: CreditCard, color: 'amber' },
      4: { icon: HelpCircle, color: 'orange' },
      5: { icon: Lock, color: 'green' }
    };
    return icons[stepNum] || icons[5];
  };

  const totalSteps = hasSecurityQuestion ? 5 : 4; // 5 steps if security question exists
  const stepInfo = getStepInfo(step);
  const StepIcon = stepInfo.icon;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4">
      <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 sm:p-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-1 sm:gap-2 mb-6">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all ${
                step > s 
                  ? 'bg-green-500 text-white' 
                  : step === s 
                    ? 'bg-purple-600 text-white ring-4 ring-purple-200' 
                    : 'bg-gray-200 text-gray-500'
              }`}>
                {step > s ? <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" /> : s}
              </div>
              {s < totalSteps && (
                <div className={`w-4 sm:w-8 h-1 transition-all ${step > s ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Labels */}
        <div className="flex justify-between text-[10px] sm:text-xs text-gray-500 mb-6 px-1">
          <span className={step >= 1 ? 'text-purple-600 font-medium' : ''}>Email</span>
          <span className={step >= 2 ? 'text-purple-600 font-medium' : ''}>Mobile</span>
          <span className={step >= 3 ? 'text-purple-600 font-medium' : ''}>Document</span>
          {hasSecurityQuestion && (
            <span className={step >= 4 ? 'text-purple-600 font-medium' : ''}>Security</span>
          )}
          <span className={step >= (hasSecurityQuestion ? 5 : 4) ? 'text-purple-600 font-medium' : ''}>New PIN</span>
        </div>

        {/* Header */}
        <div className="text-center mb-6">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 bg-gradient-to-r ${
            step === 1 ? 'from-purple-500 to-indigo-600' :
            step === 2 ? 'from-blue-500 to-cyan-600' :
            step === 3 ? 'from-amber-500 to-orange-600' :
            step === 4 && hasSecurityQuestion ? 'from-orange-500 to-amber-600' :
            'from-green-500 to-emerald-600'
          }`}>
            <StepIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
            {step === 1 && 'Verify Your Email'}
            {step === 2 && 'Verify Your Mobile'}
            {step === 3 && 'Verify Your Document'}
            {step === 4 && hasSecurityQuestion && 'Security Question'}
            {step === 4 && !hasSecurityQuestion && 'Set New PIN'}
            {step === 5 && 'Set New PIN'}
          </h1>
          <p className="text-gray-500 text-sm">
            {step === 1 && 'Enter your registered email address'}
            {step === 2 && `Hello ${userName}! Now verify your mobile`}
            {step === 3 && 'Enter your Aadhaar or PAN number'}
            {step === 4 && hasSecurityQuestion && 'Answer your security question to continue'}
            {step === 4 && !hasSecurityQuestion && 'All verified! Create your new 6-digit PIN'}
            {step === 5 && 'All verified! Create your new 6-digit PIN'}
          </p>
        </div>

        {/* Verified Badges */}
        {step > 1 && (
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {verifiedFields.email && (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Email
              </span>
            )}
            {verifiedFields.mobile && (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Mobile
              </span>
            )}
            {verifiedFields.document && (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> {documentType.toUpperCase()}
              </span>
            )}
          </div>
        )}

        {/* Step 1: Email Verification */}
        {step === 1 && (
          <form onSubmit={handleVerifyEmail} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Registered Email Address
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full text-base"
                data-testid="email-input"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !email.includes('@')}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 py-6 text-lg"
              data-testid="verify-email-btn"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <ArrowRight className="w-5 h-5 mr-2" />
              )}
              {loading ? 'Verifying...' : 'Verify Email'}
            </Button>
          </form>
        )}

        {/* Step 2: Mobile Verification */}
        {step === 2 && (
          <form onSubmit={handleVerifyMobile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Registered Mobile Number
              </label>
              <Input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="Enter 10-digit mobile"
                className="w-full text-center text-lg tracking-wider"
                maxLength={10}
                data-testid="mobile-input"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || mobile.length < 10}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 py-6 text-lg"
              data-testid="verify-mobile-btn"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <ArrowRight className="w-5 h-5 mr-2" />
              )}
              {loading ? 'Verifying...' : 'Verify Mobile'}
            </Button>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← Change Email
            </button>
          </form>
        )}

        {/* Step 3: Document Verification */}
        {step === 3 && (
          <form onSubmit={handleVerifyDocument} className="space-y-4">
            {/* Document Type Toggle */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
              <button
                type="button"
                onClick={() => { setDocumentType('aadhaar'); setDocumentNumber(''); }}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  documentType === 'aadhaar' 
                    ? 'bg-white text-amber-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Aadhaar
              </button>
              <button
                type="button"
                onClick={() => { setDocumentType('pan'); setDocumentNumber(''); }}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  documentType === 'pan' 
                    ? 'bg-white text-amber-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                PAN Card
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {documentType === 'aadhaar' ? 'Aadhaar Number (12 digits)' : 'PAN Number (10 characters)'}
              </label>
              <Input
                type="text"
                value={documentNumber}
                onChange={(e) => {
                  const val = documentType === 'aadhaar' 
                    ? e.target.value.replace(/\D/g, '').slice(0, 12)
                    : e.target.value.toUpperCase().slice(0, 10);
                  setDocumentNumber(val);
                }}
                placeholder={documentType === 'aadhaar' ? 'XXXX XXXX XXXX' : 'ABCDE1234F'}
                className="w-full text-center text-lg tracking-wider font-mono"
                maxLength={documentType === 'aadhaar' ? 12 : 10}
                data-testid="document-input"
              />
              <p className="text-xs text-gray-400 mt-1 text-center">
                Last 4 digits will be matched with your KYC records
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading || (documentType === 'aadhaar' ? documentNumber.length !== 12 : documentNumber.length !== 10)}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 py-6 text-lg"
              data-testid="verify-document-btn"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <ArrowRight className="w-5 h-5 mr-2" />
              )}
              {loading ? 'Verifying...' : 'Verify Document'}
            </Button>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← Change Mobile
            </button>
          </form>
        )}

        {/* Step 4: Security Question (if user has one) */}
        {step === 4 && hasSecurityQuestion && (
          <form onSubmit={handleVerifySecurityQuestion} className="space-y-4">
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl mb-4">
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="w-5 h-5 text-orange-600" />
                <p className="text-sm font-medium text-orange-800">Security Question</p>
              </div>
              <p className="text-orange-700 font-medium">{securityQuestion}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Answer
              </label>
              <Input
                type="text"
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                placeholder="Enter your answer"
                className="w-full text-lg"
                data-testid="security-answer-input"
              />
              <p className="text-xs text-gray-400 mt-1">
                Answer is case-insensitive
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading || !securityAnswer.trim()}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 py-6 text-lg"
              data-testid="verify-security-btn"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <ArrowRight className="w-5 h-5 mr-2" />
              )}
              {loading ? 'Verifying...' : 'Verify Answer'}
            </Button>

            <button
              type="button"
              onClick={() => setStep(3)}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to Document
            </button>
          </form>
        )}

        {/* Step 5: Set New PIN (or Step 4 if no security question) */}
        {step === 5 && (
          <form onSubmit={handleSetNewPin} className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl mb-4">
              <p className="text-sm text-green-800 text-center flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" />
                All details verified! Set your new PIN below.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New PIN (6 digits)
              </label>
              <Input
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="• • • • • •"
                className="w-full text-center text-2xl tracking-[0.5em]"
                maxLength={6}
                data-testid="new-pin-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm PIN
              </label>
              <Input
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="• • • • • •"
                className="w-full text-center text-2xl tracking-[0.5em]"
                maxLength={6}
                data-testid="confirm-pin-input"
              />
            </div>

            {newPin && confirmPin && newPin !== confirmPin && (
              <p className="text-red-500 text-sm text-center flex items-center justify-center gap-1">
                <AlertCircle className="w-4 h-4" /> PINs do not match
              </p>
            )}

            {newPin && confirmPin && newPin === confirmPin && newPin.length === 6 && (
              <p className="text-green-500 text-sm text-center flex items-center justify-center gap-1">
                <CheckCircle className="w-4 h-4" /> PINs match!
              </p>
            )}

            <Button
              type="submit"
              disabled={loading || newPin.length !== 6 || newPin !== confirmPin}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 py-6 text-lg"
              data-testid="set-pin-btn"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Lock className="w-5 h-5 mr-2" />
              )}
              {loading ? 'Setting PIN...' : 'Set New PIN'}
            </Button>
          </form>
        )}

        {/* Back to Login */}
        <div className="mt-6 text-center border-t border-gray-200 pt-6">
          <Link to="/login" className="text-purple-600 font-medium hover:underline flex items-center justify-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPin;
