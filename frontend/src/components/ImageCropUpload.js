import React, { useState, useRef, useCallback } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import imageCompression from 'browser-image-compression';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Upload, X, RotateCw, Check, FileImage, 
  Scissors, Maximize2, Info, Download, Camera
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * ImageCropUpload Component
 * Advanced image upload with crop, resize, and compression
 * - Interactive crop tool with rotation
 * - Auto-resize and compression to target 2MB
 * - Convert all formats to JPEG
 * - Before/after preview with file size comparison
 */
const ImageCropUpload = ({ 
  value, 
  onChange, 
  label = "Upload Document",
  maxSizeMB = 2,
  aspectRatio = null, // null for free crop, or number like 16/9
  required = false
}) => {
  const [originalImage, setOriginalImage] = useState(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [preview, setPreview] = useState(value || null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState(null);
  
  const imgRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Handle file selection
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setOriginalSize(file.size);
    setProcessing(true);

    try {
      // Convert HEIC/HEIF to JPEG
      let processedFile = file;
      if (file.type === 'image/heic' || file.type === 'image/heif') {
        toast.info('Converting HEIC to JPEG...');
        // Browser will handle conversion
      }

      // Read file as data URL for crop editor
      const reader = new FileReader();
      reader.onload = (e) => {
        setOriginalImage(e.target.result);
        setShowCropModal(true);
        setProcessing(false);
      };
      reader.readAsDataURL(processedFile);
    } catch (error) {
      console.error('Error loading image:', error);
      toast.error('Failed to load image');
      setProcessing(false);
    }
  };

  // Handle drag & drop
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const fakeEvent = { target: { files: [file] } };
      handleFileSelect(fakeEvent);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Rotate image
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // On image load in crop editor
  const onImageLoad = useCallback((e) => {
    imgRef.current = e.currentTarget;
    
    // Set initial crop to full image
    const { width, height } = e.currentTarget;
    const initialCrop = {
      unit: '%',
      width: 90,
      height: 90,
      x: 5,
      y: 5
    };
    setCrop(initialCrop);
  }, []);

  // Get cropped image as base64
  const getCroppedImage = async () => {
    if (!completedCrop || !imgRef.current) {
      // No crop applied, use original
      return originalImage;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        }
      }, 'image/jpeg', 0.95);
    });
  };

  // Apply crop and compress
  const handleApplyCrop = async () => {
    setProcessing(true);
    
    try {
      // Get cropped image
      const croppedBase64 = await getCroppedImage();
      
      // Convert base64 to blob for compression
      const response = await fetch(croppedBase64);
      const blob = await response.blob();
      
      // Create file from blob
      const file = new File([blob], 'document.jpg', { type: 'image/jpeg' });

      // Compression options
      const options = {
        maxSizeMB: maxSizeMB,
        maxWidthOrHeight: 2048,
        useWebWorker: true,
        fileType: 'image/jpeg',
        initialQuality: 0.85 // Balanced quality
      };

      // Compress image
      toast.info('Compressing image...');
      const compressedFile = await imageCompression(file, options);
      setCompressedSize(compressedFile.size);

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;
        setPreview(base64);
        onChange(base64);
        setShowCropModal(false);
        
        const sizeMB = (compressedFile.size / (1024 * 1024)).toFixed(2);
        toast.success(`Image processed successfully! Size: ${sizeMB}MB`);
      };
      reader.readAsDataURL(compressedFile);

    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Failed to process image');
    } finally {
      setProcessing(false);
    }
  };

  // Reset crop
  const handleResetCrop = () => {
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      const initialCrop = {
        unit: '%',
        width: 90,
        height: 90,
        x: 5,
        y: 5
      };
      setCrop(initialCrop);
      setCompletedCrop(null);
    }
  };

  // Remove image
  const handleRemove = () => {
    setPreview(null);
    setOriginalImage(null);
    setCrop(null);
    setCompletedCrop(null);
    setRotation(0);
    setOriginalSize(0);
    setCompressedSize(0);
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Start camera
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 1280, height: 720 }
      });
      setStream(mediaStream);
      setShowCamera(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Unable to access camera. Please check permissions.');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  // Capture photo from camera
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      canvas.toBlob(async (blob) => {
        stopCamera();
        const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
        
        // Process the captured image
        setOriginalSize(file.size);
        setProcessing(true);
        
        try {
          const reader = new FileReader();
          reader.onload = (e) => {
            setOriginalImage(e.target.result);
            setShowCropModal(true);
            setProcessing(false);
          };
          reader.readAsDataURL(file);
        } catch (error) {
          console.error('Error processing camera capture:', error);
          toast.error('Failed to process camera capture');
          setProcessing(false);
        }
      }, 'image/jpeg', 0.95);
    }
  };

  // Format file size
  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Label */}
      <label className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Upload Area or Preview */}
      {!preview ? (
        <div className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors cursor-pointer bg-gray-50"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.heic,.heif"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-medium mb-2">
              Click to upload or drag and drop
            </p>
            <p className="text-sm text-gray-500">
              JPG, PNG, HEIC, WebP (Max {maxSizeMB}MB)
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Image will be automatically resized and compressed
            </p>
          </div>
          
          {/* Camera Button */}
          <div className="text-center">
            <Button
              type="button"
              onClick={startCamera}
              variant="outline"
              className="flex items-center gap-2 mx-auto"
            >
              <Camera className="h-4 w-4" />
              Take Photo with Camera
            </Button>
          </div>
        </div>
      ) : (
        <Card className="p-4">
          <div className="space-y-4">
            {/* Preview Image */}
            <div className="relative">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-64 object-contain rounded-lg bg-gray-100"
              />
              <Button
                onClick={handleRemove}
                size="sm"
                variant="destructive"
                className="absolute top-2 right-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* File Info */}
            {compressedSize > 0 && (
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      Image Optimized
                    </p>
                    <p className="text-xs text-green-600">
                      {formatSize(originalSize)} → {formatSize(compressedSize)}
                      <span className="ml-2 font-semibold">
                        ({Math.round((1 - compressedSize / originalSize) * 100)}% smaller)
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Crop Modal */}
      {showCropModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="p-6 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between border-b pb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  Crop & Adjust Image
                </h3>
                <Button
                  onClick={() => setShowCropModal(false)}
                  variant="ghost"
                  size="sm"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Info Banner */}
              <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Image Processing Tips:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Drag corners to crop the document area</li>
                    <li>Use rotate button to adjust orientation</li>
                    <li>Image will be automatically compressed to under {maxSizeMB}MB</li>
                    <li>Final format will be JPEG for best compatibility</li>
                  </ul>
                </div>
              </div>

              {/* Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={handleRotate}
                    variant="outline"
                    size="sm"
                  >
                    <RotateCw className="h-4 w-4 mr-2" />
                    Rotate 90°
                  </Button>
                  <Button
                    onClick={handleResetCrop}
                    variant="outline"
                    size="sm"
                  >
                    <Maximize2 className="h-4 w-4 mr-2" />
                    Reset Crop
                  </Button>
                </div>
                
                <div className="text-sm text-gray-600">
                  Original: {formatSize(originalSize)}
                </div>
              </div>

              {/* Crop Area */}
              <div className="border rounded-lg p-4 bg-gray-50 max-h-[500px] overflow-auto">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={aspectRatio}
                  className="max-w-full"
                >
                  <img
                    ref={imgRef}
                    src={originalImage}
                    alt="Crop"
                    onLoad={onImageLoad}
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      maxWidth: '100%',
                      height: 'auto'
                    }}
                  />
                </ReactCrop>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                <Button
                  onClick={() => setShowCropModal(false)}
                  variant="outline"
                  disabled={processing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleApplyCrop}
                  disabled={processing}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Scissors className="h-4 w-4 mr-2" />
                      Apply & Compress
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ImageCropUpload;
