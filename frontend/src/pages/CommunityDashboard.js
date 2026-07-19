/**
 * CommunityDashboard — the new gamified "Community Growth" experience
 * that sits on top of the existing referral tree + live feed on
 * /referrals. Renders Sections 1-16 from the redesign spec using data
 * from `/api/community/dashboard/{uid}` (one composite endpoint).
 *
 * Terminology invariants (must be preserved when editing):
 *   • Never use the words "Commission", "Referral Income",
 *     "Passive Income", "Downline", or "Upline" in user-facing copy.
 *     Use "Leadership Reward" / "Community Network" / "Mentor".
 *   • "Network Capacity" → "Community Goal"
 *   • "Mining Boost"      → "Community Power"
 *   • "Partner Position"  → "Leadership Position"
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Users, Zap, Heart, Target, Trophy, Sparkles, Flame, Star, Crown, Gem,
  Rocket, Copy, Check, MessageCircle, Send, Share2, QrCode, X,
  TrendingUp, Award, Calendar, Timer, Activity,
} from 'lucide-react';
import { toast } from 'sonner';

// ---- Small primitives ---------------------------------------------------

// Animated counter — tweens `value` from 0 to target on mount.
const Counter = ({ value = 0, duration = 900, decimals = 0, className = '' }) => {
  const [display, setDisplay] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const to = Number(value) || 0;
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => raf.current && cancelAnimationFrame(raf.current);
  }, [value, duration]);
  return (
    <span className={`tabular-nums ${className}`}>
      {decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()}
    </span>
  );
};

const GlassCard = ({ className = '', children, testId }) => (
  <div
    data-testid={testId}
    className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-md shadow-[0_8px_32px_-8px_rgba(0,0,0,0.4)] ${className}`}
  >
    {children}
  </div>
);

const ProgressBar = ({ percent = 0, gradient = 'from-emerald-400 via-cyan-400 to-blue-500', height = 'h-2.5', testId }) => (
  <div className={`w-full ${height} bg-white/5 rounded-full overflow-hidden ring-1 ring-white/10`} data-testid={testId}>
    <div
      className={`h-full bg-gradient-to-r ${gradient} rounded-full transition-all duration-700`}
      style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
    />
  </div>
);

// ---- Countdown helper ---------------------------------------------------

const useCountdown = (initialSeconds) => {
  const [sec, setSec] = useState(initialSeconds || 0);
  useEffect(() => {
    if (!initialSeconds) return undefined;
    setSec(initialSeconds);
    const id = setInterval(() => setSec((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [initialSeconds]);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return { d, h, m, s, total: sec };
};

// ---- Badge icon picker --------------------------------------------------

const BADGE_META = {
  community_builder: { Icon: Users, tint: 'from-emerald-400 to-teal-500' },
  silver_leader:     { Icon: Award, tint: 'from-slate-300 to-slate-500' },
  gold_leader:       { Icon: Crown, tint: 'from-amber-300 to-yellow-500' },
  diamond_leader:    { Icon: Gem, tint: 'from-sky-300 to-cyan-500' },
  elite_mentor:      { Icon: Star, tint: 'from-fuchsia-400 to-pink-500' },
  legend_builder:    { Icon: Rocket, tint: 'from-rose-400 to-red-500' },
};

// ---- Share utilities ----------------------------------------------------

const buildShare = (referralLink, name) => ({
  whatsapp: `https://wa.me/?text=${encodeURIComponent(
    `Join me on Paras Reward and start earning daily PRC! Use my code below and let's grow together.\n\n${referralLink}`,
  )}`,
  telegram: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(
    `Join Paras Reward with ${name || 'me'} and earn daily PRC rewards.`,
  )}`,
  native: async () => {
    if (!navigator.share) return false;
    try {
      await navigator.share({
        title: 'Paras Reward',
        text: `Join Paras Reward and earn daily PRC. Use my link:`,
        url: referralLink,
      });
      return true;
    } catch { return false; }
  },
});

// ==========================================================================
// Main component
// ==========================================================================

export default function CommunityDashboard({ data, user, onOpenLiveFeed }) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const referralLink = useMemo(() => {
    const code = user?.referral_code || data?.user?.referral_code || '';
    return `https://parasreward.com/signup?ref=${code}`;
  }, [user, data]);

  const share = useMemo(() => buildShare(referralLink, data?.user?.name), [referralLink, data]);

  const countdown = useCountdown(data?.monthly_challenge?.countdown_seconds || 0);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Referral link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('Copy failed'); }
  };

  if (!data) return null;

  const { overview, community_health, community_power, analytics,
    next_milestone, community_goal, redeem_unlock, timeline, badges,
    leaderboard, daily_mission, monthly_challenge, level_progression } = data;

  return (
    <div className="space-y-4" data-testid="community-dashboard">

      {/* ============ SECTION 1: HEADER ============ */}
      <div className="text-center pt-1 pb-2" data-testid="community-header">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-amber-300 via-orange-300 to-pink-300 bg-clip-text text-transparent">
          Community Growth
        </h1>
        <p className="text-gray-400 text-xs sm:text-sm mt-1 tracking-wide">
          Build Your Community <span className="text-amber-400">•</span> Earn Activity Rewards <span className="text-amber-400">•</span> Grow Together
        </p>
      </div>

      {/* ============ SECTION 1: OVERVIEW (4 CARDS) ============ */}
      <div className="grid grid-cols-2 gap-2.5" data-testid="community-overview">
        <OverviewCard
          label="Direct Members"
          value={overview.direct_members}
          Icon={Users}
          tint="from-blue-500 to-cyan-500"
          testId="overview-direct-members"
        />
        <OverviewCard
          label="Community Size"
          value={overview.total_members}
          Icon={Sparkles}
          tint="from-purple-500 to-pink-500"
          testId="overview-total-members"
        />
        <OverviewCard
          label="Today's Bonus"
          value={overview.today_bonus_prc}
          suffix="PRC"
          decimals={2}
          Icon={Flame}
          tint="from-orange-500 to-red-500"
          testId="overview-today-bonus"
        />
        <OverviewCard
          label="Lifetime Bonus"
          value={overview.lifetime_bonus_prc}
          suffix="PRC"
          decimals={0}
          Icon={Trophy}
          tint="from-amber-400 to-yellow-500"
          testId="overview-lifetime-bonus"
        />
      </div>

      {/* ============ SECTION 1B: LEVEL PROGRESSION (10-tier bonus) ============ */}
      {level_progression && <LevelProgressionCard data={level_progression} />}

      {/* ============ SECTION 2: INVITE FRIENDS ============ */}
      <GlassCard className="p-4" testId="invite-friends-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-base flex items-center gap-2">
            <Rocket className="w-4 h-4 text-amber-400" /> Invite Friends
          </h3>
          <span className="text-[10px] uppercase tracking-wider text-gray-500">Grow your circle</span>
        </div>
        <div className="flex gap-2 mb-3">
          <div className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 truncate text-sm text-gray-300 font-mono" data-testid="referral-link">
            {referralLink}
          </div>
          <button
            onClick={copyLink}
            className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs flex items-center gap-1.5 transition"
            data-testid="copy-referral-link-btn"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <ShareBtn Icon={MessageCircle} label="WhatsApp" tint="bg-green-500/20 text-green-300 border-green-500/40"
            onClick={() => window.open(share.whatsapp, '_blank', 'noopener,noreferrer')}
            testId="share-whatsapp" />
          <ShareBtn Icon={Send} label="Telegram" tint="bg-sky-500/20 text-sky-300 border-sky-500/40"
            onClick={() => window.open(share.telegram, '_blank', 'noopener,noreferrer')}
            testId="share-telegram" />
          <ShareBtn Icon={Share2} label="Share" tint="bg-purple-500/20 text-purple-300 border-purple-500/40"
            onClick={async () => { const ok = await share.native(); if (!ok) copyLink(); }}
            testId="share-native" />
          <ShareBtn Icon={QrCode} label="QR Code" tint="bg-amber-500/20 text-amber-300 border-amber-500/40"
            onClick={() => setShowQR(true)}
            testId="share-qr" />
        </div>
      </GlassCard>

      {showQR && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowQR(false); }}
          data-testid="qr-modal">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full text-center">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-slate-800 font-bold">Scan to Join</h4>
              <button onClick={() => setShowQR(false)} className="text-slate-500 hover:text-slate-800" data-testid="qr-close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-center p-2 bg-white rounded-xl">
              <QRCodeCanvas value={referralLink} size={220} level="M" includeMargin data-testid="qr-canvas" />
            </div>
            <p className="text-[11px] text-slate-500 mt-3 truncate font-mono">{referralLink}</p>
          </div>
        </div>
      )}

      {/* ============ SECTION 3: COMMUNITY GROWTH BONUS ============ */}
      <GlassCard className="p-4" testId="community-growth-bonus-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-fuchsia-500/25 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-fuchsia-300" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">Community Growth Bonus</h3>
              <p className="text-gray-400 text-[10px]">Earn when your community stays active</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Total</p>
            <p className="text-fuchsia-300 font-bold text-lg tabular-nums">3%</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['L1', 'L2', 'L3'].map((lvl, i) => (
            <div key={lvl} className={`bg-black/40 border border-fuchsia-500/20 rounded-xl p-3 text-center`} data-testid={`growth-bonus-${lvl}`}>
              <p className="text-[10px] text-gray-500 uppercase">{lvl}</p>
              <p className="text-fuchsia-300 font-bold text-lg tabular-nums">1%</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{['Direct', '2nd', '3rd'][i]}</p>
            </div>
          ))}
        </div>
        <button
          onClick={onOpenLiveFeed}
          className="w-full mt-3 py-2.5 rounded-lg bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:opacity-90 text-white font-semibold text-sm flex items-center justify-center gap-2 transition"
          data-testid="view-community-activity-btn"
        >
          <Activity className="w-4 h-4" />
          View Live Community Activity
          <span>→</span>
        </button>
      </GlassCard>

      {/* ============ SECTION 4: COMMUNITY GOAL ============ */}
      <GlassCard className="p-4" testId="community-goal-card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" /> Community Goal
          </h3>
          <span className="text-emerald-300 font-bold text-lg tabular-nums" data-testid="community-goal-percent">
            {community_goal.progress_pct}%
          </span>
        </div>
        <div className="flex items-baseline justify-between mb-2 text-xs">
          <span className="text-white font-semibold text-base tabular-nums">
            {community_goal.current.toLocaleString()} / {community_goal.target.toLocaleString()} Members
          </span>
          <span className="text-gray-400">
            Remaining <b className="text-white">{community_goal.remaining.toLocaleString()}</b>
          </span>
        </div>
        <ProgressBar percent={community_goal.progress_pct} gradient="from-emerald-400 via-teal-400 to-cyan-500" testId="community-goal-progress" />
      </GlassCard>

      {/* ============ SECTION 5: NEXT MILESTONE ============ */}
      <GlassCard className="p-4 bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-transparent" testId="next-milestone-card">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-amber-500/25 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">Next Milestone</h3>
              <p className="text-amber-200 text-[11px] mt-0.5">
                Reach <b>{next_milestone.target_members.toLocaleString()}</b> members
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Reward</p>
            <p className="text-amber-300 font-bold text-base tabular-nums">
              +<Counter value={next_milestone.reward_prc} /> PRC
            </p>
          </div>
        </div>
        <ProgressBar percent={next_milestone.progress_pct} gradient="from-amber-400 via-orange-400 to-red-500" testId="milestone-progress" />
        <p className="text-[10px] text-gray-400 mt-2">
          {next_milestone.remaining} more active builders needed 🚀
        </p>
      </GlassCard>

      {/* ============ SECTION 6: COMMUNITY HEALTH ============ */}
      <GlassCard className="p-4" testId="community-health-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-400" /> Community Health
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-200 border border-rose-500/30 font-semibold uppercase" data-testid="community-health-status">
            {community_health.status}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <MicroTile label="Total" value={community_health.total} tint="bg-white/5 text-white" />
          <MicroTile label="Active" value={community_health.active} tint="bg-emerald-500/15 text-emerald-200" />
          <MicroTile label="Inactive" value={community_health.inactive} tint="bg-slate-500/15 text-slate-300" />
        </div>
        <div className="flex items-baseline justify-between text-xs mb-1.5">
          <span className="text-gray-400">Health Score</span>
          <span className="text-rose-300 font-bold tabular-nums" data-testid="community-health-score">
            {community_health.health_score_pct}%
          </span>
        </div>
        <ProgressBar percent={community_health.health_score_pct} gradient="from-rose-400 via-pink-400 to-fuchsia-500" />
      </GlassCard>

      {/* ============ SECTION 7: COMMUNITY POWER ============ */}
      <GlassCard className="p-4" testId="community-power-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-[0_0_30px_-6px_rgba(251,191,36,0.6)]">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Community Power</p>
              <p className="text-[10px] text-gray-400">Compounding boost from active members</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent leading-none" data-testid="community-power-percent">
              <Counter value={community_power.percent} />%
            </p>
            <p className="text-[10px] text-yellow-300 uppercase tracking-wider mt-0.5" data-testid="community-power-status">
              {community_power.status}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* ============ SECTION 8: ANALYTICS ============ */}
      <GlassCard className="p-4" testId="community-analytics-card">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-cyan-400" /> Community Analytics
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {[
            ['Today',     analytics.today,     'text-cyan-300'],
            ['This Week', analytics.this_week, 'text-blue-300'],
            ['This Month',analytics.this_month,'text-indigo-300'],
            ['Lifetime',  analytics.lifetime,  'text-purple-300'],
          ].map(([lbl, val, cls]) => (
            <div key={lbl} className="bg-black/40 border border-white/5 rounded-xl p-2.5 text-center" data-testid={`analytics-${lbl.toLowerCase().replace(' ','-')}`}>
              <p className="text-[10px] uppercase tracking-wider text-gray-500">{lbl}</p>
              <p className={`${cls} font-bold text-lg tabular-nums`}>
                <Counter value={val} />
              </p>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* ============ SECTION 11: REDEEM UNLOCK ============ */}
      <GlassCard className="p-4 bg-gradient-to-br from-cyan-500/10 to-blue-500/10" testId="redeem-unlock-card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Gem className="w-4 h-4 text-cyan-300" /> Redeem Unlock
          </h3>
          <span className="text-cyan-300 font-bold text-lg tabular-nums" data-testid="redeem-unlock-percent">
            {redeem_unlock.percent}%
          </span>
        </div>
        <ProgressBar percent={redeem_unlock.percent} gradient="from-cyan-400 via-blue-400 to-indigo-500" />
        <p className="text-[11px] text-gray-400 mt-2">{redeem_unlock.hint}</p>
      </GlassCard>

      {/* ============ SECTION 12: DAILY MISSION ============ */}
      <GlassCard className="p-4 bg-gradient-to-br from-lime-500/10 to-emerald-500/10" testId="daily-mission-card">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-lime-300">{daily_mission.title}</p>
            <p className="text-white font-semibold text-sm mt-0.5">{daily_mission.task}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Reward</p>
            <p className="text-lime-300 font-bold tabular-nums">+{daily_mission.reward_prc} PRC</p>
          </div>
        </div>
        <div className="flex items-baseline justify-between text-xs mb-1">
          <span className="text-gray-400 tabular-nums">
            {daily_mission.progress} / {daily_mission.target} completed
          </span>
          {daily_mission.completed && (
            <span className="text-lime-300 font-bold text-xs">✓ Done</span>
          )}
        </div>
        <ProgressBar percent={(daily_mission.progress / daily_mission.target) * 100} gradient="from-lime-400 to-emerald-500" testId="mission-progress" />
      </GlassCard>

      {/* ============ SECTION 13: BADGES ============ */}
      <div data-testid="badges-section">
        <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2 px-1">
          <Award className="w-4 h-4 text-amber-400" /> Community Achievements
        </h3>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
          {badges.map((b) => {
            const meta = BADGE_META[b.key] || { Icon: Star, tint: 'from-slate-400 to-slate-600' };
            const IconEl = meta.Icon;
            return (
              <div
                key={b.key}
                className={`snap-center shrink-0 w-28 rounded-2xl p-3 text-center border transition ${
                  b.earned
                    ? 'bg-gradient-to-br ' + meta.tint + ' border-white/20 shadow-[0_0_20px_-6px_rgba(251,191,36,0.6)]'
                    : 'bg-white/[0.03] border-white/5 opacity-70'
                }`}
                data-testid={`badge-${b.key}`}
              >
                <div className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center mb-1.5 ${b.earned ? 'bg-white/25' : 'bg-white/5'}`}>
                  <IconEl className={`w-5 h-5 ${b.earned ? 'text-white' : 'text-gray-500'}`} />
                </div>
                <p className={`text-[10px] font-semibold leading-tight ${b.earned ? 'text-white' : 'text-gray-400'}`}>
                  {b.name}
                </p>
                <p className={`text-[9px] mt-0.5 ${b.earned ? 'text-white/80' : 'text-gray-500'}`}>
                  {b.threshold}+ members
                </p>
                {!b.earned && (
                  <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: `${b.progress_pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ============ SECTION 14: LEADERBOARD ============ */}
      <GlassCard className="p-4" testId="leaderboard-card">
        <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" /> Your Rank
        </h3>
        <div className="grid grid-cols-5 gap-1.5">
          {[
            ['Today', leaderboard.today_rank],
            ['Week',  leaderboard.week_rank],
            ['Month', leaderboard.month_rank],
            ['State', leaderboard.state_rank],
            ['Nation',leaderboard.national_rank],
          ].map(([lbl, rank]) => (
            <div key={lbl} className="bg-black/40 border border-amber-500/10 rounded-xl p-2 text-center" data-testid={`rank-${lbl.toLowerCase()}`}>
              <p className="text-[9px] uppercase tracking-wider text-gray-500">{lbl}</p>
              <p className="text-amber-300 font-bold text-lg tabular-nums leading-tight">
                #{rank ?? '—'}
              </p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-500 mt-2 text-center">
          Out of {(leaderboard.leaderboard_size || 0).toLocaleString()} active builders
        </p>
      </GlassCard>

      {/* ============ SECTION 15: COMMUNITY TIMELINE ============ */}
      <GlassCard className="p-4" testId="community-timeline-card">
        <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-purple-400" /> Community Timeline
        </h3>
        <div className="relative">
          {timeline.map((t, i) => (
            <div key={t.count} className="flex items-center gap-3 relative" data-testid={`timeline-${t.count}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 z-10 ${
                t.completed
                  ? 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_18px_-4px_rgba(52,211,153,0.6)]'
                  : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}>
                {t.completed ? <Check className="w-4 h-4" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
              </div>
              <div className="flex-1 py-2 flex items-center justify-between">
                <span className={`text-sm font-semibold ${t.completed ? 'text-white' : 'text-gray-500'} tabular-nums`}>
                  {t.count.toLocaleString()} Members
                </span>
                <span className={`text-xs tabular-nums ${t.completed ? 'text-emerald-300' : 'text-gray-500'}`}>
                  +{t.reward_prc.toLocaleString()} PRC
                </span>
              </div>
              {i < timeline.length - 1 && (
                <div className={`absolute left-4 top-8 bottom-0 w-px ${t.completed ? 'bg-emerald-500/50' : 'bg-slate-700'}`} style={{ height: '2rem' }} />
              )}
            </div>
          ))}
        </div>
      </GlassCard>

      {/* ============ SECTION 16: MONTHLY CHALLENGE ============ */}
      <GlassCard className="p-4 bg-gradient-to-br from-rose-500/15 to-red-500/10 border-rose-500/30" testId="monthly-challenge-card">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-rose-500/25 flex items-center justify-center">
            <Timer className="w-5 h-5 text-rose-300" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">{monthly_challenge.title}</p>
            <p className="text-rose-200 text-[11px]">{monthly_challenge.subtitle}</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {[['D', countdown.d], ['H', countdown.h], ['M', countdown.m], ['S', countdown.s]].map(([u, v]) => (
            <div key={u} className="bg-black/40 rounded-lg p-2 text-center border border-rose-500/20">
              <p className="text-rose-300 font-bold text-lg tabular-nums leading-none">{String(v).padStart(2, '0')}</p>
              <p className="text-[9px] text-gray-400 uppercase mt-0.5">{u === 'D' ? 'Days' : u === 'H' ? 'Hours' : u === 'M' ? 'Mins' : 'Secs'}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-rose-200">{monthly_challenge.reward_text}</p>
      </GlassCard>

      {/* ============ SECTION 17: SHARE BANNER ============ */}
      <div
        className="relative overflow-hidden rounded-2xl p-5 text-center bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 shadow-[0_10px_40px_-12px_rgba(251,113,133,0.5)] cursor-pointer transition hover:scale-[1.01]"
        onClick={async () => { const ok = await share.native(); if (!ok) copyLink(); }}
        data-testid="share-banner"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_60%)]" />
        <div className="relative">
          <p className="text-black/70 text-[11px] uppercase tracking-widest font-bold">Grow Together</p>
          <h4 className="text-white text-xl font-black mt-1">Build Community • Unlock Rewards</h4>
          <button
            className="mt-3 inline-flex items-center gap-2 px-5 py-2 rounded-full bg-black/85 text-white font-semibold text-sm hover:bg-black transition"
            data-testid="share-banner-btn"
          >
            <Share2 className="w-4 h-4" /> Share Now
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// Sub-components
// ==========================================================================

const OverviewCard = ({ label, value, suffix, decimals = 0, Icon, tint, testId }) => (
  <GlassCard className="p-3" testId={testId}>
    <div className="flex items-center justify-between mb-1">
      <span className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</span>
      <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${tint} flex items-center justify-center shrink-0`}>
        <Icon className="w-3 h-3 text-white" />
      </div>
    </div>
    <p className="text-white font-black text-xl tabular-nums leading-tight">
      <Counter value={value} decimals={decimals} />
      {suffix && <span className="text-gray-400 text-[10px] font-semibold ml-1">{suffix}</span>}
    </p>
  </GlassCard>
);

const MicroTile = ({ label, value, tint }) => (
  <div className={`rounded-xl px-2 py-2 text-center border border-white/5 ${tint}`}>
    <p className="text-[9px] uppercase tracking-wider opacity-70">{label}</p>
    <p className="font-bold text-base tabular-nums leading-tight"><Counter value={value} /></p>
  </div>
);

const ShareBtn = ({ Icon, label, onClick, tint, testId }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border transition hover:opacity-80 ${tint}`}
    data-testid={testId}
  >
    <Icon className="w-4 h-4" />
    <span className="text-[10px] font-semibold">{label}</span>
  </button>
);

// ==========================================================================
// LEVEL PROGRESSION — 10-tier Community Bonus display (Feb 16 2026)
// Shows the user's current earnable level, progress to the next level, and
// a compact scrollable grid of all 10 levels with unlocked/locked state.
// ==========================================================================
const LevelProgressionCard = ({ data }) => {
  if (!data || !Array.isArray(data.levels)) return null;

  const {
    current_level: currentLevel,
    current_percent: currentPct,
    l1_active_elite_count: activeCount,
    next_level: nextLevel,
    levels,
    elite_active: eliteActive,
    partner_position_overrides_levels: pposOverride,
  } = data;

  return (
    <GlassCard className="p-4" testId="level-progression-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-3" data-testid="level-progression-header">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Level Progression</p>
            <p className="text-[10px] text-gray-400 leading-tight">Community Bonus Levels 1 – 10</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider leading-tight">Your Level</p>
          <p className="text-white font-black text-xl leading-tight" data-testid="level-current-badge">
            L{currentLevel}
            <span className="text-amber-300 text-xs font-bold ml-1">{currentPct.toFixed(1)}%</span>
          </p>
        </div>
      </div>

      {/* Elite status callout */}
      {!eliteActive && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 mb-3 text-[11px] text-amber-200 flex items-start gap-2" data-testid="level-elite-required">
          <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Elite subscription required to receive Community Bonus. Levels are computed but earnings are paused until you activate Elite.</span>
        </div>
      )}

      {/* Partner-position override callout */}
      {pposOverride && (
        <div className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 px-3 py-2 mb-3 text-[11px] text-fuchsia-200 flex items-start gap-2" data-testid="level-pp-override">
          <Crown className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Your Leadership Position overrides the standard 10-level table. You&apos;re earning via Coordinator rules instead.</span>
        </div>
      )}

      {/* Progress-to-next-level bar */}
      {nextLevel && (
        <div className="mb-3" data-testid="level-next-progress">
          <div className="flex justify-between items-baseline mb-1.5">
            <p className="text-[11px] text-gray-300">
              Next: <span className="font-bold text-white">L{nextLevel.next_level}</span>
              <span className="text-amber-300 font-bold ml-1">{nextLevel.next_percent.toFixed(1)}%</span>
            </p>
            <p className="text-[10px] text-gray-400 tabular-nums">
              <span className="text-emerald-300 font-bold" data-testid="level-active-count">{activeCount}</span>
              <span className="mx-1">/</span>
              <span>{nextLevel.required_l1_active_elite}</span>
              <span className="ml-1">active Elite</span>
            </p>
          </div>
          <ProgressBar percent={nextLevel.progress_pct} gradient="from-indigo-400 via-purple-400 to-fuchsia-500" testId="level-next-progress-bar" />
          <p className="text-[10px] text-gray-400 mt-1">
            Need <span className="text-white font-bold">{nextLevel.missing_count}</span> more active Elite direct member{nextLevel.missing_count === 1 ? '' : 's'} to unlock L{nextLevel.next_level}.
          </p>
        </div>
      )}

      {/* Levels grid */}
      <div className="grid grid-cols-5 gap-1.5" data-testid="level-progression-grid">
        {levels.map((lvl) => {
          const unlocked = lvl.unlocked;
          const isCurrent = lvl.is_current;
          const base = 'rounded-lg px-1.5 py-2 text-center border transition';
          const state = unlocked
            ? (isCurrent
                ? 'bg-gradient-to-br from-indigo-500 to-purple-600 border-white/20 text-white shadow-lg shadow-purple-500/30'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100')
            : 'bg-white/5 border-white/10 text-gray-500';
          return (
            <div key={lvl.level} className={`${base} ${state}`} data-testid={`level-tile-${lvl.level}`}>
              <p className="text-[9px] uppercase tracking-wider opacity-70 leading-tight">L{lvl.level}</p>
              <p className="font-black text-sm tabular-nums leading-tight">{lvl.percent.toFixed(1)}%</p>
              <p className="text-[9px] opacity-70 leading-tight mt-0.5">
                {lvl.required_l1_active_elite === 0 ? 'Free' : `${lvl.required_l1_active_elite}+`}
              </p>
            </div>
          );
        })}
      </div>

      {/* Footer explainer */}
      <p className="text-[10px] text-gray-400 mt-3 leading-relaxed" data-testid="level-progression-help">
        Each mining collect by your downline pays you a % based on their depth in your network. Bring in more <span className="text-emerald-300 font-semibold">active Elite direct members</span> to unlock deeper levels and higher %.
      </p>
    </GlassCard>
  );
};
