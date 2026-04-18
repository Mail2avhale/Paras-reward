import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Users, UserPlus, Trash2, Wallet, Settings, RefreshCw, Search,
  Loader2, Briefcase, Calendar, FileText, CreditCard, ChevronDown,
  ChevronUp, Download, Clock, CheckCircle, XCircle, MinusCircle,
  Building2, Phone, Mail, Edit2, DollarSign, Upload, Eye
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({});
  const [poolData, setPoolData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('employees');
  
  // Add employee
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [addForm, setAddForm] = useState({ department: '', designation: '', monthly_salary: '', joining_date: '' });
  const [selectedUser, setSelectedUser] = useState(null);
  const [adding, setAdding] = useState(false);
  
  // Attendance
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceData, setAttendanceData] = useState({});
  const [savingAttendance, setSavingAttendance] = useState(false);
  
  // Salary slip
  const [slipMonth, setSlipMonth] = useState(new Date().getMonth() + 1);
  const [slipYear, setSlipYear] = useState(new Date().getFullYear());
  const [generatingSlip, setGeneratingSlip] = useState(null);
  const [viewSlip, setViewSlip] = useState(null);
  
  // Pool settings
  const [poolRate, setPoolRate] = useState(20);
  const [prcToInr, setPrcToInr] = useState(0.10);
  const [savingSettings, setSavingSettings] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [postingSalary, setPostingSalary] = useState(false);
  
  // Detail view
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editDocs, setEditDocs] = useState({});
  const [editEmergency, setEditEmergency] = useState({});
  const [savingDetail, setSavingDetail] = useState(false);
  // Leave
  const [leaveForm, setLeaveForm] = useState({ leave_type: 'casual_leave', start_date: '', end_date: '', reason: '' });
  const [applyingLeave, setApplyingLeave] = useState(false);
  const [leaveData, setLeaveData] = useState(null);

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('paras_user') || '{}');
  const headers = { Authorization: `Bearer ${token || user?.token}` };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [empRes, poolRes, deptRes] = await Promise.all([
        axios.get(`${API}/employees/list`, { headers }),
        axios.get(`${API}/employees/pool/balance`, { headers }),
        axios.get(`${API}/employees/departments`, { headers })
      ]);
      setEmployees(empRes.data?.employees || []);
      setStats(empRes.data?.stats || {});
      setPoolData(poolRes.data);
      setDepartments(deptRes.data?.departments || []);
      setDesignations(deptRes.data?.designations || []);
      setPoolRate(poolRes.data?.pool_rate || 20);
      setPrcToInr(poolRes.data?.prc_to_inr_rate || 0.10);
    } catch (err) {
      toast.error('Failed to load employee data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const searchUsers = async () => {
    if (!searchQuery || searchQuery.length < 2) return;
    setSearching(true);
    try {
      const res = await axios.get(`${API}/employees/search-user?q=${searchQuery}`, { headers });
      setSearchResults(res.data?.users || []);
    } catch { toast.error('Search failed'); }
    finally { setSearching(false); }
  };

  const handleAddEmployee = async () => {
    if (!selectedUser || !addForm.department || !addForm.designation || !addForm.monthly_salary) {
      toast.error('Fill all required fields');
      return;
    }
    setAdding(true);
    try {
      const res = await axios.post(`${API}/employees/add`, {
        user_id: selectedUser.uid,
        department: addForm.department,
        designation: addForm.designation,
        monthly_salary: parseFloat(addForm.monthly_salary),
        joining_date: addForm.joining_date || undefined,
        admin_id: user?.uid || 'admin'
      }, { headers });
      if (res.data?.success) {
        toast.success(res.data.message);
        setSelectedUser(null);
        setAddForm({ department: '', designation: '', monthly_salary: '', joining_date: '' });
        setSearchResults([]);
        setSearchQuery('');
        fetchData();
      }
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to add'); }
    finally { setAdding(false); }
  };

  const handleResign = async (empId) => {
    if (!window.confirm('Are you sure you want to resign this employee?')) return;
    try {
      await axios.post(`${API}/employees/resign`, {
        employee_id: empId, admin_id: user?.uid || 'admin'
      }, { headers });
      toast.success('Employee resigned');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleMarkAttendance = async (empId, status) => {
    setAttendanceData(prev => ({ ...prev, [empId]: status }));
  };

  const saveAttendance = async () => {
    const entries = Object.entries(attendanceData);
    if (!entries.length) { toast.error('No attendance marked'); return; }
    setSavingAttendance(true);
    try {
      const attendance = entries.map(([employee_id, status]) => ({ employee_id, status }));
      await axios.post(`${API}/employees/attendance/bulk`, {
        date: attendanceDate, attendance, admin_id: user?.uid || 'admin'
      }, { headers });
      toast.success(`Attendance saved for ${entries.length} employees`);
      setAttendanceData({});
    } catch (err) { toast.error('Failed to save attendance'); }
    finally { setSavingAttendance(false); }
  };

  const generateSlip = async (empId) => {
    setGeneratingSlip(empId);
    try {
      const res = await axios.post(`${API}/employees/salary-slip/generate`, {
        employee_id: empId, month: slipMonth, year: slipYear, admin_id: user?.uid || 'admin'
      }, { headers });
      if (res.data?.success) {
        setViewSlip(res.data.salary_slip);
        toast.success('Salary slip generated');
      }
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    finally { setGeneratingSlip(null); }
  };

  const savePoolSettings = async () => {
    setSavingSettings(true);
    try {
      await axios.post(`${API}/employees/pool/settings`, { pool_rate: poolRate, prc_to_inr_rate: prcToInr }, { headers });
      toast.success('Settings saved');
      fetchData();
    } catch { toast.error('Failed'); }
    finally { setSavingSettings(false); }
  };

  const handleDistribute = async () => {
    setDistributing(true);
    try {
      await axios.post(`${API}/employees/pool/distribute`, {}, { headers });
      toast.success('Distribution completed');
      fetchData();
    } catch { toast.error('Failed'); }
    finally { setDistributing(false); }
  };

  const handlePostSalary = async () => {
    if (!window.confirm('This will distribute remaining pool and reset monthly earnings. Continue?')) return;
    setPostingSalary(true);
    try {
      const res = await axios.post(`${API}/employees/pool/post-salary`, { admin_id: user?.uid || 'admin' }, { headers });
      toast.success(res.data?.message || 'Salary posted');
      fetchData();
    } catch { toast.error('Failed'); }
    finally { setPostingSalary(false); }
  };

  const activeEmployees = employees.filter(e => e.status === 'active');

  const fetchDetail = async (empId) => {
    setLoadingDetail(true);
    try {
      const [detailRes, leaveRes] = await Promise.all([
        axios.get(`${API}/employees/detail/${empId}`, { headers }),
        axios.get(`${API}/employees/leave/${empId}`, { headers })
      ]);
      setDetailData(detailRes.data);
      setLeaveData(leaveRes.data);
      const docs = detailRes.data?.employee?.documents || {};
      setEditDocs(docs);
      const ec = detailRes.data?.employee?.emergency_contact || {};
      setEditEmergency(ec);
      setSelectedEmployee(empId);
      setActiveTab('detail');
    } catch { toast.error('Failed to load details'); }
    finally { setLoadingDetail(false); }
  };

  const saveDocuments = async () => {
    setSavingDetail(true);
    try {
      await axios.put(`${API}/employees/update-documents/${selectedEmployee}`, editDocs, { headers });
      toast.success('Documents saved');
    } catch { toast.error('Failed'); }
    finally { setSavingDetail(false); }
  };

  const saveEmergencyContact = async () => {
    setSavingDetail(true);
    try {
      await axios.put(`${API}/employees/update-emergency/${selectedEmployee}`, editEmergency, { headers });
      toast.success('Emergency contact saved');
    } catch { toast.error('Failed'); }
    finally { setSavingDetail(false); }
  };

  const applyLeave = async () => {
    if (!leaveForm.start_date) { toast.error('Select start date'); return; }
    setApplyingLeave(true);
    try {
      const res = await axios.post(`${API}/employees/leave/apply`, {
        employee_id: selectedEmployee,
        ...leaveForm,
        end_date: leaveForm.end_date || leaveForm.start_date,
        admin_id: user?.uid || 'admin'
      }, { headers });
      if (res.data?.success) {
        toast.success(res.data.message);
        setLeaveForm({ leave_type: 'casual_leave', start_date: '', end_date: '', reason: '' });
        fetchDetail(selectedEmployee);
      }
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    finally { setApplyingLeave(false); }
  };

  const statusColors = {
    present: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    absent: 'bg-red-100 text-red-700 border-red-300',
    half_day: 'bg-amber-100 text-amber-700 border-amber-300',
    leave: 'bg-blue-100 text-blue-700 border-blue-300',
    holiday: 'bg-purple-100 text-purple-700 border-purple-300'
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6" data-testid="admin-employees">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employee Management</h1>
          <p className="text-slate-500 text-sm mt-1">Manage employees, attendance, salary & pool wallet</p>
        </div>
        <button onClick={fetchData} className="p-2 hover:bg-slate-100 rounded-lg" data-testid="refresh-btn">
          <RefreshCw className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4" data-testid="stat-total">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-slate-500">Total Employees</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.total || 0}</p>
          <p className="text-xs text-slate-400">Active: {stats.active || 0} | Resigned: {stats.resigned || 0}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4" data-testid="stat-salary">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-slate-500">Monthly Salary</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">₹{(stats.total_monthly_salary || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4" data-testid="stat-pool">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-slate-500">Pool Balance</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{(poolData?.pool_balance || 0).toLocaleString()} PRC</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4" data-testid="stat-rate">
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-slate-500">PRC Rate</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">₹{poolData?.prc_to_inr_rate || 0.10}</p>
          <p className="text-xs text-slate-400">Pool: {poolData?.pool_rate || 20}%</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
        {[
          { id: 'employees', label: 'Employees', icon: Users },
          { id: 'add', label: 'Add Employee', icon: UserPlus },
          { id: 'attendance', label: 'Attendance', icon: Calendar },
          { id: 'salary', label: 'Salary Slips', icon: FileText },
          { id: 'pool', label: 'Pool Wallet', icon: Wallet },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
            data-testid={`tab-${tab.id}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'employees' && (
        <div className="bg-white border border-slate-200 rounded-xl" data-testid="employees-list">
          <div className="p-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Employee Directory</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {employees.length === 0 ? (
              <p className="p-8 text-center text-slate-400">No employees added yet</p>
            ) : employees.map(emp => (
              <div key={emp.employee_id} className="p-4 hover:bg-slate-50 transition-colors" data-testid={`emp-${emp.employee_id}`}>
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm flex-shrink-0">
                      {emp.photo_url ? <img src={`${API.replace('/api','')}${emp.photo_url}`} className="w-10 h-10 rounded-full object-cover" alt="" /> : emp.name?.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{emp.name}</p>
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${emp.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {emp.status?.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{emp.employee_id} | {emp.designation} | {emp.department}</p>
                      <div className="flex gap-4 mt-1 text-xs text-slate-400">
                        <span>Salary: ₹{emp.monthly_salary?.toLocaleString()}</span>
                        <span>Joined: {emp.joining_date?.slice(0, 10)}</span>
                        {emp.earned_this_month > 0 && <span className="text-emerald-600">Earned: {emp.earned_this_month?.toFixed(2)} PRC</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => fetchDetail(emp.employee_id)} className="p-1.5 hover:bg-slate-100 rounded text-slate-500" title="View Details">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => generateSlip(emp.employee_id)} className="p-1.5 hover:bg-blue-50 rounded text-blue-500" title="Generate Salary Slip">
                      <FileText className="w-4 h-4" />
                    </button>
                    {emp.status === 'active' && (
                      <button onClick={() => handleResign(emp.employee_id)} className="p-1.5 hover:bg-red-50 rounded text-red-400" title="Resign">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'add' && (
        <div className="space-y-4" data-testid="add-employee-section">
          {/* Search */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Search User</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchUsers()}
                placeholder="Search by name, mobile, email..."
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white"
                data-testid="search-user-input"
              />
              <button onClick={searchUsers} disabled={searching} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-3 space-y-2">
                {searchResults.map(u => (
                  <div
                    key={u.uid}
                    onClick={() => !u.is_employee && setSelectedUser(u)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      u.is_employee ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                      : selectedUser?.uid === u.uid ? 'bg-blue-50 border-blue-300'
                      : 'bg-white border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <p className="font-medium text-slate-900 text-sm">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.mobile} | {u.email}</p>
                    {u.is_employee && <span className="text-xs text-orange-500 font-medium">Already an employee</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Form */}
          {selectedUser && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="font-semibold text-slate-900 mb-3">Add: {selectedUser.name}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Department *</label>
                  <select
                    value={addForm.department}
                    onChange={e => setAddForm(p => ({ ...p, department: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white"
                    data-testid="dept-select"
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Designation *</label>
                  <select
                    value={addForm.designation}
                    onChange={e => setAddForm(p => ({ ...p, designation: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white"
                    data-testid="desig-select"
                  >
                    <option value="">Select Designation</option>
                    {designations.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Monthly Salary (INR) *</label>
                  <input
                    type="number"
                    value={addForm.monthly_salary}
                    onChange={e => setAddForm(p => ({ ...p, monthly_salary: e.target.value }))}
                    placeholder="e.g. 25000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white"
                    data-testid="salary-input"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Joining Date</label>
                  <input
                    type="date"
                    value={addForm.joining_date}
                    onChange={e => setAddForm(p => ({ ...p, joining_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white"
                  />
                </div>
              </div>
              <button
                onClick={handleAddEmployee}
                disabled={adding}
                className="mt-4 px-6 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                data-testid="add-employee-btn"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : <UserPlus className="w-4 h-4 inline mr-2" />}
                Add Employee
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="bg-white border border-slate-200 rounded-xl" data-testid="attendance-section">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Daily Attendance</h2>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={attendanceDate}
                onChange={e => setAttendanceDate(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white"
              />
              <button
                onClick={saveAttendance}
                disabled={savingAttendance || !Object.keys(attendanceData).length}
                className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                data-testid="save-attendance-btn"
              >
                {savingAttendance ? 'Saving...' : `Save (${Object.keys(attendanceData).length})`}
              </button>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {activeEmployees.length === 0 ? (
              <p className="p-8 text-center text-slate-400">No active employees</p>
            ) : activeEmployees.map(emp => (
              <div key={emp.employee_id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900 text-sm">{emp.name}</p>
                  <p className="text-xs text-slate-400">{emp.employee_id} | {emp.designation}</p>
                </div>
                <div className="flex gap-1">
                  {['present', 'absent', 'half_day', 'leave', 'holiday'].map(s => (
                    <button
                      key={s}
                      onClick={() => handleMarkAttendance(emp.employee_id, s)}
                      className={`px-2 py-1 text-[10px] font-medium rounded border transition-colors ${
                        attendanceData[emp.employee_id] === s ? statusColors[s] : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                      }`}
                    >
                      {s === 'half_day' ? 'Half' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'salary' && (
        <div className="space-y-4" data-testid="salary-section">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">Generate Salary Slips</h2>
              <div className="flex gap-2">
                <select value={slipMonth} onChange={e => setSlipMonth(parseInt(e.target.value))} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white">
                  {Array.from({length: 12}, (_, i) => (
                    <option key={i+1} value={i+1}>{new Date(2026, i).toLocaleString('default', {month: 'long'})}</option>
                  ))}
                </select>
                <input type="number" value={slipYear} onChange={e => setSlipYear(parseInt(e.target.value))} className="w-20 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" />
              </div>
            </div>
            <div className="space-y-2">
              {activeEmployees.map(emp => (
                <div key={emp.employee_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{emp.name} ({emp.employee_id})</p>
                    <p className="text-xs text-slate-400">{emp.designation} | Salary: ₹{emp.monthly_salary?.toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => generateSlip(emp.employee_id)}
                    disabled={generatingSlip === emp.employee_id}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {generatingSlip === emp.employee_id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Generate'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Salary Slip View */}
          {viewSlip && (
            <div className="bg-white border border-slate-200 rounded-xl p-6" data-testid="salary-slip-view" id="salary-slip-content">
              <div className="text-center border-b border-slate-200 pb-4 mb-4">
                <h2 className="text-lg font-bold text-slate-900">{viewSlip.company?.name}</h2>
                <p className="text-xs text-slate-500">{viewSlip.company?.address}</p>
                <p className="text-xs text-slate-500">{viewSlip.company?.website}</p>
                <p className="mt-2 text-sm font-semibold text-slate-700">SALARY SLIP - {viewSlip.period}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <p className="text-slate-500 text-xs">Employee Name</p>
                  <p className="font-medium text-slate-900">{viewSlip.employee_name}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Employee ID</p>
                  <p className="font-medium text-slate-900">{viewSlip.employee_id}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Designation</p>
                  <p className="font-medium text-slate-900">{viewSlip.designation}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Department</p>
                  <p className="font-medium text-slate-900">{viewSlip.department}</p>
                </div>
              </div>
              
              {/* Attendance */}
              <div className="bg-slate-50 rounded-lg p-3 mb-4 text-xs">
                <p className="font-medium text-slate-700 mb-1">Attendance Summary</p>
                <div className="flex gap-4 text-slate-600">
                  <span>Working Days: {viewSlip.attendance?.total_working_days}</span>
                  <span>Present: {viewSlip.attendance?.present}</span>
                  <span>Absent: {viewSlip.attendance?.absent}</span>
                  <span>Leave: {viewSlip.attendance?.leave}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Earnings */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase">Earnings</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-slate-600">Basic Salary</span><span className="text-slate-900">₹{viewSlip.earnings?.basic_salary?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">HRA</span><span className="text-slate-900">₹{viewSlip.earnings?.hra?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Conveyance</span><span className="text-slate-900">₹{viewSlip.earnings?.conveyance_allowance?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Special Allowance</span><span className="text-slate-900">₹{viewSlip.earnings?.special_allowance?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Medical</span><span className="text-slate-900">₹{viewSlip.earnings?.medical_allowance?.toLocaleString()}</span></div>
                    <div className="flex justify-between border-t border-slate-200 pt-1 font-bold"><span className="text-slate-800">Total Earnings</span><span className="text-emerald-600">₹{viewSlip.earnings?.total_earnings?.toLocaleString()}</span></div>
                  </div>
                </div>
                {/* Deductions */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase">Deductions</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-slate-600">PF (Employee)</span><span className="text-slate-900">₹{viewSlip.deductions?.pf_employee?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">ESI</span><span className="text-slate-900">₹{viewSlip.deductions?.esi_employee?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Professional Tax</span><span className="text-slate-900">₹{viewSlip.deductions?.professional_tax?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">TDS</span><span className="text-slate-900">₹{viewSlip.deductions?.tds?.toLocaleString()}</span></div>
                    {viewSlip.deductions?.loss_of_pay > 0 && (
                      <div className="flex justify-between text-red-600"><span>Loss of Pay</span><span>₹{viewSlip.deductions?.loss_of_pay?.toLocaleString()}</span></div>
                    )}
                    <div className="flex justify-between border-t border-slate-200 pt-1 font-bold"><span className="text-slate-800">Total Deductions</span><span className="text-red-600">₹{viewSlip.deductions?.total_deductions?.toLocaleString()}</span></div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 text-white rounded-lg p-3 flex justify-between items-center">
                <span className="font-bold">NET SALARY</span>
                <span className="text-xl font-bold">₹{viewSlip.net_salary?.toLocaleString()}</span>
              </div>

              <div className="mt-3 flex justify-end">
                <button onClick={() => setViewSlip(null)} className="px-4 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300">
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'pool' && (
        <div className="space-y-4" data-testid="pool-section">
          {/* Pool Balance */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Employee Pool Wallet</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="text-xs text-purple-600">Pool Balance</p>
                <p className="text-lg font-bold text-purple-800">{(poolData?.pool_balance || 0).toFixed(4)} PRC</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-blue-600">Pool Rate</p>
                <p className="text-lg font-bold text-blue-800">{poolData?.pool_rate}%</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3">
                <p className="text-xs text-emerald-600">PRC-INR Rate</p>
                <p className="text-lg font-bold text-emerald-800">₹{poolData?.prc_to_inr_rate}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3">
                <p className="text-xs text-orange-600">Active Employees</p>
                <p className="text-lg font-bold text-orange-800">{poolData?.active_employees}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleDistribute} disabled={distributing} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50" data-testid="distribute-btn">
                {distributing ? 'Distributing...' : 'Distribute Now'}
              </button>
              <button onClick={handlePostSalary} disabled={postingSalary} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50" data-testid="post-salary-btn">
                {postingSalary ? 'Posting...' : 'Post Salary (Reset)'}
              </button>
            </div>
          </div>

          {/* Pool Settings */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Pool Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Pool Rate (%)</label>
                <input type="number" value={poolRate} onChange={e => setPoolRate(parseFloat(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">PRC to INR Rate (₹)</label>
                <input type="number" step="0.01" value={prcToInr} onChange={e => setPrcToInr(parseFloat(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" />
              </div>
            </div>
            <button onClick={savePoolSettings} disabled={savingSettings} className="mt-3 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50">
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}

      {/* EMPLOYEE DETAIL VIEW */}
      {activeTab === 'detail' && detailData && (
        <div className="space-y-4" data-testid="detail-section">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setActiveTab('employees')} className="text-sm text-blue-600 hover:underline">&larr; Back to list</button>
            <span className="text-slate-400">|</span>
            <span className="font-semibold text-slate-900">{detailData.employee?.name} ({detailData.employee?.employee_id})</span>
          </div>

          {/* Profile Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Profile</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-slate-400 text-xs block">Department</span><span className="text-slate-900 font-medium">{detailData.employee?.department}</span></div>
              <div><span className="text-slate-400 text-xs block">Designation</span><span className="text-slate-900 font-medium">{detailData.employee?.designation}</span></div>
              <div><span className="text-slate-400 text-xs block">Salary</span><span className="text-slate-900 font-medium">₹{detailData.employee?.monthly_salary?.toLocaleString()}</span></div>
              <div><span className="text-slate-400 text-xs block">Joining Date</span><span className="text-slate-900 font-medium">{detailData.employee?.joining_date?.slice(0,10)}</span></div>
              <div><span className="text-slate-400 text-xs block">Email</span><span className="text-slate-900">{detailData.employee?.email || '-'}</span></div>
              <div><span className="text-slate-400 text-xs block">Mobile</span><span className="text-slate-900">{detailData.employee?.mobile || '-'}</span></div>
              <div><span className="text-slate-400 text-xs block">Status</span><span className={`font-bold ${detailData.employee?.status === 'active' ? 'text-emerald-600' : 'text-red-600'}`}>{detailData.employee?.status?.toUpperCase()}</span></div>
              <div><span className="text-slate-400 text-xs block">Earned (PRC)</span><span className="text-slate-900">{detailData.employee?.earned_this_month?.toFixed(2) || 0}</span></div>
            </div>
          </div>

          {/* Documents */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { key: 'aadhar_number', label: 'Aadhar Number' },
                { key: 'pan_number', label: 'PAN Number' },
                { key: 'bank_account', label: 'Bank Account' },
                { key: 'bank_name', label: 'Bank Name' },
                { key: 'ifsc_code', label: 'IFSC Code' },
                { key: 'uan_number', label: 'UAN Number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-slate-500 mb-1 block">{f.label}</label>
                  <input
                    type="text"
                    value={editDocs[f.key] || ''}
                    onChange={e => setEditDocs(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white"
                    placeholder={f.label}
                  />
                </div>
              ))}
            </div>
            <button onClick={saveDocuments} disabled={savingDetail} className="mt-3 px-4 py-1.5 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50">
              {savingDetail ? 'Saving...' : 'Save Documents'}
            </button>
          </div>

          {/* Emergency Contact */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Emergency Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Name</label>
                <input type="text" value={editEmergency.name || ''} onChange={e => setEditEmergency(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Relation</label>
                <input type="text" value={editEmergency.relation || ''} onChange={e => setEditEmergency(p => ({ ...p, relation: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Phone</label>
                <input type="text" value={editEmergency.phone || ''} onChange={e => setEditEmergency(p => ({ ...p, phone: e.target.value }))} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" />
              </div>
            </div>
            <button onClick={saveEmergencyContact} disabled={savingDetail} className="mt-3 px-4 py-1.5 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50">
              {savingDetail ? 'Saving...' : 'Save Emergency Contact'}
            </button>
          </div>

          {/* Leave Management */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Leave Management</h3>
            {leaveData && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {Object.entries(leaveData.balance || {}).map(([key, val]) => (
                  <div key={key} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">{key.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
                    <p className="text-lg font-bold text-slate-900">{val.remaining} <span className="text-xs text-slate-400 font-normal">/ {val.annual}</span></p>
                    <p className="text-[10px] text-slate-400">Used: {val.used}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-slate-100 pt-3">
              <p className="text-sm font-medium text-slate-700 mb-2">Apply Leave</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <select value={leaveForm.leave_type} onChange={e => setLeaveForm(p => ({ ...p, leave_type: e.target.value }))} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white">
                  <option value="casual_leave">Casual Leave</option>
                  <option value="sick_leave">Sick Leave</option>
                  <option value="earned_leave">Earned Leave</option>
                </select>
                <input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm(p => ({ ...p, start_date: e.target.value }))} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" placeholder="Start" />
                <input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm(p => ({ ...p, end_date: e.target.value }))} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" placeholder="End" />
                <input type="text" value={leaveForm.reason} onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" placeholder="Reason" />
              </div>
              <button onClick={applyLeave} disabled={applyingLeave} className="mt-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {applyingLeave ? 'Applying...' : 'Apply Leave'}
              </button>
            </div>
            {/* Leave History */}
            {leaveData?.leaves?.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-sm font-medium text-slate-700 mb-2">Leave History</p>
                <div className="space-y-2">
                  {leaveData.leaves.map(l => (
                    <div key={l.leave_id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-sm">
                      <div>
                        <span className="font-medium text-slate-900">{l.leave_label}</span>
                        <span className="text-slate-400 mx-2">|</span>
                        <span className="text-slate-600">{l.start_date} to {l.end_date} ({l.days}d)</span>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">{l.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Attendance Summary */}
          {detailData.attendance && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="font-semibold text-slate-900 mb-2">Attendance (This Month)</h3>
              <div className="flex gap-4 text-sm">
                <span className="text-emerald-600 font-medium">Present: {detailData.attendance.summary?.present}</span>
                <span className="text-red-600 font-medium">Absent: {detailData.attendance.summary?.absent}</span>
                <span className="text-amber-600 font-medium">Half Day: {detailData.attendance.summary?.half_day}</span>
                <span className="text-blue-600 font-medium">Leave: {detailData.attendance.summary?.leave}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminEmployees;
