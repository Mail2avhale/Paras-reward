import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const HolidayCalendar = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [calendarData, setCalendarData] = useState(null);
  const [todayHoliday, setTodayHoliday] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/holidays/calendar/${year}/${month}`);
      const data = await res.json();
      setCalendarData(data);
    } catch (e) {
      console.error('Calendar fetch error:', e);
    }
    setLoading(false);
  }, [year, month]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  useEffect(() => {
    fetch(`${API}/api/holidays/today`)
      .then(r => r.json())
      .then(d => setTodayHoliday(d))
      .catch(() => {});
  }, []);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Pad the start of the calendar to align weekdays
  const firstDayWeekday = calendarData?.days?.[0]?.weekday ?? 0;
  const padDays = firstDayWeekday;

  const upcomingHolidays = calendarData?.days
    ?.filter(d => d.is_holiday && d.date >= todayStr && d.type !== 'weekly_off')
    ?.slice(0, 3) || [];

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 mt-4" data-testid="holiday-calendar">
      {/* Today Holiday Banner */}
      {todayHoliday?.is_holiday && (
        <div className="mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2" data-testid="today-holiday-banner">
          <span className="text-amber-400 text-sm font-medium">
            Today is a holiday — {todayHoliday.holiday_name}. Redeem services are paused.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white text-sm font-semibold tracking-wide">Holiday Calendar</h3>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1 text-slate-400 hover:text-white transition-colors" data-testid="calendar-prev">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-slate-300 text-xs font-medium min-w-[110px] text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <button onClick={nextMonth} className="p-1 text-slate-400 hover:text-white transition-colors" data-testid="calendar-next">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-slate-600 border-t-emerald-400 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className={`text-center text-[10px] font-medium py-1 ${d === 'Sat' || d === 'Sun' ? 'text-red-400/70' : 'text-slate-500'}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Padding for alignment */}
            {Array.from({ length: padDays }).map((_, i) => (
              <div key={`pad-${i}`} className="aspect-square" />
            ))}

            {calendarData?.days?.map(day => {
              const isToday = day.date === todayStr;
              const isHoliday = day.is_holiday;
              const isWeeklyOff = day.type === 'weekly_off';
              const isGovt = day.type === 'government';
              const isLocal = day.type === 'local';

              let bgClass = 'bg-transparent hover:bg-slate-800/50';
              let textClass = 'text-slate-300';

              if (isToday) {
                bgClass = isHoliday ? 'bg-red-500/30 ring-1 ring-red-400' : 'bg-emerald-500/30 ring-1 ring-emerald-400';
                textClass = isHoliday ? 'text-red-300' : 'text-emerald-300';
              } else if (isGovt) {
                bgClass = 'bg-red-500/15';
                textClass = 'text-red-400';
              } else if (isLocal) {
                bgClass = 'bg-orange-500/15';
                textClass = 'text-orange-400';
              } else if (isWeeklyOff) {
                bgClass = 'bg-slate-800/40';
                textClass = 'text-slate-500';
              }

              return (
                <div
                  key={day.date}
                  className={`aspect-square flex flex-col items-center justify-center rounded-lg ${bgClass} transition-colors relative group cursor-default`}
                  title={isHoliday ? day.holiday_name : 'Working Day'}
                >
                  <span className={`text-xs font-medium ${textClass}`}>{day.day}</span>
                  {isHoliday && !isWeeklyOff && (
                    <div className="w-1 h-1 rounded-full bg-red-400 mt-0.5" />
                  )}
                  {/* Tooltip */}
                  {isHoliday && !isWeeklyOff && (
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-[9px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {day.holiday_name}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Stats + Legend */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px]">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-emerald-500/40" />
                <span className="text-slate-400">Working</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-slate-600" />
                <span className="text-slate-400">Weekly Off</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-red-500/40" />
                <span className="text-slate-400">Govt Holiday</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-orange-500/40" />
                <span className="text-slate-400">Local</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-500">
              {calendarData?.working_days}W / {calendarData?.total_holidays}H
            </div>
          </div>

          {/* Upcoming Holidays */}
          {upcomingHolidays.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-700/50">
              <p className="text-[10px] text-slate-500 mb-1.5">Upcoming Holidays</p>
              <div className="space-y-1">
                {upcomingHolidays.map(h => (
                  <div key={h.date} className="flex justify-between items-center px-2 py-1 bg-slate-800/30 rounded-lg">
                    <span className="text-[11px] text-slate-300">{h.holiday_name}</span>
                    <span className="text-[10px] text-slate-500">{new Date(h.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HolidayCalendar;
