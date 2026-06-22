/**
 * nativeShare.js
 * --------------------------------------------------------------
 * Targeted WhatsApp share for referral links. Falls back to the
 * Web Share API on the browser and to a plain wa.me URL when
 * WhatsApp is not installed.
 *
 *   await shareReferralOnWhatsApp({ link, code, name })
 */
const isNative = () =>
  typeof window !== "undefined" &&
  !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

const buildMessage = ({ link, code, name }) => {
  const intro = name ? `Hey! I'm using PARAS REWARD` : `Hey! I'm using PARAS REWARD`;
  return (
    `${intro} — recharge mobile/DTH/bills and earn PRC rewards on every transaction! 💰\n\n` +
    `Sign up with my referral code *${code}* and we both get bonus PRC.\n\n` +
    `👉 ${link}`
  );
};

export const shareReferralOnWhatsApp = async ({ link, code, name }) => {
  const msg = buildMessage({ link, code, name });
  const encoded = encodeURIComponent(msg);
  const waUrl = `https://wa.me/?text=${encoded}`;

  // On native Android — try @capacitor/share with a WhatsApp hint; fall back to wa.me.
  if (isNative()) {
    try {
      // Use Capacitor Browser as a reliable opener; system will route wa.me to WA app.
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: waUrl, presentationStyle: "fullscreen" });
      return { ok: true, channel: "whatsapp" };
    } catch (_) {
      /* fall through */
    }
  }

  // Browser path 1 — try Web Share API for richer system picker.
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: "Join PARAS REWARD",
        text: msg,
        url: link,
      });
      return { ok: true, channel: "system" };
    } catch (_) {
      /* user cancelled or unsupported */
    }
  }

  // Browser path 2 — plain wa.me link in new tab.
  window.open(waUrl, "_blank", "noopener");
  return { ok: true, channel: "wa.me" };
};
