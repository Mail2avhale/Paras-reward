/**
 * nativeBiometric.js
 * --------------------------------------------------------------
 * Wrapper around @aparajita/capacitor-biometric-auth + @capacitor/preferences
 * to provide native fingerprint / face unlock on Android (and iOS).
 *
 * Strategy:
 *   1. After a successful PIN login, ask the user "Enable Fingerprint?".
 *   2. If yes -> store (identifier, pin) in Capacitor Preferences
 *      (sandboxed per-app + signed by the app's keystore on Android).
 *   3. On next app launch / login screen, if biometric is enabled:
 *        a. Show a "Tap to unlock with fingerprint" button.
 *        b. On tap -> native biometric prompt.
 *        c. On success -> retrieve (identifier, pin) and submit to /auth/login.
 *   4. If hardware not available (older phones, no fingerprint sensor):
 *        - checkBiometry() returns isAvailable=false  -> UI hides the option
 *          and the user logs in normally with PIN (no UX change).
 *   5. Optional fallback: allowDeviceCredential=true lets users authenticate
 *      with their phone's PIN/pattern/password when fingerprint fails.
 *
 * Web browser path: this file is a no-op on non-native platforms. The
 * existing WebAuthn-based flow in `biometricAuth.js` handles browsers.
 */

const BIOMETRIC_STORE_KEY = "paras_biometric_session_v1";
const BIOMETRIC_ENABLED_KEY = "paras_biometric_enabled_v1";

// ── Capacitor detection helper ───────────────────────────────────────────────
const isCapacitorNative = () =>
  typeof window !== "undefined" &&
  !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

// Lazy-load native plugins ONLY when running inside Capacitor.
// (Importing them on the web is a no-op but adds bytes to the web bundle.)
const loadPlugins = async () => {
  if (!isCapacitorNative()) return null;
  const [{ BiometricAuth, BiometryError }, { Preferences }] = await Promise.all([
    import("@aparajita/capacitor-biometric-auth"),
    import("@capacitor/preferences"),
  ]);
  return { BiometricAuth, BiometryError, Preferences };
};

/**
 * Returns availability info from the plugin.
 * Shape: { isAvailable: boolean, biometryType: "fingerprint"|"face"|...|"none", reason?: string }
 */
export const checkNativeBiometric = async () => {
  if (!isCapacitorNative()) {
    return { isAvailable: false, biometryType: "none", reason: "not-capacitor" };
  }
  try {
    const plugins = await loadPlugins();
    if (!plugins) return { isAvailable: false, biometryType: "none" };
    const result = await plugins.BiometricAuth.checkBiometry();
    return {
      isAvailable: !!result.isAvailable,
      biometryType: result.biometryType ?? "unknown",
      strongAvailable: !!result.strongBiometryIsAvailable,
      reason: result.reason ?? "",
      code: result.code ?? "",
    };
  } catch (e) {
    return { isAvailable: false, biometryType: "none", reason: e?.message || "unknown" };
  }
};

/** Has the user already enabled native biometric on this device? */
export const isNativeBiometricEnabled = async () => {
  if (!isCapacitorNative()) return false;
  try {
    const plugins = await loadPlugins();
    if (!plugins) return false;
    const { value } = await plugins.Preferences.get({ key: BIOMETRIC_ENABLED_KEY });
    return value === "true";
  } catch {
    return false;
  }
};

/**
 * Prompt user with biometric auth and, on success, persist (identifier, pin).
 * Returns true if enrollment succeeded.
 */
export const enableNativeBiometric = async ({ identifier, pin }) => {
  if (!isCapacitorNative()) return { success: false, reason: "not-capacitor" };
  if (!identifier || !pin) return { success: false, reason: "missing-credentials" };

  const plugins = await loadPlugins();
  if (!plugins) return { success: false, reason: "no-plugins" };

  // Step 1 - verify hardware
  const avail = await checkNativeBiometric();
  if (!avail.isAvailable) {
    return { success: false, reason: avail.reason || "not-available" };
  }

  // Step 2 - prompt biometric so the user confirms ownership of the device
  try {
    await plugins.BiometricAuth.authenticate({
      reason: "Enable fingerprint to sign in faster next time",
      cancelTitle: "Cancel",
      allowDeviceCredential: true,
      iosFallbackTitle: "Use Passcode",
      androidTitle: "PARAS REWARD",
      androidSubtitle: "Enable Fingerprint Login",
      androidConfirmationRequired: false,
    });
  } catch (e) {
    return { success: false, reason: e?.message || "auth-cancelled", code: e?.code };
  }

  // Step 3 - persist credentials in app-sandboxed storage
  try {
    await plugins.Preferences.set({
      key: BIOMETRIC_STORE_KEY,
      value: JSON.stringify({ identifier, pin, t: Date.now() }),
    });
    await plugins.Preferences.set({ key: BIOMETRIC_ENABLED_KEY, value: "true" });
    return { success: true };
  } catch (e) {
    return { success: false, reason: e?.message || "storage-failed" };
  }
};

/**
 * Prompt biometric and return stored (identifier, pin) for auto-login.
 * Caller submits these to the existing /api/auth/login endpoint.
 */
export const nativeBiometricLogin = async () => {
  if (!isCapacitorNative()) return { success: false, reason: "not-capacitor" };

  const plugins = await loadPlugins();
  if (!plugins) return { success: false, reason: "no-plugins" };

  const enabled = await isNativeBiometricEnabled();
  if (!enabled) return { success: false, reason: "not-enabled" };

  try {
    await plugins.BiometricAuth.authenticate({
      reason: "Sign in to PARAS REWARD",
      cancelTitle: "Use PIN instead",
      allowDeviceCredential: true,
      iosFallbackTitle: "Use Passcode",
      androidTitle: "PARAS REWARD",
      androidSubtitle: "Sign in with Fingerprint",
      androidConfirmationRequired: false,
    });
  } catch (e) {
    return { success: false, reason: e?.message || "auth-failed", code: e?.code };
  }

  try {
    const { value } = await plugins.Preferences.get({ key: BIOMETRIC_STORE_KEY });
    if (!value) return { success: false, reason: "no-stored-session" };
    const parsed = JSON.parse(value);
    if (!parsed.identifier || !parsed.pin) return { success: false, reason: "corrupt-session" };
    return { success: true, identifier: parsed.identifier, pin: parsed.pin };
  } catch (e) {
    return { success: false, reason: e?.message || "storage-read-failed" };
  }
};

/** Remove all stored biometric credentials (e.g. on logout or "Disable Fingerprint"). */
export const disableNativeBiometric = async () => {
  if (!isCapacitorNative()) return { success: true };
  try {
    const plugins = await loadPlugins();
    if (!plugins) return { success: true };
    await plugins.Preferences.remove({ key: BIOMETRIC_STORE_KEY });
    await plugins.Preferences.remove({ key: BIOMETRIC_ENABLED_KEY });
    return { success: true };
  } catch (e) {
    return { success: false, reason: e?.message || "unknown" };
  }
};

/**
 * Pretty label for the biometric type — used to render the button.
 *   "fingerprint" -> "Fingerprint"
 *   "face"        -> "Face Unlock"
 *   default       -> "Biometric"
 */
export const formatBiometryType = (type) => {
  if (!type) return "Biometric";
  if (type.toLowerCase().includes("face")) return "Face Unlock";
  if (type.toLowerCase().includes("finger")) return "Fingerprint";
  if (type.toLowerCase().includes("iris")) return "Iris Scan";
  return "Biometric";
};

export const isCapacitor = isCapacitorNative;
