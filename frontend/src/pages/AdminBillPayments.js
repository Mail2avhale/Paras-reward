import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import Pagination from '@/components/Pagination';
import { ArrowLeft, Clock, CheckCircle, XCircle, Search, Filter } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';
const ITEMS_PER_PAGE = 10;

const AdminBillPayments = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({});
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/admin');
      return;
    }
    fetchRequests();
  }, [user, navigate, filter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchTerm]);

  const fetchRequests = async () => {
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const response = await axios.get(`${API}/api/admin/bill-payment/requests${params}`);
      setRequests(response.data.requests || []);
      setStats(response.data.stats || {});
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load requests');
    }
  };

  const handleProcess = async (requestId, action) => {
    setLoading(true);
    try {
      await axios.post(`${API}/api/admin/bill-payment/process`, {
        request_id: requestId,
        action,
        admin_notes: adminNotes,
        admin_uid: user.uid
      });

      const actionText = action === 'reject' ? 'rejected' : action === 'approve' ? 'approved' : 'completed';
      toast.success(`Request ${actionText} successfully!`);
      
      setSelectedRequest(null);
      setAdminNotes('');
      fetchRequests();
    } catch (error) {
      console.error('Error processing request:', error);
      toast.error(error.response?.data?.detail || 'Failed to process request');
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter(req =>
    req.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.request_id.includes(searchTerm)
  );

  // Pagination
  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getTypeLabel = (type) => {
    const labels = {
      mobile_recharge: 'Mobile Recharge',
      dish_recharge: 'DTH/Dish',
      electricity_bill: 'Electricity',
      credit_card_payment: 'Credit Card',
      loan_emi: 'Loan/EMI'
    };
    return labels[type] || type;
  };

  return (
    <div className="min-h-screen bg-gray-800/50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-white">Bill Payment Requests</h1>
              <p className="text-sm text-gray-400">Manage user bill payment and recharge requests</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-4 bg-yellow-50 border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Pending</p>
                <p className="text-2xl font-bold text-yellow-700">{stats.pending || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </Card>
          <Card className="p-4 bg-green-50 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Completed</p>
                <p className="text-2xl font-bold text-green-700">{stats.completed || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </Card>
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Rejected</p>
                <p className="text-2xl font-bold text-red-700">{stats.rejected || 0}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by user, email, or ID..."
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                onClick={() => setFilter('all')}
                size="sm"
              >
                All
              </Button>
              <Button
                variant={filter === 'pending' ? 'default' : 'outline'}
                onClick={() => setFilter('pending')}
                size="sm"
              >
                Pending
              </Button>
              <Button
                variant={filter === 'completed' ? 'default' : 'outline'}
                onClick={() => setFilter('completed')}
                size="sm"
              >
                Completed
              </Button>
              <Button
                variant={filter === 'rejected' ? 'default' : 'outline'}
                onClick={() => setFilter('rejected')}
                size="sm"
              >
                Rejected
              </Button>
            </div>
          </div>
        </Card>

        {/* Requests Table */}
        <Card className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-semibold">User</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">PRC</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRequests.map((req) => (
                  <tr key={req.request_id} className="border-b hover:bg-gray-800/50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm font-medium">{req.user_name}</p>
                        <p className="text-xs text-gray-400">{req.user_email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">{getTypeLabel(req.request_type)}</td>
                    <td className="py-3 px-4 text-sm font-bold">₹{req.amount_inr}</td>
                    <td className="py-3 px-4 text-sm">{req.total_prc_deducted.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        req.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        req.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {new Date(req.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedRequest(req)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredRequests.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        </Card>

        {/* Detail Modal */}
        {selectedRequest && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <h2 className="text-2xl font-bold mb-4">Request Details</h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">User</p>
                    <p className="font-semibold">{selectedRequest.user_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Type</p>
                    <p className="font-semibold">{getTypeLabel(selectedRequest.request_type)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Amount</p>
                    <p className="font-semibold text-lg">₹{selectedRequest.amount_inr}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">PRC Deducted</p>
                    <p className="font-semibold">{selectedRequest.total_prc_deducted.toFixed(2)} PRC</p>
                  </div>
                </div>

                <div className="bg-gray-800/50 p-4 rounded-lg">
                  <p className="text-sm font-semibold mb-3">Request Details</p>
                  
                  {/* Loan/EMI specific formatted display */}
                  {selectedRequest.request_type === 'loan_emi' ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-900 p-3 rounded border">
                          <p className="text-xs text-gray-500">Loan Account Number</p>
                          <p className="font-semibold">{selectedRequest.details?.loan_account || '-'}</p>
                        </div>
                        <div className="bg-gray-900 p-3 rounded border">
                          <p className="text-xs text-gray-500">Bank/NBFC Name</p>
                          <p className="font-semibold">{selectedRequest.details?.bank_name || '-'}</p>
                        </div>
                        <div className="bg-gray-900 p-3 rounded border">
                          <p className="text-xs text-gray-500">IFSC Code</p>
                          <p className="font-semibold font-mono">{selectedRequest.details?.ifsc_code || '-'}</p>
                        </div>
                        <div className="bg-gray-900 p-3 rounded border">
                          <p className="text-xs text-gray-500">Customer ID</p>
                          <p className="font-semibold">{selectedRequest.details?.customer_id || '-'}</p>
                        </div>
                        <div className="bg-gray-900 p-3 rounded border">
                          <p className="text-xs text-gray-500">Borrower Name</p>
                          <p className="font-semibold">{selectedRequest.details?.borrower_name || '-'}</p>
                        </div>
                        <div className="bg-gray-900 p-3 rounded border">
                          <p className="text-xs text-gray-500">Registered Mobile</p>
                          <p className="font-semibold">{selectedRequest.details?.registered_mobile || '-'}</p>
                        </div>
                        <div className="bg-gray-900 p-3 rounded border">
                          <p className="text-xs text-gray-500">Loan Type</p>
                          <p className="font-semibold capitalize">{selectedRequest.details?.loan_type?.replace('_', ' ') || '-'}</p>
                        </div>
                        <div className="bg-gray-900 p-3 rounded border">
                          <p className="text-xs text-gray-500">Remaining Tenure</p>
                          <p className="font-semibold">{selectedRequest.details?.loan_tenure || '-'}</p>
                        </div>
                        <div className="bg-gray-900 p-3 rounded border">
                          <p className="text-xs text-gray-500">EMI Due Date</p>
                          <p className="font-semibold">{selectedRequest.details?.emi_due_date || '-'}</p>
                        </div>
                        <div className="bg-gray-900 p-3 rounded border">
                          <p className="text-xs text-gray-500">Monthly EMI Amount</p>
                          <p className="font-semibold">₹{selectedRequest.details?.emi_amount || '-'}</p>
                        </div>
                      </div>
                    </div>
                  ) : selectedRequest.request_type === 'electricity' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Consumer Number</p>
                        <p className="font-semibold font-mono">{selectedRequest.details?.consumer_number || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Provider</p>
                        <p className="font-semibold">{selectedRequest.details?.provider || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Consumer Name</p>
                        <p className="font-semibold">{selectedRequest.details?.consumer_name || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Bill Amount</p>
                        <p className="font-semibold">₹{selectedRequest.details?.bill_amount || selectedRequest.amount_inr}</p>
                      </div>
                      {selectedRequest.details?.billing_unit && (
                        <div className="bg-gray-900 p-3 rounded border">
                          <p className="text-xs text-gray-500">Billing Unit</p>
                          <p className="font-semibold">{selectedRequest.details?.billing_unit}</p>
                        </div>
                      )}
                      {selectedRequest.details?.due_date && (
                        <div className="bg-gray-900 p-3 rounded border">
                          <p className="text-xs text-gray-500">Due Date</p>
                          <p className="font-semibold">{selectedRequest.details?.due_date}</p>
                        </div>
                      )}
                    </div>
                  ) : selectedRequest.request_type === 'mobile_recharge' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Mobile Number</p>
                        <p className="font-semibold font-mono text-lg">{selectedRequest.details?.mobile_number || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Operator</p>
                        <p className="font-semibold">{selectedRequest.details?.operator || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Circle/State</p>
                        <p className="font-semibold">{selectedRequest.details?.circle || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Recharge Type</p>
                        <p className="font-semibold capitalize">{selectedRequest.details?.recharge_type || 'Prepaid'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border col-span-2">
                        <p className="text-xs text-gray-500">Recharge Amount</p>
                        <p className="font-semibold text-lg text-green-400">₹{selectedRequest.amount_inr}</p>
                      </div>
                    </div>
                  ) : selectedRequest.request_type === 'dth' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Subscriber ID</p>
                        <p className="font-semibold font-mono">{selectedRequest.details?.subscriber_id || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">DTH Provider</p>
                        <p className="font-semibold">{selectedRequest.details?.provider || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Customer Name</p>
                        <p className="font-semibold">{selectedRequest.details?.customer_name || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Recharge Amount</p>
                        <p className="font-semibold text-lg text-green-400">₹{selectedRequest.amount_inr}</p>
                      </div>
                    </div>
                  ) : selectedRequest.request_type === 'gas' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Consumer Number</p>
                        <p className="font-semibold font-mono">{selectedRequest.details?.consumer_number || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Gas Provider</p>
                        <p className="font-semibold">{selectedRequest.details?.provider || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Consumer Name</p>
                        <p className="font-semibold">{selectedRequest.details?.consumer_name || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Bill Amount</p>
                        <p className="font-semibold text-lg">₹{selectedRequest.amount_inr}</p>
                      </div>
                    </div>
                  ) : selectedRequest.request_type === 'water' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Consumer Number</p>
                        <p className="font-semibold font-mono">{selectedRequest.details?.consumer_number || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Water Board</p>
                        <p className="font-semibold">{selectedRequest.details?.provider || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Consumer Name</p>
                        <p className="font-semibold">{selectedRequest.details?.consumer_name || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Bill Amount</p>
                        <p className="font-semibold text-lg">₹{selectedRequest.amount_inr}</p>
                      </div>
                    </div>
                  ) : selectedRequest.request_type === 'broadband' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Account Number</p>
                        <p className="font-semibold font-mono">{selectedRequest.details?.account_number || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">ISP Provider</p>
                        <p className="font-semibold">{selectedRequest.details?.provider || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Customer Name</p>
                        <p className="font-semibold">{selectedRequest.details?.customer_name || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Bill Amount</p>
                        <p className="font-semibold text-lg">₹{selectedRequest.amount_inr}</p>
                      </div>
                    </div>
                  ) : selectedRequest.request_type === 'insurance' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Policy Number</p>
                        <p className="font-semibold font-mono">{selectedRequest.details?.policy_number || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Insurance Company</p>
                        <p className="font-semibold">{selectedRequest.details?.provider || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Policy Holder</p>
                        <p className="font-semibold">{selectedRequest.details?.policy_holder || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Premium Amount</p>
                        <p className="font-semibold text-lg">₹{selectedRequest.amount_inr}</p>
                      </div>
                    </div>
                  ) : selectedRequest.request_type === 'fastag' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">Vehicle Number</p>
                        <p className="font-semibold font-mono text-lg">{selectedRequest.details?.vehicle_number || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border">
                        <p className="text-xs text-gray-500">FASTag Provider</p>
                        <p className="font-semibold">{selectedRequest.details?.provider || '-'}</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border col-span-2">
                        <p className="text-xs text-gray-500">Recharge Amount</p>
                        <p className="font-semibold text-lg text-green-400">₹{selectedRequest.amount_inr}</p>
                      </div>
                    </div>
                  ) : (
                    /* Fallback for unknown types - show formatted key-value pairs */
                    <div className="grid grid-cols-2 gap-3">
                      {selectedRequest.details && Object.entries(selectedRequest.details).map(([key, value]) => (
                        <div key={key} className="bg-gray-900 p-3 rounded border">
                          <p className="text-xs text-gray-500 capitalize">{key.replace(/_/g, ' ')}</p>
                          <p className="font-semibold">{value || '-'}</p>
                        </div>
                      ))}
                      {(!selectedRequest.details || Object.keys(selectedRequest.details).length === 0) && (
                        <p className="text-gray-500 col-span-2">No additional details available</p>
                      )}
                    </div>
                  )}
                </div>

                {selectedRequest.status === 'pending' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Admin Notes</label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      className="w-full border border-gray-700 rounded bg-gray-800 text-white p-2 text-sm"
                      rows={3}
                      placeholder="Add notes (optional)..."
                    />
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                    Close
                  </Button>
                  {selectedRequest.status === 'pending' && (
                    <>
                      <Button
                        variant="destructive"
                        onClick={() => handleProcess(selectedRequest.request_id, 'reject')}
                        disabled={loading}
                      >
                        Reject
                      </Button>
                      <Button
                        onClick={() => handleProcess(selectedRequest.request_id, 'complete')}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Mark Complete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBillPayments;