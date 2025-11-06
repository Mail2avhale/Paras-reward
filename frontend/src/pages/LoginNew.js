import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Mail, LogIn, Eye, EyeOff, Fingerprint } from 'lucide-react';
import { isBiometricSupported, biometricLogin, isBiometricEnabled } from '@/utils/biometricAuth';
import BiometricSetup from '@/components/BiometricSetup';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LoginNew = ({ onLogin }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showBiometricOption, setShowBiometricOption] = useState(false);
  const [showBiometricSetupPrompt, setShowBiometricSetupPrompt] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [loginData, setLoginData] = useState({
    identifier: '', // email, mobile, or uid
    password: '',
    device_id: '',
    ip_address: ''
  });

  // Generate device ID
  useState(() => {
    const deviceId = localStorage.getItem('device_id') || `DEV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('device_id', deviceId);
    setLoginData(prev => ({ ...prev, device_id: deviceId }));
  }, []);

  // Get IP address (optional - can use a service)
  useState(async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      setLoginData(prev => ({ ...prev, ip_address: data.ip }));
    } catch (error) {
      console.log('Could not fetch IP');
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!loginData.identifier || !loginData.password) {
        toast.error('Please enter your email/mobile and password');
        setLoading(false);
        return;
      }

      const response = await axios.post(
        `${API}/auth/login`,
        null,
        {
          params: {
            identifier: loginData.identifier,
            password: loginData.password,
            device_id: loginData.device_id,
            ip_address: loginData.ip_address
          }
        }
      );

      // Check if user is banned
      if (response.data.is_banned) {
        toast.error('Your account has been suspended. Please contact support.');
        setLoading(false);
        return;
      }

      toast.success('Login successful!');
      
      // Check if biometric should be offered (first login or biometric not set up)
      const biometricSetupShown = localStorage.getItem('biometric_setup_shown');
      const biometricEnabled = localStorage.getItem('biometric_enabled');
      
      if (isBiometricSupported() && !biometricEnabled && !biometricSetupShown) {
        // Show biometric setup prompt
        setLoggedInUser(response.data);
        setShowBiometricSetupPrompt(true);
        setLoading(false);
        return;
      }
      
      onLogin(response.data);
      
      // Navigate based on role
      if (response.data.role === 'admin' || response.data.role === 'sub_admin') {
        navigate('/admin');
      } else if (response.data.role === 'master_stockist') {
        navigate('/master-stockist');
      } else if (response.data.role === 'sub_stockist') {
        navigate('/sub-stockist');
      } else if (response.data.role === 'outlet') {
        navigate('/outlet');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!loginData.identifier) {
      toast.error('Please enter your email first');
      return;
    }

    setBiometricLoading(true);
    try {
      const result = await biometricLogin(loginData.identifier);
      
      if (result.success) {
        toast.success('Biometric login successful!');
        onLogin(result.user);
        
        // Navigate based on role
        if (result.user.role === 'admin' || result.user.role === 'sub_admin') {
          navigate('/admin');
        } else if (result.user.role === 'master_stockist') {
          navigate('/master-stockist');
        } else if (result.user.role === 'sub_stockist') {
          navigate('/sub-stockist');
        } else if (result.user.role === 'outlet') {
          navigate('/outlet');
        } else {
          navigate('/dashboard');
        }
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('Biometric login failed');
    } finally {
      setBiometricLoading(false);
    }
  };

  // Check if biometric is available
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email/Mobile/UID</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                data-testid="login-identifier-input"
                type="text"
                placeholder="Email, Mobile or UID"
                value={loginData.identifier}
                onChange={(e) => setLoginData({ ...loginData, identifier: e.target.value })}
                required
                className="pl-10 py-6 rounded-xl border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <div className="relative">
              <Input
                data-testid="login-password-input"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                required
                className="pr-10 py-6 rounded-xl border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="text-right">
            <Link to="/forgot-password" className="text-sm text-purple-600 hover:text-purple-700 font-medium">
              Forgot Password?
            </Link>
          </div>

          {/* Biometric Login Button */}
          {showBiometricOption && loginData.identifier && (
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
                  Sign In with Biometric
                </>
              )}
            </Button>
          )}

          {showBiometricOption && loginData.identifier && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or use password</span>
              </div>
            </div>
          )}

          <Button
            data-testid="login-submit-btn"
            type="submit"
            disabled={loading || biometricLoading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Signing in...
              </div>
            ) : (
              'Sign In with Password'
            )}
          </Button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">New to PARAS REWARD?</span>
            </div>
          </div>

          <Link to="/register">
            <Button
              data-testid="goto-register-btn"
              type="button"
              className="w-full mt-4 bg-white border-2 border-purple-600 text-purple-600 hover:bg-purple-50 py-6 rounded-xl text-lg font-semibold transition-all"
            >
              Create New Account
            </Button>
          </Link>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          By signing in, you agree to our{' '}
          <Link to="/terms" className="text-purple-600 hover:underline">Terms & Conditions</Link>
          {' '}and{' '}
          <Link to="/privacy" className="text-purple-600 hover:underline">Privacy Policy</Link>
        </p>
      </Card>
    </div>
  );
};

export default LoginNew;