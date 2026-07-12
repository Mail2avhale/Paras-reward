import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Info, AlertTriangle, CheckCircle, AlertCircle, ExternalLink, PlayCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// YouTube thumbnails are served CORS-friendly by Google's CDN — no proxy
// needed. Higher quality first, then fallback if 404.
const YT_THUMB = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

const absolute = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
};

const PopupMessage = () => {
  const [popup, setPopup] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const location = useLocation();

  const isAuthPage = ['/login', '/signup', '/reset-password', '/forgot-password'].some(
    (path) => location.pathname.startsWith(path),
  );

  useEffect(() => {
    if (isAuthPage) return;
    if (!localStorage.getItem('paras_user')) return;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/admin/popup/active`);
        const d = await r.json();
        if (d.success && d.has_popup && d.data) {
          const closed = JSON.parse(sessionStorage.getItem('closed_popups') || '[]');
          if (!closed.includes(d.data.id)) {
            setPopup(d.data);
            setIsVisible(true);
            setShowVideo(false);
          }
        }
      } catch (e) {
        console.error('Failed to fetch popup:', e);
      }
    })();
  }, [location.pathname, isAuthPage]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    if (popup?.id) {
      const closed = JSON.parse(sessionStorage.getItem('closed_popups') || '[]');
      closed.push(popup.id);
      sessionStorage.setItem('closed_popups', JSON.stringify(closed));
    }
    setTimeout(() => {
      setIsVisible(false);
      setPopup(null);
      setShowVideo(false);
    }, 300);
  }, [popup]);

  const handleCTA = (link) => {
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
    handleClose();
  };

  // ESC + backdrop click both close — critical mobile escape hatches
  // now that the modal may be tall with an embedded video/image.
  useEffect(() => {
    if (!isVisible) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isVisible, handleClose]);

  if (!isVisible || !popup) return null;

  const typeCfg = {
    info: { bg: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/30', icon: Info, iconColor: 'text-blue-400', titleColor: 'text-blue-200' },
    warning: { bg: 'from-amber-500/20 to-amber-600/10', border: 'border-amber-500/30', icon: AlertTriangle, iconColor: 'text-amber-400', titleColor: 'text-amber-200' },
    success: { bg: 'from-green-500/20 to-green-600/10', border: 'border-green-500/30', icon: CheckCircle, iconColor: 'text-green-400', titleColor: 'text-green-200' },
    error: { bg: 'from-red-500/20 to-red-600/10', border: 'border-red-500/30', icon: AlertCircle, iconColor: 'text-red-400', titleColor: 'text-red-200' },
  };
  const cfg = typeCfg[popup.message_type] || typeCfg.info;
  const Icon = cfg.icon;

  const ctaStyle = (style) => ({
    primary: 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black',
    secondary: 'bg-white/10 hover:bg-white/20 text-white border border-white/20',
    ghost: 'text-slate-300 hover:text-white hover:bg-white/5',
  }[style] || 'bg-amber-500 text-black');

  // Fall back to the legacy single-button API when cta_buttons is empty.
  const ctas = (popup.cta_buttons && popup.cta_buttons.length)
    ? popup.cta_buttons
    : [{ text: popup.button_text || 'Close', link: popup.button_link, style: 'primary' }];

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      data-testid="popup-backdrop"
    >
      <div
        className={`relative w-full max-w-md max-h-[90vh] flex flex-col bg-gradient-to-br ${cfg.bg} border ${cfg.border} rounded-2xl shadow-2xl transform transition-all duration-300 overflow-hidden ${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
        style={{ backdropFilter: 'blur(20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className={`shrink-0 flex items-center justify-between gap-3 p-4 pb-3 border-b ${cfg.border}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-xl bg-gray-900/50 ${cfg.iconColor} shrink-0`}>
              <Icon className="w-5 h-5" />
            </div>
            <h2 className={`text-lg font-bold ${cfg.titleColor} truncate`}>
              {popup.title}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="shrink-0 p-2 rounded-full bg-gray-800/60 hover:bg-gray-700/70 text-gray-300 hover:text-white transition-colors touch-manipulation"
            aria-label="Close popup"
            data-testid="popup-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3"
          data-testid="popup-body"
        >
          {/* Banner image — old prod popups may reference legacy
              `/api/static/popups/*.jpg` URLs whose files were wiped on
              redeploy. onError hides the broken-image icon gracefully. */}
          {popup.image_url && (
            <img
              src={absolute(popup.image_url)}
              alt=""
              className="w-full rounded-xl"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              data-testid="popup-image"
            />
          )}

          {/* YouTube — thumbnail with tap-to-play; embed only after user consent */}
          {popup.youtube_id && (
            showVideo ? (
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${popup.youtube_id}?autoplay=1&rel=0`}
                  title="Video"
                  className="w-full h-full"
                  frameBorder="0"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  data-testid="popup-youtube-iframe"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowVideo(true)}
                className="relative aspect-video rounded-xl overflow-hidden bg-black w-full block group"
                data-testid="popup-youtube-thumb"
              >
                <img src={YT_THUMB(popup.youtube_id)} alt="Play video" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition flex items-center justify-center">
                  <PlayCircle className="w-16 h-16 text-white drop-shadow-lg" />
                </div>
              </button>
            )
          )}

          {/* Rich HTML body — sanitized on backend before storage */}
          {popup.message_html ? (
            <div
              className="text-gray-100 text-sm leading-relaxed prose prose-invert prose-sm max-w-none [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-amber-400 [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: popup.message_html }}
              data-testid="popup-html-body"
            />
          ) : (
            <div className="text-gray-100 text-sm leading-relaxed whitespace-pre-wrap">
              {popup.message}
            </div>
          )}
        </div>

        {/* Sticky footer — all CTAs */}
        <div className={`shrink-0 p-4 pt-3 border-t ${cfg.border} bg-black/10 space-y-2`}>
          {ctas.map((b, i) => (
            <button
              key={i}
              onClick={() => handleCTA(b.link)}
              className={`w-full py-2.5 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all touch-manipulation ${ctaStyle(b.style)}`}
              data-testid={`popup-cta-btn-${i}`}
            >
              {b.text}
              {b.link && <ExternalLink className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PopupMessage;
