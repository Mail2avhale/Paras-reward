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
import FloatingActionButton from "@/components/FloatingActionButton";
import AdminLayout from "@/components/layouts/AdminLayout";
import ManagerLayout from "@/components/layouts/ManagerLayout";
import StockistLayout from "@/components/layouts/StockistLayout";

// Helper function to check if user can access admin pages
const canAccessAdmin = (user) => {
  return user && (user.role === "admin" || user.role === "manager");
};

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
const DashboardPremium = lazy(() => import("@/pages/DashboardPremium"));
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
const AdminPRCAnalytics = lazy(() => import("@/pages/AdminPRCAnalytics"));
const AdminAuditService = lazy(() => import("@/pages/AdminAuditService"));
const AdminProfitLoss = lazy(() => import("@/pages/AdminProfitLoss"));
const AdminLiquidity = lazy(() => import("@/pages/AdminLiquidity"));
const AdminCompanyWallets = lazy(() => import("@/pages/AdminCompanyWallets"));
const AdminCashBankBook = lazy(() => import("@/pages/AdminCashBankBook"));
const AdminPRCLedger = lazy(() => import("@/pages/AdminPRCLedger"));
const AdminFinancialReports = lazy(() => import("@/pages/AdminFinancialReports"));
const AdminCapitalManagement = lazy(() => import("@/pages/AdminCapitalManagement"));
const AdminTrialBalance = lazy(() => import("@/pages/AdminTrialBalance"));
const AdminAdsIncome = lazy(() => import("@/pages/AdminAdsIncome"));
const AdminFraudAlerts = lazy(() => import("@/pages/AdminFraudAlerts"));
const AdminVideoAds = lazy(() => import("@/pages/AdminVideoAds"));
const AdminFixedExpenses = lazy(() => import("@/pages/AdminFixedExpenses"));
const AdminKYC = lazy(() => import("@/pages/AdminKYC"));
const AdminOrders = lazy(() => import("@/pages/AdminOrders"));
const AdminSupport = lazy(() => import("@/pages/AdminSupport"));
const AdminMarketplace = lazy(() => import("@/pages/AdminMarketplace"));
const AdminSettings = lazy(() => import("@/pages/AdminSettings"));
const AdminVIPPlans = lazy(() => import("@/pages/AdminVIPPlans"));
const AdminVIPPaymentVerification = lazy(() => import("@/pages/AdminVIPPaymentVerification"));
const AdminBurnDashboard = lazy(() => import("@/pages/AdminBurnDashboard"));
const AdminBillPayments = lazy(() => import("@/pages/AdminBillPayments"));
const AdminGiftVouchers = lazy(() => import("@/pages/AdminGiftVouchers"));
const AdminServiceCharges = lazy(() => import("@/pages/AdminServiceCharges"));
const AdminPolicies = lazy(() => import("@/pages/AdminPolicies"));
const AdminSystemSettings = lazy(() => import("@/pages/AdminSystemSettings"));
const AdminWebSettings = lazy(() => import("@/pages/AdminWebSettings"));
const AdminSocialMediaSettings = lazy(() => import("@/pages/AdminSocialMediaSettings"));
const AdminUserLedger = lazy(() => import("@/pages/AdminUserLedger"));
const AdminRedeemSettings = lazy(() => import("@/pages/AdminRedeemSettings"));
const AdminPRCRain = lazy(() => import("@/pages/AdminPRCRain"));
const AdminAccountingDashboard = lazy(() => import("@/pages/AdminAccountingDashboard"));
const PRCEmergencyControls = lazy(() => import("@/pages/PRCEmergencyControls"));
const AdminUserControls = lazy(() => import("@/pages/AdminUserControls"));
const AdvancedUserManagement = lazy(() => import("@/pages/AdvancedUserManagement"));
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
const StockistManagementAdmin = lazy(() => import("@/pages/StockistManagementAdmin"));
const Setup = lazy(() => import("@/pages/Setup"));
const AboutUs = lazy(() => import("@/pages/AboutUs"));
const ContactUs = lazy(() => import("@/pages/ContactUs"));
const TermsAndConditions = lazy(() => import("@/pages/TermsAndConditions"));
const TermsConditions = lazy(() => import("@/pages/TermsConditions"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("@/pages/RefundPolicy"));
const RewardsHome = lazy(() => import("@/pages/RewardsHome"));

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
      case 'manager':  // Manager now goes to admin dashboard with restricted access
        return "/admin";
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
            <Route path="/" element={user ? <Navigate to={getRoleBasedRoute(user)} /> : <RewardsHome />} />
            <Route path="/home-old" element={<Home user={user} onLogout={handleLogout} />} />
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
            <Route path="/terms" element={<TermsConditions />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/refund" element={<RefundPolicy />} />
            <Route path="/rewards-home" element={<RewardsHome />} />
            
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
            <Route path="/admin" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminDashboard user={user} onLogout={handleLogout} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/users" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdvancedUserManagement /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/analytics" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminAnalytics user={user} onLogout={handleLogout} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/prc-analytics" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminPRCAnalytics user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/company-wallets" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminCompanyWallets user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/ads-income" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminAdsIncome user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/fraud-alerts" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminFraudAlerts user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/audit" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminAuditService user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/fixed-expenses" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminFixedExpenses user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/profit-loss" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminProfitLoss user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/liquidity" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminLiquidity user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/video-ads" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminVideoAds user={user} onLogout={handleLogout} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/settings" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminSettings user={user} onLogout={handleLogout} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/settings/system" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminSystemSettings user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/settings/web" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminWebSettings user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/settings/social" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminSocialMediaSettings user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/settings/redeem" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminRedeemSettings user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/prc-rain" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminPRCRain user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/user-ledger" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminUserLedger user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/capital" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminCapitalManagement user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/accounting" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminAccountingDashboard user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/cash-bank-book" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminCashBankBook user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/prc-ledger" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminPRCLedger user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/financial-reports" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminFinancialReports user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/capital-management" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminCapitalManagement user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/trial-balance" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminTrialBalance user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/prc-economy" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><PRCEmergencyControls user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/user-controls" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminUserControls user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/vip-plans" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminVIPPlans user={user} onLogout={handleLogout} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/burn-management" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminBurnDashboard user={user} onLogout={handleLogout} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/bill-payments" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminBillPayments user={user} onLogout={handleLogout} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/gift-vouchers" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminGiftVouchers user={user} onLogout={handleLogout} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/service-charges" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminServiceCharges user={user} onLogout={handleLogout} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/policies" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminPolicies user={user} onLogout={handleLogout} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/kyc" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminKYC user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/payments" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminVIPPlans user={user} onLogout={handleLogout} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/orders" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminOrders user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/marketplace" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminMarketplace user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/stockists" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><StockistManagementAdmin user={user} onLogout={handleLogout} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/support" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminSupport user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/vip-verification" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminVIPPaymentVerification user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/bill-payments" element={user ? <BillPayments user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/gift-vouchers" element={user ? <GiftVoucherRedemption user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
            <Route path="/manager" element={user && user.role === "manager" ? <ManagerLayout user={user} onLogout={handleLogout}><ManagerDashboardNew user={user} onLogout={handleLogout} /></ManagerLayout> : <Navigate to="/dashboard" />} />
            <Route path="/manager/users" element={user && user.role === "manager" ? <ManagerLayout user={user} onLogout={handleLogout}><ManagerUsers user={user} onLogout={handleLogout} /></ManagerLayout> : <Navigate to="/dashboard" />} />
            <Route path="/manager/orders" element={user && user.role === "manager" ? <ManagerLayout user={user} onLogout={handleLogout}><ManagerOrders user={user} onLogout={handleLogout} /></ManagerLayout> : <Navigate to="/dashboard" />} />
            <Route path="/manager/reports" element={user && user.role === "manager" ? <ManagerLayout user={user} onLogout={handleLogout}><ManagerReports user={user} onLogout={handleLogout} /></ManagerLayout> : <Navigate to="/dashboard" />} />
            <Route path="/manager/products" element={user && user.role === "manager" ? <ManagerLayout user={user} onLogout={handleLogout}><ManagerProducts user={user} onLogout={handleLogout} /></ManagerLayout> : <Navigate to="/dashboard" />} />
            <Route path="/manager/finance" element={user && user.role === "manager" ? <ManagerLayout user={user} onLogout={handleLogout}><ManagerFinance user={user} onLogout={handleLogout} /></ManagerLayout> : <Navigate to="/dashboard" />} />
            <Route path="/manager/communication" element={user && user.role === "manager" ? <ManagerLayout user={user} onLogout={handleLogout}><ManagerCommunication user={user} onLogout={handleLogout} /></ManagerLayout> : <Navigate to="/dashboard" />} />
            <Route path="/manager/support" element={user && user.role === "manager" ? <ManagerLayout user={user} onLogout={handleLogout}><ManagerSupport user={user} onLogout={handleLogout} /></ManagerLayout> : <Navigate to="/dashboard" />} />
            <Route path="/manager/stockists" element={user && user.role === "manager" ? <ManagerLayout user={user} onLogout={handleLogout}><ManagerStockists user={user} onLogout={handleLogout} /></ManagerLayout> : <Navigate to="/dashboard" />} />
            <Route path="/master-stockist" element={user && user.role === "master_stockist" ? <StockistLayout user={user} onLogout={handleLogout} role="master_stockist"><MasterStockistDashboard user={user} onLogout={handleLogout} /></StockistLayout> : <Navigate to="/dashboard" />} />
            <Route path="/master-stockist/*" element={user && user.role === "master_stockist" ? <StockistLayout user={user} onLogout={handleLogout} role="master_stockist"><MasterStockistDashboard user={user} onLogout={handleLogout} /></StockistLayout> : <Navigate to="/dashboard" />} />
            <Route path="/sub-stockist" element={user && user.role === "sub_stockist" ? <StockistLayout user={user} onLogout={handleLogout} role="sub_stockist"><SubStockistDashboard user={user} onLogout={handleLogout} /></StockistLayout> : <Navigate to="/dashboard" />} />
            <Route path="/sub-stockist/*" element={user && user.role === "sub_stockist" ? <StockistLayout user={user} onLogout={handleLogout} role="sub_stockist"><SubStockistDashboard user={user} onLogout={handleLogout} /></StockistLayout> : <Navigate to="/dashboard" />} />
            <Route path="/outlet" element={user && user.role === "outlet" ? <StockistLayout user={user} onLogout={handleLogout} role="outlet"><OutletPanel user={user} onLogout={handleLogout} /></StockistLayout> : <Navigate to="/dashboard" />} />
            <Route path="/outlet/*" element={user && user.role === "outlet" ? <StockistLayout user={user} onLogout={handleLogout} role="outlet"><OutletPanel user={user} onLogout={handleLogout} /></StockistLayout> : <Navigate to="/dashboard" />} />
          </Routes>
        </Suspense>
        {/* Professional Navigation System - Only for regular users, not admin/manager/stockist roles */}
        {user && !['admin', 'sub_admin', 'manager', 'master_stockist', 'sub_stockist', 'outlet'].includes(user.role) && (
          <>
            <TopBar user={user} onLogout={handleLogout} />
            <BottomNav />
            <FloatingActionButton />
          </>
        )}
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
    <LanguageProvider>
      <NotificationProvider userId={user?.uid}>
        <AppContent user={user} handleLogin={handleLogin} handleLogout={handleLogout} />
      </NotificationProvider>
    </LanguageProvider>
  );
}

export default App;
