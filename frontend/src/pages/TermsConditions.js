import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  FileText, Scale, Shield, AlertTriangle, CheckCircle, 
  ArrowLeft, Building2, Mail, Phone, UserX, Ban,
  Globe, Lock, Eye, CreditCard, RefreshCw, Gavel,
  Smartphone, Bell, Clock, MapPin, XCircle, Award
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TermsConditions = () => {
  const navigate = useNavigate();
  const [companyInfo, setCompanyInfo] = useState({
    company_name: 'Paras Reward Technologies Private Limited',
    email: 'Info@parasreward.com',
    address: 'India'
  });
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    const fetchCompanyInfo = async () => {
      try {
        const response = await axios.get(`${API}/public/contact-info`);
        if (response.data) {
          setCompanyInfo(response.data);
        }
      } catch (error) {
        console.error('Error fetching company info:', error);
      }
    };
    fetchCompanyInfo();

    const handleScroll = () => {
      const sections = document.querySelectorAll('[data-section]');
      sections.forEach(section => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= 100 && rect.bottom >= 100) {
          setActiveSection(section.getAttribute('data-section'));
        }
      });
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const lastUpdated = 'February 23, 2026';

  const sections = [
    { id: 'acceptance', title: 'Acceptance of Terms', icon: CheckCircle },
    { id: 'eligibility', title: 'Eligibility', icon: UserX },
    { id: 'account', title: 'Account Registration', icon: Shield },
    { id: 'prc-system', title: 'PRC Points System', icon: Award },
    { id: 'redemption', title: 'Redemption & Payments', icon: CreditCard },
    { id: 'advertising', title: 'Advertising & Rewards', icon: Smartphone },
    { id: 'prohibited', title: 'Prohibited Activities', icon: Ban },
    { id: 'intellectual', title: 'Intellectual Property', icon: FileText },
    { id: 'disclaimer', title: 'Disclaimers', icon: AlertTriangle },
    { id: 'limitation', title: 'Limitation of Liability', icon: Scale },
    { id: 'termination', title: 'Termination', icon: XCircle },
    { id: 'governing', title: 'Governing Law', icon: Gavel },
    { id: 'changes', title: 'Changes to Terms', icon: RefreshCw },
    { id: 'contact', title: 'Contact Us', icon: Mail },
  ];

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 border-b border-gray-800">
        <div className="container mx-auto px-4 py-8">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Terms & Conditions</h1>
              <p className="text-gray-400 mt-1">Last updated: {lastUpdated}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:w-72 flex-shrink-0">
            <div className="sticky top-4 bg-gray-900/50 rounded-2xl border border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Contents</h3>
              <nav className="space-y-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
                      activeSection === section.id 
                        ? 'bg-blue-500/20 text-blue-400 border-l-2 border-blue-500' 
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <section.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">{section.title}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 max-w-4xl">
            <div className="bg-gray-900/30 rounded-2xl border border-gray-800 p-6 lg:p-8">
              
              {/* Acceptance */}
              <section id="acceptance" data-section="acceptance" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">1. Acceptance of Terms</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <p>
                    Welcome to <strong>{companyInfo.company_name}</strong>. By accessing or using our mobile application, website, and services (collectively, the "Service"), you agree to be bound by these Terms and Conditions ("Terms").
                  </p>
                  <p>
                    Please read these Terms carefully before using our Service. If you do not agree to these Terms, you may not access or use the Service.
                  </p>
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mt-4">
                    <p className="text-blue-400 text-sm">
                      <strong>By clicking "I Agree," registering an account, or using the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy.</strong>
                    </p>
                  </div>
                </div>
              </section>

              {/* Eligibility */}
              <section id="eligibility" data-section="eligibility" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                    <UserX className="h-5 w-5 text-purple-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">2. Eligibility</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <p>To use our Service, you must meet the following requirements:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Age Requirement:</strong> You must be at least <strong>18 years old</strong> to use our Service</li>
                    <li><strong>Legal Capacity:</strong> You must have the legal capacity to enter into a binding agreement</li>
                    <li><strong>Residency:</strong> You must be a resident of India</li>
                    <li><strong>Valid Information:</strong> You must provide accurate and truthful information during registration</li>
                    <li><strong>Not Previously Banned:</strong> You must not have been previously banned or suspended from the Service</li>
                  </ul>
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mt-4">
                    <p className="text-red-400 text-sm">
                      <strong>Warning:</strong> Users under 18 years of age are strictly prohibited from using this Service. Any account found to be registered by a minor will be immediately terminated.
                    </p>
                  </div>
                </div>
              </section>

              {/* Account Registration */}
              <section id="account" data-section="account" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                    <Shield className="h-5 w-5 text-cyan-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">3. Account Registration & Security</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <h3 className="text-lg font-semibold text-white mt-6">3.1 Registration Requirements</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>You must provide a valid mobile number and email address</li>
                    <li>You must verify your mobile number through OTP</li>
                    <li>You must complete KYC (Know Your Customer) verification for financial services</li>
                    <li>One person may only maintain ONE account</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-white mt-6">3.2 Account Security</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                    <li>You must use a strong password and not share it with anyone</li>
                    <li>You must immediately notify us of any unauthorized access</li>
                    <li>You are responsible for all activities that occur under your account</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-white mt-6">3.3 Account Information</h3>
                  <p>You agree to provide accurate, current, and complete information. We reserve the right to suspend or terminate accounts with false information.</p>
                </div>
              </section>

              {/* PRC Points System */}
              <section id="prc-system" data-section="prc-system" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                    <Award className="h-5 w-5 text-amber-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">4. PRC Points System</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <h3 className="text-lg font-semibold text-white mt-6">4.1 Nature of PRC Points</h3>
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                    <p className="text-yellow-400 text-sm">
                      <strong>Important:</strong> PRC (PARAS REWARD CURRENCY) points are <strong>NOT</strong> real currency, cryptocurrency, or legal tender. They are virtual reward points with no cash value outside our platform.
                    </p>
                  </div>

                  <h3 className="text-lg font-semibold text-white mt-6">4.2 Earning PRC Points</h3>
                  <p>Users can earn PRC points through:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Daily check-in/mining (for VIP members)</li>
                    <li>Referral bonuses</li>
                    <li>Promotional activities</li>
                    <li>Other activities as specified by the platform</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-white mt-6">4.3 PRC Point Rules</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>PRC points cannot be transferred between users</li>
                    <li>PRC points cannot be purchased with real money</li>
                    <li>PRC points have no cash value and cannot be converted to cash directly</li>
                    <li>Unused PRC points may expire as per our expiry policy</li>
                    <li>We reserve the right to modify earning rates at any time</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-white mt-6">4.4 Point Expiry</h3>
                  <p>PRC points may expire if:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Your account is inactive for more than 12 months</li>
                    <li>Your subscription/membership expires and is not renewed</li>
                    <li>As specified in promotional terms</li>
                  </ul>
                </div>
              </section>

              {/* Redemption & Payments */}
              <section id="redemption" data-section="redemption" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">5. Redemption & Payments</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <h3 className="text-lg font-semibold text-white mt-6">5.1 Redemption Eligibility</h3>
                  <p>To redeem PRC points, you must:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Have an active VIP membership</li>
                    <li>Complete KYC verification</li>
                    <li>Have a minimum redeemable balance</li>
                    <li>Not have any pending violations</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-white mt-6">5.2 Redemption Options</h3>
                  <p>PRC points can be redeemed for:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Bill payments (mobile recharge, electricity, DTH, etc.)</li>
                    <li>Gift vouchers from partner merchants</li>
                    <li>Other services as available on the platform</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-white mt-6">5.3 Processing & Fees</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Redemption requests are subject to processing time (typically 24-72 hours)</li>
                    <li>Processing fees and admin charges may apply</li>
                    <li>All fees will be clearly displayed before confirmation</li>
                    <li>Redemptions are subject to daily/monthly limits</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-white mt-6">5.4 Refunds</h3>
                  <p>Once a redemption is processed:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>PRC points used are non-refundable</li>
                    <li>Failed transactions due to incorrect details are not eligible for refund</li>
                    <li>Technical failures may be credited back at our discretion</li>
                  </ul>
                </div>
              </section>

              {/* Prohibited Activities */}
              <section id="prohibited" data-section="prohibited" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                    <Ban className="h-5 w-5 text-red-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">6. Prohibited Activities</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <p>You agree NOT to engage in any of the following prohibited activities:</p>
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mt-4">
                    <ul className="list-disc list-inside space-y-2 ml-4 text-red-300">
                      <li>Creating multiple accounts</li>
                      <li>Using automated bots, scripts, or any cheating methods</li>
                      <li>Providing false identity or fraudulent documents</li>
                      <li>Manipulating or exploiting platform bugs/glitches</li>
                      <li>Impersonating another person or entity</li>
                      <li>Engaging in any illegal activities</li>
                      <li>Attempting to hack or compromise the platform</li>
                      <li>Abusing referral systems with fake accounts</li>
                      <li>Transferring, selling, or trading accounts</li>
                      <li>Harassing or threatening other users or staff</li>
                      <li>Violating any applicable laws or regulations</li>
                    </ul>
                  </div>
                  <p className="mt-4">
                    <strong>Consequences:</strong> Violation of these rules may result in immediate account suspension, forfeiture of all PRC points, and permanent ban from the platform.
                  </p>
                </div>
              </section>

              {/* Intellectual Property */}
              <section id="intellectual" data-section="intellectual" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                    <FileText className="h-5 w-5 text-indigo-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">7. Intellectual Property</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <p>
                    All content, features, and functionality of the Service—including but not limited to text, graphics, logos, icons, images, audio clips, digital downloads, and software—are the exclusive property of {companyInfo.company_name} or its licensors and are protected by Indian and international copyright, trademark, and other intellectual property laws.
                  </p>
                  <p>
                    You are granted a limited, non-exclusive, non-transferable license to access and use the Service for personal, non-commercial purposes only.
                  </p>
                  <p>
                    You may NOT:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Copy, modify, or distribute any content</li>
                    <li>Reverse engineer or decompile the software</li>
                    <li>Use our trademarks without prior written consent</li>
                    <li>Create derivative works based on our content</li>
                  </ul>
                </div>
              </section>

              {/* Disclaimers */}
              <section id="disclaimer" data-section="disclaimer" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">8. Disclaimers</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                    <p className="text-yellow-400 font-semibold mb-2">WARRANTY DISCLAIMER</p>
                    <p className="text-yellow-300 text-sm">
                      THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
                    </p>
                  </div>

                  <p className="mt-4">We do not warrant that:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>The Service will be uninterrupted, error-free, or secure</li>
                    <li>Any defects will be corrected</li>
                    <li>The results obtained will be accurate or reliable</li>
                    <li>Third-party services will function as expected</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-white mt-6">Financial Disclaimer</h3>
                  <p>
                    {companyInfo.company_name} is NOT a financial institution. PRC points are not investments and do not represent any financial product. We do not provide investment advice. Any redemption or transaction is at your own risk.
                  </p>
                </div>
              </section>

              {/* Limitation of Liability */}
              <section id="limitation" data-section="limitation" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                    <Scale className="h-5 w-5 text-orange-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">9. Limitation of Liability</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                    <p className="text-orange-400 text-sm">
                      TO THE MAXIMUM EXTENT PERMITTED BY LAW, {companyInfo.company_name?.toUpperCase()} SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, OR OTHER INTANGIBLE LOSSES, ARISING FROM YOUR USE OF THE SERVICE.
                    </p>
                  </div>

                  <p className="mt-4">Our total liability shall not exceed:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>The amount you paid for the Service in the past 12 months, OR</li>
                    <li>₹10,000 (Rupees Ten Thousand), whichever is lower</li>
                  </ul>
                </div>
              </section>

              {/* Termination */}
              <section id="termination" data-section="termination" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-pink-500/20 rounded-xl flex items-center justify-center">
                    <XCircle className="h-5 w-5 text-pink-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">10. Termination</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <h3 className="text-lg font-semibold text-white mt-6">10.1 Termination by You</h3>
                  <p>You may terminate your account at any time by contacting support. Upon termination, all unused PRC points will be forfeited.</p>

                  <h3 className="text-lg font-semibold text-white mt-6">10.2 Termination by Us</h3>
                  <p>We may suspend or terminate your account immediately, without prior notice, if you:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Violate these Terms or any applicable laws</li>
                    <li>Engage in fraudulent or abusive behavior</li>
                    <li>Provide false information</li>
                    <li>Fail to pay any fees owed</li>
                    <li>At our sole discretion, for any reason</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-white mt-6">10.3 Effects of Termination</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>All rights and licenses granted to you will terminate</li>
                    <li>All PRC points will be forfeited</li>
                    <li>Pending redemptions may be cancelled</li>
                    <li>You must cease all use of the Service</li>
                  </ul>
                </div>
              </section>

              {/* Governing Law */}
              <section id="governing" data-section="governing" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center">
                    <Gavel className="h-5 w-5 text-violet-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">11. Governing Law & Dispute Resolution</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <p>
                    These Terms shall be governed by and construed in accordance with the laws of <strong>India</strong>, without regard to its conflict of law provisions.
                  </p>
                  <p>
                    <strong>Jurisdiction:</strong> Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts in <strong>Maharashtra, India</strong>.
                  </p>
                  <p>
                    <strong>Arbitration:</strong> Before initiating legal proceedings, parties agree to attempt resolution through good-faith negotiation for at least 30 days.
                  </p>
                </div>
              </section>

              {/* Changes to Terms */}
              <section id="changes" data-section="changes" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-teal-500/20 rounded-xl flex items-center justify-center">
                    <RefreshCw className="h-5 w-5 text-teal-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">12. Changes to Terms</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <p>
                    We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting. We will notify you of material changes through:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Email notification</li>
                    <li>In-app notification</li>
                    <li>Prominent notice on our website</li>
                  </ul>
                  <p className="mt-4">
                    Your continued use of the Service after changes constitutes acceptance of the modified Terms.
                  </p>
                </div>
              </section>

              {/* Contact */}
              <section id="contact" data-section="contact" className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                    <Mail className="h-5 w-5 text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">13. Contact Us</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <p>If you have any questions about these Terms, please contact us:</p>
                  <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 mt-4">
                    <h3 className="text-xl font-bold text-white mb-4">{companyInfo.company_name}</h3>
                    <div className="space-y-3">
                      {companyInfo.address && (
                        <p className="flex items-start gap-3">
                          <MapPin className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                          <span>{companyInfo.address}</span>
                        </p>
                      )}
                      {companyInfo.email && (
                        <p className="flex items-center gap-3">
                          <Mail className="h-5 w-5 text-gray-400" />
                          <a href={`mailto:${companyInfo.email}`} className="text-blue-400 hover:underline">{companyInfo.email}</a>
                        </p>
                      )}
                      {companyInfo.phone && (
                        <p className="flex items-center gap-3">
                          <Phone className="h-5 w-5 text-gray-400" />
                          <a href={`tel:${companyInfo.phone}`} className="text-blue-400 hover:underline">{companyInfo.phone}</a>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Footer */}
              <div className="mt-12 pt-8 border-t border-gray-800">
                <p className="text-gray-500 text-sm text-center">
                  © {new Date().getFullYear()} {companyInfo.company_name}. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsConditions;
