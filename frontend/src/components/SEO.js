import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * SEO Component - Manages meta tags for better search engine optimization
 * Usage: <SEO title="Page Title" description="Page description" />
 */
const SEO = ({ 
  title = 'PARAS REWARD - India\'s No.1 Mining-Based Reward Platform',
  description = 'India\'s No.1 mining-based reward platform. Mine PRC daily, play treasure hunt games, refer & earn 10% bonus, redeem 5000+ products. Join 10,000+ users earning real rewards! Free mining | VIP benefits | Instant cashback.',
  keywords = 'paras reward, india mining platform, prc coins mining, earn daily rewards, treasure hunt game, refer and earn india, crypto mining app, reward platform india, online earning app',
  author = 'PARAS REWARD Team',
  image = 'https://parasreward.com/paras-logo.jpg',
  type = 'website',
  canonical = null
}) => {
  const location = useLocation();
  // Use environment variable or detect from window.location
  const baseUrl = typeof window !== 'undefined' 
    ? `${window.location.protocol}//${window.location.host}`
    : 'https://parasreward.com';
  const currentUrl = `${baseUrl}${location.pathname}`;
  const canonicalUrl = canonical || currentUrl;

  useEffect(() => {
    // Update document title
    document.title = title;

    // Helper function to update or create meta tag
    const updateMetaTag = (attr, key, content) => {
      let element = document.querySelector(`meta[${attr}="${key}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attr, key);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Standard meta tags
    updateMetaTag('name', 'description', description);
    updateMetaTag('name', 'keywords', keywords);
    updateMetaTag('name', 'author', author);
    updateMetaTag('name', 'robots', 'index, follow');
    updateMetaTag('name', 'language', 'English');
    updateMetaTag('name', 'revisit-after', '7 days');

    // Open Graph meta tags (Facebook, LinkedIn)
    updateMetaTag('property', 'og:title', title);
    updateMetaTag('property', 'og:description', description);
    updateMetaTag('property', 'og:image', image);
    updateMetaTag('property', 'og:url', currentUrl);
    updateMetaTag('property', 'og:type', type);
    updateMetaTag('property', 'og:site_name', 'PARAS REWARD');
    updateMetaTag('property', 'og:locale', 'en_US');

    // Twitter Card meta tags
    updateMetaTag('name', 'twitter:card', 'summary_large_image');
    updateMetaTag('name', 'twitter:title', title);
    updateMetaTag('name', 'twitter:description', description);
    updateMetaTag('name', 'twitter:image', image);
    updateMetaTag('name', 'twitter:site', '@parasreward');
    updateMetaTag('name', 'twitter:creator', '@parasreward');

    // Mobile meta tags
    updateMetaTag('name', 'viewport', 'width=device-width, initial-scale=1.0, maximum-scale=5.0');
    updateMetaTag('name', 'theme-color', '#9333EA');
    updateMetaTag('name', 'apple-mobile-web-app-capable', 'yes');
    updateMetaTag('name', 'apple-mobile-web-app-status-bar-style', 'black-translucent');
    updateMetaTag('name', 'apple-mobile-web-app-title', 'PARAS REWARD');

    // Update canonical link
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    // Add structured data (JSON-LD)
    const addStructuredData = () => {
      let script = document.querySelector('script[type="application/ld+json"]');
      if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }

      const structuredData = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "PARAS REWARD",
        "alternateName": "India's No.1 Mining-Based Reward Platform",
        "url": "https://parasreward.com",
        "description": description,
        "applicationCategory": "FinanceApplication",
        "operatingSystem": "Web, iOS, Android",
        "logo": "https://parasreward.com/paras-logo.jpg",
        "image": "https://parasreward.com/paras-logo.jpg",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "INR"
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.5",
          "ratingCount": "10000"
        },
        "author": {
          "@type": "Organization",
          "name": "PARAS REWARD",
          "logo": {
            "@type": "ImageObject",
            "url": "https://parasreward.com/paras-logo.jpg"
          },
          "sameAs": [
            "https://www.facebook.com/parasreward",
            "https://twitter.com/parasreward",
            "https://www.instagram.com/parasreward"
          ]
        },
        "potentialAction": {
          "@type": "UseAction",
          "target": "https://parasreward.com/register"
        }
      };

      script.textContent = JSON.stringify(structuredData);
    };

    addStructuredData();

  }, [title, description, keywords, author, image, type, currentUrl, canonicalUrl]);

  return null; // This component doesn't render anything
};

export default SEO;

// Pre-defined SEO configs for common pages
export const SEOConfigs = {
  home: {
    title: 'PARAS REWARD - India\'s No.1 Mining-Based Reward Platform | Earn PRC Daily',
    description: '🏆 India\'s No.1 Mining-Based Reward Platform ⚡ Mine PRC Daily | 🎮 Play Treasure Hunt (50% Cashback) | 💰 Refer & Earn 10% | 🛒 5000+ Products | 👥 10,000+ Active Users | Free Mining, VIP Benefits, Instant Withdrawals',
    keywords: 'paras reward india, mining based reward platform, prc coins mining, daily mining rewards, treasure hunt cashback game, refer earn 10 percent india, free mining app, vip membership benefits, online earning platform india',
  },
  login: {
    title: 'Login - PARAS REWARD | Access Your Reward Account',
    description: 'Login to your PARAS REWARD account. Access your PRC balance, track earnings, play games, and manage rewards.',
    keywords: 'paras reward login, account login, user login, reward account',
  },
  register: {
    title: 'Register Free - PARAS REWARD | Start Earning Today',
    description: 'Create your free PARAS REWARD account today! Start earning PRC coins, refer friends, play games, and redeem for cash. No investment required.',
    keywords: 'paras reward register, sign up, create account, free registration, join paras reward',
  },
  dashboard: {
    title: 'Dashboard - PARAS REWARD | Your Rewards Hub',
    description: 'View your PRC balance, daily earnings, referral stats, and access all reward features. Manage your account and track progress.',
    keywords: 'dashboard, reward dashboard, prc balance, earnings, account overview',
  },
  treasureHunt: {
    title: 'PRC Treasure Hunt - PARAS REWARD | Play & Earn 50% Cashback',
    description: 'Play the exciting PRC Treasure Hunt game! Find hidden treasures on interactive maps, earn 50% cashback, compete for 100% daily bonus. Multiple difficulty levels.',
    keywords: 'treasure hunt, prc game, earn cashback, treasure game, play and earn, reward games',
  },
  marketplace: {
    title: 'Marketplace - PARAS REWARD | 5000+ Products with PRC & Cashback',
    description: 'Shop from 5000+ products using PRC coins. Get 25% cashback on purchases, flash sales, and free delivery. Redeem your earned rewards!',
    keywords: 'marketplace, shop with prc, redeem rewards, cashback shopping, reward marketplace',
  },
  blog: {
    title: 'Blog - PARAS REWARD | Guides, Tips & Updates',
    description: 'Learn how to maximize your earnings on PARAS REWARD. Read guides, tips, success stories, and latest updates about reward earning strategies.',
    keywords: 'paras reward blog, earning tips, reward guides, how to earn, success stories',
  },
  vip: {
    title: 'VIP Membership - PARAS REWARD | Unlock Premium Benefits',
    description: 'Upgrade to VIP membership for ₹1000/year. Unlock unlimited PRC validity, cash redemption, priority support, and exclusive offers.',
    keywords: 'vip membership, premium account, unlock features, paid membership, reward benefits',
  },
  referrals: {
    title: 'Referral Program - PARAS REWARD | Earn 10% Bonus Per Referral',
    description: 'Invite friends and earn 10% bonus on their earnings. Build passive income with unlimited referrals. Share your unique referral link now!',
    keywords: 'referral program, refer and earn, invite friends, referral bonus, passive income',
  },
  wallet: {
    title: 'Wallet - PARAS REWARD | Manage PRC, Cashback & Profits',
    description: 'Manage your multi-wallet system. Check PRC balance, cashback wallet, profit wallet. Withdraw to bank, track transactions, view history.',
    keywords: 'wallet, prc balance, cashback wallet, withdraw money, transaction history',
  },
  leaderboard: {
    title: 'Leaderboard - PARAS REWARD | Top Earners & Rankings',
    description: 'See the top 10 earners on PARAS REWARD. Check rankings, compare earnings, compete with other users, and aim for the top!',
    keywords: 'leaderboard, top earners, rankings, competition, top users',
  },
  about: {
    title: 'About Us - PARAS REWARD | India\'s Trusted Reward Platform',
    description: 'Learn about PARAS REWARD - India\'s first engagement-based reward platform. Our mission, vision, and how we help users earn daily rewards.',
    keywords: 'about paras reward, company info, reward platform, about us, mission vision',
  },
  contact: {
    title: 'Contact Us - PARAS REWARD | Get Support & Help',
    description: 'Need help? Contact PARAS REWARD support team. Get assistance with account, payments, technical issues, or general inquiries.',
    keywords: 'contact us, customer support, help, support team, get in touch',
  },
  howItWorks: {
    title: 'How It Works - PARAS REWARD | Complete Guide to Earning',
    description: 'Learn how PARAS REWARD works. Understand PRC mining, referrals, marketplace, games, and redemption. Step-by-step earning guide.',
    keywords: 'how it works, earning guide, how to earn, reward system, platform guide',
  },
  faq: {
    title: 'FAQ - PARAS REWARD | Frequently Asked Questions',
    description: 'Find answers to common questions about PARAS REWARD. Learn about PRC coins, VIP membership, withdrawals, KYC, and more.',
    keywords: 'faq, frequently asked questions, help, common questions, answers',
  },
};
