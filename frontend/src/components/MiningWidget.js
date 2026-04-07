import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Coins, Play, Clock, Zap, CheckCircle, Crown } from 'lucide-react';
import { toast } from 'sonner';
import smartToast from '@/utils/smartToast';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const triggerHaptic = (type = 'light') => {
  if ('vibrate' in navigator) {
    const patterns = { light: [10], medium: [20], success: [10, 50, 10, 50, 30] };
    navigator.vibrate(patterns[type] || patterns.light);
  }
};

const MiningWidget = ({ user, onBalanceUpdate }) => {
  const { t } = useLanguage();

  const [isMining, setIsMining] = useState(() => {
    if (user?.mining_active && user?.mining_session_end) {
      return new Date(user.mining_session_end).getTime() > Date.now();
    }
    return false;
  });
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(0);
  const [sessionPRC, setSessionPRC] = useState(0);
  const [miningRate, setMiningRate] = useState(41.67);
  const [isStarting, setIsStarting] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [sessionProgress, setSessionProgress] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);

  const timerRef = useRef(null);
  const liveCounterRef = useRef(null);
  const progressRef = useRef(null);
  const collectInProgressRef = useRef(false);

  const subscriptionPlan = user?.subscription_plan || 'explorer';
  const isFreeUser = !subscriptionPlan || subscriptionPlan === 'explorer' || subscriptionPlan === 'free' || subscriptionPlan === '';
  const hasPaidPlan = ['startup', 'growth', 'elite'].includes(subscriptionPlan);

  const fetchMiningStatus = useCallback(async (isInitial = false) => {
    if (!user?.uid) return;
    try {
      const res = await axios.get(`${API}/mining/status/${user.uid}`, { timeout: 4000 });
      const d = res.data;
      const rate = d.mining_rate_per_hour || d.mining_rate || 20.83;
      setMiningRate(rate);

      if (d.session_active) {
        const sessionStart = new Date(d.session_start).getTime();
        const totalDuration = 24 * 60 * 60 * 1000;
        const elapsed = Date.now() - sessionStart;
        const remaining = d.time_remaining || (d.remaining_hours * 3600) || 0;

        setIsMining(true);
        setSessionTimeRemaining(Math.max(0, Math.floor(remaining)));
        setSessionStartTime(sessionStart);
        setSessionProgress(Math.min(100, (elapsed / totalDuration) * 100));

        const mined = d.mined_this_session || d.mined_coins || 0;
        if (isInitial || mined > sessionPRC) setSessionPRC(mined);
      } else {
        setIsMining(false);
        setSessionTimeRemaining(0);
        setSessionProgress(0);
        if (isInitial) setSessionPRC(0);
      }
      setDataLoaded(true);
    } catch (err) {
      console.error('Mining status fetch error:', err);
      setDataLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    if (user?.uid) fetchMiningStatus(true);
    const interval = setInterval(() => { if (user?.uid) fetchMiningStatus(false); }, 30000);
    return () => clearInterval(interval);
  }, [user, fetchMiningStatus]);

  // Timer + live counter + progress
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (liveCounterRef.current) clearInterval(liveCounterRef.current);
    if (progressRef.current) clearInterval(progressRef.current);

    if (isMining && sessionTimeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setSessionTimeRemaining(prev => {
          if (prev <= 5) {
            setIsMining(false);
            setSessionProgress(100);
            smartToast.success('Session complete! Collect your rewards.');
            clearInterval(timerRef.current);
            if (liveCounterRef.current) clearInterval(liveCounterRef.current);
            if (progressRef.current) clearInterval(progressRef.current);
            return 0;
          }
          return prev - 5;
        });
      }, 5000);

      liveCounterRef.current = setInterval(() => {
        const prcPerSecond = miningRate / 3600;
        setSessionPRC(prev => Math.max(0, prev + prcPerSecond));
      }, 1000);

      progressRef.current = setInterval(() => {
        if (sessionStartTime) {
          const totalDuration = 24 * 60 * 60 * 1000;
          const elapsed = Date.now() - sessionStartTime;
          setSessionProgress(Math.min(100, (elapsed / totalDuration) * 100));
        }
      }, 1000);

      if (sessionStartTime) {
        const totalDuration = 24 * 60 * 60 * 1000;
        const elapsed = Date.now() - sessionStartTime;
        setSessionProgress(Math.min(100, (elapsed / totalDuration) * 100));
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (liveCounterRef.current) clearInterval(liveCounterRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [isMining, miningRate, sessionStartTime]);

  const startSession = async () => {
    triggerHaptic('medium');
    if (isMining) { await fetchMiningStatus(true); return; }
    setIsStarting(true);
    try {
      const res = await axios.post(`${API}/mining/start/${user.uid}`);
      if (res.data) {
        setIsMining(true);
        setSessionTimeRemaining(24 * 60 * 60);
        setSessionPRC(0);
        setSessionStartTime(Date.now());
        setSessionProgress(0);
        triggerHaptic('success');
        smartToast.success('Session started! Earning PRC...');
        setTimeout(() => fetchMiningStatus(), 500);
      }
    } catch (error) {
      const detail = error.response?.data?.detail || 'Failed to start session';
      if (detail.includes('already active')) {
        smartToast.info('Syncing active session...');
        await fetchMiningStatus(true);
      } else {
        smartToast.error(detail);
      }
    } finally {
      setIsStarting(false);
    }
  };

  const collectRewards = async () => {
    if (sessionPRC < 0.01) { smartToast.error('Not enough PRC to collect'); return; }
    triggerHaptic('medium');
    collectInProgressRef.current = true;
    setIsCollecting(true);
    try {
      const res = await axios.post(`${API}/mining/collect/${user.uid}`);
      const data = res.data;
      const claimed = data.collected_amount || data.claimed_amount || data.prc_collected || sessionPRC;
      triggerHaptic('success');
      smartToast.success(`Collected ${claimed.toFixed(2)} PRC!`);

      if (data.new_balance !== undefined && onBalanceUpdate) {
        onBalanceUpdate(data.new_balance);
      }

      if (data.auto_started && data.new_session_start) {
        setSessionPRC(0);
        setSessionTimeRemaining(24 * 60 * 60);
        setSessionStartTime(new Date(data.new_session_start).getTime());
        setSessionProgress(0);
        setIsMining(true);
        smartToast.info('New session auto-started!');
      } else {
        setSessionPRC(0);
        setIsMining(false);
        setSessionTimeRemaining(0);
        setSessionProgress(0);
      }

      setTimeout(() => { collectInProgressRef.current = false; fetchMiningStatus(false); }, 3000);
    } catch (error) {
      collectInProgressRef.current = false;
      smartToast.error(error.response?.data?.detail || 'Failed to collect rewards');
    } finally {
      setIsCollecting(false);
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const canCollect = sessionPRC >= 0.01 && hasPaidPlan;

  // Loading skeleton
  if (!dataLoaded) {
    return (
      <div className="bg-zinc-900/80 rounded-2xl p-5 border border-zinc-800 animate-pulse" data-testid="mining-widget-skeleton">
        <div className="h-4 w-24 bg-zinc-800 rounded mb-4 mx-auto" />
        <div className="h-10 w-48 bg-zinc-800 rounded-lg mb-4 mx-auto" />
        <div className="h-2 bg-zinc-800 rounded-full mb-4" />
        <div className="h-12 bg-zinc-800 rounded-xl" />
      </div>
    );
  }

  // Active session UI
  if (isMining) {
    return (
      <div className="relative overflow-hidden rounded-2xl p-5 border border-amber-500/20 bg-zinc-900/80" data-testid="mining-widget-active">
        {/* Ambient glow */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500 rounded-full blur-[80px]" />
        </div>

        <div className="relative z-10">
          {/* Time Remaining */}
          <p className="text-zinc-400 text-xs text-center mb-2">{t('timeRemaining') || 'Time Remaining'}</p>
          <div className="flex items-center justify-center gap-0.5 mb-4">
            {formatTime(sessionTimeRemaining).split('').map((char, i) => (
              <div key={i} className={char === ':' ? 'w-3 text-center' : 'w-8 h-10 bg-zinc-800 border border-zinc-700 rounded-md flex items-center justify-center'}>
                <span className={`font-mono font-bold ${char === ':' ? 'text-lg text-amber-400' : 'text-xl text-zinc-100'}`}>{char}</span>
              </div>
            ))}
          </div>

          {/* Session Earnings Card */}
          <div className="bg-zinc-800/60 rounded-xl p-4 mb-4 border border-zinc-700/40">
            <p className="text-zinc-500 text-xs text-center mb-2">{t('sessionEarnings') || 'Session Earnings'}</p>
            <div className="flex items-center justify-center gap-1">
              <Coins className="w-4 h-4 text-amber-500 mr-1" />
              {sessionPRC.toFixed(2).split('').map((char, i) => (
                <motion.div
                  key={`${i}-${char}`}
                  className={char === '.' ? 'w-2 flex items-end justify-center pb-0.5' : 'w-7 h-9 bg-zinc-900 border border-amber-500/30 rounded-md flex items-center justify-center'}
                  initial={{ y: -3, opacity: 0.6 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  <span className={`font-mono font-bold ${char === '.' ? 'text-amber-400 text-lg' : 'text-lg bg-gradient-to-b from-amber-300 to-amber-500 bg-clip-text text-transparent'}`}>{char}</span>
                </motion.div>
              ))}
              <span className="text-amber-500 font-semibold text-sm ml-1">PRC</span>
            </div>

            {/* PRC/sec rate */}
            <div className="flex items-center justify-center gap-1 mt-2">
              <Zap className="w-3 h-3 text-emerald-500" />
              <p className="text-emerald-500 text-xs font-mono">+{(miningRate / 3600).toFixed(4)} PRC/sec</p>
            </div>

            {/* Progress Bar */}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-zinc-500 mb-1">
                <span>Session Progress</span>
                <span className="text-amber-400 font-mono">{sessionProgress.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  animate={{ width: `${sessionProgress}%` }}
                  transition={{ duration: 0.5 }}
                  style={{ background: 'linear-gradient(90deg, #10b981, #34d399)', boxShadow: '0 0 8px rgba(16,185,129,0.4)' }}
                />
              </div>
            </div>
          </div>

          {/* Collect Button */}
          {isFreeUser ? (
            <div className="bg-amber-900/20 rounded-xl p-3 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <p className="text-amber-400 font-medium text-xs">Upgrade to Collect PRC</p>
              </div>
              <Button disabled className="w-full bg-zinc-800 text-zinc-500 font-semibold py-2.5 rounded-xl cursor-not-allowed border border-zinc-700 text-sm" data-testid="collect-disabled-btn">
                <CheckCircle className="w-4 h-4 mr-1" /> Collect ({sessionPRC.toFixed(2)} PRC)
              </Button>
            </div>
          ) : (
            <Button
              onClick={collectRewards}
              disabled={!canCollect || isCollecting}
              className={`w-full py-3 rounded-xl font-semibold text-base transition-all active:scale-[0.98] ${
                canCollect
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)] border border-amber-400/50'
                  : 'bg-zinc-800 text-zinc-600 border border-zinc-700 cursor-not-allowed'
              }`}
              data-testid="collect-rewards-btn"
            >
              {isCollecting ? (
                <span className="flex items-center gap-2 justify-center">
                  <motion.div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                  Collecting...
                </span>
              ) : (
                <span className="flex items-center gap-2 justify-center">
                  <CheckCircle className="w-4 h-4" /> {t('collectRewards') || 'Collect Rewards'} ({sessionPRC.toFixed(2)} PRC)
                </span>
              )}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Idle state - Start Session
  return (
    <div className="rounded-2xl p-5 border border-zinc-800 bg-zinc-900/60" data-testid="mining-widget-idle">
      <div className="text-center">
        <motion.div
          className="w-16 h-16 mx-auto mb-3 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center"
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Zap className="w-8 h-8 text-amber-500" />
        </motion.div>

        <p className="text-zinc-500 text-xs mb-1">Daily Earning Rate</p>
        <p className="text-lg font-bold text-amber-400 font-mono mb-3">
          {miningRate.toFixed(1)} PRC/hr
        </p>

        <Button
          onClick={startSession}
          disabled={isStarting}
          className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold py-3 rounded-xl text-base shadow-[0_0_15px_rgba(16,185,129,0.3)] border border-emerald-500/50 active:scale-[0.98] transition-all"
          data-testid="start-mining-btn"
        >
          {isStarting ? (
            <span className="flex items-center gap-2 justify-center">
              <motion.div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
              Starting...
            </span>
          ) : (
            <span className="flex items-center gap-2 justify-center">
              <Play className="w-4 h-4" /> {t('startSession') || 'Start Session'}
            </span>
          )}
        </Button>

        {isFreeUser && (
          <p className="text-amber-400/60 text-xs mt-2">Upgrade to Elite to collect earned PRC</p>
        )}
      </div>
    </div>
  );
};

export default MiningWidget;
