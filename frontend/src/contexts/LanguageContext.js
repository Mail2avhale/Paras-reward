import React, { createContext, useContext, useState, useEffect } from 'react';
import translations from '../locales/translations';

// Language Context
const LanguageContext = createContext();

// Available languages
export const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'mr', name: 'मराठी', flag: '🇮🇳' },
  { code: 'hi', name: 'हिंदी', flag: '🇮🇳' }
];

// Language Provider Component
export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Get saved language from localStorage or default to English
    const saved = localStorage.getItem('paras_language');
    return saved || 'en';
  });

  // Save language preference
  useEffect(() => {
    localStorage.setItem('paras_language', language);
  }, [language]);

  // Translation function
  const t = (key) => {
    const translation = translations[key];
    if (!translation) {
      console.warn(`Translation missing for key: ${key}`);
      return key;
    }
    return translation[language] || translation['en'] || key;
  };

  // Change language
  const changeLanguage = (langCode) => {
    if (LANGUAGES.some(l => l.code === langCode)) {
      setLanguage(langCode);
    }
  };

  // Get current language info
  const currentLanguage = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <LanguageContext.Provider value={{ 
      language, 
      changeLanguage, 
      t, 
      currentLanguage,
      languages: LANGUAGES 
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Custom hook to use language
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;
