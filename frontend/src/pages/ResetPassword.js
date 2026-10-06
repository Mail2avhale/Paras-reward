/**
 * ResetPassword — token-based password reset page (Sep 17 2026)
 *
 * Reached by clicking the "Reset Password" button in the email that
 * Emergent's Resend proxy sends from /api/auth/forgot-password.
 *
 * Flow:
 *   • Read ?token=xxx from URL
 *   • User enters new password + confirm
 *   • POST /api/auth/reset-password?reset_token=&new_password=
 *   • On success → redirect to /login
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Lock, CheckCircle2, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

import { API } from '../lib/api';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Guard: no token = can't reset
  useEffect(() => {
    if (!token) {
      toast.error('Missing reset token — please use the link from your email');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      // FastAPI endpoint reads reset_token + new_password as query params
      await axios.post(
        `${API}/auth/reset-password?reset_token=${encodeURIComponent(token)}&new_password=${encodeURIComponent(password)}`
      );
      setDone(true);
      toast.success('Password reset successful! Please login.');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      const d = err.response?.data?.detail;
      const msg = typeof d === 'string'
        ? d
        : (d?.message || 'Reset failed — the link may be expired or invalid');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#FFF9E6' }}>
      <div
        className="w-full max-w-md rounded-2xl p-7 shadow-lg"
        style={{ backgroundColor: '#FFFFFF', border: '1px solid #D1FAE5' }}
        data-testid="reset-password-card"
      >
        <div className="text-center mb-6">
          <div
            className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-3"
            style={{ backgroundColor: '#DBEAFE' }}
          >
            <Lock className="w-7 h-7" style={{ color: '#3B82F6' }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#14532D' }}>
            Reset Your Password
          </h1>
          <p className="text-sm mt-1" style={{ color: '#4B5563' }}>
            Choose a strong new password for your Paras Rewards account
          </p>
        </div>

        {!token && (
          <div
            className="flex items-start gap-2 rounded-lg p-3 mb-4"
            style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}
            data-testid="reset-missing-token"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#DC2626' }} />
            <div className="text-sm" style={{ color: '#991B1B' }}>
              Missing or invalid reset token. Please open the <strong>Reset Password</strong> link from the email we sent you.
            </div>
          </div>
        )}

        {done ? (
          <div className="text-center py-6" data-testid="reset-success-screen">
            <CheckCircle2 className="w-14 h-14 mx-auto mb-3" style={{ color: '#22C55E' }} />
            <h2 className="text-xl font-semibold mb-1" style={{ color: '#14532D' }}>
              Password updated!
            </h2>
            <p className="text-sm" style={{ color: '#4B5563' }}>
              Redirecting to login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!token || loading}
                  placeholder="At least 6 characters"
                  data-testid="reset-new-password-input"
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                  style={{ borderColor: '#D1FAE5', color: '#14532D' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  data-testid="reset-toggle-password-visibility"
                  className="absolute inset-y-0 right-2 flex items-center"
                  style={{ color: '#4B5563' }}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>
                Confirm Password
              </label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={!token || loading}
                placeholder="Re-enter your new password"
                data-testid="reset-confirm-password-input"
                autoComplete="new-password"
                className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                style={{ borderColor: '#D1FAE5', color: '#14532D' }}
              />
            </div>

            <button
              type="submit"
              disabled={!token || loading}
              data-testid="reset-submit-btn"
              className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: '#3B82F6', color: '#FFFFFF' }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </button>

            <div className="text-center text-sm pt-2">
              <button
                type="button"
                onClick={() => navigate('/login')}
                data-testid="reset-back-to-login"
                className="font-medium hover:underline"
                style={{ color: '#3B82F6' }}
              >
                Back to Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
