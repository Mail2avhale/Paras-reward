import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import translationEN from './locales/en.json';
import translationHI from './locales/hi.json';
import translationMR from './locales/mr.json';
import translationGU from './locales/gu.json';

const resources = {
  en: { translation: translationEN },
  hi: { translation: translationHI },
  mr: { translation: translationMR },
  gu: { translation: translationGU }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    lng: localStorage.getItem('language') || 'en',
    
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    },

    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
