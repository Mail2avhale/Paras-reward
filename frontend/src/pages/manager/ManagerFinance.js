import { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/manager/StatusBadge';
import notifications from '@/utils/notifications';
import { DollarSign, CheckCircle, XCircle, Eye, Crown } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ManagerFinance = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('withdrawals');
  const [withdrawals, setWithdrawals] = useState([]);
  const [vipRequests, setVipRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [walletTypeFilter, setWalletTypeFilter] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (activeTab === 'withdrawals') {
      fetchWithdrawals();
    } else if (activeTab === 'vip') {
      fetchVipRequests();
    }
  }, [activeTab, statusFilter, walletTypeFilter]);

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      const params = { uid: user.uid };
      if (statusFilter) params.status = statusFilter;
      if (walletTypeFilter) params.wallet_type = walletTypeFilter;

      const response = await axios.get(`${API}/manager/withdrawals`, { params });
      setWithdrawals(response.data.withdrawals);
    } catch (error) {
      console.error('Error:', error);
      notifications.error('Error', 'Failed to fetch withdrawals');
    } finally {
      setLoading(false);
    }
  };

  const fetchVipRequests = async () => {
    setLoading(true);
    try {
      const params = { uid: user.uid };
      if (statusFilter) params.status = statusFilter;

      const response = await axios.get(`${API}/manager/vip-requests`, { params });
      setVipRequests(response.data.payments);
    } catch (error) {
      console.error('Error:', error);
      notifications.error('Error', 'Failed to fetch VIP requests');
    } finally {
      setLoading(false);
    }
  };

  const approveWithdrawal = async () => {
    if (!transactionId.trim()) {
      notifications.warning('Transaction ID Required', 'Please enter the transaction ID from payment');
      return;
    }

    try {
      await axios.put(
        `${API}/manager/withdrawals/${selectedItem.withdrawal_id}/approve`,
        { wallet_type: selectedItem.wallet_type, transaction_id: transactionId, notes },
        { params: { uid: user.uid } }
      );
      
      notifications.celebrate('✅ Withdrawal Approved!', `₹${selectedItem.amount} withdrawal has been approved and will be processed.`);
      setShowApproveModal(false);
      setTransactionId('');
      setNotes('');
      fetchWithdrawals();
    } catch (error) {
      notifications.error('Approval Failed', error.response?.data?.detail || 'Failed to approve withdrawal');
    }
  };

  const rejectWithdrawal = async () => {
    if (!rejectionReason.trim()) {
      notifications.warning('Reason Required', 'Please provide a reason for rejection');
      return;
    }

    try {
      await axios.put(
        `${API}/manager/withdrawals/${selectedItem.withdrawal_id}/reject`,
        { wallet_type: selectedItem.wallet_type, reason: rejectionReason },
        { params: { uid: user.uid } }
      );
      
      notifications.success('Withdrawal Rejected', 'Amount has been refunded to user wallet');
      setShowRejectModal(false);
      setRejectionReason('');
      fetchWithdrawals();
    } catch (error) {
      notifications.error('Rejection Failed', error.response?.data?.detail || 'Failed to reject withdrawal');
    }
  };

  const approveVip = async (paymentId) => {
    try {
      await axios.put(`${API}/manager/vip-requests/${paymentId}/approve`, null, {
        params: { uid: user.uid }
      });
      
      notifications.celebrate('🎉 VIP Membership Approved!', 'User has been upgraded to VIP membership for 1 year.');
      fetchVipRequests();
    } catch (error) {
      notifications.error('Approval Failed', error.response?.data?.detail || 'Failed to approve VIP');
    }
  };

  const rejectVip = async () => {
    if (!rejectionReason.trim()) {
      notifications.warning('Reason Required', 'Please provide a reason for rejection');
      return;
    }

    try {
      await axios.put(
        `${API}/manager/vip-requests/${selectedItem.payment_id}/reject`,
        { reason: rejectionReason },
        { params: { uid: user.uid } }
      );
      
      notifications.success('VIP Request Rejected', 'User has been notified');
      setShowRejectModal(false);
      setRejectionReason('');
      fetchVipRequests();
    } catch (error) {
      notifications.error('Rejection Failed', error.response?.data?.detail || 'Failed to reject VIP');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Financial Management</h1>
          <p className="text-gray-600">Manage withdrawals and VIP membership approvals</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <Button onClick={() => setActiveTab('withdrawals')} variant={activeTab === 'withdrawals' ? 'default' : 'outline'} className={activeTab === 'withdrawals' ? 'bg-purple-600' : ''}>
            <DollarSign className="mr-2 h-4 w-4" />Withdrawals
          </Button>
          <Button onClick={() => setActiveTab('vip')} variant={activeTab === 'vip' ? 'default' : 'outline'} className={activeTab === 'vip' ? 'bg-purple-600' : ''}>
            <Crown className="mr-2 h-4 w-4" />VIP Approvals
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-6">
          <div className="flex gap-4">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg">
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            {activeTab === 'withdrawals' && (
              <select value={walletTypeFilter} onChange={(e) => setWalletTypeFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg">
                <option value="">All Wallets</option>
                <option value="cashback">Cashback</option>
                <option value="profit">Profit</option>
              </select>
            )}
          </div>
        </Card>

        {/* Content */}
        {activeTab === 'withdrawals' && (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wallet</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Mode</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y">
                  {loading ? (
                    <tr><td colSpan="7" className="px-6 py-12 text-center"><div className="flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div><span className="ml-3">Loading...</span></div></td></tr>
                  ) : withdrawals.length === 0 ? (
                    <tr><td colSpan="7" className="px-6 py-12 text-center text-gray-500">No withdrawals found</td></tr>
                  ) : (
                    withdrawals.map((w) => (
                      <tr key={w.withdrawal_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4"><div className="text-sm font-medium text-gray-900">{w.user_name}</div><div className="text-sm text-gray-500">{w.user_email}</div></td>
                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-semibold ${w.wallet_type === 'cashback' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{w.wallet_type?.toUpperCase()}</span></td>
                        <td className="px-6 py-4 text-sm font-semibold">₹{w.amount}</td>
                        <td className="px-6 py-4 text-sm">{w.payment_mode || 'N/A'}</td>
                        <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold ${w.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : w.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{w.status?.toUpperCase()}</span></td>
                        <td className="px-6 py-4 text-sm">{w.created_at ? new Date(w.created_at).toLocaleDateString() : 'N/A'}</td>
                        <td className="px-6 py-4">
                          {w.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => { setSelectedItem(w); setShowApproveModal(true); }} className="bg-green-600 hover:bg-green-700"><CheckCircle className="h-4 w-4" /></Button>
                              <Button size="sm" onClick={() => { setSelectedItem(w); setShowRejectModal(true); }} variant="outline" className="border-red-600 text-red-600"><XCircle className="h-4 w-4" /></Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'vip' && (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">UTR Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y">
                  {loading ? (
                    <tr><td colSpan="7" className="px-6 py-12 text-center"><div className="flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div><span className="ml-3">Loading...</span></div></td></tr>
                  ) : vipRequests.length === 0 ? (
                    <tr><td colSpan="7" className="px-6 py-12 text-center text-gray-500">No VIP requests found</td></tr>
                  ) : (
                    vipRequests.map((vip) => (
                      <tr key={vip.payment_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4"><div className="text-sm font-medium text-gray-900">{vip.user_name}</div><div className="text-sm text-gray-500">{vip.user_email}</div></td>
                        <td className="px-6 py-4 text-sm font-semibold">₹{vip.amount}</td>
                        <td className="px-6 py-4 text-sm">{vip.payment_method || 'N/A'}</td>
                        <td className="px-6 py-4 text-sm font-mono">{vip.utr_number || 'N/A'}</td>
                        <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold ${vip.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : vip.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{vip.status?.toUpperCase()}</span></td>
                        <td className="px-6 py-4 text-sm">{vip.created_at ? new Date(vip.created_at).toLocaleDateString() : 'N/A'}</td>
                        <td className="px-6 py-4">
                          {vip.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => approveVip(vip.payment_id)} className="bg-green-600 hover:bg-green-700"><CheckCircle className="h-4 w-4 mr-1" />Approve</Button>
                              <Button size="sm" onClick={() => { setSelectedItem(vip); setShowRejectModal(true); }} variant="outline" className="border-red-600 text-red-600"><XCircle className="h-4 w-4 mr-1" />Reject</Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Approve Withdrawal Modal */}
        <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve Withdrawal</DialogTitle>
              <DialogDescription>Enter transaction details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Transaction ID *</label>
                <Input placeholder="Enter payment transaction ID" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Notes (Optional)</label>
                <Textarea placeholder="Add any notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setShowApproveModal(false)} variant="outline" className="flex-1">Cancel</Button>
                <Button onClick={approveWithdrawal} className="flex-1 bg-green-600 hover:bg-green-700">Approve</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Reject Modal */}
        <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Request</DialogTitle>
              <DialogDescription>Provide a reason for rejection</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea placeholder="e.g., Invalid payment proof, incorrect details..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={4} />
              <div className="flex gap-3">
                <Button onClick={() => setShowRejectModal(false)} variant="outline" className="flex-1">Cancel</Button>
                <Button onClick={activeTab === 'withdrawals' ? rejectWithdrawal : rejectVip} className="flex-1 bg-red-600 hover:bg-red-700">Confirm Rejection</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ManagerFinance;