import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Pagination from '@/components/Pagination';
import {
  Ticket, Search, MessageCircle, CheckCircle, XCircle, Clock,
  Send, RefreshCw, User, AlertCircle, Filter, ChevronDown,
  Calendar, Tag, UserCircle, FileText, ExternalLink, Phone,
  Mail, Hash, Timer, ArrowRight, MessageSquare, Shield,
  Star, Zap, Eye, MoreVertical, Copy, Trash2, Archive
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const ITEMS_PER_PAGE = 10;

const AdminSupport = ({ user }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketReplies, setTicketReplies] = useState([]);
  const [replyMessage, setReplyMessage] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, priorityFilter, categoryFilter]);

  useEffect(() => {
    if (selectedTicket) {
      fetchTicketDetails(selectedTicket.ticket_id);
    }
  }, [selectedTicket?.ticket_id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [ticketReplies]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/admin/support/tickets`);
      setTickets(response.data?.tickets || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to fetch support tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketDetails = async (ticketId) => {
    try {
      setLoadingReplies(true);
      const response = await axios.get(`${API}/support/tickets/${ticketId}`);
      if (response.data) {
        setTicketReplies(response.data.replies || []);
        // Update selected ticket with full details
        setSelectedTicket(prev => ({
          ...prev,
          ...response.data.ticket
        }));
      }
    } catch (error) {
      console.error('Error fetching ticket details:', error);
    } finally {
      setLoadingReplies(false);
    }
  };

  const handleReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return;

    try {
      setProcessing(true);
      await axios.post(`${API}/support/tickets/${selectedTicket.ticket_id}/reply`, {
        user_id: user?.uid,
        message: replyMessage
      });
      toast.success('Reply sent successfully');
      setReplyMessage('');
      fetchTicketDetails(selectedTicket.ticket_id);
      fetchTickets();
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error(error.response?.data?.detail || 'Failed to send reply');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateTicket = async (ticketId, updates) => {
    try {
      setProcessing(true);
      await axios.put(`${API}/admin/support/tickets/${ticketId}`, updates);
      toast.success('Ticket updated successfully');
      fetchTickets();
      if (selectedTicket?.ticket_id === ticketId) {
        setSelectedTicket(prev => ({ ...prev, ...updates }));
      }
    } catch (error) {
      console.error('Error updating ticket:', error);
      toast.error(error.response?.data?.detail || 'Failed to update ticket');
    } finally {
      setProcessing(false);
    }
  };

  const handleStatusChange = (ticketId, newStatus) => {
    handleUpdateTicket(ticketId, { status: newStatus });
  };

  const handlePriorityChange = (ticketId, newPriority) => {
    handleUpdateTicket(ticketId, { priority: newPriority });
  };

  const copyTicketId = (ticketId) => {
    navigator.clipboard.writeText(ticketId);
    toast.success('Ticket ID copied!');
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.ticket_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    const matchesCategory = categoryFilter === 'all' || ticket.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
  });

  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const categories = [...new Set(tickets.map(t => t.category).filter(Boolean))];

  const getStatusBadge = (status) => {
    const badges = {
      'open': (
        <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full flex items-center gap-1.5 font-medium">
          <Clock className="h-3 w-3" /> Open
        </span>
      ),
      'in_progress': (
        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full flex items-center gap-1.5 font-medium">
          <Zap className="h-3 w-3" /> In Progress
        </span>
      ),
      'resolved': (
        <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1.5 font-medium">
          <CheckCircle className="h-3 w-3" /> Resolved
        </span>
      ),
      'closed': (
        <span className="px-3 py-1 bg-gray-700 text-gray-300 text-xs rounded-full flex items-center gap-1.5 font-medium">
          <Archive className="h-3 w-3" /> Closed
        </span>
      )
    };
    return badges[status] || badges['open'];
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      'high': (
        <span className="px-3 py-1 bg-red-500/20 text-red-400 text-xs rounded-full flex items-center gap-1.5 font-medium">
          <AlertCircle className="h-3 w-3" /> High
        </span>
      ),
      'medium': (
        <span className="px-3 py-1 bg-orange-500/20 text-orange-400 text-xs rounded-full flex items-center gap-1.5 font-medium">
          <Timer className="h-3 w-3" /> Medium
        </span>
      ),
      'low': (
        <span className="px-3 py-1 bg-gray-700 text-gray-300 text-xs rounded-full flex items-center gap-1.5 font-medium">
          <Clock className="h-3 w-3" /> Low
        </span>
      )
    };
    return badges[priority] || badges['medium'];
  };

  const getTimeSince = (date) => {
    const now = new Date();
    const created = new Date(date);
    const diffMs = now - created;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Just now';
  };

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length,
    highPriority: tickets.filter(t => t.priority === 'high' && t.status !== 'closed').length
  };

  return (
    <div className="p-4 lg:p-6 min-h-screen bg-gray-950">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Ticket className="h-5 w-5 text-white" />
            </div>
            Support Center
          </h1>
          <p className="text-gray-400 mt-1">Manage customer support tickets efficiently</p>
        </div>
        <Button onClick={fetchTickets} className="bg-gray-800 hover:bg-gray-700 border border-gray-700">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="p-4 bg-gradient-to-br from-blue-900/30 to-blue-800/10 border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-400 font-medium">Total Tickets</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
            </div>
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Ticket className="h-5 w-5 text-blue-400" />
            </div>
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-yellow-900/30 to-yellow-800/10 border-yellow-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-yellow-400 font-medium">Open</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.open}</p>
            </div>
            <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-400" />
            </div>
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-purple-900/30 to-purple-800/10 border-purple-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-purple-400 font-medium">In Progress</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.inProgress}</p>
            </div>
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Zap className="h-5 w-5 text-purple-400" />
            </div>
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-green-900/30 to-green-800/10 border-green-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-400 font-medium">Resolved</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.resolved}</p>
            </div>
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-400" />
            </div>
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-red-900/30 to-red-800/10 border-red-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-red-400 font-medium">High Priority</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.highPriority}</p>
            </div>
            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="p-4 mb-6 bg-gray-900/50 border-gray-800">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by ticket ID, subject, customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <Button 
              variant="outline" 
              onClick={() => setShowFilters(!showFilters)}
              className="bg-gray-800 border-gray-700 text-gray-300"
            >
              <Filter className="h-4 w-4 mr-2" /> 
              Filters
              <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>
          </div>
          
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-800">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                >
                  <option value="all">All Priority</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                >
                  <option value="all">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Tickets List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading tickets...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <Card className="p-12 text-center bg-gray-900/50 border-gray-800">
          <Ticket className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Tickets Found</h3>
          <p className="text-gray-400">No support tickets match your search criteria</p>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {paginatedTickets.map((ticket) => (
              <Card 
                key={ticket.ticket_id} 
                className={`p-4 cursor-pointer transition-all hover:border-purple-500/50 bg-gray-900/50 border-gray-800 ${
                  selectedTicket?.ticket_id === ticket.ticket_id ? 'ring-2 ring-purple-500 border-purple-500' : ''
                }`}
                onClick={() => setSelectedTicket(ticket)}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-3 rounded-xl flex-shrink-0 ${
                      ticket.priority === 'high' ? 'bg-red-500/20' : 
                      ticket.priority === 'medium' ? 'bg-orange-500/20' : 'bg-gray-800'
                    }`}>
                      <MessageSquare className={`h-6 w-6 ${
                        ticket.priority === 'high' ? 'text-red-400' : 
                        ticket.priority === 'medium' ? 'text-orange-400' : 'text-gray-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white truncate">{ticket.subject}</h3>
                        <span className="text-xs text-gray-500 font-mono">#{ticket.ticket_id?.slice(-8)}</span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1 line-clamp-1">{ticket.description}</p>
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <UserCircle className="h-3 w-3" />
                          {ticket.user_name || 'Unknown User'}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {ticket.category || 'General'}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {getTimeSince(ticket.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {getPriorityBadge(ticket.priority)}
                    {getStatusBadge(ticket.status)}
                  </div>
                </div>
              </Card>
            ))}
          </div>
          
          <div className="mt-6">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredTickets.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          </div>
        </>
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-gray-900 border-gray-800">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-800 bg-gray-900/80">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl font-bold text-white">{selectedTicket.subject}</h2>
                    <button 
                      onClick={() => copyTicketId(selectedTicket.ticket_id)}
                      className="text-xs text-gray-400 font-mono bg-gray-800 px-2 py-1 rounded flex items-center gap-1 hover:bg-gray-700"
                    >
                      <Hash className="h-3 w-3" />
                      {selectedTicket.ticket_id?.slice(-8)}
                      <Copy className="h-3 w-3 ml-1" />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    <span className="text-sm text-gray-400 flex items-center gap-1">
                      <UserCircle className="h-4 w-4" />
                      {selectedTicket.user_name || selectedTicket.user_id}
                    </span>
                    <span className="text-sm text-gray-400 flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(selectedTicket.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedTicket(null)} 
                  className="text-gray-400 hover:text-white p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Ticket Info Bar */}
            <div className="px-6 py-3 bg-gray-800/50 border-b border-gray-800 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Status:</span>
                <select
                  value={selectedTicket.status}
                  onChange={(e) => handleStatusChange(selectedTicket.ticket_id, e.target.value)}
                  className="text-xs bg-gray-700 border-0 rounded px-2 py-1 text-white"
                  disabled={processing}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Priority:</span>
                <select
                  value={selectedTicket.priority}
                  onChange={(e) => handlePriorityChange(selectedTicket.ticket_id, e.target.value)}
                  className="text-xs bg-gray-700 border-0 rounded px-2 py-1 text-white"
                  disabled={processing}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Category:</span>
                <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
                  {selectedTicket.category || 'General'}
                </span>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Original Description */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Original Message
                </h4>
                <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                  <p className="text-gray-300 whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>
              </div>

              {/* Conversation Thread */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Conversation ({ticketReplies.length} replies)
                </h4>
                
                {loadingReplies ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                  </div>
                ) : ticketReplies.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No replies yet. Start the conversation!</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {ticketReplies.map((reply, idx) => (
                      <div 
                        key={reply.reply_id || idx}
                        className={`flex ${reply.user_role === 'admin' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] ${
                          reply.user_role === 'admin' 
                            ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white' 
                            : 'bg-gray-800 text-gray-200'
                        } rounded-2xl p-4`}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              reply.user_role === 'admin' ? 'bg-white/20' : 'bg-purple-500/30'
                            }`}>
                              {reply.user_role === 'admin' ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                            </div>
                            <span className="text-xs font-medium">
                              {reply.user_name || (reply.user_role === 'admin' ? 'Admin' : 'Customer')}
                            </span>
                            <span className="text-xs opacity-70">
                              {new Date(reply.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{reply.message}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              {selectedTicket.status !== 'closed' && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedTicket.status === 'open' && (
                    <Button 
                      size="sm" 
                      onClick={() => handleStatusChange(selectedTicket.ticket_id, 'in_progress')}
                      disabled={processing}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Zap className="h-4 w-4 mr-1" /> Start Working
                    </Button>
                  )}
                  {selectedTicket.status === 'in_progress' && (
                    <Button 
                      size="sm" 
                      onClick={() => handleStatusChange(selectedTicket.ticket_id, 'resolved')}
                      disabled={processing}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" /> Mark Resolved
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleStatusChange(selectedTicket.ticket_id, 'closed')}
                    disabled={processing}
                    className="border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    <Archive className="h-4 w-4 mr-1" /> Close Ticket
                  </Button>
                </div>
              )}
            </div>

            {/* Reply Input */}
            {selectedTicket.status !== 'closed' && (
              <div className="p-4 border-t border-gray-800 bg-gray-900/80">
                <div className="flex gap-3">
                  <Input
                    placeholder="Type your reply to the customer..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleReply()}
                    className="flex-1 bg-gray-800 border-gray-700 text-white"
                    disabled={processing}
                  />
                  <Button 
                    onClick={handleReply} 
                    disabled={processing || !replyMessage.trim()}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    {processing ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" /> Send
                      </>
                    )}
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
