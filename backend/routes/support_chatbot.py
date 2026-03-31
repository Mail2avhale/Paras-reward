"""
Paras Reward AI Support Chatbot
- Answers user queries based on complete platform knowledge
- Fetches REAL user data for personalized answers
- NEVER reveals internal formulas, algorithms, or business logic
- Gives real data-based answers without exposing math
- Earning Projections: "If I get X more referrals, what will I earn?"
"""
import os
import math
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

router = APIRouter(prefix="/ai", tags=["AI Support Chatbot"])

db = None

def set_db(database):
    global db
    db = database

try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    _HAS_LLM = True
except ImportError:
    _HAS_LLM = False
    LlmChat = None
    UserMessage = None

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

# Mining constants (mirrored from mining.py)
_BASE_MINING_PRC = 1000
_BASE_MINING_THRESHOLD = 250  # base=1000 if network < 250, base=0 if >= 250
_MIN_PRC_PER_USER = 2.5
_NETWORK_CAP_BASE = 800
_NETWORK_CAP_DIRECT_MAX = 4000
_NETWORK_CAP_MAX = 6000
_CAP_PER_DIRECT = 16
_CAP_PER_L1_INDIRECT = 5


def _project_prc_per_user(network_size: int) -> float:
    if network_size <= 0:
        return 0
    if network_size == 1:
        return 5 * (21 - math.log2(2)) / 14
    log_val = math.log2(max(2, network_size))
    return round(max(_MIN_PRC_PER_USER, 5 * (21 - log_val) / 14), 6)


def _project_cap(direct: int, l1: int) -> int:
    return min(_NETWORK_CAP_MAX, _NETWORK_CAP_BASE + _CAP_PER_DIRECT * direct + _CAP_PER_L1_INDIRECT * l1)


def compute_projections(current_direct: int, current_l1: int, current_network: int, boost: float) -> list:
    """Compute earning projections for various referral growth scenarios."""
    scenarios = [5, 10, 25, 50, 100]
    results = []
    for extra in scenarios:
        new_direct = current_direct + extra
        # Assume each new referral brings ~1 L1 indirect on average
        new_l1 = current_l1 + int(extra * 0.5)
        new_cap = _project_cap(new_direct, new_l1)
        # Assume ~30% of new referrals become active Elite miners
        projected_active = min(current_network + int(extra * 0.3), new_cap)
        prc_pu = _project_prc_per_user(projected_active)
        network_bonus = projected_active * prc_pu
        # Base = 1000 if network < 250, else 0
        base = _BASE_MINING_PRC if projected_active < _BASE_MINING_THRESHOLD else 0
        daily = round((base + network_bonus) * boost, 2)
        monthly = round(daily * 28, 2)
        results.append({
            "extra_referrals": extra,
            "new_direct": new_direct,
            "new_cap": new_cap,
            "projected_active_network": projected_active,
            "daily_earning": daily,
            "monthly_earning_28d": monthly,
        })
    return results

_chat_sessions = {}

