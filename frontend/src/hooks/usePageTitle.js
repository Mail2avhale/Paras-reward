import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PAGE_TITLES = {
  '/': 'PARAS REWARDS - Earn, Grow & Redeem PRC Rewards',
  '/login': 'Login - PARAS REWARDS',
  '/register': 'Sign Up - PARAS REWARDS',
  '/dashboard': 'Dashboard - PARAS REWARDS',
  '/referrals': 'Growth Network - PARAS REWARDS',
  '/subscription': 'Subscription Plans - PARAS REWARDS',
  '/profile': 'Profile - PARAS REWARDS',
  '/bank-redeem': 'Redeem to Bank - PARAS REWARDS',
  '/kyc': 'KYC Verification - PARAS REWARDS',
  '/support': 'Support - PARAS REWARDS',
  '/notifications': 'Notifications - PARAS REWARDS',
  '/network-feed': 'Network Feed - PARAS REWARDS',
  '/messages': 'Messages - PARAS REWARDS',
  '/my-invoices': 'My Invoices - PARAS REWARDS',
  '/how-it-works': 'How It Works - PARAS REWARDS',
  '/faq': 'FAQ - PARAS REWARDS',
  '/blog': 'Blog - PARAS REWARDS',
  '/terms': 'Terms & Conditions - PARAS REWARDS',
  '/privacy': 'Privacy Policy - PARAS REWARDS',
  '/disclaimer': 'Disclaimer - PARAS REWARDS',
  '/refund-policy': 'Refund Policy - PARAS REWARDS',
  '/about-us': 'About Us - PARAS REWARDS',
  '/contact-us': 'Contact Us - PARAS REWARDS',
  '/forgot-pin': 'Forgot PIN - PARAS REWARDS',
  '/admin': 'Admin Dashboard - PARAS REWARDS',
};

const DEFAULT_TITLE = 'PARAS REWARDS - Earn, Grow & Redeem PRC Rewards';

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
