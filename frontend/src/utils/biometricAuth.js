import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Helper to convert base64url to Uint8Array
const base64UrlToUint8Array = (base64url) => {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Helper to convert Uint8Array to hex string
const uint8ArrayToHex = (buffer) => {
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

// Check if biometric is supported
export const isBiometricSupported = () => {
  return window.PublicKeyCredential !== undefined &&
         navigator.credentials !== undefined;
};

// Check if user has biometric enabled (from localStorage)
export const isBiometricEnabled = () => {
  return localStorage.getItem('biometric_enabled') === 'true';
};

// Check if biometric is available for this user's email
export const checkBiometricAvailable = async (email) => {
  try {
    const response = await axios.post(`${API}/auth/biometric/login-options?email=${encodeURIComponent(email)}`);
    return response.data.options !== null;
  } catch (error) {
    return false;
  }
};

// Perform biometric login
export const biometricLogin = async (email) => {
  try {
    // Step 1: Get authentication options
    const optionsResponse = await axios.post(`${API}/auth/biometric/login-options?email=${encodeURIComponent(email)}`);
    const options = optionsResponse.data.options;

    // Convert challenge to Uint8Array
    const publicKey = {
      challenge: base64UrlToUint8Array(options.challenge),
      timeout: options.timeout,
      rpId: options.rpId,
      allowCredentials: options.allowCredentials.map(cred => ({
        id: base64UrlToUint8Array(cred.id),
        type: cred.type
      })),
      userVerification: options.userVerification
    };

    // Step 2: Get credential from device
    const credential = await navigator.credentials.get({ publicKey });

    if (!credential) {
      throw new Error('Biometric authentication cancelled');
    }

    // Step 3: Send to server for verification
    const credentialData = {
      id: credential.id,
      rawId: uint8ArrayToHex(new Uint8Array(credential.rawId)),
      type: credential.type,
      response: {
        clientDataJSON: uint8ArrayToHex(new Uint8Array(credential.response.clientDataJSON)),
        authenticatorData: uint8ArrayToHex(new Uint8Array(credential.response.authenticatorData)),
        signature: uint8ArrayToHex(new Uint8Array(credential.response.signature)),
        userHandle: credential.response.userHandle ? 
          uint8ArrayToHex(new Uint8Array(credential.response.userHandle)) : null
      }
    };

    const loginResponse = await axios.post(
      `${API}/auth/biometric/login?email=${encodeURIComponent(email)}`,
      { credential_data: credentialData }
    );

    return { success: true, user: loginResponse.data };

  } catch (error) {
    console.error('Biometric login error:', error);
    
    let errorMessage = 'Biometric authentication failed';
    
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Biometric authentication was cancelled';
    } else if (error.name === 'NotSupportedError') {
      errorMessage = 'Biometric not supported on this device';
    } else if (error.response?.data?.detail) {
      errorMessage = error.response.data.detail;
    }
    
    return { success: false, error: errorMessage };
  }
};

// Get user's registered biometric devices
export const getBiometricDevices = async (userId) => {
  try {
    const response = await axios.get(`${API}/auth/biometric/credentials/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching biometric devices:', error);
    return { credentials: [], count: 0, max_devices: 5 };
  }
};

// Remove a biometric device
export const removeBiometricDevice = async (credentialId, userId) => {
  try {
    await axios.delete(`${API}/auth/biometric/credentials/${credentialId}?user_id=${userId}`);
    return { success: true };
  } catch (error) {
    console.error('Error removing biometric device:', error);
    return { success: false, error: error.response?.data?.detail || 'Failed to remove device' };
  }
};
