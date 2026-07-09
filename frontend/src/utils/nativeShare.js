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

const buildMessage = ({ link, code }) => {
  // Marketing copy approved Feb 8 2026 — highlights the full platform value
  // (PRC earning, redemption channels, Mall, referral rewards) instead of
  // just the recharge angle. Referral code appears both inline AND in the
  // register URL so the recipient can either type it or click through.
  return (
    `*PARAS REWARD - India's Trusted Reward Platform*\n\n` +
    `I'm using PARAS REWARD and really enjoying the experience.\n\n` +
    `Join me on PARAS REWARD, a smart Reward & Engagement Platform where you can:\n` +
    `✨ Collect PRC through daily activities\n` +
    `🎁 Redeem PRC for Cash Vouchers & Redeem to bank & Utility services\n` +
    `🛍️ Shop through Paras Mall\n` +
    `📈 Earn Referral Rewards by growing your network\n` +
    `🚀 Enjoy regular feature updates and new opportunities\n\n` +
    `Sign up using my referral code and we'll both receive Bonus PRC!\n\n` +
    `Referral Code: *${code}*\n` +
    `🔗 ${link}\n\n` +
    `Join today and start your reward journey with me! 💎`
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
