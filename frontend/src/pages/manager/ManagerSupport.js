import { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/manager/StatusBadge';
import notifications from '@/utils/notifications';
import { HelpCircle, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ManagerSupport = ({ user, onLogout }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [response, setResponse] = useState('');
  const [newStatus, setNewStatus] = useState('');

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, priorityFilter]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params = { uid: user.uid };
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;

      const response = await axios.get(`${API}/manager/tickets`, { params });
      setTickets(response.data.tickets);
    } catch (error) {
      console.error('Error:', error);
      notifications.error('Error', 'Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  };

  const updateTicket = async () => {
    try {
      const updateData = {};
      if (response) updateData.response = response;
      if (newStatus) updateData.status = newStatus;

      await axios.put(
        `${API}/manager/tickets/${selectedTicket.ticket_id}`,
        updateData,
        { params: { uid: user.uid } }
      );
      
      notifications.success('Ticket Updated', 'Support ticket has been updated successfully');
      setShowTicketModal(false);
      setResponse('');
      setNewStatus('');
      fetchTickets();
    } catch (error) {
      notifications.error('Update Failed', error.response?.data?.detail || 'Failed to update ticket');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Support Tickets</h1>
          <p className="text-gray-600">Manage customer support requests</p>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-6">
          <div className="flex gap-4">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg">
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg">
              <option value="">All Priority</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </Card>

        {/* Tickets Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y">
                {loading ? (
                  <tr><td colSpan="7" className="px-6 py-12 text-center"><div className="flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div><span className="ml-3">Loading...</span></div></td></tr>
                ) : tickets.length === 0 ? (
                  <tr><td colSpan="7" className="px-6 py-12 text-center text-gray-500"><HelpCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" /><p>No tickets found</p></td></tr>
                ) : (
                  tickets.map((ticket) => (
                    <tr key={ticket.ticket_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-mono">{ticket.ticket_id?.slice(0, 8)}</td>
                      <td className="px-6 py-4"><div className="text-sm font-medium">{ticket.user_name}</div><div className="text-sm text-gray-500">{ticket.user_email}</div></td>
                      <td className="px-6 py-4 text-sm">{ticket.subject || 'N/A'}</td>
                      <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-semibold ${ticket.priority === 'urgent' ? 'bg-red-100 text-red-800' : ticket.priority === 'high' ? 'bg-orange-100 text-orange-800' : ticket.priority === 'normal' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{ticket.priority?.toUpperCase()}</span></td>
                      <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-semibold ${ticket.status === 'open' ? 'bg-yellow-100 text-yellow-800' : ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{ticket.status?.replace('_', ' ').toUpperCase()}</span></td>
                      <td className="px-6 py-4 text-sm">{ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : 'N/A'}</td>
                      <td className="px-6 py-4"><Button size="sm" variant="outline" onClick={() => { setSelectedTicket(ticket); setShowTicketModal(true); }}><Eye className="h-4 w-4 mr-1" />View</Button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Ticket Detail Modal */}
        <Dialog open={showTicketModal} onOpenChange={setShowTicketModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Ticket Details</DialogTitle>
              <DialogDescription>View and update support ticket</DialogDescription>
            </DialogHeader>
            
            {selectedTicket && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium text-gray-600">Ticket ID</label><p className="font-mono">{selectedTicket.ticket_id}</p></div>
                  <div><label className="text-sm font-medium text-gray-600">User</label><p>{selectedTicket.user_name}</p></div>
                  <div><label className="text-sm font-medium text-gray-600">Subject</label><p>{selectedTicket.subject}</p></div>
                  <div><label className="text-sm font-medium text-gray-600">Priority</label><div className="mt-1"><span className={`px-2 py-1 rounded text-xs font-semibold ${selectedTicket.priority === 'urgent' ? 'bg-red-100 text-red-800' : selectedTicket.priority === 'high' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>{selectedTicket.priority?.toUpperCase()}</span></div></div>
                </div>

                <div><label className="text-sm font-medium text-gray-600 block mb-2">Message</label><div className="p-4 bg-gray-50 rounded-lg"><p className="text-gray-900">{selectedTicket.message || 'No message'}</p></div></div>

                <div><label className="text-sm font-medium mb-2 block">Update Status</label><select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg"><option value="">Keep current status</option><option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option></select></div>

                <div><label className="text-sm font-medium mb-2 block">Your Response</label><Textarea placeholder="Type your response to the user..." value={response} onChange={(e) => setResponse(e.target.value)} rows={4} /></div>
                
                <div className="flex gap-3">
                  <Button onClick={() => setShowTicketModal(false)} variant="outline" className="flex-1">Cancel</Button>
                  <Button onClick={updateTicket} className="flex-1 bg-purple-600 hover:bg-purple-700">Update Ticket</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ManagerSupport;