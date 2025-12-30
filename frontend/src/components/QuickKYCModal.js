import React, { useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Camera, Upload, FileText, CheckCircle, Loader, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API = process.env.REACT_APP_BACKEND_URL || '';

const QuickKYCModal = ({ user, isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState(1); // 1: Aadhaar, 2: PAN, 3: Done
  const [loading, setLoading] = useState(false);
  const [kycData, setKycData] = useState({
    aadhaar_number: '',
    aadhaar_front: null,
    aadhaar_back: null,
    pan_number: '',
    pan_front: null
  });
  const [previews, setPreviews] = useState({
    aadhaar_front: null,
    aadhaar_back: null,
    pan_front: null
  });

  const fileInputRefs = {
    aadhaar_front: useRef(null),
    aadhaar_back: useRef(null),
    pan_front: useRef(null)
  };

  if (!isOpen) return null;

  const handleFileSelect = async (field, file) => {
    if (!file) return;

    // Compress and convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 800;
        let { width, height } = img;

        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        setKycData(prev => ({ ...prev, [field]: base64 }));
        setPreviews(prev => ({ ...prev, [field]: base64 }));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = async (field) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      
      // Create video element to capture
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      // Wait for video to be ready
      await new Promise(resolve => video.onloadedmetadata = resolve);

      // Capture frame
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);

      // Stop stream
      stream.getTracks().forEach(track => track.stop());

      // Convert to base64
      const base64 = canvas.toDataURL('image/jpeg', 0.7);
      setKycData(prev => ({ ...prev, [field]: base64 }));
      setPreviews(prev => ({ ...prev, [field]: base64 }));

      toast.success('Photo captured!');
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Could not access camera. Please upload a file instead.');
    }
  };

  const handleSubmit = async () => {
    if (step === 1) {
      // Validate Aadhaar
      if (!kycData.aadhaar_number || kycData.aadhaar_number.length !== 12) {
        toast.error('Please enter valid 12-digit Aadhaar number');
        return;
      }
      if (!kycData.aadhaar_front) {
        toast.error('Please upload Aadhaar front image');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      // Validate PAN
      if (!kycData.pan_number || kycData.pan_number.length !== 10) {
        toast.error('Please enter valid 10-character PAN number');
        return;
      }
      if (!kycData.pan_front) {
        toast.error('Please upload PAN card image');
        return;
      }

      // Submit KYC
      setLoading(true);
      try {
        await axios.post(`${API}/api/kyc/submit/${user.uid}`, {
          aadhaar_front_base64: kycData.aadhaar_front,
          aadhaar_back_base64: kycData.aadhaar_back || '',
          aadhaar_number: kycData.aadhaar_number,
          pan_front_base64: kycData.pan_front,
          pan_number: kycData.pan_number.toUpperCase()
        });

        setStep(3);
        toast.success('KYC submitted successfully!');
        if (onSuccess) onSuccess();
      } catch (error) {
        console.error('KYC submission error:', error);
        toast.error(error.response?.data?.detail || 'Failed to submit KYC');
      } finally {
        setLoading(false);
      }
    }
  };

  const renderUploadBox = (field, label, required = true) => (
    <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-purple-400 transition-colors">
      {previews[field] ? (
        <div className="relative">
          <img src={previews[field]} alt={label} className="w-full h-32 object-cover rounded-lg" />
          <button
            onClick={() => {
              setKycData(prev => ({ ...prev, [field]: null }));
              setPreviews(prev => ({ ...prev, [field]: null }));
            }}
            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <>
          <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 mb-3">{label} {required && '*'}</p>
          <div className="flex gap-2 justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRefs[field].current?.click()}
            >
              <Upload className="h-4 w-4 mr-1" />
              Upload
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCameraCapture(field)}
            >
              <Camera className="h-4 w-4 mr-1" />
              Camera
            </Button>
          </div>
          <input
            ref={fileInputRefs[field]}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileSelect(field, e.target.files[0])}
          />
        </>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-xl">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Quick KYC Verification</h2>
              <p className="text-white/80 text-sm">Step {step} of 3</p>
            </div>
          </div>

          {/* Progress */}
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full ${s <= step ? 'bg-white' : 'bg-white/30'}`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Aadhaar Card Details</h3>
              
              <div>
                <Label>Aadhaar Number *</Label>
                <Input
                  type="text"
                  placeholder="Enter 12-digit Aadhaar number"
                  value={kycData.aadhaar_number}
                  onChange={(e) => setKycData({ ...kycData, aadhaar_number: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                  maxLength={12}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {renderUploadBox('aadhaar_front', 'Aadhaar Front')}
                {renderUploadBox('aadhaar_back', 'Aadhaar Back', false)}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">PAN Card Details</h3>
              
              <div>
                <Label>PAN Number *</Label>
                <Input
                  type="text"
                  placeholder="Enter 10-character PAN"
                  value={kycData.pan_number}
                  onChange={(e) => setKycData({ ...kycData, pan_number: e.target.value.toUpperCase().slice(0, 10) })}
                  maxLength={10}
                />
              </div>

              {renderUploadBox('pan_front', 'PAN Card')}
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">KYC Submitted!</h3>
              <p className="text-gray-600 text-sm mb-4">
                Your documents are under review. Processing time: 3-7 days.
              </p>
              <Button onClick={onClose} className="bg-green-600 hover:bg-green-700">
                Done
              </Button>
            </div>
          )}

          {/* Actions */}
          {step < 3 && (
            <div className="flex gap-3 mt-6">
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                  Back
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
              >
                {loading ? (
                  <Loader className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {step === 2 ? 'Submit KYC' : 'Next'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickKYCModal;
