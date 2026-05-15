import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  IndianRupee, Star, Users, Wallet, Sparkles,
  ChevronDown, ChevronUp, ArrowRight, CheckCircle2, TrendingUp
} from 'lucide-react';

/**
 * How to Earn Money Online India — Public SEO long-form article.
 * Target keywords: "how to earn money online india", "earn money from home india",
 * "online income ideas india", "side income app india".
 */

const FAQS = [
  {
    q: 'Is earning money online from home in India real and safe?',
    a: "Yes, there are legitimate ways to earn extra income online in India — referral programs, cashback apps, freelancing, and content monetization. The key is choosing platforms that are transparent about how you earn and how you withdraw. Avoid anything that asks for upfront investment with promises of guaranteed daily returns.",
  },
  {
    q: 'How much can a beginner realistically earn online in India per month?',
    a: "Beginners typically earn ₹500-₹3,000/month in the first 2 months while learning. Within 6 months, consistent users on referral + cashback platforms like Paras Reward can earn ₹5,000-₹15,000/month. Top users with strong networks earn ₹30,000+/month, but this requires consistent daily activity.",
  },
  {
    q: 'Do I need to invest money to start earning online in India?',
    a: "No. Most legitimate platforms (including Paras Reward) are free to join. Optional subscriptions (like Elite at ₹999+GST) unlock higher earnings but are not required to start. If anyone asks for ₹5,000+ deposit promising guaranteed returns, it's likely a scam.",
  },
  {
    q: 'What documents do I need for online earning in India?',
    a: "Basic KYC documents are required for cash withdrawal: PAN card, Aadhaar (for OTP verification), and a bank account in your name. Paras Reward uses RBI-approved KYC partners — your data is encrypted and never shared.",
  },
  {
    q: 'Will I have to pay tax on online earnings in India?',
    a: "Online earnings above ₹50,000/year are typically taxable as 'income from other sources'. Maintain records of your withdrawals and consult a CA during tax season. Paras Reward provides annual income statements on request.",
  },
  {
    q: 'How fast can I withdraw my earnings to my bank account?',
    a: "On Paras Reward, Bank Redeem credits are usually instant (via UPI/IMPS), processing within 30 seconds to a few minutes after submission. KYC must be verified once before your first withdrawal.",
  },
];

const METHODS = [
  {
    icon: Users, color: 'amber',
    title: 'Referral Marketing',
    description: 'Invite friends to apps and earn commission on their activity. Paras Reward pays daily PRC mining bonuses for every active referral in your network — no cap on earnings.',
    range: '₹3,000 – ₹50,000/month',
  },
  {
    icon: Wallet, color: 'blue',
    title: 'Cashback on Recharges & Bills',
    description: 'Earn 0.5-2.5% on every mobile recharge, DTH, electricity bill, gas bill. The cashback is real cash, not coupons.',
    range: '₹500 – ₹3,000/month',
  },
  {
    icon: TrendingUp, color: 'emerald',
    title: 'Daily Mining Rewards',
    description: 'Background mining algorithm pays PRC just for keeping your account active. No clicks, no surveys, no spam. Just login daily and earn.',
    range: '₹1,000 – ₹10,000/month',
  },
  {
    icon: Star, color: 'rose',
    title: 'Peer-to-Peer Subscription Sale',
    description: 'Elite users can sell subscriptions to others using their PRC balance. Earn commission + reputation in community.',
    range: '₹500 – ₹5,000/month',
  },
];

