import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, Download, Archive, Database, RefreshCw, 
  Users, Receipt, FileText, MessageSquare, Shield, 
  Calendar, Clock, CheckCircle, AlertTriangle, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminDataBackup = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [archiveHistory, setArchiveHistory] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [selectedExport, setSelectedExport] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, historyRes] = await Promise.all([
        axios.get(`${API}/api/admin/backup/stats`),
        axios.get(`${API}/api/admin/archive/history`)
      ]);
      setStats(statsRes.data);
      setArchiveHistory(historyRes.data.archive_logs || []);
    } catch (error) {
      console.error('Error fetching backup data:', error);
      toast.error('Failed to load backup statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      toast.info('Preparing backup... This may take a moment.');
      
      const response = await axios.get(`${API}/api/admin/backup/export?data_type=${selectedExport}&format=json`);
      
      // Create downloadable file
      const dataStr = JSON.stringify(response.data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `paras_backup_${selectedExport}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`Backup exported successfully! (${response.data.summary?.total_records || 0} records)`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export backup');
    } finally {
      setExporting(false);
    }
  };

  const handleArchive = async () => {
    if (!window.confirm('Are you sure you want to archive data older than 6 months? This will move old records to archive collections.')) {
      return;
    }
    
    try {
      setArchiving(true);
      toast.info('Archiving old data...');
      
      const response = await axios.post(`${API}/api/admin/archive/execute?months_old=6`);
      
      toast.success(`Archived ${response.data.total_archived} records successfully!`);
      fetchData(); // Refresh stats
    } catch (error) {
      console.error('Archive error:', error);
      toast.error('Failed to archive data');
    } finally {
      setArchiving(false);
    }
  };

  const exportOptions = [
    { id: 'all', label: 'All Data', icon: Database, description: 'Complete backup of all collections' },
    { id: 'users', label: 'Users', icon: Users, description: 'User accounts and balances' },
    { id: 'transactions', label: 'Transactions', icon: Receipt, description: 'All transaction history' },
    { id: 'payments', label: 'Payments', icon: FileText, description: 'VIP & bill payments' },
    { id: 'kyc', label: 'KYC Documents', icon: Shield, description: 'User verification data' },
    { id: 'messages', label: 'Messages', icon: MessageSquare, description: 'All conversations' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-5 py-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin')}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">Data Backup & Archive</h1>
            <p className="text-gray-400 text-sm">Manage your app's data</p>
          </div>
        </div>
      </div>

      {/* Database Stats */}
      <div className="px-5 py-6">
        <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-amber-500" />
          Database Statistics
        </h2>
        
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs mb-1">Total Records</p>
            <p className="text-2xl font-bold text-white">{stats?.total_records?.toLocaleString() || 0}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs mb-1">Archivable (6+ mo)</p>
            <p className="text-2xl font-bold text-amber-500">{stats?.archivable_records?.toLocaleString() || 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { label: 'Users', count: stats?.users || 0, color: 'text-blue-400' },
            { label: 'Transactions', count: stats?.transactions || 0, color: 'text-green-400' },
            { label: 'Payments', count: (stats?.vip_payments || 0) + (stats?.bill_payments || 0), color: 'text-purple-400' },
            { label: 'KYC Docs', count: stats?.kyc_documents || 0, color: 'text-amber-400' },
            { label: 'Messages', count: stats?.messages || 0, color: 'text-pink-400' },
            { label: 'Activities', count: stats?.activities || 0, color: 'text-cyan-400' },
          ].map((item, i) => (
            <div key={i} className="bg-gray-800/50 rounded-lg p-3 text-center">
              <p className={`text-lg font-bold ${item.color}`}>{item.count.toLocaleString()}</p>
              <p className="text-gray-500 text-xs">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Export Section */}
      <div className="px-5 mb-6">
        <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-emerald-500" />
          Export Backup
        </h2>

        <div className="space-y-2 mb-4">
          {exportOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setSelectedExport(option.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                selectedExport === option.id 
                  ? 'bg-emerald-500/100/20 border-emerald-500/50' 
                  : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
              }`}
            >
              <option.icon className={`w-5 h-5 ${selectedExport === option.id ? 'text-emerald-400' : 'text-gray-500'}`} />
              <div className="flex-1 text-left">
                <p className={`font-medium ${selectedExport === option.id ? 'text-emerald-400' : 'text-white'}`}>
                  {option.label}
                </p>
                <p className="text-gray-500 text-xs">{option.description}</p>
              </div>
              {selectedExport === option.id && <CheckCircle className="w-5 h-5 text-emerald-400" />}
            </button>
          ))}
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {exporting ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Download Backup ({selectedExport === 'all' ? 'All Data' : selectedExport})
            </>
          )}
        </button>
      </div>

      {/* Archive Section */}
      <div className="px-5 mb-6">
        <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <Archive className="w-5 h-5 text-amber-500" />
          Archive Old Data
        </h2>

        <div className="bg-amber-500/100/10 border border-amber-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <p className="text-amber-400 font-medium">Archive moves old data to separate collections</p>
              <p className="text-gray-400 text-sm mt-1">
                Records older than 6 months will be moved to archive. This helps keep your database fast.
                Archived data can still be viewed but won't appear in regular queries.
              </p>
            </div>
          </div>
        </div>

        {stats?.archivable_records > 0 && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mb-4">
            <p className="text-gray-400 text-sm mb-2">Records that will be archived:</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(stats?.archivable_breakdown || {}).map(([key, value]) => (
                value > 0 && (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-gray-500 capitalize">{key}</span>
                    <span className="text-amber-400 font-medium">{value.toLocaleString()}</span>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleArchive}
          disabled={archiving || stats?.archivable_records === 0}
          className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {archiving ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Archiving...
            </>
          ) : (
            <>
              <Archive className="w-5 h-5" />
              Archive Old Data ({stats?.archivable_records || 0} records)
            </>
          )}
        </button>
      </div>

      {/* Archive History */}
      {archiveHistory.length > 0 && (
        <div className="px-5">
          <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-500" />
            Archive History
          </h2>

          <div className="space-y-2">
            {archiveHistory.map((log, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-gray-900/50 border border-gray-800 rounded-xl p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">{log.total_archived} records archived</span>
                  <span className="text-gray-500 text-xs">
                    {new Date(log.archived_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(log.archived_counts || {}).map(([key, value]) => (
                    value > 0 && (
                      <span key={key} className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">
                        {key}: {value}
                      </span>
                    )
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDataBackup;
