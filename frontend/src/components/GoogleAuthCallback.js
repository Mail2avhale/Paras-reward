import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API } from '../lib/api';
import { getDeviceIdentitySync } from '@/utils/deviceIdentity';

const roleRoute = (role) => (role === 'partner_store' ? '/partner-store/dashboard' : '/dashboard');

// Exchanges the Emergent Google session_id (URL fragment) for the app's normal login payload.
export const GoogleAuthCallback = ({ onLogin }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const sessionId = new URLSearchParams(location.hash.replace(/^#/, '')).get('session_id');
    window.history.replaceState(null, '', location.pathname + location.search);

    (async () => {
      try {
        const { data } = await axios.post(`${API}/auth/google/session`, {
          session_id: sessionId,
          device_id: getDeviceIdentitySync()?.device_id,
        });
        if (data.status === 'register_required') {
          toast.info('No account found for this Google email. Complete sign up to continue.');
          navigate('/register', { replace: true, state: { googleProfile: { name: data.name, email: data.email } } });
          return;
        }
        await onLogin(data);
        toast.success(`Welcome back, ${data.name || 'there'}!`);
        navigate(roleRoute(data.role), { replace: true });
      } catch (err) {
        toast.error(err?.response?.data?.detail || 'Google sign-in failed. Please try again.');
        navigate('/login', { replace: true });
      }
    })();
  }, [location, navigate, onLogin]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--pr-ivory)' }} data-testid="google-auth-callback">
      <div className="flex flex-col items-center gap-3">
        <span className="h-8 w-8 rounded-full border-[3px] border-[#246BCE] border-t-transparent animate-spin" />
        <p className="text-sm font-medium" style={{ color: 'var(--pr-ink)' }}>Signing you in with Google…</p>
      </div>
    </div>
  );
};

export default GoogleAuthCallback;
