import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ImageCropUpload from '@/components/ImageCropUpload';
import KYCAIVerification from '@/components/KYCAIVerification';
import { FileText, Upload, CheckCircle, Clock, XCircle, AlertCircle, Sparkles, Zap } from 'lucide-react';
import { toast } from 'sonner';
import notifications from '@/utils/notifications';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const KYCVerification = ({ user, onLogout }) => {
  const [userData, setUserData] = useState(null);
  const [selectedDocType, setSelectedDocType] = useState(''); // 'aadhaar' or 'pan'
  const [verificationMode, setVerificationMode] = useState(''); // 'ai' or 'manual'
  const [kycData, setKycData] = useState({
    document_type: '', // 'aadhaar' or 'pan'
    aadhaar_front_base64: '',
    aadhaar_back_base64: '',
    aadhaar_number: '',
    pan_front_base64: '',
    pan_number: ''
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await axios.get(`${API}/auth/user/${user.uid}`);
      setUserData(response.data);
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const handleDocTypeSelect = (type) => {
    setSelectedDocType(type);
    setKycData({
      ...kycData,
      document_type: type,
      // Clear opposite document type when switching
      aadhaar_front_base64: type === 'aadhaar' ? kycData.aadhaar_front_base64 : '',
      aadhaar_back_base64: type === 'aadhaar' ? kycData.aadhaar_back_base64 : '',
      aadhaar_number: type === 'aadhaar' ? kycData.aadhaar_number : '',
      pan_front_base64: type === 'pan' ? kycData.pan_front_base64 : '',
      pan_number: type === 'pan' ? kycData.pan_number : ''
    });
  };

  const submitKYC = async () => {
    // Validation: Check if document type is selected
    if (!selectedDocType) {
      notifications.error(
        'Document Selection Required',
        'Please select either Aadhaar or PAN card to continue with KYC verification.'
      );
      return;
    }

    // Validation: Check if selected documents are uploaded
    if (selectedDocType === 'aadhaar') {
      if (!kycData.aadhaar_front_base64 || !kycData.aadhaar_back_base64) {
        notifications.error(
          'Missing Documents',
          'Please upload both front and back sides of your Aadhaar card.'
        );
        return;
      }
      if (!kycData.aadhaar_number || kycData.aadhaar_number.length !== 12) {
        notifications.error(
          'Invalid Aadhaar Number',
          'Please enter a valid 12-digit Aadhaar number.'
        );
        return;
      }
    } else if (selectedDocType === 'pan') {
      if (!kycData.pan_front_base64) {
        notifications.error(
          'Missing Document',
          'Please upload your PAN card to continue.'
        );
        return;
      }
      if (!kycData.pan_number || kycData.pan_number.length !== 10) {
        notifications.error(
          'Invalid PAN Number',
          'Please enter a valid 10-character PAN number.'
        );
        return;
      }
    }

    // Show loading notification
    const loadingId = notifications.loading(
      'Submitting KYC Documents',
      'Please wait while we upload your documents securely...'
    );

    try {
      await axios.post(`${API}/kyc/submit/${user.uid}`, {
        ...kycData,
        document_type: selectedDocType
      });
      
      toast.dismiss(loadingId);
      
      notifications.celebrate(
        '🎉 KYC Submitted Successfully!',
        'Your documents have been submitted for verification. Our team will review them within 24-48 hours. You\'ll receive a notification once approved.'
      );
      
      fetchUserData();
      setKycData({
        document_type: '',
        aadhaar_front_base64: '',
        aadhaar_back_base64: '',
        pan_front_base64: ''
      });
      setSelectedDocType('');
    } catch (error) {
      console.error('Error submitting KYC:', error);
      toast.dismiss(loadingId);
      
      notifications.error(
        'Submission Failed',
        error.response?.data?.detail || 'Failed to submit KYC documents. Please check your internet connection and try again.'
      );
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="h-12 w-12 text-green-600" />;
      case 'pending':
        return <Clock className="h-12 w-12 text-yellow-600" />;
      case 'rejected':
        return <XCircle className="h-12 w-12 text-red-600" />;
      default:
        return <FileText className="h-12 w-12 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 pt-20 pb-24">
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8">KYC Verification</h1>

        {/* Status Card */}
        <Card data-testid="kyc-status" className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl mb-8">
          <div className="text-center">
            {getStatusIcon(userData?.kyc_status)}
            <h2 className="text-2xl font-bold text-gray-900 mt-4 mb-2">KYC Status</h2>
            <div className={`inline-block px-6 py-2 rounded-full font-semibold ${getStatusColor(userData?.kyc_status)}`}>
              {userData?.kyc_status?.toUpperCase()}
            </div>
            
            {userData?.kyc_status === 'verified' && (
              <p className="text-gray-600 mt-4">
                Your KYC is verified. You can now redeem products and withdraw from wallet.
              </p>
            )}
            {userData?.kyc_status === 'pending' && (
              <p className="text-gray-600 mt-4">
                Your KYC documents are under review. Please wait for admin verification.
              </p>
            )}
            {userData?.kyc_status === 'rejected' && (
              <p className="text-gray-600 mt-4">
                Your KYC was rejected. Please resubmit with correct documents.
              </p>
            )}
          </div>
        </Card>

        {/* Document Upload */}
        {userData?.kyc_status !== 'verified' && (
          <Card data-testid="kyc-upload" className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Submit KYC Documents</h2>
            
            {/* AI vs Manual Selection */}
            {!verificationMode && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Verification Method निवडा</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* AI Verification Option */}
                  <button
                    onClick={() => setVerificationMode('ai')}
                    className="p-6 border-2 border-purple-400 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl hover:shadow-lg transition-all group relative overflow-hidden"
                  >
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold rounded-full animate-pulse">
                        ⚡ FAST
                      </span>
                    </div>
                    <div className="text-center">
                      <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Sparkles className="h-8 w-8 text-white" />
                      </div>
                      <h4 className="font-bold text-lg mb-1 text-purple-900">🤖 AI Auto-Verification</h4>
                      <p className="text-sm text-purple-700 mb-2">Instant approval in 30 seconds!</p>
                      <ul className="text-xs text-gray-600 space-y-1">
                        <li>✅ AI document scanning</li>
                        <li>✅ Auto name & number match</li>
                        <li>✅ तात्काळ approval</li>
                      </ul>
                    </div>
                  </button>

                  {/* Manual Verification Option */}
                  <button
                    onClick={() => setVerificationMode('manual')}
                    className="p-6 border-2 border-gray-300 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all"
                  >
                    <div className="text-center">
                      <div className="mx-auto w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-3">
                        <FileText className="h-8 w-8 text-gray-500" />
                      </div>
                      <h4 className="font-bold text-lg mb-1 text-gray-800">📄 Manual Verification</h4>
                      <p className="text-sm text-gray-600 mb-2">Admin review in 24-48 hours</p>
                      <ul className="text-xs text-gray-500 space-y-1">
                        <li>📤 Document upload</li>
                        <li>👤 Admin review</li>
                        <li>⏰ 24-48 तास</li>
                      </ul>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* AI Verification Mode */}
            {verificationMode === 'ai' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    AI Auto-Verification
                  </h3>
                  <Button variant="outline" size="sm" onClick={() => setVerificationMode('')}>
                    ← Back
                  </Button>
                </div>
                
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6">
                  <p className="text-sm text-purple-800">
                    <strong>📌 Tip:</strong> दोन्ही documents (Aadhaar + PAN) verify करा complete KYC साठी!
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <KYCAIVerification 
                    user={user} 
                    documentType="aadhaar"
                    onVerified={(type, result) => {
                      fetchUserData();
                      toast.success('Aadhaar verified!');
                    }}
                  />
                  <KYCAIVerification 
                    user={user} 
                    documentType="pan"
                    onVerified={(type, result) => {
                      fetchUserData();
                      toast.success('PAN verified!');
                    }}
                  />
                </div>
              </div>
            )}

            {/* Manual Verification Mode */}
            {verificationMode === 'manual' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Manual Document Upload</h3>
                  <Button variant="outline" size="sm" onClick={() => setVerificationMode('')}>
                    ← Back
                  </Button>
                </div>
            
            {/* Information Banner */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Flexible Document Submission</p>
                  <p>You can submit <strong>either Aadhaar card OR PAN card</strong> for KYC verification. Choose whichever document is convenient for you.</p>
                </div>
              </div>
            </div>

            {/* Document Type Selection */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Step 1: Select Document Type</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => handleDocTypeSelect('aadhaar')}
                  className={`p-6 border-2 rounded-xl transition-all ${
                    selectedDocType === 'aadhaar'
                      ? 'border-purple-600 bg-purple-50 shadow-lg'
                      : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-center">
                    <FileText className={`h-12 w-12 mx-auto mb-3 ${
                      selectedDocType === 'aadhaar' ? 'text-purple-600' : 'text-gray-400'
                    }`} />
                    <h4 className="font-bold text-lg mb-1">Aadhaar Card</h4>
                    <p className="text-sm text-gray-600">Upload front and back</p>
                    {selectedDocType === 'aadhaar' && (
                      <div className="mt-2">
                        <span className="inline-block px-3 py-1 bg-purple-600 text-white text-xs font-semibold rounded-full">
                          ✓ Selected
                        </span>
                      </div>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => handleDocTypeSelect('pan')}
                  className={`p-6 border-2 rounded-xl transition-all ${
                    selectedDocType === 'pan'
                      ? 'border-purple-600 bg-purple-50 shadow-lg'
                      : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-center">
                    <FileText className={`h-12 w-12 mx-auto mb-3 ${
                      selectedDocType === 'pan' ? 'text-purple-600' : 'text-gray-400'
                    }`} />
                    <h4 className="font-bold text-lg mb-1">PAN Card</h4>
                    <p className="text-sm text-gray-600">Upload front only</p>
                    {selectedDocType === 'pan' && (
                      <div className="mt-2">
                        <span className="inline-block px-3 py-1 bg-purple-600 text-white text-xs font-semibold rounded-full">
                          ✓ Selected
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              </div>
            </div>

            {/* Document Upload Section */}
            {selectedDocType && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-800">Step 2: Upload Document(s)</h3>
                
                {selectedDocType === 'aadhaar' && (
                  <>
                    {/* Aadhaar Number */}
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Aadhaar Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Enter 12-digit Aadhaar number"
                        maxLength={12}
                        value={kycData.aadhaar_number}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setKycData({...kycData, aadhaar_number: value});
                        }}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-600 focus:outline-none transition-colors text-lg font-mono"
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter the 12-digit number from your Aadhaar card</p>
                    </div>

                    {/* Aadhaar Front */}
                    <ImageCropUpload
                      value={kycData.aadhaar_front_base64}
                      onChange={(base64Image) => setKycData({...kycData, aadhaar_front_base64: base64Image})}
                      label="Aadhaar Card (Front)"
                      aspectRatio={16/10}
                      maxSizeMB={2}
                      required={true}
                    />

                    {/* Aadhaar Back */}
                    <ImageCropUpload
                      value={kycData.aadhaar_back_base64}
                      onChange={(base64Image) => setKycData({...kycData, aadhaar_back_base64: base64Image})}
                      label="Aadhaar Card (Back)"
                      aspectRatio={16/10}
                      maxSizeMB={2}
                      required={true}
                    />
                  </>
                )}

                {selectedDocType === 'pan' && (
                  <>
                    {/* PAN Number */}
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        PAN Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Enter 10-character PAN (e.g., ABCDE1234F)"
                        maxLength={10}
                        value={kycData.pan_number}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                          setKycData({...kycData, pan_number: value});
                        }}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-600 focus:outline-none transition-colors text-lg font-mono uppercase"
                      />
                      <p className="text-xs text-gray-500 mt-1">Format: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)</p>
                    </div>

                    {/* PAN Card */}
                    <ImageCropUpload
                      value={kycData.pan_front_base64}
                      onChange={(base64Image) => setKycData({...kycData, pan_front_base64: base64Image})}
                      label="PAN Card"
                      aspectRatio={16/10}
                      maxSizeMB={2}
                      required={true}
                    />
                  </>
                )}

                <div className="pt-4">
                  <Button
                    onClick={submitKYC}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 text-lg font-semibold rounded-2xl shadow-xl"
                  >
                    <Upload className="mr-2 h-5 w-5" />
                    Submit KYC for Verification
                  </Button>
                </div>

                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">
                    <strong>Note:</strong> Please ensure that:
                  </p>
                  <ul className="list-disc list-inside text-xs text-gray-600 mt-2 space-y-1">
                    <li>Documents are clear and readable</li>
                    <li>All details are visible</li>
                    <li>Photos are not blurred or cut off</li>
                    <li>File size is under 5MB per image</li>
                  </ul>
                </div>
              </div>
            )}

            {!selectedDocType && verificationMode === 'manual' && (
              <div className="text-center py-12 text-gray-500">
                <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Please select a document type to begin</p>
                <p className="text-sm mt-2">Choose Aadhaar or PAN card above</p>
              </div>
            )}
            </>
            )}
          </Card>
        )}

        {/* Additional Info */}
        <Card className="bg-white/80 backdrop-blur-sm p-6 mt-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Why KYC?</h3>
          <ul className="space-y-3 text-sm text-gray-700">
            <li className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Required for product redemption and wallet withdrawals</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Ensures secure transactions and prevents fraud</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <span>One-time verification process</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Your documents are encrypted and stored securely</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default KYCVerification;
