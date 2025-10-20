import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ImageUpload from '@/components/ImageUpload';
import { FileText, Upload, CheckCircle, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const KYCVerification = ({ user, onLogout }) => {
  const [userData, setUserData] = useState(null);
  const [kycData, setKycData] = useState({
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

  const handleFileUpload = (field, e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setKycData({ ...kycData, [field]: reader.result });
        toast.success('Document uploaded');
      };
      reader.readAsDataURL(file);
    }
  };

  const submitKYC = async () => {
    if (!kycData.aadhaar_front_base64 || !kycData.aadhaar_back_base64 || !kycData.pan_front_base64) {
      toast.error('Please upload all required documents');
      return;
    }

    try {
      await axios.post(`${API}/kyc/submit/${user.uid}`, kycData);
      toast.success('KYC submitted for verification!');
      fetchUserData();
      setKycData({
        aadhaar_front_base64: '',
        aadhaar_back_base64: '',
        pan_front_base64: ''
      });
    } catch (error) {
      console.error('Error submitting KYC:', error);
      toast.error('Failed to submit KYC');
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
            
            <div className="space-y-6">
              {/* Aadhaar Front */}
              <ImageUpload
                value={kycData.aadhaar_front_base64}
                onChange={(base64Image) => setKycData({...kycData, aadhaar_front_base64: base64Image})}
                label="Aadhaar Card (Front)"
                aspectRatio="video"
                maxSize={5}
                required={true}
              />

              {/* Aadhaar Back */}
              <ImageUpload
                value={kycData.aadhaar_back_base64}
                onChange={(base64Image) => setKycData({...kycData, aadhaar_back_base64: base64Image})}
                label="Aadhaar Card (Back)"
                aspectRatio="video"
                maxSize={5}
                required={true}
              />

              {/* PAN Front */}
              <ImageUpload
                value={kycData.pan_front_base64}
                onChange={(base64Image) => setKycData({...kycData, pan_front_base64: base64Image})}
                label="PAN Card (Front)"
                aspectRatio="video"
                maxSize={5}
                required={true}
              />

              <Button
                data-testid="submit-kyc-btn"
                onClick={submitKYC}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 rounded-xl text-lg font-semibold shadow-lg transition-all"
              >
                Submit KYC for Verification
              </Button>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-xl">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> Please ensure all documents are clear and readable. KYC verification is required to redeem products and withdraw wallet balance.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default KYCVerification;