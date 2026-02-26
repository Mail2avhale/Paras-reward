import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  AlertTriangle, Shield, ArrowLeft, Scale, XCircle,
  CheckCircle, Info, FileWarning, DollarSign, Globe,
  Smartphone, Building2, Mail, Phone, MapPin, Clock
} from 'lucide-react';
import SEO from '@/components/SEO';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Disclaimer = () => {
  const navigate = useNavigate();
  const [companyInfo, setCompanyInfo] = useState({
    company_name: 'PARAS REWARD',
    email: 'Info@parasreward.com',
    address: 'India'
  });

  useEffect(() => {
    const fetchCompanyInfo = async () => {
      try {
        const response = await axios.get(`${API}/public/contact-info`);
        if (response.data) {
          setCompanyInfo(response.data);
        }
      } catch (error) {
        console.error('Error fetching company info:', error);
      }
    };
    fetchCompanyInfo();
  }, []);

  const lastUpdated = 'February 7, 2026';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-900/50 to-red-900/50 border-b border-gray-800">
        <div className="container mx-auto px-4 py-8">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/25">
              <AlertTriangle className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Disclaimer</h1>
              <p className="text-gray-400 mt-1">Last updated: {lastUpdated}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-gray-900/30 rounded-2xl border border-gray-800 p-6 lg:p-8">
          
          {/* Important Notice */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-8 w-8 text-red-400 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-xl font-bold text-red-400 mb-2">Important Notice</h2>
                <p className="text-red-300">
                  Please read this disclaimer carefully before using our Service. By accessing or using {companyInfo.company_name}, you acknowledge and agree to the following terms.
                </p>
              </div>
            </div>
          </div>

          {/* General Disclaimer */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Info className="h-5 w-5 text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">General Disclaimer</h2>
            </div>
            <div className="text-gray-300 space-y-4 leading-relaxed">
              <p>
                The information and services provided on {companyInfo.company_name} (the "Platform") are for general informational and entertainment purposes only. While we strive to keep the information up to date and correct, we make no representations or warranties of any kind, express or implied, about the completeness, accuracy, reliability, suitability, or availability of the information, products, services, or related graphics contained on the Platform.
              </p>
              <p>
                Any reliance you place on such information is therefore strictly at your own risk. In no event will we be liable for any loss or damage including without limitation, indirect or consequential loss or damage, arising from loss of data or profits arising out of, or in connection with, the use of this Platform.
              </p>
            </div>
          </section>

          {/* Not Financial Advice */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-yellow-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Not Financial or Investment Advice</h2>
            </div>
            <div className="text-gray-300 space-y-4 leading-relaxed">
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <p className="text-yellow-400 font-semibold">
                  {companyInfo.company_name} is NOT a financial institution, bank, investment company, or registered broker.
                </p>
              </div>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
                <li>PRC (PARAS REWARD CURRENCY) points are <strong>NOT</strong> cryptocurrency, legal tender, or real currency</li>
                <li>PRC points have <strong>NO</strong> monetary value outside our platform</li>
                <li>We do <strong>NOT</strong> provide any investment advice or financial services</li>
                <li>The value of PRC points is determined solely by us and can change at any time</li>
                <li>Participating in our rewards program is <strong>NOT</strong> an investment opportunity</li>
              </ul>
              <p className="mt-4">
                If you require financial advice, please consult a qualified financial advisor. We are not responsible for any financial decisions you make based on information from our Platform.
              </p>
            </div>
          </section>

          {/* No Guarantees */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">No Guarantees</h2>
            </div>
            <div className="text-gray-300 space-y-4 leading-relaxed">
              <p>We do NOT guarantee:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Any specific amount of rewards or earnings</li>
                <li>Availability of redemption options at any time</li>
                <li>Uninterrupted access to the Platform</li>
                <li>That the Platform will meet your requirements</li>
                <li>That errors will be corrected</li>
                <li>The accuracy of user-generated content</li>
              </ul>
              <div className="bg-gray-800/50 rounded-xl p-4 mt-4">
                <p className="text-gray-400 text-sm">
                  Past performance or rewards are not indicative of future results. Individual results may vary significantly.
                </p>
              </div>
            </div>
          </section>

          {/* Third-Party Links */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <Globe className="h-5 w-5 text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Third-Party Links & Services</h2>
            </div>
            <div className="text-gray-300 space-y-4 leading-relaxed">
              <p>
                Through this Platform, you can link to other websites and services that are not under our control. We have no control over the nature, content, and availability of those sites. The inclusion of any links does not necessarily imply a recommendation or endorsement of the views expressed within them.
              </p>
              <p>
                We are not responsible for:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Content on third-party websites</li>
                <li>Privacy practices of third-party services</li>
                <li>Transactions conducted with third parties</li>
                <li>Products or services offered by third parties</li>
              </ul>
            </div>
          </section>

          {/* Advertising Disclaimer */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Advertising Disclaimer</h2>
            </div>
            <div className="text-gray-300 space-y-4 leading-relaxed">
              <p>
                Our Platform displays advertisements from third-party advertising networks including Google AdMob and Google AdSense.
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>We do not control the content of advertisements</li>
                <li>The presence of an advertisement does not constitute an endorsement</li>
                <li>We are not responsible for advertising content accuracy</li>
                <li>Users should exercise their own judgment regarding advertisements</li>
                <li>We may earn revenue from advertising displayed on the Platform</li>
              </ul>
              <p className="mt-4">
                Personalized ads are served based on your interests and browsing behavior. You can opt out of personalized advertising through your device settings.
              </p>
            </div>
          </section>

          {/* User-Generated Content */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                <FileWarning className="h-5 w-5 text-cyan-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">User-Generated Content</h2>
            </div>
            <div className="text-gray-300 space-y-4 leading-relaxed">
              <p>
                Our Platform may contain content submitted by users. We do not:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Verify the accuracy of user-submitted content</li>
                <li>Endorse opinions expressed by users</li>
                <li>Take responsibility for user actions or content</li>
                <li>Guarantee the authenticity of user claims</li>
              </ul>
            </div>
          </section>

          {/* Service Availability */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                <Clock className="h-5 w-5 text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Service Availability</h2>
            </div>
            <div className="text-gray-300 space-y-4 leading-relaxed">
              <p>
                We reserve the right to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Modify or discontinue any part of the Service at any time</li>
                <li>Change reward rates, redemption options, or platform features</li>
                <li>Implement scheduled or unscheduled maintenance</li>
                <li>Suspend accounts for policy violations</li>
                <li>Terminate the Service entirely</li>
              </ul>
              <p className="mt-4">
                We will make reasonable efforts to provide notice of material changes, but we are not obligated to do so.
              </p>
            </div>
          </section>

          {/* Limitation of Liability */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                <Scale className="h-5 w-5 text-orange-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Limitation of Liability</h2>
            </div>
            <div className="text-gray-300 space-y-4 leading-relaxed">
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                <p className="text-orange-300 text-sm">
                  TO THE FULLEST EXTENT PERMITTED BY LAW, {companyInfo.company_name?.toUpperCase()} AND ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM OR RELATED TO YOUR USE OF THE PLATFORM.
                </p>
              </div>
              <p className="mt-4">
                This includes, but is not limited to, damages for:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Loss of profits, data, or goodwill</li>
                <li>Service interruption or computer damage</li>
                <li>Personal injury or property damage</li>
                <li>Unauthorized access to personal information</li>
                <li>Any conduct of third parties on the Platform</li>
              </ul>
            </div>
          </section>

          {/* Play Store / App Store Compliance */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <Shield className="h-5 w-5 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">App Store Compliance</h2>
            </div>
            <div className="text-gray-300 space-y-4 leading-relaxed">
              <p>
                Our mobile application is distributed through authorized app stores. By downloading our app, you also agree to the terms of service of the respective app store (Google Play Store, Apple App Store).
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>The app stores are not responsible for our Service</li>
                <li>Claims against our Service should be directed to us, not the app store</li>
                <li>App store terms apply in addition to our terms</li>
              </ul>
            </div>
          </section>

          {/* Acknowledgment */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-teal-500/20 rounded-xl flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-teal-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Acknowledgment</h2>
            </div>
            <div className="text-gray-300 space-y-4 leading-relaxed">
              <p>
                By using {companyInfo.company_name}, you acknowledge that you have read, understood, and agree to this Disclaimer. If you do not agree with any part of this Disclaimer, please discontinue use of our Platform immediately.
              </p>
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mt-4">
                <p className="text-green-400 text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  This Disclaimer was last updated on {lastUpdated}.
                </p>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-pink-500/20 rounded-xl flex items-center justify-center">
                <Mail className="h-5 w-5 text-pink-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Contact Us</h2>
            </div>
            <div className="text-gray-300 space-y-4 leading-relaxed">
              <p>If you have any questions about this Disclaimer, please contact us:</p>
              <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 mt-4">
                <h3 className="text-xl font-bold text-white mb-4">{companyInfo.company_name}</h3>
                <div className="space-y-3">
                  {companyInfo.address && (
                    <p className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      <span>{companyInfo.address}</span>
                    </p>
                  )}
                  {companyInfo.email && (
                    <p className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-gray-400" />
                      <a href={`mailto:${companyInfo.email}`} className="text-orange-400 hover:underline">{companyInfo.email}</a>
                    </p>
                  )}
                  {companyInfo.phone && (
                    <p className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-gray-400" />
                      <a href={`tel:${companyInfo.phone}`} className="text-orange-400 hover:underline">{companyInfo.phone}</a>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-gray-800">
            <p className="text-gray-500 text-sm text-center">
              © {new Date().getFullYear()} {companyInfo.company_name}. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Disclaimer;
