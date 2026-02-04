import { useEffect, useState, lazy, Suspense } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { NotificationProvider, useNotification } from "@/context/NotificationContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ToastContainer from "@/components/ToastContainer";
import OfflineIndicator from "@/components/OfflineIndicator";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import AIContextualHelp from "@/components/AIContextualHelp";

// ============================================
// 📱 LIGHTWEIGHT USER APP - ADMIN ROUTES REMOVED
// Admin/Manager access via: admin.parasreward.com
// ============================================

// Loading component - optimized with skeleton
const LoadingFallback = () => (
  <div className="min-h-screen bg-gray-950 flex items-center justify-center">
    <div className="text-center">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-amber-500/30 rounded-full"></div>
        <div className="absolute top-0 left-0 w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <p className="mt-4 text-gray-400 text-sm font-medium animate-pulse">Loading...</p>
    </div>
  </div>
);

// ============================================
// USER PAGES ONLY - Lazy loaded for performance
// ============================================
const HowItWorks = lazy(() => import("@/pages/HowItWorks"));
const FAQ = lazy(() => import("@/pages/FAQ"));
const Blog = lazy(() => import("@/pages/Blog"));
const BlogArticle = lazy(() => import("@/pages/BlogArticle"));
const Login = lazy(() => import("@/pages/LoginNew"));
const RegisterSimple = lazy(() => import("@/pages/RegisterSimple"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPasswordNew"));
const SupportTickets = lazy(() => import("@/pages/SupportTickets"));

// CRITICAL PAGES - Preload after initial render for faster navigation
const DashboardModern = lazy(() => import("@/pages/DashboardModern"));
const DailyRewards = lazy(() => import("@/pages/Mining"));

// Preload critical pages after initial render
const preloadCriticalPages = () => {
  setTimeout(() => {
    import("@/pages/DashboardModern");
    import("@/pages/Mining");
  }, 2000);
};

if (typeof window !== 'undefined') {
  preloadCriticalPages();
}

const TapGame = lazy(() => import("@/pages/TapGame"));
const Referrals = lazy(() => import("@/pages/ReferralsEnhanced"));
const Marketplace = lazy(() => import("@/pages/MarketplaceNew"));
const Orders = lazy(() => import("@/pages/Orders"));
const SubscriptionPlans = lazy(() => import("@/pages/SubscriptionPlans"));
const ReferralEarningsHistory = lazy(() => import("@/pages/ReferralEarningsHistory"));
const ProfileAdvanced = lazy(() => import("@/pages/ProfileAdvanced"));
const FlashSalesPage = lazy(() => import("@/pages/FlashSalesPage"));
const MyActivity = lazy(() => import("@/pages/MyActivity"));

// Social Feature Pages
const PublicProfile = lazy(() => import("@/pages/PublicProfile"));
const NetworkFeed = lazy(() => import("@/pages/NetworkFeed"));
const Messages = lazy(() => import("@/pages/Messages"));
const FollowersList = lazy(() => import("@/pages/FollowersList"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const ParasLuxuryLife = lazy(() => import("@/pages/ParasLuxuryLife"));

// Bill Payments & Services
const BillPayments = lazy(() => import("@/pages/BillPayments"));
const GiftVoucherRedemption = lazy(() => import("@/pages/GiftVoucherRedemption"));
const KYCVerification = lazy(() => import("@/pages/KYCVerification"));

// Static Pages
const Setup = lazy(() => import("@/pages/Setup"));
const AboutUs = lazy(() => import("@/pages/AboutUs"));
const Disclaimer = lazy(() => import("@/pages/Disclaimer"));
const ContactUs = lazy(() => import("@/pages/ContactUs"));
const TermsConditions = lazy(() => import("@/pages/TermsConditions"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("@/pages/RefundPolicy"));
const RewardsHome = lazy(() => import("@/pages/RewardsHome"));

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Admin Access Redirect Component
const AdminRedirect = () => {
  useEffect(() => {
    // Redirect admin/manager to separate admin portal
    toast.info('Admin panel is at admin.parasreward.com', { duration: 5000 });
  }, []);
  return <Navigate to="/dashboard" replace />;
};

function AppContent({ user, handleLogin, handleLogout }) {
  const { toasts, removeToast } = useNotification();

  // Regular users go to dashboard, admin/manager redirected to separate portal
  const getDefaultRoute = (user) => {
    if (!user) return "/";
    if (user.role === 'admin' || user.role === 'manager' || user.role === 'sub_admin') {
      return "/admin-redirect";
    }
    return "/dashboard";
  };

  return (
    <>
      <OfflineIndicator />
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={user ? <Navigate to={getDefaultRoute(user)} /> : <RewardsHome />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogArticle />} />
            <Route path="/login" element={user ? <Navigate to={getDefaultRoute(user)} /> : <Login onLogin={handleLogin} />} />
            <Route path="/register" element={user ? <Navigate to={getDefaultRoute(user)} /> : <RegisterSimple />} />
            <Route path="/forgot-password" element={user ? <Navigate to={getDefaultRoute(user)} /> : <ForgotPassword />} />
            <Route path="/setup" element={<Setup />} />
            
            {/* Static Pages */}
            <Route path="/about" element={<AboutUs />} />
            <Route path="/disclaimer" element={<Disclaimer />} />
            <Route path="/terms" element={<TermsConditions />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/refund" element={<RefundPolicy />} />
            <Route path="/rewards-home" element={<RewardsHome />} />
            
            {/* Protected User Routes */}
            <Route path="/dashboard" element={user ? <DashboardModern user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/support" element={user ? <SupportTickets user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/daily-rewards" element={user ? <DailyRewards user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/mining" element={<Navigate to="/daily-rewards" />} />
            <Route path="/game" element={user ? <TapGame user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/referrals" element={user ? <Referrals user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/referrals/dashboard" element={<Navigate to="/referrals" replace />} />
            <Route path="/referrals/ai" element={<Navigate to="/referrals" replace />} />
            <Route path="/network" element={<Navigate to="/referrals" replace />} />
            <Route path="/marketplace" element={user ? <Marketplace user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/flash-sales" element={user ? <FlashSalesPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/orders" element={user ? <Orders user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/activity" element={user ? <MyActivity user={user} /> : <Navigate to="/login" />} />
            <Route path="/vip" element={<Navigate to="/subscription" replace />} />
            <Route path="/subscription" element={user ? <SubscriptionPlans user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/kyc" element={user ? <KYCVerification user={user} /> : <Navigate to="/login" />} />
            <Route path="/referral-earnings" element={user ? <ReferralEarningsHistory user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/profile" element={user ? <ProfileAdvanced user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/profile-advanced" element={<Navigate to="/profile" replace />} />
            
            {/* Social Feature Routes */}
            <Route path="/profile/:uid" element={<PublicProfile user={user} />} />
            <Route path="/network-feed" element={user ? <NetworkFeed user={user} /> : <Navigate to="/login" />} />
            <Route path="/messages" element={user ? <Messages user={user} /> : <Navigate to="/login" />} />
            <Route path="/messages/:recipientUid" element={user ? <Messages user={user} /> : <Navigate to="/login" />} />
            <Route path="/followers/:uid" element={<FollowersList user={user} type="followers" />} />
            <Route path="/following/:uid" element={<FollowersList user={user} type="following" />} />
            <Route path="/notifications" element={user ? <Notifications user={user} /> : <Navigate to="/login" />} />
            <Route path="/luxury-life" element={user ? <ParasLuxuryLife user={user} /> : <Navigate to="/login" />} />
            
            {/* Bill Payments & Services */}
            <Route path="/bill-payments" element={user ? <BillPayments user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/gift-vouchers" element={user ? <GiftVoucherRedemption user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            
            {/* ============================================ */}
            {/* ADMIN ROUTES REMOVED - Use admin.parasreward.com */}
            {/* ============================================ */}
            <Route path="/admin-redirect" element={<AdminRedirect />} />
            <Route path="/admin" element={<AdminRedirect />} />
            <Route path="/admin/*" element={<AdminRedirect />} />
            <Route path="/manager" element={<AdminRedirect />} />
            <Route path="/manager/*" element={<AdminRedirect />} />
            
            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        
        {/* Navigation - Only for regular users */}
        {user && !['admin', 'sub_admin', 'manager'].includes(user.role) && (
          <>
            <TopBar user={user} onLogout={handleLogout} />
            <BottomNav />
            <AIContextualHelp user={user} />
          </>
        )}
      </BrowserRouter>
      <Toaster position="top-center" richColors />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
}

function App() {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("paras_user");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [loading, setLoading] = useState(true);

  const refreshUserData = async (uid) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/user/${uid}`);
      if (response.ok) {
        const freshData = await response.json();
        const storedUser = JSON.parse(localStorage.getItem("paras_user") || "{}");
        const updatedUser = {
          ...storedUser,
          ...freshData,
          role: freshData.role || storedUser.role || 'user'
        };
        setUser(updatedUser);
        localStorage.setItem("paras_user", JSON.stringify(updatedUser));
        return updatedUser;
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
    return null;
  };

  useEffect(() => {
    if (user) {
      refreshUserData(user.uid);
    }
    setLoading(false);
  }, []);

  const handleLogin = async (identifier, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, null, {
        params: { identifier, password }
      });
      
      const userData = response.data;
      
      // Check if admin/manager trying to login - redirect them
      if (userData.role === 'admin' || userData.role === 'manager' || userData.role === 'sub_admin') {
        toast.info('Admin/Manager? Use admin.parasreward.com', { duration: 5000 });
        // Still allow login but they'll be redirected
      }
      
      setUser(userData);
      localStorage.setItem("paras_user", JSON.stringify(userData));
      
      return userData;
    } catch (error) {
      throw error;
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("paras_user");
  };

  if (loading) {
    return <LoadingFallback />;
  }

  return (
    <LanguageProvider>
      <NotificationProvider>
        <AppContent user={user} handleLogin={handleLogin} handleLogout={handleLogout} />
      </NotificationProvider>
    </LanguageProvider>
  );
}

export default App;
