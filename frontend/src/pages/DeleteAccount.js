/**
 * DeleteAccount.js — public-facing account deletion request page.
 *
 * Reachable WITHOUT login (Google Play Store policy requires this).
 * Mounted at /delete-account in App.js.
 *
 * UX:
 *   • Big "Delete personal information & data" hero
 *   • Form: mobile (10-digit) + email + optional reason
 *   • 4 warning bullets (locked accounts, permanence, confirm, contact)
 *   • POST → /api/account/deletion-request → success card with request_id
 */
import { useState } from "react";
import axios from "axios";
import {
  Trash2, Phone, Mail, Send, ShieldAlert, CheckCircle2, Loader2,
  CreditCard, AlertOctagon, MessageCircle
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SUPPORT_EMAIL = "info@parasreward.com";

const Warning = ({ icon: Icon, title, body }) => (
  <li className="flex gap-3 items-start">
    <span className="shrink-0 w-9 h-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
      <Icon className="w-4 h-4" />
    </span>
    <div>
      <p className="text-sm font-semibold text-slate-800 leading-snug">{title}</p>
      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{body}</p>
    </div>
  </li>
);

export default function DeleteAccount() {
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API}/account/deletion-request`, {
        mobile: mobile.trim(),
        email: email.trim(),
        reason: reason.trim(),
      });
      setResult(data);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not submit. Please try again or email us.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success state ────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 flex items-center justify-center px-4 py-10">
        <div
          data-testid="delete-account-success"
          className="w-full max-w-md bg-white rounded-3xl shadow-xl ring-1 ring-slate-200 p-7 text-center"
        >
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Request received</h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            {result.message ||
              "We'll process your deletion request within 30 days and email you once it's complete."}
          </p>
          {result.request_id && (
            <p className="mt-4 text-xs text-slate-400">
              Reference ID: <span className="font-mono break-all text-slate-600">{result.request_id}</span>
            </p>
          )}
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=PARAS%20REWARD%20Account%20Deletion%20Follow-up&body=Reference%20ID%3A%20${result.request_id || ""}`}
            className="mt-6 inline-flex items-center gap-2 text-sm text-fuchsia-600 hover:text-fuchsia-700 font-semibold"
          >
            <Mail className="w-4 h-4" /> Email Support
          </a>
        </div>
      </div>
    );
  }

  // ── Form state ───────────────────────────────────────────────────────────
  return (
    <div
      data-testid="delete-account-page"
      className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-4 py-10"
    >
      <div className="max-w-md mx-auto">
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white items-center justify-center mb-2 shadow-lg">
            <Trash2 className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Delete Account & Data
          </h1>
          <p className="text-sm text-slate-500 mt-1">PARAS REWARD</p>
        </div>

        {/* Form card */}
        <form
          onSubmit={submit}
          className="bg-white rounded-3xl shadow-xl ring-1 ring-slate-200 p-6 space-y-4"
        >
          <p className="text-sm font-semibold text-slate-700">
            Delete personal information &amp; data
          </p>

          {/* Mobile */}
          <label className="block">
            <span className="text-xs text-slate-500 font-medium">Mobile number</span>
            <div className="mt-1 flex rounded-xl ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-fuchsia-500 transition overflow-hidden">
              <span className="bg-slate-50 text-slate-500 px-3 inline-flex items-center text-sm border-r border-slate-200">
                <Phone className="w-4 h-4 mr-1" /> +91
              </span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                placeholder="10-digit mobile"
                className="flex-1 px-3 py-2.5 text-sm outline-none"
                data-testid="delete-mobile-input"
                required
              />
            </div>
          </label>

          {/* Email */}
          <label className="block">
            <span className="text-xs text-slate-500 font-medium">Email</span>
            <div className="mt-1 flex rounded-xl ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-fuchsia-500 transition overflow-hidden">
              <span className="bg-slate-50 text-slate-500 px-3 inline-flex items-center text-sm border-r border-slate-200">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 px-3 py-2.5 text-sm outline-none"
                data-testid="delete-email-input"
                required
              />
            </div>
          </label>

          {/* Reason (optional) */}
          <label className="block">
            <span className="text-xs text-slate-500 font-medium">Reason (optional)</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={600}
              rows={3}
              placeholder="Tell us briefly why you're leaving"
              className="mt-1 w-full rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-fuchsia-500 outline-none text-sm px-3 py-2.5 resize-none"
              data-testid="delete-reason-input"
            />
          </label>

          {error && (
            <p
              data-testid="delete-error"
              className="text-xs text-rose-600 bg-rose-50 ring-1 ring-rose-100 rounded-lg px-3 py-2"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            data-testid="delete-submit-btn"
            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-fuchsia-600 to-purple-600 disabled:from-slate-300 disabled:to-slate-300 text-white font-semibold rounded-xl py-3 hover:brightness-110 transition active:scale-[0.98]"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
            ) : (
              <><Send className="w-4 h-4" /> Submit Request</>
            )}
          </button>
        </form>

        {/* Warnings */}
        <div className="mt-6 bg-white rounded-3xl shadow-xl ring-1 ring-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            <h2 className="text-base font-bold text-slate-900">
              Account deletion warning
            </h2>
          </div>
          <ul className="space-y-4">
            <Warning
              icon={CreditCard}
              title="1. Outstanding balances block deletion"
              body="Users with pending withdrawals, refunds, or unsettled PRC cannot delete their account until those are resolved."
            />
            <Warning
              icon={AlertOctagon}
              title="2. Deletion is permanent"
              body="All your data, PRC balance, mining sessions, referrals, mall bookings, and rewards will be permanently lost."
            />
            <Warning
              icon={ShieldAlert}
              title="3. Please confirm carefully"
              body="Once deactivated, we cannot restore your account or provide any previous services."
            />
            <Warning
              icon={MessageCircle}
              title="4. Need help?"
              body={
                <>
                  Email{" "}
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="text-fuchsia-600 underline font-medium"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </>
              }
            />
          </ul>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-400 mt-6 leading-relaxed">
          PARAS REWARD will process verified requests within 30 days. <br />
          Data Safety form compliant — Google Play.
        </p>
      </div>
    </div>
  );
}
