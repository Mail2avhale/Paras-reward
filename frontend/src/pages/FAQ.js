import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      question: "What is PARAS REWARD?",
      answer: "PARAS REWARD is India's first reward-based engagement platform where users earn PRC (Paras Reward Coins) through daily activities, games, and referrals. You can redeem PRC for real products or cash withdrawals."
    },
    {
      question: "How do I earn PRC coins?",
      answer: "You can earn PRC through multiple ways: 1) Start daily reward sessions (24-hour cycles), 2) Play the tap game (up to 100 PRC/day), 3) Refer friends (get 10% bonus on their earning rate), 4) Complete daily tasks and challenges."
    },
    {
      question: "Is there any joining fee?",
      answer: "No! PARAS REWARD is 100% free to join. You can start earning immediately without any investment. However, VIP membership (₹1000/year) is optional and unlocks additional benefits like unlimited PRC validity and instant withdrawals."
    },
    {
      question: "How to increase my earning rate?",
      answer: "Your earning rate increases based on: 1) Number of active referrals (up to 200), 2) Daily activity and engagement, 3) VIP membership status, 4) Completing daily tasks. Each active referral gives you 10% bonus on their earning rate."
    },
    {
      question: "How to redeem PRC to cash?",
      answer: "Only VIP members can redeem PRC to cash. Process: 1) Upgrade to VIP (₹1000/year), 2) Go to Wallet section, 3) Request withdrawal (minimum ₹10), 4) Enter UPI details, 5) Receive payment in 48-72 hours. A 10% charity fee and ₹5 processing fee apply."
    },
    {
      question: "What is the conversion rate for PRC?",
      answer: "10 PRC = ₹1 INR. For example, if you earn 1000 PRC, it equals ₹100. You also get 25% cashback on every product redemption."
    },
    {
      question: "Do PRC coins expire?",
      answer: "For FREE users: PRC earning is restricted (VIP membership required). For VIP members: PRC never expires - unlimited validity."
    },
    {
      question: "How does the referral system work?",
      answer: "Share your unique referral link with friends. When they join and start earning, you get 10% bonus on their earning rate. You can refer up to 200 users. The more active referrals you have, the higher your earnings."
    },
    {
      question: "What is VIP Membership?",
      answer: "VIP Membership costs ₹1000/year and includes: Unlimited PRC validity, Instant UPI withdrawals, Higher earning rates, Priority support, Exclusive product access, No withdrawal limits, and access to redeem features."
    },
    {
      question: "How long does withdrawal take?",
      answer: "Cashback wallet withdrawals are processed within 48-72 hours via UPI. Make sure your UPI ID is correct and your account is KYC verified for smooth processing."
    },
    {
      question: "Is PARAS REWARD safe and legit?",
      answer: "Yes! PARAS REWARD is a registered platform with 10,000+ active users and ₹50L+ rewards distributed. We use bank-grade security, encrypted transactions, and comply with Indian data protection laws."
    },
    {
      question: "What products can I redeem?",
      answer: "Our marketplace has 5000+ products including electronics, home appliances, fashion items, groceries, and more. New products are added regularly based on user demand."
    },
    {
      question: "Can I have multiple accounts?",
      answer: "No. Creating multiple accounts is strictly prohibited and will result in permanent ban of all associated accounts. One account per person is allowed."
    },
    {
      question: "How do I contact customer support?",
      answer: "You can reach us via: 1) Email: support@parasreward.com, 2) In-app support ticket system, 3) Contact Us page on website. VIP members get priority support with faster response times."
    },
    {
      question: "What is KYC verification?",
      answer: "KYC (Know Your Customer) verification is mandatory for withdrawals. Upload your Aadhaar card for identity verification. This ensures security and prevents fraud. The process takes 24-48 hours for approval."
    },
    {
      question: "Can I cancel a withdrawal request?",
      answer: "Yes, you can cancel pending withdrawal requests before they are processed by admin. Once processed and marked as 'completed', cancellation is not possible."
    },
    {
      question: "What happens if my withdrawal is rejected?",
      answer: "If your withdrawal request is rejected, the full amount (including fees) is immediately refunded to your wallet. Common rejection reasons include incorrect UPI details or incomplete KYC."
    },
    {
      question: "How does the cashback system work?",
      answer: "When you redeem products using PRC, you get 25% cashback in your Cashback Wallet. For example, redeeming 1000 PRC (₹100 worth) gives you ₹25 cashback. VIP members can withdraw this cashback via UPI."
    },
    {
      question: "What is the minimum withdrawal amount?",
      answer: "The minimum withdrawal amount from Cashback Wallet is ₹10. There's also a ₹5 processing fee per withdrawal. For Profit Wallet (for stockists), minimum is also ₹10."
    },
    {
      question: "Are there any hidden charges?",
      answer: "No hidden charges! All fees are transparent: ₹1000/year for VIP membership (optional), ₹5 withdrawal processing fee, 10% charity deduction on redemptions. Free users can use the platform without any charges."
    }
  ];

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

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
          
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl mb-6 shadow-2xl">
              <HelpCircle className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h1>
            <p className="text-xl text-gray-600">
              Find answers to common questions about PARAS REWARD
            </p>
          </div>

          {/* FAQ List */}
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <Card 
                key={index} 
                className="bg-white shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 hover:bg-purple-50 transition-colors"
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-purple-600 font-bold">{index + 1}</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {faq.question}
                    </h3>
                  </div>
                  {openIndex === index ? (
                    <ChevronUp className="h-5 w-5 text-purple-600 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                
                {openIndex === index && (
                  <div className="px-6 pb-6 pl-18">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Contact CTA */}
          <Card className="mt-12 p-8 bg-gradient-to-br from-purple-600 to-pink-600 text-white text-center">
            <h3 className="text-2xl font-bold mb-3">Still Have Questions?</h3>
            <p className="text-purple-100 mb-6">
              Our support team is here to help you 24/7
            </p>
            <Link to="/contact">
              <Button className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-6 text-lg rounded-xl">
                Contact Support
              </Button>
            </Link>
          </Card>

        </div>
      </div>
    </div>
  );
};

export default FAQ;
