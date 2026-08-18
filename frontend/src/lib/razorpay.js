/**
 * ensureRazorpayLoaded — lazily loads the Razorpay checkout.js SDK.
 *
 * Root cause of "window.Razorpay is not a constructor" (v1.4.2 fix):
 * Only /subscription pages had a dynamic <script> tag for checkout.js.
 * Payment flows on other pages (MyServiceCharges, ServiceChargePendingBanner)
 * assumed window.Razorpay was globally available, so users landing directly
 * on those pages hit an undefined constructor.
 *
 * Usage:
 *   await ensureRazorpayLoaded();   // throws on failure
 *   const rzp = new window.Razorpay(options);
 */
const RZP_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
const LOAD_TIMEOUT_MS = 12000;
let _loadingPromise = null;

export function ensureRazorpayLoaded() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('No window (SSR)'));
  }
  if (window.Razorpay) return Promise.resolve(true);
  if (_loadingPromise) return _loadingPromise;

  _loadingPromise = new Promise((resolve, reject) => {
    let settled = false;
    // Drop any previously-injected (possibly failed) script tags so we always
    // start from a clean slate — otherwise attaching new load/error listeners
    // to a script whose error event has already fired will hang forever.
    document
      .querySelectorAll(`script[src="${RZP_SRC}"]`)
      .forEach((s) => s.parentNode && s.parentNode.removeChild(s));

    const finalize = (ok, err) => {
      if (settled) return;
      settled = true;
      if (!ok) _loadingPromise = null;
      ok ? resolve(true) : reject(err || new Error('Razorpay checkout.js failed to load'));
    };

    const script = document.createElement('script');
    script.src = RZP_SRC;
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) finalize(true);
      else finalize(false, new Error('Razorpay SDK loaded but constructor missing'));
    };
    script.onerror = () => {
      finalize(false, new Error('Razorpay checkout.js failed to load — check network / CDN'));
    };

    // Hard timeout — in some blocked-CDN cases neither onload nor onerror
    // fires (e.g. content-blockers that silently drop the request).
    setTimeout(() => {
      if (!window.Razorpay) {
        finalize(false, new Error('Razorpay checkout.js load timed out'));
      }
    }, LOAD_TIMEOUT_MS);

    document.head.appendChild(script);
  });

  return _loadingPromise;
}

export default ensureRazorpayLoaded;
