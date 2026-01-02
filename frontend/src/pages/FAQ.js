import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import { ChevronDown, ChevronUp } from 'lucide-react';

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      question: "What is Paras Reward?",
      answer: "PARAS REWARD is India's first mining-based rewards platform where users earn PRC (Paras Reward Coins) through daily activities like mining, tap games, and referrals. These coins can be redeemed for real products or gift vouchers."
    },
    {
      question: "How do I earn PRC coins?",
      answer: "You can earn PRC coins through multiple ways: Daily mining (click mine button every hour), Tap game (play daily to earn bonus coins), Referrals (invite friends and earn when they join), and Daily login rewards."
    },
    {
      question: "Is there any joining fee?",
      answer: "No! Joining PARAS REWARD is completely free. You can start earning PRC coins immediately after registration without any investment."
    },
    {
      question: "How to increase mining speed?",
      answer: "You can increase your mining rate by: Referring more friends to join the platform, Becoming a VIP member for enhanced benefits, Completing daily tasks and maintaining consistent activity."
    },
    {
      question: "How to redeem PRC to cash?",
      answer: "Only VIP members can redeem PRC for cash. Go to Wallet section, select Redemption amount, provide your UPI details, and submit the request. Redemptions are processed within 48-72 hours."
    },
    {
      question: "What is the PRC to INR conversion rate?",
      answer: "10 PRC = ₹1 INR. This conversion rate is fixed and applies to all transactions and redemptions on the platform."
    },
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
      answer: "No, only VIP members can redeem products and redeem rewards. Free users can earn and accumulate PRC but must upgrade to VIP to access redemption features."
    },
    {
      question: "What is KYC and why is it required?",
      answer: "KYC (Know Your Customer) verification is mandatory for all Redemption requests. It ensures security and compliance. You need to upload valid government ID proof (Aadhar, PAN, or Driver's License) for verification."
    },
    {
      question: "How long does KYC verification take?",
      answer: "KYC verification typically takes 24-48 hours. You'll receive a notification once your documents are verified. After approval, you can proceed with Redemptions."
    },
    {
      question: "What payment methods are supported for Redemption?",
      answer: "We support multiple UPI payment methods including PhonePe, Google Pay, Paytm, and direct bank transfer. Select your preferred method during Redemption."
    },
    {
      question: "What is the minimum Redemption amount?",
      answer: "The minimum Redemption amount from the Cashback Wallet is ₹10. A Redemption fee of ₹5 applies to each transaction."
    },
    {
      question: "What is the Cashback Wallet?",
      answer: "The Cashback Wallet stores your redemption cashback (25% of product value) in INR. It has a monthly maintenance fee of ₹99 and allows Redemptions of minimum ₹10 with a ₹5 processing fee."
    },
    {
      question: "How does the referral system work?",
      answer: "Share your unique referral code or link with friends. When they register using your code and become active users, you earn bonus PRC coins and increased mining rates."
    },
    {
      question: "Can I create multiple accounts?",
      answer: "No, creating multiple or fake accounts is strictly prohibited and violates our Terms & Conditions. Accounts found violating this rule will be permanently banned."
    },
    {
      question: "What is the Tap Game?",
      answer: "The Tap Game is a daily interactive feature where you tap the screen to earn bonus PRC coins. Play once per day to maximize your earnings."
    },
    {
      question: "How does product redemption work?",
      answer: "Browse the Marketplace, add products to cart, proceed to checkout. Your PRC balance will be deducted, a delivery charge applies, and you'll receive 25% cashback in your Cashback Wallet."
    },
    {
      question: "What happens if I miss daily mining?",
      answer: "If you miss a mining session, you simply won't earn coins for that period. There's no penalty, but consistent daily activity helps maximize your earnings."
    },
    {
      question: "Is PARAS REWARD a cryptocurrency platform?",
      answer: "No, PARAS REWARD is a reward points platform, not a cryptocurrency platform. PRC coins are digital reward points redeemable for products and cash within our ecosystem."
    },
    {
      question: "How secure is my personal information?",
      answer: "We use industry-standard encryption and security measures to protect your data. Your information is never sold to third parties. Read our Privacy Policy for complete details."
    },
    {
      question: "Can I cancel a Redemption request?",
      answer: "Once a Redemption request is submitted, it cannot be cancelled as the amount is immediately deducted from your wallet. If the request is rejected by admin, the amount will be re-credited."
    },
    {
      question: "What if I forget my password?",
      answer: "Click on 'Forgot Password' on the login page, enter your registered email, and you'll receive a password reset link via email."
    },
    {
      question: "How can I contact customer support?",
      answer: "You can reach our support team via email at support@parasreward.com or use the in-app Support Tickets system for faster assistance."
    },
    {
      question: "Are there any hidden charges?",
      answer: "No hidden charges! All fees are clearly mentioned: VIP membership (₹1,000/year), Cashback Wallet maintenance (₹99/month), Redemption fee (₹5 per transaction), and Delivery charges on product orders."
    }
  ];

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

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
          <h1 className="text-4xl font-bold text-gray-900">Frequently Asked Questions</h1>
          <p className="text-gray-600 mt-2">Find answers to common questions about PARAS REWARD</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        <div className="bg-white rounded-lg shadow-lg mt-8">
          {faqs.map((faq, index) => (
            <div key={index} className="border-b border-gray-200 last:border-b-0">
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-lg font-semibold text-gray-900 pr-4">{faq.question}</span>
                {openIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-purple-600 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
              </button>
              {openIndex === index && (
                <div className="px-6 pb-5">
                  <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg shadow-lg p-8 text-white text-center">
          <h3 className="text-2xl font-bold mb-4">Still Have Questions?</h3>
          <p className="text-lg mb-6">Our support team is here to help you!</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="mailto:support@parasreward.com" 
              className="inline-block bg-white text-purple-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              📧 Email Support
            </a>
            <Link 
              to="/contact" 
              className="inline-block bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-800 transition-colors"
            >
              📞 Contact Us
            </Link>
          </div>
        </div>

      </div>

      <Footer />
    </div>
  );
};

export default FAQ;
