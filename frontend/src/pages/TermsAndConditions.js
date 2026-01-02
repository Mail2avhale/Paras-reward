import React from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import { AlertTriangle, Info, Shield, Globe, AlertCircle, FileText, CheckCircle } from 'lucide-react';

const TermsAndConditions = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link to="/" className="inline-flex items-center text-white hover:text-purple-200 mb-4 transition-colors">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
          <h1 className="text-5xl font-black mb-3">Terms & Conditions</h1>
          <p className="text-purple-100 text-lg">Please read these terms carefully before using PARAS REWARD</p>
          <p className="text-purple-200 mt-2">Effective Date: January 2025</p>
        </div>
      </div>

      {/* Important Notice Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl shadow-2xl p-6 border-4 border-white">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-8 w-8 flex-shrink-0 animate-pulse" />
            <div>
              <h3 className="text-2xl font-bold mb-2">⚠️ IMPORTANT DISCLAIMER</h3>
              <p className="text-lg font-semibold leading-relaxed">
                PARAS REWARD is purely an <span className="underline">in-app mining and reward-based entertainment platform</span>. 
                It has <span className="underline">NO connection</span> with cryptocurrency, investment, trading, or any MLM (Multi-Level Marketing) scheme.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 space-y-10">
          {/* Section 1: General Information */}
          <section className="border-l-4 border-purple-600 pl-6 bg-purple-50 p-6 rounded-r-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="bg-purple-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-black text-xl flex-shrink-0">
                1
              </div>
              <div>
                <h2 className="text-3xl font-black text-purple-900 mb-3 flex items-center gap-2">
                  <Info className="h-7 w-7" />
                  General Information
                </h2>
              </div>
            </div>
            <div className="space-y-4 text-gray-800 text-lg leading-relaxed ml-16">
              <p className="font-bold text-xl text-purple-800">
                🏆 PARAS REWARD is India's First Mining-Based Reward Platform.
              </p>
              <p>
                This platform is designed to provide users with a <strong>fun and engaging experience</strong> through in-app activities, games, and reward points.
              </p>
              <p className="bg-red-100 border-2 border-red-500 p-4 rounded-lg font-bold text-red-900">
                ⚠️ It is <span className="underline">NOT a cryptocurrency, token, or coin</span> of any kind.
              </p>
            </div>
          </section>


          {/* Section 2: In-App Usage Only */}
          <section className="border-l-4 border-blue-600 pl-6 bg-blue-50 p-6 rounded-r-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-black text-xl flex-shrink-0">
                2
              </div>
              <div>
                <h2 className="text-3xl font-black text-blue-900 mb-3 flex items-center gap-2">
                  <Shield className="h-7 w-7" />
                  In-App Usage Only
                </h2>
              </div>
            </div>
            <div className="space-y-4 text-gray-800 text-lg leading-relaxed ml-16">
              <p>
                All rewards, mining points, or credits earned within the <strong>PARAS REWARD app</strong> are for <strong className="text-blue-700">in-app use only</strong>.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-red-600 font-black text-2xl">✗</span>
                  <span>These points <strong>cannot be exchanged, traded, or converted</strong> into rewards or cryptocurrency.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-black text-2xl">✓</span>
                  <span>Rewards may <strong>only be used</strong> for shopping, gaming, offers, or promotional features within the app.</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 3: Financial Disclaimer */}
          <section className="border-l-4 border-orange-600 pl-6 bg-orange-50 p-6 rounded-r-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="bg-orange-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-black text-xl flex-shrink-0">
                3
              </div>
              <div>
                <h2 className="text-3xl font-black text-orange-900 mb-3 flex items-center gap-2">
                  <AlertCircle className="h-7 w-7" />
                  Financial Disclaimer
                </h2>
              </div>
            </div>
            <div className="space-y-4 text-gray-800 text-lg leading-relaxed ml-16">
              <div className="bg-yellow-100 border-2 border-yellow-500 p-5 rounded-lg">
                <p className="font-black text-yellow-900 text-xl mb-3">⚠️ IMPORTANT:</p>
                <ul className="space-y-2">
                  <li>• PARAS REWARD is <strong>NOT a financial program</strong> or investment platform.</li>
                  <li>• There is <strong>NO guarantee of earnings, profit, or fixed returns</strong>.</li>
                  <li>• The app does <strong>NOT promise or commit</strong> to any specific income to users.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 4: For Indian Users Only */}
          <section className="border-l-4 border-green-600 pl-6 bg-green-50 p-6 rounded-r-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="bg-green-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-black text-xl flex-shrink-0">
                4
              </div>
              <div>
                <h2 className="text-3xl font-black text-green-900 mb-3 flex items-center gap-2">
                  <Globe className="h-7 w-7" />
                  For Indian Users Only
                </h2>
              </div>
            </div>
            <div className="space-y-4 text-gray-800 text-lg leading-relaxed ml-16">
              <div className="bg-green-100 border-2 border-green-600 p-5 rounded-lg">
                <p className="mb-3">
                  🇮🇳 The <strong>PARAS REWARD platform</strong> is strictly limited to <strong className="text-green-800">Indian citizens and residents</strong>.
                </p>
                <p className="font-bold text-red-800">
                  ❌ Access or use of this platform from outside India is <span className="underline">unauthorized and invalid</span>.
                </p>
              </div>
            </div>
          </section>


          {/* Section 5: No Guarantee & Limitation of Liability */}
          <section className="border-l-4 border-red-600 pl-6 bg-red-50 p-6 rounded-r-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="bg-red-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-black text-xl flex-shrink-0">
                5
              </div>
              <div>
                <h2 className="text-3xl font-black text-red-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-7 w-7" />
                  No Guarantee & Limitation of Liability
                </h2>
              </div>
            </div>
            <div className="space-y-4 text-gray-800 text-lg leading-relaxed ml-16">
              <div className="bg-red-100 border-2 border-red-500 p-5 rounded-lg">
                <p className="font-bold text-red-900 mb-4 text-xl">⚠️ Use at Your Own Risk:</p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">•</span>
                    <span>The use of this app is entirely at the user's <strong>own risk</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">•</span>
                    <span>PARAS REWARD shall <strong>not be responsible</strong> for any technical issue, data loss, server downtime, or reduction in earnings.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">•</span>
                    <span>The platform will <strong>not be liable</strong> for any financial or personal losses incurred by users.</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 6: Updates and Policy Changes */}
          <section className="border-l-4 border-indigo-600 pl-6 bg-indigo-50 p-6 rounded-r-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="bg-indigo-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-black text-xl flex-shrink-0">
                6
              </div>
              <div>
                <h2 className="text-3xl font-black text-indigo-900 mb-3 flex items-center gap-2">
                  <FileText className="h-7 w-7" />
                  Updates and Policy Changes
                </h2>
              </div>
            </div>
            <div className="space-y-4 text-gray-800 text-lg leading-relaxed ml-16">
              <p>
                PARAS REWARD <strong>reserves the right</strong> to modify, update, or discontinue any feature, mining rate, reward system, or service at any time <strong className="text-indigo-700">without prior notice</strong>.
              </p>
              <p className="bg-indigo-100 border-2 border-indigo-500 p-4 rounded-lg font-semibold">
                📋 Users are responsible for reviewing these Terms & Conditions regularly to stay informed.
              </p>
            </div>
          </section>

          {/* Section 7: User Agreement */}
          <section className="border-l-4 border-teal-600 pl-6 bg-teal-50 p-6 rounded-r-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="bg-teal-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-black text-xl flex-shrink-0">
                7
              </div>
              <div>
                <h2 className="text-3xl font-black text-teal-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-7 w-7" />
                  User Agreement
                </h2>
              </div>
            </div>
            <div className="space-y-4 text-gray-800 text-lg leading-relaxed ml-16">
              <p className="font-bold text-xl text-teal-900 mb-4">
                By using this app, you acknowledge and agree that:
              </p>
              <div className="bg-teal-100 border-2 border-teal-600 p-5 rounded-lg space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-teal-600 flex-shrink-0 mt-1" />
                  <p>You have <strong>read and understood</strong> all the above Terms & Conditions.</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-teal-600 flex-shrink-0 mt-1" />
                  <p>You are using PARAS REWARD for <strong>entertainment and in-app reward purposes only</strong>.</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-teal-600 flex-shrink-0 mt-1" />
                  <p>You are <strong>not expecting</strong> any financial return or guaranteed earnings from this platform.</p>
                </div>
              </div>
            </div>
          </section>


          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">PRC Redeem Process</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Only VIP Members can redeem PRC into cash or services</li>
              <li>10% charity fee will be deducted per redeem</li>
              <li>Redemptions are processed via UPI within 48–72 hours</li>
            </ul>
          </section>

          {/* Final Disclaimer Box */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl p-8 shadow-2xl">
            <div className="flex items-start gap-4">
              <CheckCircle className="h-10 w-10 flex-shrink-0" />
              <div>
                <h3 className="text-3xl font-black mb-4">✅ Final Disclaimer</h3>
                <div className="bg-white/20 backdrop-blur-xl rounded-xl p-6 text-lg leading-relaxed space-y-3">
                  <p className="font-bold text-xl">
                    PARAS REWARD is purely an in-app mining and reward-based entertainment platform.
                  </p>
                  <p className="font-semibold">
                    It has <span className="underline decoration-4">NO connection</span> with:
                  </p>
                  <ul className="space-y-2 ml-6">
                    <li className="flex items-center gap-2">
                      <span className="text-2xl">✗</span> Cryptocurrency
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-2xl">✗</span> Investment schemes
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-2xl">✗</span> Trading platforms
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-2xl">✗</span> MLM (Multi-Level Marketing)
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Section */}
          <div className="bg-gray-50 rounded-2xl p-8 text-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">📧 Need Help?</h3>
            <p className="text-gray-700 text-lg mb-4">
              For any questions or concerns regarding these Terms & Conditions, please contact us:
            </p>
            <a 
              href="mailto:support@parasreward.com" 
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold px-8 py-4 rounded-full transition-colors text-lg shadow-lg"
            >
              <FileText className="h-5 w-5" />
              support@parasreward.com
            </a>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default TermsAndConditions;