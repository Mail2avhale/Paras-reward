import { useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { 
  CreditCard, Shield, CheckCircle, XCircle, Loader2, 
  Send, KeyRound, AlertCircle, Smartphone
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AutoKYCVerification = ({ user, onVerified }) => {
  const [selectedMethod, setSelectedMethod] = useState(null); // 'pan' or 'aadhaar'
  const [loading, setLoading] = useState(false);
  
  // PAN State
  const [panNumber, setPanNumber] = useState('');
  const [panName, setPanName] = useState(user?.name || '');
  const [panDob, setPanDob] = useState('');
  const [panResult, setPanResult] = useState(null);
  
  // Aadhaar State
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarOtp, setAadhaarOtp] = useState('');
  const [aadhaarClientRef, setAadhaarClientRef] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [aadhaarResult, setAadhaarResult] = useState(null);

  // PAN Verification
  const handlePanVerify = async () => {
    if (!panNumber || panNumber.length !== 10) {
      toast.error('Please enter valid 10-character PAN number');
      return;
    }
    if (!panName.trim()) {
      toast.error('Please enter name as per PAN');
      return;
    }
    if (!panDob) {
      toast.error('Please enter date of birth');
      return;
    }

    setLoading(true);
    setPanResult(null);
    
    try {
      const response = await axios.post(`${API}/kyc/auto-verify/pan/${user.uid}`, {
        pan_number: panNumber.toUpperCase(),
        name: panName.trim(),
        dob: panDob
      });
      
      if (response.data.verified) {
        toast.success('PAN verified successfully!');
        setPanResult({ success: true, ...response.data });
        if (onVerified) onVerified('pan');
      } else {
        toast.error(response.data.message || 'PAN verification failed');
        setPanResult({ success: false, ...response.data });
      }
    } catch (error) {
      console.error('PAN verify error:', error);
      toast.error(error.response?.data?.detail || 'PAN verification failed. Please try again.');
      setPanResult({ success: false, message: error.response?.data?.detail || 'Verification failed' });
    } finally {
      setLoading(false);
    }
  };

  // Aadhaar OTP Send
  const handleAadhaarSendOtp = async () => {
    const cleanAadhaar = aadhaarNumber.replace(/\s/g, '');
    if (!cleanAadhaar || cleanAadhaar.length !== 12) {
      toast.error('Please enter valid 12-digit Aadhaar number');
      return;
    }

    setLoading(true);
    
    try {
      const response = await axios.post(`${API}/kyc/auto-verify/aadhaar/send-otp/${user.uid}`, {
        aadhaar_number: cleanAadhaar
      });
      
      if (response.data.otp_sent) {
        toast.success('OTP sent to your Aadhaar-linked mobile!');
        setAadhaarClientRef(response.data.client_ref_id);
        setOtpSent(true);
      } else {
        toast.error(response.data.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('Aadhaar OTP error:', error);
      toast.error(error.response?.data?.detail || 'Failed to send OTP. Please check Aadhaar number.');
    } finally {
      setLoading(false);
    }
  };

  // Aadhaar OTP Verify
  const handleAadhaarVerifyOtp = async () => {
    if (!aadhaarOtp || aadhaarOtp.length !== 6) {
      toast.error('Please enter 6-digit OTP');
      return;
    }

    setLoading(true);
    setAadhaarResult(null);
    
    try {
      const response = await axios.post(`${API}/kyc/auto-verify/aadhaar/verify-otp/${user.uid}`, {
        aadhaar_number: aadhaarNumber.replace(/\s/g, ''),
        otp: aadhaarOtp,
        client_ref_id: aadhaarClientRef
      });
      
      if (response.data.verified) {
        toast.success('Aadhaar verified successfully!');
        setAadhaarResult({ success: true, ...response.data });
        if (onVerified) onVerified('aadhaar');
      } else {
        toast.error(response.data.message || 'OTP verification failed');
        setAadhaarResult({ success: false, ...response.data });
      }
    } catch (error) {
      console.error('Aadhaar verify error:', error);
      toast.error(error.response?.data?.detail || 'OTP verification failed. Please try again.');
      setAadhaarResult({ success: false, message: error.response?.data?.detail || 'Verification failed' });
    } finally {
      setLoading(false);
    }
  };

  // Format Aadhaar with spaces
  const formatAadhaar = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 12);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  return (
    <div className="space-y-6">
      {/* Method Selection */}
      {!selectedMethod && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <h3 className="text-lg font-semibold text-white text-center mb-4">
            Choose Verification Method
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PAN Option */}
            <Card 
              className="p-6 bg-gradient-to-br from-blue-600/20 to-blue-800/20 border-blue-500/30 hover:border-blue-400 cursor-pointer transition-all"
              onClick={() => setSelectedMethod('pan')}
              data-testid="select-pan-verification"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <CreditCard className="w-8 h-8 text-blue-400" />
                </div>
                <h4 className="text-xl font-bold text-white">PAN Card</h4>
                <p className="text-sm text-gray-400">Instant verification</p>
                <p className="text-xs text-blue-400">No OTP required</p>
              </div>
            </Card>

            {/* Aadhaar Option */}
            <Card 
              className="p-6 bg-gradient-to-br from-orange-600/20 to-orange-800/20 border-orange-500/30 hover:border-orange-400 cursor-pointer transition-all"
              onClick={() => setSelectedMethod('aadhaar')}
              data-testid="select-aadhaar-verification"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center">
                  <Shield className="w-8 h-8 text-orange-400" />
                </div>
                <h4 className="text-xl font-bold text-white">Aadhaar Card</h4>
                <p className="text-sm text-gray-400">OTP verification</p>
                <p className="text-xs text-orange-400">Sent to linked mobile</p>
              </div>
            </Card>
          </div>
        </motion.div>
      )}

      {/* PAN Verification Form */}
      {selectedMethod === 'pan' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-400" />
              PAN Verification
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSelectedMethod(null); setPanResult(null); }}
              className="text-gray-400"
            >
              ← Back
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">PAN Number</label>
              <Input
                placeholder="ABCDE1234F"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase().slice(0, 10))}
                className="bg-gray-800 border-gray-700 text-white uppercase"
                maxLength={10}
                data-testid="pan-number-input"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">Name (as per PAN)</label>
              <Input
                placeholder="Enter name as per PAN card"
                value={panName}
                onChange={(e) => setPanName(e.target.value.toUpperCase())}
                className="bg-gray-800 border-gray-700 text-white uppercase"
                data-testid="pan-name-input"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">Date of Birth</label>
              <Input
                type="date"
                value={panDob}
                onChange={(e) => setPanDob(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
                data-testid="pan-dob-input"
              />
            </div>

            <Button
              onClick={handlePanVerify}
              disabled={loading || !panNumber || !panName || !panDob}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
              data-testid="verify-pan-btn"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</>
              ) : (
                <><CheckCircle className="w-4 h-4 mr-2" /> Verify PAN</>
              )}
            </Button>
          </div>

          {/* PAN Result */}
          {panResult && (
            <Card className={`p-4 ${panResult.success ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <div className="flex items-center gap-2 mb-2">
                {panResult.success ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
                <span className={`font-semibold ${panResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                  {panResult.success ? 'PAN Verified!' : 'Verification Failed'}
                </span>
              </div>
              {panResult.details && (
                <div className="text-sm text-gray-400 space-y-1">
                  <p>Status: {panResult.details.pan_status}</p>
                  <p>Name Match: {panResult.details.name_match ? '✓ Yes' : '✗ No'}</p>
                  <p>DOB Match: {panResult.details.dob_match ? '✓ Yes' : '✗ No'}</p>
                  <p>Aadhaar Linked: {panResult.details.aadhaar_linked ? '✓ Yes' : '✗ No'}</p>
                </div>
              )}
            </Card>
          )}
        </motion.div>
      )}

      {/* Aadhaar Verification Form */}
      {selectedMethod === 'aadhaar' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-400" />
              Aadhaar Verification
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSelectedMethod(null); setOtpSent(false); setAadhaarResult(null); }}
              className="text-gray-400"
            >
              ← Back
            </Button>
          </div>

          <div className="space-y-4">
            {/* Step 1: Enter Aadhaar */}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Aadhaar Number</label>
              <Input
                placeholder="1234 5678 9012"
                value={aadhaarNumber}
                onChange={(e) => setAadhaarNumber(formatAadhaar(e.target.value))}
                className="bg-gray-800 border-gray-700 text-white tracking-wider"
                maxLength={14}
                disabled={otpSent}
                data-testid="aadhaar-number-input"
              />
            </div>

            {!otpSent ? (
              <Button
                onClick={handleAadhaarSendOtp}
                disabled={loading || aadhaarNumber.replace(/\s/g, '').length !== 12}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                data-testid="send-aadhaar-otp-btn"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending OTP...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Send OTP</>
                )}
              </Button>
            ) : (
              <>
                {/* Step 2: Enter OTP */}
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-orange-400" />
                  <p className="text-sm text-orange-300">OTP sent to your Aadhaar-linked mobile</p>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Enter OTP</label>
                  <Input
                    placeholder="Enter 6-digit OTP"
                    value={aadhaarOtp}
                    onChange={(e) => setAadhaarOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="bg-gray-800 border-gray-700 text-white text-center text-xl tracking-[0.5em]"
                    maxLength={6}
                    data-testid="aadhaar-otp-input"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => { setOtpSent(false); setAadhaarOtp(''); }}
                    className="flex-1 border-gray-700"
                  >
                    Resend OTP
                  </Button>
                  <Button
                    onClick={handleAadhaarVerifyOtp}
                    disabled={loading || aadhaarOtp.length !== 6}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                    data-testid="verify-aadhaar-otp-btn"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</>
                    ) : (
                      <><KeyRound className="w-4 h-4 mr-2" /> Verify OTP</>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Aadhaar Result */}
          {aadhaarResult && (
            <Card className={`p-4 ${aadhaarResult.success ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <div className="flex items-center gap-2 mb-2">
                {aadhaarResult.success ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
                <span className={`font-semibold ${aadhaarResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                  {aadhaarResult.success ? 'Aadhaar Verified!' : 'Verification Failed'}
                </span>
              </div>
              {aadhaarResult.details && (
                <div className="text-sm text-gray-400 space-y-1">
                  <p>Name: {aadhaarResult.details.name}</p>
                  <p>DOB: {aadhaarResult.details.dob}</p>
                  <p>Gender: {aadhaarResult.details.gender}</p>
                  <p>State: {aadhaarResult.details.state}</p>
                </div>
              )}
            </Card>
          )}
        </motion.div>
      )}

      {/* Info */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mt-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-gray-400">
            <p className="font-semibold mb-1">Auto KYC Benefits:</p>
            <ul className="space-y-1">
              <li>• Instant verification - no manual review</li>
              <li>• PAN verification requires no OTP</li>
              <li>• Aadhaar OTP sent to linked mobile only</li>
              <li>• Your data is securely processed by Eko</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoKYCVerification;
