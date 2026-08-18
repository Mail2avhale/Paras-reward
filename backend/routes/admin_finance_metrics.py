"""
Daily Financial Metrics — mandatory operational metrics for the finance team.

Endpoint: GET /api/admin/finance/daily-metrics?days=30

Returns a day-wise timeseries with the following 11 metrics:
  1. PRC Issued          — total PRC minted (mining, tap, referrals, etc.)
  2. PRC Collected       — total PRC users SPENT on any service today
  3. PRC Redeemed        — PRC cashed out via bank transfer
  4. PRC Outstanding     — running net PRC in circulation (cumulative)
  5. Redemption Value    — INR value of all completed redemptions today
  6. Service Charges     — 20% cash service charges COLLECTED (PAID) today
  7. GST Collected       — 18% GST on subscription revenue today
  8. Merchant Contrib.   — service charges from partner_store + mall bookings
  9. Shopping Revenue    — total INR of paras_mall + partner_store spend
 10. Redemption Cost     — Redemption Value + operational overhead (10%)
 11. Net Contribution    — Service + GST + Merchant + Shopping - Redemption Cost

Feb 2026 — Author: Finance metrics mandate.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/finance", tags=["Admin Finance Metrics"])

db = None


def set_db(database):
    global db
    db = database


# ==============================================================================
# TXN CLASSIFICATION — kept in sync with WalletServiceV2 / ledger
# ==============================================================================

# PRC Issued = user's PRC balance goes UP because we minted new PRC.
PRC_MINT_TYPES = {
    "mining", "tap_game", "referral", "referral_bonus", "cashback",
    "admin_credit", "manual_credit", "prc_credit", "profit_share",
    "delivery_commission", "prc_rain_gain", "signup_bonus", "reward",
    "spin_win", "quiz_win", "streak_bonus",
}

# PRC Collected = user-initiated PRC SPEND on a service (this maps 1:1 with
# the "chargeable txn types" in the universal 20% service charge hook).
PRC_SPEND_TYPES = {
    "redeem", "purchase", "monthly_fee", "bill_payment", "recharge",
    "voucher", "gift", "partner_pay", "mall_booking", "luxury",
    "gift_subscription", "elite_subscription", "dth", "dmt",
    "withdrawal",
}

# PRC Redeemed = specifically PRC → INR cash-out to bank.
PRC_REDEEM_TYPES = {"bank_transfer", "bank_redeem", "prc_to_bank"}

# Everything else (transfers, refunds, admin corrections, burns) are neutral.


async def _sum(coll: str, match: dict, field: str = "amount", abs_val: bool = False):
    """Small aggregation helper — returns numeric sum, or 0."""
    val_expr = {"$abs": f"${field}"} if abs_val else f"${field}"
    try:
        cur = db[coll].aggregate([
            {"$match": match},
            {"$group": {"_id": None, "total": {"$sum": val_expr}}},
        ])
        rows = await cur.to_list(1)
        return float(rows[0]["total"]) if rows else 0.0
    except Exception as e:
        logger.warning(f"[metrics] _sum({coll}) failed: {e}")
        return 0.0


async def _count(coll: str, match: dict) -> int:
    try:
        return await db[coll].count_documents(match)
    except Exception:
        return 0


async def compute_daily_metrics(target_date: Optional[str] = None) -> dict:
    """Compute the 11 mandatory finance metrics for a single calendar day (UTC).

    `target_date` — ISO date string 'YYYY-MM-DD'. Defaults to yesterday.
    """
    if target_date:
        date_obj = datetime.fromisoformat(target_date)
    else:
        date_obj = datetime.now(timezone.utc) - timedelta(days=1)

    date_str = date_obj.strftime("%Y-%m-%d")
    start_iso = date_str + "T00:00:00"
    end_iso = date_str + "T23:59:59.999"

    settings = await db.settings.find_one({}, {"_id": 0, "accounting_settings": 1})
    prc_per_inr = 10
    if settings and "accounting_settings" in settings:
        prc_per_inr = settings["accounting_settings"].get("prc_per_inr", 10)

    day_match = {"created_at": {"$gte": start_iso, "$lte": end_iso}}

    # 1) PRC Issued (today)
    prc_issued = await _sum(
        "transactions",
        {**day_match, "type": {"$in": list(PRC_MINT_TYPES)}},
    )

    # 2) PRC Collected (user spend today, any service)
    prc_collected = await _sum(
        "transactions",
        {**day_match, "type": {"$in": list(PRC_SPEND_TYPES)}},
        abs_val=True,
    )

    # 3) PRC Redeemed (bank cash-out today)
    prc_redeemed = await _sum(
        "transactions",
        {**day_match, "type": {"$in": list(PRC_REDEEM_TYPES)}},
        abs_val=True,
    )

    # 4) PRC Outstanding = cumulative net (all-time mint − all-time burn)
    all_mint = await _sum("transactions", {"type": {"$in": list(PRC_MINT_TYPES)}})
    all_burn_types = list(PRC_SPEND_TYPES | PRC_REDEEM_TYPES | {"burn", "sustainability_burn"})
    all_burn = await _sum(
        "transactions", {"type": {"$in": all_burn_types}}, abs_val=True,
    )
    prc_outstanding = round(all_mint - all_burn, 2)

    # 5) Redemption Value (INR) — bank redeems completed today
    paid_status = {"$in": ["paid", "completed", "success"]}
    redemption_value_inr = await _sum(
        "bank_transfer_requests",
        {"status": paid_status, "paid_at": {"$gte": start_iso, "$lte": end_iso}},
        field="withdrawal_amount",
    )
    if redemption_value_inr == 0:
        # Fallback: try amount_inr
        redemption_value_inr = await _sum(
            "bank_transfer_requests",
            {"status": paid_status, "paid_at": {"$gte": start_iso, "$lte": end_iso}},
            field="amount_inr",
        )

    # 6) Service Charges Collected (PAID today)
    service_charges = await _sum(
        "redemption_service_charges",
        {"status": "PAID", "paid_at": {"$gte": start_iso, "$lte": end_iso}},
        field="total_payable",
    )

    # 7) GST Collected — 18% of subscription revenue (Razorpay + PRC subs)
    razorpay_subs = await _sum(
        "subscription_payments",
        {**day_match, "status": {"$in": ["success", "captured", "completed"]}},
        field="amount",
    )
    subscription_revenue = razorpay_subs
    gst_collected = round(subscription_revenue * 0.18 / 1.18, 2)  # extract GST from tax-inclusive

    # 8) Merchant Contribution — 20% fee from partner_store + mall bookings
    merchant_contrib = await _sum(
        "redemption_service_charges",
        {
            "status": "PAID",
            "paid_at": {"$gte": start_iso, "$lte": end_iso},
            "redemption_type": {"$in": ["partner_store_payment", "paras_mall_booking"]},
        },
        field="total_payable",
    )

    # 9) Shopping Revenue — INR value of partner_store + mall bookings today
    partner_store_prc = await _sum(
        "partner_store_transactions",
        {**day_match, "status": {"$in": ["completed", "success", "paid"]}},
        field="prc_amount",
    )
    mall_booking_prc = await _sum(
        "mall_bookings",
        {**day_match, "status": {"$nin": ["cancelled", "refunded"]}},
        field="upfront_prc",
    )
    shopping_prc = partner_store_prc + mall_booking_prc
    shopping_revenue_inr = round(shopping_prc / prc_per_inr, 2)

    # 10) Redemption Cost = redemption_value + 10% operational overhead
    redemption_cost = round(redemption_value_inr * 1.10, 2)

    # 11) Net Contribution
    net_contribution = round(
        service_charges + gst_collected + merchant_contrib + shopping_revenue_inr
        - redemption_cost,
        2,
    )

    return {
        "date": date_str,
        "prc_issued": round(prc_issued, 2),
        "prc_collected": round(prc_collected, 2),
        "prc_redeemed": round(prc_redeemed, 2),
        "prc_outstanding": prc_outstanding,
        "redemption_value_inr": round(redemption_value_inr, 2),
        "service_charges_inr": round(service_charges, 2),
        "gst_collected_inr": gst_collected,
        "merchant_contribution_inr": round(merchant_contrib, 2),
        "shopping_revenue_inr": shopping_revenue_inr,
        "redemption_cost_inr": redemption_cost,
        "net_contribution_inr": net_contribution,
        "prc_per_inr": prc_per_inr,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/daily-metrics")
async def get_daily_metrics(days: int = 30, target_date: Optional[str] = None):
    """Return the 11 mandatory finance metrics.

    - Default: last 30 days timeseries + a totals row.
    - Pass `target_date=YYYY-MM-DD` to fetch a single day only.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="DB not initialised")
    if target_date:
        row = await compute_daily_metrics(target_date)
        return {"single_day": True, "row": row}

    if days < 1 or days > 365:
        raise HTTPException(status_code=400, detail="days must be between 1 and 365")

    today = datetime.now(timezone.utc).date()
    series = []
    for i in range(days):
        d = today - timedelta(days=i)
        row = await compute_daily_metrics(d.isoformat())
        series.append(row)
    series.reverse()   # chronological

    # Totals (sum of numeric fields except prc_outstanding which is a snapshot)
    totals = {"date": f"{series[0]['date']} → {series[-1]['date']}"}
    numeric_fields = [
        "prc_issued", "prc_collected", "prc_redeemed",
        "redemption_value_inr", "service_charges_inr", "gst_collected_inr",
        "merchant_contribution_inr", "shopping_revenue_inr",
        "redemption_cost_inr", "net_contribution_inr",
    ]
    for f in numeric_fields:
        totals[f] = round(sum(r[f] for r in series), 2)
    # PRC outstanding is a running snapshot — use latest
    totals["prc_outstanding"] = series[-1]["prc_outstanding"] if series else 0

    return {
        "days": days,
        "series": series,
        "totals": totals,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
