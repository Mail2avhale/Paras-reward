import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, ArrowLeft, HelpCircle, Coins, Crown, Gift, Smartphone, Users, Shield } from 'lucide-react';
import SEO from '@/components/SEO';

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
          answer: "PARAS REWARD is a digital engagement platform where users earn virtual reward points (PRC) through activities like daily engagement, tap games, and referrals. The term 'mining' refers to our virtual reward system - NOT cryptocurrency mining. Points can be redeemed for services like mobile recharges and bill payments through our partners."
        },
        {
          question: "What is PRC (Paras Reward Coin)?",
          answer: "PRC is a virtual reward point used ONLY within the Paras Reward platform. It is earned through platform activities and can be redeemed for gift vouchers, recharges, and bill payments. PRC has NO cash value and cannot be converted to real money directly."
        },
        {
          question: "What PRC is NOT - Important Disclaimer",
          answer: "PRC is NOT: ❌ Cryptocurrency or any form of digital currency ❌ Real money, cash, or legal tender ❌ An investment or financial product ❌ Tradeable on any exchange ❌ Transferable to other users ❌ Convertible to cash or bank transfer (except VIP redemption which is a reward, not conversion) ❌ A guaranteed value asset. PRC is purely a promotional loyalty reward for platform engagement."
        },
        {
          question: "Is there any joining fee?",
          answer: "No! Joining PARAS REWARD is completely free. You can start earning promotional reward points immediately after registration. Note: Reward points are promotional in nature and have no guaranteed monetary value."
        }
      ]
    },
    {
      category: 'Earning PRC',
      icon: Coins,
      questions: [
        {
          question: "How do I earn PRC points?",
          answer: "You can earn PRC points through: Daily engagement (virtual mining feature), Tap game (play daily for bonus points), Referrals (earn when friends join and engage), and Daily login activities."
        },
        {
          question: "How to increase reward rate?",
          answer: "You can increase your reward rate by: Referring friends to join, Upgrading to a paid plan (Startup/Growth/Elite), and Maintaining consistent daily activity."
        },
        {
          question: "What is the Tap Game?",
          answer: "The Tap Game is a daily interactive feature where you tap the screen to earn bonus PRC points. Free users get 100 taps/day, paid plans get up to 400 taps/day."
        }
      ]
    },
    {
      category: 'Subscription Plans',
      icon: Crown,
      questions: [
        {
          question: "What subscription plans are available?",
          answer: "We offer 4 plans: Explorer (Free), Startup (₹299/month), Growth (₹549/month), and Elite (₹799/month). Paid plans include higher reward rates, more daily taps, and redemption access."
        },
        {
          question: "Do free users' PRC points expire?",
          answer: "Yes, Explorer (free) users' PRC points expire after 2 days of inactivity. Paid plan users (Startup/Growth/Elite) have permanent point validity."
        },
        {
          question: "Can free users redeem rewards?",
          answer: "No, only paid plan members (Startup/Growth/Elite) can redeem rewards. Free users can earn PRC but must upgrade to access redemption features."
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
        },
        {
          question: "What is the 5-level referral bonus?",
          answer: "You earn bonus from 5 levels of referrals: Level 1 (direct): 10%, Level 2: 5%, Level 3: 3%, Level 4: 2%, Level 5: 1%. Total potential bonus up to 21%!"
        },
        {
          question: "When do I receive referral bonus?",
          answer: "Referral bonus is credited when your referred user completes their daily mining session. The bonus is automatically added to your PRC balance."
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
        },
        {
          question: "How long does bank transfer take?",
          answer: "Bank transfers are processed within 24-72 hours after approval. UPI transfers are usually instant after admin approval."
        },
        {
          question: "Why was my redemption rejected?",
          answer: "Common reasons: Invalid UPI ID, KYC not approved, insufficient balance, or weekly limit exceeded. Check the rejection reason in your transaction history."
        }
      ]
    },
    {
      category: 'Technical Issues',
      icon: HelpCircle,
      questions: [
        {
          question: "App is not loading properly?",
          answer: "Try these steps: 1) Clear app cache, 2) Check internet connection, 3) Update to latest version, 4) Restart the app. If issue persists, contact support."
        },
        {
          question: "Mining session not starting?",
          answer: "Ensure you have stable internet. If the issue continues, log out and log back in. Mining can only be done once every 24 hours."
        },
        {
          question: "Payment proof upload failing?",
          answer: "Image size should be under 5MB. Use JPG or PNG format. Ensure clear visibility of transaction details including UTR number."
        },
        {
          question: "How to change my PIN?",
          answer: "Go to Profile > Security Settings > Change PIN. Enter your current PIN, then set a new 6-digit PIN."
        },
        {
          question: "Forgot my PIN?",
          answer: "Click 'Forgot PIN' on login page, verify via OTP to your registered mobile/email, then set a new PIN."
        }
      ]
    },
    {
      category: 'Account & Profile',
      icon: Shield,
      questions: [
        {
          question: "How to update my profile?",
          answer: "Go to Profile section, tap on the field you want to edit (name, email, phone). Some fields require verification after change."
        },
        {
          question: "Can I delete my account?",
          answer: "Yes, contact support to request account deletion. Note: All PRC balance and transaction history will be permanently deleted."
        },
        {
          question: "Why is my account blocked?",
          answer: "Accounts may be blocked for: Multiple account creation, suspicious activity, policy violations, or KYC fraud. Contact support for appeal."
        }
      ]
    }
  ];

  const toggleQuestion = (categoryIndex, questionIndex) => {
    const key = `${categoryIndex}-${questionIndex}`;
    setOpenIndex(openIndex === key ? null : key);
  };

  return (
    <>
      <SEO 
        title="FAQs - Frequently Asked Questions"
        description="Find answers to common questions about PARAS REWARD - how to earn PRC points, redeem rewards, VIP membership, and more."
        url="https://www.parasreward.com/faq"
      />
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24">
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
    </>
  );
};

export default FAQ;
