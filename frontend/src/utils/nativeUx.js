/**
 * nativeUx.js
 * --------------------------------------------------------------
 * Tiny wrappers around Capacitor StatusBar + Haptics so we can
 * sprinkle native polish into the existing React UI without
 * rewriting every component.
 *
 * Safe on the web — every function is a no-op when not running
 * inside a Capacitor native shell.
 */

const isNative = () =>
  typeof window !== "undefined" &&
  !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

// ── STATUS BAR ───────────────────────────────────────────────────────────────
/**
 * Apply our brand colour to the system status bar (Android).
 * Called once at app boot.
 */
export const applyBrandedStatusBar = async () => {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    // Match the navy-purple gradient used across the app header
    await StatusBar.setBackgroundColor({ color: "#1e1b4b" });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (e) {
    /* no-op */
  }
};

// ── HAPTICS ──────────────────────────────────────────────────────────────────
let _hapticsModule = null;
const getHaptics = async () => {
  if (!isNative()) return null;
  if (_hapticsModule) return _hapticsModule;
  try {
    _hapticsModule = await import("@capacitor/haptics");
    return _hapticsModule;
  } catch {
    return null;
  }
};

/** Soft tap — for button presses, toggles, list selections. */
export const hapticTap = async () => {
  const m = await getHaptics();
  if (!m) return;
  try {
    await m.Haptics.impact({ style: m.ImpactStyle.Light });
  } catch {}
};

/** Medium impact — for primary CTAs (Submit, Pay, Confirm). */
export const hapticPrimary = async () => {
  const m = await getHaptics();
  if (!m) return;
  try {
    await m.Haptics.impact({ style: m.ImpactStyle.Medium });
  } catch {}
};

/** Success — green-light feedback (payment success, OTP verified). */
export const hapticSuccess = async () => {
  const m = await getHaptics();
  if (!m) return;
  try {
    await m.Haptics.notification({ type: m.NotificationType.Success });
  } catch {}
};

/** Warning — yellow alert. */
export const hapticWarning = async () => {
  const m = await getHaptics();
  if (!m) return;
  try {
    await m.Haptics.notification({ type: m.NotificationType.Warning });
  } catch {}
};

/** Error — red alert (validation failed, payment declined). */
export const hapticError = async () => {
  const m = await getHaptics();
  if (!m) return;
  try {
    await m.Haptics.notification({ type: m.NotificationType.Error });
  } catch {}
};

export const isNativePlatform = isNative;
