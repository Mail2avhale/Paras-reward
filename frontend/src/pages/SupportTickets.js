import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Ticket, Plus, MessageCircle, Clock, CheckCircle, XCircle,
  AlertCircle, Send, ArrowLeft
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SupportTickets = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  
  const [formData, setFormData] = useState({
    category: 'Technical',
    subject: '',
    description: ''
  });

  const categories = [
    'Account Issues',
    'Mining',
    'Marketplace',
    'Wallet',
    'KYC/VIP',
    'Orders',
    'Technical',
    'Other'
  ];

  useEffect(() => {
    const loggedUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (!loggedUser.uid) {
      navigate('/login');
      return;
    }
    setUser(loggedUser);
    fetchTickets(loggedUser.uid);
  }, [navigate]);

  const fetchTickets = async (userId) => {
    try {
      const response = await axios.get(`${API}/support/tickets/user/${userId}`);
      setTickets(response.data.tickets || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    
    if (!formData.subject || !formData.description) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      await axios.post(`${API}/support/tickets/create`, {
        user_id: user.uid,
        category: formData.category,
        subject: formData.subject,
        description: formData.description,
        attachments: []
      });

      toast.success('Support ticket created successfully!');
      setShowCreateModal(false);
      setFormData({
        category: 'Technical',
        subject: '',
        description: ''
      });
      fetchTickets(user.uid);
    } catch (error) {
      console.error('Error creating ticket:', error);
      toast.error(error.response?.data?.detail || 'Failed to create ticket');
    }
  };

  const handleViewTicket = async (ticketId) => {
    try {
      const response = await axios.get(`${API}/support/tickets/${ticketId}`);
      setSelectedTicket(response.data);
    } catch (error) {
      console.error('Error fetching ticket details:', error);
      toast.error('Failed to load ticket details');
    }
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    try {
      await axios.post(`${API}/support/tickets/${selectedTicket.ticket_id}/reply`, {
        ticket_id: selectedTicket.ticket_id,
        user_id: user.uid,
        message: replyMessage
      });

      toast.success('Reply sent successfully');
      setReplyMessage('');
      handleViewTicket(selectedTicket.ticket_id); // Refresh ticket details
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'in_progress': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'resolved': return 'bg-green-100 text-green-700 border-green-300';
      case 'closed': return 'bg-gray-100 text-gray-700 border-gray-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return <Clock className="h-4 w-4" />;
      case 'in_progress': return <AlertCircle className="h-4 w-4" />;
      case 'resolved': return <CheckCircle className="h-4 w-4" />;
      case 'closed': return <XCircle className="h-4 w-4" />;
      default: return <Ticket className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tickets...</p>
        </div>
      </div>
    );
  }

  if (selectedTicket) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
        <div className="max-w-4xl mx-auto">
          <Button
            onClick={() => setSelectedTicket(null)}
            variant="outline"
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tickets
          </Button>

          <Card className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedTicket.subject}</h2>
                <p className="text-sm text-gray-600 mt-1">Ticket ID: {selectedTicket.ticket_id}</p>
                <p className="text-sm text-gray-600">Category: {selectedTicket.category}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(selectedTicket.status)} flex items-center gap-2`}>
                {getStatusIcon(selectedTicket.status)}
                {selectedTicket.status}
              </span>
            </div>

            <div className="border-t pt-4 mb-6">
              <p className="text-gray-700 whitespace-pre-wrap">{selectedTicket.description}</p>
              <p className="text-xs text-gray-500 mt-2">
                Created: {new Date(selectedTicket.created_at).toLocaleString()}
              </p>
            </div>

            {/* Replies */}
            <div className="space-y-4 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Replies ({selectedTicket.replies?.length || 0})
              </h3>
              {selectedTicket.replies && selectedTicket.replies.length > 0 ? (
                <div className="space-y-3">
                  {selectedTicket.replies.map((reply) => (
                    <div
                      key={reply.reply_id}
                      className={`p-4 rounded-lg ${
                        reply.user_role === 'admin' || reply.user_role === 'sub_admin'
                          ? 'bg-blue-50 border border-blue-200'
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-gray-900">
                          {reply.user_name}
                          {(reply.user_role === 'admin' || reply.user_role === 'sub_admin') && (
                            <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded">
                              Admin
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(reply.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{reply.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No replies yet</p>
              )}
            </div>

            {/* Reply Input */}
            {selectedTicket.status !== 'closed' && (
              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-900 mb-2">Add Reply</h4>
                <textarea
                  className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows="4"
                  placeholder="Type your message..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                />
                <Button
                  onClick={handleSendReply}
                  className="mt-2 bg-purple-600 hover:bg-purple-700"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send Reply
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Support Tickets</h1>
            <p className="text-gray-600 mt-1">Get help from our support team</p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Ticket
          </Button>
        </div>

        {/* Tickets List */}
        <div className="space-y-4">
          {tickets.length === 0 ? (
            <Card className="p-12 text-center">
              <Ticket className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Support Tickets</h3>
              <p className="text-gray-600 mb-4">
                You haven't created any support tickets yet
              </p>
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Create Your First Ticket
              </Button>
            </Card>
          ) : (
            tickets.map((ticket) => (
              <Card
                key={ticket.ticket_id}
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleViewTicket(ticket.ticket_id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{ticket.subject}</h3>
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                        {ticket.category}
                      </span>
                    </div>
                    <p className="text-gray-600 line-clamp-2">{ticket.description}</p>
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                      <span>Ticket ID: {ticket.ticket_id.substring(0, 8)}</span>
                      <span>Created: {new Date(ticket.created_at).toLocaleDateString()}</span>
                      <span>Updated: {new Date(ticket.updated_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(ticket.status)} flex items-center gap-2 whitespace-nowrap`}>
                    {getStatusIcon(ticket.status)}
                    {ticket.status}
                  </span>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Create Ticket Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Support Ticket</h2>
              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    className="w-full border rounded-lg p-2"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject *
                  </label>
                  <Input
                    type="text"
                    placeholder="Brief description of your issue"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows="6"
                    placeholder="Describe your issue in detail..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setFormData({
                        category: 'Technical',
                        subject: '',
                        description: ''
                      });
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    Create Ticket
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportTickets;
