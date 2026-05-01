import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  FileText, Download, Users, Briefcase, TrendingUp, Calendar,
  Loader2, RefreshCw, DollarSign, Award, Building2, PieChart,
  FileSpreadsheet, FileDown, UserCheck, Clock
} from 'lucide-react';

import { API } from "../../lib/api";

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const AdminEmployeeReports = () => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [poolFromDate, setPoolFromDate] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  );
  const [poolToDate, setPoolToDate] = useState(now.toISOString().slice(0, 10));

  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [downloading, setDownloading] = useState('');

  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [selectedFY, setSelectedFY] = useState(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1);
  const [ytdData, setYtdData] = useState(null);
  const [loadingYtd, setLoadingYtd] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoadingAnalytics(true);
      const res = await axios.get(`${API}/employees/reports/analytics`);
      setAnalytics(res.data);
    } catch (e) { toast.error('Failed to load analytics'); }
    finally { setLoadingAnalytics(false); }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/employees/list`);
      const list = res.data?.employees || [];
      setEmployees(list);
      if (list.length && !selectedEmp) setSelectedEmp(list[0].employee_id);
    } catch {}
  }, [selectedEmp]);

  useEffect(() => { fetchAnalytics(); fetchEmployees(); }, [fetchAnalytics, fetchEmployees]);

  const downloadReport = async (endpoint, filename, key) => {
    setDownloading(key);
    try {
      const res = await axios.get(`${API}${endpoint}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${filename} downloaded`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Download failed');
    } finally {
      setDownloading('');
    }
  };

  const years = [];
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) years.push(y);

  return (
    <div className="min-h-screen bg-white text-slate-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Employee Reports</h1>
              <p className="text-xs text-slate-500">Salary, Attendance, Pool Distribution & HR Analytics</p>
            </div>
          </div>
          <button onClick={fetchAnalytics} data-testid="refresh-btn" className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-sm">
            <RefreshCw className={`w-4 h-4 ${loadingAnalytics ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Analytics Dashboard */}
        {analytics && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <KPI icon={Users} color="emerald" label="Active Employees" value={analytics.headcount?.active || 0} />
              <KPI icon={UserCheck} color="blue" label="Total Headcount" value={analytics.headcount?.total || 0} sub={`${analytics.headcount?.attrition_rate || 0}% attrition`} />
              <KPI icon={DollarSign} color="amber" label="Monthly Cost" value={`INR ${(analytics.salary?.total_monthly_cost / 100000).toFixed(2)} L`} sub={`Avg: INR ${analytics.salary?.avg_salary?.toLocaleString() || 0}`} />
              <KPI icon={Award} color="purple" label="Pool (This Month)" value={`${analytics.pool?.this_month_distributed?.toFixed(4) || 0} PRC`} sub={`INR ${(analytics.pool?.this_month_distributed * analytics.pool?.prc_to_inr_rate || 0).toFixed(2)} disbursed`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
              {/* Departments */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Building2 className="w-4 h-4 text-indigo-600" />Department Distribution</h3>
                {analytics.departments?.length === 0 ? (
                  <p className="text-sm text-slate-500">No employees</p>
                ) : (
                  <div className="space-y-2">
                    {analytics.departments.map(d => {
                      const pct = (d.count / (analytics.headcount?.active || 1)) * 100;
                      return (
                        <div key={d.department}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-700">{d.department}</span>
                            <span className="text-slate-500">{d.count} · INR {(d.total_salary / 1000).toFixed(0)}K</span>
                          </div>
                          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top Earners */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-600" />Top Pool Earners (This Month)</h3>
                {analytics.top_earners_this_month?.length === 0 ? (
                  <p className="text-sm text-slate-500">No pool distributions this month</p>
                ) : (
                  <div className="space-y-2">
                    {analytics.top_earners_this_month.map((e, i) => (
                      <div key={e.employee_id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          i === 0 ? 'bg-amber-500/20 text-amber-600' :
                          i === 1 ? 'bg-slate-400/20 text-slate-700' :
                          i === 2 ? 'bg-orange-500/20 text-orange-600' :
                          'bg-slate-200 text-slate-500'
                        }`}>{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{e.name}</p>
                          <p className="text-xs text-slate-500">{e.department} · {e.employee_id}</p>
                        </div>
                        <span className="text-sm font-bold text-emerald-600">{e.total_prc?.toFixed(4)} PRC</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Period Selector */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
          <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-indigo-600" />Report Period</h3>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Month</label>
              <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" data-testid="month-select">
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Year</label>
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" data-testid="year-select">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Report Download Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <ReportCard
            icon={FileSpreadsheet}
            color="emerald"
            title="Salary Register"
            description={`Monthly salary sheet — all active employees with CTC breakup, deductions (PF, ESI, PT, TDS, LOP), net salary & employer contributions.`}
            btnLabel="Download Excel"
            isLoading={downloading === 'salary-register'}
            onDownload={() => downloadReport(
              `/employees/reports/salary-register?month=${selectedMonth}&year=${selectedYear}`,
              `Salary_Register_${MONTHS[selectedMonth - 1]}_${selectedYear}.xlsx`,
              'salary-register'
            )}
            testid="dl-salary-register"
          />

          <ReportCard
            icon={Clock}
            color="blue"
            title="Attendance Sheet"
            description={`Day-wise attendance matrix for all employees. Color-coded Present/Absent/Half-day/Leave/Holiday with monthly summary.`}
            btnLabel="Download Excel"
            isLoading={downloading === 'attendance'}
            onDownload={() => downloadReport(
              `/employees/reports/attendance?month=${selectedMonth}&year=${selectedYear}`,
              `Attendance_${MONTHS[selectedMonth - 1]}_${selectedYear}.xlsx`,
              'attendance'
            )}
            testid="dl-attendance"
          />

          <ReportCard
            icon={FileDown}
            color="rose"
            title="Individual Salary Slip (PDF)"
            description="Professional payslip PDF for one employee. Select from the list below and download."
            customContent={
              <div className="flex gap-2 mt-2">
                <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" data-testid="slip-emp-select">
                  <option value="">Select employee...</option>
                  {employees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.name} ({e.employee_id})</option>)}
                </select>
              </div>
            }
            btnLabel="Download PDF"
            isLoading={downloading === 'salary-slip'}
            disabled={!selectedEmp}
            onDownload={() => downloadReport(
              `/employees/reports/salary-slip-pdf/${selectedEmp}?month=${selectedMonth}&year=${selectedYear}`,
              `Payslip_${selectedEmp}_${MONTHS[selectedMonth - 1]}_${selectedYear}.pdf`,
              'salary-slip'
            )}
            testid="dl-salary-slip"
          />

          <ReportCard
            icon={Award}
            color="purple"
            title="Pool Distribution"
            description="PRC pool earnings per employee across any date range. Use custom dates below."
            customContent={
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">From</label>
                  <input type="date" value={poolFromDate} onChange={e => setPoolFromDate(e.target.value)} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs" data-testid="pool-from" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">To</label>
                  <input type="date" value={poolToDate} onChange={e => setPoolToDate(e.target.value)} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs" data-testid="pool-to" />
                </div>
              </div>
            }
            btnLabel="Download Excel"
            isLoading={downloading === 'pool-dist'}
            onDownload={() => downloadReport(
              `/employees/reports/pool-distribution?from_date=${poolFromDate}&to_date=${poolToDate}`,
              `Pool_Distribution_${poolFromDate}_to_${poolToDate}.xlsx`,
              'pool-dist'
            )}
            testid="dl-pool-distribution"
          />
        </div>

        {/* Phase B — Statutory Reports */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
          <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-amber-600" /> Statutory Compliance (India)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ReportCard
              icon={FileSpreadsheet} color="emerald"
              title="PF Monthly ECR"
              description="EPFO Electronic Challan Return — UAN, EPF/EPS/EDLI wages, contributions, NCP days. Upload to unifiedportal-emp.epfindia.gov.in"
              btnLabel="Download Excel"
              isLoading={downloading === 'pf-ecr'}
              onDownload={() => downloadReport(
                `/employees/reports/pf-ecr?month=${selectedMonth}&year=${selectedYear}`,
                `PF_ECR_${MONTHS[selectedMonth - 1]}_${selectedYear}.xlsx`,
                'pf-ecr'
              )}
              testid="dl-pf-ecr"
            />
            <ReportCard
              icon={FileSpreadsheet} color="blue"
              title="ESI Monthly Return"
              description="ESIC return — covered employees (wages ≤ INR 21,000). Employee + Employer contributions."
              btnLabel="Download Excel"
              isLoading={downloading === 'esi-return'}
              onDownload={() => downloadReport(
                `/employees/reports/esi-return?month=${selectedMonth}&year=${selectedYear}`,
                `ESI_Return_${MONTHS[selectedMonth - 1]}_${selectedYear}.xlsx`,
                'esi-return'
              )}
              testid="dl-esi-return"
            />
            <ReportCard
              icon={FileSpreadsheet} color="purple"
              title="TDS Report (Financial Year)"
              description="FY-wise TDS deducted per employee with quarterly breakdown — feeds TDS returns Form 24Q."
              customContent={
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">FY Start Year</label>
                  <select value={selectedFY} onChange={e => setSelectedFY(Number(e.target.value))} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs" data-testid="fy-select">
                    {years.map(y => <option key={y} value={y}>{y}-{(y + 1).toString().slice(-2)}</option>)}
                  </select>
                </div>
              }
              btnLabel="Download Excel"
              isLoading={downloading === 'tds'}
              onDownload={() => downloadReport(
                `/employees/reports/tds?fy_start_year=${selectedFY}`,
                `TDS_FY${selectedFY}-${(selectedFY + 1).toString().slice(-2)}.xlsx`,
                'tds'
              )}
              testid="dl-tds"
            />
            <ReportCard
              icon={FileDown} color="rose"
              title="Form 16 (Annual TDS Certificate)"
              description="Part A + Part B Form 16 PDF for selected employee. Requires PAN. Issued annually to every employee."
              customContent={
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs" data-testid="form16-emp-select">
                    <option value="">Select employee...</option>
                    {employees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.name}</option>)}
                  </select>
                  <select value={selectedFY} onChange={e => setSelectedFY(Number(e.target.value))} className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs">
                    {years.map(y => <option key={y} value={y}>FY {y}-{(y + 1).toString().slice(-2)}</option>)}
                  </select>
                </div>
              }
              btnLabel="Download PDF"
              disabled={!selectedEmp}
              isLoading={downloading === 'form-16'}
              onDownload={() => downloadReport(
                `/employees/reports/form-16/${selectedEmp}?fy_start_year=${selectedFY}`,
                `Form16_${selectedEmp}_FY${selectedFY}-${(selectedFY + 1).toString().slice(-2)}.pdf`,
                'form-16'
              )}
              testid="dl-form-16"
            />
          </div>
        </div>

        {/* Phase C — Leave & Personal Reports */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600" /> Leave & Employee Reports
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ReportCard
              icon={FileSpreadsheet} color="emerald"
              title="Leave Balance Summary"
              description="All employees' CL/SL/EL balances with used/remaining — point-in-time snapshot."
              btnLabel="Download Excel"
              isLoading={downloading === 'leave-balance'}
              onDownload={() => downloadReport(
                `/employees/reports/leave-balance`,
                `Leave_Balance_${new Date().toISOString().slice(0, 10)}.xlsx`,
                'leave-balance'
              )}
              testid="dl-leave-balance"
            />
            <ReportCard
              icon={TrendingUp} color="purple"
              title="YTD Earnings (Employee)"
              description="Year-to-date earnings breakdown — monthly gross, net, deductions, days paid. Useful for loan/visa applications."
              customContent={
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs" data-testid="ytd-emp-select">
                    <option value="">Select employee...</option>
                    {employees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.name}</option>)}
                  </select>
                  <select value={selectedFY} onChange={e => setSelectedFY(Number(e.target.value))} className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs">
                    {years.map(y => <option key={y} value={y}>FY {y}-{(y + 1).toString().slice(-2)}</option>)}
                  </select>
                </div>
              }
              btnLabel={ytdData ? 'Refresh YTD' : 'View YTD Summary'}
              disabled={!selectedEmp}
              isLoading={loadingYtd}
              onDownload={async () => {
                if (!selectedEmp) return;
                setLoadingYtd(true);
                try {
                  const res = await axios.get(`${API}/employees/reports/ytd-earnings/${selectedEmp}?fy_start_year=${selectedFY}`);
                  setYtdData(res.data);
                  toast.success('YTD data loaded');
                } catch (e) { toast.error('Failed'); }
                finally { setLoadingYtd(false); }
              }}
              testid="dl-ytd"
            />
          </div>

          {/* YTD Data Preview */}
          {ytdData && (
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <h4 className="font-bold text-slate-900">{ytdData.employee?.name} — FY {ytdData.financial_year}</h4>
                  <p className="text-xs text-slate-500">{ytdData.employee?.designation} · {ytdData.employee?.department} · {ytdData.months_processed} months processed · {ytdData.ytd_days} days paid</p>
                </div>
                <button onClick={() => setYtdData(null)} className="text-xs text-slate-500 hover:text-white">× Close</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
                {[
                  { label: 'Gross YTD', val: ytdData.totals?.gross, color: 'text-emerald-600' },
                  { label: 'Net YTD', val: ytdData.totals?.net, color: 'text-blue-600' },
                  { label: 'PF YTD', val: ytdData.totals?.pf, color: 'text-amber-600' },
                  { label: 'ESI YTD', val: ytdData.totals?.esi, color: 'text-orange-600' },
                  { label: 'TDS YTD', val: ytdData.totals?.tds, color: 'text-rose-600' },
                  { label: 'PT YTD', val: ytdData.totals?.pt, color: 'text-purple-600' }
                ].map(k => (
                  <div key={k.label} className="bg-slate-100 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-slate-500">{k.label}</p>
                    <p className={`text-sm font-bold ${k.color}`}>INR {k.val?.toLocaleString() || 0}</p>
                  </div>
                ))}
              </div>
              {ytdData.monthly?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="py-2 px-2 text-left text-slate-500 font-normal">Month</th>
                        <th className="py-2 px-2 text-right text-slate-500 font-normal">Days</th>
                        <th className="py-2 px-2 text-right text-slate-500 font-normal">Gross</th>
                        <th className="py-2 px-2 text-right text-slate-500 font-normal">PF</th>
                        <th className="py-2 px-2 text-right text-slate-500 font-normal">TDS</th>
                        <th className="py-2 px-2 text-right text-slate-500 font-normal">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ytdData.monthly.map((m, i) => (
                        <tr key={i} className="border-b border-slate-200/50">
                          <td className="py-1.5 px-2 text-slate-200">{m.month} {m.year}</td>
                          <td className="py-1.5 px-2 text-right text-slate-700">{m.days_paid}</td>
                          <td className="py-1.5 px-2 text-right text-emerald-600">{m.gross?.toLocaleString()}</td>
                          <td className="py-1.5 px-2 text-right text-amber-600">{m.pf?.toLocaleString()}</td>
                          <td className="py-1.5 px-2 text-right text-rose-600">{m.tds?.toLocaleString()}</td>
                          <td className="py-1.5 px-2 text-right text-blue-600 font-semibold">{m.net?.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic text-center py-4">No monthly data available</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============== Components ============== */
const KPI = ({ icon: Icon, color, label, value, sub }) => {
  const colors = {
    emerald: 'bg-emerald-500/20 text-emerald-600',
    blue: 'bg-blue-500/20 text-blue-600',
    amber: 'bg-amber-500/20 text-amber-600',
    purple: 'bg-purple-500/20 text-purple-600'
  };
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${colors[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
};

const ReportCard = ({ icon: Icon, color, title, description, customContent, btnLabel, isLoading, disabled, onDownload, testid }) => {
  const colors = {
    emerald: 'bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30',
    blue: 'bg-blue-500/20 text-blue-600 hover:bg-blue-500/30',
    rose: 'bg-rose-500/20 text-rose-600 hover:bg-rose-500/30',
    purple: 'bg-purple-500/20 text-purple-600 hover:bg-purple-500/30'
  };
  const iconBg = {
    emerald: 'bg-emerald-500/10 text-emerald-600',
    blue: 'bg-blue-500/10 text-blue-600',
    rose: 'bg-rose-500/10 text-rose-600',
    purple: 'bg-purple-500/10 text-purple-600'
  };
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col">
      <div className="flex items-start gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-slate-900">{title}</h4>
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        </div>
      </div>
      {customContent}
      <button
        onClick={onDownload}
        disabled={isLoading || disabled}
        data-testid={testid}
        className={`mt-auto w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${colors[color]}`}
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {isLoading ? 'Preparing...' : btnLabel}
      </button>
    </div>
  );
};

export default AdminEmployeeReports;
