import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Mail, Key, ArrowLeft } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: request, 2: reset
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [resetData, setResetData] = useState({
    reset_token: '',
    new_password: '',
    confirm_password: ''
  });

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!email) {
        toast.error('Please enter your email');
        setLoading(false);
        return;
      }

      const response = await axios.post(`${API}/auth/forgot-password?email=${email}`);
      
      toast.success('Reset instructions sent! Check your email.');
      
      // For demo, show token (remove in production)
      if (response.data.reset_token) {
        toast.info(`Demo Token: ${response.data.reset_token}`);
        setResetData({ ...resetData, reset_token: response.data.reset_token });
      }
      
      setStep(2);
    } catch (error) {
      console.error('Reset request error:', error);
      toast.error('Failed to send reset instructions');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!resetData.reset_token || !resetData.new_password) {
        toast.error('Please fill all fields');
        setLoading(false);
        return;
      }

      if (resetData.new_password !== resetData.confirm_password) {
        toast.error('Passwords do not match');
        setLoading(false);
        return;
      }

      if (resetData.new_password.length < 6) {
        toast.error('Password must be at least 6 characters');
        setLoading(false);
        return;
      }

      await axios.post(
        `${API}/auth/reset-password`,
        null,
        {
          params: {
            reset_token: resetData.reset_token,
            new_password: resetData.new_password
          }
        }
      );
      
      toast.success('Password reset successful! Please login.');
      navigate('/login');
    } catch (error) {
      console.error('Reset error:', error);
      toast.error(error.response?.data?.detail || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4">
      <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl mb-4">
            <Key className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reset Password</h1>
          <p className="text-gray-600">
            {step === 1 ? 'Enter your email to receive reset instructions' : 'Create your new password'}
          </p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleRequestReset} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  data-testid="forgot-email-input"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 py-6 rounded-xl"
                />
              </div>
            </div>

            <Button
              data-testid="request-reset-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 rounded-xl text-lg font-semibold"
            >
              {loading ? 'Sending...' : 'Send Reset Instructions'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reset Token</label>
              <Input
                data-testid="reset-token-input"
                type="text"
                placeholder="Enter reset token from email"
                value={resetData.reset_token}
                onChange={(e) => setResetData({ ...resetData, reset_token: e.target.value })}
                required
                className="py-5 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
              <Input
                data-testid="new-password-input"
                type="password"
                placeholder="Minimum 6 characters"
                value={resetData.new_password}
                onChange={(e) => setResetData({ ...resetData, new_password: e.target.value })}
                required
                className="py-5 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
              <Input
                data-testid="confirm-password-input"
                type="password"
                placeholder="Re-enter password"
                value={resetData.confirm_password}
                onChange={(e) => setResetData({ ...resetData, confirm_password: e.target.value })}
                required
                className="py-5 rounded-xl"
              />
            </div>

            <Button
              data-testid="reset-password-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-6 rounded-xl text-lg font-semibold"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link to="/login" className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Login
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPassword;