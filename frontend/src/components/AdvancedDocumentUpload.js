import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, RotateCw, RotateCcw, Sun, Contrast, Check, X, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

const AdvancedDocumentUpload = ({ 
  onChange, 
  label = 'Upload Document',
  aspectRatio = 1.6,
  maxSizeMB = 5
}) => {
  const [image, setImage] = useState(null);
  const [adjustedImage, setAdjustedImage] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // Image adjustments
  const [adjustments, setAdjustments] = useState({
    brightness: 100,
    contrast: 100,
    rotation: 0,
    zoom: 1
  });
  
  // Separate refs for camera and gallery inputs
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // Handle camera capture - uses native device camera
  const handleCameraCapture = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  // Handle gallery selection - opens file picker
  const handleGallerySelect = () => {
    if (galleryInputRef.current) {
      galleryInputRef.current.click();
    }
  };

  // Process captured/selected image
  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setProcessing(true);

    try {
      // Compress and resize image automatically
      const compressedImage = await compressImage(file, maxSizeMB);
      setImage(compressedImage);
      setShowEditor(true);
      autoAdjustImage(compressedImage);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Could not process image');
    } finally {
      setProcessing(false);
      // Reset both inputs to allow re-selection
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  // Compress image to target size
  const compressImage = (file, targetSizeMB) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          
          // Calculate new dimensions (max 1600px on longest side)
          const maxDim = 1600;
          let width = img.width;
          let height = img.height;
          
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = (height / width) * maxDim;
              width = maxDim;
            } else {
              width = (width / height) * maxDim;
              height = maxDim;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Start with high quality and reduce if needed
          let quality = 0.9;
          let result = canvas.toDataURL('image/jpeg', quality);
          
          // Reduce quality until under target size
          while (result.length > targetSizeMB * 1024 * 1024 * 1.37 && quality > 0.3) {
            quality -= 0.1;
            result = canvas.toDataURL('image/jpeg', quality);
          }
          
          resolve(result);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Auto adjust image (brightness/contrast optimization)
  const autoAdjustImage = useCallback(async (imageData) => {
    setProcessing(true);
    
    try {
      // Create image for analysis
      const img = new Image();
      img.src = imageData;
      
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      
      // Create canvas for analysis
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      // Get image data for analysis
      const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageDataObj.data;
      
      // Calculate average brightness
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      const avgBrightness = totalBrightness / (data.length / 4);
      
      // Auto-adjust based on brightness
      let newBrightness = 100;
      let newContrast = 100;
      
      if (avgBrightness < 100) {
        newBrightness = Math.min(140, 100 + (100 - avgBrightness) * 0.5);
        newContrast = Math.min(120, 100 + (100 - avgBrightness) * 0.3);
      } else if (avgBrightness > 180) {
        newBrightness = Math.max(80, 100 - (avgBrightness - 180) * 0.3);
      }
      
      setAdjustments(prev => ({
        ...prev,
        brightness: Math.round(newBrightness),
        contrast: Math.round(newContrast)
      }));
      
      // Apply adjustments
      applyAdjustments(imageData, {
        brightness: Math.round(newBrightness),
        contrast: Math.round(newContrast),
        rotation: 0,
        zoom: 1
      });
      
      toast.success('Image auto-optimized!');
    } catch (error) {
      console.error('Auto adjust error:', error);
      setAdjustedImage(imageData);
    } finally {
      setProcessing(false);
    }
  }, []);

  // Apply manual adjustments
  const applyAdjustments = (sourceImage, adj) => {
    const img = new Image();
    img.src = sourceImage;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const rotated = adj.rotation % 180 !== 0;
      
      canvas.width = rotated ? img.height : img.width;
      canvas.height = rotated ? img.width : img.height;
      
      const ctx = canvas.getContext('2d');
      
      // Apply rotation
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((adj.rotation * Math.PI) / 180);
      ctx.translate(-img.width / 2, -img.height / 2);
      
      // Apply zoom
      if (adj.zoom !== 1) {
        const scale = adj.zoom;
        const offsetX = (img.width - img.width * scale) / 2;
        const offsetY = (img.height - img.height * scale) / 2;
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
      }
      
      // Apply filters
      ctx.filter = `brightness(${adj.brightness}%) contrast(${adj.contrast}%)`;
      ctx.drawImage(img, 0, 0);
      
      setAdjustedImage(canvas.toDataURL('image/jpeg', 0.9));
    };
  };

  // Handle adjustment change
  const handleAdjustmentChange = (key, value) => {
    const newAdj = { ...adjustments, [key]: value };
    setAdjustments(newAdj);
    if (image) {
      applyAdjustments(image, newAdj);
    }
  };

  // Confirm and save
  const handleConfirm = () => {
    const finalImage = adjustedImage || image;
    if (finalImage && onChange) {
      onChange(finalImage);
      toast.success('Document saved!');
    }
    setShowEditor(false);
    setImage(null);
    setAdjustedImage(null);
    setAdjustments({ brightness: 100, contrast: 100, rotation: 0, zoom: 1 });
  };

  // Reset adjustments
  const handleReset = () => {
    setAdjustments({ brightness: 100, contrast: 100, rotation: 0, zoom: 1 });
    if (image) {
      autoAdjustImage(image);
    }
  };

  // Cancel and close
  const handleCancel = () => {
    setShowEditor(false);
    setImage(null);
    setAdjustedImage(null);
    setAdjustments({ brightness: 100, contrast: 100, rotation: 0, zoom: 1 });
  };

  return (
    <div className="w-full">
      {/* Hidden file inputs - SEPARATE for camera and gallery */}
      
      {/* Camera Input - uses native camera app via capture attribute */}
      <input 
        ref={cameraInputRef}
        type="file" 
        accept="image/*"
        capture="environment"
        onChange={handleImageSelect}
        className="hidden"
        data-testid="camera-input"
      />
      
      {/* Gallery Input - NO capture attribute, opens file picker */}
      <input 
        ref={galleryInputRef}
        type="file" 
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
        data-testid="gallery-input"
      />

      {/* Editor View */}
      {showEditor && (
        <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
          {/* Preview */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            {processing ? (
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-white">Processing...</p>
              </div>
            ) : (
              <img 
                src={adjustedImage || image} 
                alt="Preview" 
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            )}
          </div>
          
          {/* Controls */}
          <div className="bg-gray-900 p-4 space-y-4">
            {/* Brightness */}
            <div className="flex items-center gap-3">
              <Sun className="w-5 h-5 text-amber-500" />
              <input 
                type="range" 
                min="50" max="150" 
                value={adjustments.brightness}
                onChange={(e) => handleAdjustmentChange('brightness', parseInt(e.target.value))}
                className="flex-1 accent-amber-500"
              />
              <span className="text-white text-sm w-10">{adjustments.brightness}%</span>
            </div>
            
            {/* Contrast */}
            <div className="flex items-center gap-3">
              <Contrast className="w-5 h-5 text-blue-500" />
              <input 
                type="range" 
                min="50" max="150" 
                value={adjustments.contrast}
                onChange={(e) => handleAdjustmentChange('contrast', parseInt(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-white text-sm w-10">{adjustments.contrast}%</span>
            </div>
            
            {/* Quick actions */}
            <div className="flex items-center justify-center gap-4">
              <button 
                onClick={() => handleAdjustmentChange('rotation', (adjustments.rotation - 90) % 360)}
                className="p-3 bg-gray-800 rounded-xl text-white hover:bg-gray-700"
                data-testid="rotate-left-btn"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button 
                onClick={() => handleAdjustmentChange('rotation', (adjustments.rotation + 90) % 360)}
                className="p-3 bg-gray-800 rounded-xl text-white hover:bg-gray-700"
                data-testid="rotate-right-btn"
              >
                <RotateCw className="w-5 h-5" />
              </button>
              <button 
                onClick={handleReset}
                className="p-3 bg-gray-800 rounded-xl text-white hover:bg-gray-700"
                data-testid="reset-adjustments-btn"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
            
            {/* Action buttons */}
            <div className="flex gap-3">
              <button 
                onClick={handleCancel}
                className="flex-1 py-3 bg-gray-800 text-white rounded-xl font-medium"
                data-testid="cancel-edit-btn"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirm}
                disabled={processing}
                className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black rounded-xl font-bold flex items-center justify-center gap-2"
                data-testid="save-document-btn"
              >
                <Check className="w-5 h-5" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Default Upload UI */}
      {!showEditor && (
        <div className="space-y-3">
          <p className="text-gray-400 text-sm font-medium">{label}</p>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Camera Button - Opens native camera app */}
            <button
              onClick={handleCameraCapture}
              disabled={processing}
              className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/50 rounded-xl hover:bg-amber-500/30 transition-all"
              data-testid="use-camera-btn"
            >
              {processing ? (
                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-2"></div>
              ) : (
                <Camera className="w-8 h-8 text-amber-500 mb-2" />
              )}
              <span className="text-amber-400 text-sm font-medium">Use Camera</span>
            </button>
            
            {/* Gallery Button - Opens file picker */}
            <button
              onClick={handleGallerySelect}
              disabled={processing}
              className="flex flex-col items-center justify-center p-4 bg-gray-800/50 border border-gray-700 rounded-xl hover:bg-gray-700/50 transition-all"
              data-testid="use-gallery-btn"
            >
              {processing ? (
                <div className="w-8 h-8 border-2 border-gray-500 border-t-amber-500 rounded-full animate-spin mb-2"></div>
              ) : (
                <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
              )}
              <span className="text-gray-400 text-sm font-medium">Gallery</span>
            </button>
          </div>
          
          <p className="text-gray-600 text-xs text-center">
            Auto image optimization • Max {maxSizeMB}MB • JPG, PNG
          </p>
        </div>
      )}
    </div>
  );
};

export default AdvancedDocumentUpload;
