import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, RotateCw, RotateCcw, ZoomIn, ZoomOut, Sun, Contrast, Check, X, RefreshCw, Crop } from 'lucide-react';
import { toast } from 'sonner';

const AdvancedDocumentUpload = ({ 
  onChange, 
  label = 'Upload Document',
  aspectRatio = 1.6,
  maxSizeMB = 2 
}) => {
  const [image, setImage] = useState(null);
  const [adjustedImage, setAdjustedImage] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // Image adjustments
  const [adjustments, setAdjustments] = useState({
    brightness: 100,
    contrast: 100,
    rotation: 0,
    zoom: 1
  });
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Start camera
  const startCamera = async () => {
    try {
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Camera not supported on this device. Please use file upload.');
        return;
      }

      // Request camera permission with fallback options
      let stream;
      try {
        // Try rear camera first (for documents)
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
      } catch (envError) {
        console.log('Rear camera failed, trying any camera:', envError);
        // Fallback to any available camera
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: true 
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Ensure video plays
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.log('Auto-play handled by autoPlay attribute');
        }
      }
      setShowCamera(true);
    } catch (error) {
      console.error('Camera error:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        toast.error('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        toast.error('No camera found on this device. Please use file upload.');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        toast.error('Camera is in use by another app. Please close other apps and try again.');
      } else {
        toast.error('Unable to access camera. Please use file upload instead.');
      }
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  // Capture photo from camera
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setImage(imageData);
    stopCamera();
    setShowEditor(true);
    autoAdjustImage(imageData);
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File size should be less than ${maxSizeMB}MB`);
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target.result;
      setImage(imageData);
      setShowEditor(true);
      autoAdjustImage(imageData);
    };
    reader.readAsDataURL(file);
  };

  // Auto-adjust image for document scanning
  const autoAdjustImage = useCallback((imageData) => {
    setProcessing(true);
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw image
      ctx.drawImage(img, 0, 0);
      
      // Get image data for analysis
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      
      // Calculate average brightness
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      const avgBrightness = totalBrightness / (data.length / 4);
      
      // Auto-adjust based on analysis
      let newBrightness = 100;
      let newContrast = 100;
      
      // If image is too dark, increase brightness
      if (avgBrightness < 100) {
        newBrightness = Math.min(150, 100 + (100 - avgBrightness) / 2);
      }
      // If image is too bright, decrease slightly
      else if (avgBrightness > 180) {
        newBrightness = Math.max(80, 100 - (avgBrightness - 180) / 3);
      }
      
      // Increase contrast for better document readability
      newContrast = 115;
      
      setAdjustments(prev => ({
        ...prev,
        brightness: Math.round(newBrightness),
        contrast: Math.round(newContrast)
      }));
      
      setProcessing(false);
    };
    img.src = imageData;
  }, []);

  // Apply adjustments and generate final image
  const applyAdjustments = useCallback(() => {
    if (!image) return;
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Handle rotation
      const radians = adjustments.rotation * Math.PI / 180;
      const cos = Math.abs(Math.cos(radians));
      const sin = Math.abs(Math.sin(radians));
      
      // Calculate new dimensions after rotation
      const newWidth = img.width * cos + img.height * sin;
      const newHeight = img.width * sin + img.height * cos;
      
      // Apply zoom
      canvas.width = newWidth * adjustments.zoom;
      canvas.height = newHeight * adjustments.zoom;
      
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(radians);
      ctx.scale(adjustments.zoom, adjustments.zoom);
      
      // Apply filters
      ctx.filter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%)`;
      
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      
      const finalImage = canvas.toDataURL('image/jpeg', 0.9);
      setAdjustedImage(finalImage);
    };
    img.src = image;
  }, [image, adjustments]);

  // Apply adjustments when they change
  useEffect(() => {
    if (image && showEditor) {
      applyAdjustments();
    }
  }, [image, adjustments, showEditor, applyAdjustments]);

  // Confirm and save
  const handleConfirm = () => {
    if (adjustedImage) {
      onChange(adjustedImage);
      setShowEditor(false);
      setImage(null);
      setAdjustedImage(null);
      toast.success('Document uploaded successfully!');
    }
  };

  // Reset adjustments
  const resetAdjustments = () => {
    setAdjustments({
      brightness: 100,
      contrast: 100,
      rotation: 0,
      zoom: 1
    });
    if (image) {
      autoAdjustImage(image);
    }
  };

  // Cancel and close
  const handleCancel = () => {
    setShowEditor(false);
    setImage(null);
    setAdjustedImage(null);
    stopCamera();
    setAdjustments({
      brightness: 100,
      contrast: 100,
      rotation: 0,
      zoom: 1
    });
  };

  return (
    <div className="w-full">
      {/* Hidden elements */}
      <input 
        ref={fileInputRef}
        type="file" 
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera View */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex-1 relative">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Document frame guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div 
                className="border-2 border-amber-500 rounded-lg"
                style={{
                  width: '85%',
                  aspectRatio: aspectRatio,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)'
                }}
              >
                <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-amber-500"></div>
                <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-amber-500"></div>
                <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-amber-500"></div>
                <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-amber-500"></div>
              </div>
            </div>
            <p className="absolute top-4 left-0 right-0 text-center text-white text-sm bg-black/50 py-2">
              Align document within the frame
            </p>
          </div>
          <div className="bg-black p-4 flex items-center justify-center gap-8">
            <button 
              onClick={stopCamera}
              className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <button 
              onClick={capturePhoto}
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center"
            >
              <div className="w-16 h-16 rounded-full border-4 border-gray-900"></div>
            </button>
            <div className="w-14 h-14"></div>
          </div>
        </div>
      )}

      {/* Editor View */}
      {showEditor && (
        <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-800">
            <button onClick={handleCancel} className="text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-white font-bold">Adjust Document</h3>
            <button onClick={resetAdjustments} className="text-amber-500 hover:text-amber-400">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {/* Preview */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden bg-gray-900">
            {processing ? (
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-gray-400 text-sm">Auto-adjusting...</p>
              </div>
            ) : (
              <img 
                src={adjustedImage || image} 
                alt="Preview"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                style={{
                  maxHeight: 'calc(100vh - 300px)'
                }}
              />
            )}
          </div>

          {/* Controls */}
          <div className="bg-gray-900 border-t border-gray-800 p-4 space-y-4">
            {/* Brightness */}
            <div className="flex items-center gap-3">
              <Sun className="w-5 h-5 text-amber-500" />
              <input
                type="range"
                min="50"
                max="150"
                value={adjustments.brightness}
                onChange={(e) => setAdjustments(prev => ({ ...prev, brightness: parseInt(e.target.value) }))}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <span className="text-white text-sm w-10 text-right">{adjustments.brightness}%</span>
            </div>

            {/* Contrast */}
            <div className="flex items-center gap-3">
              <Contrast className="w-5 h-5 text-blue-500" />
              <input
                type="range"
                min="50"
                max="150"
                value={adjustments.contrast}
                onChange={(e) => setAdjustments(prev => ({ ...prev, contrast: parseInt(e.target.value) }))}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <span className="text-white text-sm w-10 text-right">{adjustments.contrast}%</span>
            </div>

            {/* Rotation & Zoom */}
            <div className="flex items-center justify-center gap-4">
              <button 
                onClick={() => setAdjustments(prev => ({ ...prev, rotation: prev.rotation - 90 }))}
                className="p-3 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors"
              >
                <RotateCcw className="w-5 h-5 text-white" />
              </button>
              <button 
                onClick={() => setAdjustments(prev => ({ ...prev, rotation: prev.rotation + 90 }))}
                className="p-3 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors"
              >
                <RotateCw className="w-5 h-5 text-white" />
              </button>
              <div className="w-px h-8 bg-gray-700"></div>
              <button 
                onClick={() => setAdjustments(prev => ({ ...prev, zoom: Math.max(0.5, prev.zoom - 0.1) }))}
                className="p-3 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors"
              >
                <ZoomOut className="w-5 h-5 text-white" />
              </button>
              <button 
                onClick={() => setAdjustments(prev => ({ ...prev, zoom: Math.min(2, prev.zoom + 0.1) }))}
                className="p-3 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors"
              >
                <ZoomIn className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Confirm Button */}
          <div className="p-4 bg-gray-900">
            <button
              onClick={handleConfirm}
              disabled={processing}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-gray-900 font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check className="w-5 h-5" />
              Confirm & Save
            </button>
          </div>
        </div>
      )}

      {/* Main Upload UI */}
      {!showCamera && !showEditor && (
        <div className="space-y-3">
          {/* Camera Button */}
          <button
            onClick={startCamera}
            className="w-full py-4 bg-gradient-to-r from-amber-500/20 to-amber-600/10 border-2 border-dashed border-amber-500/50 rounded-xl flex items-center justify-center gap-3 hover:border-amber-500 transition-colors"
          >
            <Camera className="w-6 h-6 text-amber-500" />
            <span className="text-amber-400 font-medium">Take Photo with Camera</span>
          </button>

          {/* File Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-4 bg-gray-800/50 border border-gray-700 rounded-xl flex items-center justify-center gap-3 hover:border-gray-600 transition-colors"
          >
            <Upload className="w-5 h-5 text-gray-400" />
            <span className="text-gray-400">Upload from Gallery</span>
          </button>

          <p className="text-center text-gray-600 text-xs">
            Auto image enhancement • Max {maxSizeMB}MB • JPG, PNG
          </p>
        </div>
      )}
    </div>
  );
};

export default AdvancedDocumentUpload;
