import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { DollarSign, Plus, Edit, TrendingUp, Calendar } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const FinancialManagementAdmin = () => {
  const [activeTab, setActiveTab] = useState('deposits');
  const [stockists, setStockists] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [renewals, setRenewals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [showEditDepositModal, setShowEditDepositModal] = useState(false);
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  
  const [depositForm, setDepositForm] = useState({
    user_id: '',
    amount: '',
    monthly_return_rate: '0.03',
    notes: ''
  });

  const [renewalForm, setRenewalForm] = useState({
    user_id: '',
    amount: '',
    gst_rate: '0.18',
    notes: ''
  });

  useEffect(() => {
    fetchStockists();
    fetchDeposits();
    fetchRenewals();
  }, []);

  const fetchStockists = async () => {
    try {
      const response = await axios.get(`${API}/admin/stockists`);
      setStockists(response.data.stockists || []);
    } catch (error) {
      console.error('Error fetching stockists:', error);
    }
  };

  const fetchDeposits = async () => {
    try {
      const response = await axios.get(`${API}/admin/security-deposits`);
      setDeposits(response.data.deposits || []);
    } catch (error) {
      console.error('Error fetching deposits:', error);
    }
  };

  const fetchRenewals = async () => {
    try {
      const response = await axios.get(`${API}/admin/renewals`);
      setRenewals(response.data.renewals || []);
    } catch (error) {
      console.error('Error fetching renewals:', error);
    }
  };

  const handleCreateDeposit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API}/admin/security-deposit/manual-entry`, {
        user_id: depositForm.user_id,
        amount: parseFloat(depositForm.amount),
        monthly_return_rate: parseFloat(depositForm.monthly_return_rate),
        notes: depositForm.notes
      });
      
      toast.success('Security deposit entry created successfully!');
      setShowDepositModal(false);
      setDepositForm({ user_id: '', amount: '', monthly_return_rate: '0.03', notes: '' });
      fetchDeposits();
      fetchStockists();
    } catch (error) {
      console.error('Error creating deposit:', error);
      toast.error(error.response?.data?.detail || 'Failed to create deposit entry');
    } finally {
      setLoading(false);
    }
  };

  const handleEditDeposit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.put(`${API}/admin/security-deposit/${selectedDeposit.deposit_id}/edit`, {
        amount: parseFloat(depositForm.amount),
        monthly_return_rate: parseFloat(depositForm.monthly_return_rate),
        balance_pending: parseFloat(depositForm.balance_pending || depositForm.amount),
        notes: depositForm.notes
      });
      
      toast.success('Security deposit updated successfully!');
      setShowEditDepositModal(false);
      fetchDeposits();
    } catch (error) {
      console.error('Error updating deposit:', error);
      toast.error(error.response?.data?.detail || 'Failed to update deposit');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRenewal = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API}/admin/renewal/manual-entry`, {
        user_id: renewalForm.user_id,
        amount: parseFloat(renewalForm.amount),
        gst_rate: parseFloat(renewalForm.gst_rate),
        notes: renewalForm.notes
      });
      
      toast.success('Renewal entry created successfully!');
      setShowRenewalModal(false);
      setRenewalForm({ user_id: '', amount: '', gst_rate: '0.18', notes: '' });
      fetchRenewals();
      fetchStockists();
    } catch (error) {
      console.error('Error creating renewal:', error);
      toast.error(error.response?.data?.detail || 'Failed to create renewal entry');
    } finally {
      setLoading(false);
    }
  };

  const openEditDeposit = (deposit) => {
    setSelectedDeposit(deposit);
    setDepositForm({
      amount: (deposit.amount || 0).toString(),
      monthly_return_rate: (deposit.monthly_return_rate || 0.03).toString(),
      balance_pending: (deposit.balance_pending || deposit.amount || 0).toString(),
      notes: deposit.notes || ''
    });
    setShowEditDepositModal(true);
  };

  const formatCurrency = (amount) => {
    // Handle null, undefined, or NaN values
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) {
      return '₹0';
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(numericAmount);
  };

  // Helper function to calculate monthly return if missing
  const getMonthlyReturn = (deposit) => {
    if (deposit.monthly_return_amount !== undefined && deposit.monthly_return_amount !== null) {
      return deposit.monthly_return_amount;
    }
    // Calculate from amount and rate
    const amount = parseFloat(deposit.amount) || 0;
    const rate = parseFloat(deposit.monthly_return_rate) || 0.03;
    return amount * rate;
  };

  // Helper function to calculate balance pending if missing
  const getBalancePending = (deposit) => {
    if (deposit.balance_pending !== undefined && deposit.balance_pending !== null) {
      return deposit.balance_pending;
    }
    // Calculate from amount - total_returned
    const amount = parseFloat(deposit.amount) || 0;
    const returned = parseFloat(deposit.total_returned || deposit.total_returns_paid) || 0;
    return amount - returned;
  };

  // Helper function to get GST amount
  const getGSTAmount = (renewal) => {
    if (renewal.gst_amount !== undefined && renewal.gst_amount !== null) {
      return renewal.gst_amount;
    }
    // Calculate from base_amount and gst_rate
    const baseAmount = parseFloat(renewal.base_amount || renewal.amount) || 0;
    const gstRate = parseFloat(renewal.gst_rate) || 0.18;
    return baseAmount * gstRate;
  };

  // Helper function to get total amount
  const getTotalAmount = (renewal) => {
    if (renewal.total_amount !== undefined && renewal.total_amount !== null) {
      return renewal.total_amount;
    }
    // Calculate from base_amount + gst_amount
    const baseAmount = parseFloat(renewal.base_amount || renewal.amount) || 0;
    const gstAmount = getGSTAmount(renewal);
    return baseAmount + gstAmount;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Financial Management</h2>
          <p className="text-gray-600">Manage security deposits and renewal fees</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('deposits')}
            className={`px-4 py-2 border-b-2 font-medium ${
              activeTab === 'deposits'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <DollarSign className="inline h-4 w-4 mr-2" />
            Security Deposits
          </button>
          <button
            onClick={() => setActiveTab('renewals')}
            className={`px-4 py-2 border-b-2 font-medium ${
              activeTab === 'renewals'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Calendar className="inline h-4 w-4 mr-2" />
            Annual Renewals
          </button>
        </div>
      </div>

      {/* Security Deposits Tab */}
      {activeTab === 'deposits' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setShowDepositModal(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Security Deposit
            </Button>
          </div>

          {deposits.length === 0 ? (
            <Card className="p-12 text-center">
              <DollarSign className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Security Deposits</h3>
              <p className="text-gray-600">Create security deposit entries for stockists</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount Taken</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Return</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Returned</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance Pending</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {deposits.map((deposit) => (
                      <tr key={deposit.deposit_id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{deposit.user_name}</div>
                          {deposit.notes && (
                            <div className="text-xs text-gray-500 truncate max-w-xs">{deposit.notes}</div>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-700">
                            {deposit.user_role?.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <div className="font-semibold text-gray-900">{formatCurrency(deposit.amount)}</div>
                          <div className="text-xs text-gray-500">{new Date(deposit.created_at).toLocaleDateString()}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <div className="font-semibold text-green-600">{formatCurrency(getMonthlyReturn(deposit))}</div>
                          <div className="text-xs text-gray-500">({((deposit.monthly_return_rate || 0.03) * 100).toFixed(1)}%)</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <div className="font-semibold text-blue-600">{formatCurrency(deposit.total_returned || deposit.total_returns_paid || 0)}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <div className="font-semibold text-orange-600">{formatCurrency(getBalancePending(deposit))}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDeposit(deposit)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Annual Renewals Tab */}
      {activeTab === 'renewals' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setShowRenewalModal(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Renewal Entry
            </Button>
          </div>

          {renewals.length === 0 ? (
            <Card className="p-12 text-center">
              <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Renewal Entries</h3>
              <p className="text-gray-600">Create renewal fee entries for stockists</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Base Amount</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">GST</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valid Until</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {renewals.map((renewal) => (
                      <tr key={renewal.renewal_id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{renewal.user_name}</div>
                          {renewal.notes && (
                            <div className="text-xs text-gray-500 truncate max-w-xs">{renewal.notes}</div>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                            {renewal.user_role?.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <div className="font-semibold text-gray-900">{formatCurrency(renewal.base_amount || renewal.amount || 0)}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <div className="font-semibold text-gray-700">{formatCurrency(getGSTAmount(renewal))}</div>
                          <div className="text-xs text-gray-500">({((renewal.gst_rate || 0.18) * 100)}%)</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <div className="font-bold text-purple-600">{formatCurrency(getTotalAmount(renewal))}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-700">{new Date(renewal.renewal_end_date).toLocaleDateString()}</div>
                          <div className="text-xs text-gray-500">Created: {new Date(renewal.created_at).toLocaleDateString()}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                            {renewal.status?.toUpperCase() || 'ACTIVE'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Create Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Security Deposit Entry</h2>
            <form onSubmit={handleCreateDeposit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Stockist *</label>
                <select
                  className="w-full border rounded p-2"
                  value={depositForm.user_id}
                  onChange={(e) => setDepositForm({...depositForm, user_id: e.target.value})}
                  required
                >
                  <option value="">-- Select Stockist --</option>
                  {stockists.filter(s => s.is_active).map(stockist => (
                    <option key={stockist.uid} value={stockist.uid}>
                      {stockist.name} ({stockist.role.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={depositForm.amount}
                  onChange={(e) => setDepositForm({...depositForm, amount: e.target.value})}
                  placeholder="500000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Suggested: Master-₹500k, Sub-₹300k, Outlet-₹100k
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Return Rate (%) *</label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={depositForm.monthly_return_rate ? (parseFloat(depositForm.monthly_return_rate) * 100).toFixed(2) : '3'}
                  onChange={(e) => setDepositForm({...depositForm, monthly_return_rate: (parseFloat(e.target.value || 0) / 100).toString()})}
                  placeholder="3"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Monthly return: ₹{(depositForm.amount && depositForm.monthly_return_rate) ? (parseFloat(depositForm.amount) * parseFloat(depositForm.monthly_return_rate)).toLocaleString('en-IN') : '0'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  className="w-full border rounded p-2"
                  rows="3"
                  value={depositForm.notes}
                  onChange={(e) => setDepositForm({...depositForm, notes: e.target.value})}
                  placeholder="Optional notes..."
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  {loading ? 'Creating...' : 'Create Entry'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Edit Deposit Modal */}
      {showEditDepositModal && selectedDeposit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Edit Security Deposit</h2>
            <form onSubmit={handleEditDeposit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={depositForm.amount}
                  onChange={(e) => setDepositForm({...depositForm, amount: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Return Rate (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={depositForm.monthly_return_rate ? (parseFloat(depositForm.monthly_return_rate) * 100).toFixed(2) : '3'}
                  onChange={(e) => setDepositForm({...depositForm, monthly_return_rate: (parseFloat(e.target.value || 0) / 100).toString()})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Balance Pending (₹)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={depositForm.balance_pending}
                  onChange={(e) => setDepositForm({...depositForm, balance_pending: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  className="w-full border rounded p-2"
                  rows="3"
                  value={depositForm.notes}
                  onChange={(e) => setDepositForm({...depositForm, notes: e.target.value})}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => setShowEditDepositModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? 'Updating...' : 'Update'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Create Renewal Modal */}
      {showRenewalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Renewal Entry</h2>
            <form onSubmit={handleCreateRenewal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Stockist *</label>
                <select
                  className="w-full border rounded p-2"
                  value={renewalForm.user_id}
                  onChange={(e) => setRenewalForm({...renewalForm, user_id: e.target.value})}
                  required
                >
                  <option value="">-- Select Stockist --</option>
                  {stockists.filter(s => s.is_active).map(stockist => (
                    <option key={stockist.uid} value={stockist.uid}>
                      {stockist.name} ({stockist.role.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Amount (₹) *</label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={renewalForm.amount}
                  onChange={(e) => setRenewalForm({...renewalForm, amount: e.target.value})}
                  placeholder="50000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Suggested: Master-₹50k, Sub-₹30k, Outlet-₹10k
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST Rate (%) *</label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={renewalForm.gst_rate ? (parseFloat(renewalForm.gst_rate) * 100).toFixed(2) : '18'}
                  onChange={(e) => setRenewalForm({...renewalForm, gst_rate: (parseFloat(e.target.value || 0) / 100).toString()})}
                  placeholder="18"
                />
                {renewalForm.amount && renewalForm.gst_rate && (
                  <p className="text-xs text-gray-500 mt-1">
                    GST: ₹{(parseFloat(renewalForm.amount) * parseFloat(renewalForm.gst_rate)).toLocaleString('en-IN')} | 
                    Total: ₹{(parseFloat(renewalForm.amount) * (1 + parseFloat(renewalForm.gst_rate))).toLocaleString('en-IN')}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  className="w-full border rounded p-2"
                  rows="3"
                  value={renewalForm.notes}
                  onChange={(e) => setRenewalForm({...renewalForm, notes: e.target.value})}
                  placeholder="Optional notes..."
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => setShowRenewalModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  {loading ? 'Creating...' : 'Create Entry'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default FinancialManagementAdmin;
