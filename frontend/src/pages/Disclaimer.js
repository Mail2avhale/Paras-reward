import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, AlertTriangle, CheckCircle, Info, FileText } from 'lucide-react';

const Disclaimer = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-lg border-b border-gray-800 px-5 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-gray-400">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-white">Terms & Disclaimer</h1>
        </div>
      </div>

      <div className="px-5 py-6 space-y-6">
        {/* App Description */}
        <div className="p-5 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-amber-500" />
            </div>
            <h2 className="text-lg font-bold text-white">About Paras Reward</h2>
          </div>
          <p className="text-gray-300 leading-relaxed">
            Paras Reward is a mining-based digital reward and engagement platform. The application allows users to earn virtual reward points through user engagement, participation in activities, referrals and platform interactions.
          </p>
        </div>

        {/* Mining Clarification */}
        <div className="p-5 bg-gray-900/50 border border-gray-800 rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Info className="w-5 h-5 text-blue-500" />
            </div>
            <h2 className="text-lg font-bold text-white">Mining Clarification</h2>
          </div>
          <p className="text-gray-300 leading-relaxed">
            The term <span className="text-amber-400 font-semibold">"mining"</span> used in the app refers only to a virtual reward generation mechanism based on user engagement and <span className="text-red-400 font-semibold">does not involve</span>:
          </p>
          <ul className="mt-3 space-y-2">
            <li className="flex items-center gap-2 text-gray-400">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
              Cryptocurrency mining
            </li>
            <li className="flex items-center gap-2 text-gray-400">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
              Real-money mining
            </li>
            <li className="flex items-center gap-2 text-gray-400">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
              Any form of investment activity
            </li>
          </ul>
        </div>

        {/* Reward Redemption */}
        <div className="p-5 bg-gray-900/50 border border-gray-800 rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <h2 className="text-lg font-bold text-white">Reward Redemption</h2>
          </div>
          <p className="text-gray-300 leading-relaxed">
            Earned reward points are <span className="text-amber-400">promotional in nature</span> and may be redeemed through authorized third-party partners for services such as:
          </p>
          <ul className="mt-3 space-y-2">
            <li className="flex items-center gap-2 text-gray-400">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              Mobile recharges
            </li>
            <li className="flex items-center gap-2 text-gray-400">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              Utility bill payments
            </li>
            <li className="flex items-center gap-2 text-gray-400">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              FASTag recharge
            </li>
            <li className="flex items-center gap-2 text-gray-400">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              Loan repayment facilitation
            </li>
            <li className="flex items-center gap-2 text-gray-400">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              In-app shopping
            </li>
          </ul>
          <p className="text-gray-500 text-sm mt-3 italic">
            Subject to availability and partner terms.
          </p>
        </div>

        {/* Important Disclaimers */}
        <div className="p-5 bg-red-500/5 border border-red-500/20 rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-white">Important Disclaimers</h2>
          </div>
          <p className="text-gray-300 leading-relaxed mb-3">
            Paras Reward <span className="text-red-400 font-semibold">does NOT</span> offer:
          </p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-gray-400">
              <span className="text-red-500">✗</span>
              Guaranteed income or fixed returns
            </li>
            <li className="flex items-center gap-2 text-gray-400">
              <span className="text-red-500">✗</span>
              Financial advice or investment schemes
            </li>
            <li className="flex items-center gap-2 text-gray-400">
              <span className="text-red-500">✗</span>
              Betting, gambling or lottery services
            </li>
            <li className="flex items-center gap-2 text-gray-400">
              <span className="text-red-500">✗</span>
              Public deposits (not a bank or NBFC)
            </li>
          </ul>
          <p className="text-gray-400 text-sm mt-4">
            All payment-related services are facilitated through licensed third-party service providers.
          </p>
        </div>

        {/* Advertisements */}
        <div className="p-5 bg-gray-900/50 border border-gray-800 rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-500" />
            </div>
            <h2 className="text-lg font-bold text-white">Advertisement Policy</h2>
          </div>
          <p className="text-gray-300 leading-relaxed">
            Advertisements displayed in the app are served in compliance with <span className="text-amber-400">Google Play Store</span> and <span className="text-amber-400">Google AdMob</span> policies.
          </p>
          <p className="text-emerald-400 mt-3 font-medium">
            ✓ Users are never required or forced to click on advertisements to earn rewards.
          </p>
          <p className="text-gray-400 text-sm mt-2">
            Ad interactions, if any, are completely voluntary.
          </p>
        </div>

        {/* Reward Terms */}
        <div className="p-5 bg-gray-900/50 border border-gray-800 rounded-2xl">
          <h2 className="text-lg font-bold text-white mb-3">Reward Terms</h2>
          <ul className="space-y-3 text-gray-400 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-1">•</span>
              Reward availability, redemption value and platform features may change from time to time as per company policies.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-1">•</span>
              Rewards do not represent real currency and have no guaranteed monetary value.
            </li>
          </ul>
        </div>

        {/* Data Privacy */}
        <div className="p-5 bg-gray-900/50 border border-gray-800 rounded-2xl">
          <h2 className="text-lg font-bold text-white mb-3">Data Privacy</h2>
          <p className="text-gray-400">
            User data is handled securely and responsibly in accordance with applicable data protection laws and platform policies.
          </p>
        </div>

        {/* Footer */}
        <div className="text-center pt-6 border-t border-gray-800">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} Paras Reward. All rights reserved.
          </p>
          <p className="text-gray-600 text-xs mt-2">
            Last updated: January 2026
          </p>
        </div>
      </div>
    </div>
  );
};

export default Disclaimer;