SYSTEM_PROMPT = """You are Paras Reward's official AI support assistant. You help users understand the platform clearly and friendly.

LANGUAGE RULE (CRITICAL):
- ALWAYS detect the language the user is writing in and respond in THE SAME LANGUAGE.
- If user writes in Marathi → respond in Marathi.
- If user writes in Hindi → respond in Hindi.
- If user writes in English → respond in English.
- If mixed (Hinglish/Marathlish) → respond in the same mix.
- NEVER switch languages unless the user does first.

IMPORTANT RULES:
1. NEVER reveal any internal formula, algorithm, calculation logic, or business math.
2. NEVER say things like "the formula is..." or "it's calculated as..." or show mathematical expressions.
3. When user asks about their data, USE the real data provided in [USER_DATA] block to give accurate, personalized answers.
4. If someone directly asks for the formula, politely say "Our system automatically calculates your rewards based on your network activity."
5. Always answer in context of the user's REAL data when available.

EARNING PROJECTION RULES:
- When user asks "what if I get X more referrals" or "how much will I earn with more referrals" or any projection/prediction question:
  1. ALWAYS use the exact numbers from [PROJECTION_DATA]. Do NOT say "it depends" or be vague.
  2. Pick the closest scenario. Example: if user asks about 10 referrals, use the "+10 referrals" row directly.
  3. Present clearly: "If you bring 10 more referrals, your estimated daily earning would increase from [current] to approximately [projected] PRC/day — that's about [monthly] PRC in 28 days!"
  4. ALWAYS compare with their CURRENT daily earning to highlight the growth difference.
  5. These are estimates based on typical referral activity. Say "approximately" once but still give the numbers confidently.
  6. NEVER reveal the projection math/formula. Just state the results naturally as system-calculated estimates.
  7. If asked for a number not in the table (e.g., 15), interpolate between the nearest two scenarios and give approximate figure.
  8. Be enthusiastic and encouraging about growth potential.

PLATFORM KNOWLEDGE:

REGISTRATION: Required: Full Name, Email, Mobile (10-digit), 6-digit PIN, optional Referral Code. Each mobile & email only once. Start as "Explorer" (free).

LOGIN: Email/Mobile/UID → Sign In → 6-digit PIN.

SUBSCRIPTION PLANS:
- Explorer (Free): Can start mining, see speed, CANNOT collect PRC. No redemption.
- Elite (Paid): Mine AND collect PRC. Full access.
  - Cash/Razorpay: Rs.999 + 18% GST = Rs.1,178.82. 100% speed. 1% burn.
  - PRC: ~16,477 PRC. 70% speed. 5% burn. Duration: 28 days.

MINING:
- Base earning: 1000 PRC/day when network has less than 250 active members. Once network reaches 250, base becomes 0 and only network bonus continues.
- Network bonus from active Elite members below you continues regardless of base.
- Larger networks earn more, per-person bonus decreases slightly as network grows.
- Sessions run 24 hours. Start → Earn → Collect → Repeat.
- Explorer can see speed but cannot collect.
- PRC Elite = 100% speed. Cash Elite = 100% speed + 30% POPCORN bonus (extra mining reward).

NETWORK CAP (3-Tier):
- Tier 1: Base capacity everyone gets.
- Tier 2: Grows with YOUR direct referrals.
- Tier 3: Grows when YOUR referrals invite others (L1 Indirect).
- Maximum: 6000 active network members.

REDEEM OPTIONS (Elite required):
1. Gift Vouchers: Rs.100/500/1000/5000.
2. Bank Transfer: Min Rs.200, Max Rs.10,000. KYC required.
3. Bill Payments (BBPS): 20+ services.
4. Flash Sales: Special deals.

SERVICE CHARGES: Processing Fee Rs.10 + Admin 20% + Burn (1% Cash / 5% PRC).

GIFT SUBSCRIPTION: Elite users can gift 24hr Elite to direct referrals.

PRC ECONOMY: Dynamic rate, not fixed. Shown in app before transactions.

When answering with user data:
- Use exact numbers from [USER_DATA] for balance, mining rate, network stats
- Say "Your current..." or "You have..." with real numbers
- For earnings, say "At your current rate, you earn approximately X PRC per day"
- Be helpful, friendly, and concise
- Use bullet points for clarity
"""


