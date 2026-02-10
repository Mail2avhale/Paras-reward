import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Shield, Check, X, Save, RefreshCw, Users, Lock, Unlock } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const ManagerPermissions = ({ userId, userName, onClose, onSave }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allPermissions, setAllPermissions] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [defaultPermissions, setDefaultPermissions] = useState([]);

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Get all available permissions
      const permResponse = await axios.get(`${API}/api/admin/permissions/list`);
      setAllPermissions(permResponse.data.permissions || []);
      setDefaultPermissions(permResponse.data.default_manager || []);
      
      // Get user's current permissions
      const userResponse = await axios.get(`${API}/api/admin/user/${userId}/permissions`);
      setSelectedPermissions(userResponse.data.permissions || permResponse.data.default_manager || []);
      
    } catch (error) {
      toast.error('Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (permId) => {
    setSelectedPermissions(prev => {
      if (prev.includes(permId)) {
        return prev.filter(p => p !== permId);
      } else {
        return [...prev, permId];
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedPermissions(allPermissions.map(p => p.id));
  };

  const handleDeselectAll = () => {
    setSelectedPermissions([]);
  };

  const handleResetToDefault = () => {
    setSelectedPermissions([...defaultPermissions]);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.put(`${API}/api/admin/user/${userId}/permissions`, {
        permissions: selectedPermissions
      });
      toast.success('Permissions updated successfully');
      if (onSave) onSave(selectedPermissions);
      if (onClose) onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by category
  const groupedPermissions = allPermissions.reduce((acc, perm) => {
    const category = perm.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(perm);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
        <p className="mt-2 text-gray-500">Loading permissions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Manager Permissions
          </h3>
          <p className="text-sm text-gray-500">
            Select which admin pages <strong>{userName}</strong> can access
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSelectAll}>
            <Check className="h-4 w-4 mr-1" />
            All
          </Button>
          <Button variant="outline" size="sm" onClick={handleDeselectAll}>
            <X className="h-4 w-4 mr-1" />
            None
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetToDefault}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Default
          </Button>
        </div>
      </div>

      {/* Permissions Grid */}
      <div className="max-h-[400px] overflow-y-auto space-y-4 pr-2">
        {Object.entries(groupedPermissions).map(([category, permissions]) => (
          <Card key={category} className="p-4">
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              {category}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {permissions.map(perm => {
                const isSelected = selectedPermissions.includes(perm.id);
                const isDefault = defaultPermissions.includes(perm.id);
                
                return (
                  <label
                    key={perm.id}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-blue-50 border border-blue-200' 
                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggle(perm.id)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className={`text-sm ${isSelected ? 'text-blue-700 font-medium' : 'text-gray-600'}`}>
                      {perm.label}
                    </span>
                    {isDefault && (
                      <span className="text-xs bg-green-100 text-green-600 px-1 rounded">Default</span>
                    )}
                  </label>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-gray-50 p-3 rounded-lg">
        <p className="text-sm text-gray-600">
          <strong>{selectedPermissions.length}</strong> of <strong>{allPermissions.length}</strong> permissions selected
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        {onClose && (
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        )}
        <Button 
          className="flex-1 bg-blue-600 hover:bg-blue-700" 
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Permissions
        </Button>
      </div>
    </div>
  );
};

export default ManagerPermissions;
