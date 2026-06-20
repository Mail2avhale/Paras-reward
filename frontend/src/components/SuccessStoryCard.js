import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { CheckCircle2, MapPin, Sparkles, Star } from 'lucide-react';

import { API } from "../lib/api";

const SERVICE_THEME = {
  mobile_recharge: {
    gradient: 'from-blue-500 via-indigo-500 to-sky-500',
    chip: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: '📱',
    label: 'Mobile Recharge',
  },
  dth_recharge: {
    gradient: 'from-purple-500 via-fuchsia-500 to-pink-500',
    chip: 'bg-purple-100 text-purple-700 border-purple-200',
    icon: '📺',
    label: 'DTH Recharge',
  },
  bank_redeem: {
    gradient: 'from-emerald-500 via-green-500 to-teal-500',
    chip: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: '💰',
    label: 'Bank Redeem',
  },
  subscription: {
    gradient: 'from-amber-400 via-orange-500 to-rose-500',
    chip: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: '👑',
    label: 'Subscription',
  },
  sale_elite_subscription: {
    gradient: 'from-pink-500 via-rose-500 to-orange-500',
    chip: 'bg-rose-100 text-rose-700 border-rose-200',
    icon: '💼',
    label: 'Sale Subscription',
  },
  sale_elite_received: {
    gradient: 'from-amber-400 via-orange-500 to-rose-500',
    chip: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: '👑',
    label: 'Subscription',
  },
  paras_mall: {
    gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
    chip: 'bg-violet-100 text-violet-700 border-violet-200',
    icon: '🛍️',
    label: 'Product Booked',
  },
};

const REACTIONS = [
  { key: 'celebrate', emoji: '🎉', label: 'Celebrate' },
  { key: 'love', emoji: '❤️', label: 'Love' },
  { key: 'fire', emoji: '🔥', label: 'Fire' },
];

/**
 * Beautiful Success Story card rendered inside the Community Forum feed.
 * Shows: first name, location (city/state), amount, success badge, emoji reactions.
 * No timestamp shown per product requirement.
 */
