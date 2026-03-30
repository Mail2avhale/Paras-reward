import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, User, AlertCircle, CheckCircle, Gift, Phone, KeyRound, Loader2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import PinInput from '@/components/PinInput';
import SEO, { SEOConfigs } from '@/components/SEO';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RegisterSimple = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref') || '';
  
  const [formData, setFormData] = useState({
    full_name: '',
    mobile: '',
    email: '',
    pin: '',
    confirmPin: '',
    role: 'user',
    referral_code: refCode
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  // Referral lookup state
  const [referralLookup, setReferralLookup] = useState({
    loading: false,
    valid: false,
    referrerName: '',
    error: ''
  });

  // Debounced referral code lookup
  const lookupReferralCode = useCallback(async (code) => {
    if (!code || code.length < 3) {
      setReferralLookup({ loading: false, valid: false, referrerName: '', error: '' });
      return;
    }
    
    setReferralLookup(prev => ({ ...prev, loading: true, error: '' }));
    
    try {
      const response = await axios.get(`${API}/referral/lookup/${code.toUpperCase()}`);
      if (response.data.valid) {
        setReferralLookup({
          loading: false,
          valid: true,
          referrerName: response.data.referrer_name,
          error: ''
        });
      }
    } catch (error) {
      setReferralLookup({
        loading: false,
        valid: false,
        referrerName: '',
        error: error.response?.status === 404 ? 'Invalid referral code' : ''
      });
    }
  }, []);

  // Debounce effect for referral code lookup
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.referral_code) {
        lookupReferralCode(formData.referral_code);
      }
    }, 500); // 500ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [formData.referral_code, lookupReferralCode]);

  useEffect(() => {
    if (refCode) {
      setFormData(prev => ({ ...prev, referral_code: refCode }));
      // Lookup will be triggered automatically via the debounce effect
    }
  }, [refCode]);

  const validateForm = () => {
    const newErrors = {};

    // Full Name validation
    if (!formData.full_name || formData.full_name.trim().length < 2) {
      newErrors.full_name = 'Full name is required (min 2 characters)';
    }

    // Mobile validation
    if (!formData.mobile) {
      newErrors.mobile = 'Mobile number is required';
    } else if (!/^[6-9]\d{9}$/.test(formData.mobile)) {
      newErrors.mobile = 'Enter valid 10-digit mobile number';
    }

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    // PIN validation
    if (!formData.pin || formData.pin.length !== 6) {
      newErrors.pin = '6-digit PIN is required';
    } else if (!/^\d{6}$/.test(formData.pin)) {
      newErrors.pin = 'PIN must contain only numbers';
    } else if (/^(\d)\1{5}$/.test(formData.pin)) {
      newErrors.pin = 'PIN cannot be all same digits (e.g., 111111)';
    } else if (/^(012345|123456|234567|345678|456789|567890|987654|876543|765432|654321|543210)$/.test(formData.pin)) {
      newErrors.pin = 'PIN cannot be sequential numbers';
    }

    // Confirm PIN validation
    if (formData.pin !== formData.confirmPin) {
      newErrors.confirmPin = 'PINs do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/register/simple`, {
        full_name: formData.full_name.trim(),
        mobile: formData.mobile,
        email: formData.email,
        password: formData.pin, // Backend still uses 'password' field
        role: formData.role,
        referral_code: formData.referral_code || ''
      });

      if (formData.referral_code && response.data.referred_by) {
        toast.success(`Registration successful! Referred by ${response.data.referred_by}`, {
          icon: <Gift className="h-5 w-5" />
        });
      } else {
        toast.success('Registration successful! Please login to continue.');
      }
      
      // Navigate to login
      navigate('/login');
    } catch (error) {
      console.error('Registration error:', error);
      const detail = error.response?.data?.detail || '';
      const status = error.response?.status;
      
      // Map backend errors to specific field errors for clear user feedback
      const fieldErrors = {};
      
      if (detail.toLowerCase().includes('mobile number already registered')) {
        fieldErrors.mobile = 'This mobile number is already registered. Please login instead.';
      } else if (detail.toLowerCase().includes('mobile number must be')) {
        fieldErrors.mobile = 'Please enter a valid 10-digit mobile number.';
      } else if (detail.toLowerCase().includes('email already registered')) {
        fieldErrors.email = 'This email is already registered. Please login instead.';
      } else if (detail.toLowerCase().includes('invalid email')) {
        fieldErrors.email = 'Please enter a valid email address.';
      } else if (detail.toLowerCase().includes('pin must be')) {
        fieldErrors.pin = 'PIN must be exactly 6 digits.';
      } else if (detail.toLowerCase().includes('pin cannot be all same')) {
        fieldErrors.pin = 'PIN cannot be all same digits (e.g., 111111).';
      } else if (detail.toLowerCase().includes('full name')) {
        fieldErrors.full_name = 'Full name must be at least 2 characters.';
      } else if (detail.toLowerCase().includes('invalid referral')) {
        fieldErrors.referral_code = 'Invalid referral code. Please check and try again.';
      } else if (status === 403) {
        fieldErrors.general = detail || 'Registrations are currently closed. Please try again later.';
      }
      
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        // Show the most relevant error as toast
        const firstError = Object.values(fieldErrors)[0];
        toast.error(firstError);
      } else {
        toast.error(detail || 'Registration failed. Please check your details and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <>
      <SEO {...SEOConfigs.register} />
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h1>
          <p className="text-gray-600">Join PARAS Reward and start earning!</p>
        </div>

        {/* Info Banner */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <KeyRound className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Secure 6-Digit PIN</p>
              <p>Use a 6-digit PIN for quick and secure login</p>
            </div>
          </div>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* General Error Banner */}
          {errors.general && (
            <div data-testid="register-general-error" className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{errors.general}</p>
            </div>
          )}
          {/* Full Name */}
          <div>
            <Label htmlFor="full_name">Full Name *</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                id="full_name"
                type="text"
                placeholder="Enter your full name"
                value={formData.full_name}
                onChange={(e) => handleChange('full_name', e.target.value)}
                className={`pl-10 ${errors.full_name ? 'border-red-500' : ''}`}
                data-testid="register-full-name"
              />
            </div>
            {errors.full_name && (
              <div className="flex items-center gap-1 mt-1 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{errors.full_name}</span>
              </div>
            )}
          </div>

          {/* Mobile Number */}
          <div>
            <Label htmlFor="mobile">Mobile Number *</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                id="mobile"
                type="tel"
                inputMode="numeric"
                placeholder="10-digit mobile number"
                value={formData.mobile}
                onChange={(e) => handleChange('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                className={`pl-10 ${errors.mobile ? 'border-red-500' : ''}`}
                data-testid="register-mobile"
              />
            </div>
            {errors.mobile && (
              <div className="flex items-center gap-1 mt-1 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{errors.mobile}</span>
              </div>
            )}
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="email">Email Address *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={`pl-10 ${errors.email ? 'border-red-500' : ''}`}
                data-testid="register-email"
              />
            </div>
            {errors.email && (
              <div className="flex items-center gap-1 mt-1 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{errors.email}</span>
              </div>
            )}
          </div>

          {/* 6-Digit PIN */}
          <div className="pt-2">
            <PinInput
              value={formData.pin}
              onChange={(val) => handleChange('pin', val)}
              error={errors.pin}
              label="Create 6-Digit PIN *"
              testId="register-pin"
            />
          </div>

          {/* Confirm PIN */}
          <div>
            <PinInput
              value={formData.confirmPin}
              onChange={(val) => handleChange('confirmPin', val)}
              error={errors.confirmPin}
              label="Confirm 6-Digit PIN *"
              testId="register-confirm-pin"
            />
          </div>

          {/* Referral Code */}
          <div>
            <Label htmlFor="referral_code">Referral Code (Optional)</Label>
            <div className="relative">
              <Gift className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                id="referral_code"
                type="text"
                placeholder="Enter referral code"
                value={formData.referral_code}
                onChange={(e) => handleChange('referral_code', e.target.value.toUpperCase())}
                className={`pl-10 pr-10 ${referralLookup.valid ? 'border-green-500 bg-green-50' : referralLookup.error ? 'border-red-500' : ''}`}
                data-testid="register-referral"
              />
              {/* Loading/Valid/Invalid indicator */}
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {referralLookup.loading && (
                  <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                )}
                {!referralLookup.loading && referralLookup.valid && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
                {!referralLookup.loading && referralLookup.error && formData.referral_code && (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
              </div>
            </div>
            
            {/* Referrer Name Display */}
            {referralLookup.valid && referralLookup.referrerName && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2" data-testid="referrer-info">
                <UserCheck className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div className="text-sm">
                  <p className="text-green-800 font-medium">
                    Referred by: <span className="font-bold">{referralLookup.referrerName}</span>
                  </p>
                  <p className="text-green-600 text-xs">You'll get bonus PRC on signup!</p>
                </div>
              </div>
            )}
            
            {/* Invalid Code Error */}
            {referralLookup.error && formData.referral_code && (
              <div className="flex items-center gap-1 mt-1 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{referralLookup.error}</span>
              </div>
            )}
          </div>

          {/* Terms */}
          <div className="text-xs text-gray-500 text-center">
            By registering, you agree to our{' '}
            <Link to="/terms" className="text-purple-600 hover:underline">Terms & Conditions</Link>
            {' '}and{' '}
            <Link to="/privacy" className="text-purple-600 hover:underline">Privacy Policy</Link>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold"
            disabled={loading}
            data-testid="register-submit"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating Account...
              </div>
            ) : (
              'Create Account'
            )}
          </Button>
        </form>

        {/* Login Link */}
        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-purple-600 font-semibold hover:underline">
              Login
            </Link>
          </p>
        </div>
      </Card>
    </div>
    </>
  );
};

export default RegisterSimple;
