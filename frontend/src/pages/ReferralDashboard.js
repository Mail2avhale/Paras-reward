import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Tree from 'react-d3-tree';
import { QRCodeCanvas } from 'qrcode.react';
import Navbar from '@/components/Navbar';
import { 
  Users, TrendingUp, Award, Share2, Copy, Check, 
  Facebook, Twitter, MessageCircle, Download 
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

function ReferralDashboard({ user, onLogout }) {
  const [stats, setStats] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [treeData, setTreeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [copied, setCopied] = useState(false);

  const referralLink = `${window.location.origin}/register?ref=${user.uid}`;

  useEffect(() => {
    fetchReferralData();
  }, [user.uid]);

  const fetchReferralData = async () => {
    setLoading(true);
    try {
      const [statsRes, earningsRes, treeRes] = await Promise.all([
        axios.get(`${API}/referrals/${user.uid}/stats`),
        axios.get(`${API}/referrals/${user.uid}/earnings`),
        axios.get(`${API}/referrals/${user.uid}/tree`)
      ]);

      setStats(statsRes.data);
      setEarnings(earningsRes.data);
      setTreeData(treeRes.data.tree);
    } catch (error) {
      console.error('Error fetching referral data:', error);
      toast.error('Failed to load referral data');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    // Fallback method for copying text when Clipboard API is blocked
    const textArea = document.createElement('textarea');
    textArea.value = referralLink;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      textArea.remove();
      setCopied(true);
      toast.success('Referral link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      textArea.remove();
      // Show the link in a prompt as last resort
      toast.error('Please copy the link manually');
    }
  };

  const shareWhatsApp = () => {
    const message = encodeURIComponent(
      `Join PARAS REWARD and start earning! Use my referral link: ${referralLink}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const shareFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`,
      '_blank'
    );
  };

  const shareTwitter = () => {
    const message = encodeURIComponent(
      `Join PARAS REWARD and start earning! ${referralLink}`
    );
    window.open(`https://twitter.com/intent/tweet?text=${message}`, '_blank');
  };

  const downloadQR = () => {
    const canvas = document.getElementById('qr-code');
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'paras-referral-qr.png';
    link.href = url;
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <Navbar user={user} onLogout={onLogout} />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <Navbar user={user} onLogout={onLogout} />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Referral Dashboard</h1>
          <p className="text-gray-600">Share your link and earn rewards when friends join!</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium opacity-90">Total Referrals</h3>
              <Users className="w-8 h-8 opacity-80" />
            </div>
            <p className="text-3xl font-bold">{stats?.total_referrals || 0}</p>
            <p className="text-sm opacity-80 mt-2">
              {stats?.active_referrals || 0} active
            </p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-500 to-green-600 text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium opacity-90">Total Earned</h3>
              <Award className="w-8 h-8 opacity-80" />
            </div>
            <p className="text-3xl font-bold">{earnings?.total_earned || 0} PRC</p>
            <p className="text-sm opacity-80 mt-2">
              {earnings?.transaction_count || 0} transactions
            </p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium opacity-90">Conversion Rate</h3>
              <TrendingUp className="w-8 h-8 opacity-80" />
            </div>
            <p className="text-3xl font-bold">{stats?.conversion_rate || 0}%</p>
            <p className="text-sm opacity-80 mt-2">
              {stats?.total_orders_from_referrals || 0} orders
            </p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium opacity-90">Potential</h3>
              <Award className="w-8 h-8 opacity-80" />
            </div>
            <p className="text-3xl font-bold">{earnings?.potential_earnings || 0} PRC</p>
            <p className="text-sm opacity-80 mt-2">From inactive referrals</p>
          </Card>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 bg-white rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                activeTab === 'overview'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('tree')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                activeTab === 'tree'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Referral Tree
            </button>
            <button
              onClick={() => setActiveTab('earnings')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                activeTab === 'earnings'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Earnings
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Share Section */}
            <Card className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Share2 className="w-5 h-5" />
                Share Your Link
              </h2>

              {/* Referral Link */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Referral Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={referralLink}
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                  <Button onClick={copyToClipboard} className="flex items-center gap-2">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>

              {/* Social Sharing */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Share on Social Media
                </label>
                <div className="flex gap-3">
                  <Button
                    onClick={shareWhatsApp}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <MessageCircle className="w-5 h-5 mr-2" />
                    WhatsApp
                  </Button>
                  <Button
                    onClick={shareFacebook}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <Facebook className="w-5 h-5 mr-2" />
                    Facebook
                  </Button>
                  <Button
                    onClick={shareTwitter}
                    className="flex-1 bg-sky-500 hover:bg-sky-600"
                  >
                    <Twitter className="w-5 h-5 mr-2" />
                    Twitter
                  </Button>
                </div>
              </div>

              {/* QR Code */}
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  QR Code
                </label>
                <div className="inline-block p-4 bg-white rounded-lg border-2 border-gray-200">
                  <QRCodeCanvas id="qr-code" value={referralLink} size={200} />
                </div>
                <Button onClick={downloadQR} variant="outline" className="mt-4 w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Download QR Code
                </Button>
              </div>
            </Card>

            {/* Recent Referrals */}
            <Card className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Referrals</h2>
              <div className="space-y-3">
                {stats?.recent_referrals && stats.recent_referrals.length > 0 ? (
                  stats.recent_referrals.map((referral, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{referral.name}</p>
                        <p className="text-sm text-gray-500">{referral.email}</p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                            referral.membership_type === 'vip'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {referral.membership_type.toUpperCase()}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(referral.joined_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-8">
                    No referrals yet. Share your link to get started!
                  </p>
                )}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'tree' && (
          <Card className="p-6" style={{ height: '600px' }}>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Referral Tree</h2>
            {treeData && treeData.children && treeData.children.length > 0 ? (
              <div style={{ width: '100%', height: '500px' }}>
                <Tree
                  data={treeData}
                  orientation="vertical"
                  translate={{ x: 400, y: 50 }}
                  pathFunc="step"
                  nodeSize={{ x: 200, y: 150 }}
                  renderCustomNodeElement={({ nodeDatum }) => (
                    <g>
                      <circle r="30" fill="#8b5cf6" />
                      <text fill="white" strokeWidth="0" x="0" y="5" textAnchor="middle">
                        {nodeDatum.name}
                      </text>
                      <text fill="#666" fontSize="10" x="0" y="50" textAnchor="middle">
                        {nodeDatum.total_referrals} referrals
                      </text>
                    </g>
                  )}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No referral tree yet</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Your referrals will appear here once they join
                  </p>
                </div>
              </div>
            )}
          </Card>
        )}

        {activeTab === 'earnings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Breakdown */}
            <Card className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Monthly Breakdown</h2>
              <div className="space-y-3">
                {earnings?.monthly_breakdown && Object.keys(earnings.monthly_breakdown).length > 0 ? (
                  Object.entries(earnings.monthly_breakdown)
                    .reverse()
                    .map(([month, amount]) => (
                      <div key={month} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-900">{month}</span>
                        <span className="text-lg font-bold text-purple-600">{amount.toFixed(2)} PRC</span>
                      </div>
                    ))
                ) : (
                  <p className="text-center text-gray-500 py-8">No earnings yet</p>
                )}
              </div>
            </Card>

            {/* Recent Transactions */}
            <Card className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Transactions</h2>
              <div className="space-y-3">
                {earnings?.recent_transactions && earnings.recent_transactions.length > 0 ? (
                  earnings.recent_transactions.map((txn, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">+{txn.amount.toFixed(2)} PRC</p>
                        <p className="text-sm text-gray-500">{txn.description}</p>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(txn.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-8">No transactions yet</p>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReferralDashboard;
