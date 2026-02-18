import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Shield, FileText, Scale, AlertTriangle, CheckCircle, 
  ChevronRight, ArrowLeft, Building2, Mail, Phone,
  Globe, Lock, Eye, UserCheck, CreditCard, RefreshCw,
  Smartphone, Bell, Database, Trash2, Clock, MapPin
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PrivacyPolicy = () => {
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

    // Track scroll position for active section
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

  const lastUpdated = 'February 7, 2026';

  const sections = [
    { id: 'introduction', title: 'Introduction', icon: FileText },
    { id: 'info-collect', title: 'Information We Collect', icon: Database },
    { id: 'info-use', title: 'How We Use Information', icon: Eye },
    { id: 'info-share', title: 'Information Sharing', icon: UserCheck },
    { id: 'data-security', title: 'Data Security', icon: Lock },
    { id: 'cookies', title: 'Cookies & Tracking', icon: Globe },
    { id: 'third-party', title: 'Third-Party Services', icon: Building2 },
    { id: 'advertising', title: 'Advertising (AdMob/AdSense)', icon: Smartphone },
    { id: 'children', title: "Children's Privacy", icon: Shield },
    { id: 'your-rights', title: 'Your Rights', icon: Scale },
    { id: 'data-retention', title: 'Data Retention', icon: Clock },
    { id: 'changes', title: 'Policy Changes', icon: RefreshCw },
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
      <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-b border-gray-800">
        <div className="container mx-auto px-4 py-8">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/25">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
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
                        ? 'bg-purple-500/20 text-purple-400 border-l-2 border-purple-500' 
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
              
              {/* Introduction */}
              <section id="introduction" data-section="introduction" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                    <FileText className="h-5 w-5 text-purple-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">1. Introduction</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <p>
                    Welcome to <strong>{companyInfo.company_name}</strong> ("we," "our," or "us"). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and website (collectively, the "Service").
                  </p>
                  <p>
                    By accessing or using our Service, you acknowledge that you have read, understood, and agree to be bound by this Privacy Policy. If you do not agree with our policies and practices, please do not use our Service.
                  </p>
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mt-4">
                    <p className="text-blue-400 text-sm">
                      <strong>Important:</strong> This policy complies with Google Play Store requirements, Google AdMob policies, Google AdSense policies, and applicable Indian data protection laws including the Information Technology Act, 2000 and IT Rules, 2011.
                    </p>
                  </div>
                </div>
              </section>

              {/* Information We Collect */}
              <section id="info-collect" data-section="info-collect" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                    <Database className="h-5 w-5 text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">2. Information We Collect</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <h3 className="text-lg font-semibold text-white mt-6">2.1 Personal Information</h3>
                  <p>We may collect the following personal information when you register or use our Service:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Identity Information:</strong> Full name, date of birth, gender</li>
                    <li><strong>Contact Information:</strong> Email address, mobile phone number, postal address</li>
                    <li><strong>Account Credentials:</strong> Username, password (encrypted)</li>
                    <li><strong>Verification Documents:</strong> PAN card, Aadhaar card (for KYC verification)</li>
                    <li><strong>Financial Information:</strong> Bank account details, UPI ID (for redemptions)</li>
                    <li><strong>Profile Information:</strong> Profile photo, preferences</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-white mt-6">2.2 Automatically Collected Information</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Device Information:</strong> Device type, operating system, unique device identifiers, mobile network information</li>
                    <li><strong>Log Data:</strong> Access times, pages viewed, IP address, referring URL</li>
                    <li><strong>Location Data:</strong> General location based on IP address (we do not collect precise GPS location)</li>
                    <li><strong>Usage Data:</strong> Features used, time spent, interaction patterns</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-white mt-6">2.3 Information from Third Parties</h3>
                  <p>We may receive information from:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Payment processors (transaction confirmations)</li>
                    <li>Analytics providers (aggregated usage data)</li>
                    <li>Advertising partners (ad interaction data)</li>
                  </ul>
                </div>
              </section>

              {/* How We Use Information */}
              <section id="info-use" data-section="info-use" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <Eye className="h-5 w-5 text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">3. How We Use Your Information</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <p>We use collected information for the following purposes:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {[
                      { title: 'Service Delivery', desc: 'To provide, maintain, and improve our Service' },
                      { title: 'Account Management', desc: 'To create, verify, and manage your account' },
                      { title: 'Transactions', desc: 'To process rewards, redemptions, and payments' },
                      { title: 'Communication', desc: 'To send notifications, updates, and support messages' },
                      { title: 'Personalization', desc: 'To customize content and recommendations' },
                      { title: 'Security', desc: 'To detect and prevent fraud, abuse, and security threats' },
                      { title: 'Analytics', desc: 'To understand usage patterns and improve features' },
                      { title: 'Legal Compliance', desc: 'To comply with applicable laws and regulations' },
                    ].map((item, idx) => (
                      <div key={idx} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                        <h4 className="font-semibold text-white mb-1">{item.title}</h4>
                        <p className="text-sm text-gray-400">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Information Sharing */}
              <section id="info-share" data-section="info-share" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                    <UserCheck className="h-5 w-5 text-yellow-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">4. Information Sharing & Disclosure</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <p>We do <strong>NOT</strong> sell, trade, or rent your personal information. We may share information only in these circumstances:</p>
                  
                  <h3 className="text-lg font-semibold text-white mt-6">4.1 Service Providers</h3>
                  <p>We share data with trusted third-party service providers who assist in:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Payment processing (banks, payment gateways)</li>
                    <li>Cloud hosting and data storage</li>
                    <li>Analytics and performance monitoring</li>
                    <li>Customer support services</li>
                    <li>KYC verification services</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-white mt-6">4.2 Legal Requirements</h3>
                  <p>We may disclose information when required by law, court order, or government authorities, or to protect our rights, safety, and property.</p>

                  <h3 className="text-lg font-semibold text-white mt-6">4.3 Business Transfers</h3>
                  <p>In the event of merger, acquisition, or sale of assets, user information may be transferred to the acquiring entity.</p>

                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mt-4">
                    <p className="text-green-400 text-sm flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      <strong>Your data is never sold to advertisers or third-party marketers.</strong>
                    </p>
                  </div>
                </div>
              </section>

              {/* Data Security */}
              <section id="data-security" data-section="data-security" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                    <Lock className="h-5 w-5 text-red-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">5. Data Security</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <p>We implement industry-standard security measures to protect your information:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Encryption:</strong> All data transmitted using SSL/TLS encryption (HTTPS)</li>
                    <li><strong>Password Security:</strong> Passwords are hashed using bcrypt algorithm</li>
                    <li><strong>Access Controls:</strong> Strict access controls and authentication</li>
                    <li><strong>Regular Audits:</strong> Periodic security assessments and vulnerability testing</li>
                    <li><strong>Secure Infrastructure:</strong> Cloud-hosted on secure, certified data centers</li>
                  </ul>
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mt-4">
                    <p className="text-yellow-400 text-sm">
                      <strong>Note:</strong> While we strive to protect your data, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security.
                    </p>
                  </div>
                </div>
              </section>

              {/* Cookies & Tracking */}
              <section id="cookies" data-section="cookies" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                    <Globe className="h-5 w-5 text-cyan-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">6. Cookies & Tracking Technologies</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <p>We use cookies and similar tracking technologies to enhance your experience:</p>
                  
                  <h3 className="text-lg font-semibold text-white mt-6">Types of Cookies We Use:</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Essential Cookies:</strong> Required for basic site functionality (login, security)</li>
                    <li><strong>Analytics Cookies:</strong> Help us understand how users interact with our Service</li>
                    <li><strong>Advertising Cookies:</strong> Used by advertising partners to serve relevant ads</li>
                    <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-white mt-6">Managing Cookies:</h3>
                  <p>You can control cookies through your browser settings. Disabling cookies may affect Service functionality.</p>
                </div>
              </section>

              {/* Third-Party Services */}
              <section id="third-party" data-section="third-party" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-indigo-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">7. Third-Party Services</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <p>Our Service integrates with the following third-party services:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Google Analytics:</strong> For usage analytics and insights</li>
                    <li><strong>Google Firebase:</strong> For app performance monitoring</li>
                    <li><strong>Payment Gateways:</strong> For processing financial transactions</li>
                    <li><strong>Cloud Services:</strong> For data storage and hosting</li>
                  </ul>
                  <p className="mt-4">Each third-party service has its own privacy policy. We encourage you to review their policies.</p>
                </div>
              </section>

              {/* Advertising (AdMob/AdSense) - Critical for Play Store */}
              <section id="advertising" data-section="advertising" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                    <Smartphone className="h-5 w-5 text-orange-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">8. Advertising (Google AdMob & AdSense)</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <p>Our Service displays advertisements through Google AdMob (mobile app) and Google AdSense (website). These advertising services may collect and use certain information about you.</p>
                  
                  <h3 className="text-lg font-semibold text-white mt-6">8.1 Information Collected by Advertisers</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Device identifiers (Advertising ID, IDFA)</li>
                    <li>IP address and general location</li>
                    <li>Browser type and operating system</li>
                    <li>Ad interaction data (views, clicks)</li>
                    <li>App usage information</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-white mt-6">8.2 Personalized Advertising</h3>
                  <p>Google may use this information to show you personalized ads based on your interests. You can control ad personalization:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Android:</strong> Settings → Google → Ads → Opt out of Ads Personalization</li>
                    <li><strong>iOS:</strong> Settings → Privacy → Tracking → Disable "Allow Apps to Request to Track"</li>
                    <li><strong>Web:</strong> Visit <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="text-purple-400 underline">Google Ad Settings</a></li>
                  </ul>

                  <h3 className="text-lg font-semibold text-white mt-6">8.3 Google's Privacy Policies</h3>
                  <p>For more information about how Google uses data:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-purple-400 underline">Google Privacy Policy</a></li>
                    <li><a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" className="text-purple-400 underline">How Google Uses Information from Sites/Apps</a></li>
                  </ul>

                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mt-4">
                    <p className="text-orange-400 text-sm">
                      <strong>AdMob/AdSense Compliance:</strong> We comply with Google's advertising policies. We do not collect personal information to serve ads to children under 13. Users can opt-out of personalized advertising at any time.
                    </p>
                  </div>
                </div>
              </section>

              {/* Children's Privacy - Critical for Play Store */}
              <section id="children" data-section="children" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-pink-500/20 rounded-xl flex items-center justify-center">
                    <Shield className="h-5 w-5 text-pink-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">9. Children's Privacy</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                    <p className="text-red-400 font-semibold mb-2">Important Notice</p>
                    <p className="text-red-300">
                      Our Service is <strong>NOT</strong> intended for children under 18 years of age. We do not knowingly collect personal information from children under 18.
                    </p>
                  </div>
                  <p className="mt-4">
                    If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately at <strong>{companyInfo.email}</strong>. We will take steps to delete such information from our systems.
                  </p>
                  <p>
                    Users must be at least 18 years old to register an account and use our financial services (rewards redemption, bill payments, etc.).
                  </p>
                </div>
              </section>

              {/* Your Rights */}
              <section id="your-rights" data-section="your-rights" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                    <Scale className="h-5 w-5 text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">10. Your Rights</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <p>You have the following rights regarding your personal information:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {[
                      { title: 'Right to Access', desc: 'Request a copy of your personal data' },
                      { title: 'Right to Correction', desc: 'Request correction of inaccurate data' },
                      { title: 'Right to Deletion', desc: 'Request deletion of your account and data' },
                      { title: 'Right to Portability', desc: 'Request your data in a portable format' },
                      { title: 'Right to Withdraw Consent', desc: 'Withdraw consent for data processing' },
                      { title: 'Right to Complaint', desc: 'Lodge a complaint with data protection authorities' },
                    ].map((item, idx) => (
                      <div key={idx} className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/30">
                        <h4 className="font-semibold text-emerald-400 mb-1">{item.title}</h4>
                        <p className="text-sm text-gray-400">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4">
                    To exercise any of these rights, please contact us at <strong>{companyInfo.email}</strong>. We will respond within 30 days.
                  </p>
                </div>
              </section>

              {/* Data Retention */}
              <section id="data-retention" data-section="data-retention" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center">
                    <Clock className="h-5 w-5 text-violet-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">11. Data Retention</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <p>We retain your personal information for as long as necessary to:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Provide our Service and maintain your account</li>
                    <li>Comply with legal obligations (tax records, regulatory requirements)</li>
                    <li>Resolve disputes and enforce agreements</li>
                    <li>Prevent fraud and abuse</li>
                  </ul>
                  <p className="mt-4">
                    <strong>Account Deletion:</strong> If you delete your account, we will remove your personal data within 90 days, except where retention is required by law.
                  </p>
                  <p>
                    <strong>Transaction Records:</strong> Financial transaction records are retained for 7 years as required by Indian tax laws.
                  </p>
                </div>
              </section>

              {/* Changes to Policy */}
              <section id="changes" data-section="changes" className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                    <RefreshCw className="h-5 w-5 text-amber-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">12. Changes to This Policy</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <p>
                    We may update this Privacy Policy from time to time. We will notify you of significant changes by:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Posting the updated policy on this page</li>
                    <li>Sending an email notification</li>
                    <li>Displaying an in-app notification</li>
                    <li>Updating the "Last Updated" date at the top</li>
                  </ul>
                  <p className="mt-4">
                    Your continued use of the Service after changes indicates acceptance of the updated policy.
                  </p>
                </div>
              </section>

              {/* Contact Us */}
              <section id="contact" data-section="contact" className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-teal-500/20 rounded-xl flex items-center justify-center">
                    <Mail className="h-5 w-5 text-teal-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">13. Contact Us</h2>
                </div>
                <div className="text-gray-300 space-y-4 leading-relaxed">
                  <p>If you have any questions, concerns, or requests regarding this Privacy Policy, please contact us:</p>
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
                          <a href={`mailto:${companyInfo.email}`} className="text-purple-400 hover:underline">{companyInfo.email}</a>
                        </p>
                      )}
                      {companyInfo.phone && (
                        <p className="flex items-center gap-3">
                          <Phone className="h-5 w-5 text-gray-400" />
                          <a href={`tel:${companyInfo.phone}`} className="text-purple-400 hover:underline">{companyInfo.phone}</a>
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

export default PrivacyPolicy;
