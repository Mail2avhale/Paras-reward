import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import AdminLayout from './components/AdminLayout';

// Admin Pages
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUser360';
import AdminKYC from './pages/AdminKYC';
import AdminOrders from './pages/AdminOrders';
import AdminMarketplace from './pages/AdminMarketplace';
import AdminAnalytics from './pages/AdminAnalytics';
import AdminSupport from './pages/AdminSupport';
import AdminSubscriptionManagement from './pages/AdminSubscriptionManagement';
import AdminBillPayments from './pages/AdminBillPayments';
import AdminGiftVouchers from './pages/AdminGiftVouchers';
import AdminAccountingDashboard from './pages/AdminAccountingDashboard';
import AdminProfitLoss from './pages/AdminProfitLoss';
import AdminCompanyWallets from './pages/AdminCompanyWallets';
import AdminPRCAnalytics from './pages/AdminPRCAnalytics';
import AdminFraudDashboard from './pages/AdminFraudDashboard';
import AdminFraudAlerts from './pages/AdminFraudAlerts';
import AdminSettings from './pages/AdminSettings';
import AdminSettingsHub from './pages/AdminSettingsHub';
import AdminDeliveryPartners from './pages/AdminDeliveryPartners';
import AdminUser360 from './pages/AdminUser360';
import AdminLuxuryClaims from './pages/AdminLuxuryClaims';
import AdminSecurityDashboard from './pages/AdminSecurityDashboard';
import AdminDataBackup from './pages/AdminDataBackup';
import AdminBurnDashboard from './pages/AdminBurnDashboard';
import AdminLiquidity from './pages/AdminLiquidity';
import AdminPRCLedger from './pages/AdminPRCLedger';
import AdminUserLedger from './pages/AdminUserLedger';
import AdminContactSubmissions from './pages/AdminContactSubmissions';

import './index.css';

const API = process.env.REACT_APP_BACKEND_URL;

// Admin Login Component
const AdminLogin = ({ onLogin }) => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [authType, setAuthType] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const checkAuthType = async () => {
    if (!email) {
      setError('Email आवश्यक आहे');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API}/api/auth/check-auth-type?email=${email}`);
      if (response.data.exists) {
        // Check if admin or manager
        const userRole = response.data.role;
        if (userRole !== 'admin' && userRole !== 'manager') {
          setError('फक्त Admin आणि Manager login करू शकतात');
          setLoading(false);
          return;
        }
        setAuthType(response.data.auth_type);
        setStep(2);
      } else {
        setError('User सापडला नाही');
      }
    } catch (err) {
      setError('Error checking user');
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const loginData = { email };
      if (authType === 'pin') {
        loginData.pin = pin;
      } else {
        loginData.password = password;
      }

      const response = await axios.post(`${API}/api/auth/login`, loginData);
      if (response.data.token) {
        // Verify admin/manager role
        if (response.data.user.role !== 'admin' && response.data.user.role !== 'manager') {
          setError('फक्त Admin आणि Manager login करू शकतात');
          setLoading(false);
          return;
        }
        localStorage.setItem('adminToken', response.data.token);
        localStorage.setItem('adminUser', JSON.stringify(response.data.user));
        onLogin(response.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-800">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <span className="text-3xl font-bold text-white">P</span>
            </div>
            <h1 className="text-2xl font-bold text-white">PARAS REWARD</h1>
            <p className="text-gray-400 mt-1">Admin Panel</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  placeholder="admin@example.com"
                />
              </div>
              <button
                onClick={checkAuthType}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Checking...' : 'Continue'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {authType === 'pin' ? '6-Digit PIN' : 'Password'}
                </label>
                {authType === 'pin' ? (
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-center text-2xl tracking-widest focus:outline-none focus:border-purple-500"
                    placeholder="••••••"
                    maxLength={6}
                  />
                ) : (
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-purple-500"
                    placeholder="Enter password"
                  />
                )}
              </div>
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
              <button
                onClick={() => { setStep(1); setError(''); }}
                className="w-full py-2 text-gray-400 hover:text-white text-sm"
              >
                ← Back to email
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-gray-600 text-sm mt-6">
          Admin access only. Users please visit main app.
        </p>
      </div>
    </div>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children, user }) => {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== 'admin' && user.role !== 'manager') {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const savedUser = localStorage.getItem('adminUser');
    const token = localStorage.getItem('adminToken');
    if (savedUser && token) {
      const parsedUser = JSON.parse(savedUser);
      if (parsedUser.role === 'admin' || parsedUser.role === 'manager') {
        setUser(parsedUser);
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Login Route */}
        <Route 
          path="/login" 
          element={
            user ? <Navigate to="/admin" replace /> : <AdminLogin onLogin={handleLogin} />
          } 
        />

        {/* Admin Routes */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute user={user}>
              <AdminLayout user={user} onLogout={handleLogout}>
                <Routes>
                  <Route path="/" element={<AdminDashboard />} />
                  <Route path="/users" element={<AdminUsers />} />
                  <Route path="/user-360" element={<AdminUser360 />} />
                  <Route path="/kyc" element={<AdminKYC />} />
                  <Route path="/orders" element={<AdminOrders />} />
                  <Route path="/marketplace" element={<AdminMarketplace />} />
                  <Route path="/delivery-partners" element={<AdminDeliveryPartners />} />
                  <Route path="/analytics" element={<AdminAnalytics />} />
                  <Route path="/support" element={<AdminSupport />} />
                  <Route path="/contact-submissions" element={<AdminContactSubmissions />} />
                  
                  {/* Subscriptions & Payments */}
                  <Route path="/subscriptions" element={<AdminSubscriptionManagement />} />
                  <Route path="/bill-payments" element={<AdminBillPayments />} />
                  <Route path="/gift-vouchers" element={<AdminGiftVouchers />} />
                  <Route path="/luxury-claims" element={<AdminLuxuryClaims />} />
                  
                  {/* Finance */}
                  <Route path="/accounting" element={<AdminAccountingDashboard />} />
                  <Route path="/company-wallets" element={<AdminCompanyWallets />} />
                  <Route path="/prc-analytics" element={<AdminPRCAnalytics />} />
                  <Route path="/prc-ledger" element={<AdminPRCLedger />} />
                  <Route path="/profit-loss" element={<AdminProfitLoss />} />
                  <Route path="/user-ledger" element={<AdminUserLedger />} />
                  <Route path="/liquidity" element={<AdminLiquidity />} />
                  
                  {/* Controls & Security */}
                  <Route path="/security" element={<AdminSecurityDashboard />} />
                  <Route path="/fraud-dashboard" element={<AdminFraudDashboard />} />
                  <Route path="/fraud-alerts" element={<AdminFraudAlerts />} />
                  <Route path="/burn-management" element={<AdminBurnDashboard />} />
                  <Route path="/data-backup" element={<AdminDataBackup />} />
                  
                  {/* Settings */}
                  <Route path="/settings" element={<AdminSettings />} />
                  <Route path="/settings-hub" element={<AdminSettingsHub />} />
                </Routes>
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="*" element={<Navigate to={user ? "/admin" : "/login"} replace />} />
      </Routes>
    </Router>
  );
}

export default App;
