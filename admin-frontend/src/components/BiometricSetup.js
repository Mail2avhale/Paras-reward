import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Fingerprint, Smartphone, X, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
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

const BiometricSetup = ({ user, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: intro, 2: device name, 3: registering
  const [deviceName, setDeviceName] = useState('');

  // Check if browser supports WebAuthn
  const isWebAuthnSupported = () => {
    return window.PublicKeyCredential !== undefined &&
           navigator.credentials !== undefined;
  };

  // Auto-detect device name
  const getDefaultDeviceName = () => {
    const ua = navigator.userAgent;
    if (ua.includes('iPhone')) return 'iPhone';
    if (ua.includes('iPad')) return 'iPad';
    if (ua.includes('Android')) return 'Android Device';
    if (ua.includes('Mac')) return 'Mac';
    if (ua.includes('Windows')) return 'Windows PC';
    if (ua.includes('Linux')) return 'Linux PC';
    return 'My Device';
  };

  const startRegistration = async () => {
    if (!deviceName.trim()) {
      toast.error('Please enter a device name');
      return;
    }

    setLoading(true);
    setStep(3);

    try {
      // Step 1: Get registration options from server
      const optionsResponse = await axios.post(`${API}/auth/biometric/register-options?user_id=${user.uid}`);
      const options = optionsResponse.data.options;

      // Convert challenge and user ID to Uint8Array
      const publicKey = {
        challenge: base64UrlToUint8Array(options.challenge),
        rp: options.rp,
        user: {
          id: base64UrlToUint8Array(options.user.id),
          name: options.user.name,
          displayName: options.user.displayName
        },
        pubKeyCredParams: options.pubKeyCredParams,
        timeout: options.timeout,
        excludeCredentials: options.excludeCredentials?.map(cred => ({
          id: base64UrlToUint8Array(cred.id),
          type: cred.type
        })) || [],
        authenticatorSelection: options.authenticatorSelection,
        attestation: options.attestation
      };

      // Step 2: Create credential with browser API
      const credential = await navigator.credentials.create({ publicKey });

      if (!credential) {
        throw new Error('Failed to create credential');
      }

      // Step 3: Send credential to server
      const credentialData = {
        id: credential.id,
        rawId: uint8ArrayToHex(new Uint8Array(credential.rawId)),
        type: credential.type,
        response: {
          clientDataJSON: uint8ArrayToHex(new Uint8Array(credential.response.clientDataJSON)),
          attestationObject: uint8ArrayToHex(new Uint8Array(credential.response.attestationObject))
        },
        transports: credential.response.getTransports ? credential.response.getTransports() : []
      };

      await axios.post(`${API}/auth/biometric/register`, null, {
        params: {
          user_id: user.uid,
          device_name: deviceName
        },
        data: { credential_data: credentialData }
      });

      toast.success('Biometric login enabled successfully!');
      
      // Store flag in localStorage
      localStorage.setItem('biometric_enabled', 'true');
      
      if (onSuccess) onSuccess();
      onClose();

    } catch (error) {
      console.error('Biometric registration error:', error);
      
      if (error.name === 'NotAllowedError') {
        toast.error('Biometric registration was cancelled');
      } else if (error.name === 'NotSupportedError') {
        toast.error('Biometric authentication not supported on this device');
      } else {
        toast.error(error.response?.data?.detail || 'Failed to enable biometric login');
      }
      
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  if (!isWebAuthnSupported()) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white rounded-lg p-6">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Not Supported</h3>
            <p className="text-gray-600 mb-4">
              Your browser doesn't support biometric authentication. Please use a modern browser or device with fingerprint/face recognition.
            </p>
            <Button onClick={onClose} className="w-full">
              Close
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold">Enable Biometric Login</h3>
            <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-lg">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mb-4">
                  <Fingerprint className="h-12 w-12 text-indigo-600" />
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-3">Quick & Secure Access</h4>
                <p className="text-gray-600 mb-6">
                  Use your fingerprint or face recognition to log in quickly without typing your password.
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-green-900">Faster Login</p>
                    <p className="text-green-700">No need to remember or type passwords</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                  <Check className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-900">More Secure</p>
                    <p className="text-blue-700">Your biometric data never leaves your device</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                  <Check className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-purple-900">Multiple Devices</p>
                    <p className="text-purple-700">Register up to 5 devices</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => {
                  setDeviceName(getDefaultDeviceName());
                  setStep(2);
                }}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <Smartphone className="h-16 w-16 text-indigo-600 mx-auto mb-4" />
                <h4 className="text-xl font-bold text-gray-900 mb-2">Name Your Device</h4>
                <p className="text-gray-600">
                  Give this device a name so you can identify it later
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Device Name
                </label>
                <Input
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g., iPhone 13, Work Laptop"
                  maxLength={50}
                  className="text-center"
                />
                <p className="text-xs text-gray-500 mt-2">
                  This helps you manage multiple devices
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={startRegistration}
                  disabled={loading || !deviceName.trim()}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                >
                  Enable Biometric
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center py-8">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center animate-pulse">
                <Fingerprint className="h-12 w-12 text-indigo-600" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">Setting Up...</h4>
                <p className="text-gray-600">
                  Please use your fingerprint or face recognition when prompted
                </p>
              </div>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default BiometricSetup;
