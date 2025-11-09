import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ImageUpload from '@/components/ImageUpload';
import { FileText, Upload, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import notifications from '@/utils/notifications';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const KYCVerification = ({ user, onLogout }) => {
  const [userData, setUserData] = useState(null);
  const [selectedDocType, setSelectedDocType] = useState(''); // 'aadhaar' or 'pan'
  const [kycData, setKycData] = useState({
    document_type: '', // 'aadhaar' or 'pan'
    aadhaar_front_base64: '',
    aadhaar_back_base64: '',
    pan_front_base64: ''
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
      pan_front_base64: type === 'pan' ? kycData.pan_front_base64 : ''
    });
  };

  const submitKYC = async () => {
    // Validation: Check if document type is selected
    if (!selectedDocType) {
      toast.error('Please select a document type (Aadhaar or PAN)');
      return;
    }

    // Validation: Check if selected documents are uploaded
    if (selectedDocType === 'aadhaar') {
      if (!kycData.aadhaar_front_base64 || !kycData.aadhaar_back_base64) {
        toast.error('Please upload both front and back of Aadhaar card');
        return;
      }
    } else if (selectedDocType === 'pan') {
      if (!kycData.pan_front_base64) {
        toast.error('Please upload PAN card');
        return;
      }
    }

    try {
      await axios.post(`${API}/kyc/submit/${user.uid}`, {
        ...kycData,
        document_type: selectedDocType
      });
      toast.success('KYC submitted for verification!');
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
      toast.error(error.response?.data?.detail || 'Failed to submit KYC');
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <Navbar user={user} onLogout={onLogout} />
      
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
                    {/* Aadhaar Front */}
                    <ImageUpload
                      value={kycData.aadhaar_front_base64}
                      onChange={(base64Image) => setKycData({...kycData, aadhaar_front_base64: base64Image})}
                      label="Aadhaar Card (Front) *"
                      aspectRatio="video"
                      maxSize={5}
                      required={true}
                      enableCamera={true}
                      cameraFacingMode="environment"
                    />

                    {/* Aadhaar Back */}
                    <ImageUpload
                      value={kycData.aadhaar_back_base64}
                      onChange={(base64Image) => setKycData({...kycData, aadhaar_back_base64: base64Image})}
                      label="Aadhaar Card (Back) *"
                      aspectRatio="video"
                      maxSize={5}
                      required={true}
                      enableCamera={true}
                      cameraFacingMode="environment"
                    />
                  </>
                )}

                {selectedDocType === 'pan' && (
                  <>
                    {/* PAN Card */}
                    <ImageUpload
                      value={kycData.pan_front_base64}
                      onChange={(base64Image) => setKycData({...kycData, pan_front_base64: base64Image})}
                      label="PAN Card *"
                      aspectRatio="video"
                      maxSize={5}
                      required={true}
                      enableCamera={true}
                      cameraFacingMode="environment"
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

            {!selectedDocType && (
              <div className="text-center py-12 text-gray-500">
                <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Please select a document type to begin</p>
                <p className="text-sm mt-2">Choose Aadhaar or PAN card above</p>
              </div>
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
