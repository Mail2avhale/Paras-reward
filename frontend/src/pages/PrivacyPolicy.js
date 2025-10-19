import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield, Lock, Eye, UserCheck } from 'lucide-react';

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
              <Button variant="ghost" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl mb-4">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
          <p className="text-gray-600">Effective Date: January 1, 2025</p>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl mb-8">
          <div className="prose prose-lg max-w-none">
            <p className="text-lg text-gray-700 mb-6">
              At PARAS REWARD, we value your privacy. This policy explains how we handle your data:
            </p>

            <div className="space-y-8">
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Eye className="h-5 w-5 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">1. Information Collected</h2>
                </div>
                <p className="text-gray-700 mb-3">We collect the following information to provide our services:</p>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li>Name, Mobile Number, Email Address</li>
                  <li>Complete Address (State, District, Taluka, Village, Pin Code)</li>
                  <li>Aadhaar and PAN (for KYC verification)</li>
                  <li>Bank/UPI details for withdrawals</li>
                  <li>Device information (for fraud prevention and security)</li>
                  <li>IP address and login history</li>
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <UserCheck className="h-5 w-5 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">2. Data Usage</h2>
                </div>
                <p className="text-gray-700 mb-3">Your data is used exclusively for:</p>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li>Providing mining, referral, and redemption services</li>
                  <li>Processing payments, cashback, and renewal fees</li>
                  <li>Security checks and fraud prevention</li>
                  <li>Sending notifications and updates about your account</li>
                  <li>Complying with legal and regulatory requirements</li>
                  <li>Improving our services and user experience</li>
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Shield className="h-5 w-5 text-purple-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">3. Data Sharing</h2>
                </div>
                <div className="bg-green-50 border-2 border-green-200 p-4 rounded-xl mb-3">
                  <p className="text-green-800 font-semibold">✓ We never sell your personal data.</p>
                </div>
                <p className="text-gray-700">
                  Data may be shared only with regulatory authorities if legally required. We do not share your information with third parties for marketing purposes.
                </p>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                    <Lock className="h-5 w-5 text-red-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">4. Security</h2>
                </div>
                <p className="text-gray-700 mb-3">We take security seriously:</p>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li>All sensitive information (PAN, Aadhaar, Bank details) is encrypted</li>
                  <li>Stored securely using industry-standard protocols</li>
                  <li>Regular security audits are conducted</li>
                  <li>Access to personal data is restricted to authorized personnel only</li>
                  <li>Multi-factor authentication for admin access</li>
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                    <Eye className="h-5 w-5 text-yellow-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">5. User Rights</h2>
                </div>
                <p className="text-gray-700 mb-3">You have the following rights:</p>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li>Update profile and contact details anytime</li>
                  <li>Request account deletion by contacting support</li>
                  <li>Access your data and download your information</li>
                  <li>Opt-out of promotional communications</li>
                  <li>Request correction of inaccurate data</li>
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <Shield className="h-5 w-5 text-indigo-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">6. Cookies & Tracking</h2>
                </div>
                <p className="text-gray-700">
                  We use cookies and similar technologies to enhance your experience, remember your preferences, and analyze usage patterns. You can control cookie settings through your browser.
                </p>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center">
                    <UserCheck className="h-5 w-5 text-pink-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">7. Data Retention</h2>
                </div>
                <p className="text-gray-700">
                  We retain your personal data for as long as your account is active or as needed to provide services. After account deletion, data is retained for a limited period as required by law for audit and compliance purposes.
                </p>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                    <Shield className="h-5 w-5 text-teal-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">8. Policy Updates</h2>
                </div>
                <p className="text-gray-700">
                  We may update this Privacy Policy from time to time. Users will be notified in-app and required to re-accept new policies. Continued use of services after changes constitutes acceptance.
                </p>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Lock className="h-5 w-5 text-orange-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">9. Children's Privacy</h2>
                </div>
                <p className="text-gray-700">
                  Our services are not intended for users under 18 years of age. We do not knowingly collect personal information from children.
                </p>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                    <Eye className="h-5 w-5 text-gray-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">10. Contact Us</h2>
                </div>
                <p className="text-gray-700">
                  For any privacy-related questions or concerns, please contact us at:
                  <br />
                  <strong>Email:</strong> privacy@parasreward.com
                  <br />
                  <strong>Address:</strong> PARAS REWARD, Maharashtra, India
                </p>
              </section>
            </div>

            <div className="mt-8 p-6 bg-blue-50 border-2 border-blue-200 rounded-xl">
              <h3 className="font-bold text-blue-900 mb-3">Your Privacy Matters</h3>
              <p className="text-sm text-blue-800">
                We are committed to protecting your privacy and ensuring the security of your personal information. If you have any concerns about how your data is being handled, please don't hesitate to reach out to our privacy team.
              </p>
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                Last Updated: January 1, 2025 | Version 1.0
              </p>
            </div>
          </div>
        </Card>

        <div className="text-center">
          <Link to="/terms">
            <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white">
              View Terms & Conditions
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
