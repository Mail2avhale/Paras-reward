import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Search, User, Mail, Phone, Calendar, Shield, Crown,
  Coins, TrendingUp, Users, Gift, CreditCard, Clock,
  CheckCircle, XCircle, AlertTriangle, Activity, RefreshCw, 
  Loader2, ArrowLeft, Copy, Ban, Wallet, Receipt, BadgeCheck,
  Plus, Minus, History, Send, Key, UserX, Trash2, Edit,
  Link, Unlink, X, Check, Eye, EyeOff, Settings, Lock
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ========== MODAL COMPONENT ==========
const Modal = ({ show, onClose, title, children, size = "md" }) => {
  if (!show) return null;
  
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl"
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className={`bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full ${sizeClasses[size]} mx-4 shadow-2xl`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ========== STAT CARD ==========
const StatCard = ({ icon: Icon, label, value, color = "amber", subtext }) => (
  <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-${color}-500/20`}>
        <Icon className={`h-5 w-5 text-${color}-400`} />
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-xl font-bold text-white">{value}</p>
        {subtext && <p className="text-xs text-gray-500">{subtext}</p>}
      </div>
    </div>
  </div>
);

// ========== USER PROFILE CARD ==========
const UserProfileCard = ({ user, onAction }) => {
  if (!user) return null;
  
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };
  
  const planColors = {
    free: 'gray',
    startup: 'blue',
    growth: 'purple',
    elite: 'amber'
  };
  
  const roleColors = {
    user: 'gray',
    admin: 'red',
    sub_admin: 'orange'
  };
  
  const planColor = planColors[user.subscription_plan] || 'gray';
  const roleColor = roleColors[user.role] || 'gray';
  
  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {user.name || 'Unknown User'}
              {user.is_banned && (
                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full flex items-center gap-1">
                  <Ban className="h-3 w-3" /> BLOCKED
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-400 flex items-center gap-2">
              UID: {user.uid}
              <button onClick={() => copyToClipboard(user.uid)} className="hover:text-white transition-colors">
                <Copy className="h-3 w-3" />
              </button>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Role: <span className={`text-${roleColor}-400 font-medium uppercase`}>{user.role || 'user'}</span>
            </p>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 items-end">
          <div className={`px-3 py-1.5 rounded-full bg-${planColor}-500/20 border border-${planColor}-500/30`}>
            <span className={`text-${planColor}-400 font-semibold capitalize flex items-center gap-1`}>
              <Crown className="h-4 w-4" />
              {user.subscription_plan || 'Free'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm bg-amber-500/10 px-3 py-1 rounded-lg">
            <Wallet className="h-4 w-4 text-amber-500" />
            <span className="text-amber-400 font-bold">{(user.prc_balance || 0).toFixed(2)} PRC</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-700/50">
        <div className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4 text-gray-500" />
          <span className="text-gray-300 truncate">{user.email || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Phone className="h-4 w-4 text-gray-500" />
          <span className="text-gray-300">{user.mobile || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span className="text-gray-300">
            {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link className="h-4 w-4 text-blue-500" />
          <span className="text-blue-400">
            Ref: {user.referral_code || 'N/A'}
          </span>
        </div>
      </div>
      
      {/* Referred By */}
      {user.referred_by && (
        <div className="mt-3 p-2 bg-blue-500/10 rounded-lg flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-blue-400" />
          <span className="text-gray-400">Referred by:</span>
          <span className="text-blue-400 font-medium">{user.referred_by}</span>
        </div>
      )}
    </Card>
  );
};

// ========== ADMIN ACTIONS PANEL ==========
const AdminActionsPanel = ({ user, onAction, loading }) => {
  const [showPinReset, setShowPinReset] = useState(false);
  const [showRoleChange, setShowRoleChange] = useState(false);
  const [showBalanceAdjust, setShowBalanceAdjust] = useState(false);
  const [showReferralChange, setShowReferralChange] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [selectedRole, setSelectedRole] = useState(user?.role || 'user');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [newReferrer, setNewReferrer] = useState('');
  const [newPin, setNewPin] = useState(null);
  
  const handlePinReset = async () => {
    const result = await onAction('reset_pin', {});
    if (result?.new_pin) {
      setNewPin(result.new_pin);
    }
    setShowPinReset(false);
  };
  
  const handleRoleChange = async () => {
    await onAction('change_role', { new_role: selectedRole });
    setShowRoleChange(false);
  };
  
  const handleBalanceAdjust = async (operation) => {
    const amount = parseFloat(balanceAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    await onAction(operation === 'add' ? 'add_prc' : 'deduct_prc', { 
      value: amount, 
      reason: balanceReason 
    });
    setBalanceAmount('');
    setBalanceReason('');
    setShowBalanceAdjust(false);
  };
  
  const handleReferralChange = async () => {
    if (!newReferrer.trim()) {
      toast.error('Please enter referrer UID or "remove" to clear');
      return;
    }
    await onAction('change_referral', { new_referrer: newReferrer.trim() });
    setNewReferrer('');
    setShowReferralChange(false);
  };
  
  const handleDelete = async () => {
    await onAction('delete_user', {});
    setShowDeleteConfirm(false);
  };
  
  return (
    <Card className="bg-gray-900/50 border-gray-700 p-4">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Shield className="h-5 w-5 text-red-400" />
        Admin Actions
      </h3>
      
      <div className="grid grid-cols-2 gap-3">
        {/* Block/Unblock */}
        {user?.is_banned ? (
          <Button 
            onClick={() => onAction('unblock_user', {})}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
            data-testid="unblock-btn"
          >
            <CheckCircle className="h-4 w-4" />
            Unblock
          </Button>
        ) : (
          <Button 
            onClick={() => onAction('block_user', {})}
            disabled={loading}
            variant="destructive"
            className="flex items-center gap-2"
            data-testid="block-btn"
          >
            <Ban className="h-4 w-4" />
            Block
          </Button>
        )}
        
        {/* PIN Reset */}
        <Button 
          onClick={() => setShowPinReset(true)}
          disabled={loading}
          className="bg-amber-600 hover:bg-amber-700 flex items-center gap-2"
          data-testid="pin-reset-btn"
        >
          <Key className="h-4 w-4" />
          Reset PIN
        </Button>
        
        {/* Role Change */}
        <Button 
          onClick={() => setShowRoleChange(true)}
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-700 flex items-center gap-2"
          data-testid="role-change-btn"
        >
          <Settings className="h-4 w-4" />
          Change Role
        </Button>
        
        {/* Balance Adjust */}
        <Button 
          onClick={() => setShowBalanceAdjust(true)}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
          data-testid="balance-adjust-btn"
        >
          <Wallet className="h-4 w-4" />
          Adjust Balance
        </Button>
        
        {/* Referral Change */}
        <Button 
          onClick={() => setShowReferralChange(true)}
          disabled={loading}
          className="bg-cyan-600 hover:bg-cyan-700 flex items-center gap-2"
          data-testid="referral-change-btn"
        >
          <Link className="h-4 w-4" />
          Change Referral
        </Button>
        
        {/* Delete User */}
        <Button 
          onClick={() => setShowDeleteConfirm(true)}
          disabled={loading}
          variant="destructive"
          className="flex items-center gap-2 bg-red-700 hover:bg-red-800"
          data-testid="delete-user-btn"
        >
          <Trash2 className="h-4 w-4" />
          Delete User
        </Button>
      </div>
      
      {/* PIN Reset Modal */}
      <Modal show={showPinReset} onClose={() => setShowPinReset(false)} title="Reset PIN">
        <div className="space-y-4">
          <p className="text-gray-400">
            This will generate a new 6-digit PIN for the user. The old PIN will be invalidated.
          </p>
          {newPin && (
            <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg text-center">
              <p className="text-sm text-gray-400 mb-2">New PIN:</p>
              <p className="text-3xl font-mono font-bold text-green-400 tracking-widest">{newPin}</p>
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={() => setShowPinReset(false)} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handlePinReset} disabled={loading} className="flex-1 bg-amber-600 hover:bg-amber-700">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate New PIN'}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Role Change Modal */}
      <Modal show={showRoleChange} onClose={() => setShowRoleChange(false)} title="Change User Role">
        <div className="space-y-4">
          <div>
            <Label className="text-gray-400">Select Role</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {['user', 'sub_admin', 'admin'].map(role => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`p-3 rounded-lg border text-center capitalize transition-all ${
                    selectedRole === role 
                      ? 'border-purple-500 bg-purple-500/20 text-purple-400' 
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {role.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setShowRoleChange(false)} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleRoleChange} disabled={loading} className="flex-1 bg-purple-600 hover:bg-purple-700">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Role'}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Balance Adjust Modal */}
      <Modal show={showBalanceAdjust} onClose={() => setShowBalanceAdjust(false)} title="Adjust PRC Balance">
        <div className="space-y-4">
          <div className="p-3 bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-400">Current Balance</p>
            <p className="text-2xl font-bold text-amber-400">{(user?.prc_balance || 0).toFixed(2)} PRC</p>
          </div>
          <div>
            <Label className="text-gray-400">Amount</Label>
            <Input
              type="number"
              value={balanceAmount}
              onChange={(e) => setBalanceAmount(e.target.value)}
              placeholder="Enter amount"
              className="bg-gray-800 border-gray-700 mt-1"
            />
          </div>
          <div>
            <Label className="text-gray-400">Reason (optional)</Label>
            <Input
              value={balanceReason}
              onChange={(e) => setBalanceReason(e.target.value)}
              placeholder="Reason for adjustment"
              className="bg-gray-800 border-gray-700 mt-1"
            />
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={() => handleBalanceAdjust('add')} 
              disabled={loading} 
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-2" /> Add
            </Button>
            <Button 
              onClick={() => handleBalanceAdjust('deduct')} 
              disabled={loading} 
              variant="destructive"
              className="flex-1"
            >
              <Minus className="h-4 w-4 mr-2" /> Deduct
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Referral Change Modal */}
      <Modal show={showReferralChange} onClose={() => setShowReferralChange(false)} title="Change Referral">
        <div className="space-y-4">
          {user?.referred_by && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-gray-400">Current Referrer</p>
              <p className="text-lg font-medium text-blue-400">{user.referred_by}</p>
            </div>
          )}
          <div>
            <Label className="text-gray-400">New Referrer UID</Label>
            <Input
              value={newReferrer}
              onChange={(e) => setNewReferrer(e.target.value)}
              placeholder="Enter new referrer UID or 'remove'"
              className="bg-gray-800 border-gray-700 mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">Type "remove" to clear referral</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setShowReferralChange(false)} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleReferralChange} disabled={loading} className="flex-1 bg-cyan-600 hover:bg-cyan-700">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Referral'}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete User">
        <div className="space-y-4">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-3 text-red-400 mb-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="font-semibold">Warning: This action cannot be undone!</span>
            </div>
            <p className="text-gray-400 text-sm">
              Deleting this user will permanently remove all their data including:
            </p>
            <ul className="text-gray-500 text-sm mt-2 list-disc list-inside">
              <li>User profile and settings</li>
              <li>PRC balance and transaction history</li>
              <li>Referral network data</li>
              <li>All redemption records</li>
            </ul>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setShowDeleteConfirm(false)} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleDelete} disabled={loading} variant="destructive" className="flex-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete Permanently'}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};

