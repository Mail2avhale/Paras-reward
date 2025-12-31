import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Pagination from '@/components/Pagination';
import {
  FileText, Search, CheckCircle, XCircle, Clock, User,
  Eye, Download, AlertCircle, Filter, RefreshCw
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const ITEMS_PER_PAGE = 10;

const AdminKYC = ({ user }) => {
  const [kycDocuments, setKycDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchKYCDocuments();
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const fetchKYCDocuments = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/kyc/list`);
      setKycDocuments(response.data || []);
    } catch (error) {
      console.error('Error fetching KYC documents:', error);
      toast.error('Failed to fetch KYC documents');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (kycId, action) => {
    try {
      setProcessing(true);
      await axios.post(`${API}/kyc/${kycId}/verify`, {
        action,
        admin_id: user?.uid,
        note: action === 'approve' ? 'KYC verified by admin' : 'KYC rejected by admin'
      });
      toast.success(`KYC ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      setSelectedDoc(null);
      fetchKYCDocuments();
    } catch (error) {
      console.error('Error processing KYC:', error);
      toast.error('Failed to process KYC');
    } finally {
      setProcessing(false);
    }
  };

  const filteredDocs = kycDocuments.filter(doc => {
    const matchesSearch = 
      doc.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.aadhaar_number?.includes(searchTerm) ||
      doc.pan_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredDocs.length / ITEMS_PER_PAGE);
  const paginatedDocs = filteredDocs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getStatusBadge = (status) => {
    switch (status) {
      case 'verified':
        return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Verified</span>;
      case 'rejected':
        return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full flex items-center gap-1"><XCircle className="h-3 w-3" /> Rejected</span>;
      default:
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</span>;
    }
  };

  const stats = {
    total: kycDocuments.length,
    pending: kycDocuments.filter(d => d.status === 'pending').length,
    verified: kycDocuments.filter(d => d.status === 'verified').length,
    rejected: kycDocuments.filter(d => d.status === 'rejected').length
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">KYC Verification</h1>
        <p className="text-gray-500">Review and verify user KYC documents</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-600">Total Submissions</p>
          <p className="text-2xl font-bold text-blue-700">{stats.total}</p>
        </Card>
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <p className="text-xs text-yellow-600">Pending Review</p>
          <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
        </Card>
        <Card className="p-4 bg-green-50 border-green-200">
          <p className="text-xs text-green-600">Verified</p>
          <p className="text-2xl font-bold text-green-700">{stats.verified}</p>
        </Card>
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-xs text-red-600">Rejected</p>
          <p className="text-2xl font-bold text-red-700">{stats.rejected}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by user ID, Aadhaar or PAN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
          <Button onClick={fetchKYCDocuments} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </Card>

      {/* Documents List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading KYC documents...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No KYC documents found</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4">
            {paginatedDocs.map((doc) => (
              <Card key={doc.kyc_id} className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <User className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{doc.user_id}</p>
                    <p className="text-sm text-gray-500">
                      {doc.document_type === 'aadhaar' ? `Aadhaar: ${doc.aadhaar_number}` : `PAN: ${doc.pan_number}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Submitted: {new Date(doc.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(doc.status)}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <Eye className="h-4 w-4 mr-1" /> View
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          </div>
          
          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredDocs.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      {/* Document Detail Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">KYC Document Details</h2>
                <button onClick={() => setSelectedDoc(null)} className="text-gray-500 hover:text-gray-700">
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">User ID</p>
                    <p className="font-medium">{selectedDoc.user_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    {getStatusBadge(selectedDoc.status)}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Document Type</p>
                    <p className="font-medium capitalize">{selectedDoc.document_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Submitted</p>
                    <p className="font-medium">{new Date(selectedDoc.submitted_at).toLocaleString()}</p>
                  </div>
                </div>

                {selectedDoc.document_type === 'aadhaar' && (
                  <>
                    <div>
                      <p className="text-sm text-gray-500 mb-2">Aadhaar Number</p>
                      <p className="font-mono bg-gray-100 p-2 rounded">{selectedDoc.aadhaar_number}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedDoc.aadhaar_front && (
                        <div>
                          <p className="text-sm text-gray-500 mb-2">Aadhaar Front</p>
                          <img src={selectedDoc.aadhaar_front} alt="Aadhaar Front" className="w-full rounded-lg border" />
                        </div>
                      )}
                      {selectedDoc.aadhaar_back && (
                        <div>
                          <p className="text-sm text-gray-500 mb-2">Aadhaar Back</p>
                          <img src={selectedDoc.aadhaar_back} alt="Aadhaar Back" className="w-full rounded-lg border" />
                        </div>
                      )}
                    </div>
                  </>
                )}

                {selectedDoc.document_type === 'pan' && (
                  <>
                    <div>
                      <p className="text-sm text-gray-500 mb-2">PAN Number</p>
                      <p className="font-mono bg-gray-100 p-2 rounded">{selectedDoc.pan_number}</p>
                    </div>
                    {selectedDoc.pan_front && (
                      <div>
                        <p className="text-sm text-gray-500 mb-2">PAN Card</p>
                        <img src={selectedDoc.pan_front} alt="PAN Card" className="w-full max-w-sm rounded-lg border" />
                      </div>
                    )}
                  </>
                )}

                {selectedDoc.status === 'pending' && (
                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      onClick={() => handleVerify(selectedDoc.kyc_id, 'approve')}
                      disabled={processing}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" /> Approve
                    </Button>
                    <Button
                      onClick={() => handleVerify(selectedDoc.kyc_id, 'reject')}
                      disabled={processing}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminKYC;
