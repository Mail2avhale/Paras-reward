/**
 * Install Referrer Capture (one-shot, native Android only)
 * ==========================================================
 *
 * Fixes the attribution gap created by MobileAppGate:
 *   Browser → MobileAppGate → Play Store (URL params lost) →
 *   Install → First app launch ← we capture the referrer HERE.
 *
 * Flow:
 *   1. MobileAppGate sends the user to Play Store with
 *      `&referrer=ref%3DABC123` appended.
 *   2. Play Store records that exact string.
 *   3. On first cold launch of the native app, we call our custom
 *      Capacitor plugin `InstallReferrer.getInstallReferrer()` which
 *      bridges the Google Play Install Referrer Library.
 *   4. We parse `ref=ABC123` out of the returned string and persist it
 *      to `localStorage.paras_ref_code` — the same key RegisterSimple
 *      already reads with its 30-day fallback logic.
 *   5. The user opens the in-app register screen → the code is pre-filled
 *      → backend `/auth/register/simple` (now case-insensitive) sets
 *      `referred_by` correctly.
 *   6. After registration succeeds, RegisterSimple clears localStorage
 *      AND calls `InstallReferrer.markConsumed()` so this never replays.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

const InstallReferrerPlugin = registerPlugin('InstallReferrer');

const REF_STORAGE_KEY = 'paras_ref_code';
const REF_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

let captureAttempted = false;

function persistRefToLocalStorage(code) {
  try {
    localStorage.setItem(
      REF_STORAGE_KEY,
      JSON.stringify({ code: code.toUpperCase(), ts: Date.now(), source: 'install_referrer', ttlMs: REF_TTL_MS })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse a referrer query string (e.g., "ref=ABC123&utm_source=whatsapp")
 * and return the `ref` value if present. Case-insensitive on key.
 */
function extractRefCode(referrer) {
  if (!referrer || typeof referrer !== 'string') return '';
  try {
    const params = new URLSearchParams(referrer);
    // Accept both `ref` and the legacy `referral_code` key
    for (const key of ['ref', 'referral_code', 'REF', 'r']) {
      const v = params.get(key);
      if (v && v.trim()) return v.trim().toUpperCase();
    }
  } catch { /* malformed input — silent */ }
  return '';
}

/**
 * One-shot install referrer capture. Safe to call multiple times: the
 * native plugin caches the Play Store response and JS short-circuits on
 * the `captureAttempted` flag for the same session.
 *
 * Returns { code, source } where source ∈ { 'install_referrer', 'cached',
 * 'consumed', 'empty', 'web', 'error' }.
 */
export async function captureInstallReferrer() {
  if (captureAttempted) return { code: '', source: 'already_attempted' };
  captureAttempted = true;

  if (!Capacitor.isNativePlatform()) {
    return { code: '', source: 'web' };
  }

  try {
    const result = await InstallReferrerPlugin.getInstallReferrer();
    if (!result?.fetched) {
      return { code: '', source: 'not_fetched' };
    }
    if (result.consumed) {
      // Already applied on a previous launch — don't overwrite localStorage.
      return { code: '', source: 'consumed' };
    }
    const code = extractRefCode(result.referrer);
    if (!code) {
      // Either the user installed organically (no &referrer=) or the
      // referrer string didn't include a ref=. Both are normal.
      return { code: '', source: 'empty' };
    }
    persistRefToLocalStorage(code);
    return { code, source: 'install_referrer' };
  } catch (e) {
    console.warn('[InstallReferrer] capture failed (non-fatal):', e);
    return { code: '', source: 'error' };
  }
}

/**
 * Called from RegisterSimple after the user successfully registers — tells
 * the native plugin that the referrer has been consumed so subsequent app
 * launches don't try to re-apply it.
 */
export async function markInstallReferrerConsumed() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await InstallReferrerPlugin.markConsumed();
  } catch (e) {
    console.warn('[InstallReferrer] markConsumed failed (non-fatal):', e);
  }
}
