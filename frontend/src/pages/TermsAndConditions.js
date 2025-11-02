import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

const TermsAndConditions = () => {
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
              <FileText className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">Terms & Conditions</h1>
            <p className="text-lg text-gray-600">Last Updated: November 2, 2024</p>
          </div>

          <Card className="p-8 sm:p-12 bg-white/90 backdrop-blur-sm shadow-2xl">
            <div className="prose prose-lg max-w-none">
              
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Introduction</h2>
                <p className="text-gray-700 leading-relaxed">
                  Welcome to <strong>PARAS REWARD</strong>. These Terms and Conditions govern your use of our platform, including website, app, and reward services.
                </p>
                <p className="text-gray-700 leading-relaxed mt-3">
                  By using our service, you agree to be bound by the terms given below.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Key Definitions</h2>
                <ul className="list-none space-y-3 text-gray-700">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-1" />
                    <div>
                      <strong>User:</strong> Anyone who registers on PARAS REWARD
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-1" />
                    <div>
                      <strong>PRC:</strong> Paras Reward Coin, the in-platform digital reward points
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-1" />
                    <div>
                      <strong>Rewards Earning:</strong> Earning PRC through time-based participation and activities
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-1" />
                    <div>
                      <strong>VIP Membership:</strong> Paid upgrade enabling access to redeem and other perks
                    </div>
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Eligibility</h2>
                <p className="text-gray-700 leading-relaxed mb-3">
                  You must be:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                  <li>At least 18 years old</li>
                  <li>Located in India</li>
                  <li>Using a valid email and mobile number</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Earning & Rewards</h2>
                <p className="text-gray-700 leading-relaxed">
                  Users may earn PRC by logging in daily, completing tasks, or using the rewards feature. Earning rate is subject to app rules and may change over time.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">PRC Redeem Process</h2>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                  <li>Only VIP Members can redeem PRC into cash or services</li>
                  <li>10% charity fee will be deducted per redeem</li>
                  <li>Redemptions are processed via UPI within 48–72 hours</li>
                </ul>
              </section>

              <section className="mb-8">
                <div className="flex items-start gap-3 mb-4">
                  <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
                  <h2 className="text-2xl font-bold text-gray-900">Prohibited Activities</h2>
                </div>
                <p className="text-gray-700 leading-relaxed mb-3">
                  Users may <strong>NOT:</strong>
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                  <li>Create fake or duplicate accounts</li>
                  <li>Use bots or automated scripts</li>
                  <li>Misuse referral system</li>
                  <li>Post inappropriate content</li>
                </ul>
                <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-600 rounded">
                  <p className="text-red-800 font-semibold">
                    ⚠️ Violation may lead to permanent ban.
                  </p>
                </div>
              </section>

              <section className="mb-8">
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-1" />
                  <h2 className="text-2xl font-bold text-gray-900">Limitation of Liability</h2>
                </div>
                <p className="text-gray-700 leading-relaxed">
                  We are not liable for any financial loss due to technical delays, app misuse, or withdrawal failures caused by third-party services.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Governing Law</h2>
                <p className="text-gray-700 leading-relaxed">
                  These terms are governed by the laws of India.
                </p>
                <p className="text-gray-700 leading-relaxed mt-3">
                  For disputes, email: <a href="mailto:support@parasreward.com" className="text-purple-600 hover:text-purple-700 font-semibold underline">support@parasreward.com</a>
                </p>
              </section>

              <div className="mt-8 p-6 bg-purple-50 border border-purple-200 rounded-xl">
                <h3 className="text-xl font-bold text-purple-900 mb-3">📝 Disclaimer</h3>
                <p className="text-purple-800 leading-relaxed">
                  The earnings shown in PARAS REWARD depend on participation, referrals, and earning rules, and are not guaranteed. We are not a financial or investment platform.
                </p>
                <p className="text-purple-800 leading-relaxed mt-2">
                  Use PARAS REWARD responsibly. All users are responsible for their tax and legal compliance.
                </p>
              </div>

            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;
