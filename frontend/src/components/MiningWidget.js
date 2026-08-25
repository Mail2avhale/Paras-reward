import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Coins, Play, Clock, Zap, CheckCircle, Crown } from 'lucide-react';
import { toast } from 'sonner';
import smartToast from '@/utils/smartToast';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import RewardedAdPrompt from '@/components/RewardedAdPrompt';
import ForcedAdInterstitial from '@/components/ForcedAdInterstitial';

import { API } from "../lib/api";

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
  // Cooldown between Collect and next Start (AdMob retention)
  const [startCooldown, setStartCooldown] = useState(0);
  // Rewarded-ad opt-in modal state — opened from Collect, closes once
  // user either watches the ad or chooses "Skip — collect without bonus".
  const [adPromptOpen, setAdPromptOpen] = useState(false);
  // Forced ad interstitial state — opened automatically AFTER a successful
  // collect. Renders via React Portal at document.body, so it can never
  // be hidden by an ancestor's render state. User can Skip without losing
  // their already-collected PRC.
  const [forcedAdOpen, setForcedAdOpen] = useState(false);

  const timerRef = useRef(null);
  const liveCounterRef = useRef(null);
  const progressRef = useRef(null);
  const cooldownRef = useRef(null);
  const collectInProgressRef = useRef(false);
  const collectSafetyRef = useRef(null);

  const subscriptionPlan = user?.subscription_plan || 'explorer';
  const isFreeUser = !subscriptionPlan || subscriptionPlan === 'explorer' || subscriptionPlan === 'free' || subscriptionPlan === '';
  const hasPaidPlan = ['startup', 'growth', 'elite'].includes(subscriptionPlan);

  // Plan-based accent — but the CARD itself always uses the unified
  // dark slate palette so the dashboard has a single visual language
  // (Feb 27 2026 design refresh). Elite / Growth just tint the accents.
  const isElite = subscriptionPlan === 'elite';
  const isGrowth = subscriptionPlan === 'growth';
  const cardBg = 'var(--paras-slate)';
  const cardBorder = `1px solid var(--paras-slate-line)`;
  const cardShadow = 'var(--paras-shadow-card)';
  const accentColor = isElite ? '#FFC107' : isGrowth ? '#2EC4B6' : '#94A3B8';
  const accentLight = isElite ? 'text-[color:var(--paras-gold)]' : isGrowth ? 'text-[color:var(--paras-mint)]' : 'text-[color:var(--paras-text-mute)]';

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
        setStartCooldown(0);

        const mined = d.mined_this_session || d.mined_coins || 0;
        if (isInitial || mined > sessionPRC) setSessionPRC(mined);
      } else {
        setIsMining(false);
        setSessionTimeRemaining(0);
        setSessionProgress(0);
        if (isInitial) setSessionPRC(0);
        // Pull authoritative cooldown from server (re-syncs after refresh / device switch)
        const cd = typeof d.start_cooldown_seconds === 'number' ? d.start_cooldown_seconds : 0;
        setStartCooldown(cd);
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

  // Cooldown ticker — counts down 60s wait between Collect and Start
  useEffect(() => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    if (startCooldown > 0) {
      cooldownRef.current = setInterval(() => {
        setStartCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(cooldownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [startCooldown > 0]);

  const startSession = async () => {
    triggerHaptic('medium');
    if (isMining) { await fetchMiningStatus(true); return; }
    if (startCooldown > 0) {
      smartToast.info(`Please wait ${startCooldown}s before starting`);
      return;
    }
    setIsStarting(true);
    try {
      const res = await axios.post(`${API}/mining/start/${user.uid}`);
      if (res.data) {
        setIsMining(true);
        setSessionTimeRemaining(24 * 60 * 60);
        setSessionPRC(0);
        setSessionStartTime(Date.now());
        setSessionProgress(0);
        setStartCooldown(0);
        triggerHaptic('success');
        smartToast.success('Session started! Earning PRC...');
        setTimeout(() => fetchMiningStatus(), 500);
      }
    } catch (error) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail || 'Failed to start session';
      if (status === 429) {
        // Server-enforced cooldown — extract remaining seconds from message
        const match = /wait\s+(\d+)s/i.exec(detail);
        if (match) setStartCooldown(parseInt(match[1], 10));
        smartToast.error(detail);
      } else if (detail.includes('already active')) {
        smartToast.info('Syncing active session...');
        await fetchMiningStatus(true);
      } else {
        smartToast.error(detail);
      }
    } finally {
      setIsStarting(false);
    }
  };

  const performCollect = async () => {
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

      // Session does NOT auto-start. User must manually click "Start Session" after a 60s cooldown.
      setSessionPRC(0);
      setIsMining(false);
      setSessionTimeRemaining(0);
      setSessionProgress(0);
      const cd = typeof data.cooldown_seconds === 'number' ? data.cooldown_seconds : 60;
      setStartCooldown(cd);

      setTimeout(() => { collectInProgressRef.current = false; fetchMiningStatus(false); }, 3000);
    } catch (error) {
      collectInProgressRef.current = false;
      smartToast.error(error.response?.data?.detail || 'Failed to collect rewards');
    } finally {
      setIsCollecting(false);
    }
  };

  // ── FORCED-AD-BEFORE-COLLECT (Aug 13, 2026) ────────────────────────
  // Business rule change: user MUST watch the rewarded ad to collect PRC.
  // If ad fails to load or user closes early → PRC is NOT credited.
  // Ad = income source, so "no ad = no PRC" protects revenue.
  //
  // Old flow: /mining/collect → credit primary PRC → then show BONUS ad.
  // New flow: show ad first → on complete callback → /mining/collect.
  const collectRewards = () => {
    if (sessionPRC < 0.01) { smartToast.error('Not enough PRC to collect'); return; }
    // Immediate feedback so user sees something is happening even if the ad
    // SDK takes a second to initialise (v1.4.1 UX polish).
    smartToast.info('Loading reward…');
    // If a previous forced-ad modal state is still open (stuck), reset it
    // so the user can try again cleanly.
    if (forcedAdOpen) {
      setForcedAdOpen(false);
      setTimeout(() => setForcedAdOpen(true), 50);
    } else {
      setForcedAdOpen(true);
    }
    triggerHaptic('medium');

    // SAFETY NET — if the ad interstitial doesn't fire onClose or
    // onAdCompleted within 60s (long enough for a full rewarded video ad
    // to complete on native), credit PRC directly so the user is never
    // permanently blocked on a broken ad SDK / modal render bug.
    if (collectSafetyRef.current) clearTimeout(collectSafetyRef.current);
    collectSafetyRef.current = setTimeout(() => {
      if (collectInProgressRef.current) return;
      console.warn('[MiningWidget] Forced-ad safety-net fired — crediting PRC directly');
      setForcedAdOpen(false);
      performCollect();
    }, 60000);
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
      <div className="relative overflow-hidden rounded-2xl p-5" style={{ background: cardBg, border: cardBorder, boxShadow: cardShadow }} data-testid="mining-widget-active">
        {/* Ambient glow */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-[80px]" style={{ backgroundColor: accentColor }} />
        </div>

        <div className="relative z-10">
          {/* Time Remaining — Silver-grey label, crisp white numerals in deep charcoal cells */}
          <p className="text-[color:var(--paras-text-mute)] text-xs text-center mb-2 tracking-wider">{t('timeRemaining') || 'Time Remaining'}</p>
          <div className="flex items-center justify-center gap-0.5 mb-4">
            {formatTime(sessionTimeRemaining).split('').map((char, i) => (
              <div key={i} className={char === ':' ? 'w-3 text-center' : 'w-8 h-10 rounded-md flex items-center justify-center'} style={char !== ':' ? { background: 'var(--paras-obsidian-deep)', border: '1px solid var(--paras-gold-border)' } : {}}>
                <span className={`font-mono font-bold ${char === ':' ? `text-lg` : 'text-xl'}`} style={{ color: char === ':' ? 'var(--paras-gold)' : '#FFFFFF' }}>{char}</span>
              </div>
            ))}
          </div>

          {/* Session Earnings Card */}
          <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--paras-obsidian-deep)', border: '1px solid var(--paras-slate-line)' }}>
            <p className="text-[color:var(--paras-text-mute)] text-xs text-center mb-2 tracking-wider">{t('sessionEarnings') || 'Session Earnings'}</p>
            <div className="flex items-center justify-center gap-1">
              <Coins className="w-4 h-4 mr-1" style={{ color: 'var(--paras-gold)' }} />
              {sessionPRC.toFixed(2).split('').map((char, i) => (
                <motion.div
                  key={`${i}-${char}`}
                  className={char === '.' ? 'w-2 flex items-end justify-center pb-0.5' : 'w-7 h-9 rounded-md flex items-center justify-center'}
                  style={char !== '.' ? { background: 'rgba(0,0,0,0.35)', border: '1px solid var(--paras-gold-border)' } : {}}
                  initial={{ y: -3, opacity: 0.6 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  <span className="font-mono font-bold text-lg" style={{ color: 'var(--paras-gold)' }}>{char}</span>
                </motion.div>
              ))}
              <span className="font-semibold text-sm ml-1" style={{ color: 'var(--paras-gold)' }}>PRC</span>
            </div>

            {/* PRC/sec + PRC/hr rate — mint green rate, gold hour, silver labels */}
            <div className="flex items-center justify-center gap-3 mt-3">
              <div className="rounded-lg px-4 py-2 text-center min-w-[100px]" style={{ background: 'rgba(46,196,182,0.08)', border: '1px solid rgba(46,196,182,0.25)' }}>
                <p className="text-sm font-bold font-mono leading-tight" style={{ color: 'var(--paras-mint)' }}>+{(miningRate / 3600).toFixed(4)}</p>
                <p className="text-[10px] font-semibold tracking-wider mt-0.5 text-[color:var(--paras-text-mute)]">PRC/SEC</p>
              </div>
              <div className="rounded-lg px-4 py-2 text-center min-w-[100px]" style={{ background: 'rgba(255,193,7,0.08)', border: '1px solid var(--paras-gold-border)' }}>
                <p className="text-sm font-bold font-mono leading-tight" style={{ color: 'var(--paras-gold)' }}>{miningRate.toFixed(1)}</p>
                <p className="text-[10px] font-semibold tracking-wider mt-0.5 text-[color:var(--paras-text-mute)]">PRC/HOUR</p>
              </div>
            </div>

            {/* Progress Bar — silver track + gold fill */}
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[color:var(--paras-text-mute)]">Session Progress</span>
                <span className="font-mono" style={{ color: 'var(--paras-gold)' }}>{sessionProgress.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--paras-slate-track)' }}>
                <motion.div
                  className="h-full rounded-full"
                  animate={{ width: `${sessionProgress}%` }}
                  transition={{ duration: 0.5 }}
                  style={{ background: 'linear-gradient(90deg, #FFD54F, #FFC107 60%, #C9971A)', boxShadow: '0 0 10px rgba(255,193,7,0.55)' }}
                />
              </div>
            </div>
          </div>

          {/* Collect Button — sophisticated metallic gold gradient */}
          {isFreeUser ? (
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,193,7,0.08)', border: '1px solid var(--paras-gold-border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-4 h-4" style={{ color: 'var(--paras-gold)' }} />
                <p className="font-medium text-xs" style={{ color: 'var(--paras-gold)' }}>Upgrade to Collect PRC</p>
              </div>
              <Button disabled className="w-full font-semibold py-2.5 rounded-xl cursor-not-allowed text-sm" style={{ background: 'var(--paras-obsidian-deep)', color: 'var(--paras-text-mute)', border: '1px solid var(--paras-slate-line)' }} data-testid="collect-disabled-btn">
                <CheckCircle className="w-4 h-4 mr-1" /> Collect ({sessionPRC.toFixed(2)} PRC)
              </Button>
            </div>
          ) : (
            <Button
              onClick={collectRewards}
              disabled={!canCollect || isCollecting}
              className={`w-full py-3 rounded-xl font-semibold text-base transition-all active:scale-[0.98] ${canCollect ? 'btn-paras-gold' : ''}`}
              style={canCollect ? undefined : {
                background: 'var(--paras-obsidian-deep)',
                color: 'var(--paras-text-mute)',
                border: '1px solid var(--paras-slate-line)'
              }}
              data-testid="collect-rewards-btn"
            >
              {isCollecting ? (
                <span className="flex items-center gap-2 justify-center">
                  <motion.div className="w-4 h-4 border-2 border-[color:var(--paras-gold-deep)] border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
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

        {/* Forced ad interstitial — also mounted here so it renders during
            active mining (v1.4.1 fix: was only in idle return before). */}
        <ForcedAdInterstitial
          open={forcedAdOpen}
          placement="main_mining_collect"
          onClose={() => {
            setForcedAdOpen(false);
            if (collectSafetyRef.current) { clearTimeout(collectSafetyRef.current); collectSafetyRef.current = null; }
          }}
          onAdCompleted={() => {
            if (collectSafetyRef.current) { clearTimeout(collectSafetyRef.current); collectSafetyRef.current = null; }
            performCollect();
          }}
        />
      </div>
    );
  }

  // Idle state - Start Session
  return (
    <div className="rounded-2xl p-5 overflow-hidden relative" style={{ background: cardBg, border: cardBorder, boxShadow: cardShadow }} data-testid="mining-widget-idle">
      <div className="text-center">
        <motion.div
          className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Zap className="w-8 h-8" style={{ color: accentColor }} />
        </motion.div>

        <p className="text-zinc-500 text-xs mb-1">Daily Earning Rate</p>
        <p className="text-lg font-bold font-mono mb-3" style={{ color: accentColor }}>
          {miningRate.toFixed(1)} PRC/hr
        </p>

        <Button
          onClick={startSession}
          disabled={isStarting || startCooldown > 0}
          className="w-full font-semibold py-3 rounded-xl text-base active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: startCooldown > 0
              ? 'linear-gradient(135deg, #4b5563, #374151)'
              : isElite 
              ? 'linear-gradient(135deg, #d4af37, #b8960c)' 
              : isGrowth 
              ? 'linear-gradient(135deg, #10b981, #059669)' 
              : 'linear-gradient(135deg, #3b82f6, #2563eb)',
            color: startCooldown > 0 ? '#e5e7eb' : (isElite ? '#000' : '#fff'),
            boxShadow: startCooldown > 0 ? 'none' : `0 0 15px ${accentColor}30`,
            border: `1px solid ${accentColor}50`
          }}
          data-testid="start-mining-btn"
        >
          {isStarting ? (
            <span className="flex items-center gap-2 justify-center">
              <motion.div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
              Starting...
            </span>
          ) : startCooldown > 0 ? (
            <span className="flex items-center gap-2 justify-center" data-testid="start-cooldown-label">
              <Clock className="w-4 h-4" /> Start Session in {startCooldown}s
            </span>
          ) : (
            <span className="flex items-center gap-2 justify-center">
              <Play className="w-4 h-4" /> {t('startSession') || 'Start Session'}
            </span>
          )}
        </Button>

        {startCooldown > 0 && (
          <p className="text-[11px] text-zinc-500 mt-2" data-testid="cooldown-helper-text">
            Take a quick break! New session will be available shortly.
          </p>
        )}

        {isFreeUser && (
          <p className="text-xs mt-2" style={{ color: `${accentColor}80` }}>Upgrade to Elite to collect earned PRC</p>
        )}
      </div>

      {/* Rewarded-ad opt-in (Google AdMob compliant): opens on Collect. */}
      <RewardedAdPrompt
        open={adPromptOpen}
        placement="main_mining_collect"
        title="Earn Bonus PRC"
        onClose={() => setAdPromptOpen(false)}
        onSkip={performCollect}
        onComplete={performCollect}
      />
      {/* Forced ad interstitial — MUST watch ad before PRC is collected.
          If ad fails / user closes early, performCollect is NOT called,
          protecting revenue since ads are the primary income source. */}
      <ForcedAdInterstitial
        open={forcedAdOpen}
        placement="main_mining_collect"
        onClose={() => {
          setForcedAdOpen(false);
          // Cancel safety timer — modal exited normally
          if (collectSafetyRef.current) { clearTimeout(collectSafetyRef.current); collectSafetyRef.current = null; }
        }}
        onAdCompleted={() => {
          // Cancel safety timer — real completion path
          if (collectSafetyRef.current) { clearTimeout(collectSafetyRef.current); collectSafetyRef.current = null; }
          performCollect();
        }}
      />
    </div>
  );
};

export default MiningWidget;