// ========== TRANSACTIONS TABLE ==========
const TransactionsTable = ({ transactions, title = "Recent Transactions" }) => {
  if (!transactions?.length) {
    return (
      <Card className="bg-gray-900/50 border-gray-700 p-4">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <p className="text-gray-500 text-center py-8">No transactions found</p>
      </Card>
    );
  }
  
  return (
    <Card className="bg-gray-900/50 border-gray-700 p-4">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-700">
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4">Amount</th>
              <th className="pb-2 pr-4">Balance</th>
              <th className="pb-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.slice(0, 20).map((txn, idx) => (
              <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="py-2 pr-4">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    txn.type === 'mining' ? 'bg-green-500/20 text-green-400' :
                    txn.type === 'referral' ? 'bg-blue-500/20 text-blue-400' :
                    txn.type === 'redeem' || txn.type === 'admin_debit' ? 'bg-red-500/20 text-red-400' :
                    txn.type === 'admin_credit' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {txn.type}
                  </span>
                </td>
                <td className={`py-2 pr-4 font-medium ${
                  (txn.amount || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {(txn.amount || 0) >= 0 ? '+' : ''}{(txn.amount || 0).toFixed(2)}
                </td>
                <td className="py-2 pr-4 text-gray-300">
                  {(txn.balance_after || 0).toFixed(2)}
                </td>
                <td className="py-2 text-gray-500 text-xs">
                  {txn.created_at ? new Date(txn.created_at).toLocaleString() : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

// ========== REFERRAL SECTION ==========
const ReferralSection = ({ referral }) => {
  if (!referral) return null;
  
  return (
    <Card className="bg-gray-900/50 border-gray-700 p-4">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Users className="h-5 w-5 text-blue-400" />
        Referral Network
      </h3>
      
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 bg-blue-500/10 rounded-lg">
          <p className="text-2xl font-bold text-blue-400">{referral.l1_count || 0}</p>
          <p className="text-xs text-gray-400">Level 1</p>
        </div>
        <div className="text-center p-3 bg-purple-500/10 rounded-lg">
          <p className="text-2xl font-bold text-purple-400">{referral.l2_count || 0}</p>
          <p className="text-xs text-gray-400">Level 2</p>
        </div>
        <div className="text-center p-3 bg-amber-500/10 rounded-lg">
          <p className="text-2xl font-bold text-amber-400">{referral.total_network || 0}</p>
          <p className="text-xs text-gray-400">Total</p>
        </div>
      </div>
      
      {referral.l1_users?.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-gray-400 mb-2">Direct Referrals:</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {referral.l1_users.slice(0, 10).map((user, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-gray-800/50 rounded">
                <span className="text-sm text-gray-300">{user.name || user.email}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  user.subscription_plan === 'elite' ? 'bg-amber-500/20 text-amber-400' :
                  user.subscription_plan === 'growth' ? 'bg-purple-500/20 text-purple-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {user.subscription_plan || 'free'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

// ========== REDEEM REQUESTS TABLE ==========
const RedeemRequestsTable = ({ requests }) => {
  if (!requests?.length) {
    return (
      <Card className="bg-gray-900/50 border-gray-700 p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Redeem Requests</h3>
        <p className="text-gray-500 text-center py-8">No redeem requests found</p>
      </Card>
    );
  }
  
  const statusColors = {
    completed: 'green', COMPLETED: 'green', success: 'green', SUCCESS: 'green',
    pending: 'yellow', PENDING: 'yellow',
    failed: 'red', FAILED: 'red', rejected: 'red'
  };
  
  return (
    <Card className="bg-gray-900/50 border-gray-700 p-4">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Receipt className="h-5 w-5 text-green-400" />
        Redeem Requests
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-700">
              <th className="pb-2 pr-4">Service</th>
              <th className="pb-2 pr-4">Amount</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {requests.slice(0, 15).map((req, idx) => {
              const color = statusColors[req.status] || 'gray';
              return (
                <tr key={idx} className="border-b border-gray-800">
                  <td className="py-2 pr-4 text-gray-300">{req.service_type || 'N/A'}</td>
                  <td className="py-2 pr-4 text-amber-400 font-medium">₹{req.amount_inr || 0}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs bg-${color}-500/20 text-${color}-400`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="py-2 text-gray-500 text-xs">
                    {req.created_at ? new Date(req.created_at).toLocaleString() : 'N/A'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

// ========== MAIN COMPONENT ==========
const AdminUser360New = ({ user: adminUser }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // State
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState(null);
  
  // Search user
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }
    
    setLoading(true);
    setError(null);
    setUserData(null);
    
    try {
      // Use new endpoint first, fallback to old
      let response;
      try {
        response = await axios.get(
          `${API}/admin/user360/full/${encodeURIComponent(searchQuery.trim())}`,
          { headers: { Authorization: `Bearer ${adminUser?.token}` } }
        );
      } catch (e) {
        // Fallback to search then full
        const searchResp = await axios.get(
          `${API}/admin/user360/search?q=${encodeURIComponent(searchQuery.trim())}`,
          { headers: { Authorization: `Bearer ${adminUser?.token}` } }
        );
        response = await axios.get(
          `${API}/admin/user360/full/${searchResp.data.user.uid}`,
          { headers: { Authorization: `Bearer ${adminUser?.token}` } }
        );
      }
      
      setUserData(response.data);
      toast.success(`Loaded data for ${response.data.user?.name || response.data.user?.email}`);
      
    } catch (err) {
      console.error('Search error:', err);
      const message = err.response?.data?.detail || err.message || 'Search failed';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, adminUser?.token]);
  
  // Handle admin action
  const handleAction = async (action, params = {}) => {
    if (!userData?.user?.uid) return null;
    
    setActionLoading(true);
    try {
      const response = await axios.post(
        `${API}/admin/user360/action/${userData.user.uid}`,
        { action, ...params, admin_id: adminUser?.uid },
        { headers: { Authorization: `Bearer ${adminUser?.token}` } }
      );
      
      toast.success(response.data?.message || `Action '${action}' completed successfully`);
      
      // Reload user data
      await handleSearch();
      
      return response.data;
      
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed');
      return null;
    } finally {
      setActionLoading(false);
    }
  };
  
  // Auto-search on mount if query param exists
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setSearchQuery(q);
      setTimeout(() => handleSearch(), 100);
    }
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/admin')}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">User 360° View</h1>
          <p className="text-sm text-gray-400">Complete user profile, actions & management</p>
        </div>
      </div>
      
      {/* Search Bar */}
      <Card className="bg-gray-900/50 border-gray-700 p-4 mb-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
            <Input
              placeholder="Search by UID, email, mobile, or referral code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10 bg-gray-800 border-gray-700 text-white"
              data-testid="user360-search-input"
            />
          </div>
          <Button 
            onClick={handleSearch}
            disabled={loading}
            className="bg-amber-600 hover:bg-amber-700 min-w-[120px]"
            data-testid="user360-search-button"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search
              </>
            )}
          </Button>
        </div>
      </Card>
      
      {/* Error Message */}
      {error && (
        <Card className="bg-red-500/10 border-red-500/30 p-4 mb-6">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </Card>
      )}
      
      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <span className="ml-3 text-gray-400">Loading user data...</span>
        </div>
      )}
      
      {/* User Data */}
      {userData && !loading && (
        <div className="space-y-6">
          {/* Profile Card */}
          <UserProfileCard user={userData.user} onAction={handleAction} />
          
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard 
              icon={Coins} 
              label="Total Mined" 
              value={`${(userData.stats?.total_mined || 0).toFixed(2)} PRC`}
              color="green"
            />
            <StatCard 
              icon={TrendingUp} 
              label="Total Redeemed" 
              value={`₹${(userData.stats?.total_redeemed || 0).toFixed(0)}`}
              color="blue"
            />
            <StatCard 
              icon={Gift} 
              label="Referral Bonus" 
              value={`${(userData.stats?.total_referral_bonus || 0).toFixed(2)} PRC`}
              color="purple"
            />
            <StatCard 
              icon={Users} 
              label="Network Size" 
              value={userData.referral?.total_network || 0}
              color="cyan"
            />
          </div>
          
          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - 2/3 width */}
            <div className="lg:col-span-2 space-y-6">
              <TransactionsTable transactions={userData.transactions} />
              <RedeemRequestsTable requests={userData.redeem_requests} />
            </div>
            
            {/* Right Column - 1/3 width */}
            <div className="space-y-6">
              <AdminActionsPanel 
                user={userData.user} 
                onAction={handleAction}
                loading={actionLoading}
              />
              <ReferralSection referral={userData.referral} />
            </div>
          </div>
        </div>
      )}
      
      {/* Empty State */}
      {!userData && !loading && !error && (
        <div className="text-center py-20">
          <User className="h-16 w-16 mx-auto text-gray-700 mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">Search for a User</h3>
          <p className="text-gray-500">Enter UID, email, mobile number, or referral code</p>
        </div>
      )}
    </div>
  );
};

export default AdminUser360New;
