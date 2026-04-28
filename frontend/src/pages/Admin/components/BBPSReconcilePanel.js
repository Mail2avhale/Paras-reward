import React from 'react';
import { Button } from '../../../components/ui/button';
import {
  Upload, FileSpreadsheet, Loader2, Wrench, ChevronDown, ChevronUp,
  CheckCircle, AlertCircle, AlertTriangle
} from 'lucide-react';

/**
 * BBPS Reconciliation panel — collapsible section for uploading Eko Excel
 * and cross-referencing/applying fixes. Extracted from AdminBBPSDashboard.js
 * to reduce that file's size. Self-contained; parent owns all state.
 */
const BBPSReconcilePanel = ({
  showReconcile,
  setShowReconcile,
  reconcileLoading,
  reconcileData,
  reconcileFixLoading,
  handleReconcileUpload,
  handleApplyFixes,
}) => {
  return (
    <div className="mb-6">
      <button
        onClick={() => setShowReconcile(!showReconcile)}
        className="w-full flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-4 hover:bg-amber-100 transition-colors"
        data-testid="reconcile-toggle-btn"
      >
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-5 w-5 text-amber-600" />
          <span className="font-semibold text-amber-800">Eko Reconciliation Tool</span>
          <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Upload Eko Excel</span>
        </div>
        {showReconcile ? <ChevronUp className="h-5 w-5 text-amber-600" /> : <ChevronDown className="h-5 w-5 text-amber-600" />}
      </button>

      {showReconcile && (
        <div className="border border-amber-200 border-t-0 rounded-b-xl bg-white p-4 space-y-4">
          {/* Upload Section */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg cursor-pointer transition-colors font-semibold">
              <Upload className="h-4 w-4" />
              {reconcileLoading ? 'Analyzing...' : 'Upload Eko Excel'}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleReconcileUpload}
                className="hidden"
                disabled={reconcileLoading}
                data-testid="reconcile-upload-input"
              />
            </label>
            {reconcileLoading && <Loader2 className="h-5 w-5 animate-spin text-amber-600" />}
            <p className="text-xs text-slate-500">Upload the Excel downloaded from Eko portal</p>
          </div>

          {/* Results */}
          {reconcileData && (
            <div className="space-y-4">
              {/* Stats Summary */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3" data-testid="reconcile-stats">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{reconcileData.stats.total_excel}</p>
                  <p className="text-xs text-blue-600 font-medium">Total Entries</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{reconcileData.stats.eko_success_count || 0}</p>
                  <p className="text-xs text-green-600 font-medium">Eko Success</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{reconcileData.stats.eko_fail_count || 0}</p>
                  <p className="text-xs text-red-600 font-medium">Eko Fail</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-orange-700">{reconcileData.stats.eko_refunded_count || 0}</p>
                  <p className="text-xs text-orange-600 font-medium">Eko Refunded</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-purple-700">{reconcileData.stats.matched}</p>
                  <p className="text-xs text-purple-600 font-medium">DB Matched</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-slate-700">₹{(reconcileData.stats.total_amount || 0).toLocaleString()}</p>
                  <p className="text-xs text-slate-600 font-medium">Total Amount</p>
                </div>
              </div>

              {/* Action Items Alert */}
              {reconcileData.stats.eko_success_internal_failed > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <span className="text-red-700 font-semibold">
                      {reconcileData.stats.eko_success_internal_failed} Eko Success transactions need fixing
                      {reconcileData.stats.needs_prc_reclaim > 0 && ` | PRC Reclaim: ₹${reconcileData.stats.total_prc_to_reclaim?.toLocaleString()}`}
                    </span>
                  </div>
                  <Button
                    onClick={() => {
                      const fixes = reconcileData.results
                        .filter(r => r.action !== 'OK' && r.action !== 'UNMATCHED' && r.action !== 'REVIEW')
                        .map(r => ({
                          request_id: r.request_id,
                          action: r.action,
                          eko_tid: r.eko_tid,
                          match_source: r.match_source,
                          eko_amount: r.eko_amount,
                          customer_id: r.customer_id,
                          client_ref_id: r.client_ref_id,
                          date: r.date
                        }));
                      handleApplyFixes(fixes);
                    }}
                    disabled={reconcileFixLoading}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                    data-testid="apply-all-fixes-btn"
                  >
                    {reconcileFixLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wrench className="h-4 w-4 mr-2" />}
                    Fix All
                  </Button>
                </div>
              )}

              {/* Full Excel Data Table */}
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">
                  All Eko Transactions ({reconcileData.results?.length || 0})
                </h3>
                <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800 text-white sticky top-0">
                      <tr>
                        <th className="text-left p-2 text-xs font-semibold">#</th>
                        <th className="text-left p-2 text-xs font-semibold">Date</th>
                        <th className="text-left p-2 text-xs font-semibold">Eko TID</th>
                        <th className="text-left p-2 text-xs font-semibold">Client Ref ID</th>
                        <th className="text-left p-2 text-xs font-semibold">Mobile</th>
                        <th className="text-right p-2 text-xs font-semibold">Amount</th>
                        <th className="text-left p-2 text-xs font-semibold">Type</th>
                        <th className="text-left p-2 text-xs font-semibold">Eko Status</th>
                        <th className="text-left p-2 text-xs font-semibold">DB Match</th>
                        <th className="text-left p-2 text-xs font-semibold">Internal Status</th>
                        <th className="text-left p-2 text-xs font-semibold">PRC Refunded</th>
                        <th className="text-right p-2 text-xs font-semibold">Fee</th>
                        <th className="text-right p-2 text-xs font-semibold">Commission</th>
                        <th className="text-left p-2 text-xs font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconcileData.results?.map((r, idx) => (
                        <tr key={r.eko_tid || r.client_ref_id || `row-${idx}`} className={`border-t border-slate-100 hover:bg-slate-50 ${
                          r.action === 'FIX_STATUS_RECLAIM_PRC' ? 'bg-red-50' :
                          r.action === 'FIX_STATUS' ? 'bg-amber-50' :
                          r.action === 'NEEDS_REFUND' ? 'bg-blue-50' : ''
                        }`}>
                          <td className="p-2 text-xs text-slate-400">{idx + 1}</td>
                          <td className="p-2 text-xs text-slate-600 whitespace-nowrap">{r.date ? r.date.split('.')[0] : '-'}</td>
                          <td className="p-2 font-mono text-xs text-slate-800">{r.eko_tid || '-'}</td>
                          <td className="p-2 font-mono text-xs text-slate-600">{r.client_ref_id || '-'}</td>
                          <td className="p-2 text-xs text-slate-700">{r.customer_id || '-'}</td>
                          <td className="p-2 text-xs font-semibold text-slate-800 text-right">₹{r.eko_amount}</td>
                          <td className="p-2 text-xs text-slate-500">{r.debit_credit || '-'}</td>
                          <td className="p-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              r.eko_status?.toLowerCase() === 'success' ? 'bg-green-100 text-green-700' :
                              r.eko_status?.toLowerCase() === 'fail' ? 'bg-red-100 text-red-700' :
                              r.eko_status?.toLowerCase() === 'refunded' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>{r.eko_status}</span>
                          </td>
                          <td className="p-2">
                            {r.matched ? (
                              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-700">Yes</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-xs text-slate-400">No</span>
                            )}
                          </td>
                          <td className="p-2">
                            {r.internal_status ? (
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                r.internal_status === 'completed' ? 'bg-green-100 text-green-700' :
                                r.internal_status === 'failed' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>{r.internal_status}</span>
                            ) : <span className="text-xs text-slate-300">-</span>}
                          </td>
                          <td className="p-2">
                            {r.prc_refunded === true ? (
                              <span className="text-orange-600 font-semibold text-xs">Yes ({r.prc_amount})</span>
                            ) : r.prc_refunded === false ? (
                              <span className="text-slate-400 text-xs">No</span>
                            ) : <span className="text-xs text-slate-300">-</span>}
                          </td>
                          <td className="p-2 text-xs text-right text-slate-500">{r.fee && r.fee !== 'N/A' ? `₹${r.fee}` : '-'}</td>
                          <td className="p-2 text-xs text-right text-slate-500">{r.commission && r.commission !== 'N/A' ? `₹${r.commission}` : '-'}</td>
                          <td className="p-2">
                            {r.action && r.action !== 'OK' && r.action !== 'UNMATCHED' ? (
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                r.action === 'FIX_STATUS_RECLAIM_PRC' ? 'bg-red-100 text-red-700' :
                                r.action === 'CREATE_COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                                r.action === 'FIX_STATUS' ? 'bg-amber-100 text-amber-700' :
                                r.action === 'NEEDS_REFUND' ? 'bg-blue-100 text-blue-700' :
                                r.action === 'REVIEW' ? 'bg-purple-100 text-purple-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {r.action === 'FIX_STATUS_RECLAIM_PRC' ? 'Fix+Reclaim' :
                                 r.action === 'CREATE_COMPLETED' ? 'Create Record' :
                                 r.action === 'FIX_STATUS' ? 'Fix Status' :
                                 r.action === 'NEEDS_REFUND' ? 'Refund PRC' :
                                 r.action}
                              </span>
                            ) : r.action === 'OK' ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : <span className="text-xs text-slate-300">-</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary line */}
              <div className="flex items-center gap-4 text-sm">
                {reconcileData.results?.filter(r => r.action === 'OK').length > 0 && (
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    {reconcileData.results.filter(r => r.action === 'OK').length} matched correctly
                  </span>
                )}
                {reconcileData.results?.filter(r => r.action === 'UNMATCHED').length > 0 && (
                  <span className="text-slate-500 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {reconcileData.results.filter(r => r.action === 'UNMATCHED').length} not found in DB
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BBPSReconcilePanel;
