import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, ArrowLeft, HelpCircle, Coins, Crown, Gift, Smartphone, Users, Shield } from 'lucide-react';

const FAQ = () => {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      category: 'Getting Started',
      icon: HelpCircle,
      questions: [
        {
          question: "What is Paras Reward?",
          answer: "PARAS REWARD is India's first mining-based rewards platform where users earn PRC (Paras Reward Coins) through daily activities like mining, tap games, and referrals. These coins can be redeemed for real products or gift vouchers."
        },
        {
          question: "Is there any joining fee?",
          answer: "No! Joining PARAS REWARD is completely free. You can start earning PRC coins immediately after registration without any investment."
        }
      ]
    },
    {
      category: 'Earning PRC',
      icon: Coins,
      questions: [
        {
          question: "How do I earn PRC coins?",
          answer: "You can earn PRC coins through multiple ways: Daily mining (click mine button every hour), Tap game (play daily to earn bonus coins), Referrals (invite friends and earn when they join), and Daily login rewards."
        },
        {
          question: "How to increase mining speed?",
          answer: "You can increase your mining rate by: Referring more friends to join the platform, Becoming a VIP member for enhanced benefits, Completing daily tasks and maintaining consistent activity."
        },
        {
          question: "What is the Tap Game?",
          answer: "The Tap Game is a daily interactive feature where you tap the screen to earn bonus PRC coins. Play once per day to maximize your earnings."
        }
      ]
    },
    {
      category: 'VIP Membership',
      icon: Crown,
      questions: [
        {
          question: "What is VIP membership and how much does it cost?",
          answer: "VIP membership costs ₹1,000 per year and unlocks unlimited PRC validity, full redemption access, priority support, exclusive marketplace access, and higher mining rates."
        },
        {
          question: "Do free users' PRC coins expire?",
          answer: "Yes, free users have a 24-hour PRC validity period. Coins earned through mining and tap games will expire after 24 hours. VIP members have unlimited coin validity."
        },
        {
          question: "Can free users redeem products?",
          answer: "No, only VIP members can redeem products and rewards. Free users can earn and accumulate PRC but must upgrade to VIP to access redemption features."
        }
      ]
    },
    {
      category: 'Redemption',
      icon: Gift,
      questions: [
        {
          question: "How to redeem PRC to cash?",
          answer: "Only VIP members can redeem PRC for cash. Go to Wallet section, select Redemption amount, provide your UPI details, and submit the request. Redemptions are processed within 48-72 hours."
        },
        {
          question: "What is the PRC to INR conversion rate?",
          answer: "10 PRC = ₹1 INR. This conversion rate is fixed and applies to all transactions and redemptions on the platform."
        },
        {
          question: "What is the minimum Redemption amount?",
          answer: "The minimum Redemption amount from the Cashback Wallet is ₹10. A Redemption fee of ₹5 applies to each transaction."
        },
        {
          question: "How does product redemption work?",
          answer: "Browse the Marketplace, add products to cart, proceed to checkout. Your PRC balance will be deducted, a delivery charge applies, and you'll receive 25% cashback in your Cashback Wallet."
        }
      ]
    },
    {
      category: 'KYC & Security',
      icon: Shield,
      questions: [
        {
          question: "What is KYC and why is it required?",
          answer: "KYC (Know Your Customer) verification is mandatory for all Redemption requests. It ensures security and compliance. You need to upload valid government ID proof (Aadhar, PAN, or Driver's License) for verification."
        },
        {
          question: "How long does KYC verification take?",
          answer: "KYC verification typically takes 24-48 hours. You'll receive a notification once your documents are verified. After approval, you can proceed with Redemptions."
        },
        {
          question: "Can I create multiple accounts?",
          answer: "No, creating multiple or fake accounts is strictly prohibited and violates our Terms & Conditions. Accounts found violating this rule will be permanently banned."
        }
      ]
    },
    {
      category: 'Referrals',
      icon: Users,
      questions: [
        {
          question: "How does the referral system work?",
          answer: "Share your unique referral code or link with friends. When they register using your code and become active users, you earn bonus PRC coins and increased mining rates."
        }
      ]
    },
    {
      category: 'Payments',
      icon: Smartphone,
      questions: [
        {
          question: "What payment methods are supported for Redemption?",
          answer: "We support multiple UPI payment methods including PhonePe, Google Pay, Paytm, and direct bank transfer. Select your preferred method during Redemption."
        },
        {
          question: "What is the Cashback Wallet?",
          answer: "The Cashback Wallet stores your redemption cashback (25% of product value) in INR. It has a monthly maintenance fee of ₹99 and allows Redemptions of minimum ₹10 with a ₹5 processing fee."
        }
      ]
    }
  ];

  const toggleQuestion = (categoryIndex, questionIndex) => {
    const key = `${categoryIndex}-${questionIndex}`;
    setOpenIndex(openIndex === key ? null : key);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-8">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 sticky top-0 z-10 bg-gray-950/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">FAQ</h1>
            <p className="text-gray-500 text-sm">Frequently Asked Questions</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 space-y-4">
        {faqs.map((category, catIndex) => {
          const Icon = category.icon;
          return (
            <div key={catIndex} className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden">
              {/* Category Header */}
              <div className="flex items-center gap-3 p-4 border-b border-gray-800">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-amber-500" />
                </div>
                <h2 className="text-white font-bold">{category.category}</h2>
              </div>

              {/* Questions */}
              <div className="divide-y divide-gray-800/50">
                {category.questions.map((faq, qIndex) => {
                  const isOpen = openIndex === `${catIndex}-${qIndex}`;
                  return (
                    <div key={qIndex}>
                      <button
                        onClick={() => toggleQuestion(catIndex, qIndex)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800/30 transition-colors"
                      >
                        <span className="text-gray-300 text-sm font-medium pr-4">{faq.question}</span>
                        {isOpen ? (
                          <ChevronUp className="w-5 h-5 text-amber-500 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                        )}
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4">
                          <p className="text-gray-500 text-sm leading-relaxed bg-gray-800/30 p-3 rounded-xl">
                            {faq.answer}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Contact Support */}
        <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/5 rounded-2xl p-5 border border-amber-500/20 mt-6">
          <h3 className="text-white font-bold mb-2">Still have questions?</h3>
          <p className="text-gray-400 text-sm mb-4">Our support team is here to help you 24/7</p>
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

export default FAQ;
