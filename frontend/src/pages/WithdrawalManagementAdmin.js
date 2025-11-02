import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Wallet, DollarSign, CheckCircle, XCircle, Clock, 
  Eye, Filter, Search, Download 
} from 'lucide-react';
import { getBankByName, getBankLogo, getBankColor } from '@/data/banksData';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const WithdrawalManagementAdmin = () => {
  const [activeTab, setActiveTab] = useState('cashback');
  const [cashbackWithdrawals, setCashbackWithdrawals] = useState([]);
  const [profitWithdrawals, setProfitWithdrawals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState(''); // approve, reject, complete
  const [actionData, setActionData] = useState({
    admin_notes: '',
    rejection_reason: '',
    utr_number: ''
  });

  useEffect(() => {
    fetchWithdrawals();
  }, [activeTab, filterStatus]);

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      if (activeTab === 'cashback') {
        const params = filterStatus !== 'all' ? { status: filterStatus } : {};
        const response = await axios.get(`${API}/admin/withdrawals/cashback`, { params });
        setCashbackWithdrawals(response.data.withdrawals || []);
      } else {
        const params = filterStatus !== 'all' ? { status: filterStatus } : {};
        const response = await axios.get(`${API}/admin/withdrawals/profit`, { params });
        setProfitWithdrawals(response.data.withdrawals || []);
      }
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      toast.error('Failed to fetch withdrawal requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'cashback' 
        ? `${API}/admin/withdrawals/cashback/${selectedWithdrawal._id || selectedWithdrawal.withdrawal_id}/approve`
        : `${API}/admin/withdrawals/profit/${selectedWithdrawal._id || selectedWithdrawal.withdrawal_id}/approve`;
      
      await axios.post(endpoint, {
        admin_notes: actionData.admin_notes
      });
      
      toast.success('Withdrawal approved successfully!');
      setShowActionModal(false);
      setActionData({ admin_notes: '', rejection_reason: '', utr_number: '' });
      fetchWithdrawals();
    } catch (error) {
      console.error('Error approving withdrawal:', error);
      toast.error(error.response?.data?.detail || 'Failed to approve withdrawal');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!actionData.rejection_reason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    
    setLoading(true);
    try {
      const endpoint = activeTab === 'cashback'
        ? `${API}/admin/withdrawals/cashback/${selectedWithdrawal._id || selectedWithdrawal.withdrawal_id}/reject`
        : `${API}/admin/withdrawals/profit/${selectedWithdrawal._id || selectedWithdrawal.withdrawal_id}/reject`;
      
      await axios.post(endpoint, {
        rejection_reason: actionData.rejection_reason,
        admin_notes: actionData.admin_notes
      });
      
      toast.success('Withdrawal rejected. Amount refunded to user wallet.');
      setShowActionModal(false);
      setActionData({ admin_notes: '', rejection_reason: '', utr_number: '' });
      fetchWithdrawals();
    } catch (error) {
      console.error('Error rejecting withdrawal:', error);
      toast.error(error.response?.data?.detail || 'Failed to reject withdrawal');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!actionData.utr_number.trim()) {
      toast.error('Please provide UTR/Transaction number');
      return;
    }
    
    setLoading(true);
    try {
      const endpoint = activeTab === 'cashback'
        ? `${API}/admin/withdrawals/cashback/${selectedWithdrawal._id || selectedWithdrawal.withdrawal_id}/complete`
        : `${API}/admin/withdrawals/profit/${selectedWithdrawal._id || selectedWithdrawal.withdrawal_id}/complete`;
      
      await axios.post(endpoint, {
        utr_number: actionData.utr_number,
        admin_notes: actionData.admin_notes
      });
      
      toast.success('Withdrawal marked as completed!');
      setShowActionModal(false);
      setActionData({ admin_notes: '', rejection_reason: '', utr_number: '' });
      fetchWithdrawals();
    } catch (error) {
      console.error('Error completing withdrawal:', error);
      toast.error(error.response?.data?.detail || 'Failed to complete withdrawal');
    } finally {
      setLoading(false);
    }
  };

  const openActionModal = (withdrawal, type) => {
    setSelectedWithdrawal(withdrawal);
    setActionType(type);
    setShowActionModal(true);
  };

  const formatCurrency = (amount) => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(numericAmount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const withdrawals = activeTab === 'cashback' ? cashbackWithdrawals : profitWithdrawals;
  const filteredWithdrawals = withdrawals.filter(w => {
    const matchesSearch = searchQuery === '' || 
      w.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.user_id?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Withdrawal Requests</h2>
          <p className="text-gray-600">Manage cashback and profit wallet withdrawal requests</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('cashback')}
            className={`px-6 py-3 border-b-2 font-medium transition-all ${
              activeTab === 'cashback'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Wallet className="inline h-4 w-4 mr-2" />
            Cashback Withdrawals
          </button>
          <button
            onClick={() => setActiveTab('profit')}
            className={`px-6 py-3 border-b-2 font-medium transition-all ${
              activeTab === 'profit'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <DollarSign className="inline h-4 w-4 mr-2" />
            Profit Withdrawals
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex gap-3 items-center">
          <Filter className="h-5 w-5 text-gray-500" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search by user name, email, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Withdrawals Table */}
      {loading ? (
        <Card className="p-12 text-center">
          <div className="text-gray-600">Loading withdrawal requests...</div>
        </Card>
      ) : filteredWithdrawals.length === 0 ? (
        <Card className="p-12 text-center">
          <Wallet className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Withdrawal Requests</h3>
          <p className="text-gray-600">
            {searchQuery ? 'No withdrawals match your search' : 'No withdrawal requests found'}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Fee</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Mode</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredWithdrawals.map((withdrawal) => (
                  <tr key={withdrawal._id || withdrawal.withdrawal_id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{withdrawal.user_name || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{withdrawal.user_email || withdrawal.user_id}</div>
                      {withdrawal.user_role && withdrawal.user_role !== 'user' && (
                        <div className="text-xs text-purple-600 font-semibold mt-1">
                          {withdrawal.user_role.replace('_', ' ').toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <div className="font-semibold text-gray-900">{formatCurrency(withdrawal.amount)}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-600">{formatCurrency(withdrawal.withdrawal_fee || 0)}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <div className="font-bold text-green-600">
                        {formatCurrency((withdrawal.amount || 0) - (withdrawal.withdrawal_fee || 0))}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{withdrawal.payment_mode || 'N/A'}</div>
                      {withdrawal.upi_id && (
                        <div className="text-xs text-gray-500">{withdrawal.upi_id}</div>
                      )}
                      {withdrawal.account_number && (
                        <div className="text-xs text-gray-500">A/c: {withdrawal.account_number}</div>
                      )}
                      {withdrawal.bank_name && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-sm">{getBankLogo(withdrawal.bank_name)}</span>
                          <span className="text-xs text-gray-600">{withdrawal.bank_name}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(withdrawal.created_at || withdrawal.requested_at)}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      {getStatusBadge(withdrawal.status)}
                      {withdrawal.utr_number && (
                        <div className="text-xs text-gray-500 mt-1">UTR: {withdrawal.utr_number}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <div className="flex gap-2 justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedWithdrawal(withdrawal);
                            setShowDetailModal(true);
                          }}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        {withdrawal.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => openActionModal(withdrawal, 'approve')}
                              title="Approve"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              className="bg-red-600 hover:bg-red-700"
                              onClick={() => openActionModal(withdrawal, 'reject')}
                              title="Reject"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        
                        {withdrawal.status === 'approved' && (
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => openActionModal(withdrawal, 'complete')}
                            title="Mark as Completed"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Complete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Withdrawal Details</h2>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">User Name</label>
                  <p className="text-base font-semibold text-gray-900">{selectedWithdrawal.user_name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">User Email</label>
                  <p className="text-base text-gray-900">{selectedWithdrawal.user_email || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">User ID</label>
                  <p className="text-base text-gray-900 font-mono text-sm">{selectedWithdrawal.user_id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedWithdrawal.status)}</div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Amount Details</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Amount</label>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(selectedWithdrawal.amount)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Fee</label>
                    <p className="text-xl font-bold text-orange-600">{formatCurrency(selectedWithdrawal.withdrawal_fee || 0)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Net Amount</label>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency((selectedWithdrawal.amount || 0) - (selectedWithdrawal.withdrawal_fee || 0))}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Payment Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Payment Mode</label>
                    <p className="text-base text-gray-900 capitalize">{selectedWithdrawal.payment_mode || 'N/A'}</p>
                  </div>
                  {selectedWithdrawal.upi_id && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">UPI ID / Mobile</label>
                      <p className="text-base text-gray-900">{selectedWithdrawal.upi_id}</p>
                    </div>
                  )}
                  {(selectedWithdrawal.bank_account || selectedWithdrawal.account_number) && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Account Number</label>
                        <p className="text-base text-gray-900">{selectedWithdrawal.bank_account || selectedWithdrawal.account_number}</p>
                      </div>
                      {selectedWithdrawal.account_holder_name && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Account Holder Name</label>
                          <p className="text-base text-gray-900">{selectedWithdrawal.account_holder_name}</p>
                        </div>
                      )}
                      {(selectedWithdrawal.ifsc_code || selectedWithdrawal.ifsc) && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">IFSC Code</label>
                          <p className="text-base text-gray-900">{selectedWithdrawal.ifsc_code || selectedWithdrawal.ifsc || 'N/A'}</p>
                        </div>
                      )}
                      {selectedWithdrawal.bank_name && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Bank Name</label>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getBankLogo(selectedWithdrawal.bank_name)}</span>
                            <p className="text-base text-gray-900">{selectedWithdrawal.bank_name || 'N/A'}</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {selectedWithdrawal.utr_number && (
                <div className="border-t pt-4">
                  <label className="text-sm font-medium text-gray-600">UTR/Transaction Number</label>
                  <p className="text-lg font-semibold text-blue-600">{selectedWithdrawal.utr_number}</p>
                </div>
              )}

              {(selectedWithdrawal.admin_notes || selectedWithdrawal.rejection_reason) && (
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Admin Notes</h3>
                  {selectedWithdrawal.rejection_reason && (
                    <div className="mb-2">
                      <label className="text-sm font-medium text-red-600">Rejection Reason</label>
                      <p className="text-base text-gray-900">{selectedWithdrawal.rejection_reason}</p>
                    </div>
                  )}
                  {selectedWithdrawal.admin_notes && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Notes</label>
                      <p className="text-base text-gray-900">{selectedWithdrawal.admin_notes}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Timeline</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Requested</span>
                    <span className="text-gray-900 font-medium">{formatDate(selectedWithdrawal.created_at || selectedWithdrawal.requested_at)}</span>
                  </div>
                  {selectedWithdrawal.approved_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Approved</span>
                      <span className="text-gray-900 font-medium">{formatDate(selectedWithdrawal.approved_at)}</span>
                    </div>
                  )}
                  {selectedWithdrawal.completed_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Completed</span>
                      <span className="text-gray-900 font-medium">{formatDate(selectedWithdrawal.completed_at)}</span>
                    </div>
                  )}
                  {selectedWithdrawal.rejected_at && (
                    <div className="flex justify-between">
                      <span className="text-red-600">Rejected</span>
                      <span className="text-red-900 font-medium">{formatDate(selectedWithdrawal.rejected_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Button
                onClick={() => setShowDetailModal(false)}
                variant="outline"
                className="w-full"
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Action Modal */}
      {showActionModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {actionType === 'approve' && 'Approve Withdrawal'}
              {actionType === 'reject' && 'Reject Withdrawal'}
              {actionType === 'complete' && 'Complete Withdrawal'}
            </h2>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">User: <span className="font-semibold text-gray-900">{selectedWithdrawal.user_name}</span></p>
                <p className="text-sm text-gray-600">Amount: <span className="font-semibold text-gray-900">{formatCurrency(selectedWithdrawal.amount)}</span></p>
                <p className="text-sm text-gray-600">Net Amount: <span className="font-semibold text-green-600">{formatCurrency((selectedWithdrawal.amount || 0) - (selectedWithdrawal.withdrawal_fee || 0))}</span></p>
              </div>

              {actionType === 'reject' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rejection Reason *</label>
                  <textarea
                    className="w-full border rounded p-3"
                    rows="3"
                    value={actionData.rejection_reason}
                    onChange={(e) => setActionData({...actionData, rejection_reason: e.target.value})}
                    placeholder="Enter reason for rejection..."
                    required
                  />
                </div>
              )}

              {actionType === 'complete' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">UTR/Transaction Number *</label>
                  <Input
                    type="text"
                    value={actionData.utr_number}
                    onChange={(e) => setActionData({...actionData, utr_number: e.target.value})}
                    placeholder="Enter UTR or transaction number"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes (Optional)</label>
                <textarea
                  className="w-full border rounded p-3"
                  rows="2"
                  value={actionData.admin_notes}
                  onChange={(e) => setActionData({...actionData, admin_notes: e.target.value})}
                  placeholder="Add any additional notes..."
                />
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  type="button"
                  onClick={() => {
                    setShowActionModal(false);
                    setActionData({ admin_notes: '', rejection_reason: '', utr_number: '' });
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    if (actionType === 'approve') handleApprove();
                    else if (actionType === 'reject') handleReject();
                    else if (actionType === 'complete') handleComplete();
                  }}
                  className={`flex-1 ${
                    actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                    actionType === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                    'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {loading ? 'Processing...' : actionType.charAt(0).toUpperCase() + actionType.slice(1)}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default WithdrawalManagementAdmin;
