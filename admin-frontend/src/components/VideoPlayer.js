import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, X } from 'lucide-react';
import { trackEvent } from '@/utils/analytics';

/**
 * VideoPlayer Component
 * Supports: Direct video URLs, YouTube, Vimeo embeds
 * Features: Autoplay, mute, skip, analytics tracking
 */
const VideoPlayer = ({
  videoUrl,
  videoType = 'direct', // 'direct', 'youtube', 'vimeo'
  thumbnail = null,
  title = 'Video Advertisement',
  autoplay = false,
  muted = true,
  skippable = true,
  skipAfter = 5, // seconds
  onSkip = () => {},
  onComplete = () => {},
  showCloseButton = false,
  onClose = () => {},
  className = ''
}) => {
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [isMuted, setIsMuted] = useState(muted);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [canSkip, setCanSkip] = useState(!skippable);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  // Track video view
  useEffect(() => {
    trackEvent('video_ad_view', {
      video_title: title,
      video_type: videoType,
      autoplay: autoplay,
    });
  }, [title, videoType, autoplay]);

  // Handle skip timer
  useEffect(() => {
    if (skippable && currentTime >= skipAfter && !canSkip) {
      setCanSkip(true);
    }
  }, [currentTime, skipAfter, skippable, canSkip]);

  // Autoplay handling
  useEffect(() => {
    if (autoplay && videoRef.current && videoType === 'direct') {
      videoRef.current.play().catch(err => {
        console.log('Autoplay prevented:', err);
        setIsPlaying(false);
      });
    }
  }, [autoplay, videoType]);

  // Hide controls after inactivity
  useEffect(() => {
    if (showControls) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false);
        }
      }, 3000);
    }
    return () => clearTimeout(controlsTimeoutRef.current);
  }, [showControls, isPlaying]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        trackEvent('video_ad_pause', { video_title: title });
      } else {
        videoRef.current.play();
        trackEvent('video_ad_play', { video_title: title });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleMuteUnmute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
      trackEvent('video_ad_mute_toggle', { 
        video_title: title,
        muted: !isMuted 
      });
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    trackEvent('video_ad_complete', { 
      video_title: title,
      watch_time: currentTime 
    });
    onComplete();
  };

  const handleSkip = () => {
    trackEvent('video_ad_skip', { 
      video_title: title,
      skip_time: currentTime 
    });
    onSkip();
  };

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          containerRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
      setIsFullscreen(!isFullscreen);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
  };

  // Render YouTube embed
  if (videoType === 'youtube') {
    const videoId = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)?.[1];
    return (
      <div className={`relative w-full ${className}`}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=${autoplay ? 1 : 0}&mute=${muted ? 1 : 0}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full rounded-lg"
        />
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute top-2 right-2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 z-10"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  }

  // Render Vimeo embed
  if (videoType === 'vimeo') {
    const videoId = videoUrl.match(/vimeo\.com\/(\d+)/)?.[1];
    return (
      <div className={`relative w-full ${className}`}>
        <iframe
          src={`https://player.vimeo.com/video/${videoId}?autoplay=${autoplay ? 1 : 0}&muted=${muted ? 1 : 0}`}
          title={title}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="w-full h-full rounded-lg"
        />
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute top-2 right-2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 z-10"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  }

  // Render Direct video player
  return (
    <div 
      ref={containerRef}
      className={`relative w-full bg-black rounded-lg overflow-hidden ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={videoUrl}
        poster={thumbnail}
        className="w-full h-full"
        autoPlay={autoplay}
        muted={muted}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onClick={handlePlayPause}
      />

      {/* Skip Button */}
      {skippable && (
        <div className="absolute top-4 right-4 z-20">
          {canSkip ? (
            <button
              onClick={handleSkip}
              className="bg-white text-gray-900 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Skip Ad →
            </button>
          ) : (
            <div className="bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg text-sm">
              Skip in {Math.ceil(skipAfter - currentTime)}s
            </div>
          )}
        </div>
      )}

      {/* Close Button */}
      {showCloseButton && (
        <button
          onClick={onClose}
          className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 z-20"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Controls Overlay */}
      {showControls && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 z-10">
          {/* Progress Bar */}
          <div className="mb-3">
            <div className="bg-gray-600 h-1 rounded-full overflow-hidden">
              <div
                className="bg-purple-600 h-full transition-all"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Play/Pause */}
              <button
                onClick={handlePlayPause}
                className="text-white hover:text-purple-400 transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6" />
                )}
              </button>

              {/* Mute/Unmute */}
              <button
                onClick={handleMuteUnmute}
                className="text-white hover:text-purple-400 transition-colors"
              >
                {isMuted ? (
                  <VolumeX className="w-6 h-6" />
                ) : (
                  <Volume2 className="w-6 h-6" />
                )}
              </button>

              {/* Time */}
              <span className="text-white text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Fullscreen */}
            <button
              onClick={handleFullscreen}
              className="text-white hover:text-purple-400 transition-colors"
            >
              <Maximize className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Title Overlay */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm">
        {title}
      </div>
    </div>
  );
};

export default VideoPlayer;
