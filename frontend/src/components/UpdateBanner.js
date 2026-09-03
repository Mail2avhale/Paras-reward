/**
 * UpdateBanner — Native-only banner showing "Update Available" when
 * installed app's versionCode < latest from backend.
 *
 * - Polls /api/app/version-info on mount
 * - Force-update mode = full-screen blocking modal (no dismiss)
 * - Optional dismiss = banner remembers via localStorage for 24h
 */
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import axios from 'axios';
import { Download, X } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const DISMISS_KEY = 'paras_update_banner_dismissed_until';

export const UpdateBanner = () => {
  const [versionInfo, setVersionInfo] = useState(null);
  const [installedCode, setInstalledCode] = useState(null);
  const [installedName, setInstalledName] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const info = await App.getInfo();
        // info = { name, id, build, version }
        // Android `build` is the versionCode; iOS it's the bundle build number
        const code = parseInt(info.build, 10);
        setInstalledCode(Number.isFinite(code) ? code : 0);
        setInstalledName((info.version || '').trim());

        const res = await axios.get(`${API}/app/version-info`);
        setVersionInfo(res.data);
        // Debug tag so field reports can share the exact numbers seen.
        console.info('[UpdateBanner] installed:', info.version, '(code', info.build, ') · latest:', res.data.latest_version_name, '(code', res.data.latest_version_code, ')');

        // Honour 24h dismissal from localStorage (skipped if force_update)
        const dismissUntil = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
        if (!res.data.force_update && Date.now() < dismissUntil) setDismissed(true);
      } catch (e) {
        console.warn('[UpdateBanner] version check failed:', e?.message);
      }
    })();
  }, []);

  if (!versionInfo || installedCode === null) return null;

  // Sep 1 2026 fix: some users reported the banner still showing after
  // upgrading to the latest version. Root cause: `App.getInfo().build`
  // occasionally returns a stale value on the first cold-launch of a
  // fresh install (Capacitor plugin cache). Guard with a version-NAME
  // string match as a fallback so a matching versionName also hides
  // the banner even if the code comparison is momentarily wrong.
  const _norm = (s) => (s || '').toString().trim().replace(/^v/i, '');
  if (installedCode >= versionInfo.latest_version_code) return null;
  if (installedName && _norm(installedName) === _norm(versionInfo.latest_version_name)) return null;

  const isForce = versionInfo.force_update ||
    installedCode < versionInfo.minimum_supported_version_code;
  if (!isForce && dismissed) return null;

  const handleUpdate = async () => {
    try {
      // Open Play Store (Capacitor uses default browser for external links)
      const { Browser } = await import('@capacitor/browser').catch(() => ({ Browser: null }));
      if (Browser) {
        await Browser.open({ url: versionInfo.play_store_url });
      } else {
        window.open(versionInfo.play_store_url, '_blank');
      }
    } catch {
      window.open(versionInfo.play_store_url, '_blank');
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    setDismissed(true);
  };

  // Force-update → full-screen blocking modal
  if (isForce) {
    return (
      <div
        className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[10000] grid place-items-center p-6"
        data-testid="update-banner-force"
      >
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl max-w-sm w-full p-7 text-center shadow-2xl">
          <div className="mx-auto w-16 h-16 rounded-full bg-white/20 grid place-items-center mb-4">
            <Download className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-white text-2xl font-extrabold mb-2">Update Required</h3>
          <p className="text-white/90 text-sm mb-1">
            A new version <strong>v{versionInfo.latest_version_name}</strong> is required to continue.
          </p>
          <p className="text-white/70 text-xs mb-5">{versionInfo.release_notes}</p>
          <button
            onClick={handleUpdate}
            className="w-full bg-white text-orange-700 font-extrabold py-3 rounded-xl text-base hover:bg-amber-50 transition"
            data-testid="update-banner-force-btn"
          >
            Update Now from Play Store
          </button>
        </div>
      </div>
    );
  }

  // Soft banner — top of screen, dismissible
  return (
    <div
      className="fixed top-0 inset-x-0 z-[9999] bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-3 flex items-center gap-3 shadow-lg"
      data-testid="update-banner-soft"
    >
      <Download className="w-5 h-5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold leading-tight">Update Available</div>
        <div className="text-[11px] opacity-90 truncate">
          v{versionInfo.latest_version_name} brings new features &amp; fixes
        </div>
      </div>
      <button
        onClick={handleUpdate}
        className="bg-white text-orange-700 font-extrabold text-xs px-3 py-1.5 rounded-lg hover:bg-amber-50 flex-shrink-0"
        data-testid="update-banner-soft-btn"
      >
        UPDATE
      </button>
      <button
        onClick={handleDismiss}
        className="text-white/80 hover:text-white flex-shrink-0"
        aria-label="Dismiss"
        data-testid="update-banner-dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default UpdateBanner;
