import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone, Facebook, Twitter, Instagram, Linkedin, Youtube, Send, MessageCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import LanguageSwitcher from './LanguageSwitcher';

const API = process.env.REACT_APP_BACKEND_URL || '';

const Footer = () => {
  const { t } = useTranslation();
  const [contactDetails, setContactDetails] = useState({
    address: 'PARAS REWARD\nMaharashtra, India',
    phone: '+91-XXXXXXXXXX',
    email: 'support@parasreward.com',
    website: 'www.parasreward.com'
  });
  const [socialMedia, setSocialMedia] = useState({
    facebook: '',
    twitter: '',
    instagram: '',
    linkedin: '',
    youtube: '',
    telegram: '',
    whatsapp: ''
  });

  useEffect(() => {
    fetchContactDetails();
    fetchSocialMedia();
  }, []);

  const fetchContactDetails = async () => {
    try {
      const response = await axios.get(`${API}/api/contact-details`);
      setContactDetails(response.data);
    } catch (error) {
      console.error('Error fetching contact details:', error);
      // Keep default values on error
    }
  };

  const fetchSocialMedia = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/social-media-settings`);
      setSocialMedia(response.data);
    } catch (error) {
      console.error('Error fetching social media:', error);
    }
  };

  return (
    <footer className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* About */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img 
                src="/paras-logo.jpg" 
                alt="PARAS REWARD" 
                className="h-12 w-auto object-contain logo-animated"
              />
            </div>
            <p className="text-gray-300 mb-4">
              {t('footer.description')}
            </p>
            
            {/* Social Media Icons */}
            <div className="flex gap-3 flex-wrap">
              {socialMedia.facebook && (
                <a href={socialMedia.facebook} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-blue-500 transition-colors">
                  <Facebook className="h-6 w-6" />
                </a>
              )}
              {socialMedia.twitter && (
                <a href={socialMedia.twitter} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-blue-400 transition-colors">
                  <Twitter className="h-6 w-6" />
                </a>
              )}
              {socialMedia.instagram && (
                <a href={socialMedia.instagram} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-pink-500 transition-colors">
                  <Instagram className="h-6 w-6" />
                </a>
              )}
              {socialMedia.linkedin && (
                <a href={socialMedia.linkedin} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-blue-600 transition-colors">
                  <Linkedin className="h-6 w-6" />
                </a>
              )}
              {socialMedia.youtube && (
                <a href={socialMedia.youtube} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-red-500 transition-colors">
                  <Youtube className="h-6 w-6" />
                </a>
              )}
              {socialMedia.telegram && (
                <a href={socialMedia.telegram} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-blue-400 transition-colors">
                  <Send className="h-6 w-6" />
                </a>
              )}
              {socialMedia.whatsapp && (
                <a href={socialMedia.whatsapp} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-green-500 transition-colors">
                  <MessageCircle className="h-6 w-6" />
                </a>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-bold mb-4">{t('footer.quick_links')}</h3>
            <ul className="space-y-2">
              <li><Link to="/" className="text-gray-300 hover:text-white transition-colors">{t('nav.home')}</Link></li>
              <li><Link to="/about" className="text-gray-300 hover:text-white transition-colors">{t('nav.about')}</Link></li>
              <li><Link to="/how-it-works" className="text-gray-300 hover:text-white transition-colors">{t('home.how_it_works')}</Link></li>
              <li><Link to="/blog" className="text-gray-300 hover:text-white transition-colors">Blog</Link></li>
              <li><Link to="/mining" className="text-gray-300 hover:text-white transition-colors">{t('nav.mining')}</Link></li>
              <li><Link to="/referrals" className="text-gray-300 hover:text-white transition-colors">{t('nav.referrals')}</Link></li>
              <li><Link to="/vip" className="text-gray-300 hover:text-white transition-colors">VIP</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-lg font-bold mb-4">Support</h3>
            <ul className="space-y-2">
              <li><Link to="/faq" className="text-gray-300 hover:text-white transition-colors">{t('nav.faq')}</Link></li>
              <li><Link to="/contact" className="text-gray-300 hover:text-white transition-colors">{t('footer.contact_us')}</Link></li>
              <li><Link to="/support" className="text-gray-300 hover:text-white transition-colors">Support</Link></li>
              <li><Link to="/marketplace" className="text-gray-300 hover:text-white transition-colors">{t('nav.marketplace')}</Link></li>
              <li><Link to="/leaderboard" className="text-gray-300 hover:text-white transition-colors">Leaderboard</Link></li>
            </ul>
          </div>

          {/* Legal & Contact */}
          <div>
            <h3 className="text-lg font-bold mb-4">{t('footer.legal')}</h3>
            <ul className="space-y-2 mb-4">
              <li><Link to="/privacy" className="text-gray-300 hover:text-white transition-colors">{t('footer.privacy')}</Link></li>
              <li><Link to="/terms" className="text-gray-300 hover:text-white transition-colors">{t('footer.terms')}</Link></li>
            </ul>
            <h3 className="text-lg font-bold mb-4 mt-6">{t('nav.contact')}</h3>
            <div className="space-y-2 text-gray-300 text-sm mb-6">
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <a href={`mailto:${contactDetails.email}`} className="hover:text-white transition-colors">
                  {contactDetails.email}
                </a>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <a href={`tel:${contactDetails.phone}`} className="hover:text-white transition-colors">
                  {contactDetails.phone}
                </a>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span className="whitespace-pre-line">
                  {contactDetails.address}
                </span>
              </div>
            </div>
            
            {/* Language Switcher in Footer */}
            <LanguageSwitcher variant="footer" />
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-700 mt-8 pt-8 text-center">
          <p className="text-gray-400">
            {t('footer.copyright')} | {t('footer.tagline')}
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Powered by Innovation • Trusted by 10,000+ Users
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
