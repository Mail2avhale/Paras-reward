import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PAGE_TITLES = {
  '/': 'PARAS REWARD - Earn, Grow & Redeem PRC Rewards',
  '/login': 'Login - PARAS REWARD',
  '/register': 'Sign Up - PARAS REWARD',
  '/dashboard': 'Dashboard - PARAS REWARD',
  '/referrals': 'Growth Network - PARAS REWARD',
  '/subscription': 'Subscription Plans - PARAS REWARD',
  '/profile': 'Profile - PARAS REWARD',
  '/bank-redeem': 'Redeem to Bank - PARAS REWARD',
  '/kyc': 'KYC Verification - PARAS REWARD',
  '/support': 'Support - PARAS REWARD',
  '/notifications': 'Notifications - PARAS REWARD',
  '/network-feed': 'Network Feed - PARAS REWARD',
  '/messages': 'Messages - PARAS REWARD',
  '/my-invoices': 'My Invoices - PARAS REWARD',
  '/how-it-works': 'How It Works - PARAS REWARD',
  '/faq': 'FAQ - PARAS REWARD',
  '/blog': 'Blog - PARAS REWARD',
  '/terms': 'Terms & Conditions - PARAS REWARD',
  '/privacy': 'Privacy Policy - PARAS REWARD',
  '/disclaimer': 'Disclaimer - PARAS REWARD',
  '/refund-policy': 'Refund Policy - PARAS REWARD',
  '/about-us': 'About Us - PARAS REWARD',
  '/contact-us': 'Contact Us - PARAS REWARD',
  '/forgot-pin': 'Forgot PIN - PARAS REWARD',
  '/admin': 'Admin Dashboard - PARAS REWARD',
};

const DEFAULT_TITLE = 'PARAS REWARD - Earn, Grow & Redeem PRC Rewards';

export function usePageTitle() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const title = PAGE_TITLES[path] || DEFAULT_TITLE;
    document.title = title;
  }, [location.pathname]);
}

export function PageTitleUpdater() {
  usePageTitle();
  return null;
}
