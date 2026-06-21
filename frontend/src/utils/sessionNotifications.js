/**
 * sessionNotifications.js
 * --------------------------------------------------------------
 * Schedules a LOCAL notification 5 min before the JWT session
 * expires so the user can re-authenticate (biometric or PIN)
 * without surprise logouts in the middle of a flow.
 *
 *   await scheduleSessionExpiryWarning(expiresInSeconds)
 *      // expiresInSeconds comes from /auth/login response (e.g. 3600)
 *
 *   await cancelSessionExpiryWarning()   // on logout / refresh
 *
 * Safe no-op on web (browser doesn't have native local notifs).
 */

const SESSION_NOTIF_ID = 1001;
const WARNING_BEFORE_SECONDS = 5 * 60; // 5 minutes
const MIN_TOTAL_LIFETIME_SECONDS = 6 * 60; // ignore very short tokens

const isNative = () =>
  typeof window !== "undefined" &&
  !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

const loadPlugin = async () => {
  if (!isNative()) return null;
  try {
    const mod = await import("@capacitor/local-notifications");
    return mod.LocalNotifications;
  } catch {
    return null;
  }
};

/** Ask user for notification permission once. Returns true if granted. */
export const ensureNotificationPermission = async () => {
  const LN = await loadPlugin();
  if (!LN) return false;
  try {
    const perm = await LN.checkPermissions();
    if (perm.display === "granted") return true;
    if (perm.display === "denied") return false;
    const req = await LN.requestPermissions();
    return req.display === "granted";
  } catch {
    return false;
  }
};

/**
 * Schedule a "session about to expire" local notification.
 * @param expiresInSeconds  Token lifetime from /auth/login response.
 */
export const scheduleSessionExpiryWarning = async (expiresInSeconds) => {
  const LN = await loadPlugin();
  if (!LN) return { scheduled: false, reason: "not-native" };
  if (!expiresInSeconds || expiresInSeconds < MIN_TOTAL_LIFETIME_SECONDS) {
    return { scheduled: false, reason: "lifetime-too-short" };
  }
  const allowed = await ensureNotificationPermission();
  if (!allowed) return { scheduled: false, reason: "permission-denied" };

  // Cancel any stale warning first (e.g. previous login)
  try {
    await LN.cancel({ notifications: [{ id: SESSION_NOTIF_ID }] });
  } catch (_) {}

  const fireAtMs = Date.now() + (expiresInSeconds - WARNING_BEFORE_SECONDS) * 1000;
  try {
    await LN.schedule({
      notifications: [
        {
          id: SESSION_NOTIF_ID,
          title: "Session expiring soon",
          body: "Your PARAS REWARD session expires in 5 minutes. Tap to re-authenticate.",
          schedule: { at: new Date(fireAtMs), allowWhileIdle: true },
          smallIcon: "ic_launcher",
          // Channel id reused across calls — Android groups them automatically.
          channelId: "session-warnings",
          extra: { type: "session-expiry", scheduledAt: Date.now() },
        },
      ],
    });
    return { scheduled: true, fireAt: fireAtMs };
  } catch (e) {
    return { scheduled: false, reason: e?.message || "schedule-failed" };
  }
};

/** Cancel the scheduled session warning (call on logout or token refresh). */
export const cancelSessionExpiryWarning = async () => {
  const LN = await loadPlugin();
  if (!LN) return;
  try {
    await LN.cancel({ notifications: [{ id: SESSION_NOTIF_ID }] });
  } catch (_) {}
};

/**
 * Optional: register the Android notification channel up-front so the
 * notification has a proper category in system settings.
 */
export const ensureSessionChannel = async () => {
  const LN = await loadPlugin();
  if (!LN) return;
  try {
    await LN.createChannel({
      id: "session-warnings",
      name: "Session Warnings",
      description: "Alerts when your sign-in is about to expire",
      importance: 4, // HIGH
      visibility: 1, // PUBLIC
      sound: undefined,
      lights: true,
      vibration: true,
    });
  } catch (_) {}
};
