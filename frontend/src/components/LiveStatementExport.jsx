import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { 
  FileText, Download, Calendar, Filter,
  FileSpreadsheet, Loader2, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';

const API = process.env.REACT_APP_BACKEND_URL || '';

/**
 * Live Statement Export Component
 * Allows users to download PRC statements in PDF/CSV format
 * Google Play Compliant - Header includes disclaimer
 */
const LiveStatementExport = ({ userId, translations = {} }) => {
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState('pdf');
  const [dateRange, setDateRange] = useState('month'); // week, month, quarter, year
  const [downloadComplete, setDownloadComplete] = useState(false);

  const t = (key) => translations[key] || defaultTranslations[key] || key;

  const defaultTranslations = {
    statementExport: 'PRC Statement',
    downloadStatement: 'Download Statement',
    selectFormat: 'Format',
    selectPeriod: 'Period',
    lastWeek: 'Last 7 Days',
    lastMonth: 'Last 30 Days',
    lastQuarter: 'Last 3 Months',
    lastYear: 'Last Year',
    generating: 'Generating...',
    downloadReady: 'Download Ready!',
    disclaimer: 'Reward Points Statement – Not a Financial Investment'
  };

  const periods = [
    { value: 'week', label: t('lastWeek') },
    { value: 'month', label: t('lastMonth') },
    { value: 'quarter', label: t('lastQuarter') },
    { value: 'year', label: t('lastYear') }
  ];

  const handleDownload = async () => {
    setLoading(true);
    setDownloadComplete(false);

    try {
      const response = await axios.get(
        `${API}/api/user/statement/${userId}`,
        {
          params: { format, period: dateRange },
          responseType: format === 'pdf' ? 'blob' : 'text'
        }
      );

      // Create download link
      const blob = format === 'pdf' 
        ? new Blob([response.data], { type: 'application/pdf' })
        : new Blob([response.data], { type: 'text/csv' });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `prc_statement_${dateRange}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setDownloadComplete(true);
      toast.success('Statement downloaded successfully!');
      
      setTimeout(() => setDownloadComplete(false), 3000);
    } catch (error) {
      console.error('Download error:', error);
      // Generate client-side statement as fallback
      generateClientStatement();
    } finally {
      setLoading(false);
    }
  };

  const generateClientStatement = () => {
    // Generate a simple CSV statement client-side
    const headers = 'Date,Type,Description,PRC Amount,Balance\n';
    const disclaimer = `"${t('disclaimer')}"\n\n`;
    const content = disclaimer + headers + 'Sample data - Full statement requires backend connection\n';
    
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prc_statement_${dateRange}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    toast.success('Statement generated');
  };

  return (
    <div className="px-4 mb-4" data-testid="statement-export">
      <motion.div 
        className="bg-white rounded-2xl shadow-lg overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-blue-500 to-cyan-600 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold">{t('statementExport')}</h3>
              <p className="text-xs text-white/80">{t('disclaimer')}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Format Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              {t('selectFormat')}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setFormat('pdf')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg border-2 transition-colors ${
                  format === 'pdf'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
              <button
                onClick={() => setFormat('csv')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg border-2 transition-colors ${
                  format === 'csv'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                CSV
              </button>
            </div>
          </div>

          {/* Period Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              {t('selectPeriod')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {periods.map(period => (
                <button
                  key={period.value}
                  onClick={() => setDateRange(period.value)}
                  className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                    dateRange === period.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>

          {/* Download Button */}
          <Button
            onClick={handleDownload}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white py-3"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('generating')}
              </>
            ) : downloadComplete ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                {t('downloadReady')}
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                {t('downloadStatement')}
              </>
            )}
          </Button>

          {/* Disclaimer */}
          <p className="text-[10px] text-gray-400 text-center">
            {t('disclaimer')}
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LiveStatementExport;
