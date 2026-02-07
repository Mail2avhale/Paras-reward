import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Phone, KeyRound, Shield, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import PinInput from '@/components/PinInput';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ForgotPin = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Mobile, 2: OTP Widget, 3: New PIN
  const [loading, setLoading] = useState(false);
  const [mobile, setMobile] = useState('');
  const [widgetId, setWidgetId] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errors, setErrors] = useState({});
  const otpContainerRef = useRef(null);

  // Load MSG91 OTP Widget script
  useEffect(() => {
    if (step === 2 && widgetId) {
      loadOTPWidget();
    }
  }, [step, widgetId]);

  const loadOTPWidget = () => {
    // Remove any existing scripts
    const existingScript = document.getElementById('msg91-otp-script');
    if (existingScript) {
      existingScript.remove();
    }

    // Configuration for MSG91 widget
    window.configuration = {
      widgetId: widgetId,
      tokenAuth: "", // Will be set by widget
      identifier: `91${mobile.replace(/^91/, '')}`,
      exposeMethods: true,
      success: (data) => {
        console.log('OTP Success:', data);
        handleOTPSuccess(data);
      },
      failure: (error) => {
        console.log('OTP Failure:', error);
        toast.error('OTP verification failed. Please try again.');
      }
    };

    // Load MSG91 scripts
    const urls = [
      'https://verify.msg91.com/otp-provider.js',
      'https://verify.phone91.com/otp-provider.js'
    ];

    let i = 0;
    const attempt = () => {
      const script = document.createElement('script');
      script.id = 'msg91-otp-script';
      script.src = urls[i];
      script.async = true;
      script.onload = () => {
        if (typeof window.initSendOTP === 'function') {
          window.initSendOTP(window.configuration);
        }
      };
      script.onerror = () => {
        i++;
        if (i < urls.length) {
          attempt();
        }
      };
      document.head.appendChild(script);
    };
    attempt();
  };

  const handleOTPSuccess = async (data) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/forgot-pin/verify-otp`, {
        mobile: mobile,
        access_token: data.token || data.message
      });

      if (response.data.success) {
        setResetToken(response.data.reset_token);
        setStep(3);
        toast.success('OTP verified! Now set your new PIN');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      toast.error(error.response?.data?.detail || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckMobile = async (e) => {
    e.preventDefault();
    setErrors({});

    // Validate mobile
    const cleanMobile = mobile.replace(/\D/g, '');
    if (cleanMobile.length < 10) {
      setErrors({ mobile: 'Enter valid 10-digit mobile number' });
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/forgot-pin/check-mobile`, {
        mobile: cleanMobile
      });

      if (response.data.success) {
        setWidgetId(response.data.widget_id);
        setMobile(cleanMobile);
        setStep(2);
        toast.success('Mobile verified! Enter OTP sent to your phone');
      }
    } catch (error) {
      console.error('Check mobile error:', error);
      toast.error(error.response?.data?.detail || 'Mobile number not found');
    } finally {
      setLoading(false);
    }
  };

  const validatePin = () => {
    const newErrors = {};

    if (!newPin || newPin.length !== 6) {
      newErrors.newPin = '6-digit PIN is required';
    } else if (!/^\d{6}$/.test(newPin)) {
      newErrors.newPin = 'PIN must contain only numbers';
    } else if (/^(\d)\1{5}$/.test(newPin)) {
      newErrors.newPin = 'PIN cannot be all same digits';
    } else if (/^(012345|123456|234567|345678|456789|567890|987654|876543|765432|654321|543210)$/.test(newPin)) {
      newErrors.newPin = 'PIN cannot be sequential numbers';
    }

    if (newPin !== confirmPin) {
      newErrors.confirmPin = 'PINs do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleResetPin = async (e) => {
    e.preventDefault();

    if (!validatePin()) {
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/forgot-pin/reset`, {
        mobile: mobile,
        new_pin: newPin,
        reset_token: resetToken
      });

      if (response.data.success) {
        toast.success('PIN reset successfully!');
        navigate('/login');
      }
    } catch (error) {
      console.error('Reset PIN error:', error);
      toast.error(error.response?.data?.detail || 'Failed to reset PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4">
      <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4 ${
            step === 3 ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-orange-500 to-red-600'
          }`}>
            {step === 3 ? (
              <KeyRound className="h-10 w-10 text-white" />
            ) : (
              <Shield className="h-10 w-10 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {step === 1 && 'Forgot PIN'}
            {step === 2 && 'Verify OTP'}
            {step === 3 && 'Set New PIN'}
          </h1>
          <p className="text-gray-600">
            {step === 1 && 'Enter your registered mobile number'}
            {step === 2 && 'Enter the OTP sent to your mobile'}
            {step === 3 && 'Create a new 6-digit PIN'}
          </p>
        </div>

        {/* Step 1: Mobile Number */}
        {step === 1 && (
          <form onSubmit={handleCheckMobile} className="space-y-6">
            <div>
              <Label htmlFor="mobile" className="mb-2 block">Mobile Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <div className="absolute left-10 top-1/2 -translate-y-1/2 text-gray-500 font-medium">+91</div>
                <Input
                  id="mobile"
                  type="tel"
                  inputMode="numeric"
                  placeholder="Enter 10-digit mobile"
                  value={mobile}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setMobile(val);
                    if (errors.mobile) setErrors({});
                  }}
                  className={`pl-16 py-6 rounded-xl ${errors.mobile ? 'border-red-500' : ''}`}
                  data-testid="forgot-pin-mobile"
                />
              </div>
              {errors.mobile && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.mobile}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || mobile.length < 10}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white py-6 rounded-xl text-lg font-semibold"
              data-testid="forgot-pin-submit"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verifying...
                </div>
              ) : (
                'Send OTP'
              )}
            </Button>
          </form>
        )}

        {/* Step 2: OTP Widget */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm text-blue-800">
                OTP sent to <strong>+91 {mobile.slice(-10, -5)}*****</strong>
              </p>
            </div>

            {/* MSG91 OTP Widget Container */}
            <div 
              id="otp-widget-container" 
              ref={otpContainerRef}
              className="min-h-[200px] flex items-center justify-center"
            >
              {loading ? (
                <div className="text-center">
                  <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">Verifying OTP...</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-gray-500 mb-4">MSG91 OTP Widget Loading...</p>
                  <Button
                    onClick={loadOTPWidget}
                    variant="outline"
                    className="text-purple-600"
                  >
                    Reload Widget
                  </Button>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              onClick={() => setStep(1)}
              className="w-full text-gray-600"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Change Mobile Number
            </Button>
          </div>
        )}

        {/* Step 3: Set New PIN */}
        {step === 3 && (
          <form onSubmit={handleResetPin} className="space-y-6">
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <p className="text-sm font-medium">OTP Verified Successfully!</p>
              </div>
            </div>

            <PinInput
              value={newPin}
              onChange={(val) => {
                setNewPin(val);
                if (errors.newPin) setErrors(prev => ({ ...prev, newPin: '' }));
              }}
              error={errors.newPin}
              label="Create New 6-Digit PIN"
              testId="new-pin"
            />

            <PinInput
              value={confirmPin}
              onChange={(val) => {
                setConfirmPin(val);
                if (errors.confirmPin) setErrors(prev => ({ ...prev, confirmPin: '' }));
              }}
              error={errors.confirmPin}
              label="Confirm 6-Digit PIN"
              testId="confirm-pin"
            />

            {/* Tips */}
            <div className="text-xs text-gray-500 space-y-1">
              <p className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                Use a PIN you can remember easily
              </p>
              <p className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                Don't use sequential numbers (123456)
              </p>
              <p className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                Don't use same digit repeated (111111)
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-6 rounded-xl text-lg font-semibold"
              data-testid="reset-pin-submit"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Resetting PIN...
                </div>
              ) : (
                'Reset PIN'
              )}
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
