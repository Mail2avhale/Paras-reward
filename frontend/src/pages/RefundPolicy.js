import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, Crown, ShoppingBag, Wallet, AlertCircle, CheckCircle, HelpCircle, Mail } from 'lucide-react';

const RefundPolicy = () => {
  const navigate = useNavigate();

  const sections = [
    {
      id: 1,
      title: 'PRC Reward Points',
      icon: Coins,
      color: 'amber',
      policies: [
        {
          title: 'Non-Refundable Policy',
          description: 'PRC (PARAS Reward Coins) earned through mining, tap games, treasure hunts, or scratch cards are non-refundable and non-transferable.',
          type: 'warning'
        },
        { text: 'Earned PRC: Points earned through platform activities cannot be refunded or exchanged for money.' },
        { text: 'Expiry Policy: Free users\' PRC may expire as per platform terms. VIP users\' PRC does not expire.' },
        { text: 'No Cash Value: PRC points have no monetary value outside the platform.' },
        { text: 'Account Termination: If your account is terminated due to violation of terms, all accumulated PRC will be forfeited.' }
      ]
    },
    {
      id: 2,
      title: 'VIP Membership Fees',
      icon: Crown,
      color: 'purple',
      policies: [
        {
          title: 'No Refund After Activation',
          description: 'VIP membership fees are non-refundable once the membership is activated and benefits are accessible.',
          type: 'warning'
        },
        { text: 'Refund Window: Refunds may be considered within 24 hours of purchase if no VIP benefits have been used.' },
        { text: 'Partial Refunds: No partial refunds for unused membership duration.' },
        { text: 'Technical Issues: If unable to activate VIP due to platform issues, a full refund will be processed.' }
      ]
    },
    {
      id: 3,
      title: 'Product Redemptions',
      icon: ShoppingBag,
      color: 'emerald',
      policies: [
        { text: 'PRC Deduction: Once PRC is deducted for product redemption, it cannot be reversed.' },
        { text: 'Order Cancellation: Orders can only be cancelled before admin verification.' },
        { text: 'Damaged Products: Report damaged products within 48 hours of delivery for PRC refund.' },
        { text: 'Non-Delivery: Full PRC refund if product is not delivered within 30 days.' }
      ]
    }
    // Cashback Wallet section removed - cashback system deprecated
  ];

  const refundProcess = [
    'Submit refund request via Support section',
    'Provide order/transaction details',
    'Wait for admin review (2-3 business days)',
    'Receive confirmation via email/notification',
    'Refund processed within 5-7 business days'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 sticky top-0 z-10 bg-gray-950/80 backdrop-blur-md border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">Refund Policy</h1>
            <p className="text-gray-500 text-sm">Last updated: January 2025</p>
          </div>
        </div>
      </div>

      {/* Intro */}
      <div className="px-5 py-4">
        <div className="bg-gray-900/50 rounded-2xl p-4 border border-gray-800">
          <p className="text-gray-400 text-sm leading-relaxed">
            At <span className="text-amber-500 font-semibold">PARAS REWARD</span>, we are committed to ensuring your satisfaction. 
            This policy outlines the terms for refunds, cancellations, and returns on our platform.
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="px-5 space-y-4">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.id} className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden">
              {/* Section Header */}
              <div className={`flex items-center gap-3 p-4 bg-${section.color}-500/10 border-b border-gray-800`}>
                <div className={`w-10 h-10 rounded-xl bg-${section.color}-500/20 flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 text-${section.color}-500`} />
                </div>
                <h2 className="text-white font-bold">{section.id}. {section.title}</h2>
              </div>

              {/* Section Content */}
              <div className="p-4 space-y-3">
                {section.policies.map((policy, idx) => {
                  if (policy.type === 'warning') {
                    return (
                      <div key={idx} className="bg-red-500/10 rounded-xl p-3 border border-red-500/20">
                        <p className="text-red-400 font-semibold text-sm mb-1">{policy.title}</p>
                        <p className="text-gray-400 text-xs">{policy.description}</p>
                      </div>
                    );
                  }
                  return (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <p className="text-gray-400 text-sm">{policy.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Refund Process */}
        <div className="bg-gray-900/50 rounded-2xl p-5 border border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-amber-500" />
            </div>
            <h2 className="text-white font-bold">How to Request a Refund</h2>
          </div>
          <div className="space-y-3">
            {refundProcess.map((step, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-amber-500 text-gray-900 font-bold flex items-center justify-center text-sm flex-shrink-0">
                  {idx + 1}
                </div>
                <p className="text-gray-400 text-sm">{step}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Important Notice */}
        <div className="bg-amber-500/10 rounded-2xl p-4 border border-amber-500/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-400 font-semibold text-sm mb-1">Important Notice</p>
              <p className="text-gray-400 text-xs leading-relaxed">
                PARAS REWARD reserves the right to deny refund requests that do not meet our policy criteria. 
                All decisions are final and at the discretion of our admin team.
              </p>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-gray-900/50 rounded-2xl p-5 border border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <Mail className="w-5 h-5 text-amber-500" />
            <h3 className="text-white font-bold">Need Assistance?</h3>
          </div>
          <p className="text-gray-400 text-sm mb-4">For refund inquiries, contact our support team:</p>
          <button 
            onClick={() => navigate('/contact')}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-gray-900 font-bold rounded-xl hover:from-amber-400 hover:to-amber-500 transition-all"
          >
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicy;
