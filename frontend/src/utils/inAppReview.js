/**
 * inAppReview.js
 * --------------------------------------------------------------
 * Native Play Store In-App-Review prompt (Capacitor only).
 *
 * Trigger rules (called by app code):
 *   • After a successful PRC subscription purchase
 *   • After a successful Mall product booking
 *
 * Throttling:
 *   • Once per user per 90 days (localStorage timestamp)
 *   • Never within first 24h of installation (avoid annoying new users)
 *
 *   import { maybePromptReview } from "@/utils/inAppReview";
 *   maybePromptReview("subscription"); // or "mall_booking"
 */
const PROMPT_KEY = "paras_inapp_review_last_ts";
const INSTALL_KEY = "paras_install_ts";
const MIN_HOURS_SINCE_INSTALL = 24;
const COOLDOWN_DAYS = 90;

const isNative = () =>
  typeof window !== "undefined" &&
  !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

const ensureInstallStamp = () => {
  if (!localStorage.getItem(INSTALL_KEY)) {
    localStorage.setItem(INSTALL_KEY, Date.now().toString());
  }
};

const eligible = () => {
  ensureInstallStamp();
  const installed = parseInt(localStorage.getItem(INSTALL_KEY) || "0", 10);
  const hoursSinceInstall = (Date.now() - installed) / 36e5;
  if (hoursSinceInstall < MIN_HOURS_SINCE_INSTALL) return false;
  const last = parseInt(localStorage.getItem(PROMPT_KEY) || "0", 10);
  if (!last) return true;
  const daysSince = (Date.now() - last) / 864e5;
  return daysSince >= COOLDOWN_DAYS;
};

/**
 * Try to display the native review dialog.
 * `trigger` is used only for analytics labels (caller decides).
 */
export const maybePromptReview = async (trigger = "generic") => {
  if (!isNative()) return { shown: false, reason: "not-native" };
  if (!eligible()) return { shown: false, reason: "throttled" };

  try {
    const mod = await import("@capacitor-community/in-app-review");
    await mod.InAppReview.requestReview();
    localStorage.setItem(PROMPT_KEY, Date.now().toString());
    return { shown: true, trigger };
  } catch (e) {
    return { shown: false, reason: e?.message || "failed" };
  }
};

/** Force the prompt (debug / admin override). */
export const forceReviewPrompt = async () => {
  if (!isNative()) return false;
  try {
    const mod = await import("@capacitor-community/in-app-review");
    await mod.InAppReview.requestReview();
    localStorage.setItem(PROMPT_KEY, Date.now().toString());
    return true;
  } catch {
    return false;
  }
};
