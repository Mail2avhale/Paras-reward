import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  UserCog, Search, LogIn, AlertTriangle, 
  User, Phone, Mail, Crown, Wallet, Shield
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminLoginAsUser = ({ adminUser, isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [adminPin, setAdminPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [step, setStep] = useState('search'); // search, confirm, success

  const searchUsers = async () => {
    if (!searchQuery || searchQuery.length < 3) {
      toast.error('Enter at least 3 characters');
      return;
    }

    setSearching(true);
    try {
      const response = await axios.get(`${API}/admin/search-user-for-impersonation`, {
        params: { query: searchQuery }
      });
      
      if (response.data.success) {
        setSearchResults(response.data.users || []);
        if (response.data.users?.length === 0) {
          toast.info('No user found');
        }
      }
    } catch (error) {
      toast.error('Search failed');
      console.error(error);
    } finally {
      setSearching(false);
    }
  };

  const selectUser = (user) => {
    setSelectedUser(user);
    setStep('confirm');
  };

  const loginAsUser = async () => {
    if (!selectedUser) return;

    setLoading(true);
    try {
      const response = await axios.post(`${API}/admin/login-as-user`, {
        admin_uid: adminUser?.uid,
        admin_pin: adminPin,
        target_uid: selectedUser.uid
      });

      if (response.data.success) {
        setStep('success');
        toast.success(`Logged in as ${selectedUser.name}!`);
        
        // Store impersonation data
        const impersonationData = {
          ...response.data.user,
          session_token: response.data.session_token,
          expires_at: response.data.expires_at,
          is_impersonation: true,
          admin_name: adminUser?.name
        };
        
        // Open in new window
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          // Set localStorage in new window context
          newWindow.localStorage.setItem('paras_user', JSON.stringify(impersonationData));
          newWindow.localStorage.setItem('paras_impersonation', 'true');
          newWindow.location.href = '/dashboard';
        } else {
          // Fallback - copy to clipboard
          navigator.clipboard.writeText(response.data.session_token);
          toast.info('Pop-up blocked! Token copied to clipboard. Paste in new tab.');
        }
        
        // Close dialog after 2 seconds
        setTimeout(() => {
          resetAndClose();
        }, 2000);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUser(null);
    setAdminPin('');
    setStep('search');
    onClose();
  };

  const getPlanColor = (plan) => {
    const colors = {
      explorer: 'text-gray-400',
      startup: 'text-blue-400',
      growth: 'text-purple-400',
      elite: 'text-yellow-400'
    };
    return colors[plan] || 'text-gray-400';
  };

  return (
    <Dialog open={isOpen} onOpenChange={resetAndClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <UserCog className="w-6 h-6 text-orange-500" />
            Login As User
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Login as any user (For Admin Support)
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Search */}
        {step === 'search' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter Mobile, Name or Email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
                className="bg-gray-800 border-gray-700 text-white"
              />
              <Button 
                onClick={searchUsers} 
                disabled={searching}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {searching ? '...' : <Search className="w-4 h-4" />}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchResults.map((user) => (
                  <div
                    key={user.uid}
                    onClick={() => selectUser(user)}
                    className="p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors border border-gray-700 hover:border-orange-500"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{user.name}</p>
                          <p className="text-sm text-gray-400">{user.mobile}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${getPlanColor(user.subscription_plan)}`}>
                          {user.subscription_plan?.toUpperCase() || 'EXPLORER'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {user.prc_balance?.toLocaleString() || 0} PRC
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Confirm */}
        {step === 'confirm' && selectedUser && (
          <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-orange-500/20 rounded-full flex items-center justify-center">
                  <User className="w-7 h-7 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{selectedUser.name}</h3>
                  <p className="text-gray-400">{selectedUser.mobile}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-400">{selectedUser.mobile}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-400">{selectedUser.email || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Crown className={`w-4 h-4 ${getPlanColor(selectedUser.subscription_plan)}`} />
                  <span className={getPlanColor(selectedUser.subscription_plan)}>
                    {selectedUser.subscription_plan?.toUpperCase() || 'EXPLORER'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-green-500" />
                  <span className="text-green-400">
                    {selectedUser.prc_balance?.toLocaleString() || 0} PRC
                  </span>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-yellow-400 font-medium">Warning</p>
                <p className="text-yellow-400/80">
                  All actions will be logged when logged in as this user. 
                  Session will expire in 1 hour.
                </p>
              </div>
            </div>

            {/* Admin PIN (Optional) */}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Admin PIN (Optional)</label>
              <Input
                type="password"
                placeholder="Enter your PIN..."
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <DialogFooter className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setStep('search')}
                className="border-gray-700 text-gray-400 hover:bg-gray-800"
              >
                Back
              </Button>
              <Button 
                onClick={loginAsUser}
                disabled={loading}
                className="bg-orange-600 hover:bg-orange-700 flex items-center gap-2"
              >
                {loading ? 'Processing...' : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Login As User
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 'success' && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Success!</h3>
            <p className="text-gray-400">
              Logged in as {selectedUser?.name} in new window.
            </p>
            <p className="text-yellow-400 text-sm mt-2">
              Session will expire in 1 hour.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AdminLoginAsUser;
