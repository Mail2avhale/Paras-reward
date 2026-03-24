import { useEffect, useState, lazy, Suspense } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";
import PopupMessage from "@/components/PopupMessage";
import { toast } from "sonner";
import { NotificationProvider, useNotification } from "@/context/NotificationContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ToastContainer from "@/components/ToastContainer";
import OfflineIndicator from "@/components/OfflineIndicator";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
// Lazy load heavy components
const AIContextualHelp = lazy(() => import("@/components/AIContextualHelp"));
// HoliCelebration removed as per user request
// import HoliCelebration from "@/components/HoliCelebration";

// Check if this is a user-only build (for Play Store AAB)
const IS_USER_BUILD = process.env.REACT_APP_BUILD_TYPE === 'user';

// Only import AdminLayout if not user build
const AdminLayout = IS_USER_BUILD ? null : lazy(() => import("@/components/layouts/AdminLayout"));

// ManagerLayout removed - Manager uses AdminLayout with permission-based access
// StockistLayout removed - stockist system deprecated

// Axios defaults for mobile - longer timeout
axios.defaults.timeout = 30000; // 30 seconds for slow mobile networks

// Axios response interceptor - suppress 404 toast errors for optional APIs
axios.interceptors.response.use(
  response => response,
  error => {
    // Don't show toast for 404 errors on optional/stats endpoints
    const url = error.config?.url || '';
    const is404 = error.response?.status === 404;
    const isOptionalEndpoint = url.includes('subscription-stats') || 
                               url.includes('pricing-reference') ||
                               url.includes('dashboard-stats');
    
    if (is404 && isOptionalEndpoint) {
      console.warn(`Optional API not found: ${url}`);
      return Promise.reject(error); // Reject but don't show toast
    }
    
    // Handle timeout errors gracefully
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      console.warn('Request timeout:', url);
    }
    
    return Promise.reject(error);
  }
);

