import { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Package, CreditCard, FileText, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboard = ({ user, onLogout }) => {
  const [stats, setStats] = useState(null);
  const [vipPayments, setVipPayments] = useState([]);
  const [kycDocuments, setKycDocuments] = useState([]);

  useEffect(() => {
    fetchStats();
    fetchVIPPayments();
    fetchKYCDocuments();
  }, []);

  const fetchStats = async () => {
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

  const handlePaymentAction = async (paymentId, action) => {
    try {
      await axios.post(`${API}/membership/payment/${paymentId}/action`, { action });
      toast.success(`Payment ${action}d successfully!`);
      fetchVIPPayments();
      fetchStats();
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
      fetchStats();
    } catch (error) {
      console.error('Error handling KYC:', error);
      toast.error('Action failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card data-testid="total-users-stat" className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <Users className="h-8 w-8 text-purple-600 mb-3" />
            <p className="text-sm text-gray-600 mb-1">Total Users</p>
            <p className="text-3xl font-bold text-gray-900">{stats?.total_users || 0}</p>
          </Card>

          <Card data-testid="vip-users-stat" className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <Users className="h-8 w-8 text-yellow-600 mb-3" />
            <p className="text-sm text-gray-600 mb-1">VIP Users</p>
            <p className="text-3xl font-bold text-gray-900">{stats?.vip_users || 0}</p>
          </Card>

          <Card data-testid="total-orders-stat" className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <Package className="h-8 w-8 text-blue-600 mb-3" />
            <p className="text-sm text-gray-600 mb-1">Total Orders</p>
            <p className="text-3xl font-bold text-gray-900">{stats?.total_orders || 0}</p>
          </Card>

          <Card data-testid="pending-payments-stat" className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <CreditCard className="h-8 w-8 text-green-600 mb-3" />
            <p className="text-sm text-gray-600 mb-1">Pending Payments</p>
            <p className="text-3xl font-bold text-gray-900">{stats?.pending_payments || 0}</p>
          </Card>

          <Card data-testid="pending-kyc-stat" className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <FileText className="h-8 w-8 text-orange-600 mb-3" />
            <p className="text-sm text-gray-600 mb-1">Pending KYC</p>
            <p className="text-3xl font-bold text-gray-900">{stats?.pending_kyc || 0}</p>
          </Card>
        </div>

        {/* Tabs */}
        <Card className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl">
          <Tabs defaultValue="payments" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger data-testid="payments-tab" value="payments">VIP Payments</TabsTrigger>
              <TabsTrigger data-testid="kyc-tab" value="kyc">KYC Verifications</TabsTrigger>
            </TabsList>

            <TabsContent value="payments" className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">VIP Payment Requests</h2>
              {vipPayments.filter(p => p.status === 'pending').length === 0 ? (
                <p className="text-center py-8 text-gray-500">No pending payments</p>
              ) : (
                vipPayments.filter(p => p.status === 'pending').map((payment, index) => (
                  <Card key={payment.payment_id} data-testid={`payment-${index}`} className="p-6 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">User ID</p>
                        <p className="font-semibold text-gray-900">{payment.user_id.substring(0, 12)}...</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Amount</p>
                        <p className="font-semibold text-gray-900">₹{payment.amount}</p>
                      </div>
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
                        <p className="text-sm text-gray-600 mb-2">Screenshot</p>
                        <img src={payment.screenshot_url} alt="Payment screenshot" className="max-w-xs rounded-lg" />
                      </div>
                    )}
                    <div className="flex gap-3">
                      <Button
                        data-testid={`approve-payment-${index}`}
                        onClick={() => handlePaymentAction(payment.payment_id, 'approve')}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        data-testid={`reject-payment-${index}`}
                        onClick={() => handlePaymentAction(payment.payment_id, 'reject')}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="kyc" className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">KYC Verification Requests</h2>
              {kycDocuments.filter(k => k.status === 'pending').length === 0 ? (
                <p className="text-center py-8 text-gray-500">No pending KYC verifications</p>
              ) : (
                kycDocuments.filter(k => k.status === 'pending').map((kyc, index) => (
                  <Card key={kyc.kyc_id} data-testid={`kyc-${index}`} className="p-6 bg-gray-50">
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">User ID</p>
                      <p className="font-semibold text-gray-900 mb-4">{kyc.user_id.substring(0, 12)}...</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-gray-600 mb-2">Aadhaar Front</p>
                          {kyc.aadhaar_front && (
                            <img src={kyc.aadhaar_front} alt="Aadhaar front" className="w-full rounded-lg" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-2">Aadhaar Back</p>
                          {kyc.aadhaar_back && (
                            <img src={kyc.aadhaar_back} alt="Aadhaar back" className="w-full rounded-lg" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-2">PAN Card</p>
                          {kyc.pan_front && (
                            <img src={kyc.pan_front} alt="PAN card" className="w-full rounded-lg" />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        data-testid={`approve-kyc-${index}`}
                        onClick={() => handleKYCAction(kyc.kyc_id, 'approve')}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        data-testid={`reject-kyc-${index}`}
                        onClick={() => handleKYCAction(kyc.kyc_id, 'reject')}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;