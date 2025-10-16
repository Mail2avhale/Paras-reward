import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Mail, Lock, Chrome } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Login = ({ onLogin }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    name: ''
  });

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      // Simulate Google login
      if (!formData.email || !formData.name) {
        toast.error('Please fill in all fields');
        setLoading(false);
        return;
      }

      const response = await axios.post(`${API}/auth/login`, {
        email: formData.email,
        name: formData.name,
        google_id: 'mock_google_id',
        profile_picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=667eea&color=fff`
      });

      toast.success('Login successful!');
      onLogin(response.data);
      navigate('/dashboard');
    } catch (error) {
      console.error(error);
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl mb-4">
              <Chrome className="h-12 w-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
            <p className="text-gray-600">Sign in to continue mining</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  data-testid="email-input"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10 py-6 rounded-xl border-gray-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  data-testid="name-input"
                  type="text"
                  placeholder="Your Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="pl-10 py-6 rounded-xl border-gray-200"
                />
              </div>
            </div>

            <Button
              data-testid="login-btn"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {loading ? 'Signing in...' : 'Sign In with Google'}
            </Button>
          </div>

          <p className="text-center text-sm text-gray-600 mt-6">
            By signing in, you agree to our Terms & Conditions
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;