// Axios request interceptor - add cache busting for admin APIs to prevent stale data
axios.interceptors.request.use(
  config => {
    const url = config.url || '';
    
    // Add auth token to all API requests
    const storedUser = localStorage.getItem("paras_user");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user.token) {
          config.headers = config.headers || {};
          config.headers['Authorization'] = `Bearer ${user.token}`;
        }
      } catch (e) {
        console.error('Error parsing user from localStorage:', e);
      }
    }
    
    // Add cache busting for admin dashboard APIs
    if (url.includes('/admin/') && config.method === 'get') {
      config.params = config.params || {};
      config.params._t = Date.now();
      config.headers = config.headers || {};
      config.headers['Cache-Control'] = 'no-cache';
      config.headers['Pragma'] = 'no-cache';
    }
    // Increase timeout for mobile users on slow connections
    if (!config.timeout) {
      config.timeout = 30000;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Helper function to check if user can access admin pages
const canAccessAdmin = (user) => {
  return user && (user.role === "admin" || user.role === "sub_admin" || user.role === "manager");
};

// Helper function to check if user is admin/manager (should not access user pages)
const isAdminOrManager = (user) => {
  return user && (user.role === "admin" || user.role === "sub_admin" || user.role === "manager");
};

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

// Lazy load all pages for better performance
// Home.js and HomeFintech.js removed - using RewardsHome as main landing page
const HowItWorks = lazy(() => import("@/pages/HowItWorks"));
const FAQ = lazy(() => import("@/pages/FAQ"));
const Blog = lazy(() => import("@/pages/Blog"));
const BlogArticle = lazy(() => import("@/pages/BlogArticle"));
const Login = lazy(() => import("@/pages/LoginNew"));
const RegisterSimple = lazy(() => import("@/pages/RegisterSimple"));
const SetNewPin = lazy(() => import("@/pages/SetNewPin"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPasswordNew"));
const ForgotPin = lazy(() => import("@/pages/ForgotPin"));
const SupportTickets = lazy(() => import("@/pages/SupportTickets"));
// Dashboard.js, DashboardNew.js, DashboardPremium.js removed - not in use

// CRITICAL PAGES - Preload after initial render for faster navigation
const DashboardModern = lazy(() => import("@/pages/DashboardModern"));
const DailyRewards = lazy(() => import("@/pages/Mining")); // Renamed for AdMob compliance

// Preload critical pages after initial render
const preloadCriticalPages = () => {
  // Preload after 2 seconds to not block initial render
  setTimeout(() => {
    import("@/pages/DashboardModern");
    import("@/pages/Mining");
  }, 2000);
};

// Call preload when module loads
if (typeof window !== 'undefined') {
  preloadCriticalPages();
}

// TapGame removed - feature deprecated
const Referrals = lazy(() => import("@/pages/ReferralsEnhanced"));
// Marketplace & Orders removed - feature deprecated (December 2025)
// const Orders = lazy(() => import("@/pages/Orders"));
// VIPMembership removed - replaced by SubscriptionPlans (new 4-tier system)
const SubscriptionPlans = lazy(() => import("@/pages/SubscriptionPlans"));
// Removed: WalletNew (withdrawal functionality removed)
// Removed: Leaderboard (feature removed for AdMob compliance)
// Removed: ReferralEarningsHistory (feature removed)
const ProfileAdvanced = lazy(() => import("@/pages/ProfileAdvanced"));
// Removed: ReferralDashboard, ReferralDashboardAI - using ReferralsEnhanced
const FlashSalesPage = lazy(() => import("@/pages/FlashSalesPage"));
// Removed: MyActivity - feature removed

// Social Feature Pages
const PublicProfile = lazy(() => import("@/pages/PublicProfile"));
const NetworkFeed = lazy(() => import("@/pages/NetworkFeed"));
const Messages = lazy(() => import("@/pages/Messages"));
const FollowersList = lazy(() => import("@/pages/FollowersList"));
const Notifications = lazy(() => import("@/pages/Notifications"));
// ParasLuxuryLife - REMOVED (deprecated feature)
// ParasRecurringDeposit - REMOVED (deprecated feature)
const NetworkTreeAdvanced = lazy(() => import("@/pages/NetworkTreeAdvanced"));
const RedeemPageV2 = lazy(() => import("@/pages/RedeemPageV2"));
// UserWithdrawalHistory REMOVED - chatbot feature deprecated (March 2026)
// DMT and Fund Transfer REMOVED - Eko API not working
const BBPSServices = lazy(() => import("@/pages/BBPSServices"));
const MyInvoices = lazy(() => import("@/pages/MyInvoices"));

// ============ ADMIN PAGES - Code Split into separate chunk ============
// These pages are only loaded when admin users access them (~1% of users)
// This reduces initial bundle size for regular users by ~30%
// ADMIN PAGES - Only loaded if NOT user build (excluded from Play Store AAB)
const AdminDashboard = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminDashboard"));
// AdminDashboardModern removed - not in use
const AdminAnalytics = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminAnalytics"));
const AdminPRCAnalytics = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminPRCAnalytics"));
const AdminAuditService = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminAuditService"));
const AdminProfitLoss = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminProfitLoss"));
const AdminLiquidity = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminLiquidity"));
const AdminCompanyWallets = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminCompanyWallets"));
const AdminCashBankBook = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminCashBankBook"));
const AdminPRCLedger = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminPRCLedger"));
const AdminFinancialReports = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminFinancialReports"));
const AdminCapitalManagement = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminCapitalManagement"));
const AdminTrialBalance = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminTrialBalance"));
const AdminAccountsReceivable = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminAccountsReceivable"));
const AdminAccountsPayable = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminAccountsPayable"));
const AdminFinancialRatios = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminFinancialRatios"));
const AdminAdsIncome = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminAdsIncome"));
const AdminFraudAlerts = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminFraudAlerts"));
const AdminFraudDashboard = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminFraudDashboard"));
const AdminVideoAds = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminVideoAds"));
const AdminFixedExpenses = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminFixedExpenses"));
const AdminKYC = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminKYC"));
// AdminDMTRefunds and AdminDMTTransactions REMOVED - Eko API not working
// AdminOrders removed - Marketplace deprecated (December 2025)
// const AdminOrders = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminOrders"));
const AdminSupport = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminSupport"));
// AdminChatbotWithdrawals REMOVED - feature deprecated (March 2026)
const AdminContactSubmissions = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminContactSubmissions"));
const AdminContactSettings = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminContactSettings"));
// AdminMarketplace removed - feature deprecated
const AdminSettings = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminSettings"));
// AdminPaymentSettings, AdminSystemSettings, AdminWebSettings, AdminSocialMediaSettings, AdminRedeemSettings removed - merged into AdminSettingsHub
const AdminSettingsHub = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminSettingsHub"));
const AdminPRCRateControl = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminPRCRateControl"));
const AdminSecurityDashboard = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminSecurityDashboard"));
// AdminVIPPlans and AdminVIPPaymentVerification removed - replaced by AdminSubscriptionManagement (new 4-tier system)
const AdminSubscriptionManagement = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminSubscriptionManagement"));
const AdminMembers = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminMembers"));
// AdminPRCBurnControl - REMOVED (old burn system deprecated, new Burning Session on Mining page)
const AdminDataBackup = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminDataBackup"));
// AdminBillPayments - REMOVED (all pending rejected + refunded)
const AdminRazorpaySubscriptions = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminRazorpaySubscriptions"));
const AdminErrorMonitor = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/Admin/ErrorMonitor"));
// AdminBankWithdrawals removed - merged into AdminUnifiedPayments
const AdminGiftVouchers = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminGiftVouchers"));
const AdminServiceCharges = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminServiceCharges"));
const AdminServiceToggles = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminServiceToggles"));
const AdminPolicies = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminPolicies"));
const AdminUserLedger = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminUserLedger"));
// AdminPRCRain removed - feature deleted
// AdminRedeemSettings, AdminRedeemDashboard - REMOVED (no pending requests, feature deprecated March 2026)
const AdminPendingRequests = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminPendingRequests"));
const AdminAccountingDashboard = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminAccountingDashboard"));
// PRCEmergencyControls replaced by AdminPRCEconomyDashboard
const AdminPRCEconomyDashboard = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminPRCEconomyDashboard"));
// AdminUserControls removed - functionality merged into AdminUser360
// AdvancedUserManagement removed - functionality merged into AdminUser360
// AdminDeliveryPartners removed - feature deprecated
// AdminLuxuryClaims - REMOVED (deprecated feature)
const AdminUser360 = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminUser360New"));
// AdminRecurringDeposits - REMOVED (deprecated feature)
const AdminPerformanceReport = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminPerformanceReport"));
// AdminUnifiedPayments - REMOVED (all pending rejected + refunded)
const AdminEkoServices = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminEkoServices"));
const AdminBBPSDashboard = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/Admin/AdminBBPSDashboard"));
// AdminDMTDashboard - REMOVED (Eko API not working)
const AdminLedgerView = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/Admin/AdminLedgerView"));
const AdminPopupMessages = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/Admin/AdminPopupMessages"));
const AdminBankTransfers = IS_USER_BUILD ? null : lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/Admin/AdminBankTransfers"));
// BillPayments removed - merged into RedeemPageV2, /bill-payments redirects to /redeem
const BankRedeemPage = lazy(() => import("@/pages/BankRedeemPage"));
const GiftVoucherRedemption = lazy(() => import("@/pages/GiftVoucherRedemption"));
const KYCVerification = lazy(() => import("@/pages/KYCVerification"));
const BillPaymentHistory = lazy(() => import("@/pages/BillPaymentHistory"));

// ============ MANAGER PAGES REMOVED ============
// Manager now uses Admin panel with restricted permissions
// All manager/* pages deleted - Manager uses /admin with permission-based access
// ManagerLayout removed - Manager uses AdminLayout with filtered menu items

// ============ STATIC PAGES ============
const Setup = lazy(() => import("@/pages/Setup"));
const AboutUs = lazy(() => import("@/pages/AboutUs"));
const Disclaimer = lazy(() => import("@/pages/Disclaimer"));
const ContactUs = lazy(() => import("@/pages/ContactUs"));
const TermsConditions = lazy(() => import("@/pages/TermsConditions"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("@/pages/RefundPolicy"));
const RewardsHome = lazy(() => import("@/pages/RewardsHome"));
const PRCStatement = lazy(() => import("@/pages/PRCStatement"));

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
      // Stockist roles deprecated - redirect to dashboard
      default:
        return "/dashboard";
    }
  };

  return (
    <>
      <OfflineIndicator />
      {/* HoliCelebration removed as per user request */}
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={user ? <Navigate to={getRoleBasedRoute(user)} /> : <RewardsHome />} />
            {/* home-old route removed - using RewardsHome */}
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogArticle />} />
            <Route path="/login" element={user ? <Navigate to={getRoleBasedRoute(user)} /> : <Login onLogin={handleLogin} />} />
            <Route path="/register" element={user ? <Navigate to={getRoleBasedRoute(user)} /> : <RegisterSimple />} />
            <Route path="/set-new-pin" element={<SetNewPin onLogin={handleLogin} />} />
            <Route path="/forgot-password" element={user ? <Navigate to={getRoleBasedRoute(user)} /> : <ForgotPassword />} />
            <Route path="/forgot-pin" element={user ? <Navigate to={getRoleBasedRoute(user)} /> : <ForgotPin />} />
            <Route path="/setup" element={<Setup />} />
            
            {/* Static Pages */}
            <Route path="/about" element={<AboutUs />} />
            <Route path="/disclaimer" element={<Disclaimer />} />
            <Route path="/terms" element={<Disclaimer />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="/terms" element={<TermsConditions />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/refund" element={<RefundPolicy />} />
            <Route path="/rewards-home" element={<RewardsHome />} />
            
            {/* Protected Routes - User Only (Admin/Manager redirected to /admin) */}
            <Route path="/dashboard" element={user ? (isAdminOrManager(user) ? <Navigate to="/admin" /> : <DashboardModern user={user} onLogout={handleLogout} />) : <Navigate to="/login" />} />
            {/* fintech route removed - not in use */}
            <Route path="/support" element={user ? (isAdminOrManager(user) ? <Navigate to="/admin" /> : <SupportTickets user={user} onLogout={handleLogout} />) : <Navigate to="/login" />} />
            <Route path="/daily-rewards" element={user ? (isAdminOrManager(user) ? <Navigate to="/admin" /> : <DailyRewards user={user} onLogout={handleLogout} />) : <Navigate to="/login" />} />
            <Route path="/mining" element={<Navigate to="/daily-rewards" />} /> {/* Redirect old route */}
            {/* TapGame removed - feature deprecated */}
            <Route path="/game" element={<Navigate to="/dashboard" replace />} />
            {/* Removed: Treasure Hunt and Scratch Card games */}
            <Route path="/referrals" element={user ? (isAdminOrManager(user) ? <Navigate to="/admin" /> : <Referrals user={user} onLogout={handleLogout} />) : <Navigate to="/login" />} />
            <Route path="/referrals/dashboard" element={<Navigate to="/referrals" replace />} />
            <Route path="/referrals/ai" element={<Navigate to="/referrals" replace />} />
            <Route path="/network" element={<Navigate to="/referrals" replace />} />
            {/* Marketplace removed - feature deprecated */}
            <Route path="/marketplace" element={<Navigate to="/dashboard" replace />} />
            <Route path="/flash-sales" element={user ? (isAdminOrManager(user) ? <Navigate to="/admin" /> : <FlashSalesPage user={user} onLogout={handleLogout} />) : <Navigate to="/login" />} />
            {/* Orders removed - Marketplace deprecated (December 2025) */}
            <Route path="/orders" element={<Navigate to="/dashboard" replace />} />
            {/* PRC Redeem Statement */}
            <Route path="/prc-statement" element={user ? <Suspense fallback={<LoadingFallback />}><PRCStatement user={user} /></Suspense> : <Navigate to="/login" />} />
            {/* Removed: Activity page */}
            <Route path="/vip" element={<Navigate to="/subscription" replace />} /> {/* Legacy VIP route redirects to new subscription system */}
            <Route path="/subscription" element={user ? (isAdminOrManager(user) ? <Navigate to="/admin" /> : <SubscriptionPlans user={user} onLogout={handleLogout} />) : <Navigate to="/login" />} />
            <Route path="/my-invoices" element={user ? (isAdminOrManager(user) ? <Navigate to="/admin" /> : <MyInvoices user={user} />) : <Navigate to="/login" />} />
            <Route path="/invoices" element={<Navigate to="/my-invoices" replace />} />
            <Route path="/kyc" element={user ? (isAdminOrManager(user) ? <Navigate to="/admin" /> : <KYCVerification user={user} />) : <Navigate to="/login" />} />
            {/* Removed: Wallet/Withdrawal functionality */}
            {/* Removed: Leaderboard page for AdMob compliance */}
            {/* Removed: ReferralEarningsHistory page */}
            {/* Removed: Gamification/Achievements page for AdMob compliance */}
            <Route path="/profile" element={user ? (isAdminOrManager(user) ? <Navigate to="/admin" /> : <ProfileAdvanced user={user} onLogout={handleLogout} />) : <Navigate to="/login" />} />
            {/* Legacy route redirect - keeping for backward compatibility */}
            <Route path="/profile-advanced" element={<Navigate to="/profile" replace />} />
            
            {/* Social Feature Routes - User Only */}
            <Route path="/profile/:uid" element={<PublicProfile user={user} />} />
            <Route path="/network-feed" element={user ? (isAdminOrManager(user) ? <Navigate to="/admin" /> : <NetworkFeed user={user} />) : <Navigate to="/login" />} />
            <Route path="/messages" element={user ? (isAdminOrManager(user) ? <Navigate to="/admin" /> : <Messages user={user} />) : <Navigate to="/login" />} />
            <Route path="/messages/:recipientUid" element={user ? (isAdminOrManager(user) ? <Navigate to="/admin" /> : <Messages user={user} />) : <Navigate to="/login" />} />
            <Route path="/followers/:uid" element={<FollowersList user={user} type="followers" />} />
            <Route path="/following/:uid" element={<FollowersList user={user} type="following" />} />
            <Route path="/notifications" element={user ? (isAdminOrManager(user) ? <Navigate to="/admin" /> : <Notifications user={user} />) : <Navigate to="/login" />} />
            {/* /luxury-life route REMOVED - deprecated feature */}
            {/* /recurring-deposit route REMOVED - deprecated feature */}
            <Route path="/recurring-deposit" element={<Navigate to="/dashboard" replace />} />
            <Route path="/rd" element={<Navigate to="/dashboard" replace />} />
            <Route path="/network-tree" element={user ? (isAdminOrManager(user) ? <Navigate to="/admin" /> : <NetworkTreeAdvanced user={user} />) : <Navigate to="/login" />} />
            <Route path="/bank-redeem" element={user ? (isAdminOrManager(user) ? <Navigate to="/admin" /> : <BankRedeemPage user={user} />) : <Navigate to="/login" />} />
            <Route path="/prc-to-bank" element={user ? (isAdminOrManager(user) ? <Navigate to="/admin" /> : <BankRedeemPage user={user} />) : <Navigate to="/login" />} />
            {/* DMT/Fund Transfer REMOVED - Eko API not working, redirect to redeem */}
            <Route path="/dmt" element={user ? <Navigate to="/redeem" /> : <Navigate to="/login" />} />
            <Route path="/fund-transfer" element={user ? <Navigate to="/redeem" /> : <Navigate to="/login" />} />
            <Route path="/bank-transfer" element={user ? <Navigate to="/redeem" /> : <Navigate to="/login" />} />
            <Route path="/money-transfer" element={user ? <Navigate to="/redeem" /> : <Navigate to="/login" />} />
            <Route path="/bbps" element={user ? (isAdminOrManager(user) ? <Navigate to="/admin" /> : <BBPSServices user={user} />) : <Navigate to="/login" />} />
            <Route path="/bill-pay" element={user ? <Navigate to="/bbps" /> : <Navigate to="/login" />} />
            
            {/* Stock requests removed - stockist system deprecated */}
            
            {/* ========== ADMIN ROUTES - Excluded from User Build (Play Store AAB) ========== */}
            {!IS_USER_BUILD && AdminLayout && (
              <>
                <Route path="/admin" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminDashboard user={user} onLogout={handleLogout} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/dashboard" element={canAccessAdmin(user) ? <Navigate to="/admin" replace /> : <Navigate to="/dashboard" />} />
                <Route path="/admin/users" element={<Navigate to="/admin/user-360" replace />} />
                <Route path="/admin/analytics" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminAnalytics user={user} onLogout={handleLogout} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/prc-analytics" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminPRCAnalytics user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/company-wallets" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminCompanyWallets user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/ads-income" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminAdsIncome user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/fraud-alerts" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminFraudAlerts user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/fraud-dashboard" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminFraudDashboard user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/audit" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminAuditService user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/fixed-expenses" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminFixedExpenses user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/profit-loss" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminProfitLoss user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/liquidity" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminLiquidity user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/video-ads" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminVideoAds user={user} onLogout={handleLogout} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/settings-hub" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminSettingsHub user={user} onLogout={handleLogout} /></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/prc-rate-control" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminPRCRateControl user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/settings" element={canAccessAdmin(user) ? <Navigate to="/admin/settings-hub?tab=payment" replace /> : <Navigate to="/dashboard" />} />
                <Route path="/admin/security" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminSecurityDashboard user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/error-monitor" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminErrorMonitor user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/settings/system" element={canAccessAdmin(user) ? <Navigate to="/admin/settings-hub?tab=system" replace /> : <Navigate to="/dashboard" />} />
                <Route path="/admin/settings/web" element={canAccessAdmin(user) ? <Navigate to="/admin/settings-hub?tab=web" replace /> : <Navigate to="/dashboard" />} />
                <Route path="/admin/settings/social" element={canAccessAdmin(user) ? <Navigate to="/admin/settings-hub?tab=social" replace /> : <Navigate to="/dashboard" />} />
                <Route path="/admin/settings/redeem" element={canAccessAdmin(user) ? <Navigate to="/admin/settings-hub?tab=redeem" replace /> : <Navigate to="/dashboard" />} />
                {/* AdminRedeemSettings - REMOVED (deprecated March 2026) */}
                <Route path="/admin/redeem-settings" element={<Navigate to="/admin" replace />} />
                <Route path="/admin/pending-requests" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminPendingRequests user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/user-ledger" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminUserLedger user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/capital" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminCapitalManagement user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/accounting" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminAccountingDashboard user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/cash-bank-book" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminCashBankBook user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/prc-ledger" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminPRCLedger user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/financial-reports" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminFinancialReports user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/capital-management" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminCapitalManagement user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/trial-balance" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminTrialBalance user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/accounts-receivable" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminAccountsReceivable user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/accounts-payable" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminAccountsPayable user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/financial-ratios" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminFinancialRatios user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/prc-economy" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminPRCEconomyDashboard user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/user-controls" element={<Navigate to="/admin/user-360" />} />
                <Route path="/admin/user-360" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminUser360 user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/vip-plans" element={<Navigate to="/admin/subscriptions" replace />} />
                {/* AdminPRCBurnControl - REMOVED, redirect to admin */}
                <Route path="/admin/prc-burn-control" element={<Navigate to="/admin" replace />} />
                <Route path="/admin/data-backup" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminDataBackup user={user} onLogout={handleLogout} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                {/* AdminBillPayments - REMOVED, redirect to admin */}
                <Route path="/admin/bill-payments" element={<Navigate to="/admin" replace />} />
                <Route path="/admin/razorpay-subscriptions" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminRazorpaySubscriptions user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                {/* /admin/bank-withdrawals merged into /admin/unified-payments */}
                <Route path="/admin/bank-withdrawals" element={<Navigate to="/admin/unified-payments" replace />} />
                <Route path="/admin/gift-vouchers" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminGiftVouchers user={user} onLogout={handleLogout} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                {/* /admin/luxury-claims route REMOVED - deprecated feature */}
                {/* /admin/recurring-deposits route REMOVED - deprecated feature */}
                <Route path="/admin/recurring-deposits" element={<Navigate to="/admin" replace />} />
                <Route path="/admin/rd" element={<Navigate to="/admin" replace />} />
                {/* AdminUnifiedPayments - REMOVED, redirect to admin */}
                <Route path="/admin/unified-payments" element={<Navigate to="/admin" replace />} />
                <Route path="/admin/eko-services" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminEkoServices user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                {/* AdminRedeemDashboard - REMOVED (deprecated March 2026, no pending requests) */}
                <Route path="/admin/redeem" element={<Navigate to="/admin/bbps" replace />} />
                <Route path="/admin/bbps" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminBBPSDashboard user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                {/* Admin DMT routes REMOVED - Eko API not working, redirect to admin */}
                <Route path="/admin/dmt" element={<Navigate to="/admin" replace />} />
                <Route path="/admin/dmt-transactions" element={<Navigate to="/admin" replace />} />
                <Route path="/admin/dmt-refunds" element={<Navigate to="/admin" replace />} />
                <Route path="/admin/ledger" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminLedgerView user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/popup-messages" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminPopupMessages user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/bank-transfers" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminBankTransfers user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/performance-report" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminPerformanceReport user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/service-charges" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminServiceCharges user={user} onLogout={handleLogout} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/service-toggles" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminServiceToggles user={user} onLogout={handleLogout} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/policies" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminPolicies user={user} onLogout={handleLogout} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/kyc" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminKYC user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/payments" element={<Navigate to="/admin/subscriptions" replace />} />
                {/* Admin Orders removed - Marketplace deprecated (December 2025) */}
                <Route path="/admin/orders" element={<Navigate to="/admin" replace />} />
                <Route path="/admin/marketplace" element={<Navigate to="/admin" replace />} />
                <Route path="/admin/delivery-partners" element={<Navigate to="/admin" replace />} />
                <Route path="/admin/support" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminSupport user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                {/* AdminChatbotWithdrawals REMOVED - feature deprecated (March 2026) */}
                <Route path="/admin/chatbot-withdrawals" element={<Navigate to="/admin" replace />} />
                <Route path="/admin/contact-submissions" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminContactSubmissions user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/contact-settings" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminContactSettings user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/vip-verification" element={<Navigate to="/admin/subscriptions" replace />} />
                <Route path="/admin/subscriptions" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminSubscriptionManagement user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
                <Route path="/admin/members" element={canAccessAdmin(user) ? <Suspense fallback={<LoadingFallback />}><AdminLayout user={user} onLogout={handleLogout}><AdminMembers user={user} /></AdminLayout></Suspense> : <Navigate to="/dashboard" />} />
              </>
            )}
            
            {/* Redirect admin routes to dashboard in User Build */}
            {IS_USER_BUILD && (
              <Route path="/admin/*" element={<Navigate to="/dashboard" replace />} />
            )}
            
            {/* New Redeem V2 Route - Unified Services */}
            <Route path="/redeem" element={user ? (isAdminOrManager(user) ? <Navigate to="/admin" /> : <RedeemPageV2 user={user} />) : <Navigate to="/login" />} />
            
            {/* User Withdrawal History - REMOVED - chatbot deprecated (March 2026) */}
            <Route path="/withdrawal-history" element={<Navigate to="/redeem" replace />} />
            
            {/* Bill Payment History - View past bill payments and pay again */}
            <Route path="/bill-history" element={user ? <Suspense fallback={<LoadingFallback />}><BillPaymentHistory user={user} /></Suspense> : <Navigate to="/login" />} />
            
            {/* Old bill-payments route redirects to new redeem page */}
            <Route path="/bill-payments" element={<Navigate to="/redeem" replace />} />
            <Route path="/gift-vouchers" element={user ? (isAdminOrManager(user) ? <Navigate to="/admin" /> : <GiftVoucherRedemption user={user} onLogout={handleLogout} />) : <Navigate to="/login" />} />
            {/* Manager routes now redirect to Admin - Manager uses Admin panel with permission-based access */}
            <Route path="/manager" element={<Navigate to="/admin" replace />} />
            <Route path="/manager/*" element={<Navigate to="/admin" replace />} />
            {/* All stockist routes removed - using direct delivery partner model */}
          </Routes>
        </Suspense>
        {/* Professional Navigation System - Only for regular users, not admin/manager roles */}
        {user && !['admin', 'sub_admin', 'manager'].includes(user.role) && (
          <>
            <TopBar user={user} onLogout={handleLogout} />
            <BottomNav />
            <Suspense fallback={null}>
              <AIContextualHelp user={user} />
            </Suspense>
          </>
        )}
        {/* Admin Popup Message - Shows for logged-in users only */}
        <PopupMessage />
      </BrowserRouter>
      <Toaster 
        position="top-center" 
        richColors 
        visibleToasts={2}
        toastOptions={{
          duration: 3000,
          style: {
            marginTop: '40vh',
          },
        }}
      />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
}

function App() {
  // Initialize user from localStorage synchronously
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("paras_user");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [loading, setLoading] = useState(true);
  const [roleValidated, setRoleValidated] = useState(false);

  // SECURITY: Validate user role via API instead of trusting localStorage
  const validateUserRole = async (storedUser) => {
    if (!storedUser?.token) return null;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${storedUser.token}`
        }
      });
      
      if (response.ok) {
        const verifiedUser = await response.json();
        // Update role from server-verified response
        const updatedUser = {
          ...storedUser,
          role: verifiedUser.role,
          is_admin: verifiedUser.is_admin,
          verified: verifiedUser.verified
        };
        
        // If role mismatch, update localStorage
        if (storedUser.role !== verifiedUser.role) {
          console.warn('[SECURITY] Role mismatch detected:', {
            stored: storedUser.role,
            verified: verifiedUser.role
          });
          localStorage.setItem("paras_user", JSON.stringify(updatedUser));
        }
        
        return updatedUser;
      } else if (response.status === 401) {
        // Token expired or invalid - logout
        console.warn('[SECURITY] Token invalid, clearing session');
        localStorage.removeItem("paras_user");
        localStorage.removeItem("paras_session_token");
        return null;
      }
    } catch (error) {
      console.error('[SECURITY] Role validation failed:', error);
    }
    return storedUser; // Fallback to stored user on network error
  };

  // Refresh user data from server to ensure subscription info is current
  const refreshUserData = async (uid) => {
    // Add timeout to prevent infinite loading
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/user/${uid}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const freshData = await response.json();
        // CRITICAL: Preserve admin/sub_admin/manager role from stored user
        // API might return 'user' as default, but we must keep elevated roles
        const storedUser = JSON.parse(localStorage.getItem("paras_user") || "{}");
        const storedRole = storedUser.role;
        const freshRole = freshData.role;
        
        // DEBUG: Log role comparison
        /* console.log('[REFRESH] Role comparison:', {
          storedRole,
          freshRole,
          storedUserKeys: Object.keys(storedUser).length
        }); */
        
        // Priority: Keep admin roles from login, don't let refresh override them
        let finalRole = 'user';
        if (['admin', 'sub_admin', 'manager'].includes(storedRole)) {
          // NEVER override admin roles - they come from login API with proper auth
          finalRole = storedRole;
          // console.log('[REFRESH] Keeping admin role from stored:', finalRole);
        } else if (freshRole && freshRole !== 'user') {
          // Use fresh role if it's elevated (API returned a real role)
          finalRole = freshRole;
          // console.log('[REFRESH] Using elevated fresh role:', finalRole);
        } else {
          // Default case - use stored or fresh, prefer stored
          finalRole = storedRole || freshRole || 'user';
          // console.log('[REFRESH] Using default role logic:', finalRole);
        }
        
        const updatedUser = {
          ...storedUser,
          ...freshData,
          role: finalRole
        };
        setUser(updatedUser);
        localStorage.setItem("paras_user", JSON.stringify(updatedUser));
        // console.log('[REFRESH] Final user role set to:', finalRole);
        return updatedUser;
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.warn('[REFRESH] Request timed out after 15 seconds');
      } else {
        console.error('Error refreshing user data:', error);
      }
    }
    return null;
  };

  useEffect(() => {
    // If user exists, validate role via API and refresh data from server
    // SECURITY: Validate role server-side before allowing admin access
    let timeoutFallback;
    
    const initializeUser = async () => {
      if (user?.uid) {
        // First validate role via /auth/me API
        const validatedUser = await validateUserRole(user);
        
        if (!validatedUser) {
          // Token invalid - clear user
          setUser(null);
          setLoading(false);
          setRoleValidated(true);
          return;
        }
        
        // Update user with validated role
        if (validatedUser.role !== user.role) {
          setUser(validatedUser);
        }
        setRoleValidated(true);
        
        // Then refresh full user data
        await refreshUserData(user.uid);
        setLoading(false);
      } else {
        setLoading(false);
        setRoleValidated(true);
      }
    };
    
    timeoutFallback = setTimeout(() => {
      console.warn('[APP] Loading fallback triggered after 20 seconds');
      setLoading(false);
      setRoleValidated(true);
    }, 20000);
    
    initializeUser().finally(() => {
      clearTimeout(timeoutFallback);
    });
    
    return () => {
      if (timeoutFallback) clearTimeout(timeoutFallback);
    };
  }, []); // Run once on mount

  const handleLogin = async (userData) => {
    // DEBUG: Log login data for troubleshooting admin redirect
    /* console.log('[LOGIN] User data received:', {
      uid: userData.uid,
      role: userData.role,
      name: userData.name
    }); */
    
    // Save session token for single-session enforcement
    if (userData.session_token) {
      localStorage.setItem("paras_session_token", userData.session_token);
    }
    setUser(userData);
    localStorage.setItem("paras_user", JSON.stringify(userData));
    
    // console.log('[LOGIN] User saved to state and localStorage with role:', userData.role);
    
    // Refresh to get complete user data including subscription
    setTimeout(() => refreshUserData(userData.uid), 100);
  };

  const handleLogout = async (showMessage = true, reason = null) => {
    const storedUser = JSON.parse(localStorage.getItem("paras_user") || "{}");
    
    // Clear session on server
    if (storedUser?.uid) {
      try {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: storedUser.uid })
        });
      } catch (e) {
        console.error('Logout API error:', e);
      }
    }
    
    setUser(null);
    localStorage.removeItem("paras_user");
    localStorage.removeItem("paras_session_token");
    
    if (showMessage) {
      if (reason === 'session_expired') {
        toast.error("तुम्ही दुसऱ्या device वर login केले आहे. कृपया पुन्हा login करा.", { duration: 5000 });
      } else {
        toast.success("Logged out successfully");
      }
    }
    
    // Redirect to home page after logout
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
  };

  // Session validation - check every 30 seconds (with initial delay to allow login to complete)
  useEffect(() => {
    if (!user?.uid) return;
    
    const validateSession = async () => {
      const sessionToken = localStorage.getItem("paras_session_token");
      if (!sessionToken) return;
      
      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/validate-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid, session_token: sessionToken })
        });
        
        const result = await response.json();
        
        if (!result.valid && result.reason === 'session_expired') {
          // Another device logged in - force logout
          handleLogout(true, 'session_expired');
        }
      } catch (e) {
        console.error('Session validation error:', e);
      }
    };
    
    // IMPORTANT: Delay first validation by 5 seconds to allow login process to complete
    // This prevents race condition where validation runs before session_token is saved to DB
    const initialDelay = setTimeout(validateSession, 5000);
    const interval = setInterval(validateSession, 30000);
    
    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, [user?.uid]);

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
