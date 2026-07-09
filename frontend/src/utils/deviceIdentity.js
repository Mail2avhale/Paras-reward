/**
 * deviceIdentity.js — Reliable device identifier + metadata for the
 * device-binding feature (Feb 7 2026).
 *
 * Strategy:
 *   • On native (Capacitor Android / iOS)  → @capacitor/device.getId() returns
 *     a stable per-install identifier. We prefix with "AND-" / "IOS-" so the
 *     backend's is_trusted_device_id() regex accepts it and turns
 *     enforcement ON for this session.
 *   • On web browsers                       → we still return a UUID cached
 *     in localStorage, prefixed with "DEV-" so the backend treats it as an
 *     UNTRUSTED id and skips enforcement per policy Q2=a.
 *
 * Also returns device_model + os_version metadata which the backend audits
 * (Q5=c) so admins can eyeball suspicious signup farms.
 *
 * getDeviceIdentity() is memoised — cheap to call multiple times per page.
 */

import { Capacitor } from '@capacitor/core';

const STORAGE_KEY = 'device_id';
const META_KEY = 'device_meta';

let _cached = null;

const isNative = () => {
  try {
    return !!(Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  } catch {
    return false;
  }
};

/**
 * Return { device_id, device_model, os_version, is_native }.
 * Never throws. Safe to await from anywhere.
 */
export async function getDeviceIdentity() {
  if (_cached) return _cached;

  let device_id = null;
  let device_model = null;
  let os_version = null;
  let is_native = false;

  if (isNative()) {
    try {
      const { Device } = await import('@capacitor/device');
      const [idRes, infoRes] = await Promise.all([
        Device.getId().catch(() => null),
        Device.getInfo().catch(() => null),
      ]);
      const raw = (idRes && (idRes.identifier || idRes.uuid)) || null;
      if (raw) {
        const platform = (infoRes && infoRes.platform) || 'android';
        const prefix = platform === 'ios' ? 'IOS' : 'AND';
        device_id = `${prefix}-${String(raw).replace(/[^A-Za-z0-9-]/g, '').slice(0, 60)}`;
      }
      device_model = (infoRes && (infoRes.model || infoRes.name)) || null;
      os_version = (infoRes && (infoRes.osVersion || infoRes.iOSVersion)) || null;
      is_native = true;
    } catch (e) {
      // Fall through to web fallback
      console.warn('[deviceIdentity] native lookup failed:', e);
    }
  }

  // Web fallback (or native failure) → cached localStorage UUID marked as
  // untrusted so backend doesn't enforce binding.
  if (!device_id) {
    try {
      let cached = localStorage.getItem(STORAGE_KEY);
      if (!cached || !cached.startsWith('DEV-')) {
        cached = `DEV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem(STORAGE_KEY, cached);
      }
      device_id = cached;
      device_model = device_model || (navigator.userAgentData && navigator.userAgentData.mobile ? 'web-mobile' : 'web-desktop');
      os_version = os_version || (navigator.platform || null);
    } catch {
      device_id = `DEV-fallback-${Date.now()}`;
    }
  }

  const identity = { device_id, device_model, os_version, is_native };
  _cached = identity;
  try {
    localStorage.setItem(META_KEY, JSON.stringify(identity));
  } catch {
    // Non-critical
  }
  return identity;
}

/**
 * Synchronous best-effort read. Returns a device_id immediately without
 * doing the Capacitor round-trip. Use for cases where blocking on the
 * async version is not viable (e.g. form default state on first render).
 * The async version will overwrite the cache with the accurate id.
 */
export function getDeviceIdentitySync() {
  if (_cached) return _cached;
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.device_id) return parsed;
    }
  } catch { /* ignore */ }
  // Bootstrap a DEV- id so the field is never empty.
  const fallback_id =
    localStorage.getItem(STORAGE_KEY) ||
    `DEV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  try {
    localStorage.setItem(STORAGE_KEY, fallback_id);
  } catch { /* ignore */ }
  return { device_id: fallback_id, device_model: null, os_version: null, is_native: false };
}
