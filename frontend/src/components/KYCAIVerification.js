import { useState } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  FileCheck, Upload, Loader2, CheckCircle2, XCircle, 
  AlertTriangle, Camera, CreditCard, User, Sparkles
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const KYCAIVerification = ({ user, documentType, onVerified }) => {
  const [step, setStep] = useState(1); // 1: Enter details, 2: Upload image, 3: Verifying, 4: Result
  const [enteredName, setEnteredName] = useState(user?.name || '');
  const [enteredNumber, setEnteredNumber] = useState('');
  const [imageBase64, setImageBase64] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  const documentConfig = {
    aadhaar: {
      title: 'Aadhaar Card Verification',
      icon: CreditCard,
      placeholder: 'Aadhaar Number (12 digits)',
      pattern: /^\d{12}$/,
      errorMsg: 'कृपया 12 अंकी Aadhaar नंबर टाका',
      color: 'orange'
    },
    pan: {
      title: 'PAN Card Verification',
      icon: CreditCard,
      placeholder: 'PAN Number (ABCDE1234F)',
      pattern: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
      errorMsg: 'कृपया valid PAN नंबर टाका (उदा: ABCDE1234F)',
      color: 'blue'
    }
  };

  const config = documentConfig[documentType];
  const Icon = config.icon;

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('कृपया JPG, PNG किंवा WEBP format वापरा');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image 5MB पेक्षा कमी असावी');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1]; // Remove data:image/xxx;base64, prefix
      setImageBase64(base64);
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const validateStep1 = () => {
    if (!enteredName.trim()) {
      toast.error('कृपया नाव टाका');
      return false;
    }
    if (!config.pattern.test(enteredNumber.toUpperCase())) {
      toast.error(config.errorMsg);
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && imageBase64) {
      verifyDocument();
    }
  };

  const verifyDocument = async () => {
    setStep(3);
    setIsVerifying(true);

    try {
      const response = await axios.post(`${API}/ai/kyc-verify`, null, {
        params: {
          uid: user.uid,
          document_type: documentType,
          image_base64: imageBase64,
          entered_name: enteredName,
          entered_number: enteredNumber.toUpperCase()
        }
      });

      setVerificationResult(response.data);
      setStep(4);

      if (response.data.auto_approved) {
        toast.success(`✅ ${documentType.toUpperCase()} Auto-Approved!`);
        if (onVerified) {
          onVerified(documentType, response.data);
        }
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Verification failed. Please try again.');
      setStep(2);
    } finally {
      setIsVerifying(false);
    }
  };

  const resetVerification = () => {
    setStep(1);
    setImageBase64(null);
    setImagePreview(null);
    setVerificationResult(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-50 border-green-200';
      case 'rejected': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="w-6 h-6 text-green-600" />;
      case 'rejected': return <XCircle className="w-6 h-6 text-red-600" />;
      default: return <AlertTriangle className="w-6 h-6 text-yellow-600" />;
    }
  };

  return (
    <Card className={`p-6 border-l-4 border-${config.color}-500`}>
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-3 rounded-full bg-${config.color}-100`}>
          <Icon className={`w-6 h-6 text-${config.color}-600`} />
        </div>
        <div>
          <h3 className="font-bold text-lg">{config.title}</h3>
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-purple-500" />
            AI-Powered Auto Verification
          </p>
        </div>
      </div>

      {/* Step 1: Enter Details */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Document वरील नाव
            </label>
            <Input
              value={enteredName}
              onChange={(e) => setEnteredName(e.target.value)}
              placeholder="तुमचे पूर्ण नाव (जसे document वर आहे)"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              <CreditCard className="w-4 h-4 inline mr-1" />
              {documentType === 'aadhaar' ? 'Aadhaar Number' : 'PAN Number'}
            </label>
            <Input
              value={enteredNumber}
              onChange={(e) => setEnteredNumber(e.target.value.toUpperCase())}
              placeholder={config.placeholder}
              maxLength={documentType === 'aadhaar' ? 12 : 10}
              className="w-full font-mono"
            />
          </div>
          <Button onClick={handleNextStep} className="w-full bg-purple-600 hover:bg-purple-700">
            पुढे जा →
          </Button>
        </div>
      )}

      {/* Step 2: Upload Image */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">
              <strong>नाव:</strong> {enteredName}
            </p>
            <p className="text-sm text-gray-600 font-mono">
              <strong>{documentType === 'aadhaar' ? 'Aadhaar' : 'PAN'}:</strong> {enteredNumber}
            </p>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            {imagePreview ? (
              <div className="space-y-3">
                <img 
                  src={imagePreview} 
                  alt="Document preview" 
                  className="max-h-48 mx-auto rounded-lg shadow"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => { setImageBase64(null); setImagePreview(null); }}
                >
                  दुसरी Image निवडा
                </Button>
              </div>
            ) : (
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div className="space-y-2">
                  <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                    <Camera className="w-8 h-8 text-purple-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">
                    {documentType === 'aadhaar' ? 'Aadhaar Card' : 'PAN Card'} photo upload करा
                  </p>
                  <p className="text-xs text-gray-500">JPG, PNG, WEBP • Max 5MB</p>
                </div>
              </label>
            )}
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setStep(1)}
              className="flex-1"
            >
              ← मागे
            </Button>
            <Button 
              onClick={handleNextStep}
              disabled={!imageBase64}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              <FileCheck className="w-4 h-4 mr-2" />
              Verify करा
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Verifying */}
      {step === 3 && (
        <div className="text-center py-8">
          <div className="mx-auto w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-4">
            <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
          </div>
          <h4 className="font-bold text-lg mb-2">AI Verification चालू आहे...</h4>
          <p className="text-sm text-gray-500">
            Document scan करत आहे आणि details match करत आहे
          </p>
          <div className="mt-4 flex justify-center gap-1">
            {[1, 2, 3].map(i => (
              <div 
                key={i} 
                className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Result */}
      {step === 4 && verificationResult && (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg border ${getStatusColor(verificationResult.verification_result?.verification_status)}`}>
            <div className="flex items-center gap-3 mb-2">
              {getStatusIcon(verificationResult.verification_result?.verification_status)}
              <span className="font-bold text-lg capitalize">
                {verificationResult.verification_result?.verification_status === 'approved' 
                  ? '✅ Auto Approved!' 
                  : verificationResult.verification_result?.verification_status === 'rejected'
                    ? '❌ Rejected'
                    : '⏳ Manual Review Required'}
              </span>
            </div>
            <p className="text-sm">
              {verificationResult.verification_result?.reason}
            </p>
          </div>

          {verificationResult.verification_result && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Extracted Name:</span>
                <span className="font-medium">{verificationResult.verification_result.extracted_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Name Match:</span>
                <span className={verificationResult.verification_result.name_match ? 'text-green-600' : 'text-red-600'}>
                  {verificationResult.verification_result.name_match ? '✓ Match' : '✗ Mismatch'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Number Match:</span>
                <span className={verificationResult.verification_result.number_match ? 'text-green-600' : 'text-red-600'}>
                  {verificationResult.verification_result.number_match ? '✓ Match' : '✗ Mismatch'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Confidence:</span>
                <span className="font-medium">{verificationResult.verification_result.confidence || 0}%</span>
              </div>
            </div>
          )}

          {verificationResult.full_kyc_approved && (
            <div className="bg-green-100 border border-green-300 p-4 rounded-lg text-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="font-bold text-green-800">🎉 Full KYC Approved!</p>
              <p className="text-sm text-green-700">Aadhaar + PAN दोन्ही verified झाले</p>
            </div>
          )}

          <Button 
            onClick={resetVerification}
            variant="outline"
            className="w-full"
          >
            {verificationResult.verification_result?.verification_status === 'approved' 
              ? 'Done' 
              : 'पुन्हा प्रयत्न करा'}
          </Button>
        </div>
      )}
    </Card>
  );
};

export default KYCAIVerification;
