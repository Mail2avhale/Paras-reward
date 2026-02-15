import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { KeyRound, Shield, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import PinInput from '@/components/PinInput';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SetNewPin = ({ onLogin }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = location.state?.user;
  
  const [loading, setLoading] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    // If no user data, redirect to login
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validatePin()) {
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API}/api/auth/set-new-pin`, {
        user_id: user.uid,
        new_pin: newPin
      });

      toast.success('PIN set successfully! Please login with your new PIN.');
      navigate('/login');
    } catch (error) {
      console.error('Error setting PIN:', error);
      toast.error(error.response?.data?.detail || 'Failed to set PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4">
      <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl mb-4">
            <KeyRound className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Set Your New PIN</h1>
          <p className="text-gray-600">For enhanced security, please create a 6-digit PIN</p>
        </div>

        {/* Info Banner */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Security Upgrade</p>
              <p>We've upgraded to a secure 6-digit PIN system for faster and safer login.</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
          <p className="text-sm text-gray-600">Setting PIN for:</p>
          <p className="font-semibold text-gray-900">{user.email || user.mobile}</p>
        </div>

        {/* PIN Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
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

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-6 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Setting PIN...
              </div>
            ) : (
              <>
                Set PIN & Continue
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default SetNewPin;
