import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
  MessageSquare, 
  Plus, 
  Edit2, 
  Trash2, 
  ToggleLeft,
  ToggleRight,
  Loader2,
  Info,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Eye,
  Save,
  X
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminPopupMessages = ({ user }) => {
  const [popups, setPopups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPopup, setEditingPopup] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    button_text: 'Close',
    button_link: '',
    message_type: 'info',
    enabled: true
  });
  const [saving, setSaving] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    fetchPopups();
  }, []);

  const fetchPopups = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/popup/all`);
      const data = await res.json();
      if (data.success) {
        setPopups(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch popups:', error);
      toast.error('Failed to load popup messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.message) {
      toast.error('Title and message are required');
      return;
    }

    setSaving(true);
    try {
      const url = editingPopup 
        ? `${API_URL}/api/admin/popup/update/${editingPopup.popup_id}`
        : `${API_URL}/api/admin/popup/create`;
      
      const method = editingPopup ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast.success(editingPopup ? 'Popup updated!' : 'Popup created!');
        setShowForm(false);
        setEditingPopup(null);
        resetForm();
        fetchPopups();
      } else {
        toast.error(data.message || 'Operation failed');
      }
    } catch (error) {
      toast.error('Failed to save popup');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (popupId) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/popup/toggle/${popupId}`, {
        method: 'PATCH'
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success(data.message);
        fetchPopups();
      } else {
        toast.error(data.message || 'Toggle failed');
      }
    } catch (error) {
      toast.error('Failed to toggle popup');
    }
  };

  const handleDelete = async (popupId) => {
    if (!window.confirm('Are you sure you want to delete this popup?')) return;
    
    try {
      const res = await fetch(`${API_URL}/api/admin/popup/delete/${popupId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success('Popup deleted');
        fetchPopups();
      } else {
        toast.error(data.message || 'Delete failed');
      }
    } catch (error) {
      toast.error('Failed to delete popup');
    }
  };

  const handleEdit = (popup) => {
    setEditingPopup(popup);
    setFormData({
      title: popup.title,
      message: popup.message,
      button_text: popup.button_text || 'Close',
      button_link: popup.button_link || '',
      message_type: popup.message_type || 'info',
      enabled: popup.enabled
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      button_text: 'Close',
      button_link: '',
      message_type: 'info',
      enabled: true
    });
    setEditingPopup(null);
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-400" />;
      default: return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const getTypeBadgeColor = (type) => {
    switch (type) {
      case 'warning': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'success': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'error': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <MessageSquare className="w-7 h-7 text-amber-500" />
            Popup Messages
          </h1>
          <p className="text-gray-400 mt-1">Broadcast messages to all users on app open</p>
        </div>
        <Button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-amber-500 hover:bg-amber-600 text-black"
        >
          <Plus className="w-4 h-4 mr-2" /> New Popup
        </Button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">
              {editingPopup ? 'Edit Popup Message' : 'Create New Popup Message'}
            </CardTitle>
            <CardDescription>
              This message will be shown to all users when they open the app
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g., Important Update"
                  className="bg-gray-900/50 border-gray-700 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-300">Message Type</Label>
                <Select 
                  value={formData.message_type} 
                  onValueChange={(v) => setFormData({...formData, message_type: v})}
                >
                  <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="info">Info (Blue)</SelectItem>
                    <SelectItem value="success">Success (Green)</SelectItem>
                    <SelectItem value="warning">Warning (Yellow)</SelectItem>
                    <SelectItem value="error">Error (Red)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-gray-300">Message *</Label>
              <Textarea
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                placeholder="Enter your message here..."
                rows={4}
                className="bg-gray-900/50 border-gray-700 text-white mt-1"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Button Text</Label>
                <Input
                  value={formData.button_text}
                  onChange={(e) => setFormData({...formData, button_text: e.target.value})}
                  placeholder="Close"
                  className="bg-gray-900/50 border-gray-700 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-300">Button Link (Optional)</Label>
                <Input
                  value={formData.button_link}
                  onChange={(e) => setFormData({...formData, button_link: e.target.value})}
                  placeholder="https://..."
                  className="bg-gray-900/50 border-gray-700 text-white mt-1"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={formData.enabled}
                onCheckedChange={(v) => setFormData({...formData, enabled: v})}
              />
              <Label className="text-gray-300">Enable immediately</Label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSubmit}
                disabled={saving}
                className="bg-amber-500 hover:bg-amber-600 text-black"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {editingPopup ? 'Update' : 'Create'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setPreviewVisible(true)}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <Eye className="w-4 h-4 mr-2" /> Preview
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setShowForm(false); resetForm(); }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4 mr-2" /> Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Modal */}
      {previewVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`relative w-full max-w-md bg-gradient-to-br ${
            formData.message_type === 'warning' ? 'from-amber-500/20 to-amber-600/10 border-amber-500/30' :
            formData.message_type === 'success' ? 'from-green-500/20 to-green-600/10 border-green-500/30' :
            formData.message_type === 'error' ? 'from-red-500/20 to-red-600/10 border-red-500/30' :
            'from-blue-500/20 to-blue-600/10 border-blue-500/30'
          } border rounded-2xl shadow-2xl`}>
            <button
              onClick={() => setPreviewVisible(false)}
              className="absolute top-3 right-3 p-2 rounded-full bg-gray-800/50 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-6 pt-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-gray-900/50">
                  {getTypeIcon(formData.message_type)}
                </div>
                <h2 className="text-xl font-bold text-white">{formData.title || 'Title'}</h2>
              </div>
              <p className="text-gray-300 text-sm mb-6 whitespace-pre-wrap">
                {formData.message || 'Your message here...'}
              </p>
              <button className="w-full py-3 px-4 rounded-xl bg-amber-500 text-black font-semibold">
                {formData.button_text || 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popups List */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">All Popup Messages</CardTitle>
          <CardDescription>Only one popup can be active at a time</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : popups.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No popup messages yet</p>
              <p className="text-gray-500 text-sm">Create one to broadcast to all users</p>
            </div>
          ) : (
            <div className="space-y-4">
              {popups.map((popup) => (
                <div 
                  key={popup.popup_id}
                  className={`p-4 rounded-xl border ${
                    popup.enabled 
                      ? 'bg-green-500/10 border-green-500/30' 
                      : 'bg-gray-900/50 border-gray-700'
                  }`}
                >
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${getTypeBadgeColor(popup.message_type)}`}>
                          {getTypeIcon(popup.message_type)}
                          {popup.message_type}
                        </span>
                        {popup.enabled && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <h3 className="text-white font-semibold">{popup.title}</h3>
                      <p className="text-gray-400 text-sm mt-1 line-clamp-2">{popup.message}</p>
                      <p className="text-gray-500 text-xs mt-2">
                        Updated: {new Date(popup.updated_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(popup.popup_id)}
                        className={popup.enabled ? 'text-green-400 hover:text-green-300' : 'text-gray-400 hover:text-white'}
                      >
                        {popup.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(popup)}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(popup.popup_id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPopupMessages;
