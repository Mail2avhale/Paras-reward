import React, { useState } from 'react';
import { Info, X } from 'lucide-react';

/**
 * Mobile-friendly tooltip that works on both hover and tap
 * Shows a small popup with information text
 */
export const InfoTooltip = ({ children, className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className={`inline-flex items-center justify-center ${className}`}
      >
        <Info className="w-3.5 h-3.5 text-gray-500 hover:text-gray-400 cursor-help" />
      </button>
      
      {isOpen && (
        <>
          {/* Backdrop for mobile - click to close */}
          <div 
            className="fixed inset-0 z-40 md:hidden"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Tooltip content */}
          <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 sm:w-64">
            <div className="bg-gray-800 text-white text-xs rounded-lg p-3 shadow-lg border border-gray-700 relative">
              {/* Close button for mobile */}
              <button
                onClick={() => setIsOpen(false)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-gray-700 rounded-full flex items-center justify-center md:hidden"
              >
                <X className="w-3 h-3" />
              </button>
              
              {children}
              
              {/* Arrow */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-gray-800" />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/**
 * Large info card that shows detailed breakdown
 * Used for complex information like PRC calculations
 */
export const InfoCard = ({ title, items, footer, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-md mx-auto">
        <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-500" />
              {title}
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center hover:bg-gray-600"
            >
              <X className="w-4 h-4 text-gray-300" />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-4 space-y-3">
            {items.map((item, index) => (
              <div 
                key={index}
                className={`flex justify-between items-center py-2 ${
                  index < items.length - 1 ? 'border-b border-gray-800' : ''
                } ${item.highlight ? 'bg-gray-800/50 -mx-2 px-2 rounded-lg' : ''}`}
              >
                <div className="flex items-center gap-2">
                  {item.icon && <span className="text-lg">{item.icon}</span>}
                  <div>
                    <p className={`text-sm ${item.highlight ? 'text-white font-semibold' : 'text-gray-400'}`}>
                      {item.label}
                    </p>
                    {item.sublabel && (
                      <p className="text-xs text-gray-500">{item.sublabel}</p>
                    )}
                  </div>
                </div>
                <p className={`font-mono ${item.color || 'text-white'} ${item.highlight ? 'text-lg font-bold' : ''}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
          
          {/* Footer */}
          {footer && (
            <div className="bg-gray-800/50 px-4 py-3 text-xs text-gray-400">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default InfoTooltip;
