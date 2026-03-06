import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, TrendingUp, Users, Calendar, Download, Filter,
  ChevronDown, ChevronUp, Zap, Clock, Award, Gift, Trophy,
  Target, BarChart3, Bell, Star, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ReferralEarningsHistory = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState([]);
  const [summary, setSummary] = useState({
    total_earned: 0,
    this_month: 0,
    this_week: 0,
    today: 0
  });
  const [levelBreakdown, setLevelBreakdown] = useState({});
  const [topPerformers, setTopPerformers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [activeTab, setActiveTab] = useState('overview'); // overview, chart, calendar, leaderboard
  const [error, setError] = useState(null);
  const itemsPerPage = 15;

  const levelColors = {
    1: 'from-amber-500 to-amber-600',
    2: 'from-blue-500 to-blue-600',
    3: 'from-emerald-500 to-emerald-600',
    4: 'from-purple-500 to-purple-600',
    5: 'from-pink-500 to-pink-600'
  };

  const levelBonuses = {
    1: { percent: 10, desc: 'Direct' },
    2: { percent: 5, desc: 'Level 2' },
    3: { percent: 3, desc: 'Level 3' }
  };

  // Fetch earnings data
  const fetchEarnings = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(`${API}/referral-earnings/${user.uid}`);
      
      const earningsData = response.data?.earnings || [];
      const summaryData = response.data?.summary || { total_earned: 0, this_month: 0, this_week: 0, today: 0 };
      
      setEarnings(earningsData);
      setSummary(summaryData);
      setLevelBreakdown(response.data?.level_breakdown || {});
      setTopPerformers(response.data?.top_performers || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching earnings:', err);
      setError('Failed to load earnings');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  // Calculate comparison (this week vs last week)
  const comparison = useMemo(() => {
    const thisWeek = summary.this_week || 0;
    // Estimate last week as this_month minus this_week divided by remaining weeks
    const lastWeekEstimate = summary.this_month > thisWeek ? (summary.this_month - thisWeek) / 3 : thisWeek * 0.8;
    const change = lastWeekEstimate > 0 ? ((thisWeek - lastWeekEstimate) / lastWeekEstimate) * 100 : 0;
    return {
      thisWeek,
      lastWeek: lastWeekEstimate,
      change: change.toFixed(1),
      isUp: change >= 0
    };
  }, [summary]);

  // Calculate projection (estimated monthly earnings)
  const projection = useMemo(() => {
    const daysInMonth = 30;
    const today = new Date().getDate();
    const dailyAvg = summary.this_month / Math.max(today, 1);
    const projected = dailyAvg * daysInMonth;
    return {
      daily: dailyAvg.toFixed(2),
      monthly: projected.toFixed(2),
      daysRemaining: daysInMonth - today
    };
  }, [summary]);

  // Prepare chart data (last 7 days)
  const chartData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('en', { weekday: 'short' });
      
      const dayEarnings = earnings
        .filter(e => {
          const eTimestamp = e.timestamp || e.created_at || e.date || '';
          return eTimestamp.startsWith(dateStr);
        })
        .reduce((sum, e) => sum + (e.prc_earned || e.amount || 0), 0);
      
      days.push({
        day: dayName,
        date: dateStr,
        earnings: parseFloat(dayEarnings.toFixed(2))
      });
    }
    return days;
  }, [earnings]);

  // Calendar data for current month
  const calendarData = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const calendar = [];
    let week = new Array(firstDay).fill(null);
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEarnings = earnings
        .filter(e => (e.timestamp || e.created_at)?.startsWith(dateStr))
        .reduce((sum, e) => sum + (e.prc_earned || e.amount || 0), 0);
      
      week.push({ day, earnings: dayEarnings, isToday: day === today.getDate() });
      
      if (week.length === 7) {
        calendar.push(week);
        week = [];
      }
    }
    
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      calendar.push(week);
    }
    
    return calendar;
  }, [earnings]);

  // Filter earnings by period
  const filteredEarnings = useMemo(() => {
    if (filterPeriod === 'all') return earnings;
    
    const now = new Date();
    const filterDate = new Date();
    
    switch (filterPeriod) {
      case 'today':
        filterDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        filterDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        filterDate.setMonth(now.getMonth() - 1);
        break;
      default:
        return earnings;
    }
    
    return earnings.filter(e => {
      const eDate = new Date(e.timestamp || e.created_at);
      return eDate >= filterDate;
    });
  }, [earnings, filterPeriod]);

  const paginatedEarnings = filteredEarnings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredEarnings.length / itemsPerPage);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gray-950/90 backdrop-blur-xl border-b border-gray-800">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-xl">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">Referral Earnings</h1>
              <p className="text-xs text-gray-400">Track your network income</p>
            </div>
          </div>
          <button onClick={fetchEarnings} className="p-2 hover:bg-gray-800 rounded-xl">
            <TrendingUp className="w-5 h-5 text-amber-500" />
          </button>
        </div>
      </div>

      {/* Today's Earning Alert */}
      {summary.today > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-4 p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/30 rounded-full flex items-center justify-center">
              <Bell className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-green-400 font-bold">Today's Earning</p>
              <p className="text-white text-xl font-bold">+{summary.today.toFixed(2)} PRC</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Summary Cards */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-2xl p-4">
          <p className="text-amber-400 text-xs">Total Earned</p>
          <p className="text-white text-2xl font-bold">{summary.total_earned?.toFixed(2)}</p>
          <p className="text-amber-300 text-xs">PRC</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-2xl p-4">
          <p className="text-blue-400 text-xs">This Month</p>
          <p className="text-white text-2xl font-bold">{summary.this_month?.toFixed(2)}</p>
          <p className="text-blue-300 text-xs">PRC</p>
        </div>
      </div>

      {/* Comparison Card */}
      <div className="px-4 mb-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-sm">This Week vs Last Week</p>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${comparison.isUp ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {comparison.isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              <span className="text-sm font-bold">{comparison.isUp ? '+' : ''}{comparison.change}%</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-white font-bold text-lg">{comparison.thisWeek.toFixed(2)}</p>
              <p className="text-gray-500 text-xs">This Week</p>
            </div>
            <div className="text-gray-600">vs</div>
            <div>
              <p className="text-gray-400 font-bold text-lg">{comparison.lastWeek.toFixed(2)}</p>
              <p className="text-gray-500 text-xs">Last Week</p>
            </div>
          </div>
        </div>
      </div>

      {/* Projection Card */}
      <div className="px-4 mb-4">
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-purple-400" />
            <p className="text-purple-400 font-semibold">Monthly Projection</p>
          </div>
          <p className="text-white text-2xl font-bold mb-1">~{projection.monthly} PRC</p>
          <p className="text-gray-400 text-xs">
            Based on {projection.daily} PRC/day average • {projection.daysRemaining} days remaining
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 bg-gray-900/50 p-1 rounded-xl overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'chart', label: 'Chart', icon: TrendingUp },
            { id: 'calendar', label: 'Calendar', icon: Calendar },
            { id: 'leaderboard', label: 'Top', icon: Trophy }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-amber-500 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {/* Overview Tab - Level Breakdown */}
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="px-4"
          >
            <h2 className="text-white font-bold mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              Earnings by Level
            </h2>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((level) => {
                const levelKey = `level_${level}`;
                const levelData = levelBreakdown[levelKey] || {};
                const levelEarnings = levelData.total || 0;
                const maxEarnings = Math.max(...Object.values(levelBreakdown).map(l => l?.total || 0), 1);
                const percentage = (levelEarnings / maxEarnings) * 100;
                
                return (
                  <div key={level} className="bg-gray-900/50 border border-gray-800 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${levelColors[level]} flex items-center justify-center`}>
                          <span className="text-white font-bold text-xs">L{level}</span>
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">{levelBonuses[level].desc}</p>
                          <p className="text-gray-500 text-xs">{levelBonuses[level].percent}% bonus</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold">{levelEarnings.toFixed(2)}</p>
                        <p className="text-gray-500 text-xs">PRC</p>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${levelColors[level]} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Chart Tab */}
        {activeTab === 'chart' && (
          <motion.div
            key="chart"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="px-4"
          >
            <h2 className="text-white font-bold mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-500" />
              Last 7 Days Earnings
            </h2>
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="earnings" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorEarnings)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            {/* Daily breakdown */}
            <div className="mt-4 space-y-2">
              {chartData.map((day, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-900/30 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${day.earnings > 0 ? 'bg-green-500/20' : 'bg-gray-800'}`}>
                      <span className={`text-xs font-bold ${day.earnings > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                        {day.day}
                      </span>
                    </div>
                    <span className="text-gray-400 text-sm">{day.date}</span>
                  </div>
                  <span className={`font-bold ${day.earnings > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                    {day.earnings > 0 ? `+${day.earnings}` : '0'} PRC
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="px-4"
          >
            <h2 className="text-white font-bold mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              {new Date().toLocaleDateString('en', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <div key={i} className="text-center text-gray-500 text-xs font-medium py-1">{d}</div>
                ))}
              </div>
              {/* Calendar grid */}
              {calendarData.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1">
                  {week.map((day, di) => (
                    <div 
                      key={di} 
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs ${
                        day === null 
                          ? 'bg-transparent' 
                          : day.isToday 
                            ? 'bg-amber-500/30 border border-amber-500' 
                            : day.earnings > 0 
                              ? 'bg-green-500/20 border border-green-500/30' 
                              : 'bg-gray-800/50'
                      }`}
                    >
                      {day && (
                        <>
                          <span className={`font-medium ${day.isToday ? 'text-amber-400' : 'text-white'}`}>
                            {day.day}
                          </span>
                          {day.earnings > 0 && (
                            <span className="text-[8px] text-green-400 font-bold">
                              +{day.earnings.toFixed(0)}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <motion.div
            key="leaderboard"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="px-4"
          >
            <h2 className="text-white font-bold mb-3 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Top Performing Referrals
            </h2>
            
            {topPerformers.length > 0 ? (
              <div className="space-y-2">
                {topPerformers.slice(0, 5).map((performer, idx) => (
                  <div key={idx} className="bg-gray-900/50 border border-gray-800 rounded-xl p-3 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-700' : 'bg-gray-700'
                    }`}>
                      <span className="text-white font-bold">{idx + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">{performer.name || 'Referral'}</p>
                      <p className="text-gray-500 text-xs">Level {performer.level || 1}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-bold">+{(performer.earnings || 0).toFixed(2)}</p>
                      <p className="text-gray-500 text-xs">PRC earned</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center">
                <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No top performers yet</p>
                <p className="text-gray-500 text-sm">Invite more referrals to see rankings</p>
              </div>
            )}
            
            {/* Your Rank */}
            <div className="mt-4 bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/30 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-500/30 rounded-full flex items-center justify-center">
                  <Star className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-amber-400 font-medium">Your Total Earnings</p>
                  <p className="text-white text-xl font-bold">{summary.total_earned?.toFixed(2)} PRC</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction History */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Recent Transactions
          </h2>
          <select
            value={filterPeriod}
            onChange={(e) => { setFilterPeriod(e.target.value); setCurrentPage(1); }}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-sm text-white"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>

        {paginatedEarnings.length > 0 ? (
          <div className="space-y-2">
            {paginatedEarnings.map((earning, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-gray-900/50 border border-gray-800 rounded-xl p-3 flex items-center gap-3"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${levelColors[earning.level || 1]} flex items-center justify-center`}>
                  <span className="text-white font-bold text-xs">L{earning.level || 1}</span>
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium text-sm">{earning.description || `Level ${earning.level || 1} Bonus`}</p>
                  <p className="text-gray-500 text-xs">
                    {new Date(earning.timestamp || earning.created_at).toLocaleDateString('en', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
                <p className="text-green-400 font-bold">+{(earning.prc_earned || earning.amount || 0).toFixed(2)}</p>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center">
            <Gift className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No earnings yet</p>
            <p className="text-gray-500 text-sm">Invite friends to start earning</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-gray-800 rounded-lg text-white disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-gray-400 text-sm">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-gray-800 rounded-lg text-white disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralEarningsHistory;
