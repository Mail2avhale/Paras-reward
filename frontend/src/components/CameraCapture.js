import { useState, useRef, useEffect } from 'react';
import { Camera, X, RotateCcw, Upload, FlipHorizontal, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const CameraCapture = ({ onCapture, onClose, label = "Capture Photo", defaultFacingMode = "user" }) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [facingMode, setFacingMode] = useState(defaultFacingMode); // 'user' for front (default for selfies), 'environment' for back
  const [error, setError] = useState(null);
  const [uploadMode, setUploadMode] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!uploadMode && !capturedImage) {
      startCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [facingMode, uploadMode, capturedImage]);

  const startCamera = async () => {
    try {
      setError(null);
      
      // Stop existing stream
      stopCamera();
      
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this browser');
      }
      
      // Request camera access with multiple attempts
      let stream;
      try {
        // Try with specific facing mode
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
      } catch (err) {
        console.warn('Failed with specific facing mode, trying any camera:', err);
        // Fallback: try any camera
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
      }
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
            .then(() => {
              setIsStreaming(true);
            })
            .catch(err => {
              console.error('Video play error:', err);
              setError('Unable to start camera. Please try again or use file upload.');
            });
        };
      }
    } catch (err) {
      console.error('Camera error:', err);
      
      let errorMessage = 'Unable to access camera. ';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage += 'Camera permission denied. Please enable camera in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage += 'No camera found on this device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage += 'Camera is already in use by another application.';
      } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
        errorMessage += 'Camera does not support the requested settings.';
      } else {
        errorMessage += 'Please check permissions or use file upload.';
      }
      
      setError(errorMessage);
      setIsStreaming(false);
      setUploadMode(true); // Auto-switch to upload mode on error
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to base64
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    
    // Compress image
    compressImage(imageData, (compressed) => {
      setCapturedImage(compressed);
      stopCamera();
    });
  };

  const compressImage = (base64, callback) => {
    const img = new Image();
    img.src = base64;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      // Calculate max dimensions to keep under 2MB
      const maxSize = 2 * 1024 * 1024; // 2MB in bytes
      let quality = 0.9;
      
      // Resize if too large
      const maxDimension = 1920;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension;
          width = maxDimension;
        } else {
          width = (width / height) * maxDimension;
          height = maxDimension;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      // Compress until under 2MB
      let compressed = canvas.toDataURL('image/jpeg', quality);
      
      while (compressed.length > maxSize && quality > 0.1) {
        quality -= 0.1;
        compressed = canvas.toDataURL('image/jpeg', quality);
      }
      
      callback(compressed);
    };
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      compressImage(event.target.result, (compressed) => {
        setCapturedImage(compressed);
      });
    };
    reader.readAsDataURL(file);
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const retake = () => {
    setCapturedImage(null);
    setUploadMode(false);
    startCamera();
  };

  const confirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-white rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">{label}</h3>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Camera/Upload Toggle */}
          {!capturedImage && !isStreaming && !error && (
            <div className="flex gap-3 mb-4">
              <Button
                onClick={() => {
                  setUploadMode(false);
                  setError(null);
                }}
                className={`flex-1 ${!uploadMode ? 'bg-indigo-600' : 'bg-gray-200 text-gray-700'}`}
              >
                <Camera className="h-5 w-5 mr-2" />
                Use Camera
              </Button>
              <Button
                onClick={() => {
                  setUploadMode(true);
                  stopCamera();
                  setError(null);
                  fileInputRef.current?.click();
                }}
                className={`flex-1 ${uploadMode ? 'bg-indigo-600' : 'bg-gray-200 text-gray-700'}`}
              >
                <Upload className="h-5 w-5 mr-2" />
                Upload File
              </Button>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Camera View */}
          {!capturedImage && !uploadMode && (
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {isStreaming && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                  <div className="flex items-center justify-center gap-4">
                    {/* Switch Camera Button (Mobile) */}
                    <button
                      onClick={switchCamera}
                      className="p-3 bg-white/20 hover:bg-white/30 rounded-full text-white"
                      title="Switch Camera"
                    >
                      <FlipHorizontal className="h-6 w-6" />
                    </button>

                    {/* Capture Button */}
                    <button
                      onClick={capturePhoto}
                      className="w-16 h-16 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                    >
                      <div className="w-14 h-14 bg-indigo-600 rounded-full" />
                    </button>

                    {/* Spacer for symmetry */}
                    <div className="w-12" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preview Captured Image */}
          {capturedImage && (
            <div className="space-y-4">
              <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="w-full h-auto"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={retake}
                  variant="outline"
                  className="flex-1"
                >
                  <RotateCcw className="h-5 w-5 mr-2" />
                  Retake
                </Button>
                <Button
                  onClick={confirm}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-5 w-5 mr-2" />
                  Use This Photo
                </Button>
              </div>
            </div>
          )}

          {/* Instructions */}
          {!capturedImage && !error && (
            <div className="mt-4 text-sm text-gray-600 text-center">
              <p>• Position the document clearly in the frame</p>
              <p>• Ensure good lighting</p>
              <p>• Avoid glare and shadows</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default CameraCapture;
