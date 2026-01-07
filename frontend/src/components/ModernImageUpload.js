import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  Camera, Upload, X, RotateCw, ZoomIn, ZoomOut, 
  Check, RefreshCw, Image as ImageIcon, Smartphone
} from 'lucide-react';

/**
 * Modern Image Upload Component for KYC Documents
 * Features:
 * - Camera capture with proper permissions
 * - Gallery upload
 * - Auto compression & resize
 * - Preview with zoom/rotate
 * - Mobile optimized
 */
const ModernImageUpload = ({ 
  onImageCapture, 
  maxSizeMB = 2,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.8,
  label = "Upload Document",
  acceptTypes = "image/jpeg,image/png,image/webp,image/heic",
  showCamera = true,
  className = ""
}) => {
  const [mode, setMode] = useState('select'); // select, camera, preview
  const [imageData, setImageData] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [rotation, setRotation] = useState(0);
  
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Compress and resize image
  const processImage = useCallback(async (file) => {
    setIsProcessing(true);
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new window.Image();
        
        img.onload = () => {
          // Calculate new dimensions
          let { width, height } = img;
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
          
          // Create canvas for compression
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to blob with compression
          canvas.toBlob(
            (blob) => {
              if (blob) {
                // Check if still too large, reduce quality further
                if (blob.size > maxSizeMB * 1024 * 1024) {
                  canvas.toBlob(
                    (smallerBlob) => {
                      if (smallerBlob) {
                        const base64 = canvas.toDataURL('image/jpeg', 0.6);
                        resolve({
                          blob: smallerBlob,
                          base64: base64.split(',')[1],
                          previewUrl: base64,
                          width,
                          height,
                          size: smallerBlob.size
                        });
                      }
                    },
                    'image/jpeg',
                    0.6
                  );
                } else {
                  const base64 = canvas.toDataURL('image/jpeg', quality);
                  resolve({
                    blob,
                    base64: base64.split(',')[1],
                    previewUrl: base64,
                    width,
                    height,
                    size: blob.size
                  });
                }
              } else {
                reject(new Error('Failed to process image'));
              }
              setIsProcessing(false);
            },
            'image/jpeg',
            quality
          );
        };
        
        img.onerror = () => {
          setIsProcessing(false);
          reject(new Error('Failed to load image'));
        };
        
        img.src = e.target.result;
      };
      
      reader.onerror = () => {
        setIsProcessing(false);
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(file);
    });
  }, [maxWidth, maxHeight, maxSizeMB, quality]);

  // Handle file selection
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!validTypes.some(type => file.type.includes(type.split('/')[1]))) {
      toast.error('कृपया JPG, PNG, WebP किंवा HEIC format वापरा');
      return;
    }
    
    try {
      const processed = await processImage(file);
      setImageData(processed);
      setPreviewUrl(processed.previewUrl);
      setMode('preview');
      toast.success(`Image compressed: ${(processed.size / 1024).toFixed(0)}KB`);
    } catch (error) {
      console.error('Image processing error:', error);
      toast.error('Image process करण्यात अडचण आली');
    }
  };

  // Start camera
  const startCamera = async () => {
    setCameraError(null);
    setMode('camera');
    
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this device/browser');
      }
      
      // Request camera permission with constraints
      const constraints = {
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // iOS fix
        await videoRef.current.play();
      }
    } catch (error) {
      console.error('Camera error:', error);
      let errorMsg = 'Camera access करता आले नाही';
      
      if (error.name === 'NotAllowedError') {
        errorMsg = 'Camera permission denied. कृपया browser settings मधून camera permission द्या.';
      } else if (error.name === 'NotFoundError') {
        errorMsg = 'Camera सापडला नाही. कृपया device वर camera आहे का ते तपासा.';
      } else if (error.name === 'NotSupportedError' || error.name === 'TypeError') {
        errorMsg = 'या browser मध्ये camera support नाही. कृपया Chrome किंवा Safari वापरा.';
      }
      
      setCameraError(errorMsg);
      toast.error(errorMsg);
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Capture photo from camera
  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsProcessing(true);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    // Convert to blob
    canvas.toBlob(
      async (blob) => {
        if (blob) {
          try {
            const processed = await processImage(blob);
            setImageData(processed);
            setPreviewUrl(processed.previewUrl);
            stopCamera();
            setMode('preview');
            toast.success('Photo captured!');
          } catch (error) {
            toast.error('Photo process करण्यात अडचण');
          }
        }
        setIsProcessing(false);
      },
      'image/jpeg',
      0.9
    );
  };

  // Rotate image
  const rotateImage = () => {
    if (!previewUrl) return;
    
    const newRotation = (rotation + 90) % 360;
    setRotation(newRotation);
    
    // Create rotated image
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const isVertical = newRotation === 90 || newRotation === 270;
      
      canvas.width = isVertical ? img.height : img.width;
      canvas.height = isVertical ? img.width : img.height;
      
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((newRotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      
      const newPreview = canvas.toDataURL('image/jpeg', quality);
      setPreviewUrl(newPreview);
      setImageData(prev => ({
        ...prev,
        base64: newPreview.split(',')[1],
        previewUrl: newPreview
      }));
    };
    img.src = previewUrl;
  };

  // Confirm and send image
  const confirmImage = () => {
    if (imageData && onImageCapture) {
      onImageCapture({
        base64: imageData.base64,
        previewUrl: imageData.previewUrl,
        size: imageData.size,
        width: imageData.width,
        height: imageData.height
      });
      toast.success('✅ Image ready!');
    }
  };

  // Reset
  const reset = () => {
    stopCamera();
    setMode('select');
    setImageData(null);
    setPreviewUrl(null);
    setRotation(0);
    setCameraError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Cleanup on unmount
  const handleModeChange = (newMode) => {
    if (mode === 'camera' && newMode !== 'camera') {
      stopCamera();
    }
    setMode(newMode);
  };

  return (
    <div className={`bg-white rounded-xl border-2 border-dashed border-gray-300 overflow-hidden ${className}`}>
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptTypes}
        onChange={handleFileSelect}
        className="hidden"
        capture="environment"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Select Mode */}
      {mode === 'select' && (
        <div className="p-6 text-center">
          <div className="mb-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mb-3">
              <ImageIcon className="w-8 h-8 text-white" />
            </div>
            <p className="font-semibold text-gray-800">{label}</p>
            <p className="text-sm text-gray-500 mt-1">
              Auto-compress: Max {maxSizeMB}MB, {maxWidth}x{maxHeight}px
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {/* Camera Button */}
            {showCamera && (
              <Button
                onClick={startCamera}
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
              >
                <Camera className="w-5 h-5 mr-2" />
                📷 Camera
              </Button>
            )}
            
            {/* Gallery Button */}
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="flex-1 border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              <Upload className="w-5 h-5 mr-2" />
              📁 Gallery
            </Button>
          </div>

          <p className="text-xs text-gray-400 mt-4">
            JPG, PNG, WebP, HEIC • Auto resize & compress
          </p>
        </div>
      )}

      {/* Camera Mode */}
      {mode === 'camera' && (
        <div className="relative bg-black">
          {cameraError ? (
            <div className="p-8 text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Camera className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-red-600 font-medium mb-2">Camera Error</p>
              <p className="text-sm text-gray-600 mb-4">{cameraError}</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => handleModeChange('select')}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={startCamera} className="bg-blue-500 hover:bg-blue-600">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </div>
              
              {/* Alternative: Use file input with capture */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-600 mb-2">किंवा direct camera app वापरा:</p>
                <Button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.capture = 'environment';
                    input.onchange = handleFileSelect;
                    input.click();
                  }}
                  className="bg-green-500 hover:bg-green-600"
                >
                  <Smartphone className="w-4 h-4 mr-2" />
                  Open Camera App
                </Button>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-64 sm:h-80 object-cover"
              />
              
              {/* Camera overlay guide */}
              <div className="absolute inset-4 border-2 border-white/50 rounded-lg pointer-events-none">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
              </div>
              
              {/* Controls */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                <Button
                  onClick={() => handleModeChange('select')}
                  variant="outline"
                  className="bg-white/90"
                >
                  <X className="w-5 h-5" />
                </Button>
                <Button
                  onClick={capturePhoto}
                  disabled={isProcessing}
                  className="w-16 h-16 rounded-full bg-white hover:bg-gray-100 border-4 border-blue-500"
                >
                  {isProcessing ? (
                    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                  ) : (
                    <Camera className="w-8 h-8 text-blue-500" />
                  )}
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="bg-white/90"
                >
                  <Upload className="w-5 h-5" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Preview Mode */}
      {mode === 'preview' && previewUrl && (
        <div className="p-4">
          <div className="relative mb-4">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full max-h-64 object-contain rounded-lg bg-gray-100"
              style={{ transform: `rotate(${rotation}deg)` }}
            />
            
            {/* Image info */}
            {imageData && (
              <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                {(imageData.size / 1024).toFixed(0)}KB
              </div>
            )}
          </div>

          {/* Preview Controls */}
          <div className="flex gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={rotateImage}
              className="flex-1"
            >
              <RotateCw className="w-4 h-4 mr-1" />
              Rotate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              className="flex-1"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Retake
            </Button>
          </div>

          {/* Confirm Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={reset}
              className="flex-1"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={confirmImage}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
            >
              <Check className="w-4 h-4 mr-2" />
              Use Image
            </Button>
          </div>
        </div>
      )}

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-10 h-10 text-purple-600 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-600">Processing image...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModernImageUpload;
