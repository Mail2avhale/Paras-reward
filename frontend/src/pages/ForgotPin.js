import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Phone, KeyRound, Shield, ArrowLeft, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import PinInput from '@/components/PinInput';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ForgotPin = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Mobile, 2: OTP, 3: New PIN
  const [loading, setLoading] = useState(false);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errors, setErrors] = useState({});
  const [resendTimer, setResendTimer] = useState(0);

  // Start resend timer
  const startResendTimer = () => {
    setResendTimer(30);
    const interval = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setErrors({});

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
        setMobile(cleanMobile);
        setStep(2);
        startResendTimer();
        toast.success('OTP sent to your mobile number');
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      toast.error(error.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    
    setLoading(true);
    try {
      await axios.post(`${API}/auth/forgot-pin/check-mobile`, {
        mobile: mobile
      });
      startResendTimer();
      toast.success('OTP resent successfully');
    } catch (error) {
      toast.error('Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    
    if (!otp || otp.length < 4) {
      setErrors({ otp: 'Enter valid OTP' });
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/forgot-pin/verify-otp`, {
        mobile: mobile,
        otp: otp
      });

      if (response.data.success) {
        setResetToken(response.data.reset_token);
        setStep(3);
        toast.success('OTP verified! Now set your new PIN');
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      toast.error(error.response?.data?.detail || 'Invalid OTP');
      setOtp('');
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

    if (!validatePin()) return;

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
          <form onSubmit={handleSendOTP} className="space-y-6">
            <div>
              <Label htmlFor="mobile" className="mb-2 block text-gray-700 font-medium">Mobile Number</Label>
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
                  Sending OTP...
                </div>
              ) : (
                'Send OTP'
              )}
            </Button>
          </form>
        )}

        {/* Step 2: OTP Verification */}
        {step === 2 && (
          <form onSubmit={handleVerifyOTP} className="space-y-6">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm text-blue-800">
                OTP sent to <strong>+91 {mobile.slice(0, 5)}*****</strong>
              </p>
            </div>

            {/* OTP Input */}
            <div>
              <Label htmlFor="otp" className="mb-2 block text-gray-700 font-medium">Enter OTP</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                placeholder="Enter 4-6 digit OTP"
                value={otp}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtp(val);
                  if (errors.otp) setErrors({});
                }}
                className={`text-center text-2xl tracking-widest py-6 rounded-xl ${errors.otp ? 'border-red-500' : ''}`}
                maxLength={6}
                data-testid="forgot-pin-otp"
              />
              {errors.otp && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.otp}
                </p>
              )}
            </div>

            {/* Resend OTP */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={resendTimer > 0 || loading}
                className={`text-sm font-medium flex items-center gap-2 mx-auto ${
                  resendTimer > 0 ? 'text-gray-400' : 'text-purple-600 hover:text-purple-700'
                }`}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
              </button>
            </div>

            <Button
              type="submit"
              disabled={loading || otp.length < 4}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-6 rounded-xl text-lg font-semibold"
              data-testid="verify-otp-submit"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verifying...
                </div>
              ) : (
                'Verify OTP'
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => { setStep(1); setOtp(''); }}
              className="w-full text-gray-600"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Change Mobile Number
            </Button>
          </form>
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
