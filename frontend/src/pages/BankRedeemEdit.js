import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowLeft, Building2, CreditCard, CheckCircle, XCircle, Info, Save, Loader2, AlertTriangle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BankRedeemEdit = ({ user }) => {
  const navigate = useNavigate();
  const { requestId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [request, setRequest] = useState(null);
  const [userData, setUserData] = useState(null);
  
  // Form states
  const [amount, setAmount] = useState(100);
  const [bankDetails, setBankDetails] = useState({
    account_holder_name: '',
    account_number: '',
    confirm_account_number: '',
    ifsc_code: '',
    bank_name: ''
  });
  const [showBankEdit, setShowBankEdit] = useState(false);

  // Fee calculation
  const calculateFees = (amountInr) => {
    let processingFee = amountInr <= 499 ? Math.floor(amountInr * 0.5) : 10;
    const adminCharges = Math.floor(amountInr * 0.20);
    const totalCharges = processingFee + adminCharges;
    const prcRequired = (amountInr + totalCharges) * 10;
    return { processingFee, adminCharges, totalCharges, prcRequired, youReceive: amountInr };
  };

  const fetchData = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const [userRes, historyRes] = await Promise.all([
        axios.get(`${API}/auth/user/${user.uid}`),
        axios.get(`${API}/bank-redeem/history/${user.uid}`)
      ]);
      
      setUserData(userRes.data);
      
      // Find the specific request
      const foundRequest = historyRes.data.requests?.find(r => r.request_id === requestId);
      
      if (!foundRequest) {
        toast.error('Request not found');
        navigate('/orders?tab=bank_redeem');
        return;
      }
      
      if (foundRequest.status !== 'pending') {
        toast.error('Only pending requests can be edited');
        navigate('/orders?tab=bank_redeem');
        return;
      }
      
      setRequest(foundRequest);
      setAmount(foundRequest.amount_inr || 100);
      
      // Set bank details
      if (foundRequest.bank_details) {
        setBankDetails({
          account_holder_name: foundRequest.bank_details.account_holder_name || '',
          account_number: '', // Not shown for security
          confirm_account_number: '',
          ifsc_code: foundRequest.bank_details.ifsc_code || '',
          bank_name: foundRequest.bank_details.bank_name || ''
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load request');
      navigate('/orders?tab=bank_redeem');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, requestId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    if (amount < 100 || amount > 25000) {
      toast.error('Amount must be between ₹100 and ₹25,000');
      return;
    }
    
    setSaving(true);
    try {
      const payload = { amount_inr: amount };
      
      // Add bank details only if user edited them
      if (showBankEdit && bankDetails.account_number) {
        if (bankDetails.account_number !== bankDetails.confirm_account_number) {
          toast.error('Account numbers do not match');
          setSaving(false);
          return;
        }
        
        payload.bank_details = {
          account_holder_name: bankDetails.account_holder_name,
          account_number: bankDetails.account_number,
          ifsc_code: bankDetails.ifsc_code,
          bank_name: bankDetails.bank_name
        };
      }
      
      await axios.put(`${API}/bank-redeem/request/${user.uid}/${requestId}`, payload);
      toast.success('Request updated successfully!');
      navigate('/orders?tab=bank_redeem');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update request');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
      </div>
    );
  }

  const fees = calculateFees(amount);
  const oldFees = calculateFees(request?.amount_inr || 100);
  const prcDifference = oldFees.prcRequired - fees.prcRequired;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 pb-24 pt-16">
      <div className="container mx-auto px-4 max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => navigate('/orders?tab=bank_redeem')}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Edit Request</h1>
            <p className="text-gray-500 text-sm">ID: {requestId?.slice(-8)}</p>
          </div>
        </div>

        {/* Current Request Info */}
        <Card className="bg-gray-900/80 border-gray-800 p-4 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-white font-medium">Current Amount</p>
              <p className="text-amber-400 font-bold text-xl">₹{request?.amount_inr?.toLocaleString()}</p>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            PRC Deducted: {request?.total_prc_deducted?.toLocaleString()} PRC
          </div>
        </Card>

        {/* Edit Amount */}
        <Card className="bg-gray-900/80 border-gray-800 p-4 mb-6">
          <h2 className="text-white font-bold mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-green-400" />
            Edit Amount
          </h2>
          
          {/* Amount Display */}
          <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl p-4 mb-4 text-center border border-green-500/30">
            <p className="text-green-300/70 text-sm mb-1">New Amount</p>
            <p className="text-4xl font-bold text-white">₹{amount.toLocaleString()}</p>
          </div>

          {/* Slider */}
          <div className="mb-4">
            <input
              type="range"
              min={100}
              max={25000}
              step={100}
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value))}
              className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>₹100</span>
              <span>₹25,000</span>
            </div>
          </div>

          {/* Fee Breakdown */}
          <div className="bg-gray-800/50 rounded-xl p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Processing Fee</span>
              <span className="text-orange-400">₹{fees.processingFee}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Admin Charges (20%)</span>
              <span className="text-orange-400">₹{fees.adminCharges}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-700">
              <span className="text-white font-bold">Total PRC Required</span>
              <span className="text-amber-400 font-bold">{fees.prcRequired.toLocaleString()} PRC</span>
            </div>
            
            {/* PRC Adjustment Info */}
            {amount !== request?.amount_inr && (
              <div className={`mt-2 p-2 rounded-lg ${prcDifference >= 0 ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                <div className="flex items-center gap-2">
                  {prcDifference >= 0 ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-green-400 text-xs">
                        +{prcDifference.toLocaleString()} PRC will be refunded
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span className="text-red-400 text-xs">
                        {Math.abs(prcDifference).toLocaleString()} PRC additional will be deducted
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Bank Details Section */}
        <Card className="bg-gray-900/80 border-gray-800 p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              Bank Details
            </h2>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowBankEdit(!showBankEdit)}
              className="text-xs"
            >
              {showBankEdit ? 'Cancel Edit' : 'Edit Bank'}
            </Button>
          </div>

          {/* Current Bank Details */}
          {!showBankEdit && (
            <div className="bg-gray-800/50 rounded-xl p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Account Holder</span>
                <span className="text-white">{request?.bank_details?.account_holder_name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Account</span>
                <span className="text-white">{request?.bank_details?.account_masked || 'XXXX****'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">IFSC</span>
                <span className="text-cyan-400">{request?.bank_details?.ifsc_code || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Bank</span>
                <span className="text-white">{request?.bank_details?.bank_name || '-'}</span>
              </div>
            </div>
          )}

          {/* Edit Bank Details Form */}
          {showBankEdit && (
            <div className="space-y-4">
              <div>
                <Label className="text-gray-300 text-sm mb-2 block">Account Holder Name</Label>
                <Input
                  value={bankDetails.account_holder_name}
                  onChange={(e) => setBankDetails({...bankDetails, account_holder_name: e.target.value.toUpperCase()})}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300 text-sm mb-2 block">New Account Number</Label>
                <Input
                  type="password"
                  value={bankDetails.account_number}
                  onChange={(e) => setBankDetails({...bankDetails, account_number: e.target.value.replace(/\D/g, '').slice(0, 18)})}
                  placeholder="Enter new account number"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300 text-sm mb-2 block">Confirm Account Number</Label>
                <Input
                  value={bankDetails.confirm_account_number}
                  onChange={(e) => setBankDetails({...bankDetails, confirm_account_number: e.target.value.replace(/\D/g, '').slice(0, 18)})}
                  placeholder="Re-enter account number"
                  className="bg-gray-800 border-gray-700 text-white"
                />
                {bankDetails.account_number && bankDetails.confirm_account_number && (
                  bankDetails.account_number === bankDetails.confirm_account_number ? (
                    <p className="text-green-400 text-xs mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Match
                    </p>
                  ) : (
                    <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> Not matching
                    </p>
                  )
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300 text-sm mb-2 block">IFSC Code</Label>
                  <Input
                    value={bankDetails.ifsc_code}
                    onChange={(e) => setBankDetails({...bankDetails, ifsc_code: e.target.value.toUpperCase().slice(0, 11)})}
                    className="bg-gray-800 border-gray-700 text-white uppercase"
                  />
                </div>
                <div>
                  <Label className="text-gray-300 text-sm mb-2 block">Bank Name</Label>
                  <Input
                    value={bankDetails.bank_name}
                    onChange={(e) => setBankDetails({...bankDetails, bank_name: e.target.value.toUpperCase()})}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Info Box */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-6">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-300">
              <p className="font-semibold mb-1">Edit करताना लक्षात ठेवा:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Amount कमी केल्यास PRC refund होईल</li>
                <li>Amount वाढवल्यास अतिरिक्त PRC कापले जाईल</li>
                <li>Only use "Edit Bank" if you need to change bank details</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/orders?tab=bank_redeem')}
            className="flex-1 border-gray-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || (showBankEdit && bankDetails.account_number && bankDetails.account_number !== bankDetails.confirm_account_number)}
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black font-bold"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BankRedeemEdit;
