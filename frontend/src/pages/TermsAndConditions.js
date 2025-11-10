import React from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import AdSenseAd from '../components/AdSenseAd';
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
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              Welcome to <strong>PARAS REWARD</strong>. These Terms and Conditions govern your use of our platform, including website, app, and reward services. By using our service, you agree to be bound by the terms given below.
            </p>
          </section>

          <AdSenseAd slot="2234567890" format="auto" />

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Key Definitions</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li><strong>User:</strong> Anyone who registers on PARAS REWARD</li>
              <li><strong>PRC:</strong> Paras Reward Coin, the in-platform digital reward</li>
              <li><strong>Mining:</strong> Earning PRC through time-based participation</li>
              <li><strong>VIP Membership:</strong> Paid upgrade enabling access to redeem and other perks</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Eligibility</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              You must be:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>At least 18 years old</li>
              <li>Located in India</li>
              <li>Using a valid email and mobile number</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Earning & Mining</h2>
            <p className="text-gray-700 leading-relaxed">
              Users may earn PRC by logging in daily, completing tasks, or using the mining feature. Mining rate is subject to app rules and may change over time.
            </p>
          </section>

          <AdSenseAd slot="2234567891" format="rectangle" />

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">PRC Redeem Process</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Only VIP Members can redeem PRC into cash or services</li>
              <li>10% charity fee will be deducted per redeem</li>
              <li>Redemptions are processed via UPI within 48–72 hours</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Prohibited Activities</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Users may NOT:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Create fake or duplicate accounts</li>
              <li>Use bots or automated scripts</li>
              <li>Misuse referral system</li>
              <li>Post inappropriate content</li>
            </ul>
            <p className="text-red-600 font-semibold mt-4">
              Violation may lead to permanent ban.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Limitation of Liability</h2>
            <p className="text-gray-700 leading-relaxed">
              We are not liable for any financial loss due to technical delays, app misuse, or withdrawal failures caused by third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Governing Law</h2>
            <p className="text-gray-700 leading-relaxed">
              These terms are governed by the laws of India. For disputes, email: <a href="mailto:support@parasreward.com" className="text-purple-600 hover:underline font-semibold">support@parasreward.com</a>
            </p>
          </section>

          <section className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">📝 Disclaimer</h3>
            <p className="text-gray-700 leading-relaxed">
              The earnings shown in PARAS REWARD depend on participation, referrals, and mining rules, and are not guaranteed. We are not a financial or investment platform. Use PARAS REWARD responsibly. All users are responsible for their tax and legal compliance.
            </p>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default TermsAndConditions;