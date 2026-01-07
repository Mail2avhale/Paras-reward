import { useState, useRef } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import ModernImageUpload from '@/components/ModernImageUpload';
import { 
  Scan, Camera, Upload, CheckCircle2, Loader2, 
  User, CreditCard, Calendar, MapPin, Sparkles,
  AlertCircle, RefreshCw, FileCheck, Edit3
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AIDocumentScanner = ({ user, onProfileUpdate }) => {
  const [step, setStep] = useState('select'); // select, upload, scanning, result, edit
  const [documentType, setDocumentType] = useState('');
  const [imageBase64, setImageBase64] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [editedData, setEditedData] = useState({});
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('कृपया JPG, PNG किंवा WEBP format वापरा');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image 10MB पेक्षा कमी असावी');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      setImageBase64(base64);
      setImagePreview(reader.result);
      setStep('preview');
    };
    reader.readAsDataURL(file);
  };

  const handleScan = async () => {
    if (!imageBase64 || !documentType) return;

    setStep('scanning');
    setIsScanning(true);

    try {
      const response = await axios.post(`${API}/ai/scan-and-update-profile`, null, {
        params: {
          uid: user.uid,
          document_type: documentType,
          image_base64: imageBase64,
          auto_update: false // Don't auto-update, let user verify first
        }
      });

      setScanResult(response.data);
      setEditedData(response.data.extracted_data || {});
      setStep('result');

      if (response.data.success) {
        toast.success('🎉 Document scanned successfully!');
      } else {
        toast.error(response.data.message || 'Scan failed');
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Scan failed. Please try again.');
      setStep('preview');
    } finally {
      setIsScanning(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      // Update user profile with edited data
      const updateData = { ...scanResult.profile_updates };
      
      // Apply any edits user made
      if (editedData.full_name) updateData.name = editedData.full_name;
      if (editedData.date_of_birth) updateData.dob = editedData.date_of_birth;
      if (editedData.gender) updateData.gender = editedData.gender;
      if (editedData.address) updateData.address = editedData.address;
      if (editedData.father_name) updateData.father_name = editedData.father_name;

      await axios.put(`${API}/users/${user.uid}/profile`, updateData);
      
      toast.success('✅ Profile updated successfully!');
      
      if (onProfileUpdate) {
        onProfileUpdate(updateData);
      }
      
      // Reset
      resetScanner();
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Profile update failed');
    }
  };

  const resetScanner = () => {
    setStep('select');
    setDocumentType('');
    setImageBase64(null);
    setImagePreview(null);
    setScanResult(null);
    setEditedData({});
  };

  const renderSelectStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="mx-auto w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mb-4">
          <Scan className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">AI Document Scanner</h2>
        <p className="text-gray-600 mt-2">
          Document upload करा → AI automatically details वाचेल → Profile auto-fill होईल
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Aadhaar Card */}
        <button
          onClick={() => { setDocumentType('aadhaar'); setStep('upload'); }}
          className="p-6 border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl hover:shadow-lg hover:border-orange-400 transition-all group"
        >
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <CreditCard className="h-8 w-8 text-white" />
            </div>
            <h3 className="font-bold text-lg text-orange-900">Aadhaar Card</h3>
            <p className="text-sm text-orange-700 mt-1">आधार कार्ड scan करा</p>
            <div className="mt-3 text-xs text-orange-600 space-y-1">
              <p>✓ नाव, जन्मतारीख extract</p>
              <p>✓ Address auto-fill</p>
              <p>✓ Gender detect</p>
            </div>
          </div>
        </button>

        {/* PAN Card */}
        <button
          onClick={() => { setDocumentType('pan'); setStep('upload'); }}
          className="p-6 border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl hover:shadow-lg hover:border-blue-400 transition-all group"
        >
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <CreditCard className="h-8 w-8 text-white" />
            </div>
            <h3 className="font-bold text-lg text-blue-900">PAN Card</h3>
            <p className="text-sm text-blue-700 mt-1">पॅन कार्ड scan करा</p>
            <div className="mt-3 text-xs text-blue-600 space-y-1">
              <p>✓ नाव, PAN number extract</p>
              <p>✓ Father's name auto-fill</p>
              <p>✓ DOB detect</p>
            </div>
          </div>
        </button>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mt-6">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-purple-600 mt-0.5" />
          <div>
            <p className="font-semibold text-purple-900">AI-Powered Scanning</p>
            <p className="text-sm text-purple-700 mt-1">
              Advanced AI तुमचे documents scan करून सगळी माहिती automatically extract करेल. 
              तुम्हाला manually type करायची गरज नाही!
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderUploadStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Camera className="w-6 h-6 text-purple-600" />
          {documentType === 'aadhaar' ? 'Aadhaar Card' : 'PAN Card'} Upload करा
        </h3>
        <Button variant="outline" size="sm" onClick={resetScanner}>
          ← Back
        </Button>
      </div>

      <div 
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-400 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageUpload}
          className="hidden"
        />
        <div className="space-y-4">
          <div className="mx-auto w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center">
            <Upload className="w-10 h-10 text-purple-600" />
          </div>
          <div>
            <p className="text-lg font-medium text-gray-700">
              Click to upload या drag & drop करा
            </p>
            <p className="text-sm text-gray-500 mt-1">
              JPG, PNG, WEBP • Max 10MB
            </p>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-semibold">Tips for best results:</p>
            <ul className="mt-1 space-y-1">
              <li>• Document सरळ आणि पूर्ण दिसायला हवे</li>
              <li>• चांगल्या lighting मध्ये photo काढा</li>
              <li>• Blur किंवा धूसर photo टाळा</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileCheck className="w-6 h-6 text-purple-600" />
          Document Preview
        </h3>
        <Button variant="outline" size="sm" onClick={() => setStep('upload')}>
          ← Change Image
        </Button>
      </div>

      <div className="flex justify-center">
        <img 
          src={imagePreview} 
          alt="Document preview" 
          className="max-h-64 rounded-xl shadow-lg border-4 border-white"
        />
      </div>

      <div className="flex gap-4">
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={() => { setImageBase64(null); setImagePreview(null); setStep('upload'); }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          दुसरी Image
        </Button>
        <Button 
          className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          onClick={handleScan}
        >
          <Scan className="w-4 h-4 mr-2" />
          AI Scan Start करा
        </Button>
      </div>
    </div>
  );

  const renderScanningStep = () => (
    <div className="text-center py-12">
      <div className="mx-auto w-24 h-24 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <Scan className="w-12 h-12 text-white animate-spin" style={{ animationDuration: '3s' }} />
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-2">AI Scanning...</h3>
      <p className="text-gray-600 mb-4">
        Document analyze करत आहे आणि details extract करत आहे
      </p>
      <div className="flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div 
            key={i} 
            className="w-3 h-3 bg-purple-600 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <p className="text-sm text-gray-500 mt-6">कृपया थांबा... 10-15 seconds लागतील</p>
    </div>
  );

  const renderResultStep = () => {
    const extracted = scanResult?.extracted_data || {};
    const confidence = scanResult?.confidence || 0;
    const isSuccess = scanResult?.success;

    return (
      <div className="space-y-6">
        <div className={`p-4 rounded-xl ${isSuccess ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center gap-3">
            {isSuccess ? (
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            ) : (
              <AlertCircle className="w-8 h-8 text-red-600" />
            )}
            <div>
              <p className={`font-bold text-lg ${isSuccess ? 'text-green-900' : 'text-red-900'}`}>
                {isSuccess ? '✅ Document Scanned Successfully!' : '❌ Scan Failed'}
              </p>
              <p className={`text-sm ${isSuccess ? 'text-green-700' : 'text-red-700'}`}>
                {scanResult?.message}
              </p>
              {isSuccess && (
                <p className="text-sm text-green-600 mt-1">
                  Confidence: {confidence}%
                </p>
              )}
            </div>
          </div>
        </div>

        {isSuccess && (
          <>
            <div className="bg-white border rounded-xl p-6 space-y-4">
              <h4 className="font-bold text-gray-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-purple-600" />
                Extracted Details (Edit करा आवश्यक असल्यास)
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <User className="w-4 h-4 inline mr-1" /> Full Name
                  </label>
                  <Input
                    value={editedData.full_name || ''}
                    onChange={(e) => setEditedData(prev => ({ ...prev, full_name: e.target.value }))}
                    className="w-full"
                  />
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" /> Date of Birth
                  </label>
                  <Input
                    value={editedData.date_of_birth || ''}
                    onChange={(e) => setEditedData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                    className="w-full"
                  />
                </div>

                {/* Document Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <CreditCard className="w-4 h-4 inline mr-1" /> 
                    {documentType === 'aadhaar' ? 'Aadhaar Number' : 'PAN Number'}
                  </label>
                  <Input
                    value={documentType === 'aadhaar' ? (editedData.aadhaar_number || '') : (editedData.pan_number || '')}
                    onChange={(e) => setEditedData(prev => ({ 
                      ...prev, 
                      [documentType === 'aadhaar' ? 'aadhaar_number' : 'pan_number']: e.target.value 
                    }))}
                    className="w-full font-mono"
                  />
                </div>

                {/* Gender (Aadhaar only) */}
                {documentType === 'aadhaar' && extracted.gender && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                    <Input
                      value={editedData.gender || ''}
                      onChange={(e) => setEditedData(prev => ({ ...prev, gender: e.target.value }))}
                      className="w-full"
                    />
                  </div>
                )}

                {/* Father's Name */}
                {extracted.father_name && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Father's Name</label>
                    <Input
                      value={editedData.father_name || ''}
                      onChange={(e) => setEditedData(prev => ({ ...prev, father_name: e.target.value }))}
                      className="w-full"
                    />
                  </div>
                )}

                {/* Address (Aadhaar only) */}
                {documentType === 'aadhaar' && extracted.address && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <MapPin className="w-4 h-4 inline mr-1" /> Address
                    </label>
                    <Input
                      value={editedData.address || ''}
                      onChange={(e) => setEditedData(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={resetScanner}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                onClick={handleUpdateProfile}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Profile Update करा
              </Button>
            </div>
          </>
        )}

        {!isSuccess && (
          <div className="flex gap-4">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={resetScanner}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1 bg-purple-600 hover:bg-purple-700"
              onClick={() => setStep('upload')}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              पुन्हा प्रयत्न करा
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="p-6 bg-white shadow-xl rounded-2xl">
      {step === 'select' && renderSelectStep()}
      {step === 'upload' && renderUploadStep()}
      {step === 'preview' && renderPreviewStep()}
      {step === 'scanning' && renderScanningStep()}
      {step === 'result' && renderResultStep()}
    </Card>
  );
};

export default AIDocumentScanner;
