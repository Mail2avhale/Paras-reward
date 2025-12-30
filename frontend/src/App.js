import { useEffect, useState, lazy, Suspense } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { NotificationProvider, useNotification } from "@/context/NotificationContext";
import ToastContainer from "@/components/ToastContainer";
import OfflineIndicator from "@/components/OfflineIndicator";
import BottomNav from "@/components/BottomNav";

// Loading component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
      <p className="text-gray-600 font-medium">Loading...</p>
    </div>
  </div>
);

// Lazy load all pages for better performance
const HomeFintech = lazy(() => import("@/pages/HomeFintech"));
const Home = lazy(() => import("@/pages/Home"));
const HowItWorks = lazy(() => import("@/pages/HowItWorks"));
const FAQ = lazy(() => import("@/pages/FAQ"));
const Blog = lazy(() => import("@/pages/Blog"));
const BlogArticle = lazy(() => import("@/pages/BlogArticle"));
const Login = lazy(() => import("@/pages/Login"));
const LoginNew = lazy(() => import("@/pages/LoginNew"));
const RegisterSimple = lazy(() => import("@/pages/RegisterSimple"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ForgotPasswordNew = lazy(() => import("@/pages/ForgotPasswordNew"));
const SupportTickets = lazy(() => import("@/pages/SupportTickets"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const DashboardNew = lazy(() => import("@/pages/DashboardNew"));
const Mining = lazy(() => import("@/pages/Mining"));
const TapGame = lazy(() => import("@/pages/TapGame"));
const DashboardModern = lazy(() => import("@/pages/DashboardModern"));
const Referrals = lazy(() => import("@/pages/Referrals"));
const Marketplace = lazy(() => import("@/pages/Marketplace"));
const MarketplaceEnhanced = lazy(() => import("@/pages/MarketplaceEnhanced"));
const Orders = lazy(() => import("@/pages/Orders"));
const VIPMembership = lazy(() => import("@/pages/VIPMembership"));
// Removed: WalletNew (withdrawal functionality removed)
const Leaderboard = lazy(() => import("@/pages/Leaderboard"));
const ProfileAdvanced = lazy(() => import("@/pages/ProfileAdvanced"));
const ReferralDashboard = lazy(() => import("@/pages/ReferralDashboard"));
const GamificationDashboard = lazy(() => import("@/pages/GamificationDashboard"));
// Removed: ScratchCard game (feature removed)
const FlashSalesPage = lazy(() => import("@/pages/FlashSalesPage"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const AdminDashboardModern = lazy(() => import("@/pages/AdminDashboardModern"));
const AdminAnalytics = lazy(() => import("@/pages/AdminAnalytics"));
const AdminVideoAds = lazy(() => import("@/pages/AdminVideoAds"));
const AdminSettings = lazy(() => import("@/pages/AdminSettings"));
const AdminVIPPlans = lazy(() => import("@/pages/AdminVIPPlans"));
const AdminBurnDashboard = lazy(() => import("@/pages/AdminBurnDashboard"));
const AdminBillPayments = lazy(() => import("@/pages/AdminBillPayments"));
const AdminGiftVouchers = lazy(() => import("@/pages/AdminGiftVouchers"));
const AdminServiceCharges = lazy(() => import("@/pages/AdminServiceCharges"));
const BillPayments = lazy(() => import("@/pages/BillPayments"));
const GiftVoucherRedemption = lazy(() => import("@/pages/GiftVoucherRedemption"));
const ManagerDashboard = lazy(() => import("@/pages/ManagerDashboard"));
const ManagerDashboardNew = lazy(() => import("@/pages/manager/ManagerDashboardNew"));
const ManagerUsers = lazy(() => import("@/pages/manager/ManagerUsers"));
const ManagerOrders = lazy(() => import("@/pages/manager/ManagerOrders"));
const ManagerReports = lazy(() => import("@/pages/manager/ManagerReports"));
const ManagerProducts = lazy(() => import("@/pages/manager/ManagerProducts"));
const ManagerFinance = lazy(() => import("@/pages/manager/ManagerFinance"));
const ManagerCommunication = lazy(() => import("@/pages/manager/ManagerCommunication"));
const ManagerSupport = lazy(() => import("@/pages/manager/ManagerSupport"));
const ManagerStockists = lazy(() => import("@/pages/manager/ManagerStockists"));
const MasterStockistDashboard = lazy(() => import("@/pages/MasterStockistDashboard"));
const SubStockistDashboard = lazy(() => import("@/pages/SubStockistDashboard"));
const OutletPanel = lazy(() => import("@/pages/OutletPanel"));
const StockRequestSystem = lazy(() => import("@/pages/StockRequestSystem"));
const Setup = lazy(() => import("@/pages/Setup"));
const AboutUs = lazy(() => import("@/pages/AboutUs"));
const ContactUs = lazy(() => import("@/pages/ContactUs"));
const TermsAndConditions = lazy(() => import("@/pages/TermsAndConditions"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("@/pages/RefundPolicy"));

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function AppContent({ user, handleLogin, handleLogout }) {
  const { toasts, removeToast } = useNotification();

  // Helper function to get role-based default route
  const getRoleBasedRoute = (user) => {
    if (!user) return "/";
    
    switch (user.role) {
      case 'admin':
      case 'sub_admin':
        return "/admin";
      case 'manager':
        return "/manager";
      case 'master_stockist':
        return "/master-stockist";
      case 'sub_stockist':
        return "/sub-stockist";
      case 'outlet':
        return "/outlet";
      default:
        return "/dashboard";
    }
  };

  return (
    <>
      <OfflineIndicator />
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={user ? <Navigate to={getRoleBasedRoute(user)} /> : <Home user={user} onLogout={handleLogout} />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogArticle />} />
            <Route path="/login" element={user ? <Navigate to={getRoleBasedRoute(user)} /> : <LoginNew onLogin={handleLogin} />} />
            <Route path="/register" element={user ? <Navigate to={getRoleBasedRoute(user)} /> : <RegisterSimple />} />
            <Route path="/forgot-password" element={user ? <Navigate to={getRoleBasedRoute(user)} /> : <ForgotPasswordNew />} />
            <Route path="/setup" element={<Setup />} />
            
            {/* Static Pages */}
            <Route path="/about" element={<AboutUs />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="/terms" element={<TermsAndConditions />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            
            {/* Protected Routes */}
            <Route path="/dashboard" element={user ? <DashboardModern user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/support" element={user ? <SupportTickets user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/mining" element={user ? <Mining user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/game" element={user ? <TapGame user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            {/* Removed: Treasure Hunt and Scratch Card games */}
            <Route path="/referrals" element={user ? <Referrals user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/referrals/dashboard" element={user ? <ReferralDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/marketplace" element={user ? <MarketplaceEnhanced user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/flash-sales" element={user ? <FlashSalesPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/orders" element={user ? <Orders user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/vip" element={user ? <VIPMembership user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/kyc" element={user ? <Navigate to="/profile" /> : <Navigate to="/login" />} />
            {/* Removed: Wallet/Withdrawal functionality */}
            <Route path="/leaderboard" element={user ? <Leaderboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/gamification" element={user ? <GamificationDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/profile" element={user ? <ProfileAdvanced user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            {/* Legacy route redirect - keeping for backward compatibility */}
            <Route path="/profile-advanced" element={<Navigate to="/profile" replace />} />
            <Route path="/stock-requests" element={user && ["outlet", "sub_stockist", "master_stockist"].includes(user.role) ? <StockRequestSystem user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/admin" element={user && user.role === "admin" ? <AdminDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/admin/analytics" element={user && user.role === "admin" ? <AdminAnalytics user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/admin/video-ads" element={user && user.role === "admin" ? <AdminVideoAds user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/admin/settings" element={user && user.role === "admin" ? <AdminSettings user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/admin/vip-plans" element={user && user.role === "admin" ? <AdminVIPPlans user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/admin/burn-management" element={user?.role === 'admin' ? <AdminBurnDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/admin/bill-payments" element={user?.role === 'admin' ? <AdminBillPayments user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/admin/gift-vouchers" element={user?.role === 'admin' ? <AdminGiftVouchers user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/admin/service-charges" element={user?.role === 'admin' ? <AdminServiceCharges user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/bill-payments" element={user ? <BillPayments user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/gift-vouchers" element={user ? <GiftVoucherRedemption user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/manager" element={user && user.role === "manager" ? <ManagerDashboardNew user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/manager/users" element={user && user.role === "manager" ? <ManagerUsers user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/manager/orders" element={user && user.role === "manager" ? <ManagerOrders user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/manager/reports" element={user && user.role === "manager" ? <ManagerReports user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/manager/products" element={user && user.role === "manager" ? <ManagerProducts user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/manager/finance" element={user && user.role === "manager" ? <ManagerFinance user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/manager/communication" element={user && user.role === "manager" ? <ManagerCommunication user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/manager/support" element={user && user.role === "manager" ? <ManagerSupport user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/manager/stockists" element={user && user.role === "manager" ? <ManagerStockists user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/master-stockist" element={user && user.role === "master_stockist" ? <MasterStockistDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/sub-stockist" element={user && user.role === "sub_stockist" ? <SubStockistDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/outlet" element={user && user.role === "outlet" ? <OutletPanel user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem("paras_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem("paras_user", JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("paras_user");
    toast.success("Logged out successfully");
    // Redirect to home page after logout
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <NotificationProvider userId={user?.uid}>
      <AppContent user={user} handleLogin={handleLogin} handleLogout={handleLogout} />
    </NotificationProvider>
  );
}

export default App;
