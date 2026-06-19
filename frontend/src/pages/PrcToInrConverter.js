import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Coins, ArrowLeftRight, TrendingUp, ChevronDown, ChevronUp,
  ArrowRight, Sparkles, Info
} from 'lucide-react';

/**
 * PRC to INR Converter — Public SEO landing page.
 * Target keywords: "prc to inr", "paras reward coin to rupee", "prc value today".
 */

// PRC to INR rate — FIXED at ₹0.10 per PRC (10 PRC = ₹1).
const DEMO_PRC_RATE = 0.10;

const FAQS = [
  {
    q: 'What is the current PRC to INR rate?',
    a: "PRC (Paras Reward Coin) has a fixed INR conversion rate: 10 PRC = ₹1 (i.e., ₹0.10 per PRC). This rate is constant across the platform — no daily changes, no dynamic adjustments. What you see is what you get when you redeem.",
  },
  {
    q: 'Why does the PRC rate change?',
    a: "Paras Reward uses a fixed PRC-to-INR rate of 10 PRC = ₹1. No daily adjustments, no surprise dilution, no inflation — the rate stays constant so users always know exactly what their PRC is worth.",
  },
  {
    q: 'How do I convert my PRC into actual cash (INR)?',
    a: "Inside the Paras Reward app: (1) Verify your KYC, (2) Open Bank Redeem, (3) Enter the PRC amount, (4) Confirm with your security PIN. The INR amount is credited directly to your registered bank account via UPI/IMPS, typically within minutes.",
  },
  {
    q: 'Is there a minimum amount of PRC required to redeem to INR?',
    a: "Yes. Minimum redeem and processing fees are applied as per the current platform policy. Check the Bank Redeem screen inside the app for the latest minimum (typically ₹100-500 worth of PRC) and applicable fees.",
  },
  {
    q: 'Can I get a better rate by holding PRC longer?',
    a: "PRC rate is platform-wide and does not depend on individual holding period. However, holding PRC means you participate in the network economy — if you redeem during high-demand periods, the effective value may be better. Decide based on your personal cash needs.",
  },
  {
    q: 'Are there taxes on PRC redemption in India?',
    a: "PRC earnings redeemed to INR are treated as 'income from other sources' for Indian tax purposes. Users should consult a CA for personal tax advice. Paras Reward provides annual statements for tax filing on request.",
  },
];

const QUICK_AMOUNTS = [100, 500, 1000, 5000, 10000, 50000];

