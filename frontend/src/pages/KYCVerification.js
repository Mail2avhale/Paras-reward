import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  FileText, Upload, CheckCircle, Clock, XCircle, ArrowLeft, 
  CreditCard, User, Shield, Camera, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import ImageCropUpload from '@/components/ImageCropUpload';

const API = process.env.REACT_APP_BACKEND_URL;

const KYCVerification = ({ user }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState('aadhaar');
  const [kycData, setKycData] = useState({
    aadhaar_front: '',
    aadhaar_back: '',
    aadhaar_number: '',
    pan_front: '',
    pan_number: '',
    full_name: ''
  });

  const t = {
    title: language === 'mr' ? 'KYC सत्यापन' : language === 'hi' ? 'KYC सत्यापन' : 'KYC Verification',
    selectDoc: language === 'mr' ? 'दस्तऐवज निवडा' : language === 'hi' ? 'दस्तावेज़ चुनें' : 'Select Document',
    aadhaar: language === 'mr' ? 'आधार कार्ड' : language === 'hi' ? 'आधार कार्ड' : 'Aadhaar Card',
    pan: language === 'mr' ? 'पॅन कार्ड' : language === 'hi' ? 'पैन कार्ड' : 'PAN Card',
    front: language === 'mr' ? 'समोरील बाजू' : language === 'hi' ? 'सामने की तरफ' : 'Front Side',
    back: language === 'mr' ? 'मागील बाजू' : language === 'hi' ? 'पीछे की तरफ' : 'Back Side',
    uploadDoc: language === 'mr' ? 'दस्तऐवज अपलोड करा' : language === 'hi' ? 'दस्तावेज़ अपलोड करें' : 'Upload Document',
    submit: language === 'mr' ? 'सबमिट करा' : language === 'hi' ? 'सबमिट करें' : 'Submit for Verification',
    verified: language === 'mr' ? 'सत्यापित' : language === 'hi' ? 'सत्यापित' : 'Verified',
    pending: language === 'mr' ? 'प्रलंबित' : language === 'hi' ? 'लंबित' : 'Pending',
    rejected: language === 'mr' ? 'नाकारले' : language === 'hi' ? 'अस्वीकृत' : 'Rejected',
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/user/${user.uid}`);
      setUserData(response.data);
      
      // Pre-fill name if available
      if (response.data.name) {
        setKycData(prev => ({ ...prev, full_name: response.data.name }));
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (selectedDocType === 'aadhaar') {
      if (!kycData.aadhaar_front || !kycData.aadhaar_back) {
        toast.error('Please upload both sides of Aadhaar');
        return;
      }
      if (!kycData.aadhaar_number || kycData.aadhaar_number.length !== 12) {
        toast.error('Please enter valid 12-digit Aadhaar number');
        return;
      }
    } else {
      if (!kycData.pan_front) {
        toast.error('Please upload PAN card image');
        return;
      }
      if (!kycData.pan_number || kycData.pan_number.length !== 10) {
        toast.error('Please enter valid 10-character PAN number');
        return;
      }
    }

    if (!kycData.full_name) {
      toast.error('Please enter your full name');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/api/kyc/submit/${user.uid}`, {
        document_type: selectedDocType,
        full_name: kycData.full_name,
        aadhaar_front_base64: kycData.aadhaar_front,
        aadhaar_back_base64: kycData.aadhaar_back,
        aadhaar_number: kycData.aadhaar_number,
        pan_front_base64: kycData.pan_front,
        pan_number: kycData.pan_number
      });
      
      toast.success('KYC submitted! Verification in 24-48 hours.');
      navigate('/profile');
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit KYC');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = () => {
    const status = userData?.kyc_status;
    // Check if documents were actually submitted
    const hasSubmittedDocs = userData?.aadhaar_number || userData?.pan_number;
    
    if (status === 'verified') {
      return (
        <div className="flex items-center gap-2 bg-emerald-500/20 px-4 py-2 rounded-full">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          <span className="text-emerald-400 font-semibold">{t.verified}</span>
        </div>
      );
    } else if (status === 'pending' && hasSubmittedDocs) {
      return (
        <div className="flex items-center gap-2 bg-amber-500/20 px-4 py-2 rounded-full">
          <Clock className="w-5 h-5 text-amber-500" />
          <span className="text-amber-400 font-semibold">{t.pending}</span>
        </div>
      );
    } else if (status === 'rejected') {
      return (
        <div className="flex items-center gap-2 bg-red-500/20 px-4 py-2 rounded-full">
          <XCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-400 font-semibold">{t.rejected}</span>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isVerified = userData?.kyc_status === 'verified';
  // Only show "Under Review" if documents were actually submitted
  const hasSubmittedDocs = userData?.aadhaar_number || userData?.pan_number;
  const isPendingReview = userData?.kyc_status === 'pending' && hasSubmittedDocs;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-8">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-white text-xl font-bold">{t.title}</h1>
              <p className="text-gray-400 text-sm">Verify your identity</p>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </div>

      {/* Status Card for Verified/Pending */}
      {(isVerified || isPending) && (
        <div className="px-5 mb-6">
          <div className={`rounded-2xl p-5 ${isVerified ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
            <div className="flex items-center gap-4">
              {isVerified ? (
                <CheckCircle className="w-12 h-12 text-emerald-500" />
              ) : (
                <Clock className="w-12 h-12 text-amber-500" />
              )}
              <div>
                <p className={`font-bold text-lg ${isVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isVerified ? 'KYC Verified!' : 'KYC Under Review'}
                </p>
                <p className="text-gray-400 text-sm">
                  {isVerified 
                    ? 'You can now withdraw funds and access all features.'
                    : 'Your documents are being verified. This takes 24-48 hours.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KYC Form - Only show if not verified */}
      {!isVerified && !isPending && (
        <>
          {/* Document Type Selection */}
          <div className="px-5 mb-6">
            <h2 className="text-white font-bold text-lg mb-4">{t.selectDoc}</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedDocType('aadhaar')}
                className={`p-4 rounded-2xl border-2 transition-all ${
                  selectedDocType === 'aadhaar'
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-gray-800 bg-gray-900/50'
                }`}
              >
                <CreditCard className={`w-8 h-8 mb-2 mx-auto ${selectedDocType === 'aadhaar' ? 'text-amber-500' : 'text-gray-500'}`} />
                <p className={`font-medium ${selectedDocType === 'aadhaar' ? 'text-white' : 'text-gray-400'}`}>
                  {t.aadhaar}
                </p>
              </button>
              <button
                onClick={() => setSelectedDocType('pan')}
                className={`p-4 rounded-2xl border-2 transition-all ${
                  selectedDocType === 'pan'
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-gray-800 bg-gray-900/50'
                }`}
              >
                <FileText className={`w-8 h-8 mb-2 mx-auto ${selectedDocType === 'pan' ? 'text-amber-500' : 'text-gray-500'}`} />
                <p className={`font-medium ${selectedDocType === 'pan' ? 'text-white' : 'text-gray-400'}`}>
                  {t.pan}
                </p>
              </button>
            </div>
          </div>

          {/* Full Name */}
          <div className="px-5 mb-6">
            <label className="text-gray-400 text-sm mb-2 block">Full Name (as on document) *</label>
            <Input
              value={kycData.full_name}
              onChange={(e) => setKycData({...kycData, full_name: e.target.value})}
              placeholder="Enter your full name"
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>

          {/* Aadhaar Upload */}
          {selectedDocType === 'aadhaar' && (
            <div className="px-5 mb-6 space-y-4">
              {/* Aadhaar Number */}
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Aadhaar Number *</label>
                <Input
                  value={kycData.aadhaar_number}
                  onChange={(e) => setKycData({...kycData, aadhaar_number: e.target.value.replace(/\D/g, '').slice(0, 12)})}
                  placeholder="Enter 12-digit Aadhaar number"
                  className="bg-gray-800 border-gray-700 text-white"
                  maxLength={12}
                />
              </div>

              {/* Front Side */}
              <div>
                <label className="text-gray-400 text-sm mb-2 block">{t.front} *</label>
                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
                  {kycData.aadhaar_front ? (
                    <div className="relative">
                      <img 
                        src={kycData.aadhaar_front} 
                        alt="Aadhaar Front" 
                        className="w-full h-40 object-cover rounded-xl"
                      />
                      <button 
                        onClick={() => setKycData({...kycData, aadhaar_front: ''})}
                        className="absolute top-2 right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center"
                      >
                        <XCircle className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  ) : (
                    <ImageCropUpload
                      onChange={(data) => setKycData({...kycData, aadhaar_front: data})}
                      aspectRatio={1.6}
                      label="Aadhaar Front Side"
                      maxSizeMB={2}
                    />
                  )}
                </div>
              </div>

              {/* Back Side */}
              <div>
                <label className="text-gray-400 text-sm mb-2 block">{t.back} *</label>
                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
                  {kycData.aadhaar_back ? (
                    <div className="relative">
                      <img 
                        src={kycData.aadhaar_back} 
                        alt="Aadhaar Back" 
                        className="w-full h-40 object-cover rounded-xl"
                      />
                      <button 
                        onClick={() => setKycData({...kycData, aadhaar_back: ''})}
                        className="absolute top-2 right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center"
                      >
                        <XCircle className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  ) : (
                    <ImageCropUpload
                      onChange={(data) => setKycData({...kycData, aadhaar_back: data})}
                      aspectRatio={1.6}
                      label="Aadhaar Back Side"
                      maxSizeMB={2}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PAN Upload */}
          {selectedDocType === 'pan' && (
            <div className="px-5 mb-6 space-y-4">
              {/* PAN Number */}
              <div>
                <label className="text-gray-400 text-sm mb-2 block">PAN Number *</label>
                <Input
                  value={kycData.pan_number}
                  onChange={(e) => setKycData({...kycData, pan_number: e.target.value.toUpperCase().slice(0, 10)})}
                  placeholder="Enter 10-character PAN"
                  className="bg-gray-800 border-gray-700 text-white uppercase"
                  maxLength={10}
                />
              </div>

              {/* PAN Card Image */}
              <div>
                <label className="text-gray-400 text-sm mb-2 block">PAN Card Image *</label>
                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
                  {kycData.pan_front ? (
                    <div className="relative">
                      <img 
                        src={kycData.pan_front} 
                        alt="PAN Card" 
                        className="w-full h-40 object-cover rounded-xl"
                      />
                      <button 
                        onClick={() => setKycData({...kycData, pan_front: ''})}
                        className="absolute top-2 right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center"
                      >
                        <XCircle className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  ) : (
                    <ImageCropUpload
                      onChange={(data) => setKycData({...kycData, pan_front: data})}
                      aspectRatio={1.6}
                      label="PAN Card Image"
                      maxSizeMB={2}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="px-5 mb-6">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
                <div className="text-sm">
                  <p className="text-blue-400 font-medium mb-1">Important</p>
                  <ul className="text-gray-400 space-y-1">
                    <li>• Upload clear images of your document</li>
                    <li>• All details should be clearly visible</li>
                    <li>• Verification takes 24-48 hours</li>
                    <li>• Required for withdrawals</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="px-5">
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-4 rounded-2xl text-lg"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  Submitting...
                </span>
              ) : (
                <span className="flex items-center gap-2 justify-center">
                  <Shield className="w-5 h-5" />
                  {t.submit}
                </span>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default KYCVerification;
