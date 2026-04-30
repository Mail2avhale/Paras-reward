/**
 * WebVitalsReporter — silent, fire-and-forget Web Vitals collector.
 *
 * Captures Core Web Vitals (LCP, INP, CLS) plus FCP and TTFB from real users
 * and ships them to the backend via `navigator.sendBeacon` (zero-impact on
 * page-unload). Aggregated server-side and viewed at /admin/web-vitals.
 *
 * Why these 3 main metrics?
 *   - LCP (Largest Contentful Paint)  — perceived load speed.
 *   - INP (Interaction to Next Paint) — responsiveness (replaced FID in 2024).
 *   - CLS (Cumulative Layout Shift)   — visual stability.
 * These are the 3 "Core Web Vitals" Google uses for SEO ranking.
 */
import { useEffect } from 'react';

const REPORT_PATH = '/api/metrics/web-vitals';
const PAGE_LOAD_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let reportedThisSession = false;

function rating(name, value) {
  // Standard Google thresholds (good / needs-improvement / poor).
  switch (name) {
    case 'LCP': return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
    case 'INP': return value <= 200  ? 'good' : value <= 500  ? 'needs-improvement' : 'poor';
    case 'CLS': return value <= 0.1  ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
    case 'FCP': return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
    case 'TTFB': return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor';
    default: return 'unknown';
  }
}

function send(metric, userMeta = {}) {
  if (!metric || typeof metric.value !== 'number') return;
  const url = `${process.env.REACT_APP_BACKEND_URL || ''}${REPORT_PATH}`;
  const payload = {
    name: metric.name,
    value: metric.value,
    rating: rating(metric.name, metric.value),
    delta: metric.delta,
    page_load_id: PAGE_LOAD_ID,
    path: typeof window !== 'undefined' ? window.location.pathname : '',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    connection_effective_type:
      typeof navigator !== 'undefined' && navigator.connection
        ? navigator.connection.effectiveType
        : null,
    timestamp: new Date().toISOString(),
    ...userMeta,
  };

  try {
    const data = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([data], { type: 'application/json' });
      const ok = navigator.sendBeacon(url, blob);
      if (ok) return;
    }
    // Fallback to fetch (keepalive lets it survive the unload).
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data,
      keepalive: true,
    }).catch(() => {});
  } catch (e) {
    // Silently swallow — Web Vitals reporting must never affect UX.
  }
}

export default function WebVitalsReporter({ user }) {
  useEffect(() => {
    if (reportedThisSession) return; // only register once per page load
    reportedThisSession = true;

    let cancelled = false;
    (async () => {
      try {
        const wv = await import('web-vitals');
        if (cancelled) return;
        const meta = {
          uid: user?.uid || null,
          role: user?.role || 'anonymous',
        };
        wv.onLCP((m) => send(m, meta));
        wv.onINP((m) => send(m, meta));
        wv.onCLS((m) => send(m, meta));
        // Bonus: FCP & TTFB for context (cheap, same beacon channel).
        if (typeof wv.onFCP === 'function') wv.onFCP((m) => send(m, meta));
        if (typeof wv.onTTFB === 'function') wv.onTTFB((m) => send(m, meta));
      } catch (e) {
        // package missing or load error — silent
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid, user?.role]);

  return null;
}
