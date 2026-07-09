/**
 * ChangeDevice.js  (Feb 8 2026)
 * ────────────────────────────────────────────────────────────────
 * Self-service "Change Device" page for users whose account is bound
 * to an old device (broken/lost/sold) and are now blocked from logging
 * in on a new one.
 *
 * Flow (admin-approval — no SMS gateway required):
 *   1. User enters their registered mobile/email/UID.
 *   2. User provides old device model + reason.
 *   3. Form POSTs to /api/device-binding/change-device/request.
 *   4. A ticket lands in the admin dashboard; admin approves within 24h.
 *   5. User gets an in-app notification when approved; then they can log
 *      in on their new device — the binding is created automatically on
 *      first login.
 *
 * This page is PUBLIC — no auth required (whole point is the user cannot
 * log in yet). Accessible from a link on the login page.
 */
import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Smartphone, ShieldAlert, CheckCircle2, Send } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { API } from '../lib/api';

const REASON_OPTIONS = [
  { value: 'lost',    label: 'Old phone lost' },
  { value: 'broken',  label: 'Old phone broken / not working' },
  { value: 'sold',    label: 'Old phone sold / gifted' },
  { value: 'upgrade', label: 'Upgraded to a new phone' },
  { value: 'other',   label: 'Other (specify below)' },
];

const ChangeDevice = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    identifier: '',
    old_device_model: '',
    reason: 'lost',
    contact_notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null); // request_id after success

  const update = (k) => (e) => setForm({ ...form, [k]: e.target?.value ?? e });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.identifier.trim()) {
      toast.error('Enter your registered mobile / email / user ID');
      return;
    }
    setSubmitting(true);
    try {
      const r = await axios.post(`${API}/device-binding/change-device/request`, {
        identifier: form.identifier.trim(),
        old_device_model: form.old_device_model.trim() || null,
        reason: form.reason,
        contact_notes: form.contact_notes.trim() || null,
      });
      setSubmitted(r.data?.request_id || 'submitted');
      toast.success('Request submitted!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 bg-white/10 backdrop-blur-md border-white/20 text-white">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-9 h-9 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">Request Submitted!</h2>
            <p className="text-sm text-white/80 mb-3">
              Our team will review and approve your device change request
              <b> within 24 hours</b>.
            </p>
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 w-full text-left text-[13px] my-3">
              <p className="text-white/70 mb-1">Reference ID:</p>
              <p className="font-mono text-emerald-300 text-xs break-all">{submitted}</p>
            </div>
            <p className="text-[13px] text-white/70 mb-4">
              You&apos;ll get an in-app notification once approved. After that,
              simply log in on your new phone — the device will be bound
              automatically.
            </p>
            <Button
              onClick={() => navigate('/login')}
              data-testid="change-device-back-to-login-btn"
              className="w-full bg-indigo-500 hover:bg-indigo-600"
            >
              Back to Login
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-6 px-4">
      <div className="max-w-md mx-auto">
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 text-white/80 hover:text-white mb-5"
          data-testid="change-device-back-btn"
        >
          <ArrowLeft className="w-5 h-5" /> Back to Login
        </button>

        <Card className="p-6 bg-white/10 backdrop-blur-md border-white/20 text-white">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <Smartphone className="w-7 h-7 text-indigo-300" />
            </div>
            <div>
              <h1 className="text-lg font-bold" data-testid="change-device-title">
                Change Device
              </h1>
              <p className="text-[12px] text-white/70">
                Locked out because you switched phones? Request unlock here.
              </p>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[12px] text-amber-100">
              Your account is bound to one device for security. Submit this
              form and our team will manually verify + unlock your account
              within 24 hours.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4" data-testid="change-device-form">
            <div>
              <Label className="text-white/80 text-[13px] mb-1 block">
                Registered Mobile / Email / User ID *
              </Label>
              <Input
                data-testid="change-device-identifier-input"
                value={form.identifier}
                onChange={update('identifier')}
                placeholder="e.g. 9970100782 or you@example.com"
                required
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
              />
            </div>

            <div>
              <Label className="text-white/80 text-[13px] mb-1 block">
                Old Device Model (optional)
              </Label>
              <Input
                data-testid="change-device-old-model-input"
                value={form.old_device_model}
                onChange={update('old_device_model')}
                placeholder="e.g. Redmi Note 12 / Samsung M14"
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
              />
            </div>

            <div>
              <Label className="text-white/80 text-[13px] mb-1 block">
                Reason *
              </Label>
              <select
                data-testid="change-device-reason-select"
                value={form.reason}
                onChange={update('reason')}
                className="w-full h-10 rounded-md bg-white/5 border border-white/20 text-white px-3 text-sm"
              >
                {REASON_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value} className="bg-slate-800">
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-white/80 text-[13px] mb-1 block">
                Additional Notes for Admin (optional)
              </Label>
              <textarea
                data-testid="change-device-notes-input"
                value={form.contact_notes}
                onChange={update('contact_notes')}
                placeholder="e.g. Please call me on WhatsApp: 987654XXXX"
                rows={3}
                className="w-full rounded-md bg-white/5 border border-white/20 text-white p-3 text-sm placeholder:text-white/40"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              data-testid="change-device-submit-btn"
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
            >
              <Send className="w-4 h-4 mr-2" />
              {submitting ? 'Submitting…' : 'Submit Request'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default ChangeDevice;
