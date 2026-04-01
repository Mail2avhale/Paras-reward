import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Calendar, Plus, Trash2, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const AdminHolidays = () => {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [settings, setSettings] = useState({ weekly_off_saturday: true, weekly_off_sunday: true });
  const [holidays, setHolidays] = useState([]);
  const [calendarData, setCalendarData] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '', type: 'local' });
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, holidaysRes, calRes] = await Promise.all([
        axios.get(`${API}/api/holidays/admin/settings`, { headers }),
        axios.get(`${API}/api/holidays/admin/list?year=${year}`, { headers }),
        axios.get(`${API}/api/holidays/calendar/${year}/${month}`),
      ]);
      setSettings(settingsRes.data);
      setHolidays(holidaysRes.data.holidays || []);
      setCalendarData(calRes.data);
    } catch (e) {
      toast.error('Failed to load holiday data');
    }
    setLoading(false);
  }, [year, month, headers]);

  useEffect(() => { fetchData(); }, [year, month]);

  const toggleSetting = async (key) => {
    try {
      const newVal = !settings[key];
      await axios.put(`${API}/api/holidays/admin/settings`, { [key]: newVal }, { headers });
      setSettings(s => ({ ...s, [key]: newVal }));
      toast.success(`${key === 'weekly_off_saturday' ? 'Saturday' : 'Sunday'} off ${newVal ? 'enabled' : 'disabled'}`);
      fetchData();
    } catch (e) {
      toast.error('Failed to update setting');
    }
  };

  const addHoliday = async () => {
    if (!newHoliday.date || !newHoliday.name) {
      toast.error('Date and name are required');
      return;
    }
    try {
      await axios.post(`${API}/api/holidays/admin/add`, newHoliday, { headers });
      toast.success(`Holiday "${newHoliday.name}" added`);
      setNewHoliday({ date: '', name: '', type: 'local' });
      setShowAdd(false);
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add holiday');
    }
  };

  const removeHoliday = async (date, name) => {
    if (!window.confirm(`Remove "${name}" on ${date}?`)) return;
    try {
      await axios.delete(`${API}/api/holidays/admin/remove?date=${date}&name=${encodeURIComponent(name)}`, { headers });
      toast.success('Holiday removed');
      fetchData();
    } catch (e) {
      toast.error('Failed to remove holiday');
    }
  };

  const toggleHoliday = async (date, name, currentActive) => {
    try {
      await axios.put(`${API}/api/holidays/admin/toggle`, { date, name, active: !currentActive }, { headers });
      toast.success(`Holiday ${!currentActive ? 'activated' : 'deactivated'}`);
      fetchData();
    } catch (e) {
      toast.error('Failed to toggle holiday');
    }
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const firstDayWeekday = calendarData?.days?.[0]?.weekday ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6" data-testid="admin-holidays-page">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="rounded-xl">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Holiday Management</h1>
          <p className="text-sm text-slate-500">Manage weekly offs, government & local holidays</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Settings + Add Holiday + Holiday List */}
        <div className="space-y-4">
          {/* Weekly Off Settings */}
          <Card className="p-5 bg-white border-slate-200 rounded-2xl" data-testid="weekly-off-settings">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Weekly Off Settings
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-sm font-medium text-slate-700">Saturday Off</span>
                <button onClick={() => toggleSetting('weekly_off_saturday')} className="focus:outline-none" data-testid="toggle-saturday">
                  {settings.weekly_off_saturday ?
                    <ToggleRight className="w-8 h-8 text-emerald-500" /> :
                    <ToggleLeft className="w-8 h-8 text-slate-400" />
                  }
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-sm font-medium text-slate-700">Sunday Off</span>
                <button onClick={() => toggleSetting('weekly_off_sunday')} className="focus:outline-none" data-testid="toggle-sunday">
                  {settings.weekly_off_sunday ?
                    <ToggleRight className="w-8 h-8 text-emerald-500" /> :
                    <ToggleLeft className="w-8 h-8 text-slate-400" />
                  }
                </button>
              </div>
            </div>
          </Card>

          {/* Add Holiday */}
          <Card className="p-5 bg-white border-slate-200 rounded-2xl" data-testid="add-holiday-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Add Holiday</h3>
              <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)} className="rounded-xl" data-testid="add-holiday-toggle">
                <Plus className="w-4 h-4 mr-1" /> {showAdd ? 'Cancel' : 'Add New'}
              </Button>
            </div>
            {showAdd && (
              <div className="space-y-3">
                <input
                  type="date"
                  value={newHoliday.date}
                  onChange={e => setNewHoliday(h => ({ ...h, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  data-testid="holiday-date-input"
                />
                <input
                  type="text"
                  placeholder="Holiday name"
                  value={newHoliday.name}
                  onChange={e => setNewHoliday(h => ({ ...h, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  data-testid="holiday-name-input"
                />
                <select
                  value={newHoliday.type}
                  onChange={e => setNewHoliday(h => ({ ...h, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  data-testid="holiday-type-select"
                >
                  <option value="government">Government Holiday</option>
                  <option value="local">Local Holiday</option>
                </select>
                <Button onClick={addHoliday} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700" data-testid="add-holiday-submit">
                  Add Holiday
                </Button>
              </div>
            )}
          </Card>

          {/* Holiday List */}
          <Card className="p-5 bg-white border-slate-200 rounded-2xl" data-testid="holiday-list-card">
            <h3 className="font-semibold text-slate-800 mb-4">
              {year} Holidays ({holidays.length})
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {loading ? (
                <p className="text-sm text-slate-400 text-center py-4">Loading...</p>
              ) : holidays.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No holidays added</p>
              ) : (
                holidays.map((h, i) => (
                  <div key={`${h.date}-${i}`} className={`flex items-center justify-between p-3 rounded-xl ${h.active !== false ? 'bg-slate-50' : 'bg-slate-100 opacity-60'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${h.type === 'government' ? 'bg-red-400' : 'bg-orange-400'}`} />
                      <div>
                        <p className="text-sm font-medium text-slate-700">{h.name}</p>
                        <p className="text-xs text-slate-500">{new Date(h.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} &middot; {h.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleHoliday(h.date, h.name, h.active !== false)} className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors" title={h.active !== false ? 'Deactivate' : 'Activate'}>
                        {h.active !== false ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <button onClick={() => removeHoliday(h.date, h.name)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" data-testid={`remove-holiday-${i}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right: Calendar Preview */}
        <div>
          <Card className="p-5 bg-white border-slate-200 rounded-2xl sticky top-4" data-testid="admin-calendar-preview">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-500" />
                Calendar Preview
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="p-1 text-slate-400 hover:text-slate-700">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-medium text-slate-700 min-w-[130px] text-center">
                  {MONTHS[month - 1]} {year}
                </span>
                <button onClick={nextMonth} className="p-1 text-slate-400 hover:text-slate-700">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {WEEKDAYS.map(d => (
                <div key={d} className={`text-center text-xs font-medium py-1.5 ${d === 'Sat' || d === 'Sun' ? 'text-red-400' : 'text-slate-500'}`}>
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayWeekday }).map((_, i) => (
                <div key={`pad-${i}`} className="aspect-square" />
              ))}
              {calendarData?.days?.map(day => {
                const isToday = day.date === todayStr;
                const isHoliday = day.is_holiday;
                const isWeeklyOff = day.type === 'weekly_off';
                const isGovt = day.type === 'government';

                let bgClass = 'bg-emerald-50 hover:bg-emerald-100';
                let textClass = 'text-slate-700';

                if (isToday) {
                  bgClass = isHoliday ? 'bg-red-100 ring-2 ring-red-400' : 'bg-emerald-100 ring-2 ring-emerald-500';
                  textClass = isHoliday ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold';
                } else if (isGovt || day.type === 'local') {
                  bgClass = isGovt ? 'bg-red-50 hover:bg-red-100' : 'bg-orange-50 hover:bg-orange-100';
                  textClass = isGovt ? 'text-red-500' : 'text-orange-500';
                } else if (isWeeklyOff) {
                  bgClass = 'bg-slate-100';
                  textClass = 'text-slate-400';
                }

                return (
                  <div key={day.date} className={`aspect-square flex flex-col items-center justify-center rounded-lg ${bgClass} transition-colors relative group cursor-default`} title={isHoliday ? day.holiday_name : 'Working Day'}>
                    <span className={`text-sm ${textClass}`}>{day.day}</span>
                    {isHoliday && !isWeeklyOff && <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-0.5" />}
                    {isHoliday && !isWeeklyOff && (
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {day.holiday_name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Stats */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="p-3 bg-emerald-50 rounded-xl text-center">
                <p className="text-2xl font-bold text-emerald-600">{calendarData?.working_days || 0}</p>
                <p className="text-xs text-emerald-600/70">Working Days</p>
              </div>
              <div className="p-3 bg-red-50 rounded-xl text-center">
                <p className="text-2xl font-bold text-red-500">{calendarData?.total_holidays || 0}</p>
                <p className="text-xs text-red-500/70">Holidays</p>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" /> Working</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-slate-100 border border-slate-200" /> Weekly Off</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-50 border border-red-200" /> Govt Holiday</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-orange-50 border border-orange-200" /> Local</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminHolidays;
