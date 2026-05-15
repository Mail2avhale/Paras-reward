import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Smartphone, Tv, ChevronDown, ChevronUp, ArrowRight,
  Sparkles, Calculator, Percent
} from 'lucide-react';

/**
 * Mobile Recharge Cashback Calculator — Public SEO landing page.
 * Target keywords: "mobile recharge cashback", "DTH recharge offer India",
 * "best cashback recharge app".
 */

// Cashback tiers (kept generic to match platform reality; backend handles real %)
const CASHBACK_TIERS = {
  explorer: 0.005, // 0.5% Explorer
  elite: 0.025,    // 2.5% Elite
};
const DEMO_PRC_RATE = 0.10;

const FAQS = [
  {
    q: 'How much cashback do I get on mobile recharge through Paras Reward?',
    a: "Explorer (free) members get 0.5% cashback in PRC on every successful mobile/DTH recharge. Elite subscribers earn 5x more — 2.5% cashback. Cashback is credited instantly to your PRC balance and can be converted to INR or used for future recharges.",
  },
  {
    q: 'Is the cashback in actual cash or coupon points?',
    a: "It's PRC (Paras Reward Coin), which is convertible to actual INR cash via Bank Redeem. Unlike coupon-only apps, your cashback is real money that goes to your bank account.",
  },
  {
    q: 'Which operators are supported for mobile recharge?',
    a: "All major Indian operators: Airtel, Jio, Vi (Vodafone-Idea), BSNL, MTNL. DTH: Tata Sky, Airtel DTH, Dish TV, Sun Direct, Videocon D2H, DD Free Dish.",
  },
  {
    q: 'How fast is the recharge processed?',
    a: "Mobile and DTH recharges are processed instantly through Eko India Financial Services (an RBI-approved BBPS aggregator). Most recharges complete within 5-30 seconds.",
  },
  {
    q: 'What happens if my recharge fails?',
    a: "If the recharge fails for any operator-side reason (number invalid, plan unavailable), the amount is automatically refunded to your wallet within 24 hours. Failed recharges never lose cashback opportunity — refund + retry costs nothing.",
  },
  {
    q: 'Is there a minimum recharge amount to earn cashback?',
    a: "No minimum. Even a ₹10 recharge earns proportional cashback. However, very small recharges may have a flat processing fee — see the recharge screen for details.",
  },
  {
    q: 'Can I do unlimited recharges and earn unlimited cashback?',
    a: "Yes, with reasonable daily limits to prevent abuse. Typical limit: 10 recharges per day per number, 50 recharges per day per user. Elite users get higher caps.",
  },
];

