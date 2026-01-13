import React, { useState } from 'react';
import { useLanguage, LANGUAGES } from '@/contexts/LanguageContext';
import { Globe, Check, ChevronDown } from 'lucide-react';

// Compact Language Selector for TopBar
export const LanguageSelectorCompact = () => {
  const { language, changeLanguage, currentLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
        title="Change Language"
      >
        <Globe className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-medium text-white">{currentLanguage.nativeName}</span>
        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="py-2 max-h-80 overflow-y-auto">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    changeLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-800 transition-colors ${
                    language === lang.code ? 'bg-amber-500/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{lang.flag}</span>
                    <div className="text-left">
                      <p className={`text-sm font-medium ${language === lang.code ? 'text-amber-400' : 'text-white'}`}>
                        {lang.nativeName}
                      </p>
                      <p className="text-xs text-gray-500">{lang.name}</p>
                    </div>
                  </div>
                  {language === lang.code && (
                    <Check className="w-4 h-4 text-amber-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Full Language Selector for Settings Page
export const LanguageSelectorFull = () => {
  const { language, changeLanguage, t } = useLanguage();

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
          <Globe className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">{t('language')}</h2>
          <p className="text-gray-400 text-sm">{t('selectLanguage')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={`p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 ${
              language === lang.code
                ? 'border-amber-500 bg-amber-500/10'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
            }`}
          >
            <span className="text-2xl">{lang.flag}</span>
            <div className="text-left flex-1">
              <p className={`font-semibold ${language === lang.code ? 'text-amber-400' : 'text-white'}`}>
                {lang.nativeName}
              </p>
              <p className="text-sm text-gray-500">{lang.name}</p>
            </div>
            {language === lang.code && (
              <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                <Check className="w-4 h-4 text-black" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

// Mobile-friendly Bottom Sheet Language Selector
export const LanguageSelectorSheet = ({ isOpen, onClose }) => {
  const { language, changeLanguage, t } = useLanguage();

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 z-50"
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 rounded-t-3xl z-50 max-h-[80vh] overflow-hidden">
        <div className="p-5">
          <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white text-center mb-6">
            {t('selectLanguage')}
          </h2>
          
          <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pb-4">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  changeLanguage(lang.code);
                  onClose();
                }}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                  language === lang.code
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-gray-700 bg-gray-800/50'
                }`}
              >
                <span className="text-3xl">{lang.flag}</span>
                <p className={`font-semibold text-sm ${language === lang.code ? 'text-amber-400' : 'text-white'}`}>
                  {lang.nativeName}
                </p>
                <p className="text-xs text-gray-500">{lang.name}</p>
                {language === lang.code && (
                  <Check className="w-5 h-5 text-amber-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default LanguageSelectorCompact;
