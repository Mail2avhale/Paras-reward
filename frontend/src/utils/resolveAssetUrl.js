/**
 * resolveAssetUrl — Normalises backend-relative asset paths into absolute URLs.
 *
 * Why this exists:
 *   In a normal web browser, an <img src="/api/static/mall/foo.jpg" /> resolves
 *   against the current origin (e.g. https://parasreward.com) and loads fine.
 *
 *   Inside the Capacitor Android app, the WebView is served from
 *   `https://localhost/` (or `capacitor://localhost/`). Relative `/api/...`
 *   paths then resolve to https://localhost/api/static/... which 404s and
 *   shows a broken image.
 *
 *   This helper rewrites any URL that starts with `/api/` (or any other
 *   absolute path beginning with `/`) so it points at the real backend
 *   defined by REACT_APP_BACKEND_URL.
 *
 * Pass-through cases (returned unchanged):
 *   - empty/null/undefined
 *   - absolute http(s) URLs
 *   - data: URIs
 *   - blob: URIs
 */
export function resolveAssetUrl(url) {
  if (!url) return url;
  if (typeof url !== 'string') return url;
  // Already absolute or in-memory
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const backend = process.env.REACT_APP_BACKEND_URL || '';
  if (!backend) return url;
  // Ensure exactly one slash join
  if (url.startsWith('/')) return backend.replace(/\/$/, '') + url;
  return backend.replace(/\/$/, '') + '/' + url;
}
