import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowLeft, FileText, Shield, RefreshCw, Save, Loader } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const AdminPolicies = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('terms');
  const [policies, setPolicies] = useState({
    terms: '',
    privacy: '',
    refund: ''
  });

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/admin/policies`);
      setPolicies(response.data);
    } catch (error) {
      console.error('Error fetching policies:', error);
      // Set default content if not found
      setPolicies({
        terms: getDefaultTerms(),
        privacy: getDefaultPrivacy(),
        refund: getDefaultRefund()
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.post(`${API}/api/admin/policies`, policies);
      toast.success('Policies saved successfully!');
    } catch (error) {
      console.error('Error saving policies:', error);
      toast.error('Failed to save policies');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'terms', label: 'Terms & Conditions', icon: FileText },
    { id: 'privacy', label: 'Privacy Policy', icon: Shield },
    { id: 'refund', label: 'Refund Policy', icon: RefreshCw }
  ];

  const getDefaultTerms = () => `# Terms and Conditions

Welcome to PARAS REWARD. By using our services, you agree to these terms.

## 1. Acceptance of Terms
By accessing or using PARAS REWARD, you agree to be bound by these Terms and Conditions.

## 2. Eligibility
- You must be at least 18 years old
- You must be a resident of India
- You must have a valid mobile number and email

## 3. PRC (Paras Reward Coins)
- PRC is a virtual currency within our platform
- 10 PRC = ₹1 INR
- PRC can be earned through mining, referrals, and games
- PRC can be redeemed for products, bill payments, and vouchers

## 4. VIP Membership
- VIP membership unlocks premium features
- Processing time: Minimum 3 to 7 days
- Membership fees are non-refundable after activation

## 5. Daily Rewards
- Free users: PRC expires after 2 days
- VIP users: PRC never expires
- Reward rates are subject to change

## 6. Prohibited Activities
- Using multiple accounts
- Fraudulent activities
- Automated collection or bots

## 7. Contact
For queries, reach out to our support team.`;

  const getDefaultPrivacy = () => `# Privacy Policy

Your privacy is important to us at PARAS REWARD.

## 1. Information We Collect
- Personal information (name, email, phone)
- KYC documents (Aadhaar, PAN)
- Transaction history
- Device information

## 2. How We Use Your Information
- To provide our services
- To verify your identity
- To process transactions
- To send notifications

## 3. Data Security
- We use encryption to protect your data
- Your documents are stored securely
- We never share your data without consent

## 4. Your Rights
- Access your personal data
- Request data deletion
- Opt-out of marketing communications

## 5. Cookies
We use cookies to improve your experience.

## 6. Contact
For privacy concerns, contact our support team.`;

  const getDefaultRefund = () => `# Refund Policy

PARAS REWARD refund policy for various transactions.

## 1. VIP Membership
- Processing time: Minimum 3 to 7 days
- Refund available before activation only
- No refund after membership activation

## 2. Bill Payments & Recharges
- Processing time: Minimum 3 to 7 days
- PRC refunded if request is rejected
- No refund after successful completion

## 3. Gift Vouchers
- Processing time: Minimum 3 to 7 days
- PRC refunded if request is rejected
- No refund after voucher code is issued

## 4. Marketplace Orders
- Processing time: Minimum 3 to 7 days
- Contact support for order issues
- Refund processed to PRC balance

## 5. How to Request Refund
1. Go to Support section
2. Create a new ticket
3. Select 'Refund Request' category
4. Provide transaction details

## 6. Refund Timeline
- Review: 1-2 business days
- Processing: 3-7 business days
- Credit to wallet: Immediate after approval`;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-800/50 flex items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-800/50 pb-20">
      {/* Header */}
      <div className="bg-gray-900 border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h1 className="text-xl font-bold text-gray-900">Policy Management</h1>
            </div>
            <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
              {saving ? (
                <Loader className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save All
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-900 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Editor */}
        <Card className="p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              {tabs.find(t => t.id === activeTab)?.icon && 
                React.createElement(tabs.find(t => t.id === activeTab).icon, { className: 'h-5 w-5 text-purple-600' })
              }
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            <p className="text-sm text-gray-500 mt-1">Edit the content using Markdown format</p>
          </div>

          <textarea
            value={policies[activeTab]}
            onChange={(e) => setPolicies({ ...policies, [activeTab]: e.target.value })}
            className="w-full h-[500px] p-4 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder={`Enter ${tabs.find(t => t.id === activeTab)?.label} content...`}
          />

          <div className="mt-4 p-4 bg-blue-500/10 rounded-lg">
            <p className="text-sm text-blue-400">
              <strong>Tip:</strong> Use Markdown syntax for formatting. 
              Use # for headings, **bold**, *italic*, - for lists.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminPolicies;
