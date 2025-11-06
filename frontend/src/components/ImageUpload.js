import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, Image as ImageIcon, Camera } from 'lucide-react';
import CameraCapture from './CameraCapture';

/**
 * ImageUpload Component
 * Converts uploaded images to base64 for storage
 * Supports drag & drop, file selection, and preview
 */
const ImageUpload = ({ 
  value, 
  onChange, 
  label = "Upload Image",
  maxSize = 5, // MB
  aspectRatio = "square", // square, video, auto
  required = false,
  enableCamera = true // Enable camera capture
}) => {
  const [preview, setPreview] = useState(value || null);
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef(null);

  // Sync preview with value prop
  useEffect(() => {
    setPreview(value || null);
  }, [value]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      alert(`Image size must be less than ${maxSize}MB`);
      return;
    }

    setUploading(true);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        setPreview(base64String);
        onChange(base64String);
        setUploading(false);
      };
      reader.onerror = () => {
        alert('Failed to read file');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCameraCapture = (base64Image) => {
    setPreview(base64Image);
    onChange(base64Image);
  };

  const getAspectRatioClass = () => {
    switch(aspectRatio) {
      case 'square': return 'aspect-square';
      case 'video': return 'aspect-video';
      default: return 'aspect-auto';
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      {preview ? (
        <div className="relative">
          <div className={`w-full ${getAspectRatioClass()} max-w-sm border-2 border-gray-200 rounded-lg overflow-hidden`}>
            <img 
              src={preview} 
              alt="Preview" 
              className="w-full h-full object-cover"
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <div className={`w-full ${getAspectRatioClass()} max-w-sm border-2 border-dashed border-gray-300 rounded-lg overflow-hidden`}>
            <div className="h-full flex flex-col items-center justify-center p-6 text-gray-400 bg-gray-50">
              {uploading ? (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm">Processing...</p>
                </div>
              ) : (
                <>
                  <ImageIcon className="h-12 w-12 mb-4 text-gray-300" />
                  <p className="text-sm font-medium text-gray-600 mb-4">Choose how to upload</p>
                  
                  <div className="flex gap-3 w-full max-w-xs">
                    {enableCamera && (
                      <Button
                        type="button"
                        onClick={() => setShowCamera(true)}
                        className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Camera
                      </Button>
                    )}
                    <Button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                      className={enableCamera ? 'flex-1' : 'w-full'}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                  </div>
                  
                  <p className="text-xs mt-4 text-gray-500">Max size: {maxSize}MB</p>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Camera Capture Modal */}
      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
          label={label}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        required={required && !preview}
      />
      
      <p className="text-xs text-gray-500">
        Supported formats: JPG, PNG, GIF, WebP
      </p>
    </div>
  );
};

export default ImageUpload;
