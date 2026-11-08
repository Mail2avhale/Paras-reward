import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const FULL_WIDTH_PREFIXES = ['/admin', '/manager', '/employee', '/candidate', '/partner-store', '/blog'];

// Constrains user-facing pages to a phone-like column on desktop/tablet.
export const UserShellWidth = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    const fullWidth = pathname === '/' || FULL_WIDTH_PREFIXES.some((p) => pathname.startsWith(p));
    document.body.classList.toggle('user-shell', !fullWidth);
  }, [pathname]);
  return null;
};
