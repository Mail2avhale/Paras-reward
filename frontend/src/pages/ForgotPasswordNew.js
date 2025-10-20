import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Mail, Key, ArrowLeft, Shield, CheckCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ForgotPasswordNew = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: email, 2: select fields, 3: verify, 4: reset password
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [selectedFields, setSelectedFields] = useState([]);
  const [verificationData, setVerificationData] = useState({});
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verifiedUser, setVerifiedUser] = useState(null);

  const availableFields = [
    { id: 'pan_number', label: 'PAN Number', placeholder: 'ABCDE1234F' },
    { id: 'aadhaar_number', label: 'Aadhaar Number', placeholder: '1234 5678 9012' },
    { id: 'mobile', label: 'Mobile Number', placeholder: '9876543210' },
    { id: 'name', label: 'Full Name', placeholder: 'John Doe' }
  ];

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email');
      return;
    }
    setStep(2);
  };

  const handleFieldSelection = (fieldId) => {
    if (selectedFields.includes(fieldId)) {
      setSelectedFields(selectedFields.filter(f => f !== fieldId));
    } else {
      if (selectedFields.length < 2) {
        setSelectedFields([...selectedFields, fieldId]);
      } else {
        toast.error('You can only select 2 verification fields');
      }
    }
  };

  const handleFieldsSelected = () => {
    if (selectedFields.length !== 2) {
      toast.error('Please select exactly 2 verification fields');
      return;
    }
    setStep(3);
  };

  const handleVerification = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if all selected fields have values
      for (const field of selectedFields) {
        if (!verificationData[field]) {
          toast.error(`Please enter ${availableFields.find(f => f.id === field)?.label}`);
          setLoading(false);
          return;
        }
      }

      const response = await axios.post(`${API}/auth/password-recovery/verify`, {
        email: email,
        verification_fields: verificationData
      });

      toast.success('Verification successful!');
      setVerifiedUser(response.data);
      setStep(4);
    } catch (error) {
      console.error('Verification error:', error);
      toast.error(error.response?.data?.detail || 'Verification failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (newPassword.length < 6) {
        toast.error('Password must be at least 6 characters');
        setLoading(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        toast.error('Passwords do not match');
        setLoading(false);
        return;
      }

      await axios.post(`${API}/auth/password-recovery/reset`, {
        email: email,
        verification_fields: verificationData,
        new_password: newPassword
      });

      toast.success('Password reset successful! Please login with your new password.');
      setTimeout(() => navigate('/login'), 2000);
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
            {step === 4 ? <CheckCircle className="h-10 w-10 text-white" /> : 
             step === 3 ? <Shield className="h-10 w-10 text-white" /> : 
             <Key className="h-10 w-10 text-white" />}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reset Password</h1>
          <p className="text-gray-600">
            {step === 1 && 'Enter your email to begin'}
            {step === 2 && 'Select 2 fields to verify your identity'}
            {step === 3 && 'Enter your verification details'}
            {step === 4 && 'Create your new password'}
          </p>
          <div className="flex justify-center items-center gap-2 mt-4">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-2 w-8 rounded-full ${
                  s === step ? 'bg-purple-600' : s < step ? 'bg-green-500' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Enter Email */}
        {step === 1 && (
          <form onSubmit={handleEmailSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
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
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 rounded-xl text-lg font-semibold"
            >
              Continue
            </Button>
          </form>
        )}

        {/* Step 2: Select 2 Verification Fields */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                <strong>Select exactly 2 fields</strong> that you remember to verify your identity
              </p>
            </div>

            <div className="space-y-3">
              {availableFields.map((field) => (
                <button
                  key={field.id}
                  type="button"
                  onClick={() => handleFieldSelection(field.id)}
                  className={`w-full p-4 rounded-xl border-2 transition-all ${
                    selectedFields.includes(field.id)
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-300 hover:border-gray-400 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{field.label}</span>
                    {selectedFields.includes(field.id) && (
                      <CheckCircle className="h-5 w-5 text-purple-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                className="flex-1 py-6 rounded-xl"
              >
                Back
              </Button>
              <Button
                onClick={handleFieldsSelected}
                disabled={selectedFields.length !== 2}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 rounded-xl"
              >
                Continue ({selectedFields.length}/2)
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Enter Verification Data */}
        {step === 3 && (
          <form onSubmit={handleVerification} className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800">
                Enter the exact values for the selected fields to verify your identity
              </p>
            </div>

            {selectedFields.map((fieldId) => {
              const field = availableFields.find(f => f.id === fieldId);
              return (
                <div key={fieldId}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {field.label}
                  </label>
                  <Input
                    type="text"
                    placeholder={field.placeholder}
                    value={verificationData[fieldId] || ''}
                    onChange={(e) => setVerificationData({
                      ...verificationData,
                      [fieldId]: e.target.value
                    })}
                    required
                    className="py-5 rounded-xl"
                  />
                </div>
              );
            })}

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => setStep(2)}
                variant="outline"
                className="flex-1 py-6 rounded-xl"
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 rounded-xl"
              >
                {loading ? 'Verifying...' : 'Verify Identity'}
              </Button>
            </div>
          </form>
        )}

        {/* Step 4: Reset Password */}
        {step === 4 && verifiedUser && (
          <form onSubmit={handlePasswordReset} className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-green-800">
                <strong>Verification successful!</strong> Welcome, {verifiedUser.name}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
              <Input
                type="password"
                placeholder="Minimum 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="py-5 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
              <Input
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="py-5 rounded-xl"
              />
            </div>

            <Button
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

export default ForgotPasswordNew;
