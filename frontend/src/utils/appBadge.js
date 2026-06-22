/**
 * appBadge.js
 * --------------------------------------------------------------
 * Manages the launcher icon notification badge on Android.
 *
 *   await syncAppBadgeFromBackend(userId)
 *      // fetches /notifications/user/{uid}/unread-count and sets badge
 *
 *   await setAppBadge(count)   // direct set
 *   await clearAppBadge()      // remove
 *
 * No-op on web. Some launchers (Pixel, Nova) ignore badges — that's OK.
 */
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const isNative = () =>
  typeof window !== "undefined" &&
  !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

const getPlugin = async () => {
  if (!isNative()) return null;
  try {
    const mod = await import("@capawesome/capacitor-badge");
    return mod.Badge;
  } catch {
    return null;
  }
};

export const setAppBadge = async (count) => {
  const Badge = await getPlugin();
  if (!Badge) return;
  try {
    const n = Math.max(0, Math.min(99, Number(count) || 0));
    if (n === 0) await Badge.clear();
    else await Badge.set({ count: n });
  } catch {}
};

export const clearAppBadge = async () => {
  const Badge = await getPlugin();
  if (!Badge) return;
  try { await Badge.clear(); } catch {}
};

export const syncAppBadgeFromBackend = async (userId) => {
  if (!isNative() || !userId) return;
  try {
    const { data } = await axios.get(`${API}/notifications/${userId}/unread-count`);
    const count = Number(data?.unread_count || 0);
    await setAppBadge(count);
  } catch {
    /* silent — best effort */
  }
};
