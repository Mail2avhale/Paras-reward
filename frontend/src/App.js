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
import AIContextualHelp from "@/components/AIContextualHelp";
import AdminLayout from "@/components/layouts/AdminLayout";
import ManagerLayout from "@/components/layouts/ManagerLayout";
// StockistLayout removed - stockist system deprecated

// Helper function to check if user can access admin pages
const canAccessAdmin = (user) => {
  return user && (user.role === "admin" || user.role === "manager");
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
const DailyRewards = lazy(() => import("@/pages/Mining")); // Renamed for AdMob compliance
const TapGame = lazy(() => import("@/pages/TapGame"));
const DashboardModern = lazy(() => import("@/pages/DashboardModern"));
const Referrals = lazy(() => import("@/pages/ReferralsEnhanced"));
const Marketplace = lazy(() => import("@/pages/Marketplace"));
const MarketplaceEnhanced = lazy(() => import("@/pages/MarketplaceEnhanced"));
const Orders = lazy(() => import("@/pages/Orders"));
// VIPMembership removed - replaced by SubscriptionPlans (new 4-tier system)
const SubscriptionPlans = lazy(() => import("@/pages/SubscriptionPlans"));
// Removed: WalletNew (withdrawal functionality removed)
// Removed: Leaderboard (feature removed for AdMob compliance)
const ReferralEarningsHistory = lazy(() => import("@/pages/ReferralEarningsHistory"));
const ProfileAdvanced = lazy(() => import("@/pages/ProfileAdvanced"));
const ReferralDashboard = lazy(() => import("@/pages/ReferralDashboard"));
const ReferralDashboardAI = lazy(() => import("@/pages/ReferralDashboardAI"));
// Removed: GamificationDashboard/Achievements for AdMob compliance
const FlashSalesPage = lazy(() => import("@/pages/FlashSalesPage"));

// Social Feature Pages
const PublicProfile = lazy(() => import("@/pages/PublicProfile"));
const NetworkFeed = lazy(() => import("@/pages/NetworkFeed"));
const Messages = lazy(() => import("@/pages/Messages"));

// ============ ADMIN PAGES - Code Split into separate chunk ============
// These pages are only loaded when admin users access them (~1% of users)
// This reduces initial bundle size for regular users by ~30%
const AdminDashboard = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminDashboard"));
const AdminDashboardModern = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminDashboardModern"));
const AdminAnalytics = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminAnalytics"));
const AdminPRCAnalytics = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminPRCAnalytics"));
const AdminAuditService = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminAuditService"));
const AdminProfitLoss = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminProfitLoss"));
const AdminLiquidity = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminLiquidity"));
const AdminCompanyWallets = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminCompanyWallets"));
const AdminCashBankBook = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminCashBankBook"));
const AdminPRCLedger = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminPRCLedger"));
const AdminFinancialReports = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminFinancialReports"));
const AdminCapitalManagement = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminCapitalManagement"));
const AdminTrialBalance = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminTrialBalance"));
const AdminAccountsReceivable = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminAccountsReceivable"));
const AdminAccountsPayable = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminAccountsPayable"));
const AdminFinancialRatios = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminFinancialRatios"));
const AdminAdsIncome = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminAdsIncome"));
const AdminFraudAlerts = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminFraudAlerts"));
const AdminVideoAds = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminVideoAds"));
const AdminFixedExpenses = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminFixedExpenses"));
const AdminKYC = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminKYC"));
const AdminOrders = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminOrders"));
const AdminSupport = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminSupport"));
const AdminContactSubmissions = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminContactSubmissions"));
const AdminMarketplace = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminMarketplace"));
const AdminSettings = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminSettings"));
const AdminSecurityDashboard = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminSecurityDashboard"));
// AdminVIPPlans and AdminVIPPaymentVerification removed - replaced by AdminSubscriptionManagement (new 4-tier system)
const AdminSubscriptionManagement = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminSubscriptionManagement"));
const AdminBurnDashboard = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminBurnDashboard"));
const AdminBillPayments = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminBillPayments"));
const AdminGiftVouchers = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminGiftVouchers"));
const AdminServiceCharges = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminServiceCharges"));
const AdminPolicies = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminPolicies"));
const AdminSystemSettings = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminSystemSettings"));
const AdminWebSettings = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminWebSettings"));
const AdminSocialMediaSettings = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminSocialMediaSettings"));
const AdminUserLedger = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminUserLedger"));
const AdminRedeemSettings = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminRedeemSettings"));
const AdminPRCRain = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminPRCRain"));
const AdminAccountingDashboard = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminAccountingDashboard"));
const PRCEmergencyControls = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/PRCEmergencyControls"));
const AdminUserControls = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminUserControls"));
const AdvancedUserManagement = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdvancedUserManagement"));
const AdminDeliveryPartners = lazy(() => import(/* webpackChunkName: "admin" */ "@/pages/AdminDeliveryPartners"));
const BillPayments = lazy(() => import("@/pages/BillPayments"));
const GiftVoucherRedemption = lazy(() => import("@/pages/GiftVoucherRedemption"));
const KYCVerification = lazy(() => import("@/pages/KYCVerification"));

// ============ MANAGER PAGES - Code Split into separate chunk ============
const ManagerDashboard = lazy(() => import(/* webpackChunkName: "manager" */ "@/pages/ManagerDashboard"));
const ManagerDashboardNew = lazy(() => import(/* webpackChunkName: "manager" */ "@/pages/manager/ManagerDashboardNew"));
const ManagerUsers = lazy(() => import(/* webpackChunkName: "manager" */ "@/pages/manager/ManagerUsers"));
const ManagerOrders = lazy(() => import(/* webpackChunkName: "manager" */ "@/pages/manager/ManagerOrders"));
const ManagerReports = lazy(() => import(/* webpackChunkName: "manager" */ "@/pages/manager/ManagerReports"));
const ManagerProducts = lazy(() => import(/* webpackChunkName: "manager" */ "@/pages/manager/ManagerProducts"));
const ManagerFinance = lazy(() => import(/* webpackChunkName: "manager" */ "@/pages/manager/ManagerFinance"));
const ManagerCommunication = lazy(() => import(/* webpackChunkName: "manager" */ "@/pages/manager/ManagerCommunication"));
const ManagerSupport = lazy(() => import(/* webpackChunkName: "manager" */ "@/pages/manager/ManagerSupport"));
// ManagerStockists removed - stockist system deprecated

// ============ STOCKIST PAGES REMOVED - Direct Delivery by Partner Model ============

// ============ STATIC PAGES ============
const Setup = lazy(() => import("@/pages/Setup"));
const AboutUs = lazy(() => import("@/pages/AboutUs"));
const Disclaimer = lazy(() => import("@/pages/Disclaimer"));
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
      // Stockist roles deprecated - redirect to dashboard
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
            <Route path="/disclaimer" element={<Disclaimer />} />
            <Route path="/terms" element={<Disclaimer />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="/terms" element={<TermsConditions />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/refund" element={<RefundPolicy />} />
            <Route path="/rewards-home" element={<RewardsHome />} />
            
            {/* Protected Routes */}
            <Route path="/dashboard" element={user ? <DashboardModern user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/support" element={user ? <SupportTickets user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/daily-rewards" element={user ? <DailyRewards user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/mining" element={<Navigate to="/daily-rewards" />} /> {/* Redirect old route */}
            <Route path="/game" element={user ? <TapGame user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            {/* Removed: Treasure Hunt and Scratch Card games */}
            <Route path="/referrals" element={user ? <Referrals user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/referrals/dashboard" element={user ? <ReferralDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/referrals/ai" element={user ? <ReferralDashboardAI user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/network" element={user ? <ReferralDashboardAI user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/marketplace" element={user ? <MarketplaceEnhanced user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/flash-sales" element={user ? <FlashSalesPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/orders" element={user ? <Orders user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/vip" element={<Navigate to="/subscription" replace />} /> {/* Legacy VIP route redirects to new subscription system */}
            <Route path="/subscription" element={user ? <SubscriptionPlans user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/kyc" element={user ? <KYCVerification user={user} /> : <Navigate to="/login" />} />
            {/* Removed: Wallet/Withdrawal functionality */}
            {/* Removed: Leaderboard page for AdMob compliance */}
            <Route path="/referral-earnings" element={user ? <ReferralEarningsHistory user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            {/* Removed: Gamification/Achievements page for AdMob compliance */}
            <Route path="/profile" element={user ? <ProfileAdvanced user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            {/* Legacy route redirect - keeping for backward compatibility */}
            <Route path="/profile-advanced" element={<Navigate to="/profile" replace />} />
            {/* Stock requests removed - stockist system deprecated */}
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
            <Route path="/admin/security" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminSecurityDashboard user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
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
            <Route path="/admin/accounts-receivable" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminAccountsReceivable user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/accounts-payable" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminAccountsPayable user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/financial-ratios" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminFinancialRatios user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/prc-economy" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><PRCEmergencyControls user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/user-controls" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminUserControls user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/vip-plans" element={<Navigate to="/admin/subscriptions" replace />} /> {/* Legacy route redirect */}
            <Route path="/admin/burn-management" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminBurnDashboard user={user} onLogout={handleLogout} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/bill-payments" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminBillPayments user={user} onLogout={handleLogout} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/gift-vouchers" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminGiftVouchers user={user} onLogout={handleLogout} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/service-charges" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminServiceCharges user={user} onLogout={handleLogout} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/policies" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminPolicies user={user} onLogout={handleLogout} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/kyc" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminKYC user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/payments" element={<Navigate to="/admin/subscriptions" replace />} /> {/* Legacy route redirect */}
            <Route path="/admin/orders" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminOrders user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/marketplace" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminMarketplace user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/delivery-partners" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminDeliveryPartners user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            {/* Admin stockists route removed - stockist system deprecated */}
            <Route path="/admin/support" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminSupport user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/contact-submissions" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminContactSubmissions user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
            <Route path="/admin/vip-verification" element={<Navigate to="/admin/subscriptions" replace />} /> {/* Legacy route redirect */}
            <Route path="/admin/subscriptions" element={canAccessAdmin(user) ? <AdminLayout user={user} onLogout={handleLogout}><AdminSubscriptionManagement user={user} /></AdminLayout> : <Navigate to="/dashboard" />} />
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
            {/* Manager stockists route removed - stockist system deprecated */}
            {/* All stockist routes removed - using direct delivery partner model */}
          </Routes>
        </Suspense>
        {/* Professional Navigation System - Only for regular users, not admin/manager roles */}
        {user && !['admin', 'sub_admin', 'manager'].includes(user.role) && (
          <>
            <TopBar user={user} onLogout={handleLogout} />
            <BottomNav />
            <FloatingActionButton />
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
