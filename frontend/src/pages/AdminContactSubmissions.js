import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Mail, Search, Filter, Eye, Trash2, MessageSquare, 
  Check, Clock, X, RefreshCw, ChevronLeft, ChevronRight,
  User, Calendar, FileText
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminContactSubmissions = ({ user }) => {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, new: 0, read: 0, replied: 0 });
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchSubmissions();
    fetchStats();
  }, [user, statusFilter, page]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (statusFilter) params.append('status', statusFilter);
      
      const response = await axios.get(`${API}/admin/contact-submissions?${params}`);
      setSubmissions(response.data.submissions || []);
      setTotalPages(response.data.total_pages || 1);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/admin/contact-submissions/stats/summary`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleViewSubmission = async (submission) => {
    setSelectedSubmission(submission);
    setAdminNotes(submission.admin_notes || '');
    setShowModal(true);
    
    // Mark as read if new
    if (submission.status === 'new') {
      try {
        await axios.put(`${API}/admin/contact-submissions/${submission.submission_id}`, {
          status: 'read'
        });
        fetchSubmissions();
        fetchStats();
      } catch (error) {
        console.error('Error updating status:', error);
      }
    }
  };

  const handleUpdateStatus = async (submissionId, newStatus) => {
    try {
      await axios.put(`${API}/admin/contact-submissions/${submissionId}`, {
        status: newStatus,
        admin_notes: adminNotes
      });
      toast.success('Status updated');
      fetchSubmissions();
      fetchStats();
      setShowModal(false);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (submissionId) => {
    if (!window.confirm('Are you sure you want to delete this submission?')) return;
    
    try {
      await axios.delete(`${API}/admin/contact-submissions/${submissionId}`);
      toast.success('Submission deleted');
      fetchSubmissions();
      fetchStats();
      setShowModal(false);
    } catch (error) {
      toast.error('Failed to delete submission');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      read: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      replied: 'bg-green-500/20 text-green-400 border-green-500/30',
      closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.new}`}>
        {status?.toUpperCase() || 'NEW'}
      </span>
    );
  };

  const filteredSubmissions = submissions.filter(s => 
    searchTerm === '' || 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.subject?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Contact Submissions</h1>
            <p className="text-gray-400 text-sm">Manage messages from the Contact Us form</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <MessageSquare className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">New</p>
              <p className="text-2xl font-bold text-blue-400">{stats.new}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Read</p>
              <p className="text-2xl font-bold text-yellow-400">{stats.read}</p>
            </div>
            <Eye className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Replied</p>
              <p className="text-2xl font-bold text-green-400">{stats.replied}</p>
            </div>
            <Check className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search by name, email, or subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            />
          </div>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-purple-500 focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="new">New</option>
          <option value="read">Read</option>
          <option value="replied">Replied</option>
          <option value="closed">Closed</option>
        </select>
        <button
          onClick={() => { fetchSubmissions(); fetchStats(); }}
          className="px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-5 h-5" />
          Refresh
        </button>
      </div>

      {/* Submissions List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="text-center py-12 bg-gray-900 rounded-xl border border-gray-800">
          <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No contact submissions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSubmissions.map((submission) => (
            <div
              key={submission.submission_id}
              onClick={() => handleViewSubmission(submission)}
              className={`bg-gray-900 rounded-xl p-4 border cursor-pointer transition-all hover:border-purple-500/50 ${
                submission.status === 'new' ? 'border-blue-500/50' : 'border-gray-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{submission.name}</h3>
                      <p className="text-sm text-gray-400">{submission.email}</p>
                    </div>
                  </div>
                  <p className="font-medium text-gray-300 mb-1">{submission.subject || 'No Subject'}</p>
                  <p className="text-sm text-gray-500 line-clamp-2">{submission.message}</p>
                </div>
                <div className="flex flex-col items-end gap-2 ml-4">
                  {getStatusBadge(submission.status)}
                  <span className="text-xs text-gray-500">
                    {new Date(submission.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white disabled:opacity-50 hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <span className="text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white disabled:opacity-50 hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {showModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{selectedSubmission.name}</h2>
                    <p className="text-gray-400">{selectedSubmission.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Subject */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-1 block">Subject</label>
                <p className="bg-gray-800 rounded-lg p-3 text-white">
                  {selectedSubmission.subject || 'No Subject'}
                </p>
              </div>

              {/* Message */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-1 block">Message</label>
                <p className="bg-gray-800 rounded-lg p-4 text-white whitespace-pre-wrap">
                  {selectedSubmission.message}
                </p>
              </div>

              {/* Status & Date */}
              <div className="flex items-center gap-4 mb-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Status</label>
                  {getStatusBadge(selectedSubmission.status)}
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Received</label>
                  <p className="text-white">
                    {new Date(selectedSubmission.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Admin Notes */}
              <div className="mb-6">
                <label className="text-sm text-gray-400 mb-1 block">Admin Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add internal notes..."
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleUpdateStatus(selectedSubmission.submission_id, 'replied')}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Mark as Replied
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedSubmission.submission_id, 'closed')}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Close
                </button>
                <button
                  onClick={() => handleDelete(selectedSubmission.submission_id)}
                  className="py-3 px-4 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 border border-red-600/30"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Reply via Email */}
              <div className="mt-4 pt-4 border-t border-gray-800">
                <a
                  href={`mailto:${selectedSubmission.email}?subject=Re: ${selectedSubmission.subject || 'Your inquiry'}`}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Mail className="w-5 h-5" />
                  Reply via Email
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminContactSubmissions;
