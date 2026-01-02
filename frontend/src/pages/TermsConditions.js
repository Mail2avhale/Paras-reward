import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Shield, AlertTriangle, Scale, Users, Coins, Gift, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_appreward-portal/artifacts/8iqee76c_IMG-20251230-WA0006.jpg";

const TermsConditions = () => {
  const navigate = useNavigate();
  const lastUpdated = "January 1, 2026";

  const sections = [
    {
      id: 'introduction',
      title: '1. Introduction & Acceptance',
      icon: FileText,
      content: `
        <p>Welcome to Paras Reward Platform ("Platform", "we", "us", or "our"). These Terms and Conditions ("Terms") govern your access to and use of our website, mobile application, and all related services (collectively, the "Services").</p>
        <p class="mt-3">By accessing or using the Platform, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use our Services.</p>
        <p class="mt-3">We reserve the right to modify these Terms at any time. Your continued use of the Platform after any changes constitutes acceptance of the modified Terms.</p>
      `
    },
    {
      id: 'definitions',
      title: '2. Definitions',
      icon: Scale,
      content: `
        <ul class="list-disc pl-5 space-y-2">
          <li><strong>"PRC" or "Paras Reward Coins"</strong> - Virtual reward points earned through various activities on the Platform.</li>
          <li><strong>"User" or "Member"</strong> - Any individual who registers and creates an account on the Platform.</li>
          <li><strong>"VIP Member"</strong> - A user who has purchased a premium membership subscription.</li>
          <li><strong>"Mining"</strong> - The process of earning PRC through automated daily activities on the Platform.</li>
          <li><strong>"Referral"</strong> - The process of inviting new users to join the Platform using a unique referral code.</li>
          <li><strong>"Redemption"</strong> - The process of converting earned PRC into gift vouchers, bill payments, or other rewards.</li>
          <li><strong>"KYC"</strong> - Know Your Customer verification process required for certain transactions.</li>
        </ul>
      `
    },
    {
      id: 'eligibility',
      title: '3. Eligibility & Registration',
      icon: Users,
      content: `
        <h4 class="font-semibold mb-2">3.1 Age Requirement</h4>
        <p>You must be at least 18 years of age to register and use the Platform. By registering, you represent and warrant that you are of legal age.</p>
        
        <h4 class="font-semibold mb-2 mt-4">3.2 Registration Requirements</h4>
        <ul class="list-disc pl-5 space-y-1">
          <li>Valid mobile number for OTP verification</li>
          <li>Valid email address</li>
          <li>Accurate personal information</li>
          <li>One account per person/mobile number</li>
        </ul>
        
        <h4 class="font-semibold mb-2 mt-4">3.3 Account Security</h4>
        <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. Notify us immediately of any unauthorized use.</p>
        
        <h4 class="font-semibold mb-2 mt-4">3.4 KYC Verification</h4>
        <p>For redemptions and certain transactions, you must complete KYC verification by submitting valid government-issued identification documents (Aadhaar Card, PAN Card, etc.).</p>
      `
    },
    {
      id: 'prc-earning',
      title: '4. PRC Earning Rules',
      icon: Coins,
      content: `
        <h4 class="font-semibold mb-2">4.1 Mining</h4>
        <ul class="list-disc pl-5 space-y-1">
          <li>Mining rates are determined by the Platform and may change without notice</li>
          <li>VIP members receive enhanced mining rates as per their subscription plan</li>
          <li>Daily mining limits may apply</li>
          <li>Mining requires active participation (login/activity)</li>
        </ul>
        
        <h4 class="font-semibold mb-2 mt-4">4.2 Referral Program</h4>
        <ul class="list-disc pl-5 space-y-1">
          <li>Earn bonus PRC when your referrals join and become active</li>
          <li>Multi-level referral bonuses available (up to 5 levels)</li>
          <li>Referral bonuses are credited only for legitimate, active referrals</li>
          <li>Self-referrals and fake referrals are strictly prohibited</li>
        </ul>
        
        <h4 class="font-semibold mb-2 mt-4">4.3 Promotional Activities</h4>
        <p>Additional PRC may be earned through promotional activities, games (PRC Rain, Scratch Cards, Treasure Hunt), and special offers as announced by the Platform.</p>
        
        <h4 class="font-semibold mb-2 mt-4">4.4 PRC Validity</h4>
        <p>Earned PRC have no expiry date for VIP members. Free users may be subject to PRC burn/reduction policies as determined by the Platform.</p>
      `
    },
    {
      id: 'redemption',
      title: '5. Redemption & Withdrawal',
      icon: Gift,
      content: `
        <h4 class="font-semibold mb-2">5.1 Redemption Options</h4>
        <ul class="list-disc pl-5 space-y-1">
          <li>Gift Vouchers (Amazon, Flipkart, and partner brands)</li>
          <li>Mobile & DTH Recharge</li>
          <li>Bill Payments (Electricity, Gas, Water, etc.)</li>
          <li>Marketplace Products</li>
        </ul>
        
        <h4 class="font-semibold mb-2 mt-4">5.2 Minimum Redemption</h4>
        <p>Minimum PRC balance required for redemption varies by redemption type. Check the app for current minimums.</p>
        
        <h4 class="font-semibold mb-2 mt-4">5.3 Processing Time</h4>
        <ul class="list-disc pl-5 space-y-1">
          <li>Gift Vouchers: 24-48 hours</li>
          <li>Recharges: Instant to 30 minutes</li>
          <li>Bill Payments: 1-3 business days</li>
          <li>Withdrawals: 3-7 business days after approval</li>
        </ul>
        
        <h4 class="font-semibold mb-2 mt-4">5.4 KYC Requirement</h4>
        <p>All withdrawals and high-value redemptions require completed KYC verification.</p>
        
        <h4 class="font-semibold mb-2 mt-4">5.5 Service Charges</h4>
        <p>Certain redemptions may attract service charges. These will be clearly displayed before confirmation.</p>
      `
    },
    {
      id: 'vip',
      title: '6. VIP Membership',
      icon: CreditCard,
      content: `
        <h4 class="font-semibold mb-2">6.1 VIP Plans</h4>
        <p>VIP membership plans are available with various benefits and pricing. Details are available on the VIP Plans page.</p>
        
        <h4 class="font-semibold mb-2 mt-4">6.2 VIP Benefits</h4>
        <ul class="list-disc pl-5 space-y-1">
          <li>Enhanced mining rates (up to 5x)</li>
          <li>Higher referral bonuses</li>
          <li>Priority customer support</li>
          <li>Exclusive offers and promotions</li>
          <li>No PRC burn/expiry</li>
        </ul>
        
        <h4 class="font-semibold mb-2 mt-4">6.3 Payment</h4>
        <p>VIP membership fees are payable through approved payment methods (UPI, Bank Transfer, etc.). Membership activates upon payment verification.</p>
        
        <h4 class="font-semibold mb-2 mt-4">6.4 Renewal</h4>
        <p>VIP memberships are valid for the subscribed period. Renewal is required to continue VIP benefits after expiry.</p>
        
        <h4 class="font-semibold mb-2 mt-4">6.5 Refund Policy</h4>
        <p>VIP membership fees are non-refundable except in cases of technical issues preventing service delivery, at our sole discretion.</p>
      `
    },
    {
      id: 'prohibited',
      title: '7. Prohibited Activities',
      icon: AlertTriangle,
      content: `
        <p>The following activities are strictly prohibited and may result in account suspension or termination:</p>
        <ul class="list-disc pl-5 space-y-2 mt-3">
          <li><strong>Fraudulent Activities:</strong> Creating multiple accounts, using fake identities, or any form of fraud</li>
          <li><strong>Self-Referrals:</strong> Referring yourself or using fake referrals to earn bonuses</li>
          <li><strong>Bot Usage:</strong> Using automated tools, bots, or scripts to manipulate the Platform</li>
          <li><strong>Abuse of Promotions:</strong> Exploiting bugs, loopholes, or promotional offers</li>
          <li><strong>Money Laundering:</strong> Using the Platform for money laundering or illegal transactions</li>
          <li><strong>Spamming:</strong> Sending unsolicited messages or promotions</li>
          <li><strong>Hacking:</strong> Attempting to hack, breach, or compromise Platform security</li>
          <li><strong>Impersonation:</strong> Impersonating others or providing false information</li>
          <li><strong>Resale:</strong> Selling or transferring accounts or PRC to third parties</li>
        </ul>
      `
    },
    {
      id: 'termination',
      title: '8. Account Suspension & Termination',
      icon: Shield,
      content: `
        <h4 class="font-semibold mb-2">8.1 By User</h4>
        <p>You may request account deletion by contacting customer support. Any unredeemed PRC will be forfeited upon account closure.</p>
        
        <h4 class="font-semibold mb-2 mt-4">8.2 By Platform</h4>
        <p>We reserve the right to suspend or terminate accounts for:</p>
        <ul class="list-disc pl-5 space-y-1">
          <li>Violation of these Terms</li>
          <li>Suspected fraudulent activity</li>
          <li>Prolonged inactivity (12+ months)</li>
          <li>Legal or regulatory requirements</li>
        </ul>
        
        <h4 class="font-semibold mb-2 mt-4">8.3 Effect of Termination</h4>
        <p>Upon termination, all PRC balances, pending redemptions, and benefits will be forfeited. VIP membership fees are non-refundable.</p>
      `
    },
    {
      id: 'liability',
      title: '9. Limitation of Liability',
      icon: Scale,
      content: `
        <h4 class="font-semibold mb-2">9.1 Service Availability</h4>
        <p>We strive to maintain continuous service but do not guarantee uninterrupted access. The Platform may be temporarily unavailable for maintenance or upgrades.</p>
        
        <h4 class="font-semibold mb-2 mt-4">9.2 Third-Party Services</h4>
        <p>We are not responsible for third-party services, including payment processors, gift voucher providers, or bill payment services.</p>
        
        <h4 class="font-semibold mb-2 mt-4">9.3 PRC Value</h4>
        <p>PRC are virtual reward points with no monetary value outside the Platform. We reserve the right to modify conversion rates and redemption values.</p>
        
        <h4 class="font-semibold mb-2 mt-4">9.4 Maximum Liability</h4>
        <p>Our maximum liability for any claim shall not exceed the amount paid by you (if any) in the 12 months preceding the claim.</p>
      `
    },
    {
      id: 'governing',
      title: '10. Governing Law & Disputes',
      icon: Scale,
      content: `
        <h4 class="font-semibold mb-2">10.1 Governing Law</h4>
        <p>These Terms shall be governed by and construed in accordance with the laws of India, without regard to conflict of law principles.</p>
        
        <h4 class="font-semibold mb-2 mt-4">10.2 Dispute Resolution</h4>
        <p>Any disputes arising from these Terms or use of the Platform shall be resolved through:</p>
        <ol class="list-decimal pl-5 space-y-1">
          <li>Amicable negotiation (within 30 days)</li>
          <li>Mediation (if negotiation fails)</li>
          <li>Arbitration under the Arbitration and Conciliation Act, 1996</li>
        </ol>
        
        <h4 class="font-semibold mb-2 mt-4">10.3 Jurisdiction</h4>
        <p>The courts of Mumbai, Maharashtra, India shall have exclusive jurisdiction over any legal proceedings.</p>
      `
    },
    {
      id: 'contact',
      title: '11. Contact Information',
      icon: Users,
      content: `
        <p>For questions, concerns, or complaints regarding these Terms, please contact us:</p>
        <div class="mt-3 p-4 bg-gray-50 rounded-lg">
          <p><strong>Paras Reward Platform</strong></p>
          <p class="mt-2">Email: legal@parasreward.com</p>
          <p>Support: support@parasreward.com</p>
          <p>Phone: +91 98765 43210</p>
          <p class="mt-2">Address: Mumbai, Maharashtra, India</p>
        </div>
        <p class="mt-4 text-sm text-gray-500">Response Time: 24-48 business hours</p>
      `
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-900 text-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="text-white hover:bg-white/10 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Terms & Conditions</h1>
              <p className="text-blue-200">Last Updated: {lastUpdated}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Quick Navigation */}
        <Card className="p-6 mb-8">
          <h2 className="font-semibold text-gray-900 mb-4">Quick Navigation</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                {section.title}
              </a>
            ))}
          </div>
        </Card>

        {/* Sections */}
        <div className="space-y-8">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Card key={section.id} id={section.id} className="p-6 scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">{section.title}</h2>
                </div>
                <div 
                  className="prose prose-gray max-w-none text-gray-600"
                  dangerouslySetInnerHTML={{ __html: section.content }}
                />
              </Card>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="mt-12 p-6 bg-blue-50 rounded-lg text-center">
          <p className="text-gray-600">
            By using Paras Reward Platform, you acknowledge that you have read, understood, and agree to these Terms & Conditions.
          </p>
          <Button 
            onClick={() => navigate('/signup')}
            className="mt-4 bg-blue-600 hover:bg-blue-700"
          >
            I Accept - Create Account
          </Button>
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="bg-gray-900 text-gray-400 py-6 px-4 mt-12">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <img src={LOGO_URL} alt="Logo" className="h-8 w-8 rounded-full" />
            <span className="text-white font-semibold">Paras Reward</span>
          </div>
          <div className="flex gap-6 text-sm">
            <a href="/privacy" className="hover:text-white">Privacy Policy</a>
            <a href="/refund" className="hover:text-white">Refund Policy</a>
            <a href="/contact" className="hover:text-white">Contact Us</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TermsConditions;
