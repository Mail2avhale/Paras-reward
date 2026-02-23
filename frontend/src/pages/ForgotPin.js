import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, ArrowLeft, Phone, CheckCircle, Lock, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ForgotPin = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Mobile, 2: OTP, 3: New PIN
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [userName, setUserName] = useState('');
  const [maskedMobile, setMaskedMobile] = useState('');

  // Step 1: Check mobile and send OTP
  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!mobile || mobile.length < 10) {
      toast.error('Please enter valid mobile number');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API}/auth/forgot-pin/check-mobile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobile.trim() })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setOtpSent(true);
        setUserName(data.user_name || 'User');
        setMaskedMobile(data.masked_mobile || mobile);
        setStep(2);
        toast.success(`OTP sent to ${data.masked_mobile || mobile}`);
      } else {
        toast.error(data.detail || 'Mobile number not found');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast.error('Please enter 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API}/auth/forgot-pin/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobile.trim(), otp: otp.trim() })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setResetToken(data.reset_token);
        setStep(3);
        toast.success('OTP verified! Set your new PIN');
      } else {
        toast.error(data.detail || 'Invalid OTP');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset PIN
  const handleResetPin = async (e) => {
    e.preventDefault();
    
    if (!newPin || newPin.length !== 4) {
      toast.error('PIN must be 4 digits');
      return;
    }
    
    if (newPin !== confirmPin) {
      toast.error('PINs do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API}/auth/forgot-pin/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mobile: mobile.trim(), 
          reset_token: resetToken,
          new_pin: newPin 
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        toast.success('PIN reset successful! Please login with your new PIN');
        navigate('/login');
      } else {
        toast.error(data.detail || 'Failed to reset PIN');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to reset PIN');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/auth/forgot-pin/check-mobile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobile.trim() })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        toast.success('OTP resent successfully!');
        setOtp('');
      } else {
        toast.error(data.detail || 'Failed to resend OTP');
      }
    } catch (error) {
      toast.error('Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4">
      <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step >= s 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {step > s ? <CheckCircle className="w-5 h-5" /> : s}
              </div>
              {s < 3 && (
                <div className={`w-8 h-1 ${step > s ? 'bg-purple-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 bg-gradient-to-r from-purple-500 to-indigo-600">
            {step === 1 && <Phone className="h-8 w-8 text-white" />}
            {step === 2 && <Shield className="h-8 w-8 text-white" />}
            {step === 3 && <Lock className="h-8 w-8 text-white" />}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {step === 1 && 'Forgot PIN?'}
            {step === 2 && 'Verify OTP'}
            {step === 3 && 'Set New PIN'}
          </h1>
          <p className="text-gray-500 text-sm">
            {step === 1 && 'Enter your registered mobile number'}
            {step === 2 && `OTP sent to ${maskedMobile}`}
            {step === 3 && `Hello ${userName}! Set your new 4-digit PIN`}
          </p>
        </div>

        {/* Step 1: Mobile Number */}
        {step === 1 && (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Registered Mobile Number
              </label>
              <Input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="Enter 10-digit mobile number"
                className="w-full text-center text-lg tracking-wider"
                maxLength={10}
                data-testid="mobile-input"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || mobile.length < 10}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 py-6 text-lg"
              data-testid="send-otp-btn"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Phone className="w-5 h-5 mr-2" />
              )}
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </Button>
          </form>
        )}

        {/* Step 2: OTP Verification */}
        {step === 2 && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter 6-Digit OTP
              </label>
              <Input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="• • • • • •"
                className="w-full text-center text-2xl tracking-[0.5em] font-mono"
                maxLength={6}
                data-testid="otp-input"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 py-6 text-lg"
              data-testid="verify-otp-btn"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-5 h-5 mr-2" />
              )}
              {loading ? 'Verifying...' : 'Verify OTP'}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={loading}
                className="text-sm text-purple-600 hover:underline"
              >
                Didn't receive OTP? Resend
              </button>
            </div>

            <button
              type="button"
              onClick={() => { setStep(1); setOtp(''); }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Change Mobile Number
            </button>
          </form>
        )}

        {/* Step 3: Set New PIN */}
        {step === 3 && (
          <form onSubmit={handleResetPin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New PIN (4 digits)
              </label>
              <Input
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="• • • •"
                className="w-full text-center text-2xl tracking-[0.5em]"
                maxLength={4}
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
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="• • • •"
                className="w-full text-center text-2xl tracking-[0.5em]"
                maxLength={4}
                data-testid="confirm-pin-input"
              />
            </div>

            {newPin && confirmPin && newPin !== confirmPin && (
              <p className="text-red-500 text-sm text-center flex items-center justify-center gap-1">
                <AlertCircle className="w-4 h-4" /> PINs do not match
              </p>
            )}

            <Button
              type="submit"
              disabled={loading || newPin.length !== 4 || newPin !== confirmPin}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 py-6 text-lg"
              data-testid="reset-pin-btn"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Lock className="w-5 h-5 mr-2" />
              )}
              {loading ? 'Resetting...' : 'Reset PIN'}
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
