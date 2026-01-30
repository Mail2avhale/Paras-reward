import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, X, Check } from 'lucide-react';

const CameraCapture = ({ onCapture, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');

  const startCamera = useCallback(async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setError(null);
    } catch (err) {
      console.error('Camera error:', err);
      setError('Unable to access camera. Please ensure camera permissions are granted.');
    }
  }, [facingMode, stream]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    startCamera();
  }, [facingMode]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(imageData);
    }
  };

  const retake = () => {
    setCapturedImage(null);
  };

  const confirmCapture = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    }
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50">
        <button onClick={handleClose} className="text-white p-2">
          <X className="w-6 h-6" />
        </button>
        <span className="text-white font-medium">Take Photo</span>
        <button onClick={switchCamera} className="text-white p-2">
          <RefreshCw className="w-6 h-6" />
        </button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white text-center px-4">{error}</p>
          </div>
        ) : capturedImage ? (
          <img 
            src={capturedImage} 
            alt="Captured" 
            className="w-full h-full object-contain"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      <div className="p-6 bg-black/50 flex items-center justify-center gap-8">
        {capturedImage ? (
          <>
            <button
              onClick={retake}
              className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center"
            >
              <RefreshCw className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={confirmCapture}
              className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center"
            >
              <Check className="w-8 h-8 text-white" />
            </button>
          </>
        ) : (
          <button
            onClick={capturePhoto}
            disabled={!!error}
            className="w-16 h-16 rounded-full bg-white flex items-center justify-center disabled:opacity-50"
          >
            <Camera className="w-8 h-8 text-black" />
          </button>
        )}
      </div>
    </div>
  );
};

export default CameraCapture;
