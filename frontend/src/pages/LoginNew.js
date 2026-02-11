import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Mail, LogIn, Fingerprint, ArrowRight, KeyRound, Eye, EyeOff, Lock } from 'lucide-react';
import { isBiometricSupported, biometricLogin, isBiometricEnabled } from '@/utils/biometricAuth';
import BiometricSetup from '@/components/BiometricSetup';
import AnimatedFeedback from '@/components/AnimatedFeedback';
import PinInput from '@/components/PinInput';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LoginNew = ({ onLogin }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingAuthType, setCheckingAuthType] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showBiometricOption, setShowBiometricOption] = useState(false);
  const [showBiometricSetupPrompt, setShowBiometricSetupPrompt] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [animatedFeedback, setAnimatedFeedback] = useState(null);
  const [pinError, setPinError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  // Forgot PIN states
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [forgotPinStep, setForgotPinStep] = useState(1); // 1: Enter email, 2: Enter OTP, 3: Set new PIN
  const [forgotPinEmail, setForgotPinEmail] = useState('');
  const [forgotPinOtp, setForgotPinOtp] = useState('');
  const [forgotPinResetToken, setForgotPinResetToken] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [forgotPinLoading, setForgotPinLoading] = useState(false);
  
  // Auth type: 'unknown', 'pin', 'password'
  const [authType, setAuthType] = useState('unknown');
  const [identifierChecked, setIdentifierChecked] = useState(false);
  
  const [loginData, setLoginData] = useState({
    identifier: '',
    pin: '',
    password: '',
    device_id: '',
    ip_address: ''
  });

  // Load saved login ID on mount
  useEffect(() => {
    const savedIdentifier = localStorage.getItem('saved_login_id');
    const savedRememberMe = localStorage.getItem('remember_me') === 'true';
    if (savedIdentifier && savedRememberMe) {
      setLoginData(prev => ({ ...prev, identifier: savedIdentifier }));
      setRememberMe(true);
    }
  }, []);

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

  // Check auth type when identifier changes (with debounce)
  useEffect(() => {
    const checkAuthType = async () => {
      if (!loginData.identifier || loginData.identifier.length < 3) {
        setAuthType('unknown');
        setIdentifierChecked(false);
        return;
      }

      setCheckingAuthType(true);
      try {
        const response = await axios.get(`${API}/auth/check-auth-type`, {
          params: { identifier: loginData.identifier }
        });
        
        setAuthType(response.data.auth_type);
        setIdentifierChecked(true);
        
        // Clear previous credential when switching
        setLoginData(prev => ({ ...prev, pin: '', password: '' }));
        setPinError('');
      } catch (error) {
        console.error('Error checking auth type:', error);
        setAuthType('pin'); // Default to PIN for new users
        setIdentifierChecked(true);
      } finally {
        setCheckingAuthType(false);
      }
    };

    const debounceTimer = setTimeout(checkAuthType, 500);
    return () => clearTimeout(debounceTimer);
  }, [loginData.identifier]);

  // Auto-login when 6-digit PIN is complete
  useEffect(() => {
    if (authType === 'pin' && loginData.pin.length === 6 && loginData.identifier && !loading) {
      // Small delay to show the last digit before submitting
      const autoLoginTimer = setTimeout(() => {
        handleLoginSubmit();
      }, 300);
      return () => clearTimeout(autoLoginTimer);
    }
  }, [loginData.pin, authType, loginData.identifier, loading]);

  const handleLoginSubmit = async () => {
    setPinError('');
    setLoading(true);

    try {
      if (!loginData.identifier) {
        toast.error('Please enter your email or mobile number');
        setLoading(false);
        return;
      }

      // Validate based on auth type
      const credential = authType === 'password' ? loginData.password : loginData.pin;
      
      if (authType === 'pin' && (!loginData.pin || loginData.pin.length !== 6)) {
        setPinError('Please enter your 6-digit PIN');
        setLoading(false);
        return;
      }
      
      if (authType === 'password' && !loginData.password) {
        toast.error('Please enter your password');
        setLoading(false);
        return;
      }

      const response = await axios.post(
        `${API}/auth/login`,
        null,
        {
          params: {
            identifier: loginData.identifier,
            password: credential,
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

      // Check if user needs to set new PIN (migration from password)
      if (response.data.needs_pin_migration) {
        toast.info('Please set a new 6-digit PIN for enhanced security', {
          duration: 4000,
          icon: <KeyRound className="h-5 w-5" />
        });
        navigate('/set-new-pin', { state: { user: response.data } });
        return;
      }

      setAnimatedFeedback({
        message: `✅ Welcome Back!\n🎉 Login Successful!`,
        type: 'success',
        duration: 2000
      });
      
      // Save login ID if Remember Me is checked
      if (rememberMe) {
        localStorage.setItem('saved_login_id', loginData.identifier);
        localStorage.setItem('remember_me', 'true');
      } else {
        localStorage.removeItem('saved_login_id');
        localStorage.removeItem('remember_me');
      }
      
      onLogin(response.data);
      
      if (response.data.role === 'admin' || response.data.role === 'sub_admin') {
        setTimeout(() => navigate('/admin'), 1500);
      } else if (response.data.role === 'outlet') {
        setTimeout(() => navigate('/outlet/dashboard'), 1500);
      } else if (response.data.role === 'delivery') {
        setTimeout(() => navigate('/delivery/dashboard'), 1500);
      } else {
        setTimeout(() => navigate('/dashboard'), 1500);
      }

      // Check for biometric setup
      if (isBiometricSupported() && !isBiometricEnabled()) {
        setTimeout(() => {
          setLoggedInUser(response.data);
          setShowBiometricSetupPrompt(true);
        }, 2000);
      }

    } catch (error) {
      console.error('Login error:', error);
      const errorMsg = error.response?.data?.detail || 'Login failed. Please try again.';
      
      if (errorMsg.includes('Invalid') || errorMsg.includes('password') || errorMsg.includes('PIN')) {
        if (authType === 'pin') {
          setPinError(errorMsg);
          // Clear PIN on error so user can re-enter
          setLoginData(prev => ({ ...prev, pin: '' }));
        } else {
          toast.error(errorMsg);
        }
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    handleLoginSubmit();
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
              {checkingAuthType && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>

          {/* Auth Type Badge */}
          {identifierChecked && authType !== 'unknown' && (
            <div className="flex justify-center">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                authType === 'pin' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {authType === 'pin' ? '🔢 Login with 6-Digit PIN' : '🔑 Login with Password'}
              </span>
            </div>
          )}

          {/* PIN Input (for migrated users / new users) */}
          {authType === 'pin' && identifierChecked && (
            <div className="pt-2">
              <PinInput
                value={loginData.pin}
                onChange={(val) => {
                  setLoginData({ ...loginData, pin: val });
                  setPinError('');
                }}
                error={pinError}
                label="Enter 6-Digit PIN"
                testId="login-pin"
              />
            </div>
          )}

          {/* Password Input (for old users who haven't migrated) */}
          {authType === 'password' && identifierChecked && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  data-testid="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  className="pl-10 pr-10 py-6 rounded-xl border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-amber-600 mt-2 text-center">
                After login, you'll be asked to set a new 6-digit PIN
              </p>
            </div>
          )}

          {/* Remember Me & Forgot PIN/Password Row */}
          <div className="flex items-center justify-between">
            {/* Remember Me Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-600">Remember ID</span>
            </label>
            
            {/* Forgot PIN/Password */}
            {identifierChecked && authType !== 'unknown' && (
              <Link to={authType === 'pin' ? '/forgot-pin' : '/forgot-password'} className="text-sm text-purple-600 hover:text-purple-700 font-medium">
                {authType === 'pin' ? 'Forgot PIN?' : 'Forgot Password?'}
              </Link>
            )}
          </div>

          {/* Biometric Login */}
          {showBiometricOption && loginData.identifier && authType === 'pin' && (
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
            disabled={loading || biometricLoading || checkingAuthType || (!identifierChecked && loginData.identifier.length > 2)}
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
