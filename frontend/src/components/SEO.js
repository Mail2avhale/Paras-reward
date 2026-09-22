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
  title = "PARAS REWARDS - India's Trusted Reward Platform",
  description = "Join 3000+ Indians earning daily rewards! Collect PRC points, play games, invite friends & enjoy exclusive benefits!",
  keywords = "paras rewards, prc points, daily rewards, earn rewards india",
  image = "https://www.parasreward.com/paras-logo.png",
  url = "https://www.parasreward.com",
  type = "website",
  noIndex = false
}) => {
  const fullTitle = title.includes("PARAS REWARDS") ? title : `${title} | PARAS REWARDS`;
  
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
      <meta property="og:site_name" content="PARAS REWARDS" />
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
    title: "PARAS REWARDS - India's Trusted Reward Platform | Earn PRC Daily",
    description: "Join 3000+ Indians earning daily rewards! Collect PRC points, play games, invite friends & enjoy exclusive platform benefits!",
    keywords: "paras rewards, paras rewards app, prc points, daily rewards app india, earn rewards online, loyalty rewards platform",
    url: "https://www.parasreward.com"
  },
  dashboard: {
    title: "Dashboard - Track Your PRC Rewards",
    description: "View your PRC balance, daily rewards progress, and recent transactions. Start earning today!",
    keywords: "paras rewards dashboard, prc balance, daily rewards tracker",
    url: "https://www.parasreward.com/dashboard",
    noIndex: true
  },
  // dailyRewards removed - integrated into Dashboard (April 2026)
  // tapGame removed - feature deprecated
  referrals: {
    title: "Growth Network - Invite Friends & Earn Bonus PRC",
    description: "Grow your network and increase your rewards! Share your code and unlock more benefits through activity.",
    keywords: "growth network india, invite friends earn rewards, partner program",
    url: "https://www.parasreward.com/referrals",
    noIndex: true
  },
  subscription: {
    title: "VIP Membership Plans - Unlock Premium Benefits",
    description: "Upgrade to VIP for 2x rewards, exclusive vouchers, priority support & more! Plans start at ₹149/year.",
    keywords: "vip membership, premium rewards, paras rewards plans",
    url: "https://www.parasreward.com/subscription"
  },
  login: {
    title: "Login to PARAS REWARDS",
    description: "Sign in to your PARAS REWARDS account and start earning daily rewards!",
    keywords: "paras rewards login, sign in rewards app",
    url: "https://www.parasreward.com/login"
  },
  register: {
    title: "Register - Join PARAS REWARDS Free",
    description: "Create your free PARAS REWARDS account in 30 seconds! Start earning PRC immediately.",
    keywords: "paras rewards register, create account, free rewards signup",
    url: "https://www.parasreward.com/register"
  },
  faq: {
    title: "FAQ - Frequently Asked Questions",
    description: "Find answers to common questions about PARAS REWARDS, PRC points, redemptions, and more.",
    keywords: "paras rewards faq, help, support, questions",
    url: "https://www.parasreward.com/faq"
  },
  howItWorks: {
    title: "How It Works - Learn About PARAS REWARDS",
    description: "Discover how PARAS REWARDS works! Earn PRC through daily activities, games & referrals. Unlock exclusive benefits!",
    keywords: "how paras rewards works, earning rewards, prc explained",
    url: "https://www.parasreward.com/how-it-works"
  },
  terms: {
    title: "Terms & Conditions",
    description: "Read the terms and conditions for using PARAS REWARDS platform.",
    keywords: "terms conditions, paras rewards terms",
    url: "https://www.parasreward.com/terms"
  },
  privacy: {
    title: "Privacy Policy",
    description: "Learn how PARAS REWARDS protects your privacy and handles your data.",
    keywords: "privacy policy, data protection, paras rewards privacy",
    url: "https://www.parasreward.com/privacy"
  }
};
