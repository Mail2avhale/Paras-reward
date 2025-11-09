import { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import notifications from '@/utils/notifications';
import { Send, Bell, Users, Crown, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ManagerCommunication = ({ user, onLogout }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    target_audience: 'all',
    priority: 'normal'
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/manager/announcements`, {
        params: { uid: user.uid }
      });
      setAnnouncements(response.data.announcements);
    } catch (error) {
      console.error('Error:', error);
      notifications.error('Error', 'Failed to fetch announcements');
    } finally {
      setLoading(false);
    }
  };

  const createAnnouncement = async () => {
    if (!formData.title || !formData.message) {
      notifications.warning('Required Fields', 'Please fill in title and message');
      return;
    }

    try {
      const response = await axios.post(`${API}/manager/announcements`, formData, {
        params: { uid: user.uid }
      });
      
      notifications.celebrate(
        '📣 Announcement Sent!',
        `Your announcement has been sent to ${response.data.recipients} users successfully.`
      );
      
      setShowCreateModal(false);
      setFormData({ title: '', message: '', target_audience: 'all', priority: 'normal' });
      fetchAnnouncements();
    } catch (error) {
      notifications.error('Send Failed', error.response?.data?.detail || 'Failed to send announcement');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Communication Center</h1>
            <p className="text-gray-600">Send announcements and notifications to users</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="mr-2 h-4 w-4" />Create Announcement
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Bell className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Announcements</p>
                <p className="text-2xl font-bold text-gray-900">{announcements.length}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Announcements List */}
        <Card>
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold text-gray-900">Sent Announcements</h2>
          </div>
          <div className="divide-y">
            {loading ? (
              <div className="p-12 text-center">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  <span className="ml-3">Loading...</span>
                </div>
              </div>
            ) : announcements.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Bell className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No announcements sent yet</p>
              </div>
            ) : (
              announcements.map((announcement) => (
                <div key={announcement.announcement_id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{announcement.title}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          announcement.priority === 'high' ? 'bg-red-100 text-red-800' :
                          announcement.priority === 'normal' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {announcement.priority?.toUpperCase()}
                        </span>
                        <span className="px-2 py-1 rounded bg-purple-100 text-purple-800 text-xs font-semibold">
                          {announcement.target_audience === 'all' ? 'All Users' :
                           announcement.target_audience === 'vip' ? 'VIP Members' :
                           announcement.target_audience === 'free' ? 'Free Users' : 'Stockists'}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-3">{announcement.message}</p>
                      <p className="text-sm text-gray-500">
                        Sent on {new Date(announcement.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Create Announcement Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Announcement</DialogTitle>
              <DialogDescription>Send a message to users</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Title *</label>
                <Input
                  placeholder="e.g., New Feature Available, Maintenance Notice..."
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Message *</label>
                <Textarea
                  placeholder="Enter your announcement message..."
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  rows={5}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Target Audience</label>
                  <select
                    value={formData.target_audience}
                    onChange={(e) => setFormData({...formData, target_audience: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="all">All Users</option>
                    <option value="vip">VIP Members Only</option>
                    <option value="free">Free Users Only</option>
                    <option value="stockists">Stockists Only</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This announcement will be sent as an in-app notification to all selected users.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-4">
              <Button onClick={() => setShowCreateModal(false)} variant="outline" className="flex-1">Cancel</Button>
              <Button onClick={createAnnouncement} className="flex-1 bg-purple-600 hover:bg-purple-700">
                <Send className="mr-2 h-4 w-4" />Send Announcement
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ManagerCommunication;