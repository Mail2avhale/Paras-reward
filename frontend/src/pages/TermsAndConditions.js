import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Shield, Globe, FileText, CheckCircle, XCircle, Info, Coins, Scale } from 'lucide-react';

const TermsAndConditions = () => {
  const navigate = useNavigate();

  const sections = [
    {
      id: 1,
      title: 'General Information',
      icon: Info,
      color: 'amber',
      content: [
        { type: 'highlight', text: 'PARAS REWARD is India\'s First Mining-Based Reward Platform.' },
        { type: 'text', text: 'This platform is designed to provide users with a fun and engaging experience through in-app activities, games, and reward points.' },
        { type: 'warning', text: 'It is NOT a cryptocurrency, token, or coin of any kind.' }
      ]
    },
    {
      id: 2,
      title: 'In-App Usage Only',
      icon: Shield,
      color: 'blue',
      content: [
        { type: 'text', text: 'PRC (Paras Reward Coins) are virtual reward points that exist only within the PARAS REWARD platform.' },
        { type: 'list', items: [
          'PRC cannot be traded, exchanged, or used outside this platform',
          'PRC has no real-world monetary value',
          'PRC is non-transferable between users'
        ]}
      ]
    },
    {
      id: 3,
      title: 'No Financial Claims',
      icon: Coins,
      color: 'emerald',
      content: [
        { type: 'text', text: 'PARAS REWARD does not guarantee any financial returns, earnings, or profits.' },
        { type: 'warning', text: 'Users participate at their own will and should not treat this platform as an investment opportunity.' }
      ]
    },
    {
      id: 4,
      title: 'Not a Trading Platform',
      icon: Globe,
      color: 'purple',
      content: [
        { type: 'text', text: 'This platform does not offer:' },
        { type: 'list', items: [
          'Cryptocurrency trading or mining',
          'Forex or stock trading',
          'Investment or financial advisory services'
        ]},
        { type: 'highlight', text: 'Any resemblance to trading platforms is purely coincidental.' }
      ]
    },
    {
      id: 5,
      title: 'User Responsibility',
      icon: Scale,
      color: 'orange',
      content: [
        { type: 'text', text: 'Users agree to:' },
        { type: 'list', items: [
          'Use the platform responsibly and ethically',
          'Not create multiple or fake accounts',
          'Not attempt to manipulate or exploit platform mechanics',
          'Provide accurate KYC information when required'
        ]}
      ]
    },
    {
      id: 6,
      title: 'PRC Redemption',
      icon: Coins,
      color: 'amber',
      content: [
        { type: 'list', items: [
          'Only VIP Members can redeem PRC for products or cash',
          '10% charity fee is deducted per redemption',
          'Redemptions are processed via UPI within 48-72 hours',
          'KYC verification is mandatory for all redemptions'
        ]}
      ]
    }
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
            <h1 className="text-white text-xl font-bold">Terms & Conditions</h1>
            <p className="text-gray-500 text-sm">Last updated: January 2025</p>
          </div>
        </div>
      </div>

      {/* Important Disclaimer */}
      <div className="px-5 py-4">
        <div className="bg-red-500/10 rounded-2xl p-4 border border-red-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-red-400 font-bold mb-1">Important Disclaimer</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                PARAS REWARD is purely an <span className="text-red-400 font-semibold">in-app mining and reward-based entertainment platform</span>. 
                It has <span className="text-red-400 font-semibold">NO connection</span> with cryptocurrency, investment, trading, or any MLM scheme.
              </p>
            </div>
          </div>
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
                {section.content.map((item, idx) => {
                  if (item.type === 'text') {
                    return <p key={idx} className="text-gray-400 text-sm leading-relaxed">{item.text}</p>;
                  }
                  if (item.type === 'highlight') {
                    return (
                      <p key={idx} className="text-amber-400 text-sm font-semibold bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                        {item.text}
                      </p>
                    );
                  }
                  if (item.type === 'warning') {
                    return (
                      <p key={idx} className="text-red-400 text-sm bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                        ⚠️ {item.text}
                      </p>
                    );
                  }
                  if (item.type === 'list') {
                    return (
                      <ul key={idx} className="space-y-2">
                        {item.items.map((li, liIdx) => (
                          <li key={liIdx} className="flex items-start gap-2 text-gray-400 text-sm">
                            <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                            <span>{li}</span>
                          </li>
                        ))}
                      </ul>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          );
        })}

        {/* Final Disclaimer */}
        <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/5 rounded-2xl p-5 border border-amber-500/20 mt-6">
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0" />
            <h3 className="text-white font-bold">Final Disclaimer</h3>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            PARAS REWARD is purely an in-app mining and reward-based entertainment platform with <span className="text-white font-semibold">NO connection</span> to:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {['Cryptocurrency', 'Investment schemes', 'Trading platforms', 'MLM schemes'].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-red-400 text-sm">
                <XCircle className="w-4 h-4" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="bg-gray-900/50 rounded-2xl p-5 border border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="w-5 h-5 text-amber-500" />
            <h3 className="text-white font-bold">Need Help?</h3>
          </div>
          <p className="text-gray-400 text-sm mb-4">For questions about these terms, contact us:</p>
          <a 
            href="mailto:support@parasreward.com" 
            className="inline-flex items-center justify-center w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-gray-900 font-bold rounded-xl hover:from-amber-400 hover:to-amber-500 transition-all"
          >
            support@parasreward.com
          </a>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;