const PrcToInrConverter = () => {
  const navigate = useNavigate();
  const [prcAmount, setPrcAmount] = useState(1000);
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    document.title = 'PRC to INR Converter | Paras Reward — Live Coin to Rupee Value';
    const m = document.querySelector('meta[name="description"]');
    const orig = m?.getAttribute('content');
    if (m) m.setAttribute('content',
      'Convert Paras Reward Coin (PRC) to Indian Rupees (₹INR) instantly. Free PRC value calculator with daily conversion rate, redemption guide, and FAQ. Updated 2026.'
    );
    return () => { if (m && orig) m.setAttribute('content', orig); };
  }, []);

  const result = useMemo(() => ({
    inr: prcAmount * DEMO_PRC_RATE,
    reverse: (1 / DEMO_PRC_RATE) * 100,
  }), [prcAmount]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/40" data-testid="prc-to-inr-page">
      <section className="px-5 pt-8 pb-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <Coins className="w-5 h-5 text-emerald-600" />
          <span className="text-xs uppercase tracking-widest text-emerald-700 font-semibold">Live Rate · Free</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight">
          PRC to INR Converter
        </h1>
        <p className="mt-3 text-base text-slate-600 leading-relaxed">
          Convert <strong>Paras Reward Coin (PRC)</strong> to <strong>Indian Rupees (₹INR)</strong> instantly.
          See exactly how much your mining earnings are worth in real cash.
        </p>
      </section>

      <section className="px-5 pb-8 max-w-3xl mx-auto">
        <div className="rounded-3xl bg-white border border-slate-200 shadow-xl shadow-emerald-100/40 p-6 sm:p-8">
          <label className="text-sm font-semibold text-slate-700 mb-2 block">PRC Amount</label>
          <input
            type="number"
            min={0}
            value={prcAmount}
            onChange={(e) => setPrcAmount(Math.max(0, parseFloat(e.target.value) || 0))}
            data-testid="prc-input"
            className="w-full text-3xl font-bold text-slate-900 border-b-2 border-slate-200 focus:border-emerald-500 outline-none py-2 mb-4"
          />

          <div className="flex gap-2 flex-wrap mb-6">
            {QUICK_AMOUNTS.map((amt) => (
              <button
                key={amt}
                onClick={() => setPrcAmount(amt)}
                data-testid={`quick-${amt}`}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  prcAmount === amt
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400'
                }`}
              >
                {amt.toLocaleString('en-IN')}
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 p-5">
            <div className="flex items-center justify-center gap-3 mb-3">
              <ArrowLeftRight className="w-4 h-4 text-emerald-600" />
              <span className="text-xs uppercase tracking-wider text-emerald-700 font-bold">Equivalent Value</span>
            </div>
            <p className="text-5xl font-extrabold text-center text-emerald-700" data-testid="inr-result">
              ₹{result.inr.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </p>
            <p className="text-center text-sm text-slate-600 mt-2">
              {prcAmount.toLocaleString('en-IN')} PRC × ₹{DEMO_PRC_RATE} (fixed rate)
            </p>
          </div>

          <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Demo rate shown.</strong> The actual PRC→INR rate is dynamic and may differ inside the app.
              Always check the live rate on the Bank Redeem screen before transacting.
            </p>
          </div>

          <button
            onClick={() => navigate('/login')}
            data-testid="prc-cta-signup"
            className="w-full mt-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg"
          >
            See Live Rate & Redeem
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      <section className="px-5 py-10 max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-4">
          What is PRC (Paras Reward Coin)?
        </h2>
        <p className="text-base text-slate-700 leading-relaxed mb-4">
          <strong>PRC</strong> is the native reward currency of the Paras Reward
          platform. It's earned through daily mining (single-leg network
          algorithm), referrals, mobile recharge cashback, bill payment
          cashback, and community engagement. Every PRC has a transparent
          INR conversion rate, making your virtual rewards instantly cashable.
        </p>
        <p className="text-base text-slate-700 leading-relaxed mb-4">
          Unlike cryptocurrencies, PRC is a <strong>centralized reward token</strong>
          backed by the Paras Reward platform's revenue from subscription
          plans, peer-to-peer Sale Subscriptions, and service partnerships.
          The rate is stabilized via a sustainability-anchored model that
          prevents inflation as the user base grows.
        </p>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-10 mb-4">
          PRC Conversion Table (Demo Rate ₹0.10)
        </h2>
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300">
                <th className="text-left py-3 font-bold text-slate-900">PRC Amount</th>
                <th className="text-right py-3 font-bold text-slate-900">INR Value (₹)</th>
                <th className="text-right py-3 font-bold text-slate-900">Use Case</th>
              </tr>
            </thead>
            <tbody>
              {[
                { p: 100, u: 'Small recharge' },
                { p: 1000, u: 'Mobile + DTH' },
                { p: 5000, u: 'Weekly groceries' },
                { p: 10000, u: 'Electricity bill' },
                { p: 50000, u: 'Monthly utilities' },
                { p: 100000, u: 'Phone purchase' },
              ].map(({ p, u }) => (
                <tr key={p} className="border-b border-slate-200">
                  <td className="py-3 text-slate-700">{p.toLocaleString('en-IN')} PRC</td>
                  <td className="py-3 text-right font-bold text-emerald-700">₹{(p * DEMO_PRC_RATE).toLocaleString('en-IN')}</td>
                  <td className="py-3 text-right text-slate-600 text-xs">{u}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-10 mb-4">
          How to Redeem PRC for Cash — 4 Steps
        </h2>
        <div className="space-y-3">
          {[
            { n: 1, t: 'Complete KYC verification', d: 'PAN-only KYC via Aadhaar OTP — takes 2 minutes. Required for all bank withdrawals per RBI rules.' },
            { n: 2, t: 'Open the Bank Redeem screen', d: 'Inside the Paras Reward app, tap "Bank Redeem" from the dashboard.' },
            { n: 3, t: 'Enter your PRC amount', d: 'See live INR equivalent + applicable fees. Confirm with your 6-digit security PIN.' },
            { n: 4, t: 'Receive cash within minutes', d: 'INR is credited directly via UPI or IMPS to your registered bank account. Get notification + receipt.' },
          ].map((s) => (
            <div key={s.n} className="flex gap-3 p-4 rounded-2xl bg-white border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center flex-shrink-0">
                {s.n}
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">{s.t}</p>
                <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">{s.d}</p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-10 mb-4">
          Frequently Asked Questions
        </h2>
        <div className="space-y-2" itemScope itemType="https://schema.org/FAQPage">
          {FAQS.map((f, i) => (
            <div key={i} className="border border-slate-200 rounded-2xl bg-white overflow-hidden" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
              <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)} className="w-full flex items-center justify-between text-left px-4 py-4" data-testid={`prc-faq-${i}`}>
                <h3 className="text-sm font-bold text-slate-900 pr-4" itemProp="name">{f.q}</h3>
                {openFaq === i ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {openFaq === i && (
                <div className="px-4 pb-4 text-sm text-slate-700 leading-relaxed" itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                  <p itemProp="text">{f.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org', '@type': 'FAQPage',
          mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
        }) }} />

        <div className="mt-12 rounded-3xl bg-gradient-to-br from-slate-900 to-emerald-900 text-white p-8 text-center">
          <Sparkles className="w-8 h-8 mx-auto text-emerald-400 mb-3" />
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">Start earning PRC today</h2>
          <p className="text-slate-300 mb-6 text-sm">Mine PRC daily, convert to INR anytime.</p>
          <button onClick={() => navigate('/login')} className="px-8 py-3.5 rounded-full bg-gradient-to-r from-emerald-400 to-green-500 text-slate-900 font-bold inline-flex items-center gap-2">
            Create Free Account <ArrowRight className="w-5 h-5" />
          </button>
          <p className="text-xs text-slate-400 mt-4">
            <Link to="/referral-calculator" className="underline hover:text-white">Earnings Calculator</Link> ·{' '}
            <Link to="/terms" className="underline hover:text-white">Terms</Link>
          </p>
        </div>
      </section>
    </div>
  );
};

export default PrcToInrConverter;
