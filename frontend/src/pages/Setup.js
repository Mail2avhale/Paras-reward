import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, User, Mail, Phone, Lock } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Setup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  
  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    mobile: '',
    password: '',
    confirm_password: ''
  });

  useEffect(() => {
    checkAdminExists();
  }, []);

  const checkAdminExists = async () => {
    try {
      const response = await axios.get(`${API}/admin/check-admin-exists`);
      if (response.data.admin_exists) {
        // Admin already exists, redirect to login
        toast.info('Admin already exists. Please login.');
        navigate('/login');
      }
    } catch (error) {
      console.error('Error checking admin:', error);
    } finally {
      setChecking(false);
    }
  };

  const promoteUser = async () => {
    if (!email) {
      toast.error('Please enter email');
      return;
    }

    try {
      await axios.post(`${API}/admin/promote?email=${email}&role=${role}`);
      toast.success(`User promoted to ${role} successfully!`);
      setEmail('');
    } catch (error) {
      console.error('Error promoting user:', error);
      toast.error(error.response?.data?.detail || 'Failed to promote user');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <Card className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-2xl max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">User Role Setup</h1>
          <p className="text-gray-600">Promote users to Admin or Outlet roles</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">User Email</label>
            <Input
              data-testid="setup-email-input"
              type="email"
              placeholder="user@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="py-6 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Select Role</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                data-testid="role-admin-btn"
                onClick={() => setRole('admin')}
                className={`p-6 rounded-2xl border-2 transition-all ${
                  role === 'admin'
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <Shield className={`h-8 w-8 mx-auto mb-3 ${role === 'admin' ? 'text-purple-600' : 'text-gray-400'}`} />
                <p className={`font-semibold ${role === 'admin' ? 'text-purple-600' : 'text-gray-600'}`}>Admin</p>
                <p className="text-xs text-gray-500 mt-1">Full access to dashboard</p>
              </button>

              <button
                data-testid="role-outlet-btn"
                onClick={() => setRole('outlet')}
                className={`p-6 rounded-2xl border-2 transition-all ${
                  role === 'outlet'
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <Store className={`h-8 w-8 mx-auto mb-3 ${role === 'outlet' ? 'text-purple-600' : 'text-gray-400'}`} />
                <p className={`font-semibold ${role === 'outlet' ? 'text-purple-600' : 'text-gray-600'}`}>Outlet</p>
                <p className="text-xs text-gray-500 mt-1">Verify & deliver orders</p>
              </button>
            </div>
          </div>

          <Button
            data-testid="promote-btn"
            onClick={promoteUser}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 rounded-xl text-lg font-semibold shadow-lg transition-all"
          >
            Promote User to {role === 'admin' ? 'Admin' : 'Outlet'}
          </Button>

          <div className="mt-8 p-6 bg-blue-50 rounded-2xl">
            <h3 className="font-bold text-blue-900 mb-3">Quick Instructions:</h3>
            <ol className="text-sm text-blue-800 space-y-2">
              <li className="flex items-start">
                <span className="font-bold mr-2">1.</span>
                <span>First, create a user account by signing up normally</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2">2.</span>
                <span>Enter the user's email address above</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2">3.</span>
                <span>Select Admin or Outlet role</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2">4.</span>
                <span>Click "Promote User" button</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2">5.</span>
                <span>Log out and log back in to see the new dashboard</span>
              </li>
            </ol>
          </div>

          <div className="text-center">
            <a
              href="/"
              className="text-purple-600 hover:text-purple-700 font-medium text-sm"
            >
              ← Back to Home
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Setup;
