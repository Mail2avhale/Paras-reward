import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import RewardLoader from '@/components/RewardLoader';
import { 
  Users, Copy, Check, Share2, ArrowLeft, TrendingUp, 
  UserCheck, Link2, RefreshCw, Gift, ChevronRight, ChevronDown, Loader2, MessageCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useRewardedInterstitial } from '@/components/RewardedInterstitialTrigger';

const API = process.env.REACT_APP_BACKEND_URL;

const ReferralsEnhanced = ({ user, refreshUserData }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [networkStats, setNetworkStats] = useState(null);
  const [directReferrals, setDirectReferrals] = useState([]);
  const [levelBreakdown, setLevelBreakdown] = useState(null);
  // Elite Mining Commission live config (Jul 2026) — admin-controlled tiers
  // and per-tier percentages, displayed as an earn-potential card so users
  // understand exactly how much they earn from each downline collect.
  const [commissionConfig, setCommissionConfig] = useState(null);

  // Self-claim modal state — for users who registered without a referral
  // code and want to attach a referrer post-signup (within 30 days).
  // Feb 2026 UX change: form is INLINE (no modal), so we only track input + lookup state.
  const [claimCodeInput, setClaimCodeInput] = useState('');
  const [claimLookup, setClaimLookup] = useState({ status: 'idle', referrerName: '', error: '' });

  // Rewarded Interstitial trigger — fires when user opens Live Feed so we
  // offer a "+5 PRC bonus for watching an ad" opt-in. Non-gating: user
  // reaches the Live Feed regardless (compliant with Google AdMob policy).
  const rewardedAd = useRewardedInterstitial();
  const openLiveFeed = () => {
    // Fire-and-forget ad prompt, then navigate immediately. The modal
    // renders on TOP of the destination page, so it still counts as a
    // rewarded moment tied to this action.
    try { rewardedAd.open({ bonusPrc: 5 }); } catch { /* non-fatal */ }
    navigate('/referrals/live-feed');
  };
  const [submittingClaim, setSubmittingClaim] = useState(false);
  // Jul 2026 UX fix: when a referrer is already attached we now render a
  // clear "Referred by …" locked info card instead of silently hiding the
  // whole section. Ambiguous absence was the #1 confusion in tickets.
  const [attachedReferrer, setAttachedReferrer] = useState(null);
  const [partnerPosition, setPartnerPosition] = useState(null);  // Feb 6 2026 — partner position badge
  
  // Referral code from user
  const referralCode = user?.referral_code || '';
  const referralLink = `https://parasreward.com/register?ref=${referralCode}`;

  const fetchData = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      setRefreshing(true);
      
      // Fetch network stats, mining speed, and referrals in PARALLEL.
      // direct-list does heavy aggregation per referral — needs longer timeout
      // than the lighter stats endpoints.
      const [statsRes, miningRes, referralsRes, breakdownRes, commissionRes, positionRes] = await Promise.all([
        axios.get(`${API}/api/growth/network-stats/${user.uid}`, { timeout: 8000 }).catch(() => null),
        axios.get(`${API}/api/growth/mining-speed/${user.uid}`, { timeout: 8000 }).catch(() => null),
        axios.get(`${API}/api/notifications/referrals/${user.uid}/direct-list`, { timeout: 20000 }).catch((err) => {
          console.error('[Invite] direct-list fetch failed:', err?.message);
          return null;
        }),
        axios.get(`${API}/api/notifications/referrals/${user.uid}/level-breakdown?max_depth=3`, { timeout: 25000 }).catch((err) => {
          console.error('[Invite] level-breakdown failed:', err?.message);
          return null;
        }),
        axios.get(`${API}/api/mining/commission-config`, { timeout: 8000 }).catch(() => null),
        // Feb 6 2026 — partner position badge feed
        axios.get(`${API}/partners/my-position/${user.uid}`, { timeout: 8000 }).catch(() => null),
      ]);
      
      if (positionRes?.data?.success) {
        setPartnerPosition(positionRes.data);
      }
      
      if (statsRes?.data?.success) {
        const stats = { ...statsRes.data.data };
        // Use single leg tree network size (from mining-speed) for Network Size display
        if (miningRes?.data?.data?.network_size !== undefined) {
          stats.single_leg_network = miningRes.data.data.network_size;
        }
        setNetworkStats(stats);
      }
      
      if (referralsRes?.data?.referrals) {
        setDirectReferrals(referralsRes.data.referrals);
      } else if (referralsRes?.data?.data) {
        setDirectReferrals(referralsRes.data.data);
      }

      if (breakdownRes?.data?.success) {
        setLevelBreakdown(breakdownRes.data);
      }

      if (commissionRes?.data && Array.isArray(commissionRes.data.tiers)) {
        setCommissionConfig(commissionRes.data);
      }
      
    } catch (error) {
      console.error('Fetch referral data error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const handleShare = async () => {
    // WhatsApp-targeted referral share (Phase 3)
    const { shareReferralOnWhatsApp } = await import('@/utils/nativeShare');
    await shareReferralOnWhatsApp({
      link: referralLink,
      code: referralCode,
      name: user?.name,
    });
  };

  // --- Self-claim referrer flow (Feb 2026 restoration) -----------------
  // Show the claim CTA only when the current user has NO referrer attached.
  const canClaimReferrer = !!user && !user.referred_by;
  const hasReferrerAttached = !!user && !!user.referred_by;

  // Resolve the attached referrer's name so the "Already referred by …"
  // card can show a friendly identity instead of the raw uid.
  useEffect(() => {
    if (!hasReferrerAttached || !user?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/api/referral/my-referrer/${user.uid}`, { timeout: 8000 });
        if (!cancelled && res.data?.has_referrer) {
          setAttachedReferrer({
            name: res.data.referrer_name || 'A friend',
            code: res.data.referral_code || null,
          });
        }
      } catch {
        // Silently fall back to a generic label — never block the page.
        if (!cancelled) setAttachedReferrer({ name: 'A friend', code: null });
      }
    })();
    return () => { cancelled = true; };
  }, [hasReferrerAttached, user?.uid]);

  // Live-lookup the code as the user types (debounced 350ms). Provides
  // immediate feedback ("Referred by Rajesh M.") before the user commits.
  useEffect(() => {
    if (!canClaimReferrer) return;
    const code = claimCodeInput.trim().toUpperCase();
    if (code.length < 4) {
      setClaimLookup({ status: 'idle', referrerName: '', error: '' });
      return;
    }
    setClaimLookup(prev => ({ ...prev, status: 'loading', error: '' }));
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`${API}/api/referral/lookup/${encodeURIComponent(code)}`);
        if (res.data?.valid) {
          setClaimLookup({ status: 'valid', referrerName: res.data.referrer_name || 'A friend', error: '' });
        } else {
          setClaimLookup({ status: 'invalid', referrerName: '', error: 'Invalid code' });
        }
      } catch {
        setClaimLookup({ status: 'invalid', referrerName: '', error: 'Invalid code' });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [claimCodeInput, canClaimReferrer]);

  const handleSubmitClaim = async () => {
    const code = claimCodeInput.trim().toUpperCase();
    if (!code || claimLookup.status !== 'valid') {
      toast.error('Please enter a valid referral code first');
      return;
    }
    setSubmittingClaim(true);
    try {
      const res = await axios.post(`${API}/api/referral/apply/${user.uid}`, { referral_code: code });
      toast.success(`Attached to ${res.data?.referrer_name || 'your referrer'}!`, {
        icon: <Gift className="w-5 h-5" />,
      });
      setClaimCodeInput('');
      setClaimLookup({ status: 'idle', referrerName: '', error: '' });
      // Refresh both the page data and the parent user object so the inline
      // card disappears immediately (canClaimReferrer flips to false).
      // refreshUserData REQUIRES the uid arg — see Feb 28 2026 prod fix.
      fetchData();
      if (typeof refreshUserData === 'function') refreshUserData(user.uid);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Could not attach referrer';
      toast.error(msg);
    } finally {
      setSubmittingClaim(false);
    }
  };

  // Calculate progress using single leg network
  const activeNetwork = networkStats?.single_leg_network ?? networkStats?.network_size ?? 0;
  const networkProgress = networkStats ? 
    Math.min(100, (activeNetwork / (networkStats.network_cap || 1)) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <RewardLoader message="Loading referrals..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-24">
      {/* Rewarded Interstitial modal — opens from openLiveFeed() */}
      {rewardedAd.element}
      {/* Header */}
      <div className="sticky top-0 bg-[#0a0a0f]/95 backdrop-blur-lg border-b border-gray-800/50 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-gray-800"
              data-testid="back-button"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <h1 className="text-lg font-semibold text-white">Growth Network</h1>
          </div>
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="p-2 rounded-full hover:bg-gray-800"
          >
            <RefreshCw className={`w-5 h-5 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        
        {/* Referral Link Card */}
        {referralCode && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-5 shadow-lg" data-testid="referral-link-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-white/80" />
                <span className="text-white/80 text-sm font-medium">Your Referral Link</span>
              </div>
              <span className="bg-white/20 px-2 py-1 rounded text-white text-xs font-bold">
                {referralCode}
              </span>
            </div>
            
            <div className="bg-black/20 rounded-xl p-3 mb-4 truncate">
              <p className="text-white/90 text-sm font-mono truncate">{referralLink}</p>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={handleCopy}
                className="flex-1 bg-white/20 hover:bg-white/30 text-white border-0"
                data-testid="copy-button"
              >
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button
                onClick={handleShare}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                data-testid="share-button"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share on WhatsApp
              </Button>
            </div>
          </div>
        )}

        {/* Self-Claim Referrer — inline card, shown ONLY when user has no
            referrer yet. Sits right below the user's own Referral Link card
            so the symmetry is obvious: "share yours / enter someone else's". */}
        {canClaimReferrer && (
          <div className="bg-gradient-to-br from-violet-600/90 to-fuchsia-600/85 rounded-2xl p-5 shadow-lg" data-testid="enter-referral-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-base leading-tight">Enter Referral Code</p>
                <p className="text-white/75 text-[11px] mt-0.5">One-time. Within 30 days of signup.</p>
              </div>
            </div>

            <input
              type="text"
              value={claimCodeInput}
              onChange={(e) => setClaimCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. ABCD1234"
              maxLength={12}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck="false"
              data-testid="claim-code-input"
              disabled={submittingClaim}
              className="w-full bg-black/30 border border-white/15 rounded-xl px-4 py-3 text-white font-mono text-base tracking-wider focus:outline-none focus:border-white/50 transition placeholder:text-white/30 disabled:opacity-60"
            />

            {/* Live lookup feedback */}
            <div className="min-h-[20px] mt-2 px-1" aria-live="polite">
              {claimLookup.status === 'loading' && (
                <p className="text-white/55 text-xs">Looking up…</p>
              )}
              {claimLookup.status === 'valid' && (
                <p className="text-emerald-200 text-xs font-medium flex items-center gap-1.5" data-testid="claim-referrer-name">
                  <Check className="w-3.5 h-3.5" /> Referred by {claimLookup.referrerName}
                </p>
              )}
              {claimLookup.status === 'invalid' && (
                <p className="text-rose-200 text-xs">No user found with that code.</p>
              )}
            </div>

            <Button
              onClick={handleSubmitClaim}
              disabled={submittingClaim || claimLookup.status !== 'valid'}
              data-testid="claim-submit-btn"
              className="w-full mt-3 bg-white/95 hover:bg-white text-violet-700 font-bold py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {submittingClaim ? 'Attaching…' : 'Attach Referrer'}
            </Button>
          </div>
        )}

        {/* Already-Referred info card — replaces the silent hide so users
            understand WHY they can't enter a code. Renders whenever the
            current user has a referrer already attached. */}
        {hasReferrerAttached && (
          <div
            className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 flex items-center gap-3"
            data-testid="already-referred-card"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white/90 font-semibold text-sm">
                Referred by{' '}
                <span className="text-emerald-400" data-testid="attached-referrer-name">
                  {attachedReferrer?.name || 'A friend'}
                </span>
              </p>
              <p className="text-gray-500 text-xs mt-0.5">
                Your referrer is already attached — you cannot enter another code.
              </p>
            </div>
          </div>
        )}

        {/* Stats Cards - Only Direct Referrals & Network Size */}
        <div className="grid grid-cols-2 gap-4">
          {/* Direct Referrals */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 text-center" data-testid="direct-referrals-card">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-white">{networkStats?.direct_referrals || 0}</p>
            <p className="text-sm text-gray-500">Direct Referrals</p>
          </div>

          {/* Network Size (Single Leg Tree) */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 text-center" data-testid="network-size-card">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
            <p className="text-3xl font-bold text-white">{networkStats?.single_leg_network ?? networkStats?.network_size ?? 0}</p>
            <p className="text-sm text-gray-500">Network Size</p>
          </div>
        </div>

        {/* Network Capacity Progress Bar */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5" data-testid="network-progress-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm">Network Capacity</span>
            <span className="text-amber-400 font-bold text-lg">
              {networkProgress.toFixed(0)}%
            </span>
          </div>
          <div className="h-4 bg-gray-800/80 rounded-full overflow-hidden ring-1 ring-gray-700/50">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${networkProgress}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-gray-500 text-xs">{activeNetwork} active users</span>
            <span className="text-gray-500 text-xs">Cap: {networkStats?.network_cap || 0}</span>
          </div>
        </div>

        {/* Elite Mining Commission (Jul 2026 — Live admin config) */}
        {commissionConfig && commissionConfig.enabled && commissionConfig.tiers?.length > 0 && (
          <div
            className="bg-gradient-to-br from-fuchsia-900/40 to-purple-900/40 border border-fuchsia-500/30 rounded-2xl p-5"
            data-testid="elite-mining-commission-card"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-fuchsia-500/20 flex items-center justify-center">
                  <Gift className="w-5 h-5 text-fuchsia-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-base leading-tight">
                    Elite Mining Commission
                  </h3>
                  <p className="text-gray-400 text-[11px] leading-tight">
                    Earn PRC when your downlines collect mining rewards
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total Earn %</p>
                <p
                  className="text-fuchsia-300 font-bold tabular-nums text-lg"
                  data-testid="commission-total-percent"
                >
                  {commissionConfig.total_percent.toFixed(2)}%
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
              {commissionConfig.tiers.map((t) => (
                <div
                  key={t.tier}
                  className="bg-black/40 border border-fuchsia-500/20 rounded-lg p-2 text-center"
                  data-testid={`commission-tier-${t.tier}`}
                >
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                    Tier {t.tier}
                  </p>
                  <p className="text-fuchsia-300 font-bold tabular-nums">
                    {Number(t.percent).toFixed(2)}%
                  </p>
                </div>
              ))}
            </div>

            <p className="text-gray-400 text-[11px] mt-3 leading-relaxed">
              {commissionConfig.elite_only ? (
                <><b className="text-fuchsia-300">Elite uplines</b> receive commission.</>
              ) : (
                <>All uplines receive commission.</>
              )}
              {commissionConfig.roll_up && (
                <> Non-Elite ancestors are skipped — the tier slot rolls up to the next Elite user in your chain.</>
              )}
              {' '}Every time an Elite user in your downline collects PRC from their mining session, you earn a percentage — credited instantly to your wallet with a live notification.
            </p>

            <button
              onClick={openLiveFeed}
              className="w-full mt-3 py-2.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
              data-testid="view-downline-live-feed-btn"
            >
              <span>View Downline Live Feed</span>
              <span className="text-fuchsia-200">→</span>
            </button>
          </div>
        )}

        {/* L1-L3 Level Breakdown (Feb 2026 — capped from L1-L5 to L1-L3
            per user feedback: deeper levels contribute negligible boost
            and clutter the mobile view). */}
        {levelBreakdown && levelBreakdown.grand_total?.users > 0 && (
          <div className="space-y-3" data-testid="level-breakdown-section">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-white font-semibold text-base">Network by Level</h3>
              <div className="text-right">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Mining Boost</p>
                <p className="text-emerald-400 font-bold tabular-nums" data-testid="total-mining-boost">
                  +{levelBreakdown.total_mining_boost_pct}%
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {['L1', 'L2', 'L3'].map((lvl, idx) => {
                const data = levelBreakdown.levels?.[lvl] || {};
                const boost = levelBreakdown.boosts_pct?.[lvl] || 0;
                const gradients = [
                  'from-amber-500/20 to-orange-500/10 border-amber-500/40',
                  'from-blue-500/20 to-cyan-500/10 border-blue-500/40',
                  'from-purple-500/20 to-pink-500/10 border-purple-500/40',
                ];
                const labels = ['Direct', '2nd', '3rd'];
                return (
                  <div
                    key={lvl}
                    data-testid={`referral-level-card-${lvl}`}
                    className={`bg-gradient-to-br ${gradients[idx]} border rounded-2xl p-3.5`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400">
                          {lvl} · {labels[idx]} downline
                        </p>
                        <p className="text-2xl font-bold text-white tabular-nums">
                          {data.total || 0}
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
                        +{boost}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <div className="bg-black/30 rounded-lg px-2 py-1.5">
                        <p className="text-gray-500 text-[10px]">Active</p>
                        <p className="text-emerald-300 font-bold tabular-nums">{data.active || 0}</p>
                      </div>
                      <div className="bg-black/30 rounded-lg px-2 py-1.5">
                        <p className="text-gray-500 text-[10px]">Inactive</p>
                        <p className="text-gray-400 font-bold tabular-nums">{data.inactive || 0}</p>
                      </div>
                    </div>
                    {data.top?.name && (
                      <div className="mt-2 pt-2 border-t border-white/10 text-[11px]">
                        <p className="text-gray-400">
                          🏆 Top: <span className="text-white font-medium">{data.top.name}</span>
                          <span className="text-gray-500 ml-1">
                            ({Math.round(data.top.prc_balance || 0).toLocaleString()} PRC)
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Partner Positions in your network — new Feb 2026 section.
                Zeros are hidden individually so basic users see a clean
                empty state instead of "0 0 0 0". */}
            {(() => {
              const pc = levelBreakdown.partner_counts || {};
              const partnerTiles = [
                { key: 'district_partner',        label: 'District Partners',  cnt: pc.district_partner || 0,        cls: 'from-amber-500/20 to-yellow-500/10 border-amber-500/40 text-amber-300' },
                { key: 'regional_state_partner',  label: 'Regional Partners',  cnt: pc.regional_state_partner || 0,  cls: 'from-sky-500/20 to-blue-500/10 border-sky-500/40 text-sky-300' },
                { key: 'state_partner',           label: 'State Partners',     cnt: pc.state_partner || 0,           cls: 'from-fuchsia-500/20 to-pink-500/10 border-fuchsia-500/40 text-fuchsia-300' },
                { key: 'national_partner',        label: 'National Partners',  cnt: pc.national_partner || 0,        cls: 'from-rose-500/20 to-red-500/10 border-rose-500/40 text-rose-300' },
              ];
              const totalPartners = partnerTiles.reduce((s, t) => s + t.cnt, 0);
              if (totalPartners === 0) return null;
              return (
                <div className="pt-1" data-testid="partner-positions-section">
                  <div className="flex items-center justify-between px-1 mb-2">
                    <h3 className="text-white font-semibold text-base">Partner Positions in Your Network</h3>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                      Total: <span className="text-white font-bold">{totalPartners}</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {partnerTiles.map((t) => (
                      <div
                        key={t.key}
                        data-testid={`partner-tile-${t.key}`}
                        className={`bg-gradient-to-br ${t.cls} border rounded-2xl p-3 flex items-center justify-between`}
                      >
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 leading-tight">{t.label}</p>
                          <p className="text-2xl font-bold text-white tabular-nums">{t.cnt}</p>
                        </div>
                        <div className={`w-8 h-8 rounded-full bg-white/5 border ${t.cnt > 0 ? 'opacity-100' : 'opacity-40'} flex items-center justify-center`}>
                          <Users className="w-4 h-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Network Tree diagram — top 5 L1 branches by depth.
                Rendered as compact tree with connector lines using pure
                CSS. Skipped when no L1 downlines exist. */}
            {levelBreakdown.top_branches && levelBreakdown.top_branches.length > 0 && (
              <div className="pt-1" data-testid="network-tree-section">
                <div className="flex items-center justify-between px-1 mb-2">
                  <h3 className="text-white font-semibold text-base">Network Tree</h3>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                    Tap any node to expand
                  </span>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
                  <NetworkTreeView
                    rootUid={user.uid}
                    branches={levelBreakdown.top_branches}
                    totalL1={levelBreakdown.levels?.L1?.total || levelBreakdown.top_branches.length}
                  />
                </div>
              </div>
            )}

            <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-3 text-[11px] text-gray-400 leading-relaxed">
              💡 Each <strong className="text-emerald-400">Active</strong> network member contributes
              <span className="text-emerald-400 font-bold"> +2% </span>
              to your daily mining boost (capped at +100% per level).
              Help inactive members reactivate to maximize your earnings!
            </div>

            {/* Network Cap Tier Breakdown removed (Jul 2026) — replaced by the
                new 3-tier Elite Mining Commission system. Base cap is now a
                flat 800 for everyone, so the old L1-L5 cascade card would
                only show 0's and mislead users. */}
          </div>
        )}



        {/* Direct Referrals List */}
        {directReferrals.length > 0 && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden" data-testid="direct-referrals-list">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-400" />
                Your Direct Referrals
              </h3>
              <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded-lg text-sm">
                {directReferrals.length}
              </span>
            </div>
            
            <div className="divide-y divide-gray-800 max-h-[500px] overflow-y-auto">
              {directReferrals.map((ref, index) => (
                <div key={ref.uid || index} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          ref.is_active 
                            ? 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/30' 
                            : 'bg-red-500/10 text-red-400 ring-2 ring-red-500/20'
                        }`}>
                          {ref.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-gray-900 ${
                          ref.is_active ? 'bg-emerald-500' : 'bg-red-500'
                        }`} />
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{ref.name || 'User'}</p>
                        <p className="text-xs text-gray-500 font-mono">
                          {ref.mobile ? ref.mobile.slice(0, 2) + '****' + ref.mobile.slice(-4) : '—'}
                        </p>
                      </div>
                    </div>
                    {ref.is_active ? (
                      <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-lg font-medium">Active</span>
                    ) : (
                      <span className="px-2 py-1 bg-red-500/15 text-red-400 text-xs rounded-lg font-medium">Inactive</span>
                    )}
                  </div>
                  
                  {/* Total PRC Redeemed in INR */}
                  <div className="ml-[52px]">
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-1.5 inline-block" data-testid={`ref-redeemed-inr-${index}`}>
                      <p className="text-[10px] text-gray-500 uppercase">Total Redeemed</p>
                      <p className="text-amber-400 text-sm font-bold">
                        ₹{Number(ref.redeemed_inr || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Partner Position Badge (Feb 6 2026) */}
        {partnerPosition && (
          <div
            className="bg-gradient-to-br from-indigo-900/60 via-purple-900/50 to-slate-900/60 border border-indigo-500/30 rounded-2xl p-5"
            data-testid="partner-position-badge"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl">
                {partnerPosition.partner_position === 'national_partner' ? '🇮🇳' :
                 partnerPosition.partner_position === 'state_partner' ? '🏛️' :
                 partnerPosition.partner_position === 'regional_state_partner' ? '📍' :
                 partnerPosition.partner_position === 'district_partner' ? '🏙️' : '👤'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">Your Rank</p>
                <p className="text-white font-bold text-lg truncate" data-testid="partner-position-label">
                  {partnerPosition.position_label}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-indigo-300">Commission</p>
                <p className="text-emerald-300 font-bold text-sm">
                  {(partnerPosition.position_config?.commission_pct * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Cap usage */}
            <div className="mb-3">
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Downline Cap Usage (L1-L{partnerPosition.position_config?.levels})</span>
                <span className="font-mono text-indigo-300">
                  {partnerPosition.counted_towards_commission} / {partnerPosition.cap}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden bg-slate-800">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, partnerPosition.cap_used_pct)}%`,
                    background: partnerPosition.over_cap
                      ? 'linear-gradient(90deg, #f43f5e, #f97316)'
                      : 'linear-gradient(90deg, #6366f1, #a855f7)',
                  }}
                />
              </div>
              {partnerPosition.over_cap && (
                <p className="text-[10px] text-orange-300 mt-1">
                  ⚠️ Downlines exceed cap. Only earliest {partnerPosition.cap} count for commission.
                </p>
              )}
            </div>

            {/* Per-level breakdown */}
            <div className="grid grid-cols-4 md:grid-cols-7 gap-1.5 mb-3">
              {partnerPosition.per_level_counts?.map((lvl) => (
                <div key={lvl.level} className="bg-slate-800/60 rounded-lg py-2 text-center">
                  <p className="text-[9px] text-slate-500 uppercase">L{lvl.level}</p>
                  <p className="text-white font-bold text-sm tabular-nums">{lvl.count}</p>
                </div>
              ))}
            </div>

            {/* Structural bonus-gate progress (Feb 6 2026) */}
            {partnerPosition.structure_required && partnerPosition.structure_report && (
              <div className={`rounded-lg p-3 border ${partnerPosition.structure_met
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-rose-500/10 border-rose-500/30'}`}
                data-testid="partner-structure-progress"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-white">
                    {partnerPosition.structure_met ? '✅ Structure Complete' : '🔒 Structure Requirement'}
                  </span>
                  <span className={`text-[11px] font-bold ${partnerPosition.structure_met ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {partnerPosition.structure_report.current_count} / {partnerPosition.structure_report.required_count}
                  </span>
                </div>
                <p className="text-[10px] text-gray-300">
                  Requires <strong>{partnerPosition.structure_report.required_count}</strong>{' '}
                  <strong>{partnerPosition.structure_report.child_label}</strong> as direct L1 downlines
                  {partnerPosition.structure_report.child_type !== 'elite_user' &&
                    ' (each must individually meet their own structure)'}.
                </p>
                <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (partnerPosition.structure_report.current_count / partnerPosition.structure_report.required_count) * 100)}%`,
                      background: partnerPosition.structure_met
                        ? 'linear-gradient(90deg, #10b981, #34d399)'
                        : 'linear-gradient(90deg, #f43f5e, #fb7185)',
                    }}
                  />
                </div>
              </div>
            )}

            {!partnerPosition.elite_active && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-center">
                <p className="text-[11px] text-amber-300">
                  ⚡ Upgrade to <strong>Elite</strong> plan to activate commission earning
                </p>
              </div>
            )}

            {partnerPosition.elite_active && partnerPosition.structure_required && !partnerPosition.structure_met && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-2 text-center">
                <p className="text-[11px] text-rose-300">
                  🔒 Commission paused — build the required structure above to unlock your bonus
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {directReferrals.length === 0 && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-800 flex items-center justify-center">
              <Users className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-white font-semibold mb-2">No Referrals Yet</h3>
            <p className="text-gray-500 text-sm mb-4">
              Share your invite link to grow your network and increase your rewards!
            </p>
            <Button
              onClick={handleShare}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Now
            </Button>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
          <p className="text-amber-300 text-sm text-center">
            Grow your network to increase mining rewards!
          </p>
        </div>

      </div>
    </div>
  );
};

export default ReferralsEnhanced;

// -------------------------------------------------------------------
// Interactive collapsible Network Tree.
// Root "YOU" → tap to expand top-branches (L1) → tap L1 to lazy-load
// L2 children via /api/notifications/referrals/{root}/subtree/{parent}
// → tap L2 for L3. Depth capped at 3 to match the display cards.
// -------------------------------------------------------------------
const PARTNER_BADGE = {
  district_partner: { label: 'D', cls: 'bg-amber-500/25 text-amber-200 border-amber-500/40' },
  regional_state_partner: { label: 'R', cls: 'bg-sky-500/25 text-sky-200 border-sky-500/40' },
  state_partner: { label: 'S', cls: 'bg-fuchsia-500/25 text-fuchsia-200 border-fuchsia-500/40' },
  national_partner: { label: 'N', cls: 'bg-rose-500/25 text-rose-200 border-rose-500/40' },
};

const NetworkTreeView = ({ rootUid, branches, totalL1 }) => {
  // The root ("YOU") starts expanded, showing L1 branches already fetched
  // in the initial level-breakdown response — no extra API call needed.
  const [rootOpen, setRootOpen] = useState(true);
  // Show TRUE L1 total (from level-breakdown), not top-5 truncated count.
  const showCount = totalL1 ?? branches.length;

  return (
    <div>
      {/* Root node — clickable to collapse/expand the whole tree */}
      <div className="flex justify-center mb-2">
        <button
          type="button"
          onClick={() => setRootOpen((v) => !v)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/30 transition"
          data-testid="tree-root-node"
        >
          {rootOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <Users className="w-3.5 h-3.5" /> YOU
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 text-white/80">{showCount}</span>
        </button>
      </div>
      {rootOpen && (
        <>
          <div className="w-px h-3 bg-gray-700 mx-auto" />
          {totalL1 > branches.length && (
            <p className="text-center text-[10px] text-gray-500 mb-1" data-testid="tree-truncation-note">
              Showing top {branches.length} of {totalL1} L1 downlines
            </p>
          )}
          <div className="pl-1">
            {branches.map((branch, idx) => (
              <TreeNode
                key={branch.uid}
                rootUid={rootUid}
                node={{
                  uid: branch.uid,
                  name: branch.name,
                  mobile: branch.mobile || '',
                  is_active: branch.is_active,
                  plan: branch.plan,
                  // Server-computed count on the initial payload — used
                  // to display the "has children" indicator before we
                  // lazy-fetch. Frontend uses `l2_count` here as the
                  // count of *this L1's* direct children.
                  children_count: branch.l2_count || 0,
                  partner_position: branch.partner_position || null,
                }}
                depth={1}
                isLast={idx === branches.length - 1}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// -------------------------------------------------------------------
// Compose a pre-filled WhatsApp nudge for a downline. The URL uses the
// wa.me deep-link so it works on both mobile (opens native WhatsApp)
// AND desktop (opens WhatsApp Web). Numbers are normalised to E.164
// India format (91XXXXXXXXXX) — bare 10-digit inputs get prefixed.
// -------------------------------------------------------------------
const openWhatsAppNudge = (mobile, name) => {
  const digits = (mobile || '').replace(/\D/g, '');
  if (!digits) return;
  const e164 = digits.startsWith('91') && digits.length === 12
    ? digits
    : digits.length === 10 ? `91${digits}` : digits;
  const message =
    `Namaskar ${name || 'friend'} 👋\n\n` +
    `तुम्ही Paras Reward वर आजचं mining केलं आहे का? 🚀\n\n` +
    `Login → Start Mining करून daily PRC कमवा. रोजची streak break करू नका!\n\n` +
    `App: https://parasreward.com\n\n` +
    `— तुमचा Referrer`;
  const url = `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

const TreeNode = ({ rootUid, node, depth, isLast }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState(null);   // null = not-yet-loaded
  const [error, setError] = useState(null);
  const canExpand = (node.children_count || 0) > 0 && depth < 3;

  const toggle = async () => {
    if (!canExpand) return;
    if (open) {
      setOpen(false);
      return;
    }
    // Lazy-load on first open only.
    if (children === null) {
      setLoading(true);
      setError(null);
      try {
        const r = await axios.get(
          `${API}/api/notifications/referrals/${rootUid}/subtree/${node.uid}?limit=30`,
          { timeout: 15000 },
        );
        if (r.data?.success) {
          setChildren(r.data.children || []);
        } else {
          setError('Failed to load');
        }
      } catch (e) {
        setError(e.response?.status === 403 ? 'Not allowed' : 'Load failed');
      } finally {
        setLoading(false);
      }
    }
    setOpen(true);
  };

  // Colour palette per depth for visual hierarchy.
  const nodeCls = node.is_active
    ? 'bg-blue-500/15 border-blue-500/40 text-blue-100 hover:bg-blue-500/25'
    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700/70';
  const partnerBadge = node.partner_position ? PARTNER_BADGE[node.partner_position] : null;

  return (
    <div className="relative" data-testid={`tree-branch-${node.uid}`}>
      {/* Vertical guide line from parent, indented by depth. */}
      <div className={`absolute left-2 top-0 bottom-0 w-px bg-gray-800 ${isLast ? 'h-3' : ''}`} />
      <div className="flex items-start gap-1 py-1">
        {/* Horizontal connector stub */}
        <div className="mt-3 h-px w-3 bg-gray-800 shrink-0" />
        <button
          type="button"
          onClick={toggle}
          disabled={!canExpand && !loading}
          className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${nodeCls} ${
            !canExpand ? 'cursor-default' : 'cursor-pointer'
          }`}
          data-testid={`tree-node-toggle-${node.uid}`}
        >
          {canExpand ? (
            loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : open ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )
          ) : (
            <span className="w-3.5 h-3.5" />
          )}
          <span className={`w-1.5 h-1.5 rounded-full ${node.is_active ? 'bg-emerald-400' : 'bg-gray-500'}`} />
          <span className="max-w-[140px] truncate">{(node.name || 'User').slice(0, 22)}</span>
          {partnerBadge && (
            <span
              className={`ml-1 text-[9px] px-1.5 py-0.5 rounded border font-bold ${partnerBadge.cls}`}
              title={node.partner_position}
            >
              {partnerBadge.label}
            </span>
          )}
          {canExpand && (
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-black/30 text-white/70 tabular-nums">
              {node.children_count}
            </span>
          )}
        </button>
        {/* WhatsApp nudge — opens wa.me with a pre-filled reactivation
            message. Only rendered when the downline has a mobile on
            file. Inactive members get a slightly stronger visual to
            hint that they're the priority to reach out to. */}
        {node.mobile && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openWhatsAppNudge(node.mobile, node.name);
            }}
            className={`mt-1 p-1.5 rounded-md border transition ${
              node.is_active
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-emerald-500/25 border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/40 animate-pulse'
            }`}
            title={`Send WhatsApp nudge to ${node.name}`}
            aria-label={`WhatsApp ${node.name}`}
            data-testid={`tree-node-whatsapp-${node.uid}`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="ml-6 pl-1 border-l border-gray-800/60 mb-1">
          {error && <p className="text-[11px] text-red-400 py-1">{error}</p>}
          {!error && children !== null && children.length === 0 && (
            <p className="text-[11px] text-gray-500 italic py-1">No downlines under this node</p>
          )}
          {children?.map((child, idx) => (
            <TreeNode
              key={child.uid}
              rootUid={rootUid}
              node={child}
              depth={depth + 1}
              isLast={idx === children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};
