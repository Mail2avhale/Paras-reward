import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from './components/ui/sonner';
import { Loader2 } from 'lucide-react';

// Admin Layout
import AdminLayout from './components/layouts/AdminLayout';

// Lazy load admin pages for better performance
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'));
const AdminBillPayments = lazy(() => import('./pages/AdminBillPayments'));
const AdminKYC = lazy(() => import('./pages/AdminKYC'));
const AdvancedUserManagement = lazy(() => import('./pages/AdvancedUserManagement'));
const AdminUser360 = lazy(() => import('./pages/AdminUser360'));
const AdminUserControls = lazy(() => import('./pages/AdminUserControls'));
const AdminUserLedger = lazy(() => import('./pages/AdminUserLedger'));
const AdminOrders = lazy(() => import('./pages/AdminOrders'));
const AdminMarketplace = lazy(() => import('./pages/AdminMarketplace'));
const AdminGiftVouchers = lazy(() => import('./pages/AdminGiftVouchers'));
const AdminLuxuryClaims = lazy(() => import('./pages/AdminLuxuryClaims'));
const AdminDeliveryPartners = lazy(() => import('./pages/AdminDeliveryPartners'));
const AdminSubscriptionManagement = lazy(() => import('./pages/AdminSubscriptionManagement'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const AdminSettingsHub = lazy(() => import('./pages/AdminSettingsHub'));
const AdminRedeemSettings = lazy(() => import('./pages/AdminRedeemSettings'));
const AdminPolicies = lazy(() => import('./pages/AdminPolicies'));
const AdminSupport = lazy(() => import('./pages/AdminSupport'));
const AdminContactSubmissions = lazy(() => import('./pages/AdminContactSubmissions'));
const AdminSecurityDashboard = lazy(() => import('./pages/AdminSecurityDashboard'));
const AdminFraudDashboard = lazy(() => import('./pages/AdminFraudDashboard'));
const AdminFraudAlerts = lazy(() => import('./pages/AdminFraudAlerts'));
const AdminDataBackup = lazy(() => import('./pages/AdminDataBackup'));
const AdminAuditService = lazy(() => import('./pages/AdminAuditService'));
const AdminPRCAnalytics = lazy(() => import('./pages/AdminPRCAnalytics'));
const AdminPRCLedger = lazy(() => import('./pages/AdminPRCLedger'));
const AdminPRCRain = lazy(() => import('./pages/AdminPRCRain'));
const AdminBurnDashboard = lazy(() => import('./pages/AdminBurnDashboard'));
const AdminCompanyWallets = lazy(() => import('./pages/AdminCompanyWallets'));
const AdminAdsIncome = lazy(() => import('./pages/AdminAdsIncome'));
const AdminVideoAds = lazy(() => import('./pages/AdminVideoAds'));
const AdminAccountingDashboard = lazy(() => import('./pages/AdminAccountingDashboard'));
const AdminCashBankBook = lazy(() => import('./pages/AdminCashBankBook'));
const AdminProfitLoss = lazy(() => import('./pages/AdminProfitLoss'));
const AdminFinancialReports = lazy(() => import('./pages/AdminFinancialReports'));
const AdminTrialBalance = lazy(() => import('./pages/AdminTrialBalance'));
const AdminAccountsReceivable = lazy(() => import('./pages/AdminAccountsReceivable'));
const AdminAccountsPayable = lazy(() => import('./pages/AdminAccountsPayable'));
const AdminFinancialRatios = lazy(() => import('./pages/AdminFinancialRatios'));
const AdminCapitalManagement = lazy(() => import('./pages/AdminCapitalManagement'));
const AdminLiquidity = lazy(() => import('./pages/AdminLiquidity'));
const AdminFixedExpenses = lazy(() => import('./pages/AdminFixedExpenses'));
const AdminServiceCharges = lazy(() => import('./pages/AdminServiceCharges'));
const PRCEmergencyControls = lazy(() => import('./pages/PRCEmergencyControls'));

// Login Page for Admin
const AdminLogin = lazy(() => import('./pages/AdminLogin'));

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

// Loading Spinner Component
const LoadingSpinner = () => (
  <div className="min-h-screen bg-gray-950 flex items-center justify-center">
    <div className="text-center">
      <Loader2 className="w-12 h-12 animate-spin text-amber-500 mx-auto mb-4" />
      <p className="text-gray-400">Loading Admin Panel...</p>
    </div>
  </div>
);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('admin_user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        // Verify user is admin or manager
        if (parsedUser.role === 'admin' || parsedUser.role === 'manager') {
          setUser(parsedUser);
        } else {
          localStorage.removeItem('admin_user');
        }
      } catch (e) {
        localStorage.removeItem('admin_user');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = async (identifier, password) => {
    try {
      const response = await axios.post(`${API_BASE}/api/auth/login`, null, {
        params: { identifier, password }
      });
      
      const userData = response.data;
      
      // Only allow admin and manager roles
      if (userData.role !== 'admin' && userData.role !== 'manager') {
        throw new Error('Access denied. Admin or Manager role required.');
      }
      
      setUser(userData);
      localStorage.setItem('admin_user', JSON.stringify(userData));
      return userData;
    } catch (error) {
      throw error;
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('admin_user');
  };

  // Check if user can access admin
  const canAccessAdmin = (user) => {
    return user && (user.role === 'admin' || user.role === 'manager');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-950 text-white">
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            {/* Login Route */}
            <Route 
              path="/login" 
              element={
                canAccessAdmin(user) 
                  ? <Navigate to="/dashboard" /> 
                  : <AdminLogin onLogin={handleLogin} />
              } 
            />

            {/* Redirect root to dashboard or login */}
            <Route 
              path="/" 
              element={
                canAccessAdmin(user) 
                  ? <Navigate to="/dashboard" /> 
                  : <Navigate to="/login" />
              } 
            />

            {/* Admin Dashboard Routes */}
            <Route path="/dashboard" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminDashboard user={user} onLogout={handleLogout} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/analytics" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminAnalytics user={user} onLogout={handleLogout} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/bill-payments" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminBillPayments user={user} onLogout={handleLogout} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/kyc" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminKYC user={user} /></AdminLayout> : <Navigate to="/login" />} />
            
            {/* User Management */}
            <Route path="/users" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdvancedUserManagement /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/user-360/:uid" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminUser360 user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/user-controls" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminUserControls user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/user-ledger" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminUserLedger user={user} /></AdminLayout> : <Navigate to="/login" />} />
            
            {/* Orders & Marketplace */}
            <Route path="/orders" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminOrders user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/marketplace" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminMarketplace user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/gift-vouchers" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminGiftVouchers user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/luxury-claims" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminLuxuryClaims user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/delivery-partners" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminDeliveryPartners user={user} /></AdminLayout> : <Navigate to="/login" />} />
            
            {/* Subscriptions */}
            <Route path="/subscriptions" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminSubscriptionManagement user={user} /></AdminLayout> : <Navigate to="/login" />} />
            
            {/* Settings */}
            <Route path="/settings" element={canAccessAdmin(user) ? <AdminSettingsHub user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/settings/payment" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminSettings user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/settings/redeem" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminRedeemSettings user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/policies" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminPolicies user={user} /></AdminLayout> : <Navigate to="/login" />} />
            
            {/* Support */}
            <Route path="/support" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminSupport user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/contact-submissions" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminContactSubmissions user={user} /></AdminLayout> : <Navigate to="/login" />} />
            
            {/* Security */}
            <Route path="/security" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminSecurityDashboard user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/fraud-dashboard" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminFraudDashboard user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/fraud-alerts" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminFraudAlerts user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/data-backup" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminDataBackup user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/audit" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminAuditService user={user} /></AdminLayout> : <Navigate to="/login" />} />
            
            {/* PRC Management */}
            <Route path="/prc-analytics" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminPRCAnalytics user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/prc-ledger" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminPRCLedger user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/prc-rain" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminPRCRain user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/burn-dashboard" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminBurnDashboard user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/prc-economy" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><PRCEmergencyControls user={user} /></AdminLayout> : <Navigate to="/login" />} />
            
            {/* Finance */}
            <Route path="/company-wallets" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminCompanyWallets user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/ads-income" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminAdsIncome user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/video-ads" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminVideoAds user={user} onLogout={handleLogout} /></AdminLayout> : <Navigate to="/login" />} />
            
            {/* Accounting */}
            <Route path="/accounting" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminAccountingDashboard user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/cash-bank-book" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminCashBankBook user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/profit-loss" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminProfitLoss user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/financial-reports" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminFinancialReports user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/trial-balance" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminTrialBalance user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/accounts-receivable" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminAccountsReceivable user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/accounts-payable" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminAccountsPayable user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/financial-ratios" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminFinancialRatios user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/capital" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminCapitalManagement user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/liquidity" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminLiquidity user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/fixed-expenses" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminFixedExpenses user={user} /></AdminLayout> : <Navigate to="/login" />} />
            <Route path="/service-charges" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminServiceCharges user={user} /></AdminLayout> : <Navigate to="/login" />} />

            {/* Catch all - redirect to dashboard or login */}
            <Route path="*" element={canAccessAdmin(user) ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
          </Routes>
        </Suspense>
        <Toaster richColors position="top-right" />
      </div>
    </Router>
  );
}

export default App;
