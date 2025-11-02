import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield, Lock, Eye, FileText } from 'lucide-react';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">P</span>
              </div>
              <span className="text-xl font-bold text-gray-900">PARAS REWARD</span>
            </Link>
            <Link to="/">
              <Button variant="ghost" className="flex items-center gap-2 hover:bg-purple-50">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl mb-6 shadow-xl">
              <Shield className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
            <p className="text-lg text-gray-600">Last Updated: November 2, 2024</p>
          </div>

          <Card className="p-8 sm:p-12 bg-white/90 backdrop-blur-sm shadow-2xl">
            <div className="prose prose-lg max-w-none">
              
              <section className="mb-8">
                <p className="text-gray-700 leading-relaxed mb-4">
                  At <strong>PARAS REWARD</strong>, accessible from <a href="https://parasreward.com" className="text-purple-600 hover:text-purple-700 underline">https://parasreward.com</a>, your privacy is important to us. This Privacy Policy document contains types of information that is collected and recorded by PARAS REWARD and how we use it.
                </p>
              </section>

              <section className="mb-8">
                <div className="flex items-start gap-3 mb-4">
                  <FileText className="h-6 w-6 text-purple-600 flex-shrink-0 mt-1" />
                  <h2 className="text-2xl font-bold text-gray-900">Information We Collect</h2>
                </div>
                <p className="text-gray-700 leading-relaxed mb-3">
                  We collect personal information when a user registers, including:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                  <li>Name</li>
                  <li>Email address</li>
                  <li>Mobile number</li>
                  <li>Transaction and app usage data</li>
                </ul>
                <p className="text-gray-700 leading-relaxed mt-4">
                  We <strong>do not sell, trade, or transfer</strong> personal information to third parties unless required for core services like rewards, earning activities, or payment processing.
                </p>
              </section>

              <section className="mb-8">
                <div className="flex items-start gap-3 mb-4">
                  <Eye className="h-6 w-6 text-purple-600 flex-shrink-0 mt-1" />
                  <h2 className="text-2xl font-bold text-gray-900">Cookies & Web Beacons</h2>
                </div>
                <p className="text-gray-700 leading-relaxed">
                  We use cookies to personalize user experience and analyze site usage. Third-party services such as <strong>Google AdSense</strong> may use cookies to serve ads based on previous interactions.
                </p>
              </section>

              <section className="mb-8">
                <div className="flex items-start gap-3 mb-4">
                  <Lock className="h-6 w-6 text-purple-600 flex-shrink-0 mt-1" />
                  <h2 className="text-2xl font-bold text-gray-900">Use of Personal Information</h2>
                </div>
                <p className="text-gray-700 leading-relaxed mb-3">
                  We use collected data to:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                  <li>Provide reward earnings and manage user accounts</li>
                  <li>Process withdrawals/redeem requests</li>
                  <li>Improve app and website functionality</li>
                  <li>Send account or promotional communications</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Third-Party Services</h2>
                <p className="text-gray-700 leading-relaxed mb-3">
                  We use:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                  <li><strong>Google AdSense</strong> for advertisements</li>
                  <li><strong>Payment providers</strong> for redemption/withdrawal</li>
                  <li><strong>Analytics services</strong> for user data and balances</li>
                </ul>
                <p className="text-gray-700 leading-relaxed mt-4">
                  These partners may collect anonymized data in compliance with law.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">User Rights</h2>
                <p className="text-gray-700 leading-relaxed mb-3">
                  You may request:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                  <li>Account deletion</li>
                  <li>Personal data access</li>
                  <li>Withdrawal of data consent</li>
                </ul>
                <p className="text-gray-700 leading-relaxed mt-4">
                  Email us at <a href="mailto:support@parasreward.com" className="text-purple-600 hover:text-purple-700 font-semibold underline">support@parasreward.com</a> for such queries.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Contact</h2>
                <p className="text-gray-700 leading-relaxed">
                  If you have questions regarding this Privacy Policy, reach out at:<br />
                  📧 <a href="mailto:support@parasreward.com" className="text-purple-600 hover:text-purple-700 font-semibold underline">support@parasreward.com</a>
                </p>
              </section>

            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
