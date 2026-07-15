import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Calculator, TrendingUp, Users, Wallet, Sparkles, Crown,
  ArrowRight, Zap, Award, ChevronDown, ChevronUp, Share2, Star
} from 'lucide-react';

/**
 * Referral Earnings Calculator — Public SEO landing page.
 * Goals:
 *  1. Rank on Google for "referral earning calculator India", "PRC earnings
 *     calculator", "mining rate calculator paras reward".
 *  2. Provide AdSense Auto Ads with rich text content to place ads inside.
 *  3. Drive organic visitors to sign up via in-page CTAs.
 */

// PRC formula constants (kept identical to backend mining.py for accuracy)
const BASE_PRC_PER_DAY = 1000;
const BASE_THRESHOLD = 250;
const NETWORK_CAP_BASE = 800;
const CAP_PER_DIRECT = 16;
const CAP_PER_L1 = 5;
const NETWORK_CAP_MAX = 6000;
const MIN_PRC_PER_USER = 2.5;

// Static fallback PRC→INR rate (frontend approx; actual rate is dynamic).
// We use a transparent demo value here so users see what's *possible*.
const DEMO_PRC_RATE = 0.10;

function calcPrcPerUser(network) {
  if (network <= 0) return 0;
  if (network === 1) return (5 * (21 - 1)) / 14;
  const log = Math.log2(Math.max(2, network));
  return Math.max(MIN_PRC_PER_USER, (5 * (21 - log)) / 14);
}

function calcNetworkCap(direct, l1) {
  return Math.min(NETWORK_CAP_MAX, NETWORK_CAP_BASE + CAP_PER_DIRECT * direct + CAP_PER_L1 * l1);
}

function calcDailyPrc(direct, l1) {
  // Effective network for a referrer ≈ directs + L1 indirects (simplification
  // for landing page — actual mining uses subscription_position chain).
  const networkSize = direct + l1;
  const cap = calcNetworkCap(direct, l1);
  const effective = Math.min(networkSize, cap);
  const base = effective < BASE_THRESHOLD ? BASE_PRC_PER_DAY : 0;
  const perUser = calcPrcPerUser(effective);
  return Math.round(base + effective * perUser);
}

const FAQS = [
  {
    q: 'How does the Paras Reward referral earnings calculator work?',
    a: "It estimates your daily PRC mining rate based on your direct referrals and their referrals (L1 indirect). The formula combines a base rate of 1,000 PRC/day for small networks with a per-user bonus that scales with your team size. PRC converts to INR at the fixed rate of 10 PRC = ₹1.",
  },
  {
    q: 'What is a "direct referral" vs "L1 indirect" on Paras Reward?',
    a: "A direct referral is someone who signs up using your referral code. An L1 indirect is someone who signs up using YOUR direct referral's code — they're your 'second level' Community member. Both contribute to your mining rate but with different weights.",
  },
  {
    q: 'How much can I realistically earn from referrals in a month?',
    a: "Real earnings depend on how many of your referrals become Elite subscribers and stay active. Conservative estimates: 10 active referrals ≈ ₹1,500-3,000/month, 50 active referrals ≈ ₹8,000-15,000/month. The calculator above shows projections for your specific case.",
  },
  {
    q: 'Is the calculator showing GUARANTEED earnings?',
    a: "No. The calculator is an estimation tool only. Actual earnings vary based on (1) whether your referrals stay active, (2) your subscription tier, and (3) Paras Reward's network economy at any given time. PRC→INR is fixed at 10 PRC = ₹1. It's a planning aid, not a contract.",
  },
  {
    q: 'Do I need to become an Elite subscriber to earn referral rewards?',
    a: "Explorer (free) users can still refer and build a network, but Elite subscribers unlock higher mining caps, faster PRC accumulation, and access to peer-to-peer features like Sale Subscription. Elite users typically earn 3-5x more from the same network size.",
  },
  {
    q: 'How quickly does my referral count update in the calculator?',
    a: "This public calculator uses example values you enter manually. Inside the Paras Reward app, your real-time mining dashboard updates every second using your actual network data — try it after signing up.",
  },
  {
    q: 'Can I withdraw my PRC earnings to my bank?',
    a: "Yes. Paras Reward supports Bank Redeem (direct UPI/IMPS transfer to your bank account) once you complete KYC verification. Minimum redeem and processing fees apply as per current policy.",
  },
];

