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
import AdvancedDocumentUpload from '@/components/AdvancedDocumentUpload';
import { formatAadhaar, formatPAN, validateAadhaar, validatePAN } from '@/utils/indianValidation';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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

  const [kycStatusInfo, setKycStatusInfo] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch user data first
      const userResponse = await axios.get(`${API}/user/${user.uid}`, { timeout: 15000 });
      setUserData(userResponse.data);
      
      // Pre-fill name if available
      if (userResponse.data.name) {
        setKycData(prev => ({ ...prev, full_name: userResponse.data.name }));
      }
      
      // Then fetch KYC status (non-blocking)
      try {
        const kycStatusResponse = await axios.get(`${API}/kyc/check-status/${user.uid}`, { timeout: 10000 });
        if (kycStatusResponse?.data) {
          setKycStatusInfo(kycStatusResponse.data);
        }
      } catch (kycError) {
        console.log('KYC status check failed (non-critical):', kycError);
        // Don't block page load if KYC status check fails
      }
      
    } catch (error) {
      console.error('Error fetching user:', error);
      setError('Failed to load data. Please try again.');
      toast.error('Failed to load KYC page. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetKYC = async () => {
    if (!window.confirm('Do you want to re-submit your KYC documents?')) {
      return;
    }
    
    setResetting(true);
    try {
      await axios.post(`${API}/kyc/reset-for-resubmit/${user.uid}`);
      toast.success('KYC reset झाले! आता तुम्ही नवीन documents submit करू शकता.');
      // Refresh data
      await fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Reset failed. Please try again.');
    } finally {
      setResetting(false);
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
      // Retry logic for timeout errors
      let lastError = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await axios.post(`${API}/kyc/submit/${user.uid}`, {
            document_type: selectedDocType,
            full_name: kycData.full_name,
            aadhaar_front_base64: kycData.aadhaar_front,
            aadhaar_back_base64: kycData.aadhaar_back,
            aadhaar_number: kycData.aadhaar_number,
            pan_front_base64: kycData.pan_front,
            pan_number: kycData.pan_number
          }, {
            timeout: 30000 // 30 second timeout
          });
          
          toast.success('✅ KYC Documents Submitted Successfully!\n\nYour verification will be completed within 1-3 business days. You will receive a notification once approved.', {
            duration: 6000,
          });
          navigate('/profile');
          return; // Success, exit
          
        } catch (err) {
          lastError = err;
          // Only retry on timeout or network errors
          if (err.code === 'ECONNABORTED' || err.message?.includes('timeout') || err.response?.status === 504) {
            if (attempt < 3) {
              toast.info(`Upload slow, retrying... (${attempt}/3)`);
              await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds before retry
              continue;
            }
          }
          throw err; // Non-timeout error, don't retry
        }
      }
      throw lastError;
      
    } catch (error) {
      console.error('KYC submit error:', error);
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout') || error.response?.status === 504) {
        toast.error('Upload failed due to slow connection. Please try again with smaller images or better internet.');
      } else {
        toast.error(error.response?.data?.detail || 'Failed to submit KYC. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = () => {
    const status = userData?.kyc_status;
    // Use kycStatusInfo for accurate status
    const isOrphaned = kycStatusInfo?.is_orphaned;
    const hasDocument = kycStatusInfo?.has_document;
    
    if (status === 'verified') {
      return (
        <div className="flex items-center gap-2 bg-emerald-500/20 px-4 py-2 rounded-full">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          <span className="text-emerald-400 font-semibold">{t.verified}</span>
        </div>
      );
    } else if (status === 'pending' && hasDocument && !isOrphaned) {
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
    } else if (isOrphaned) {
      return (
        <div className="flex items-center gap-2 bg-orange-500/20 px-4 py-2 rounded-full">
          <AlertCircle className="w-5 h-5 text-orange-500" />
          <span className="text-orange-400 font-semibold">Re-submit</span>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 mt-4">Loading KYC...</p>
      </div>
    );
  }

  // Error state
  if (error && !userData) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <p className="text-white text-lg font-bold mb-2">Error Loading Page</p>
        <p className="text-gray-400 text-center mb-4">{error}</p>
        <div className="flex gap-3">
          <Button onClick={fetchData} className="bg-amber-500 hover:bg-amber-600 text-black">
            Try Again
          </Button>
          <Button onClick={() => navigate(-1)} variant="outline" className="border-gray-600">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const isVerified = userData?.kyc_status === 'verified';
  // Use kycStatusInfo for accurate detection
  const isOrphaned = kycStatusInfo?.is_orphaned;
  const canResubmit = kycStatusInfo?.can_resubmit;
  const hasDocument = kycStatusInfo?.has_document;
  const isPendingReview = userData?.kyc_status === 'pending' && hasDocument && !isOrphaned;

  const handleCheckStatus = async () => {
    setCheckingStatus(true);
    try {
      const response = await axios.get(`${API}/kyc/check-status/${user.uid}`);
      setKycStatusInfo(response.data);
      setShowStatusModal(true);
    } catch (error) {
      toast.error('Status check failed. Please try again.');
    } finally {
      setCheckingStatus(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24 pt-16">
      {/* Header - with safe area padding */}
      <div className="px-5 pb-4 pt-4">
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

      {/* Review Status Button - Always show for pending users */}
      {userData?.kyc_status === 'pending' && (
        <div className="px-5 mb-4">
          <Button
            onClick={handleCheckStatus}
            disabled={checkingStatus}
            variant="outline"
            className="w-full border-blue-500/50 text-blue-400 hover:bg-blue-500/20"
            data-testid="check-status-btn"
          >
            {checkingStatus ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                Checking...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Check KYC Status / Having Issues?
              </span>
            )}
          </Button>
        </div>
      )}

      {/* Status Card for Verified/Pending Review */}
      {(isVerified || isPendingReview) && (
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

      {/* Orphaned KYC Status - Show Re-submit Option */}
      {isOrphaned && (
        <div className="px-5 mb-6">
          <div className="rounded-2xl p-5 bg-orange-500/10 border border-orange-500/30">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-12 h-12 text-orange-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-lg text-orange-400">
                  Re-submit KYC Documents
                </p>
                <p className="text-gray-400 text-sm mb-4">
                  Your previous KYC submission was not completed. Please upload your documents again.
                </p>
                <Button
                  onClick={handleResetKYC}
                  disabled={resetting}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold"
                  data-testid="reset-kyc-btn"
                >
                  {resetting ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Resetting...
                    </span>
                  ) : (
                    'Re-submit Now'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KYC Form - Show if not verified and not pending review (or if orphaned after reset) */}
      {!isVerified && !isPendingReview && !isOrphaned && (
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
                    <AdvancedDocumentUpload
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
                    <AdvancedDocumentUpload
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
                    <AdvancedDocumentUpload
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

      {/* Status Check Modal */}
      {showStatusModal && kycStatusInfo && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowStatusModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-500" />
              KYC Status Details
            </h3>

            <div className="space-y-4">
              {/* Current Status */}
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-sm mb-1">Profile Status:</p>
                <p className={`font-bold text-lg ${
                  kycStatusInfo.kyc_status === 'verified' ? 'text-green-400' :
                  kycStatusInfo.kyc_status === 'pending' ? 'text-amber-400' :
                  kycStatusInfo.kyc_status === 'rejected' ? 'text-red-400' :
                  'text-gray-400'
                }`}>
                  {kycStatusInfo.kyc_status?.toUpperCase() || 'NOT SUBMITTED'}
                </p>
              </div>

              {/* Document Status */}
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-sm mb-1">Document Status:</p>
                {kycStatusInfo.has_document ? (
                  <p className={`font-bold text-lg ${
                    kycStatusInfo.document_status === 'verified' ? 'text-green-400' :
                    kycStatusInfo.document_status === 'pending' ? 'text-amber-400' :
                    'text-red-400'
                  }`}>
                    {kycStatusInfo.document_status?.toUpperCase() || 'UNKNOWN'}
                  </p>
                ) : (
                  <p className="font-bold text-lg text-red-400">NO DOCUMENT FOUND</p>
                )}
              </div>

              {/* Issue Detection */}
              {kycStatusInfo.is_orphaned && (
                <div className="bg-orange-500/20 border border-orange-500/50 rounded-xl p-4">
                  <p className="text-orange-400 font-bold flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Issue Detected!
                  </p>
                  <p className="text-gray-300 text-sm mt-2">
                    Your status shows "Pending" but no documents were found. 
                    Please click the button below to re-submit your KYC.
                  </p>
                </div>
              )}

              {/* Message */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                <p className="text-blue-300 text-sm">{kycStatusInfo.message}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-4">
                {kycStatusInfo.can_resubmit && (
                  <Button
                    onClick={async () => {
                      setShowStatusModal(false);
                      await handleResetKYC();
                    }}
                    disabled={resetting}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {resetting ? 'Resetting...' : 'पुन्हा Submit करा'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowStatusModal(false)}
                  className="flex-1 border-gray-600"
                >
                  Close
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default KYCVerification;
