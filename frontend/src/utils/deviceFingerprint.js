/**
 * Device Fingerprinting Utility
 * Generates a unique device fingerprint for fraud detection
 */

// Generate a hash from string
const hashString = async (str) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
};

// Collect browser and device info
const collectDeviceInfo = () => {
  const info = {
    // Screen info
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    colorDepth: window.screen.colorDepth,
    pixelRatio: window.devicePixelRatio || 1,
    
    // Browser info
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages?.join(',') || navigator.language,
    platform: navigator.platform,
    
    // Timezone
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    
    // Hardware
    hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
    maxTouchPoints: navigator.maxTouchPoints || 0,
    
    // Memory (if available)
    deviceMemory: navigator.deviceMemory || 'unknown',
    
    // WebGL renderer (if available)
    webglRenderer: getWebGLRenderer(),
    
    // Canvas fingerprint
    canvasFingerprint: getCanvasFingerprint(),
  };
  
  return info;
};

// Get WebGL renderer info
const getWebGLRenderer = () => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'none';
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'unknown';
    
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    return renderer || 'unknown';
  } catch (e) {
    return 'error';
  }
};

// Get canvas fingerprint
const getCanvasFingerprint = () => {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'none';
    
    // Draw some shapes and text
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('ParasReward', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('ParasReward', 4, 17);
    
    // Get data URL and hash it
    const dataURL = canvas.toDataURL();
    return dataURL.slice(-50); // Last 50 chars as simple fingerprint
  } catch (e) {
    return 'error';
  }
};

/**
 * Generate device fingerprint
 * @returns {Promise<string>} 32-character fingerprint
 */
export const generateDeviceFingerprint = async () => {
  try {
    const deviceInfo = collectDeviceInfo();
    const fingerprintString = JSON.stringify(deviceInfo);
    const fingerprint = await hashString(fingerprintString);
    return fingerprint;
  } catch (error) {
    console.error('Error generating device fingerprint:', error);
    // Fallback to simple fingerprint
    const fallback = `${navigator.userAgent}|${window.screen.width}x${window.screen.height}`;
    return await hashString(fallback);
  }
};

/**
 * Get stored or generate new device fingerprint
 * Caches in localStorage for consistency
 */
export const getDeviceFingerprint = async () => {
  const storageKey = 'prc_device_fp';
  
  // Check if already stored
  let fingerprint = localStorage.getItem(storageKey);
  
  if (!fingerprint) {
    // Generate new fingerprint
    fingerprint = await generateDeviceFingerprint();
    localStorage.setItem(storageKey, fingerprint);
  }
  
  return fingerprint;
};

/**
 * Get device info for debugging
 */
export const getDeviceInfo = () => {
  return collectDeviceInfo();
};

export default {
  generateDeviceFingerprint,
  getDeviceFingerprint,
  getDeviceInfo
};
