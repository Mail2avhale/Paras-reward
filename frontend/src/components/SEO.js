import { Helmet } from 'react-helmet-async';

/**
 * SEO Component for Dynamic Meta Tags
 * Use this on every page for better SEO
 * 
 * @param {string} title - Page title
 * @param {string} description - Page description
 * @param {string} keywords - Page keywords (comma separated)
 * @param {string} image - OG Image URL
 * @param {string} url - Canonical URL
 * @param {string} type - og:type (default: website)
 */
const SEO = ({ 
  title = "PARAS REWARD - India's Trusted Reward Platform",
  description = "Join 3000+ Indians earning daily rewards! Collect PRC points, play games, invite friends & redeem for gift vouchers, bill payments & more!",
  keywords = "paras reward, prc points, daily rewards, earn rewards india",
  image = "https://www.parasreward.com/paras-logo.jpg",
  url = "https://www.parasreward.com",
  type = "website",
  noIndex = false
}) => {
  const fullTitle = title.includes("PARAS REWARD") ? title : `${title} | PARAS REWARD`;
  
  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      
      {/* Robots */}
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}
      
      {/* Canonical URL */}
      <link rel="canonical" href={url} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="PARAS REWARD" />
      <meta property="og:locale" content="en_IN" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:site" content="@parasreward" />
    </Helmet>
  );
};

export default SEO;

/**
 * Pre-defined SEO configs for common pages
 */
export const SEOConfigs = {
  home: {
    title: "PARAS REWARD - India's Trusted Reward Platform | Earn PRC Daily",
    description: "Join 3000+ Indians earning daily rewards! Collect PRC points, play games, invite friends & redeem for gift vouchers, bill payments & more!",
    keywords: "paras reward, paras reward app, prc points, daily rewards app india, earn rewards online, loyalty rewards platform",
    url: "https://www.parasreward.com"
  },
  dashboard: {
    title: "Dashboard - Track Your PRC Rewards",
    description: "View your PRC balance, daily rewards progress, and recent transactions. Start earning today!",
    keywords: "paras reward dashboard, prc balance, daily rewards tracker",
    url: "https://www.parasreward.com/dashboard",
    noIndex: true
  },
  dailyRewards: {
    title: "Daily Rewards - Earn PRC Every Day",
    description: "Collect your daily PRC rewards! Streak bonuses, random rewards, and more. Don't miss a day!",
    keywords: "daily rewards, prc points, streak bonus, free rewards india",
    url: "https://www.parasreward.com/daily-rewards",
    noIndex: true
  },
  // tapGame removed - feature deprecated
  referrals: {
    title: "Referrals - Invite Friends & Earn Bonus PRC",
    description: "Earn 10% bonus on every referral! Share your code, grow your team, and earn passive rewards.",
    keywords: "referral program india, invite friends earn money, referral bonus",
    url: "https://www.parasreward.com/referrals",
    noIndex: true
  },
  giftVouchers: {
    title: "Gift Vouchers - Redeem PRC for Amazon, Flipkart & More",
    description: "Redeem your PRC for gift vouchers! Amazon, Flipkart, Myntra, Swiggy and more. Instant delivery!",
    keywords: "gift vouchers india, amazon voucher, flipkart voucher, redeem rewards",
    url: "https://www.parasreward.com/gift-vouchers",
    noIndex: true
  },
  billPayments: {
    title: "Bill Payments - Pay Bills with PRC",
    description: "Pay your electricity, mobile recharge, DTH, and more using PRC! Save real money every month.",
    keywords: "bill payment rewards, mobile recharge prc, electricity bill pay",
    url: "https://www.parasreward.com/bill-payments",
    noIndex: true
  },
  subscription: {
    title: "VIP Membership Plans - Unlock Premium Benefits",
    description: "Upgrade to VIP for 2x rewards, exclusive vouchers, priority support & more! Plans start at ₹149/year.",
    keywords: "vip membership, premium rewards, paras reward plans",
    url: "https://www.parasreward.com/subscription"
  },
  login: {
    title: "Login to PARAS REWARD",
    description: "Sign in to your PARAS REWARD account and start earning daily rewards!",
    keywords: "paras reward login, sign in rewards app",
    url: "https://www.parasreward.com/login"
  },
  register: {
    title: "Register - Join PARAS REWARD Free",
    description: "Create your free PARAS REWARD account in 30 seconds! Start earning PRC immediately.",
    keywords: "paras reward register, create account, free rewards signup",
    url: "https://www.parasreward.com/register"
  },
  faq: {
    title: "FAQ - Frequently Asked Questions",
    description: "Find answers to common questions about PARAS REWARD, PRC points, redemptions, and more.",
    keywords: "paras reward faq, help, support, questions",
    url: "https://www.parasreward.com/faq"
  },
  howItWorks: {
    title: "How It Works - Learn About PARAS REWARD",
    description: "Discover how PARAS REWARD works! Earn PRC through daily activities, games & referrals. Redeem for real products!",
    keywords: "how paras reward works, earning rewards, prc explained",
    url: "https://www.parasreward.com/how-it-works"
  },
  terms: {
    title: "Terms & Conditions",
    description: "Read the terms and conditions for using PARAS REWARD platform.",
    keywords: "terms conditions, paras reward terms",
    url: "https://www.parasreward.com/terms"
  },
  privacy: {
    title: "Privacy Policy",
    description: "Learn how PARAS REWARD protects your privacy and handles your data.",
    keywords: "privacy policy, data protection, paras reward privacy",
    url: "https://www.parasreward.com/privacy"
  }
};
