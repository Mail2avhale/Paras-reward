import React, { useState } from 'react';
import { Globe } from 'lucide-react';

const LanguageSwitcher = ({ variant = 'default' }) => {
  const [currentLang, setCurrentLang] = useState('en');
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'mr', label: 'मराठी' },
    { code: 'hi', label: 'हिंदी' },
  ];

  const handleLanguageChange = (langCode) => {
    setCurrentLang(langCode);
    setIsOpen(false);
    // In a real app, this would trigger i18n language change
  };

  if (variant === 'footer') {
    return (
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-gray-500" />
        <select
          value={currentLang}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="bg-transparent text-gray-400 text-sm border-none outline-none cursor-pointer"
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code} className="bg-gray-900">
              {lang.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
      >
        <Globe className="w-4 h-4" />
        <span className="text-sm">{languages.find(l => l.code === currentLang)?.label}</span>
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-32 bg-gray-900 rounded-lg border border-gray-800 shadow-xl z-50 overflow-hidden">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-800 transition-colors ${
                currentLang === lang.code ? 'text-amber-500 bg-gray-800/50' : 'text-gray-400'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
