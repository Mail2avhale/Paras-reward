import { useEffect, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/manager/StatusBadge';
import notifications from '@/utils/notifications';
import { 
  Users, Search, Filter, CheckCircle, XCircle, 
  Eye, FileText, Mail, Phone, Calendar, Crown
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ManagerUsers = ({ user, onLogout }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState(searchParams.get('kyc') || '');
  const [membershipFilter, setMembershipFilter] = useState('');
  const [skip, setSkip] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const limit = 50;

  useEffect(() => {
    fetchUsers();
  }, [search, kycFilter, membershipFilter, skip]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {
        uid: user.uid,
        skip,
        limit
      };
      if (search) params.search = search;
      if (kycFilter) params.kyc_status = kycFilter;
      if (membershipFilter) params.membership_type = membershipFilter;

      const response = await axios.get(`${API}/manager/users`, { params });
      setUsers(response.data.users);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Error fetching users:', error);
      notifications.error('Error', 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const approveKYC = async (userId) => {
    try {
      await axios.put(`${API}/manager/kyc/approve`, null, {
        params: { uid: user.uid, user_id: userId }
      });
      
      notifications.celebrate(
        '✅ KYC Approved!',
        'User KYC has been verified successfully. They can now make withdrawals.'
      );
      
      fetchUsers();
      setShowUserModal(false);
    } catch (error) {
      notifications.error(
        'Approval Failed',
        error.response?.data?.detail || 'Failed to approve KYC'
      );
    }
  };

  const rejectKYC = async () => {
    if (!rejectionReason.trim()) {
      notifications.warning('Reason Required', 'Please provide a reason for rejection');
      return;
    }

    try {
      await axios.put(
        `${API}/manager/kyc/reject`,
        { reason: rejectionReason },
        { params: { uid: user.uid, user_id: selectedUser.uid } }
      );
      
      notifications.success(
        'KYC Rejected',
        'User has been notified about the rejection and can resubmit documents.'
      );
      
      setRejectionReason('');
      setShowRejectModal(false);
      setShowUserModal(false);
      fetchUsers();
    } catch (error) {
      notifications.error(
        'Rejection Failed',
        error.response?.data?.detail || 'Failed to reject KYC'
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">User Management</h1>
          <p className="text-gray-600">Manage users, approve KYC, and monitor activity</p>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, mobile, or UID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* KYC Filter */}
            <select
              value={kycFilter}
              onChange={(e) => setKycFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">All KYC Status</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="not_submitted">Not Submitted</option>
            </select>

            {/* Membership Filter */}
            <select
              value={membershipFilter}
              onChange={(e) => setMembershipFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">All Membership</option>
              <option value="vip">VIP</option>
              <option value="free">Free</option>
            </select>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {skip + 1} - {Math.min(skip + limit, total)} of {total} users
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => setSkip(Math.max(0, skip - limit))}
                disabled={skip === 0}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              <Button
                onClick={() => setSkip(skip + limit)}
                disabled={skip + limit >= total}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
            </div>
          </div>
        </Card>

        {/* Users Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Membership</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">KYC Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                        <span className="ml-3 text-gray-600">Loading users...</span>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                      <p>No users found</p>
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.uid} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <Users className="h-5 w-5 text-purple-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{u.name}</div>
                            <div className="text-sm text-gray-500">UID: {u.uid}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {u.email}
                        </div>
                        {u.mobile && (
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {u.mobile}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge 
                          status={u.membership_type || 'free'} 
                          type="membership" 
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge 
                          status={u.kyc_status || 'not_submitted'} 
                          type="kyc" 
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedUser(u);
                            setShowUserModal(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* User Detail Modal */}
        <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>User Details</DialogTitle>
              <DialogDescription>View user information and manage KYC</DialogDescription>
            </DialogHeader>
            
            {selectedUser && (
              <div className="space-y-6">
                {/* User Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Name</label>
                    <p className="text-gray-900">{selectedUser.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Email</label>
                    <p className="text-gray-900">{selectedUser.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Mobile</label>
                    <p className="text-gray-900">{selectedUser.mobile || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Membership</label>
                    <div className="mt-1">
                      <StatusBadge status={selectedUser.membership_type || 'free'} type="membership" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">KYC Status</label>
                    <div className="mt-1">
                      <StatusBadge status={selectedUser.kyc_status || 'not_submitted'} type="kyc" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Joined Date</label>
                    <p className="text-gray-900">
                      {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* KYC Documents */}
                {(selectedUser.aadhaar_front_base64 || selectedUser.aadhaar_back_base64 || selectedUser.pan_front_base64) && (
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4">KYC Documents</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedUser.aadhaar_front_base64 && (
                        <div>
                          <label className="text-sm font-medium text-gray-600 mb-2 block">Aadhaar Front</label>
                          <img 
                            src={selectedUser.aadhaar_front_base64} 
                            alt="Aadhaar Front" 
                            className="w-full border rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(selectedUser.aadhaar_front_base64, '_blank')}
                          />
                          <p className="text-xs text-gray-500 mt-1">Click to view full size</p>
                        </div>
                      )}
                      {selectedUser.aadhaar_back_base64 && (
                        <div>
                          <label className="text-sm font-medium text-gray-600 mb-2 block">Aadhaar Back</label>
                          <img 
                            src={selectedUser.aadhaar_back_base64} 
                            alt="Aadhaar Back" 
                            className="w-full border rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(selectedUser.aadhaar_back_base64, '_blank')}
                          />
                          <p className="text-xs text-gray-500 mt-1">Click to view full size</p>
                        </div>
                      )}
                      {selectedUser.pan_front_base64 && (
                        <div>
                          <label className="text-sm font-medium text-gray-600 mb-2 block">PAN Card</label>
                          <img 
                            src={selectedUser.pan_front_base64} 
                            alt="PAN Card" 
                            className="w-full border rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(selectedUser.pan_front_base64, '_blank')}
                          />
                          <p className="text-xs text-gray-500 mt-1">Click to view full size</p>
                        </div>
                      )}
                    </div>

                    {selectedUser.kyc_status === 'pending' && (
                      <div className="flex gap-4 mt-6">
                        <Button
                          onClick={() => approveKYC(selectedUser.uid)}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve KYC
                        </Button>
                          className="flex-1 border-red-600 text-red-600 hover:bg-red-50"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject KYC
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject KYC Modal */}
        <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject KYC</DialogTitle>
              <DialogDescription>
                Please provide a reason for rejecting this KYC submission
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <Textarea
                placeholder="e.g., Documents are not clear, Information mismatch..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
              
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowRejectModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={rejectKYC}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  Confirm Rejection
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ManagerUsers;