const ReferralCalculator = () => {
  const navigate = useNavigate();
  const [directs, setDirects] = useState(10);
  const [l1Indirect, setL1Indirect] = useState(20);
  const [isElite, setIsElite] = useState(true);
  const [openFaq, setOpenFaq] = useState(0);

  // SEO: set document title + meta description on mount
  useEffect(() => {
    document.title = 'Referral Earnings Calculator | Paras Reward — Estimate Your PRC & ₹ Daily';
    const metaDesc = document.querySelector('meta[name="description"]');
    const origDesc = metaDesc?.getAttribute('content');
    if (metaDesc) {
      metaDesc.setAttribute('content',
        'Calculate how much you can earn from referrals on Paras Reward. Interactive PRC mining calculator showing daily, monthly & yearly earnings in ₹INR. Free tool — no signup required.'
      );
    }
    return () => {
      if (metaDesc && origDesc) metaDesc.setAttribute('content', origDesc);
    };
  }, []);

  const result = useMemo(() => {
    const dailyPrc = calcDailyPrc(directs, l1Indirect);
    const multiplier = isElite ? 1.0 : 0.5;  // Explorer = 50% rate (approximation)
    const adjusted = dailyPrc * multiplier;
    return {
      prcDay: Math.round(adjusted),
      prcMonth: Math.round(adjusted * 30),
      prcYear: Math.round(adjusted * 365),
      inrDay: adjusted * DEMO_PRC_RATE,
      inrMonth: adjusted * DEMO_PRC_RATE * 30,
      inrYear: adjusted * DEMO_PRC_RATE * 365,
    };
  }, [directs, l1Indirect, isElite]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/40" data-testid="referral-calculator-page">
      {/* SEO H1 + intro */}
      <section className="px-5 pt-8 pb-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="w-5 h-5 text-amber-600" />
          <span className="text-xs uppercase tracking-widest text-amber-700 font-semibold">Free Tool · No Signup</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight">
          Referral Earnings Calculator
        </h1>
        <p className="mt-3 text-base text-slate-600 leading-relaxed">
          Estimate your <strong>daily PRC mining rate</strong> and{' '}
          <strong>₹INR earnings</strong> from referrals on Paras Reward.
          Adjust direct + indirect referral counts to see how much you could
          potentially earn each month.
        </p>
      </section>

      {/* Calculator UI */}
      <section className="px-5 pb-8 max-w-3xl mx-auto">
        <div className="rounded-3xl bg-white border border-slate-200 shadow-xl shadow-amber-100/50 p-6 sm:p-8">
          {/* Tier toggle */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-6" role="tablist">
            <button
              onClick={() => setIsElite(false)}
              data-testid="calc-tier-explorer"
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                !isElite ? 'bg-white shadow text-slate-900' : 'text-slate-600'
              }`}
            >
              Explorer (Free)
            </button>
            <button
              onClick={() => setIsElite(true)}
              data-testid="calc-tier-elite"
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                isElite ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg' : 'text-slate-600'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              Elite
            </button>
          </div>

          {/* Direct referrals slider */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-600" />
                Direct Referrals (people you invite)
              </label>
              <span className="text-lg font-bold text-amber-600" data-testid="directs-value">{directs}</span>
            </div>
            <input
              type="range"
              min={0}
              max={200}
              value={directs}
              onChange={(e) => setDirects(parseInt(e.target.value))}
              data-testid="directs-slider"
              className="w-full accent-amber-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>0</span><span>50</span><span>100</span><span>150</span><span>200</span>
            </div>
          </div>

          {/* L1 indirect slider */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-600" />
                L1 Indirect (your referrals' referrals)
              </label>
              <span className="text-lg font-bold text-blue-600" data-testid="l1-value">{l1Indirect}</span>
            </div>
            <input
              type="range"
              min={0}
              max={500}
              value={l1Indirect}
              onChange={(e) => setL1Indirect(parseInt(e.target.value))}
              data-testid="l1-slider"
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>0</span><span>125</span><span>250</span><span>375</span><span>500</span>
            </div>
          </div>

          {/* Results grid */}
          <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 border border-amber-200 p-5">
            <p className="text-xs uppercase tracking-wider text-amber-700 font-bold mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Estimated Earnings
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div data-testid="earn-daily">
                <p className="text-[10px] text-slate-500 uppercase">Daily</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">₹{result.inrDay.toFixed(0)}</p>
                <p className="text-[10px] text-slate-500">{result.prcDay.toLocaleString('en-IN')} PRC</p>
              </div>
              <div data-testid="earn-monthly">
                <p className="text-[10px] text-slate-500 uppercase">Monthly</p>
                <p className="text-xl font-bold text-emerald-700 mt-0.5">₹{result.inrMonth.toFixed(0)}</p>
                <p className="text-[10px] text-slate-500">{result.prcMonth.toLocaleString('en-IN')} PRC</p>
              </div>
              <div data-testid="earn-yearly">
                <p className="text-[10px] text-slate-500 uppercase">Yearly</p>
                <p className="text-xl font-bold text-rose-700 mt-0.5">₹{result.inrYear.toFixed(0)}</p>
                <p className="text-[10px] text-slate-500">{result.prcYear.toLocaleString('en-IN')} PRC</p>
              </div>
            </div>
          </div>

          {/* Primary CTA */}
          <button
            onClick={() => navigate('/login')}
            data-testid="calc-cta-signup"
            className="w-full mt-6 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-600 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-bold text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-200"
          >
            Start Earning — Sign Up Free
            <ArrowRight className="w-5 h-5" />
          </button>
          <p className="text-[11px] text-slate-500 text-center mt-2">
            No credit card · KYC required for bank redeem
          </p>
        </div>
      </section>

      {/* SEO content section */}
      <section className="px-5 py-10 max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-4">
          How does the Paras Reward Mining Formula work?
        </h2>
        <p className="text-base text-slate-700 leading-relaxed mb-4">
          Paras Reward uses a transparent <strong>single-leg network mining
          algorithm</strong>. Your daily PRC mining rate is calculated using
          two components: a <strong>base mining rate of 1,000 PRC per
          day</strong> when your network is below 250 users, and a network
          bonus that scales with your team size. PRC is a promotional reward
          point — not money — and rates are subject to change. This means
          even brand-new members earn some PRC every day while they grow
          their network.
        </p>
        <p className="text-base text-slate-700 leading-relaxed mb-4">
          The <strong>per-user bonus</strong> follows a decreasing curve
          (anti-inflation): the formula is{' '}
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">
            5 × (21 - log₂(N)) / 14
          </code>{' '}
          PRC per network member, with a minimum floor of 2.5 PRC. So a
          2-user network gives 7.14 PRC each, while a 16,000-user network
          gives 2.5 PRC each — keeping rewards sustainable as the platform
          grows.
        </p>
        <p className="text-base text-slate-700 leading-relaxed">
          Your maximum network cap is determined by your direct referrals (D)
          and your L1 indirect referrals (L1) using{' '}
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">
            min(6000, 800 + 16×D + 5×L1)
          </code>
          . So inviting more friends directly raises your earning ceiling.
        </p>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-10 mb-4">
          Example Earnings Tiers
        </h2>
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300">
                <th className="text-left py-3 font-bold text-slate-900">Network Size</th>
                <th className="text-right py-3 font-bold text-slate-900">PRC/Day</th>
                <th className="text-right py-3 font-bold text-slate-900">₹/Day (est)</th>
                <th className="text-right py-3 font-bold text-slate-900">₹/Month</th>
              </tr>
            </thead>
            <tbody>
              {[5, 25, 100, 250, 500, 1000, 2000].map((n) => {
                const daily = calcDailyPrc(n, 0);
                return (
                  <tr key={n} className="border-b border-slate-200">
                    <td className="py-3 text-slate-700">{n} users</td>
                    <td className="py-3 text-right font-semibold text-slate-900">{daily.toLocaleString('en-IN')}</td>
                    <td className="py-3 text-right text-slate-700">₹{(daily * DEMO_PRC_RATE).toFixed(0)}</td>
                    <td className="py-3 text-right font-bold text-emerald-700">₹{(daily * DEMO_PRC_RATE * 30).toFixed(0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-3 italic">
          Estimates based on demo PRC rate of ₹0.10. Actual rate is dynamic
          and updates based on platform economy.
        </p>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-10 mb-4">
          Tips to Maximize Your Referral Earnings
        </h2>
        <div className="space-y-4">
          {[
            { icon: Share2, title: 'Share strategically', body: 'Send your invite link to friends who genuinely want a rewards app. Quality referrals stay active longer and boost your network bonus.' },
            { icon: Crown, title: 'Upgrade to Elite', body: 'Elite subscribers earn at full 100% rate and get peer-to-peer Sale Subscription access. The subscription pays for itself with 10+ active referrals.' },
            { icon: TrendingUp, title: 'Build deep, not wide', body: 'Encourage your direct referrals to invite their friends. Each L1 indirect adds +5 to your network cap, raising your earning ceiling.' },
            { icon: Wallet, title: 'Complete KYC early', body: 'Bank Redeem requires verified KYC. Get it done in the first week so you can withdraw your earnings the moment you hit the threshold.' },
            { icon: Zap, title: 'Stay active daily', body: 'Login and mine daily. Inactive accounts get auto-archived after 60 days as part of platform housekeeping.' },
            { icon: Award, title: 'Climb the leaderboard', body: 'Top redeemers get featured on the Community Forum leaderboard, attracting more network growth and visibility.' },
          ].map((t, i) => (
            <div key={i} className="flex gap-3 p-4 rounded-2xl bg-white border border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <t.icon className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">{t.title}</p>
                <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">{t.body}</p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-10 mb-4">
          Frequently Asked Questions
        </h2>
        <div className="space-y-2" itemScope itemType="https://schema.org/FAQPage">
          {FAQS.map((f, i) => (
            <div
              key={i}
              className="border border-slate-200 rounded-2xl overflow-hidden bg-white"
              itemScope
              itemProp="mainEntity"
              itemType="https://schema.org/Question"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                className="w-full flex items-center justify-between text-left px-4 py-4"
                data-testid={`faq-toggle-${i}`}
              >
                <h3 className="text-sm font-bold text-slate-900 pr-4" itemProp="name">{f.q}</h3>
                {openFaq === i ? (
                  <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                )}
              </button>
              {openFaq === i && (
                <div
                  className="px-4 pb-4 text-sm text-slate-700 leading-relaxed"
                  itemScope
                  itemProp="acceptedAnswer"
                  itemType="https://schema.org/Answer"
                >
                  <p itemProp="text">{f.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* JSON-LD structured data for FAQ */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: FAQS.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
            }),
          }}
        />

        {/* Final CTA */}
        <div className="mt-12 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8 text-center">
          <Star className="w-8 h-8 mx-auto text-amber-400 mb-3" />
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">
            Ready to start earning?
          </h2>
          <p className="text-slate-300 mb-6 text-sm leading-relaxed">
            Join 6,000+ Indians already mining PRC daily.
            Sign up free in 30 seconds — no credit card required.
          </p>
          <button
            onClick={() => navigate('/login')}
            data-testid="calc-cta-signup-bottom"
            className="px-8 py-3.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-bold inline-flex items-center gap-2 hover:scale-105 transition-transform"
          >
            Create Free Account
            <ArrowRight className="w-5 h-5" />
          </button>
          <p className="text-xs text-slate-400 mt-4">
            <Link to="/terms" className="underline hover:text-white">Terms</Link> ·{' '}
            <Link to="/privacy" className="underline hover:text-white">Privacy</Link> ·{' '}
            <Link to="/about" className="underline hover:text-white">About</Link>
          </p>
        </div>
      </section>
    </div>
  );
};

export default ReferralCalculator;
