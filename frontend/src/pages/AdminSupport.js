import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Pagination from '@/components/Pagination';
import {
  Ticket, Search, MessageCircle, CheckCircle, XCircle, Clock,
  Send, RefreshCw, User, AlertCircle
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const ITEMS_PER_PAGE = 10;

const AdminSupport = ({ user }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [processing, setProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchTickets();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/admin/support/tickets`);
      // API returns { tickets: [], total: number, ... }
      setTickets(response.data?.tickets || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to fetch support tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return;

    try {
      setProcessing(true);
      await axios.post(`${API}/support/tickets/${selectedTicket.ticket_id}/reply`, {
        message: replyMessage,
        is_admin: true,
        admin_id: user?.uid,
        admin_name: user?.name || 'Admin'
      });
      toast.success('Reply sent successfully');
      setReplyMessage('');
      fetchTickets();
      // Refresh selected ticket
      const updated = tickets.find(t => t.ticket_id === selectedTicket.ticket_id);
      if (updated) {
        setSelectedTicket({...updated, messages: [...(updated.messages || []), { message: replyMessage, is_admin: true, created_at: new Date().toISOString() }]});
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateStatus = async (ticketId, newStatus) => {
    try {
      await axios.put(`${API}/support/tickets/${ticketId}/status`, {
        status: newStatus,
        admin_id: user?.uid
      });
      toast.success(`Ticket ${newStatus}`);
      fetchTickets();
      if (selectedTicket?.ticket_id === ticketId) {
        setSelectedTicket({...selectedTicket, status: newStatus});
      }
    } catch (error) {
      console.error('Error updating ticket:', error);
      toast.error('Failed to update ticket');
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.ticket_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.user_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getStatusBadge = (status) => {
    const badges = {
      'open': <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full flex items-center gap-1"><Clock className="h-3 w-3" /> Open</span>,
      'in_progress': <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full flex items-center gap-1"><MessageCircle className="h-3 w-3" /> In Progress</span>,
      'resolved': <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Resolved</span>,
      'closed': <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full flex items-center gap-1"><XCircle className="h-3 w-3" /> Closed</span>
    };
    return badges[status] || badges['open'];
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      'high': <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">High</span>,
      'medium': <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">Medium</span>,
      'low': <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">Low</span>
    };
    return badges[priority] || badges['medium'];
  };

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
        <p className="text-gray-500">Manage customer support requests</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-600">Total Tickets</p>
          <p className="text-2xl font-bold text-blue-700">{stats.total}</p>
        </Card>
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <p className="text-xs text-yellow-600">Open</p>
          <p className="text-2xl font-bold text-yellow-700">{stats.open}</p>
        </Card>
        <Card className="p-4 bg-purple-50 border-purple-200">
          <p className="text-xs text-purple-600">In Progress</p>
          <p className="text-2xl font-bold text-purple-700">{stats.inProgress}</p>
        </Card>
        <Card className="p-4 bg-green-50 border-green-200">
          <p className="text-xs text-green-600">Resolved</p>
          <p className="text-2xl font-bold text-green-700">{stats.resolved}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <Button onClick={fetchTickets} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </Card>

      {/* Tickets List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading tickets...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <Card className="p-12 text-center">
          <Ticket className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No support tickets found</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredTickets.map((ticket) => (
            <Card 
              key={ticket.ticket_id} 
              className={`p-4 cursor-pointer hover:shadow-md transition-shadow ${selectedTicket?.ticket_id === ticket.ticket_id ? 'ring-2 ring-purple-500' : ''}`}
              onClick={() => setSelectedTicket(ticket)}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Ticket className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{ticket.subject}</p>
                    <p className="text-sm text-gray-500">{ticket.user_name || ticket.user_id}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {ticket.category} • {new Date(ticket.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getPriorityBadge(ticket.priority)}
                  {getStatusBadge(ticket.status)}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{selectedTicket.subject}</h2>
                  <p className="text-sm text-gray-500">#{selectedTicket.ticket_id?.slice(-8)}</p>
                </div>
                <button onClick={() => setSelectedTicket(null)} className="text-gray-500 hover:text-gray-700 text-2xl">
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Ticket Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <p className="text-xs text-gray-500">Customer</p>
                  <p className="font-medium">{selectedTicket.user_name || selectedTicket.user_id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Category</p>
                  <p className="font-medium">{selectedTicket.category}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  {getStatusBadge(selectedTicket.status)}
                </div>
                <div>
                  <p className="text-xs text-gray-500">Priority</p>
                  {getPriorityBadge(selectedTicket.priority)}
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <p className="text-xs text-gray-500 mb-2">Description</p>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>
              </div>

              {/* Messages Thread */}
              <div className="mb-6">
                <p className="text-xs text-gray-500 mb-2">Conversation</p>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {selectedTicket.messages?.map((msg, idx) => (
                    <div key={idx} className={`p-3 rounded-lg ${msg.is_admin ? 'bg-purple-50 ml-8' : 'bg-gray-50 mr-8'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-4 w-4" />
                        <span className="text-sm font-medium">{msg.is_admin ? 'Admin' : 'Customer'}</span>
                        <span className="text-xs text-gray-400">{new Date(msg.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-700">{msg.message}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Actions */}
              {selectedTicket.status !== 'closed' && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedTicket.status === 'open' && (
                    <Button size="sm" onClick={() => handleUpdateStatus(selectedTicket.ticket_id, 'in_progress')}>
                      Start Working
                    </Button>
                  )}
                  {selectedTicket.status === 'in_progress' && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleUpdateStatus(selectedTicket.ticket_id, 'resolved')}>
                      Mark Resolved
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(selectedTicket.ticket_id, 'closed')}>
                    Close Ticket
                  </Button>
                </div>
              )}
            </div>

            {/* Reply Input */}
            {selectedTicket.status !== 'closed' && (
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your reply..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleReply()}
                  />
                  <Button onClick={handleReply} disabled={processing || !replyMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminSupport;
