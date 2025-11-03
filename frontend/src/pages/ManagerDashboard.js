import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, CreditCard, Truck, HeadphonesIcon,
  CheckCircle, XCircle, TrendingUp, Package, Users
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ManagerDashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [vipPayments, setVipPayments] = useState([]);
  const [kycDocuments, setKycDocuments] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [supportTickets, setSupportTickets] = useState([]);

  useEffect(() => {
    fetchManagerStats();
    fetchVIPPayments();
    fetchKYCDocuments();
    fetchStockMovements();
    fetchSupportTickets();
  }, []);

  const fetchManagerStats = async () => {
    try {
      const response = await axios.get(`${API}/admin/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchVIPPayments = async () => {
    try {
      const response = await axios.get(`${API}/membership/payments`);
      setVipPayments(response.data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  const fetchKYCDocuments = async () => {
    try {
      const response = await axios.get(`${API}/kyc/list`);
      setKycDocuments(response.data);
    } catch (error) {
      console.error('Error fetching KYC:', error);
    }
  };

  const fetchStockMovements = async () => {
    try {
      const response = await axios.get(`${API}/admin/stock/movements`);
      setStockMovements(response.data || []);
    } catch (error) {
      console.error('Error fetching stock movements:', error);
    }
  };

  const fetchSupportTickets = async () => {
    try {
      const response = await axios.get(`${API}/support/tickets`);
      setSupportTickets(response.data || []);
    } catch (error) {
      console.error('Error fetching support tickets:', error);
    }
  };

  const handlePaymentAction = async (paymentId, action) => {
    try {
      await axios.post(`${API}/membership/payment/${paymentId}/action`, { action });
      toast.success(`Payment ${action}d successfully!`);
      fetchVIPPayments();
      fetchManagerStats();
    } catch (error) {
      console.error('Error handling payment:', error);
      toast.error('Action failed');
    }
  };

  const handleKYCAction = async (kycId, action) => {
    try {
      await axios.post(`${API}/kyc/${kycId}/verify`, { action });
      toast.success(`KYC ${action}d successfully!`);
      fetchKYCDocuments();
      fetchManagerStats();
    } catch (error) {
      console.error('Error handling KYC:', error);
      toast.error('Action failed');
    }
  };

  const handleStockMovementAction = async (movementId, action, notes = '') => {
    try {
      const endpoint = action === 'approve' 
        ? `${API}/admin/stock/movements/${movementId}/approve`
        : `${API}/admin/stock/movements/${movementId}/reject`;
      
      await axios.post(endpoint, { admin_notes: notes });
      toast.success(`Stock movement ${action}d successfully!`);
      fetchStockMovements();
      fetchManagerStats();
    } catch (error) {
      console.error('Error handling stock movement:', error);
      toast.error(error.response?.data?.detail || 'Action failed');
    }
  };

  const menuItems = [
    { id: 'overview', icon: TrendingUp, label: 'Overview' },
    { id: 'kyc', icon: FileText, label: 'KYC Verification' },
    { id: 'payments', icon: CreditCard, label: 'VIP Payments' },
    { id: 'stock', icon: Truck, label: 'Stock Movements' },
    { id: 'support', icon: HeadphonesIcon, label: 'Support Tickets' },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 fixed h-full">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">paras<br/>rewards</h1>
          <p className="text-sm text-purple-600 font-medium mt-2">Manager Portal</p>
        </div>
        
        <nav className="px-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 mb-1 rounded-lg transition-all ${
                  isActive 
                    ? 'bg-purple-600 text-white' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-64 p-4 border-t">
          <div className="text-sm text-gray-600 mb-2">
            <p className="font-semibold">{user?.name || 'Manager'}</p>
            <p className="text-xs">{user?.email}</p>
          </div>
          <Button variant="outline" onClick={onLogout} className="w-full">
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 flex-1">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <h2 className="text-3xl font-bold text-gray-900 capitalize">
            {activeTab === 'overview' ? 'Dashboard Overview' : menuItems.find(m => m.id === activeTab)?.label}
          </h2>
        </div>

        {/* Content Area */}
        <div className="p-8">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card className="p-6 bg-gradient-to-br from-yellow-50 to-yellow-100">
                  <div className="flex items-center justify-between mb-2">
                    <FileText className="h-8 w-8 text-yellow-600" />
                    <span className="text-xs font-semibold text-yellow-600 bg-yellow-200 px-2 py-1 rounded-full">
                      KYC
                    </span>
                  </div>
                  <div className="text-sm font-medium text-yellow-600 mb-1">Pending KYC</div>
                  <div className="text-2xl font-bold text-yellow-900">
                    {stats?.kyc?.pending || 0}
                  </div>
                  <div className="text-xs text-yellow-700 mt-2">
                    Verified: {stats?.kyc?.verified || 0}
                  </div>
                </Card>

                <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100">
                  <div className="flex items-center justify-between mb-2">
                    <CreditCard className="h-8 w-8 text-purple-600" />
                    <span className="text-xs font-semibold text-purple-600 bg-purple-200 px-2 py-1 rounded-full">
                      PAYMENTS
                    </span>
                  </div>
                  <div className="text-sm font-medium text-purple-600 mb-1">Pending VIP Payments</div>
                  <div className="text-2xl font-bold text-purple-900">
                    {stats?.vip_payments?.pending || 0}
                  </div>
                  <div className="text-xs text-purple-700 mt-2">
                    Approved: {stats?.vip_payments?.approved || 0}
                  </div>
                </Card>

                <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100">
                  <div className="flex items-center justify-between mb-2">
                    <Truck className="h-8 w-8 text-blue-600" />
                    <span className="text-xs font-semibold text-blue-600 bg-blue-200 px-2 py-1 rounded-full">
                      STOCK
                    </span>
                  </div>
                  <div className="text-sm font-medium text-blue-600 mb-1">Pending Stock Movements</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {stats?.stock_movements?.pending || 0}
                  </div>
                  <div className="text-xs text-blue-700 mt-2">
                    Completed: {stats?.stock_movements?.completed || 0}
                  </div>
                </Card>

                <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100">
                  <div className="flex items-center justify-between mb-2">
                    <HeadphonesIcon className="h-8 w-8 text-green-600" />
                    <span className="text-xs font-semibold text-green-600 bg-green-200 px-2 py-1 rounded-full">
                      SUPPORT
                    </span>
                  </div>
                  <div className="text-sm font-medium text-green-600 mb-1">Open Support Tickets</div>
                  <div className="text-2xl font-bold text-green-900">
                    {supportTickets.filter(t => t.status === 'open').length}
                  </div>
                  <div className="text-xs text-green-700 mt-2">
                    Total: {supportTickets.length}
                  </div>
                </Card>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Button
                    onClick={() => setActiveTab('kyc')}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white h-20"
                  >
                    <div className="text-center">
                      <FileText className="h-6 w-6 mx-auto mb-1" />
                      <div className="text-sm">Verify KYC</div>
                    </div>
                  </Button>
                  <Button
                    onClick={() => setActiveTab('payments')}
                    className="bg-purple-600 hover:bg-purple-700 text-white h-20"
                  >
                    <div className="text-center">
                      <CreditCard className="h-6 w-6 mx-auto mb-1" />
                      <div className="text-sm">Approve Payments</div>
                    </div>
                  </Button>
                  <Button
                    onClick={() => setActiveTab('stock')}
                    className="bg-blue-600 hover:bg-blue-700 text-white h-20"
                  >
                    <div className="text-center">
                      <Truck className="h-6 w-6 mx-auto mb-1" />
                      <div className="text-sm">Stock Movements</div>
                    </div>
                  </Button>
                  <Button
                    onClick={() => setActiveTab('support')}
                    className="bg-green-600 hover:bg-green-700 text-white h-20"
                  >
                    <div className="text-center">
                      <HeadphonesIcon className="h-6 w-6 mx-auto mb-1" />
                      <div className="text-sm">View Support</div>
                    </div>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* KYC Verification Tab */}
          {activeTab === 'kyc' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">KYC Document Verification</h2>
              {kycDocuments.filter(k => k.status === 'pending').length === 0 ? (
                <Card className="p-12 text-center bg-white">
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No pending KYC documents</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {kycDocuments.filter(k => k.status === 'pending').map((kyc, index) => (
                    <Card key={kyc.kyc_id} className="p-6 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="font-bold text-gray-900">User ID: {kyc.user_id.substring(0, 12)}...</p>
                          <p className="text-sm text-gray-600">{kyc.document_type}</p>
                        </div>
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                          Pending
                        </span>
                      </div>
                      {kyc.document_url && (
                        <div className="mb-4">
                          <img 
                            src={kyc.document_url} 
                            alt="KYC Document" 
                            className="w-full rounded-lg border border-gray-200"
                          />
                        </div>
                      )}
                      <div className="flex gap-3">
                        <Button
                          onClick={() => handleKYCAction(kyc.kyc_id, 'approve')}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => handleKYCAction(kyc.kyc_id, 'reject')}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIP Payments Tab */}
          {activeTab === 'payments' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">VIP Payment Verification</h2>
              {vipPayments.filter(p => p.status === 'pending').length === 0 ? (
                <Card className="p-12 text-center bg-white">
                  <CreditCard className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No pending VIP payments</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {vipPayments.filter(p => p.status === 'pending').map((payment) => (
                    <Card key={payment.payment_id} className="p-6 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="font-bold text-gray-900">₹{payment.amount}</p>
                          <p className="text-sm text-gray-600">{payment.user_id.substring(0, 12)}...</p>
                        </div>
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                          Pending
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Date & Time</p>
                          <p className="font-semibold text-gray-900">{payment.date} {payment.time}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">UTR Number</p>
                          <p className="font-semibold text-gray-900">{payment.utr_number}</p>
                        </div>
                      </div>
                      {payment.screenshot_url && (
                        <div className="mb-4">
                          <img src={payment.screenshot_url} alt="Payment screenshot" className="w-full rounded-lg" />
                        </div>
                      )}
                      <div className="flex gap-3">
                        <Button
                          onClick={() => handlePaymentAction(payment.payment_id, 'approve')}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => handlePaymentAction(payment.payment_id, 'reject')}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stock Movements Tab */}
          {activeTab === 'stock' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Stock Movement Approvals</h2>
              {stockMovements.filter(m => m.status === 'pending_admin').length === 0 ? (
                <Card className="p-12 text-center bg-white">
                  <Truck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No pending stock movements</p>
                </Card>
              ) : (
                <div className="space-y-6">
                  {stockMovements.filter(m => m.status === 'pending_admin').map((movement) => (
                    <Card key={movement.movement_id} className="p-6 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="font-bold text-gray-900">Movement ID: {movement.movement_id.substring(0, 12)}...</p>
                          <p className="text-sm text-gray-600">Product: {movement.product_name}</p>
                        </div>
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                          Pending Admin
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600">From</p>
                          <p className="font-semibold text-gray-900">{movement.from_name || 'Company'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">To</p>
                          <p className="font-semibold text-gray-900">{movement.to_name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Quantity</p>
                          <p className="font-semibold text-gray-900">{movement.quantity}</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          onClick={() => handleStockMovementAction(movement.movement_id, 'approve')}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => handleStockMovementAction(movement.movement_id, 'reject', 'Rejected by manager')}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Support Tickets Tab (View Only) */}
          {activeTab === 'support' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Support Tickets</h2>
                <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">View Only</span>
              </div>
              {supportTickets.length === 0 ? (
                <Card className="p-12 text-center bg-white">
                  <HeadphonesIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No support tickets</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {supportTickets.map((ticket) => (
                    <Card key={ticket.ticket_id} className="p-6 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="font-bold text-gray-900">{ticket.subject}</p>
                          <p className="text-sm text-gray-600">User: {ticket.user_id.substring(0, 12)}...</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          ticket.status === 'open' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {ticket.status}
                        </span>
                      </div>
                      <p className="text-gray-700 mb-2">{ticket.description}</p>
                      <p className="text-xs text-gray-500">Created: {ticket.created_at}</p>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