async def get_user_context(uid: str) -> str:
    """Fetch real user data + earning projections for personalized chatbot responses"""
    if db is None:
        return ""
    
    try:
        user = await db.users.find_one({"uid": uid}, {"_id": 0, "pin_hash": 0, "password": 0})
        if not user:
            return ""
        
        # Import mining functions
        from routes.mining import calculate_mining_rate, get_l1_indirect_count
        from routes.growth_economy import get_growth_network_stats, get_dynamic_prc_rate
        
        # Fetch all data in parallel
        import asyncio
        mining_data, network_stats, prc_rate = await asyncio.gather(
            calculate_mining_rate(uid),
            get_growth_network_stats(uid),
            get_dynamic_prc_rate(),
        )
        
        # Get subscription info
        plan = user.get("subscription_plan", "explorer")
        payment_type = user.get("subscription_payment_type", "cash")
        is_elite = plan.lower() in ["elite", "vip", "startup", "growth", "pro"]
        sub_end = user.get("subscription_end_date", "")
        
        # Compute earning projections
        boost = mining_data.get("boost_multiplier", 1.0)
        projections = compute_projections(
            current_direct=mining_data.get("direct_referrals", 0),
            current_l1=mining_data.get("l1_indirect_referrals", 0),
            current_network=mining_data.get("network_size", 0),
            boost=boost,
        )
        
        # Format projection table
        proj_lines = []
        for p in projections:
            proj_lines.append(
                f"  +{p['extra_referrals']} referrals → {p['new_direct']} direct, cap {p['new_cap']}, "
                f"~{p['projected_active_network']} active → {p['daily_earning']} PRC/day "
                f"(~{p['monthly_earning_28d']} PRC in 28 days)"
            )
        projection_block = "\n".join(proj_lines)
        
        # Build context string
        context = f"""
[USER_DATA - Real-time data for this user]
Name: {user.get('name', 'Unknown')}
PRC Balance: {user.get('prc_balance', 0):.2f} PRC
Current PRC Rate: 1 INR = {prc_rate} PRC
INR Value of Balance: approximately Rs.{user.get('prc_balance', 0) / prc_rate:.0f}

Subscription: {plan.title()} ({payment_type})
Is Elite Active: {"Yes" if is_elite else "No"}
Mining Speed: {"100% + 30% POPCORN Bonus" if payment_type != "prc" and is_elite else "100%"}
{"Subscription Expires: " + str(sub_end) if sub_end else ""}

Mining Stats:
- Base Earning: {mining_data.get('base_rate', 500)} PRC/day
- Network Bonus: {mining_data.get('network_rate', 0)} PRC/day
- Total Daily Earning: {mining_data.get('total_daily_rate', 500)} PRC/day
- Per Hour: ~{mining_data.get('total_daily_rate', 500) / 24:.1f} PRC/hour

Network Stats:
- Direct Referrals: {network_stats.get('direct_referrals', 0)}
- L1 Indirect Referrals: {network_stats.get('l1_indirect_referrals', 0)}
- Active Network Size: {mining_data.get('network_size', 0)} members
- Network Cap: {mining_data.get('network_cap', 800)} (max 6000)
- Cap Tier 1 (Base): {mining_data.get('cap_tier1_base', 800)}
- Cap Tier 2 (Direct bonus): +{mining_data.get('cap_tier2_bonus', 0)}
- Cap Tier 3 (L1 bonus): +{mining_data.get('cap_tier3_bonus', 0)}
- Raw Network (before cap): {mining_data.get('raw_network_size', 0)}

Redeem Unlock: {network_stats.get('unlock_percent', 0):.1f}% of balance redeemable
Redeemable Amount: ~{user.get('prc_balance', 0) * network_stats.get('unlock_percent', 0) / 100:.0f} PRC (~Rs.{user.get('prc_balance', 0) * network_stats.get('unlock_percent', 0) / 100 / prc_rate:.0f})

{"Note: User is on Explorer plan - cannot collect mined PRC. Suggest upgrading to Elite." if not is_elite else ""}
{"Note: User paid via PRC - 100% mining speed, burn rate 5%." if payment_type == "prc" and is_elite else ""}
{"Note: User paid via Cash - 100% mining speed + 30% POPCORN bonus, burn rate 1%." if payment_type != "prc" and is_elite else ""}
[END USER_DATA]

[PROJECTION_DATA - Earning projections if user brings more referrals]
Current: {mining_data.get('direct_referrals', 0)} direct referrals, earning {mining_data.get('total_daily_rate', 500)} PRC/day
Projections (estimated, assumes ~30% of new referrals become active Elite miners):
{projection_block}
[END PROJECTION_DATA]
"""
        return context
    except Exception as e:
        logging.error(f"Error fetching user context for {uid}: {e}")
        return ""


class ChatRequest(BaseModel):
    uid: str
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str


@router.post("/support-chat", response_model=ChatResponse)
async def support_chat(req: ChatRequest):
    """AI Support Chatbot with real user data"""
    if not _HAS_LLM or not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=503, detail="AI service not available")

    session_id = req.session_id or f"chat_{req.uid}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

    try:
        # Fetch real user data
        user_context = await get_user_context(req.uid)
        
        # Get or create chat session
        if session_id not in _chat_sessions:
            system_msg = SYSTEM_PROMPT
            if user_context:
                system_msg += f"\n\n{user_context}"
            
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=session_id,
                system_message=system_msg,
            )
            _chat_sessions[session_id] = {"chat": chat, "uid": req.uid}
        else:
            chat = _chat_sessions[session_id]["chat"]

        # Send message
        response = await chat.send_message(UserMessage(text=req.message))

        return ChatResponse(response=response, session_id=session_id)
    except Exception as e:
        logging.error(f"Chatbot error for {req.uid}: {e}")
        raise HTTPException(status_code=500, detail="Unable to process your request. Please try again.")
