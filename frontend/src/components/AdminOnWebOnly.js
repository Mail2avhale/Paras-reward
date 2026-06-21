/**
 * AdminOnWebOnly.js
 * --------------------------------------------------------------
 * Shown when an admin URL is accessed in the USER-only Android
 * build (Play Store AAB). Auto-opens the same URL in an external
 * browser (Chrome Custom Tab on Android via @capacitor/browser)
 * and redirects the in-app screen to /dashboard.
 *
 * Why: Admin pages are excluded from the AAB to keep app size
 * small (~60% reduction). Admins can still access admin panel
 * by tapping "Open in Browser" → loads the full web app.
 */
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ExternalLink, ShieldCheck } from "lucide-react";

const PROD_WEB_URL = "https://parasreward.com";

const isCapacitorNative = () =>
  typeof window !== "undefined" &&
  !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

export default function AdminOnWebOnly() {
  const navigate = useNavigate();
  const location = useLocation();
  const adminUrl = `${PROD_WEB_URL}${location.pathname}${location.search}`;

  const openInBrowser = async () => {
    try {
      if (isCapacitorNative()) {
        const mod = await import("@capacitor/browser");
        await mod.Browser.open({ url: adminUrl, presentationStyle: "fullscreen" });
      } else {
        window.open(adminUrl, "_blank");
      }
    } catch (e) {
      window.location.href = adminUrl;
    }
  };

  // Auto-open browser once on mount
  useEffect(() => {
    openInBrowser();
  }, []); // eslint-disable-line

  return (
    <div
      data-testid="admin-on-web-only"
      className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900"
    >
      <div className="max-w-md w-full bg-slate-800/60 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center ring-2 ring-blue-400/40">
          <ShieldCheck className="w-8 h-8 text-blue-300" strokeWidth={1.8} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Admin Panel</h1>
        <p className="text-sm text-blue-100/80 mb-6 leading-relaxed">
          Admin pages are only available in the web browser for security and a richer
          desktop experience. Tap below to open it.
        </p>
        <button
          data-testid="admin-open-browser-btn"
          onClick={openInBrowser}
          className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-400 text-slate-900 font-semibold px-5 py-3 rounded-xl hover:brightness-110 transition active:scale-[0.98]"
        >
          <ExternalLink className="w-4 h-4" />
          Open Admin Panel in Browser
        </button>
        <button
          data-testid="admin-go-dashboard-btn"
          onClick={() => navigate("/dashboard")}
          className="mt-3 w-full text-blue-200/80 hover:text-white text-sm py-2 transition"
        >
          ← Back to Dashboard
        </button>
        <p className="mt-5 text-[11px] text-blue-200/40 break-all">{adminUrl}</p>
      </div>
    </div>
  );
}
