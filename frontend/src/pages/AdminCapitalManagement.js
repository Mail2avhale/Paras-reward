import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Landmark, Plus, Edit2, Trash2, RefreshCw, DollarSign, Users,
  Building2, Wallet, TrendingUp, TrendingDown, Calendar, Percent,
  CreditCard, CheckCircle, Clock, AlertCircle, X, ChevronDown
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const ENTRY_TYPES = [
  { id: 'director_capital', label: 'Director Capital', icon: Users, color: 'blue' },
  { id: 'partner_capital', label: 'Partner Capital', icon: Users, color: 'purple' },
  { id: 'personal_loan', label: 'Personal Loan (उधार)', icon: Wallet, color: 'orange' },
  { id: 'bank_loan', label: 'Bank Loan (कर्ज)', icon: Building2, color: 'red' }
];

const AdminCapitalManagement = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    entry_type: 'director_capital',
    amount: '',
    person_name: '',
    bank_name: '',
    interest_rate: '',
    entry_date: new Date().toISOString().split('T')[0],
    repayment_date: '',
    description: '',
    status: 'active'
  });
  
  // Repayment form
  const [repaymentData, setRepaymentData] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: '',
    description: ''
  });

  useEffect(() => {
    fetchEntries();
    fetchSummary();
  }, [currentPage, filterType, filterStatus]);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10
      });
      if (filterType) params.append('entry_type', filterType);
      if (filterStatus) params.append('status', filterStatus);
      
      const response = await axios.get(`${API}/api/admin/capital/entries?${params}`);
      setEntries(response.data.entries || []);
      setTotalPages(response.data.pages || 1);
      setSummary(response.data.summary);
    } catch (error) {
      toast.error('Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/capital/summary`);
      setSummary(response.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEntry) {
        await axios.put(`${API}/api/admin/capital/entries/${editingEntry.entry_id}`, formData);
        toast.success('Entry updated successfully');
      } else {
        await axios.post(`${API}/api/admin/capital/entries`, formData);
        toast.success('Entry created successfully');
      }
      setShowModal(false);
      resetForm();
      fetchEntries();
      fetchSummary();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save entry');
    }
  };

  const handleDelete = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    try {
      await axios.delete(`${API}/api/admin/capital/entries/${entryId}`);
      toast.success('Entry deleted successfully');
      fetchEntries();
      fetchSummary();
    } catch (error) {
      toast.error('Failed to delete entry');
    }
  };

  const handleRepayment = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/api/admin/capital/repayment`, {
        entry_id: selectedEntry.entry_id,
        ...repaymentData,
        amount: parseFloat(repaymentData.amount)
      });
      toast.success(`Repayment recorded! Remaining: ₹${response.data.remaining.toLocaleString()}`);
      setShowRepaymentModal(false);
      setRepaymentData({ amount: '', payment_date: new Date().toISOString().split('T')[0], payment_method: '', description: '' });
      fetchEntries();
      fetchSummary();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record repayment');
    }
  };

  const openEditModal = (entry) => {
    setEditingEntry(entry);
    setFormData({
      entry_type: entry.entry_type,
      amount: entry.amount,
      person_name: entry.person_name || '',
      bank_name: entry.bank_name || '',
      interest_rate: entry.interest_rate || '',
      entry_date: entry.entry_date?.split('T')[0] || '',
      repayment_date: entry.repayment_date?.split('T')[0] || '',
      description: entry.description || '',
      status: entry.status
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingEntry(null);
    setFormData({
      entry_type: 'director_capital',
      amount: '',
      person_name: '',
      bank_name: '',
      interest_rate: '',
      entry_date: new Date().toISOString().split('T')[0],
      repayment_date: '',
      description: '',
      status: 'active'
    });
  };

  const getTypeConfig = (type) => ENTRY_TYPES.find(t => t.id === type) || ENTRY_TYPES[0];
  
  const getStatusBadge = (status) => {
    const configs = {
      active: { color: 'bg-blue-100 text-blue-700', icon: Clock, label: 'Active' },
      partially_paid: { color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle, label: 'Partially Paid' },
      fully_paid: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Fully Paid' }
    };
    return configs[status] || configs.active;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen" data-testid="capital-management">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Landmark className="h-7 w-7 text-blue-600" />
            Capital & Liability Management
          </h1>
          <p className="text-gray-500 mt-1">भांडवल, कर्ज आणि देणे-घेणे व्यवस्थापन</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchEntries(); fetchSummary(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { resetForm(); setShowModal(true); }} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            New Entry
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 opacity-80" />
              <div>
                <p className="text-blue-100 text-sm">Total Capital (भांडवल)</p>
                <p className="text-2xl font-bold">₹{(summary.capital?.total || 0).toLocaleString()}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-orange-500 to-red-500 text-white">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-8 w-8 opacity-80" />
              <div>
                <p className="text-orange-100 text-sm">Total Liabilities (कर्ज)</p>
                <p className="text-2xl font-bold">₹{(summary.liabilities?.total || 0).toLocaleString()}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-green-500 to-green-600 text-white">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 opacity-80" />
              <div>
                <p className="text-green-100 text-sm">Repaid (परत केले)</p>
                <p className="text-2xl font-bold">₹{(summary.liabilities?.repaid || 0).toLocaleString()}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <div className="flex items-center gap-3">
              <Wallet className="h-8 w-8 opacity-80" />
              <div>
                <p className="text-purple-100 text-sm">Net Position</p>
                <p className="text-2xl font-bold">₹{(summary.net_position || 0).toLocaleString()}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Pending Liabilities Alert */}
      {summary?.pending_by_source?.length > 0 && (
        <Card className="p-4 mb-6 bg-red-50 border-red-200">
          <h3 className="font-semibold text-red-800 flex items-center gap-2 mb-3">
            <AlertCircle className="h-5 w-5" />
            Pending Liabilities (देणे बाकी)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {summary.pending_by_source.map((item, idx) => (
              <div key={idx} className="bg-white p-3 rounded-lg border border-red-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{item.source}</p>
                    <p className="text-xs text-gray-500">{item.type === 'bank_loan' ? 'Bank Loan' : 'Personal Loan'}</p>
                  </div>
                  <span className="text-red-600 font-bold">₹{item.remaining.toLocaleString()}</span>
                </div>
                {item.repayment_date && (
                  <p className="text-xs text-gray-500 mt-1">Due: {new Date(item.repayment_date).toLocaleDateString()}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="text-sm text-gray-600 block mb-1">Entry Type</label>
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border rounded-lg text-sm min-w-[180px]"
            >
              <option value="">All Types</option>
              {ENTRY_TYPES.map(type => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border rounded-lg text-sm min-w-[150px]"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="fully_paid">Fully Paid</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Entries Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Source</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Amount</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Repaid</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Interest</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Date</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    No entries found
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const typeConfig = getTypeConfig(entry.entry_type);
                  const statusConfig = getStatusBadge(entry.status);
                  const StatusIcon = statusConfig.icon;
                  const TypeIcon = typeConfig.icon;
                  const remaining = entry.amount - (entry.total_repaid || 0);
                  
                  return (
                    <tr key={entry.entry_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <TypeIcon className={`h-4 w-4 text-${typeConfig.color}-500`} />
                          <span className="text-sm font-medium">{typeConfig.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {entry.person_name || entry.bank_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        ₹{entry.amount?.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {entry.entry_type.includes('loan') ? (
                          <span className={remaining > 0 ? 'text-orange-600' : 'text-green-600'}>
                            ₹{(entry.total_repaid || 0).toLocaleString()}
                            {remaining > 0 && <span className="text-gray-400 text-xs block">Pending: ₹{remaining.toLocaleString()}</span>}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {entry.interest_rate ? `${entry.interest_rate}%` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-500">
                        {entry.entry_date ? new Date(entry.entry_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {entry.entry_type.includes('loan') && entry.status !== 'fully_paid' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setSelectedEntry(entry); setShowRepaymentModal(true); }}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              title="Record Repayment"
                            >
                              <CreditCard className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(entry)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(entry.entry_id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">
                  {editingEntry ? 'Edit Entry' : 'New Capital/Liability Entry'}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Entry Type *</label>
                  <select
                    value={formData.entry_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, entry_type: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    {ENTRY_TYPES.map(type => (
                      <option key={type.id} value={type.id}>{type.label}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Amount (₹) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="Enter amount"
                    required
                  />
                </div>
                
                {formData.entry_type.includes('loan') && formData.entry_type !== 'bank_loan' && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Person Name</label>
                    <Input
                      value={formData.person_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, person_name: e.target.value }))}
                      placeholder="Enter person name"
                    />
                  </div>
                )}
                
                {formData.entry_type === 'bank_loan' && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Bank Name</label>
                    <Input
                      value={formData.bank_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, bank_name: e.target.value }))}
                      placeholder="Enter bank name"
                    />
                  </div>
                )}
                
                {(formData.entry_type === 'director_capital' || formData.entry_type === 'partner_capital') && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Name</label>
                    <Input
                      value={formData.person_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, person_name: e.target.value }))}
                      placeholder="Director/Partner name"
                    />
                  </div>
                )}
                
                {formData.entry_type.includes('loan') && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Interest Rate (%)</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.interest_rate}
                        onChange={(e) => setFormData(prev => ({ ...prev, interest_rate: e.target.value }))}
                        placeholder="e.g. 12"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Repayment Date</label>
                      <Input
                        type="date"
                        value={formData.repayment_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, repayment_date: e.target.value }))}
                      />
                    </div>
                  </>
                )}
                
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Entry Date *</label>
                  <Input
                    type="date"
                    value={formData.entry_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, entry_date: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg resize-none"
                    rows={3}
                    placeholder="Additional notes..."
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                    {editingEntry ? 'Update' : 'Create'} Entry
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}

      {/* Repayment Modal */}
      {showRepaymentModal && selectedEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Record Repayment</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowRepaymentModal(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg mb-4">
                <p className="text-sm text-gray-600">Loan from: <strong>{selectedEntry.person_name || selectedEntry.bank_name}</strong></p>
                <p className="text-sm text-gray-600">Total Amount: <strong>₹{selectedEntry.amount?.toLocaleString()}</strong></p>
                <p className="text-sm text-gray-600">Already Paid: <strong>₹{(selectedEntry.total_repaid || 0).toLocaleString()}</strong></p>
                <p className="text-sm font-semibold text-orange-600">
                  Remaining: ₹{(selectedEntry.amount - (selectedEntry.total_repaid || 0)).toLocaleString()}
                </p>
              </div>
              
              <form onSubmit={handleRepayment} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Repayment Amount (₹) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={repaymentData.amount}
                    onChange={(e) => setRepaymentData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="Enter amount"
                    required
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Payment Date *</label>
                  <Input
                    type="date"
                    value={repaymentData.payment_date}
                    onChange={(e) => setRepaymentData(prev => ({ ...prev, payment_date: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Payment Method</label>
                  <select
                    value={repaymentData.payment_method}
                    onChange={(e) => setRepaymentData(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Select method</option>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Notes</label>
                  <Input
                    value={repaymentData.description}
                    onChange={(e) => setRepaymentData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional notes"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowRepaymentModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700">
                    Record Repayment
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminCapitalManagement;