const HowToEarnMoneyOnlineIndia = () => {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    document.title = 'How to Earn Money Online in India 2026 | Paras Reward — Real Methods';
    const m = document.querySelector('meta[name="description"]');
    const orig = m?.getAttribute('content');
    if (m) m.setAttribute('content',
      'Looking for genuine ways to earn money online in India? Discover 4 proven methods — referrals, cashback, mining rewards, P2P sales. No investment needed. Updated 2026.'
    );
    return () => { if (m && orig) m.setAttribute('content', orig); };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50/40" data-testid="earn-online-india-page">
      <section className="px-5 pt-8 pb-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <IndianRupee className="w-5 h-5 text-rose-600" />
          <span className="text-xs uppercase tracking-widest text-rose-700 font-semibold">Guide · 2026 Edition</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight">
          How to Earn Money Online in India (2026)
        </h1>
        <p className="mt-3 text-base text-slate-600 leading-relaxed">
          A practical, no-BS guide to earning <strong>extra income from home</strong> in
          India using proven, legitimate methods. <strong>No upfront investment</strong>,
          no MLM, no fake promises — just real ways thousands of Indians are
          earning ₹500 to ₹50,000 per month online.
        </p>
      </section>

      <section className="px-5 pb-8 max-w-3xl mx-auto">
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 mb-6">
          <p className="text-sm text-amber-900 leading-relaxed">
            ⚠️ <strong>Avoid scams</strong>: If a platform asks for ₹5,000+ deposit
            promising "guaranteed ₹50,000 in 30 days", it's almost certainly
            a Ponzi scheme. Real income takes time and effort.
          </p>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-5">
          4 Real Ways to Earn Online in India
        </h2>

        <div className="space-y-4">
          {METHODS.map((m, i) => (
            <div key={i} className="rounded-2xl bg-white border border-slate-200 p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-${m.color}-100`}>
                  <m.icon className={`w-5 h-5 text-${m.color}-600`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900">{i + 1}. {m.title}</h3>
                  <p className={`text-xs font-semibold text-${m.color}-700 mt-0.5`}>{m.range}</p>
                </div>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{m.description}</p>
            </div>
          ))}
        </div>

        <button onClick={() => navigate('/login')} data-testid="earn-cta-signup-top"
          className="w-full mt-6 py-4 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg">
          Start Earning — Free Signup <ArrowRight className="w-5 h-5" />
        </button>
      </section>

      <section className="px-5 py-10 max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-4">
          Why Paras Reward Stands Out
        </h2>
        <p className="text-base text-slate-700 leading-relaxed mb-4">
          Most "earn money online" platforms either pay in points that
          expire, lock you into a subscription before you see a single rupee,
          or operate as MLM-style schemes where only top sponsors earn.
          <strong> Paras Reward is built differently.</strong>
        </p>
        <p className="text-base text-slate-700 leading-relaxed mb-4">
          Every PRC you earn — whether from daily mining, recharge cashback,
          or referral bonuses — is <strong>instantly convertible to INR</strong> in your
          bank account. No coupon redemption hassle. No 30-day holding
          periods. KYC verification is one-time (PAN-only, takes 2 minutes)
          and then you can withdraw anytime.
        </p>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-10 mb-4">
          Step-by-Step: Start Earning in 5 Minutes
        </h2>
        <div className="space-y-3">
          {[
            'Download the Paras Reward app (Android) or visit parasreward.com',
            'Sign up with your mobile number — verify via OTP',
            'Complete PAN-only KYC (2-minute Aadhaar OTP flow)',
            'Start daily mining — earnings accumulate every second',
            'Invite friends via your referral code to multiply earnings',
            'Withdraw INR to your bank account any time you want',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-200">
              <CheckCircle2 className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">{step}</p>
            </div>
          ))}
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-10 mb-4">
          Earning Potential by Time Invested
        </h2>
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300">
                <th className="text-left py-3 font-bold">Effort Level</th>
                <th className="text-left py-3 font-bold">Activity</th>
                <th className="text-right py-3 font-bold">Est. Monthly</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="py-3 text-slate-700">5 min/day</td>
                <td className="py-3 text-slate-600 text-xs">Daily login + mining</td>
                <td className="py-3 text-right font-bold text-emerald-700">₹500 – ₹1,500</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-3 text-slate-700">15 min/day</td>
                <td className="py-3 text-slate-600 text-xs">+ Recharge via app + Refer 1/week</td>
                <td className="py-3 text-right font-bold text-emerald-700">₹2,000 – ₹5,000</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-3 text-slate-700">30 min/day</td>
                <td className="py-3 text-slate-600 text-xs">+ Active referrals + Elite</td>
                <td className="py-3 text-right font-bold text-emerald-700">₹8,000 – ₹15,000</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-3 text-slate-700">1 hr/day</td>
                <td className="py-3 text-slate-600 text-xs">Power user + community engagement</td>
                <td className="py-3 text-right font-bold text-emerald-700">₹20,000 – ₹50,000+</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-3 italic">
          Estimates based on average user data. Actual earnings depend on
          network growth, activity consistency, and platform PRC rate.
        </p>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-10 mb-4">Frequently Asked Questions</h2>
        <div className="space-y-2" itemScope itemType="https://schema.org/FAQPage">
          {FAQS.map((f, i) => (
            <div key={i} className="border border-slate-200 rounded-2xl bg-white overflow-hidden" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
              <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)} className="w-full flex items-center justify-between text-left px-4 py-4" data-testid={`earn-faq-${i}`}>
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

        <div className="mt-12 rounded-3xl bg-gradient-to-br from-slate-900 to-rose-900 text-white p-8 text-center">
          <Sparkles className="w-8 h-8 mx-auto text-rose-300 mb-3" />
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">Start your online income journey today</h2>
          <p className="text-slate-300 mb-6 text-sm">6,000+ Indians already earning. No investment. No risk.</p>
          <button onClick={() => navigate('/login')} className="px-8 py-3.5 rounded-full bg-gradient-to-r from-rose-400 to-pink-500 text-white font-bold inline-flex items-center gap-2">
            Sign Up Free <ArrowRight className="w-5 h-5" />
          </button>
          <p className="text-xs text-slate-400 mt-4">
            <Link to="/referral-calculator" className="underline hover:text-white">Earnings Calculator</Link> ·{' '}
            <Link to="/recharge-cashback-calculator" className="underline hover:text-white">Cashback</Link> ·{' '}
            <Link to="/prc-to-inr-converter" className="underline hover:text-white">PRC to INR</Link>
          </p>
        </div>
      </section>
    </div>
  );
};

export default HowToEarnMoneyOnlineIndia;