const MobileRechargeCashbackCalculator = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState(299);
  const [tier, setTier] = useState('elite');
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    document.title = 'Mobile Recharge Cashback Calculator | Paras Reward — Up to 2.5% Cashback';
    const m = document.querySelector('meta[name="description"]');
    const orig = m?.getAttribute('content');
    if (m) m.setAttribute('content',
      'Calculate cashback on Airtel, Jio, Vi, BSNL recharge & DTH. Earn up to 2.5% PRC cashback on every recharge — instantly convertible to bank cash. Free calculator.'
    );
    return () => { if (m && orig) m.setAttribute('content', orig); };
  }, []);

  const result = useMemo(() => {
    const pct = CASHBACK_TIERS[tier];
    const cashbackInr = amount * pct;
    const cashbackPrc = cashbackInr / DEMO_PRC_RATE;
    return {
      cashbackInr,
      cashbackPrc: Math.round(cashbackPrc),
      effectivePay: amount - cashbackInr,
      pct: pct * 100,
    };
  }, [amount, tier]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40" data-testid="recharge-cashback-page">
      <section className="px-5 pt-8 pb-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <Percent className="w-5 h-5 text-blue-600" />
          <span className="text-xs uppercase tracking-widest text-blue-700 font-semibold">Up to 2.5% Cashback</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight">
          Mobile Recharge Cashback Calculator
        </h1>
        <p className="mt-3 text-base text-slate-600 leading-relaxed">
          See exactly <strong>how much cashback you'll earn</strong> on any Airtel,
          Jio, Vi, BSNL, or DTH recharge through Paras Reward. Instant PRC
          credit, instant INR conversion.
        </p>
      </section>

      <section className="px-5 pb-8 max-w-3xl mx-auto">
        <div className="rounded-3xl bg-white border border-slate-200 shadow-xl shadow-blue-100/40 p-6 sm:p-8">
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-6">
            <button onClick={() => setTier('explorer')} data-testid="recharge-tier-explorer"
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${tier === 'explorer' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}>
              Explorer (0.5%)
            </button>
            <button onClick={() => setTier('elite')} data-testid="recharge-tier-elite"
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${tier === 'elite' ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg' : 'text-slate-600'}`}>
              Elite (2.5%)
            </button>
          </div>

          <label className="text-sm font-semibold text-slate-700 mb-2 block">Recharge Amount</label>
          <div className="flex items-center gap-2 border-b-2 border-slate-200 focus-within:border-blue-500 pb-2 mb-4">
            <span className="text-3xl font-bold text-slate-400">₹</span>
            <input type="number" min={1} value={amount}
              onChange={(e) => setAmount(Math.max(1, parseFloat(e.target.value) || 1))}
              data-testid="recharge-amount-input"
              className="flex-1 text-3xl font-bold text-slate-900 outline-none" />
          </div>

          <div className="flex gap-2 flex-wrap mb-6">
            {[99, 199, 299, 499, 999].map((a) => (
              <button key={a} onClick={() => setAmount(a)} data-testid={`quick-amt-${a}`}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${amount === a ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                ₹{a}
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Cashback Earned</p>
                <p className="text-3xl font-extrabold text-blue-700 mt-1" data-testid="cashback-inr">₹{result.cashbackInr.toFixed(2)}</p>
                <p className="text-[11px] text-slate-500">{result.cashbackPrc.toLocaleString('en-IN')} PRC ({result.pct.toFixed(1)}%)</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Effective Pay</p>
                <p className="text-3xl font-extrabold text-emerald-700 mt-1">₹{result.effectivePay.toFixed(2)}</p>
                <p className="text-[11px] text-slate-500">After cashback</p>
              </div>
            </div>
          </div>

          <button onClick={() => navigate('/login')} data-testid="recharge-cta-signup"
            className="w-full mt-6 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg">
            Recharge & Earn Cashback <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      <section className="px-5 py-10 max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-4">
          Earn Up to 2.5% Cashback on Every Recharge
        </h2>
        <p className="text-base text-slate-700 leading-relaxed mb-4">
          Most Indian recharge apps either don't offer cashback or give you
          coupon points that expire. <strong>Paras Reward gives you real PRC
          coins</strong> on every successful mobile recharge, DTH recharge, or
          bill payment. PRC is instantly convertible to INR cash in your
          bank account — no coupon strings attached.
        </p>
        <p className="text-base text-slate-700 leading-relaxed mb-4">
          Elite subscribers earn <strong>5x more cashback</strong> than Explorer
          users. For a household spending ₹2,000/month on mobile + DTH +
          electricity bill, that's ₹600+ extra in your pocket annually — and
          your Elite subscription pays for itself.
        </p>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-10 mb-4">Cashback Comparison Table</h2>
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300">
                <th className="text-left py-3 font-bold">Recharge ₹</th>
                <th className="text-right py-3 font-bold">Explorer (0.5%)</th>
                <th className="text-right py-3 font-bold text-blue-700">Elite (2.5%)</th>
              </tr>
            </thead>
            <tbody>
              {[199, 299, 499, 799, 1499, 2999].map((a) => (
                <tr key={a} className="border-b border-slate-200">
                  <td className="py-3 text-slate-700">₹{a}</td>
                  <td className="py-3 text-right text-slate-600">₹{(a * 0.005).toFixed(2)}</td>
                  <td className="py-3 text-right font-bold text-blue-700">₹{(a * 0.025).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-10 mb-4">Supported Operators</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { i: Smartphone, n: 'Airtel Mobile' }, { i: Smartphone, n: 'Jio Mobile' },
            { i: Smartphone, n: 'Vi Mobile' }, { i: Smartphone, n: 'BSNL Mobile' },
            { i: Tv, n: 'Tata Sky' }, { i: Tv, n: 'Airtel DTH' },
            { i: Tv, n: 'Dish TV' }, { i: Tv, n: 'Sun Direct' }, { i: Tv, n: 'Videocon D2H' },
          ].map((o) => (
            <div key={o.n} className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-200">
              <o.i className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-slate-700">{o.n}</span>
            </div>
          ))}
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-10 mb-4">FAQs</h2>
        <div className="space-y-2" itemScope itemType="https://schema.org/FAQPage">
          {FAQS.map((f, i) => (
            <div key={i} className="border border-slate-200 rounded-2xl bg-white overflow-hidden" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
              <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)} className="w-full flex items-center justify-between text-left px-4 py-4" data-testid={`recharge-faq-${i}`}>
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

        <div className="mt-12 rounded-3xl bg-gradient-to-br from-slate-900 to-blue-900 text-white p-8 text-center">
          <Sparkles className="w-8 h-8 mx-auto text-blue-300 mb-3" />
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">Recharge smarter. Earn every time.</h2>
          <p className="text-slate-300 mb-6 text-sm">Join 6,000+ Indians saving on every recharge.</p>
          <button onClick={() => navigate('/login')} className="px-8 py-3.5 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 text-white font-bold inline-flex items-center gap-2">
            Create Free Account <ArrowRight className="w-5 h-5" />
          </button>
          <p className="text-xs text-slate-400 mt-4">
            <Link to="/referral-calculator" className="underline hover:text-white">Earnings Calculator</Link> ·{' '}
            <Link to="/prc-to-inr-converter" className="underline hover:text-white">PRC to INR</Link>
          </p>
        </div>
      </section>
    </div>
  );
};

export default MobileRechargeCashbackCalculator;
