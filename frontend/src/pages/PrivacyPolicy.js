import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Eye, Lock, Database, Bell, Users, Globe, FileText, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_appreward-portal/artifacts/8iqee76c_IMG-20251230-WA0006.jpg";

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const lastUpdated = "January 1, 2026";

  const sections = [
    {
      id: 'introduction',
      title: '1. Introduction',
      icon: Shield,
      content: `
        <p>Paras Reward Platform ("we", "us", "our", or "Platform") is committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and mobile application.</p>
        <p class="mt-3">This policy complies with the Information Technology Act, 2000 and its rules, including the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011.</p>
        <p class="mt-3">By using our Platform, you consent to the collection and use of information in accordance with this policy.</p>
      `
    },
    {
      id: 'collection',
      title: '2. Information We Collect',
      icon: Database,
      content: `
        <h4 class="font-semibold mb-2">2.1 Personal Information</h4>
        <p>We collect the following personal information when you register or use our services:</p>
        <ul class="list-disc pl-5 space-y-1 mt-2">
          <li><strong>Identity Information:</strong> Full name, date of birth, gender</li>
          <li><strong>Contact Information:</strong> Mobile number, email address, postal address</li>
          <li><strong>KYC Documents:</strong> Aadhaar Card, PAN Card, Voter ID (for verification)</li>
          <li><strong>Financial Information:</strong> Bank account details, UPI ID (for withdrawals)</li>
          <li><strong>Profile Information:</strong> Profile photo, username, referral code</li>
        </ul>
        
        <h4 class="font-semibold mb-2 mt-4">2.2 Automatically Collected Information</h4>
        <ul class="list-disc pl-5 space-y-1">
          <li><strong>Device Information:</strong> Device type, operating system, unique device identifiers</li>
          <li><strong>Usage Data:</strong> Pages visited, features used, time spent, click patterns</li>
          <li><strong>Location Data:</strong> IP address, approximate geographic location</li>
          <li><strong>Log Data:</strong> Access times, error logs, referring URLs</li>
        </ul>
        
        <h4 class="font-semibold mb-2 mt-4">2.3 Cookies and Tracking Technologies</h4>
        <p>We use cookies, web beacons, and similar technologies to enhance user experience, analyze usage patterns, and deliver personalized content.</p>
      `
    },
    {
      id: 'usage',
      title: '3. How We Use Your Information',
      icon: Eye,
      content: `
        <p>We use your information for the following purposes:</p>
        
        <h4 class="font-semibold mb-2 mt-3">3.1 Service Delivery</h4>
        <ul class="list-disc pl-5 space-y-1">
          <li>Create and manage your account</li>
          <li>Process PRC mining, referrals, and redemptions</li>
          <li>Verify identity through KYC process</li>
          <li>Process payments and withdrawals</li>
          <li>Deliver gift vouchers and bill payments</li>
        </ul>
        
        <h4 class="font-semibold mb-2 mt-4">3.2 Communication</h4>
        <ul class="list-disc pl-5 space-y-1">
          <li>Send transaction confirmations and updates</li>
          <li>Notify about account activity and security alerts</li>
          <li>Provide customer support</li>
          <li>Send promotional offers and newsletters (with consent)</li>
        </ul>
        
        <h4 class="font-semibold mb-2 mt-4">3.3 Platform Improvement</h4>
        <ul class="list-disc pl-5 space-y-1">
          <li>Analyze usage patterns to improve features</li>
          <li>Personalize user experience</li>
          <li>Develop new products and services</li>
          <li>Conduct research and analytics</li>
        </ul>
        
        <h4 class="font-semibold mb-2 mt-4">3.4 Security & Compliance</h4>
        <ul class="list-disc pl-5 space-y-1">
          <li>Detect and prevent fraud</li>
          <li>Enforce our Terms & Conditions</li>
          <li>Comply with legal obligations</li>
          <li>Respond to legal requests</li>
        </ul>
      `
    },
    {
      id: 'sharing',
      title: '4. Information Sharing & Disclosure',
      icon: Users,
      content: `
        <p>We do not sell your personal information. We may share your information only in the following circumstances:</p>
        
        <h4 class="font-semibold mb-2 mt-3">4.1 Service Providers</h4>
        <p>We share information with trusted third-party service providers who assist us in:</p>
        <ul class="list-disc pl-5 space-y-1">
          <li>Payment processing (payment gateways, banks)</li>
          <li>KYC verification services</li>
          <li>Gift voucher fulfillment partners</li>
          <li>Bill payment service providers</li>
          <li>Cloud hosting and storage</li>
          <li>Analytics and marketing services</li>
        </ul>
        
        <h4 class="font-semibold mb-2 mt-4">4.2 Legal Requirements</h4>
        <p>We may disclose information when required by law, court order, or government authority.</p>
        
        <h4 class="font-semibold mb-2 mt-4">4.3 Business Transfers</h4>
        <p>In the event of a merger, acquisition, or sale of assets, your information may be transferred to the successor entity.</p>
      `
    },
    {
      id: 'security',
      title: '5. Data Security',
      icon: Lock,
      content: `
        <p>We implement robust security measures to protect your personal information:</p>
        <ul class="list-disc pl-5 space-y-2 mt-3">
          <li><strong>Encryption:</strong> SSL/TLS encryption for data in transit, AES-256 for data at rest</li>
          <li><strong>Access Controls:</strong> Role-based access and multi-factor authentication</li>
          <li><strong>Monitoring:</strong> 24/7 security monitoring and intrusion detection</li>
          <li><strong>Regular Audits:</strong> Security assessments and vulnerability testing</li>
          <li><strong>Employee Training:</strong> Data protection training for all staff</li>
        </ul>
      `
    },
    {
      id: 'retention',
      title: '6. Data Retention',
      icon: Database,
      content: `
        <p>We retain your personal information for as long as necessary to provide services and comply with legal obligations:</p>
        <ul class="list-disc pl-5 space-y-1 mt-3">
          <li>Account data: Duration of account + 3 years</li>
          <li>Transaction records: 7-10 years (legal requirement)</li>
          <li>KYC documents: As per regulatory requirements</li>
          <li>Marketing preferences: Until you opt-out</li>
        </ul>
        <p class="mt-3">Upon account deletion, active data is removed within 30 days. Backups may persist for up to 90 days.</p>
      `
    },
    {
      id: 'rights',
      title: '7. Your Rights',
      icon: Settings,
      content: `
        <p>You have the following rights regarding your personal information:</p>
        <ul class="list-disc pl-5 space-y-2 mt-3">
          <li><strong>Access:</strong> Request a copy of your personal data</li>
          <li><strong>Correction:</strong> Update inaccurate information</li>
          <li><strong>Deletion:</strong> Request account and data deletion</li>
          <li><strong>Portability:</strong> Receive data in machine-readable format</li>
          <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
          <li><strong>Withdraw Consent:</strong> Revoke consent for data processing</li>
        </ul>
        <p class="mt-3">To exercise your rights, contact us at privacy@parasreward.com. We will respond within 30 days.</p>
      `
    },
    {
      id: 'cookies',
      title: '8. Cookies Policy',
      icon: Globe,
      content: `
        <p>We use cookies to enhance your experience:</p>
        <ul class="list-disc pl-5 space-y-2 mt-3">
          <li><strong>Essential:</strong> Required for basic functionality</li>
          <li><strong>Functional:</strong> Remember your preferences</li>
          <li><strong>Analytics:</strong> Understand usage patterns</li>
          <li><strong>Marketing:</strong> Personalized advertisements (with consent)</li>
        </ul>
        <p class="mt-3">You can manage cookies through your browser settings.</p>
      `
    },
    {
      id: 'children',
      title: '9. Children\'s Privacy',
      icon: Users,
      content: `
        <p>Our Platform is not intended for individuals under 18 years of age. We do not knowingly collect personal information from children.</p>
        <p class="mt-3">If we discover that a child under 18 has provided us with personal information, we will promptly delete such information.</p>
      `
    },
    {
      id: 'contact',
      title: '10. Contact Us',
      icon: Bell,
      content: `
        <p>For privacy-related questions or requests:</p>
        <div class="mt-4 p-4 bg-gray-50 rounded-lg">
          <p><strong>Grievance Officer</strong></p>
          <p class="mt-2">Email: privacy@parasreward.com</p>
          <p>Phone: +91 98765 43210</p>
          <p class="mt-2">Address: Mumbai, Maharashtra, India</p>
        </div>
        <p class="mt-4">Response Time: Within 30 days of receipt.</p>
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
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Privacy Policy</h1>
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
              <a key={section.id} href={`#${section.id}`} className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
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
                <div className="prose prose-gray max-w-none text-gray-600" dangerouslySetInnerHTML={{ __html: section.content }} />
              </Card>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="mt-12 p-6 bg-green-50 rounded-lg">
          <div className="flex items-start gap-4">
            <Lock className="h-6 w-6 text-green-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-green-900">Your Privacy Matters</h3>
              <p className="text-green-700 mt-1">We are committed to protecting your personal information. Contact us with any questions.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-6 px-4 mt-12">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <img src={LOGO_URL} alt="Logo" className="h-8 w-8 rounded-full" />
            <span className="text-white font-semibold">Paras Reward</span>
          </div>
          <div className="flex gap-6 text-sm">
            <a href="/terms" className="hover:text-white">Terms & Conditions</a>
            <a href="/refund" className="hover:text-white">Refund Policy</a>
            <a href="/contact" className="hover:text-white">Contact Us</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
