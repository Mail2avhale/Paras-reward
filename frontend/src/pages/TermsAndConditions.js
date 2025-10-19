import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertCircle } from 'lucide-react';

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
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Terms and Conditions</h1>
          <p className="text-gray-600">Effective Date: January 1, 2025</p>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl">
          <div className="prose prose-lg max-w-none">
            <p className="text-lg text-gray-700 mb-6">
              Welcome to PARAS REWARD. By registering and using our services, you agree to the following Terms:
            </p>

            <div className="space-y-8">
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Eligibility</h2>
                <p className="text-gray-700">
                  Users must be 18+ and complete KYC verification (Aadhaar + PAN). All information provided must be accurate and truthful.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Token Usage</h2>
                <p className="text-gray-700">
                  PRC (Paras Reward Coin) is an in-app virtual token valued at 10 PRC = ₹1 INR. It has no external market value and cannot be traded outside the PARAS REWARD ecosystem.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Membership</h2>
                <p className="text-gray-700">
                  VIP Membership is mandatory for redemption and wallet withdrawals. Membership fee is ₹1,000/year and renewal fees are non-refundable. Membership must be renewed annually to maintain VIP status.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Mining Rules</h2>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li>Mining resets every 24 hours</li>
                  <li>Users must login and restart mining daily</li>
                  <li>Inactive users will not earn rewards</li>
                  <li>Mining rate calculated based on date, base rate, and referrals</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Referral System</h2>
                <p className="text-gray-700">
                  Referral rewards are credited only if referred users are active (daily login). Duplicate referrals or fake accounts will result in immediate suspension without notice.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Wallet & Cashback</h2>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li>Cashback wallet is for redemption rewards only</li>
                  <li>Annual maintenance charges of ₹99 apply automatically</li>
                  <li>Minimum withdrawal: ₹10</li>
                  <li>Withdrawal fee: ₹5 per transaction</li>
                  <li>Wallet may be frozen for non-payment of maintenance fees</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">7. KYC & Compliance</h2>
                <p className="text-gray-700">
                  Only KYC-verified users can access wallet withdrawals and product redemption. Providing false details will lead to permanent ban and forfeiture of all rewards.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Security</h2>
                <p className="text-gray-700">
                  Multi-login fraud, system manipulation, or any attempt to exploit the platform will result in immediate suspension without notice and possible legal action.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Modifications</h2>
                <p className="text-gray-700">
                  Company reserves the right to update mining formula, cashback rates, fees, and policies with reasonable notice to users.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Jurisdiction</h2>
                <p className="text-gray-700">
                  All disputes will be subject to Maharashtra jurisdiction. Users agree to resolve disputes through arbitration before pursuing legal action.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Account Termination</h2>
                <p className="text-gray-700">
                  We reserve the right to suspend or terminate accounts that violate these terms, engage in fraudulent activity, or misuse the platform.
                </p>
              </section>
            </div>

            <div className="mt-8 p-6 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-yellow-900 mb-2">Important Notice</h3>
                  <p className="text-sm text-yellow-800">
                    By continuing to use PARAS REWARD, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, please do not use our services.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                Last Updated: January 1, 2025 | Version 1.0
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TermsAndConditions;