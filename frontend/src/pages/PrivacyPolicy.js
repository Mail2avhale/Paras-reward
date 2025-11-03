import React from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import AdSenseAd from '../components/AdSenseAd';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/" className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="text-gray-600 mt-2">Last Updated: January 2025</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8 space-y-8">
          <section>
            <p className="text-gray-700 leading-relaxed mb-4">
              At <strong>PARAS REWARD</strong>, accessible from <a href={window.location.origin} className="text-purple-600 hover:underline">{window.location.host}</a>, your privacy is important to us. This Privacy Policy document contains types of information that is collected and recorded by PARAS REWARD and how we use it.
            </p>
          </section>

          <AdSenseAd slot="1234567890" format="auto" />

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Information We Collect</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We collect personal information when a user registers, including:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Name</li>
              <li>Email address</li>
              <li>Mobile number</li>
              <li>Transaction and app usage data</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              We do not sell, trade, or transfer personal information to third parties unless required for core services like rewards, mining, or payment processing.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Cookies & Web Beacons</h2>
            <p className="text-gray-700 leading-relaxed">
              We use cookies to personalize user experience and analyze site usage. Third-party services such as Google AdSense may use cookies to serve ads based on previous interactions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Use of Personal Information</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We use collected data to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Provide mining rewards and manage user accounts</li>
              <li>Process withdrawals/redeem requests</li>
              <li>Improve app and website functionality</li>
              <li>Send account or promotional communications</li>
            </ul>
          </section>

          <AdSenseAd slot="1234567891" format="rectangle" />

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Third-Party Services</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We use:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Google AdSense for advertisements</li>
              <li>Firebase for user data and balances</li>
              <li>Payment providers for redemption/withdrawal</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              These partners may collect anonymized data in compliance with law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">User Rights</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              You may request:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Account deletion</li>
              <li>Personal data access</li>
              <li>Withdrawal of data consent</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              Email us at <a href="mailto:support@parasreward.com" className="text-purple-600 hover:underline font-semibold">support@parasreward.com</a> for such queries.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Contact</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have questions regarding this Privacy Policy, reach out at: <a href="mailto:support@parasreward.com" className="text-purple-600 hover:underline font-semibold">📧 support@parasreward.com</a>
            </p>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;