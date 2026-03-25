import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Smartphone, Tv, Zap, Building2, RefreshCw, CheckCircle, XCircle,
  Wallet, Search, Copy, ArrowLeft, Loader2, AlertTriangle, Info
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { useNavigate } from 'react-router-dom';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminEkoServices = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('mobile');
  const [loading, setLoading] = useState(false);
  const [ekoBalance, setEkoBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  
  // Transaction history
  const [recentTransactions, setRecentTransactions] = useState([]);
  
  // Mobile Recharge State
  const [mobileNumber, setMobileNumber] = useState('');
  const [mobileOperator, setMobileOperator] = useState('');
  const [mobileAmount, setMobileAmount] = useState('');
  const [mobileCircle, setMobileCircle] = useState('');
  
  // DTH State
  const [dthNumber, setDthNumber] = useState('');
  const [dthOperator, setDthOperator] = useState('');
  const [dthAmount, setDthAmount] = useState('');
  
  // Electricity State
  const [elecConsumerNo, setElecConsumerNo] = useState('');
  const [elecOperator, setElecOperator] = useState('');
  const [elecAmount, setElecAmount] = useState('');
  
  // DMT State
  const [dmtMobile, setDmtMobile] = useState('');
  const [dmtAccountNo, setDmtAccountNo] = useState('');
  const [dmtIfsc, setDmtIfsc] = useState('');
  const [dmtAmount, setDmtAmount] = useState('');
  const [dmtBeneficiaryName, setDmtBeneficiaryName] = useState('');
  const [dmtVerifyResult, setDmtVerifyResult] = useState(null);

  // Operators data from Eko API
  const mobileOperators = [
    { id: '90', name: 'Jio Prepaid' },
    { id: '1', name: 'Airtel Prepaid' },
    { id: '400', name: 'Vi Prepaid' },
    { id: '5', name: 'BSNL Prepaid' },
    { id: '91', name: 'MTNL Delhi Prepaid' },
    { id: '508', name: 'MTNL Mumbai Prepaid' },
  ];

  const dthOperators = [
    { id: '20', name: 'Tata Sky' },
    { id: '21', name: 'Airtel DTH' },
    { id: '16', name: 'Dish TV' },
    { id: '95', name: 'Videocon D2H' },
    { id: '17', name: 'BIG TV DTH' },
  ];

  const electricityOperators = [
    // Maharashtra
    { id: '62', name: 'MSEDCL - Maharashtra' },
    { id: '139', name: 'Tata Power - Mumbai' },
    { id: '242', name: 'Adani Electricity Mumbai' },
    // Delhi
    { id: '24', name: 'Tata Power - Delhi' },
    { id: '178', name: 'NDMC - Electricity' },
    // Karnataka
    { id: '56', name: 'BESCOM - Bangalore' },
    { id: '148', name: 'GESCOM - Gulbarga' },
    { id: '155', name: 'CESC - Chamundeshwari' },
    { id: '156', name: 'HESCOM - Hubli' },
    // Tamil Nadu
    { id: '149', name: 'TNEB - Tamil Nadu' },
    // Andhra Pradesh
    { id: '55', name: 'APSPDCL - Southern AP' },
    { id: '164', name: 'EPDCL - Eastern AP' },
    { id: '3018', name: 'APCPDCL - Central AP' },
    // Uttar Pradesh
    { id: '131', name: 'UPPCL - Urban' },
    { id: '190', name: 'UPPCL - Rural' },
    { id: '195', name: 'KESCO - Kanpur' },
    // Madhya Pradesh
    { id: '57', name: 'MPMKVVCL - Madhya (Urban)' },
    { id: '59', name: 'MPPKVVCL - Paschim' },
    { id: '78', name: 'MPPKVVCL - Poorv (Urban)' },
    { id: '174', name: 'MPMKVVCL - Madhya (Rural)' },
    { id: '175', name: 'MPPKVVCL - Poorv' },
    // Bihar
    { id: '81', name: 'NBPDCL - North Bihar' },
    { id: '82', name: 'SBPDCL - South Bihar' },
    // Gujarat
    { id: '63', name: 'Torrent Power' },
    { id: '240', name: 'Torrent Power - Bhiwandi' },
    { id: '241', name: 'Torrent Power - Surat' },
    // Rajasthan
    { id: '121', name: 'KEDL - Kota' },
    { id: '122', name: 'BESL - Bharatpur' },
    { id: '125', name: 'JVVNL - Jaipur' },
    { id: '126', name: 'AVVNL - Ajmer' },
    { id: '141', name: 'BkESL - Bikaner' },
    { id: '145', name: 'JDVVNL - Jodhpur' },
    // West Bengal
    { id: '204', name: 'WBSEDCL - West Bengal' },
    // Kerala
    { id: '247', name: 'KSEBL - Kerala' },
    // Assam
    { id: '96', name: 'APDCL - RAPDR' },
    { id: '160', name: 'APDCL - Non-RAPDR' },
    // Others
    { id: '61', name: 'CSPDCL - Chhattisgarh' },
    { id: '76', name: 'DNH Power' },
    { id: '166', name: 'HPSEB - Himachal' },
    { id: '198', name: 'Goa Electricity' },
    { id: '375', name: 'Chandigarh Electricity' },
    { id: '546', name: 'PSPCL - Punjab' },
    { id: '603', name: 'UPCL - Uttarakhand' },
  ];

  const gasOperators = [
    // PNG (Piped Natural Gas)
    { id: '28', name: 'Mahanagar Gas (MGL)' },
    { id: '50', name: 'Gujarat Gas' },
    { id: '51', name: 'Adani Gas' },
    { id: '65', name: 'Indraprastha Gas (IGL)' },
    { id: '132', name: 'Sabarmati Gas' },
    { id: '157', name: 'Central UP Gas' },
    { id: '158', name: 'Aavantika Gas' },
    { id: '163', name: 'Charotar Gas' },
    { id: '168', name: 'Indian Oil-Adani Gas' },
    { id: '176', name: 'MNGL - Maharashtra' },
    { id: '191', name: 'Vadodara Gas' },
    { id: '196', name: 'Gail Gas' },
    { id: '341', name: 'Bhagyanagar Gas' },
    { id: '396', name: 'Green Gas (GGL)' },
    { id: '5643', name: 'BPCL PNG' },
    // LPG
    { id: '438', name: 'Indane Gas (Indian Oil)' },
    { id: '275', name: 'Bharat Gas (BPCL)' },
    { id: '270', name: 'HP Gas' },
  ];

  const waterOperators = [
    { id: '130', name: 'Delhi Jal Board' },
    { id: '117', name: 'Pune Municipal - Water' },
    { id: '161', name: 'BWSSB - Bangalore' },
    { id: '162', name: 'Bhopal Municipal - Water' },
    { id: '167', name: 'HMWSSB - Hyderabad' },
    { id: '183', name: 'Surat Municipal - Water' },
    { id: '179', name: 'NDMC - Water' },
    { id: '497', name: 'MCGM Water - Mumbai' },
    { id: '466', name: 'Kerala Water Authority' },
    { id: '116', name: 'Uttarakhand Jal Sansthan' },
  ];

  const circles = [
    { id: 'MH', name: 'Maharashtra' },
    { id: 'DL', name: 'Delhi' },
    { id: 'KA', name: 'Karnataka' },
    { id: 'TN', name: 'Tamil Nadu' },
    { id: 'GJ', name: 'Gujarat' },
    { id: 'UP', name: 'Uttar Pradesh' },
    { id: 'RJ', name: 'Rajasthan' },
    { id: 'MP', name: 'Madhya Pradesh' },
    { id: 'WB', name: 'West Bengal' },
    { id: 'AP', name: 'Andhra Pradesh' },
  ];

  useEffect(() => {
    fetchEkoBalance();
  }, []);

  const fetchEkoBalance = async () => {
    setBalanceLoading(true);
    try {
      const response = await axios.get(`${API}/eko/balance`);
      setEkoBalance(response.data);
    } catch (error) {
      console.error('Failed to fetch Eko balance:', error);
      setEkoBalance({ success: false, error: 'Failed to fetch balance' });
    } finally {
      setBalanceLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied: ${text}`);
  };

  const addToHistory = (type, data, success, response) => {
    const transaction = {
      id: Date.now(),
      type,
      data,
      success,
      response,
      timestamp: new Date().toISOString()
    };
    setRecentTransactions(prev => [transaction, ...prev].slice(0, 10));
  };

  // ==================== MOBILE RECHARGE ====================
  const handleMobileRecharge = async () => {
    if (!mobileNumber || !mobileOperator || !mobileAmount) {
      toast.error('Please fill all fields');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(
        `${API}/eko/recharge/process?mobile_number=${mobileNumber}&operator_id=${mobileOperator}&amount=${mobileAmount}&circle_id=${mobileCircle || 'MH'}`
      );
      
      if (response.data.success) {
        toast.success(`Recharge Successful! TXN: ${response.data.txn_ref || response.data.eko_txn_id}`);
        addToHistory('Mobile Recharge', { mobile: mobileNumber, amount: mobileAmount }, true, response.data);
        // Clear form
        setMobileNumber('');
        setMobileAmount('');
        fetchEkoBalance();
      } else {
        toast.error(response.data.message || 'Recharge failed');
        addToHistory('Mobile Recharge', { mobile: mobileNumber, amount: mobileAmount }, false, response.data);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message;
      toast.error(`Recharge Failed: ${errorMsg}`);
      addToHistory('Mobile Recharge', { mobile: mobileNumber, amount: mobileAmount }, false, { error: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  // ==================== DTH RECHARGE ====================
  const handleDthRecharge = async () => {
    if (!dthNumber || !dthOperator || !dthAmount) {
      toast.error('Please fill all fields');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/eko/bbps/paybill`, {
        utility_acc_no: dthNumber,
        operator_id: dthOperator,
        amount: dthAmount,
        bill_type: 'dth'
      });
      
      if (response.data.success) {
        toast.success(`DTH Recharge Successful! TXN: ${response.data.txn_ref || response.data.eko_txn_id}`);
        addToHistory('DTH Recharge', { subscriber: dthNumber, amount: dthAmount }, true, response.data);
        setDthNumber('');
        setDthAmount('');
        fetchEkoBalance();
      } else {
        toast.error(response.data.message || 'DTH recharge failed');
        addToHistory('DTH Recharge', { subscriber: dthNumber, amount: dthAmount }, false, response.data);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message;
      toast.error(`DTH Recharge Failed: ${errorMsg}`);
      addToHistory('DTH Recharge', { subscriber: dthNumber, amount: dthAmount }, false, { error: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  // ==================== ELECTRICITY BILL ====================
  const handleElectricityPayment = async () => {
    if (!elecConsumerNo || !elecOperator || !elecAmount) {
      toast.error('Please fill all fields');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/eko/bbps/paybill`, {
        utility_acc_no: elecConsumerNo,
        operator_id: elecOperator,
        amount: elecAmount,
        bill_type: 'electricity'
      });
      
      if (response.data.success) {
        toast.success(`Bill Payment Successful! TXN: ${response.data.txn_ref || response.data.eko_txn_id}`);
        addToHistory('Electricity Bill', { consumer: elecConsumerNo, amount: elecAmount }, true, response.data);
        setElecConsumerNo('');
        setElecAmount('');
        fetchEkoBalance();
      } else {
        toast.error(response.data.message || 'Bill payment failed');
        addToHistory('Electricity Bill', { consumer: elecConsumerNo, amount: elecAmount }, false, response.data);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message;
      toast.error(`Bill Payment Failed: ${errorMsg}`);
      addToHistory('Electricity Bill', { consumer: elecConsumerNo, amount: elecAmount }, false, { error: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  // ==================== DMT (Bank Transfer) ====================
  const handleVerifyAccount = async () => {
    if (!dmtAccountNo || !dmtIfsc) {
      toast.error('Please enter Account Number and IFSC');
      return;
    }
    
    setLoading(true);
    setDmtVerifyResult(null);
    try {
      const response = await axios.post(`${API}/admin/bank-redeem/verify-account`, {
        account_number: dmtAccountNo,
        ifsc: dmtIfsc
      });
      
      if (response.data.success) {
        setDmtVerifyResult(response.data);
        setDmtBeneficiaryName(response.data.account_holder || response.data.beneficiary_name || '');
        toast.success(`Account Verified: ${response.data.account_holder || 'Success'}`);
      } else {
        setDmtVerifyResult({ success: false, error: response.data.error || 'Verification failed' });
        toast.error(response.data.error || 'Account verification failed');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message;
      setDmtVerifyResult({ success: false, error: errorMsg });
      toast.error(`Verification Failed: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDmtTransfer = async () => {
    if (!dmtMobile || !dmtAccountNo || !dmtIfsc || !dmtAmount || !dmtBeneficiaryName) {
      toast.error('Please fill all fields');
      return;
    }
    
    if (parseFloat(dmtAmount) < 100) {
      toast.error('Minimum transfer amount is ₹100');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/admin/eko/dmt-transfer`, {
        recipient_mobile: dmtMobile,
        account_number: dmtAccountNo,
        ifsc: dmtIfsc,
        amount: parseFloat(dmtAmount),
        recipient_name: dmtBeneficiaryName,
        admin_id: user?.uid
      });
      
      if (response.data.success) {
        toast.success(`Transfer Successful! TXN: ${response.data.txn_id || response.data.eko_txn_id}`);
        addToHistory('DMT Transfer', { 
          mobile: dmtMobile, 
          account: dmtAccountNo, 
          amount: dmtAmount,
          name: dmtBeneficiaryName 
        }, true, response.data);
        // Clear form
        setDmtMobile('');
        setDmtAccountNo('');
        setDmtIfsc('');
        setDmtAmount('');
        setDmtBeneficiaryName('');
        setDmtVerifyResult(null);
        fetchEkoBalance();
      } else {
        toast.error(response.data.message || 'Transfer failed');
        addToHistory('DMT Transfer', { mobile: dmtMobile, account: dmtAccountNo, amount: dmtAmount }, false, response.data);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message;
      toast.error(`Transfer Failed: ${errorMsg}`);
      addToHistory('DMT Transfer', { mobile: dmtMobile, account: dmtAccountNo, amount: dmtAmount }, false, { error: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'mobile', label: 'Mobile Recharge', icon: Smartphone, color: 'text-blue-400' },
    { id: 'dth', label: 'DTH Recharge', icon: Tv, color: 'text-purple-400' },
    { id: 'electricity', label: 'Electricity', icon: Zap, color: 'text-yellow-400' },
    { id: 'dmt', label: 'DMT Transfer', icon: Building2, color: 'text-green-400' },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="h-10 w-10 p-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Wallet className="w-6 h-6 text-green-500" />
              Admin Eko Services
            </h1>
            <p className="text-slate-500 text-sm">Direct Eko API - No Approval Required</p>
          </div>
        </div>
        <Button onClick={fetchEkoBalance} variant="outline" size="sm" className="h-10 px-3">
          <RefreshCw className={`w-5 h-5 ${balanceLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Eko Balance Card */}
      <Card className="p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-400 text-sm font-medium">Eko Wallet Balance</p>
            {balanceLoading ? (
              <Loader2 className="w-6 h-6 animate-spin text-green-400 mt-1" />
            ) : ekoBalance?.success ? (
              <p className="text-3xl font-bold text-slate-800">₹{parseFloat(ekoBalance.balance || 0).toLocaleString()}</p>
            ) : (
              <p className="text-red-400 text-sm">{ekoBalance?.error || 'Failed to load balance'}</p>
            )}
          </div>
          <Wallet className="w-12 h-12 text-green-500/50" />
        </div>
      </Card>

      {/* Warning Banner */}
      <Card className="p-3 bg-orange-500/10 border-orange-500/30">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-orange-400 font-semibold text-sm">Direct API Access</p>
            <p className="text-orange-300 text-xs">Transactions will be processed instantly via Eko API. No approval workflow. Use carefully.</p>
          </div>
        </div>
      </Card>

      {/* Service Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            variant={activeTab === tab.id ? 'default' : 'outline'}
            className={`flex-shrink-0 gap-2 ${activeTab === tab.id ? 'bg-purple-600' : ''}`}
          >
            <tab.icon className={`w-4 h-4 ${tab.color}`} />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Service Forms */}
      <Card className="p-6 bg-white border-slate-200">
        {/* Mobile Recharge */}
        {activeTab === 'mobile' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-blue-400" />
              Mobile Prepaid Recharge
            </h2>
            
            <div className="grid gap-4">
              <div>
                <label className="text-slate-500 text-sm mb-1 block">Mobile Number</label>
                <Input
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  className="h-12 text-lg bg-white border-slate-200"
                  maxLength={10}
                />
              </div>
              
              <div>
                <label className="text-slate-500 text-sm mb-1 block">Operator</label>
                <select
                  value={mobileOperator}
                  onChange={(e) => setMobileOperator(e.target.value)}
                  className="w-full h-12 px-3 text-lg bg-white border border-slate-200 rounded-md text-slate-800"
                >
                  <option value="">Select Operator</option>
                  {mobileOperators.map((op) => (
                    <option key={op.id} value={op.id}>{op.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-slate-500 text-sm mb-1 block">Circle</label>
                <select
                  value={mobileCircle}
                  onChange={(e) => setMobileCircle(e.target.value)}
                  className="w-full h-12 px-3 text-lg bg-white border border-slate-200 rounded-md text-slate-800"
                >
                  <option value="">Select Circle</option>
                  {circles.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-slate-500 text-sm mb-1 block">Amount (₹)</label>
                <Input
                  type="number"
                  value={mobileAmount}
                  onChange={(e) => setMobileAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="h-12 text-lg bg-white border-slate-200"
                />
              </div>
              
              <Button
                onClick={handleMobileRecharge}
                disabled={loading || !mobileNumber || !mobileOperator || !mobileAmount}
                className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                Recharge Now
              </Button>
            </div>
          </div>
        )}

        {/* DTH Recharge */}
        {activeTab === 'dth' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Tv className="w-5 h-5 text-purple-400" />
              DTH Recharge
            </h2>
            
            <div className="grid gap-4">
              <div>
                <label className="text-slate-500 text-sm mb-1 block">Subscriber ID / VC Number</label>
                <Input
                  value={dthNumber}
                  onChange={(e) => setDthNumber(e.target.value)}
                  placeholder="Enter subscriber ID"
                  className="h-12 text-lg bg-white border-slate-200"
                />
              </div>
              
              <div>
                <label className="text-slate-500 text-sm mb-1 block">DTH Operator</label>
                <select
                  value={dthOperator}
                  onChange={(e) => setDthOperator(e.target.value)}
                  className="w-full h-12 px-3 text-lg bg-white border border-slate-200 rounded-md text-slate-800"
                >
                  <option value="">Select Operator</option>
                  {dthOperators.map((op) => (
                    <option key={op.id} value={op.id}>{op.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-slate-500 text-sm mb-1 block">Amount (₹)</label>
                <Input
                  type="number"
                  value={dthAmount}
                  onChange={(e) => setDthAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="h-12 text-lg bg-white border-slate-200"
                />
              </div>
              
              <Button
                onClick={handleDthRecharge}
                disabled={loading || !dthNumber || !dthOperator || !dthAmount}
                className="w-full h-12 text-lg bg-purple-600 hover:bg-purple-700"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                Recharge Now
              </Button>
            </div>
          </div>
        )}

        {/* Electricity */}
        {activeTab === 'electricity' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Electricity Bill Payment
            </h2>
            
            <div className="grid gap-4">
              <div>
                <label className="text-slate-500 text-sm mb-1 block">Consumer Number</label>
                <Input
                  value={elecConsumerNo}
                  onChange={(e) => setElecConsumerNo(e.target.value)}
                  placeholder="Enter consumer number"
                  className="h-12 text-lg bg-white border-slate-200"
                />
              </div>
              
              <div>
                <label className="text-slate-500 text-sm mb-1 block">Electricity Board</label>
                <select
                  value={elecOperator}
                  onChange={(e) => setElecOperator(e.target.value)}
                  className="w-full h-12 px-3 text-lg bg-white border border-slate-200 rounded-md text-slate-800"
                >
                  <option value="">Select Board</option>
                  {electricityOperators.map((op) => (
                    <option key={op.id} value={op.id}>{op.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-slate-500 text-sm mb-1 block">Amount (₹)</label>
                <Input
                  type="number"
                  value={elecAmount}
                  onChange={(e) => setElecAmount(e.target.value)}
                  placeholder="Enter bill amount"
                  className="h-12 text-lg bg-white border-slate-200"
                />
              </div>
              
              <Button
                onClick={handleElectricityPayment}
                disabled={loading || !elecConsumerNo || !elecOperator || !elecAmount}
                className="w-full h-12 text-lg bg-yellow-600 hover:bg-yellow-700"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                Pay Bill
              </Button>
            </div>
          </div>
        )}

        {/* DMT Transfer */}
        {activeTab === 'dmt' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-green-400" />
              Direct Money Transfer (DMT)
            </h2>
            
            <div className="grid gap-4">
              <div>
                <label className="text-slate-500 text-sm mb-1 block">Recipient Mobile Number</label>
                <Input
                  value={dmtMobile}
                  onChange={(e) => setDmtMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  className="h-12 text-lg bg-white border-slate-200"
                  maxLength={10}
                />
              </div>
              
              <div>
                <label className="text-slate-500 text-sm mb-1 block">Bank Account Number</label>
                <Input
                  value={dmtAccountNo}
                  onChange={(e) => setDmtAccountNo(e.target.value)}
                  placeholder="Enter account number"
                  className="h-12 text-lg bg-white border-slate-200"
                />
              </div>
              
              <div>
                <label className="text-slate-500 text-sm mb-1 block">IFSC Code</label>
                <div className="flex gap-2">
                  <Input
                    value={dmtIfsc}
                    onChange={(e) => setDmtIfsc(e.target.value.toUpperCase())}
                    placeholder="e.g., SBIN0001234"
                    className="h-12 text-lg bg-white border-slate-200 flex-1"
                  />
                  <Button
                    onClick={handleVerifyAccount}
                    disabled={loading || !dmtAccountNo || !dmtIfsc}
                    variant="outline"
                    className="h-12 px-4"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Verify
                  </Button>
                </div>
              </div>
              
              {/* Verification Result */}
              {dmtVerifyResult && (
                <Card className={`p-3 ${dmtVerifyResult.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  {dmtVerifyResult.success ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <div>
                        <p className="text-green-400 font-semibold">Account Verified</p>
                        <p className="text-green-300 text-sm">{dmtVerifyResult.account_holder || dmtVerifyResult.beneficiary_name}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-red-400" />
                      <p className="text-red-400">{dmtVerifyResult.error}</p>
                    </div>
                  )}
                </Card>
              )}
              
              <div>
                <label className="text-slate-500 text-sm mb-1 block">Beneficiary Name</label>
                <Input
                  value={dmtBeneficiaryName}
                  onChange={(e) => setDmtBeneficiaryName(e.target.value)}
                  placeholder="Account holder name"
                  className="h-12 text-lg bg-white border-slate-200"
                />
              </div>
              
              <div>
                <label className="text-slate-500 text-sm mb-1 block">Amount (₹)</label>
                <Input
                  type="number"
                  value={dmtAmount}
                  onChange={(e) => setDmtAmount(e.target.value)}
                  placeholder="Minimum ₹100"
                  className="h-12 text-lg bg-white border-slate-200"
                />
              </div>
              
              <Button
                onClick={handleDmtTransfer}
                disabled={loading || !dmtMobile || !dmtAccountNo || !dmtIfsc || !dmtAmount || !dmtBeneficiaryName}
                className="w-full h-12 text-lg bg-green-600 hover:bg-green-700"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                Transfer ₹{dmtAmount || '0'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Recent Transactions */}
      {recentTransactions.length > 0 && (
        <Card className="p-4 bg-white border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-3">Recent Transactions</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {recentTransactions.map((txn) => (
              <div 
                key={txn.id} 
                className={`p-3 rounded-lg ${txn.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {txn.success ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-slate-800 font-medium">{txn.type}</span>
                  </div>
                  <span className="text-slate-500 text-xs">
                    {new Date(txn.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {Object.entries(txn.data).map(([key, value]) => (
                    <span key={key} className="mr-3">{key}: {value}</span>
                  ))}
                </div>
                {txn.response?.txn_ref && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-cyan-400 text-xs font-mono">{txn.response.txn_ref}</span>
                    <Copy 
                      className="w-3 h-3 text-slate-500 hover:text-cyan-400 cursor-pointer" 
                      onClick={() => copyToClipboard(txn.response.txn_ref)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default AdminEkoServices;
