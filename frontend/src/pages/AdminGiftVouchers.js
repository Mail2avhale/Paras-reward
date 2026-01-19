import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import Pagination from '@/components/Pagination';
import { ArrowLeft, Gift, Clock, CheckCircle, XCircle, Search } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';
const ITEMS_PER_PAGE = 10;

const AdminGiftVouchers = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({});
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [voucherCode, setVoucherCode] = useState('');
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
      const response = await axios.get(`${API}/api/admin/gift-voucher/requests${params}`);
      setRequests(response.data.requests || []);
      setStats(response.data.stats || {});
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load requests');
    }
  };

  const handleProcess = async (requestId, action) => {
    if (action === 'approve' && !voucherCode) {
      toast.error('Please enter voucher code');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/api/admin/gift-voucher/process`, {
        request_id: requestId,
        action,
        voucher_code: voucherCode,
        admin_notes: adminNotes,
        admin_uid: user.uid
      });

      toast.success(`Request ${action === 'reject' ? 'rejected' : 'approved'} successfully!`);
      
      setSelectedRequest(null);
      setVoucherCode('');
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

  return (
    <div className="min-h-screen bg-gray-800/50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-white">Gift Voucher Requests</h1>
              <p className="text-sm text-gray-400">Manage PhonePe gift voucher redemptions</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 bg-yellow-500/10/10 border-yellow-500/30">
            <p className="text-sm text-gray-400">Pending</p>
            <p className="text-2xl font-bold text-yellow-400">{stats.pending || 0}</p>
          </Card>
          <Card className="p-4 bg-green-500/10/10 border-green-500/30">
            <p className="text-sm text-gray-400">Completed</p>
            <p className="text-2xl font-bold text-green-400">{stats.completed || 0}</p>
          </Card>
          <Card className="p-4 bg-blue-500/10/10 border-blue-500/30">
            <p className="text-sm text-gray-400">Pending Value</p>
            <p className="text-2xl font-bold text-blue-400">₹{stats.total_value_pending || 0}</p>
          </Card>
          <Card className="p-4 bg-purple-500/10/10 border-purple-500/30">
            <p className="text-sm text-gray-400">Completed Value</p>
            <p className="text-2xl font-bold text-purple-400">₹{stats.total_value_completed || 0}</p>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6 bg-gray-900 border-gray-700">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {['all', 'pending', 'completed', 'rejected'].map(status => (
                <Button
                  key={status}
                  variant={filter === status ? 'default' : 'outline'}
                  onClick={() => setFilter(status)}
                  size="sm"
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Requests */}
        <div className="grid gap-4">
          {paginatedRequests.map((req) => (
            <Card key={req.request_id} className="p-6 hover:shadow-lg transition-shadow bg-gray-900 border-gray-700">
              <div className="flex items-start justify-between">
                <div className="flex gap-4 flex-1">
                  <div className="text-4xl">🎁</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-lg text-white">₹{req.denomination} Voucher</h3>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        req.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">User</p>
                        <p className="font-semibold text-white">{req.user_name}</p>
                        <p className="text-xs text-gray-500">{req.user_role}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">PRC Deducted</p>
                        <p className="font-semibold text-purple-400">{req.total_prc_deducted.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Date</p>
                        <p className="font-semibold text-gray-300">{new Date(req.created_at).toLocaleDateString()}</p>
                      </div>
                      {req.voucher_code && (
                        <div>
                          <p className="text-gray-400">Voucher Code</p>
                          <p className="font-mono font-bold text-green-400">{req.voucher_code}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {req.status === 'pending' && (
                  <Button
                    size="sm"
                    onClick={() => setSelectedRequest(req)}
                  >
                    Process
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
        
        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredRequests.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />

        {/* Process Modal */}
        {selectedRequest && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <Card className="max-w-lg w-full p-6 bg-gray-900 border-gray-700">
              <h2 className="text-2xl font-bold mb-4 text-white">Process Voucher Request</h2>
              
              <div className="space-y-4">
                <div className="bg-purple-500/10/10 border border-purple-500/30 p-4 rounded-lg">
                  <p className="text-sm text-gray-400">User: <span className="font-semibold text-white">{selectedRequest.user_name}</span></p>
                  <p className="text-sm text-gray-400">Denomination: <span className="font-semibold text-lg text-amber-400">₹{selectedRequest.denomination}</span></p>
                  <p className="text-sm text-gray-400">PRC Deducted: <span className="font-semibold text-purple-400">{selectedRequest.total_prc_deducted.toFixed(2)} PRC</span></p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-white">Voucher Code *</label>
                  <Input
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                    placeholder="Enter PhonePe voucher code"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-white">Admin Notes (Optional)</label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full border border-gray-700 rounded-lg bg-gray-800 text-white p-3 text-sm"
                    rows={3}
                    placeholder="Add any notes..."
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setSelectedRequest(null)} className="border-gray-600 text-white hover:bg-gray-800">
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleProcess(selectedRequest.request_id, 'reject')}
                    disabled={loading}
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleProcess(selectedRequest.request_id, 'approve')}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve & Provide Code
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminGiftVouchers;