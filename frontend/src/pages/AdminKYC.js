import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Pagination from '@/components/Pagination';
import {
  FileText, Search, CheckCircle, XCircle, Clock, User,
  Eye, Download, AlertCircle, Filter, RefreshCw, Loader2,
  ChevronDown, ChevronUp, Image
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const ITEMS_PER_PAGE = 20;
const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds for faster updates

const AdminKYC = ({ user }) => {
  const [kycDocuments, setKycDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending'); // Default to pending
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);
  const [stats, setStats] = useState({ pending: 0, verified: 0, rejected: 0 });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Fetch KYC documents with server-side pagination
  const fetchKYCDocuments = useCallback(async (page = 1, status = statusFilter) => {
    try {
      setLoading(true);
      const statusParam = status !== 'all' ? `&status=${status}` : '';
      const response = await axios.get(`${API}/kyc/list?page=${page}&limit=${ITEMS_PER_PAGE}${statusParam}`);
      
      const data = response.data || {};
      const docs = data.documents || [];
      
      setKycDocuments(docs);
      setTotalPages(data.pages || 1);
      setTotalDocs(data.total || 0);
      
      // Update pending count from response
      if (data.pending_count !== undefined) {
        setStats(prev => ({ ...prev, pending: data.pending_count }));
      }
      
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching KYC documents:', error);
      toast.error('Failed to fetch KYC documents');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // Fetch stats separately (fast endpoint)
  const fetchStats = useCallback(async () => {
    try {
      const [pendingRes, verifiedRes, rejectedRes] = await Promise.all([
        axios.get(`${API}/kyc/list?status=pending&limit=1`),
        axios.get(`${API}/kyc/list?status=verified&limit=1`),
        axios.get(`${API}/kyc/list?status=rejected&limit=1`)
      ]);
      setStats({
        pending: pendingRes.data?.total || 0,
        verified: verifiedRes.data?.total || 0,
        rejected: rejectedRes.data?.total || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchKYCDocuments(1, statusFilter);
    fetchStats();
  }, [statusFilter]);

  // Handle page change
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    fetchKYCDocuments(newPage, statusFilter);
  };

  // Handle status filter change
  const handleStatusChange = (newStatus) => {
    setStatusFilter(newStatus);
    setCurrentPage(1);
  };

  // Auto-refresh for pending items
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchKYCDocuments(currentPage, statusFilter);
    }, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [autoRefresh, currentPage, statusFilter]);

  // Filter by search (client-side for current page)
  const filteredDocs = React.useMemo(() => {
    if (!searchTerm) return kycDocuments;
    
    const search = searchTerm.toLowerCase();
    return kycDocuments.filter(doc =>
      doc.user_id?.toLowerCase().includes(search) ||
      doc.aadhaar_number?.toLowerCase().includes(search) ||
      doc.pan_number?.toLowerCase().includes(search) ||
      doc.user_name?.toLowerCase().includes(search) ||
      doc.user_email?.toLowerCase().includes(search)
    );
  }, [kycDocuments, searchTerm]);

  // Quick action handlers
  const handleQuickApprove = async (doc, e) => {
    e.stopPropagation();
    if (processing) return; // Prevent multiple clicks
    if (!window.confirm(`Approve KYC for ${doc.user_name || doc.user_id}?`)) return;
    
    // Store kyc_id immediately before any async operations
    const kycId = doc.kyc_id;
    const userName = doc.user_name || doc.user_id;
    
    try {
      setProcessing(true);
      await axios.post(`${API}/kyc/${kycId}/verify`, {
        action: 'approve',
        admin_id: user?.uid
      });
      toast.success(`KYC Approved for ${userName}!`);
      
      // Optimistic local update instead of full refetch
      setKycDocuments(prev => prev.map(d => 
        d.kyc_id === kycId 
          ? {...d, status: 'verified', verified_at: new Date().toISOString()} 
          : d
      ));
      
      // Background refresh after delay
      setTimeout(() => fetchKYCDocuments(currentPage, statusFilter), 2000);
    } catch (error) {
      console.error('KYC approve error:', error);
      toast.error(error.response?.data?.detail || 'Failed to approve');
    } finally {
      setProcessing(false);
    }
  };

  const handleQuickReject = async (doc, e) => {
    e.stopPropagation();
    if (processing) return; // Prevent multiple clicks
    const reason = window.prompt('Rejection reason (optional):');
    if (reason === null) return; // User cancelled
    
    // Store kyc_id immediately before any async operations
    const kycId = doc.kyc_id;
    const userName = doc.user_name || doc.user_id;
    
    try {
      setProcessing(true);
      await axios.post(`${API}/kyc/${kycId}/verify`, {
        action: 'reject',
        admin_id: user?.uid,
        notes: reason
      });
      toast.success(`KYC Rejected for ${userName}`);
      
      // Optimistic local update instead of full refetch
      setKycDocuments(prev => prev.map(d => 
        d.kyc_id === kycId 
          ? {...d, status: 'rejected', verified_at: new Date().toISOString()} 
          : d
      ));
      
      // Background refresh after delay
      setTimeout(() => fetchKYCDocuments(currentPage, statusFilter), 2000);
    } catch (error) {
      console.error('KYC reject error:', error);
      toast.error(error.response?.data?.detail || 'Failed to reject');
    } finally {
      setProcessing(false);
    }
  };

  const handleVerify = async (kycId, action) => {
    if (processing) return; // Prevent multiple clicks
    
    try {
      setProcessing(true);
      await axios.post(`${API}/kyc/${kycId}/verify`, {
        action,
        admin_id: user?.uid
      });
      toast.success(`KYC ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      
      // Optimistic local update instead of full refetch (FASTER!)
      const newStatus = action === 'approve' ? 'verified' : 'rejected';
      setKycDocuments(prev => prev.map(doc => 
        doc.kyc_id === kycId 
          ? {...doc, status: newStatus, verified_at: new Date().toISOString()} 
          : doc
      ));
      
      setSelectedDoc(null);
      
      // Background refresh (non-blocking)
      setTimeout(() => {
        fetchKYCDocuments();
      }, 3000);
    } catch (error) {
      console.error('KYC verify error:', error);
      toast.error(error.response?.data?.detail || 'Failed to update KYC status');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      verified: 'bg-green-500/20 text-green-400 border-green-500/50',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/50'
    };
    return badges[status] || 'bg-gray-500/20 text-gray-400';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-4 md:p-6 bg-gray-950 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-400" />
            KYC Verification
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={fetchKYCDocuments}
            variant="outline"
            size="sm"
            disabled={loading}
            className="border-gray-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-600"
            />
            Auto-refresh
          </label>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card 
          className={`p-4 cursor-pointer transition-all ${statusFilter === 'pending' ? 'ring-2 ring-yellow-500' : ''} bg-yellow-500/10 border-yellow-500/30`}
          onClick={() => handleStatusChange('pending')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-400 text-sm font-medium">Pending</p>
              <p className="text-3xl font-bold text-yellow-300">{stats.pending}</p>
            </div>
            <Clock className="w-10 h-10 text-yellow-500/50" />
          </div>
        </Card>
        <Card 
          className={`p-4 cursor-pointer transition-all ${statusFilter === 'verified' ? 'ring-2 ring-green-500' : ''} bg-green-500/10 border-green-500/30`}
          onClick={() => handleStatusChange('verified')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-400 text-sm font-medium">Verified</p>
              <p className="text-3xl font-bold text-green-300">{stats.verified}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-500/50" />
          </div>
        </Card>
        <Card 
          className={`p-4 cursor-pointer transition-all ${statusFilter === 'rejected' ? 'ring-2 ring-red-500' : ''} bg-red-500/10 border-red-500/30`}
          onClick={() => handleStatusChange('rejected')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-400 text-sm font-medium">Rejected</p>
              <p className="text-3xl font-bold text-red-300">{stats.rejected}</p>
            </div>
            <XCircle className="w-10 h-10 text-red-500/50" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6 bg-gray-900 border-gray-800">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search by name, email, Aadhaar, PAN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'pending', 'verified', 'rejected'].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className={statusFilter === status ? 'bg-blue-600' : 'border-gray-700 text-gray-300'}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          Showing {paginatedDocs.length} of {sortedAndFilteredDocs.length} documents
        </div>
      </Card>

      {/* Documents List */}
      {loading && paginatedDocs.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : paginatedDocs.length === 0 ? (
        <Card className="p-12 text-center bg-gray-900 border-gray-800">
          <FileText className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">No KYC documents found</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {paginatedDocs.map((doc) => (
            <Card
              key={doc.kyc_id}
              className={`p-4 bg-gray-900 border-gray-800 hover:border-gray-700 transition-all cursor-pointer ${
                doc.status === 'pending' ? 'border-l-4 border-l-yellow-500' : ''
              }`}
              onClick={() => setSelectedDoc(doc)}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{doc.user_name || 'Unknown User'}</p>
                    <p className="text-sm text-gray-400">{doc.user_email || doc.user_id}</p>
                    <div className="flex gap-4 mt-1 text-xs text-gray-500">
                      {doc.aadhaar_number && <span>Aadhaar: •••• {doc.aadhaar_number.slice(-4)}</span>}
                      {doc.pan_number && <span>PAN: {doc.pan_number}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(doc.status)}`}>
                    {doc.status?.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDate(doc.submitted_at)}
                  </span>
                  
                  {/* Quick Actions for Pending */}
                  {doc.status === 'pending' && (
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 h-8"
                        onClick={(e) => handleQuickApprove(doc, e)}
                        disabled={processing}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8"
                        onClick={(e) => handleQuickReject(doc, e)}
                        disabled={processing}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  
                  <Button size="sm" variant="ghost" className="text-gray-400">
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Document Detail Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedDoc(null)}>
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">KYC Document Details</h2>
                <Button variant="ghost" size="sm" onClick={() => setSelectedDoc(null)}>
                  <XCircle className="w-5 h-5" />
                </Button>
              </div>

              {/* User Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-gray-500 text-sm">Name</p>
                  <p className="text-white font-medium">{selectedDoc.user_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Email</p>
                  <p className="text-white font-medium">{selectedDoc.user_email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Mobile</p>
                  <p className="text-white font-medium">{selectedDoc.user_mobile || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(selectedDoc.status)}`}>
                    {selectedDoc.status?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Aadhaar Number</p>
                  <p className="text-white font-medium">{selectedDoc.aadhaar_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">PAN Number</p>
                  <p className="text-white font-medium">{selectedDoc.pan_number || 'N/A'}</p>
                </div>
              </div>

              {/* Documents */}
              <div className="space-y-4 mb-6">
                <h3 className="text-lg font-medium text-white">Documents</h3>
                <div className="grid grid-cols-2 gap-4">
                  {selectedDoc.aadhaar_front && (
                    <div>
                      <p className="text-gray-500 text-sm mb-2">Aadhaar Front</p>
                      <img 
                        src={selectedDoc.aadhaar_front} 
                        alt="Aadhaar Front" 
                        className="w-full rounded-lg border border-gray-700"
                      />
                    </div>
                  )}
                  {selectedDoc.aadhaar_back && (
                    <div>
                      <p className="text-gray-500 text-sm mb-2">Aadhaar Back</p>
                      <img 
                        src={selectedDoc.aadhaar_back} 
                        alt="Aadhaar Back" 
                        className="w-full rounded-lg border border-gray-700"
                      />
                    </div>
                  )}
                  {selectedDoc.pan_front && (
                    <div>
                      <p className="text-gray-500 text-sm mb-2">PAN Card</p>
                      <img 
                        src={selectedDoc.pan_front} 
                        alt="PAN Card" 
                        className="w-full rounded-lg border border-gray-700"
                      />
                    </div>
                  )}
                </div>
                {!selectedDoc.aadhaar_front && !selectedDoc.aadhaar_back && !selectedDoc.pan_front && (
                  <div className="text-center py-8 bg-gray-800 rounded-lg">
                    <Image className="w-12 h-12 mx-auto text-gray-600 mb-2" />
                    <p className="text-gray-500">No document images available</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {selectedDoc.status === 'pending' && (
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleVerify(selectedDoc.kyc_id, 'approve')}
                    disabled={processing}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    Approve KYC
                  </Button>
                  <Button
                    onClick={() => handleVerify(selectedDoc.kyc_id, 'reject')}
                    disabled={processing}
                    variant="destructive"
                    className="flex-1"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                    Reject KYC
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminKYC;