const SuccessStoryCard = ({ post, currentUserId, onClick }) => {
  const meta = post.metadata || {};
  const theme = SERVICE_THEME[meta.service_type] || SERVICE_THEME.mobile_recharge;
  const isSubscription = meta.service_type === 'subscription';
  const isSaleElite = meta.service_type === 'sale_elite_subscription';
  const isSaleEliteReceived = meta.service_type === 'sale_elite_received';
  const isParasMall = meta.service_type === 'paras_mall';
  const planName = (meta.plan_name || '').trim();
  let chipLabel = theme.label;
  if (isSubscription && planName) chipLabel = `${theme.label} • ${planName}`;
  else if (isSaleElite) chipLabel = 'Sale Subscription';
  else if (isSaleEliteReceived) chipLabel = `Subscription • ${planName || 'Elite'}`;
  else if (isParasMall && meta.product_name) chipLabel = `🛍️ ${meta.product_name}`;
  let completionLabel = 'Successfully Completed';
  if (isSubscription) completionLabel = 'Upgraded';
  else if (isSaleEliteReceived) completionLabel = `Purchased from ${meta.sender_masked_name || 'a seller'}`;
  else if (isSaleElite) completionLabel = `Sold to ${meta.beneficiary_masked_name || 'a buyer'}`;
  else if (isParasMall) completionLabel = 'Product Booked';
  const isOwn = !!currentUserId && meta.beneficiary_user_id === currentUserId;

  const [reactions, setReactions] = useState(post.reactions_count || { celebrate: 0, love: 0, fire: 0 });
  const [myReaction, setMyReaction] = useState(null);
  const [pulse, setPulse] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Fetch current user's reaction for this post
  useEffect(() => {
    if (!currentUserId) return;
    (async () => {
      try {
        const r = await axios.get(`${API}/community/posts/${post.post_id}/my-reaction`, {
          params: { user_id: currentUserId },
        });
        setMyReaction(r.data?.emoji || null);
      } catch { /* ignore */ }
    })();
  }, [currentUserId, post.post_id]);

  // Light celebration pulse on mount if this is a brand new post (<= 60s old)
  useEffect(() => {
    if (!post.created_at) return;
    const age = Date.now() - new Date(post.created_at).getTime();
    if (age < 60_000) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 2500);
      return () => clearTimeout(t);
    }
  }, [post.created_at]);

  const handleReact = useCallback(
    async (emoji, e) => {
      e.stopPropagation();
      if (!currentUserId) {
        toast.error('Please login to react');
        return;
      }
      // Optimistic update
      const prev = myReaction;
      const newReactions = { ...reactions };
      if (prev === emoji) {
        newReactions[emoji] = Math.max(0, (newReactions[emoji] || 0) - 1);
        setMyReaction(null);
      } else {
        if (prev) newReactions[prev] = Math.max(0, (newReactions[prev] || 0) - 1);
        newReactions[emoji] = (newReactions[emoji] || 0) + 1;
        setMyReaction(emoji);
        setPulse(true);
        setTimeout(() => setPulse(false), 500);
      }
      setReactions(newReactions);
      try {
        await axios.post(`${API}/community/posts/${post.post_id}/react`, {
          user_id: currentUserId,
          emoji,
        });
      } catch {
        // rollback on error
        setMyReaction(prev);
        setReactions(post.reactions_count || { celebrate: 0, love: 0, fire: 0 });
      }
    },
    [currentUserId, myReaction, post.post_id, post.reactions_count, reactions]
  );

  const totalReactions = REACTIONS.reduce((sum, r) => sum + (reactions[r.key] || 0), 0);

  return (
    <div
      onClick={() => onClick && onClick(post.post_id)}
      className={`relative overflow-hidden rounded-2xl cursor-pointer group transition-all hover:shadow-xl ${
        isOwn ? 'ring-2 ring-amber-300 ring-offset-1 shadow-md' : ''
      }`}
      data-testid={`success-story-${post.post_id}`}
    >
      {/* Gradient top strip */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${theme.gradient}`} />

      {/* Card body */}
      <div className="bg-white border border-slate-200 border-t-0 rounded-b-2xl p-5">
        {/* Top row: service chip + success badge */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${theme.chip}`}>
              <span className="text-sm leading-none">{theme.icon}</span>
              {chipLabel}
            </span>
            {isOwn && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-sm"
                data-testid={`own-win-badge-${post.post_id}`}
              >
                <Star className="w-3 h-3 fill-current" />
                Your Win
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            {completionLabel}
          </span>
        </div>

        {/* Main row: avatar + name + location */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${theme.gradient} flex items-center justify-center text-white text-lg font-bold shadow-sm shrink-0`}>
            {(meta.first_name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate" data-testid={`success-story-name-${post.post_id}`}>
              {meta.first_name || 'A Paras user'}
            </p>
            <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              {meta.location || 'India'}
            </p>
          </div>
          <div className="ml-auto text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Amount</p>
            <p
              className={`text-2xl font-bold bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent`}
              data-testid={`success-story-amount-${post.post_id}`}
            >
              ₹{(meta.amount_inr || 0).toLocaleString('en-IN')}
            </p>
            {!isSubscription && typeof meta.user_total_redeemed_inr === 'number' && meta.user_total_redeemed_inr > 0 && (
              <p
                className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-700"
                data-testid={`success-story-lifetime-${post.post_id}`}
              >
                <span className="text-slate-400">Redeemed till</span>
                <span className="text-slate-900">
                  ₹{Math.round(meta.user_total_redeemed_inr).toLocaleString('en-IN')}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Reaction bar */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
          {REACTIONS.map((r) => {
            const isSelected = myReaction === r.key;
            const count = reactions[r.key] || 0;
            return (
              <button
                key={r.key}
                onClick={(e) => handleReact(r.key, e)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all
                  ${isSelected
                    ? 'bg-amber-50 border-amber-300 text-amber-700 scale-105'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }
                  ${pulse && isSelected ? 'animate-ping-once' : ''}
                `}
                data-testid={`react-${r.key}-${post.post_id}`}
                aria-label={r.label}
              >
                <span className="text-base leading-none">{r.emoji}</span>
                {count > 0 && <span>{count}</span>}
              </button>
            );
          })}
          {totalReactions > 0 && (
            <span className="ml-auto text-[11px] text-slate-400 font-medium">
              {totalReactions} reaction{totalReactions !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Light celebration overlay for brand-new posts */}
      {showConfetti && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Sparkles className="w-16 h-16 text-amber-400 animate-ping opacity-70" />
        </div>
      )}
    </div>
  );
};

export default SuccessStoryCard;
