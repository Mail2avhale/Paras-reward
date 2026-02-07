import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Mail, LogIn, Fingerprint, ArrowRight, KeyRound, Phone } from 'lucide-react';
import { isBiometricSupported, biometricLogin, isBiometricEnabled } from '@/utils/biometricAuth';
import BiometricSetup from '@/components/BiometricSetup';
import AnimatedFeedback from '@/components/AnimatedFeedback';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// PIN Input Component for Login
const PinInput = ({ value, onChange, error }) => {
  const inputRefs = useRef([]);
  const [pins, setPins] = useState(['', '', '', '', '', '']);

  useEffect(() => {
    onChange(pins.join(''));
  }, [pins]);

  useEffect(() => {
    if (!value) {
      setPins(['', '', '', '', '', '']);
    }
  }, [value]);

  const handleChange = (index, val) => {
    if (val && !/^\d$/.test(val)) return;

    const newPins = [...pins];
    newPins[index] = val;
    setPins(newPins);

    if (val && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!pins[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newPins = [...pins];
    for (let i = 0; i < pastedData.length; i++) {
      newPins[i] = pastedData[i];
    }
    setPins(newPins);
    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">Enter 6-Digit PIN</label>
      <div className="flex gap-2 justify-center">
        {pins.map((pin, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="tel"
            inputMode="numeric"
            maxLength={1}
            value={pin}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className={`w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 transition-all
              ${error ? 'border-red-500 bg-red-50 animate-shake' : 'border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200'}
              ${pin ? 'bg-purple-50 border-purple-400' : 'bg-white'}
            `}
            data-testid={`login-pin-${index}`}
          />
        ))}
      </div>
      {error && (
        <p className="text-red-500 text-sm text-center mt-2">{error}</p>
      )}
    </div>
  );
};

const LoginNew = ({ onLogin }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showBiometricOption, setShowBiometricOption] = useState(false);
  const [showBiometricSetupPrompt, setShowBiometricSetupPrompt] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [animatedFeedback, setAnimatedFeedback] = useState(null);
  const [pinError, setPinError] = useState('');
  const [loginData, setLoginData] = useState({
    identifier: '',
    pin: '',
    device_id: '',
    ip_address: ''
  });

  // Generate device ID
  useEffect(() => {
    const deviceId = localStorage.getItem('device_id') || `DEV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('device_id', deviceId);
    setLoginData(prev => ({ ...prev, device_id: deviceId }));
  }, []);

  // Get IP address
  useEffect(() => {
    const fetchIP = async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        setLoginData(prev => ({ ...prev, ip_address: data.ip }));
      } catch (error) {
        console.log('Could not fetch IP');
      }
    };
    fetchIP();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setPinError('');
    setLoading(true);

    try {
      if (!loginData.identifier) {
        toast.error('Please enter your email or mobile number');
        setLoading(false);
        return;
      }

      if (!loginData.pin || loginData.pin.length !== 6) {
        setPinError('Please enter your 6-digit PIN');
        setLoading(false);
        return;
      }

      const response = await axios.post(
        `${API}/auth/login`,
        null,
        {
          params: {
            identifier: loginData.identifier,
            password: loginData.pin,
            device_id: loginData.device_id,
            ip_address: loginData.ip_address
          }
        }
      );

      if (response.data.is_banned) {
        toast.error('Your account has been suspended. Please contact support.');
        setLoading(false);
        return;
      }

      // Check if user needs to set new PIN (migration)
      if (response.data.needs_pin_migration) {
        setLoggedInUser(response.data);
        toast.info('Please set a new 6-digit PIN for enhanced security');
        navigate('/set-new-pin', { state: { user: response.data } });
        return;
      }

      setAnimatedFeedback({
        message: `✅ Welcome Back!\n🎉 Login Successful!`,
        type: 'success',
        duration: 2000
      });
      
      onLogin(response.data);
      
      if (response.data.role === 'admin' || response.data.role === 'sub_admin') {
        setTimeout(() => navigate('/admin/dashboard'), 1500);
      } else if (response.data.role === 'outlet') {
        setTimeout(() => navigate('/outlet/dashboard'), 1500);
      } else if (response.data.role === 'delivery') {
        setTimeout(() => navigate('/delivery/dashboard'), 1500);
      } else {
        setTimeout(() => navigate('/dashboard'), 1500);
      }

      // Check for biometric setup
      if (isBiometricSupported() && !isBiometricEnabled()) {
        setTimeout(() => setShowBiometricSetupPrompt(true), 2000);
      }

    } catch (error) {
      console.error('Login error:', error);
      const errorMsg = error.response?.data?.detail || 'Login failed. Please try again.';
      
      if (errorMsg.includes('Invalid') || errorMsg.includes('password') || errorMsg.includes('PIN')) {
        setPinError('Invalid PIN. Please try again.');
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!loginData.identifier) {
      toast.error('Please enter your email/mobile first');
      return;
    }

    setBiometricLoading(true);
    try {
      const result = await biometricLogin(loginData.identifier);
      if (result.success) {
        setLoginData({ ...loginData, pin: result.pin });
        document.querySelector('form')?.dispatchEvent(
          new Event('submit', { cancelable: true, bubbles: true })
        );
      } else {
        toast.error(result.error || 'Biometric authentication failed');
      }
    } catch (error) {
      toast.error('Biometric authentication failed');
    } finally {
      setBiometricLoading(false);
    }
  };

  useEffect(() => {
    if (isBiometricSupported() && isBiometricEnabled()) {
      setShowBiometricOption(true);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4">
      <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl mb-4">
            <LogIn className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Sign in to your PARAS REWARD account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {/* Email/Mobile Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email / Mobile Number / UID
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                data-testid="login-identifier-input"
                type="text"
                placeholder="Enter email, mobile or UID"
                value={loginData.identifier}
                onChange={(e) => {
                  setLoginData({ ...loginData, identifier: e.target.value });
                  setPinError('');
                }}
                required
                className="pl-10 py-6 rounded-xl border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              />
            </div>
          </div>

          {/* PIN Input */}
          <div className="pt-2">
            <PinInput
              value={loginData.pin}
              onChange={(val) => {
                setLoginData({ ...loginData, pin: val });
                setPinError('');
              }}
              error={pinError}
            />
          </div>

          {/* Forgot PIN */}
          <div className="text-right">
            <Link to="/forgot-password" className="text-sm text-purple-600 hover:text-purple-700 font-medium">
              Forgot PIN?
            </Link>
          </div>

          {/* Biometric Login */}
          {showBiometricOption && loginData.identifier && (
            <>
              <Button
                type="button"
                onClick={handleBiometricLogin}
                disabled={biometricLoading || loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-6 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
              >
                {biometricLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Authenticating...
                  </div>
                ) : (
                  <>
                    <Fingerprint className="h-6 w-6" />
                    Login with Biometric
                  </>
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or use PIN</span>
                </div>
              </div>
            </>
          )}

          {/* Login Button */}
          <Button
            data-testid="login-submit-btn"
            type="submit"
            disabled={loading || biometricLoading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Signing in...
              </div>
            ) : (
              <>
                Sign In
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </Button>
        </form>

        {/* Register Link */}
        <div className="mt-6 text-center border-t border-gray-200 pt-6">
          <p className="text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-purple-600 font-semibold hover:underline">
              Sign Up
            </Link>
          </p>
        </div>

        {/* Terms */}
        <p className="text-xs text-center text-gray-500 mt-4">
          By signing in, you agree to our{' '}
          <Link to="/terms" className="text-purple-600 hover:underline">Terms & Conditions</Link>
          {' '}and{' '}
          <Link to="/privacy" className="text-purple-600 hover:underline">Privacy Policy</Link>
        </p>
      </Card>

      {/* Animated Feedback */}
      {animatedFeedback && (
        <AnimatedFeedback
          {...animatedFeedback}
          onComplete={() => setAnimatedFeedback(null)}
        />
      )}

      {/* Biometric Setup Prompt */}
      {showBiometricSetupPrompt && loggedInUser && (
        <BiometricSetup
          userId={loggedInUser.uid}
          onComplete={() => setShowBiometricSetupPrompt(false)}
          onSkip={() => setShowBiometricSetupPrompt(false)}
        />
      )}
    </div>
  );
};

export default LoginNew;
