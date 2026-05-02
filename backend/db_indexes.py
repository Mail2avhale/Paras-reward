"""
Database Index Manager for Paras Rewards Platform.
Ensures all critical indexes exist for optimal query performance.

Resilient: each index creation is wrapped in its own try/except so that a
single failure (e.g. IndexKeySpecsConflict on an existing index) CANNOT abort
the whole script. This is critical because a silent failure here previously
meant our hot collections (bank_transfer_requests, unified_redemptions, etc.)
had no status/user_id indexes — causing full collection scans and 504s.
"""
import logging

logger = logging.getLogger(__name__)


async def _safe_create_index(coll, keys, **kwargs):
    """Create an index; swallow "already exists" / conflict errors.

    Args:
        coll: motor collection
        keys: str | list[tuple] passed directly to create_index
        kwargs: passed to create_index (unique, sparse, background, name, ...)

    Never raises. Returns True on created/exists, False on unexpected error.
    """
    try:
        await coll.create_index(keys, **kwargs)
        return True
    except Exception as e:
        msg = str(e).lower()
        # Known benign cases — don't spam logs
        if any(tok in msg for tok in [
            "already exists",
            "indexkeyspecsconflict",
            "index with name",
            "existing index has the same name",
            "exists with a different",
        ]):
            logger.debug(f"[indexes] skip {coll.name} {keys}: already present")
            return True
        # Unexpected — log but do NOT re-raise so other indexes still get created
        logger.warning(f"[indexes] {coll.name} {keys} failed: {e}")
        return False


async def create_performance_indexes(db):
    """Create all critical indexes for high-performance queries on startup.

    IMPORTANT: This function must be resilient — even if half the calls fail,
    the other half MUST be attempted. Do NOT wrap everything in a single
    try/except — use _safe_create_index helper.
    """
    print("🔧 Creating database indexes for optimal performance...")

    created = 0
    skipped_or_failed = 0

    async def ix(coll, keys, **kwargs):
        nonlocal created, skipped_or_failed
        ok = await _safe_create_index(coll, keys, **kwargs)
        if ok:
            created += 1
        else:
            skipped_or_failed += 1

    # ============ USERS COLLECTION ============
    await ix(db.users, "uid", unique=True, background=True)
    await ix(db.users, "email", unique=True, background=True)
    await ix(db.users, "mobile", unique=True, sparse=True, background=True)
    await ix(db.users, "referred_by", background=True)
    await ix(db.users, "referral_code", unique=True, sparse=True, background=True)
    await ix(db.users, "subscription_plan", background=True)
    await ix(db.users, "membership_type", background=True)
    await ix(db.users, [("subscription_plan", 1), ("subscription_end_date", 1)], background=True)
    await ix(db.users, "mining_active", background=True)
    await ix(db.users, [("mining_active", 1), ("mining_session_end", 1)], background=True)
    await ix(db.users, "mining_session_end", background=True)
    await ix(db.users, "kyc_verified", background=True)
    await ix(db.users, "kyc_status", background=True)
    await ix(db.users, "city", background=True)
    await ix(db.users, "state", background=True)
    await ix(db.users, [("city", 1), ("show_location", 1)], background=True)
    await ix(db.users, [("state", 1), ("show_location", 1)], background=True)
    await ix(db.users, "last_login", background=True)
    await ix(db.users, "created_at", background=True)
    await ix(db.users, [("created_at", 1), ("uid", 1)], background=True)
    await ix(db.users, "role", background=True)
    await ix(db.users, "is_admin", background=True)
    await ix(db.users, [("referred_by", 1), ("uid", 1)], background=True)
    await ix(db.users, [("referred_by", 1), ("kyc_status", 1), ("subscription_expiry", 1)], background=True)
    await ix(db.users, [("subscription_plan", 1), ("prc_balance", 1)], background=True)
    # Legacy referrer field variants (for /direct-list $or query)
    await ix(db.users, "referrer_id", sparse=True, background=True)
    await ix(db.users, "sponsor_id", sparse=True, background=True)
    await ix(db.users, "invited_by", sparse=True, background=True)
    await ix(db.users, "aadhaar_number", sparse=True, background=True)
    await ix(db.users, "pan_number", sparse=True, background=True)
    await ix(db.users, "device_fingerprint", sparse=True, background=True)
    await ix(db.users, "registration_ip", background=True)
    # Active-network-size query (hot path: calculate_user_redeem_limit → get_active_network_size)
    await ix(db.users, [("tree_position", 1), ("subscription_plan", 1), ("mining_active", 1)], background=True)
    await ix(db.users, [("subscription_plan", 1), ("mining_active", 1)], background=True)
    print("  ✅ Users indexes attempted")

    # ============ TRANSACTIONS COLLECTION ============
    # NOTE: transaction_id may already exist as sparse=True or a different spec.
    # Our _safe_create_index swallows conflict errors so subsequent indexes
    # in the same collection will still be attempted.
    await ix(db.transactions, "transaction_id", unique=True, sparse=True, background=True)
    await ix(db.transactions, "user_id", background=True)
    await ix(db.transactions, "transaction_type", background=True)
    await ix(db.transactions, "created_at", background=True)
    await ix(db.transactions, [("user_id", 1), ("transaction_type", 1)], background=True)
    await ix(db.transactions, [("user_id", 1), ("created_at", -1)], background=True)
    await ix(db.transactions, [("transaction_type", 1), ("created_at", -1)], background=True)
    await ix(db.transactions, [("user_id", 1), ("type", 1), ("created_at", -1)], background=True)
    await ix(db.transactions, "type", background=True)
    print("  ✅ Transactions indexes attempted")

    # ============ BILL PAYMENT REQUESTS ============
    await ix(db.bill_payment_requests, "request_id", unique=True, sparse=True, background=True)
    await ix(db.bill_payment_requests, "user_id", background=True)
    await ix(db.bill_payment_requests, "status", background=True)
    await ix(db.bill_payment_requests, "created_at", background=True)
    await ix(db.bill_payment_requests, [("status", 1), ("created_at", -1)], background=True)
    await ix(db.bill_payment_requests, [("user_id", 1), ("status", 1)], background=True)
    print("  ✅ Bill payment requests indexes attempted")

    # ============ SUBSCRIPTIONS ============
    await ix(db.subscriptions, "user_id", background=True)
    await ix(db.subscriptions, "status", background=True)
    await ix(db.subscriptions, [("user_id", 1), ("status", 1)], background=True)
    await ix(db.subscriptions, "end_date", background=True)
    await ix(db.subscriptions, "subscription_id", unique=True, sparse=True, background=True)
    print("  ✅ Subscriptions indexes attempted")

    # ============ ORDERS ============
    await ix(db.orders, "user_id", background=True)
    await ix(db.orders, "status", background=True)
    await ix(db.orders, [("user_id", 1), ("status", 1)], background=True)
    await ix(db.orders, "order_id", unique=True, sparse=True, background=True)
    print("  ✅ Orders indexes attempted")

    # ============ MESSAGES ============
    await ix(db.messages, "user_id", background=True)
    await ix(db.messages, "created_at", background=True)
    await ix(db.messages, [("user_id", 1), ("read", 1)], background=True)
    print("  ✅ Messages indexes attempted")

    # ============ NOTIFICATIONS ============
    await ix(db.notifications, "user_id", background=True)
    await ix(db.notifications, "created_at", background=True)
    await ix(db.notifications, [("user_id", 1), ("read", 1)], background=True)
    await ix(db.notifications, [("user_id", 1), ("created_at", -1)], background=True)
    print("  ✅ Notifications indexes attempted")

    # ============ BBPS TRANSACTIONS ============
    await ix(db.bbps_transactions, "transaction_id", unique=True, sparse=True, background=True)
    await ix(db.bbps_transactions, "user_id", background=True)
    await ix(db.bbps_transactions, "status", background=True)
    await ix(db.bbps_transactions, [("user_id", 1), ("status", 1)], background=True)
    print("  ✅ BBPS transactions indexes attempted")

    # ============ MINING HISTORY ============
    await ix(db.mining_history, "user_id", background=True)
    await ix(db.mining_history, [("user_id", 1), ("session_end", -1)], background=True)
    print("  ✅ Mining history indexes attempted")

    # ============ KYC DOCUMENTS ============
    await ix(db.kyc_documents, "kyc_id", unique=True, sparse=True, background=True)
    await ix(db.kyc_documents, "user_id", background=True)
    await ix(db.kyc_documents, "status", background=True)
    await ix(db.kyc_documents, [("status", 1), ("submitted_at", 1)], background=True)
    await ix(db.kyc_documents, "submitted_at", background=True)
    print("  ✅ KYC documents indexes attempted")

    # ============ KYC (live collection used by /kyc/list) ============
    await ix(db.kyc, "uid", background=True)
    await ix(db.kyc, "status", background=True)
    await ix(db.kyc, [("status", 1), ("submitted_at", -1)], background=True)
    await ix(db.kyc, "submitted_at", background=True)
    await ix(db.kyc, "created_at", background=True)
    print("  ✅ KYC (live) indexes attempted")

    # ============ BILL PAYMENTS ============
    await ix(db.bill_payments, "payment_id", unique=True, sparse=True, background=True)
    await ix(db.bill_payments, "user_id", background=True)
    await ix(db.bill_payments, "status", background=True)
    await ix(db.bill_payments, "created_at", background=True)
    await ix(db.bill_payments, [("status", 1), ("created_at", -1)], background=True)
    print("  ✅ Bill payments indexes attempted")

    # ============ BANK TRANSFER REQUESTS (CRITICAL) ============
    await ix(db.bank_transfer_requests, "request_id", unique=True, sparse=True, background=True)
    await ix(db.bank_transfer_requests, "user_id", background=True)
    await ix(db.bank_transfer_requests, "status", background=True)
    await ix(db.bank_transfer_requests, "created_at", background=True)
    await ix(db.bank_transfer_requests, [("status", 1), ("created_at", -1)], background=True)
    await ix(db.bank_transfer_requests, [("user_id", 1), ("status", 1)], background=True)
    await ix(db.bank_transfer_requests, [("user_id", 1), ("created_at", -1)], background=True)
    print("  ✅ Bank transfer requests indexes attempted")

    # ============ BANK REDEEM REQUESTS ============
    await ix(db.bank_redeem_requests, "user_id", background=True)
    await ix(db.bank_redeem_requests, "status", background=True)
    await ix(db.bank_redeem_requests, [("status", 1), ("created_at", -1)], background=True)
    await ix(db.bank_redeem_requests, [("user_id", 1), ("status", 1)], background=True)
    print("  ✅ Bank redeem requests indexes attempted")

    # ============ RECHARGE REQUESTS ============
    await ix(db.recharge_requests, "user_id", background=True)
    await ix(db.recharge_requests, "status", background=True)
    await ix(db.recharge_requests, [("status", 1), ("created_at", -1)], background=True)
    await ix(db.recharge_requests, [("user_id", 1), ("status", 1)], background=True)
    print("  ✅ Recharge requests indexes attempted")

    # ============ DMT TRANSACTIONS ============
    await ix(db.dmt_transactions, "user_id", background=True)
    await ix(db.dmt_transactions, "status", background=True)
    await ix(db.dmt_transactions, [("user_id", 1), ("status", 1)], background=True)
    print("  ✅ DMT transactions indexes attempted")

    # ============ SUBSCRIPTION PAYMENTS ============
    await ix(db.subscription_payments, "user_id", background=True)
    await ix(db.subscription_payments, "status", background=True)
    await ix(db.subscription_payments, [("status", 1), ("created_at", -1)], background=True)
    await ix(db.subscription_payments, "order_id", sparse=True, background=True)
    await ix(db.subscription_payments, "payment_id", sparse=True, background=True)
    await ix(db.subscription_payments, "razorpay_order_id", sparse=True, background=True)
    print("  ✅ Subscription payments indexes attempted")

    # ============ UNIFIED REDEMPTIONS ============
    await ix(db.unified_redemptions, "user_id", background=True)
    await ix(db.unified_redemptions, "status", background=True)
    await ix(db.unified_redemptions, [("user_id", 1), ("status", 1)], background=True)
    await ix(db.unified_redemptions, [("status", 1), ("created_at", -1)], background=True)
    print("  ✅ Unified redemptions indexes attempted")

    # ============ BANK TRANSFERS (legacy) ============
    await ix(db.bank_transfers, "user_id", background=True)
    await ix(db.bank_transfers, "status", background=True)
    await ix(db.bank_transfers, [("user_id", 1), ("status", 1)], background=True)
    print("  ✅ Bank transfers indexes attempted")

    # ============ VIP PAYMENTS ============
    await ix(db.vip_payments, "user_id", background=True)
    await ix(db.vip_payments, "status", background=True)
    await ix(db.vip_payments, [("user_id", 1), ("status", 1)], background=True)
    # CRITICAL: payment_id lookup drives approve/reject endpoints — without this
    # a COLLSCAN over all VIP payments fires on every admin click (8s+ on prod).
    await ix(db.vip_payments, "payment_id", unique=True, sparse=True, background=True)
    await ix(db.vip_payments, "utr_number", sparse=True, background=True)
    # List endpoint sorts by submitted_at/approved_at/rejected_at per tab.
    await ix(db.vip_payments, "submitted_at", background=True)
    await ix(db.vip_payments, "approved_at", background=True)
    await ix(db.vip_payments, "rejected_at", background=True)
    await ix(db.vip_payments, [("status", 1), ("submitted_at", -1)], background=True)
    await ix(db.vip_payments, [("status", 1), ("approved_at", -1)], background=True)
    await ix(db.vip_payments, [("status", 1), ("rejected_at", -1)], background=True)
    await ix(db.vip_payments, [("user_id", 1), ("created_at", -1)], background=True)
    print("  ✅ VIP payments indexes attempted")

    # ============ PRC TRANSACTIONS (hot path: wallet history, admin ledger) ============
    await ix(db.prc_transactions, "user_id", background=True)
    await ix(db.prc_transactions, "type", background=True)
    await ix(db.prc_transactions, "created_at", background=True)
    await ix(db.prc_transactions, [("user_id", 1), ("created_at", -1)], background=True)
    await ix(db.prc_transactions, [("type", 1), ("created_at", -1)], background=True)
    await ix(db.prc_transactions, [("user_id", 1), ("type", 1), ("created_at", -1)], background=True)
    print("  ✅ PRC transactions indexes attempted")

    # ============ RAZORPAY ORDERS ============
    await ix(db.razorpay_orders, "user_id", background=True)
    await ix(db.razorpay_orders, "status", background=True)
    await ix(db.razorpay_orders, "order_id", sparse=True, background=True)
    await ix(db.razorpay_orders, [("user_id", 1), ("created_at", -1)], background=True)
    print("  ✅ Razorpay orders indexes attempted")

    # ============ VIP SUBSCRIPTIONS (active plan lookup) ============
    await ix(db.vip_subscriptions, "user_id", background=True)
    await ix(db.vip_subscriptions, "status", background=True)
    await ix(db.vip_subscriptions, "expires_at", background=True)
    await ix(db.vip_subscriptions, [("user_id", 1), ("status", 1)], background=True)
    print("  ✅ VIP subscriptions indexes attempted")

    # ============ SUCCESS STORIES (community feed + idempotency) ============
    await ix(db.success_stories, "user_id", background=True)
    await ix(db.success_stories, "created_at", background=True)
    await ix(db.success_stories, "ref_id", sparse=True, background=True)
    print("  ✅ Success stories indexes attempted")

    # ============ ADMIN AUDIT LOGS ============
    await ix(db.admin_audit_logs, "admin_id", background=True)
    await ix(db.admin_audit_logs, "action", background=True)
    await ix(db.admin_audit_logs, "created_at", background=True)
    await ix(db.admin_audit_logs, [("action", 1), ("created_at", -1)], background=True)
    print("  ✅ Admin audit logs indexes attempted")

    # ============ GIFT VOUCHER / PRC LEDGER / PAYMENT REQUESTS ============
    await ix(db.gift_voucher_requests, "user_id", background=True)
    await ix(db.gift_voucher_requests, "status", background=True)
    await ix(db.gift_voucher_requests, [("user_id", 1), ("status", 1)], background=True)

    await ix(db.prc_ledger, "user_id", background=True)
    await ix(db.prc_ledger, "type", background=True)
    await ix(db.prc_ledger, [("user_id", 1), ("type", 1), ("ts", -1)], background=True)

    await ix(db.payment_requests, "user_id", background=True)
    await ix(db.payment_requests, "status", background=True)
    await ix(db.payment_requests, [("user_id", 1), ("status", 1)], background=True)
    print("  ✅ Gift voucher + PRC ledger + Payment requests indexes attempted")

    print(f"✅ Indexes summary: {created} created/existing, {skipped_or_failed} failed")
    return created, skipped_or_failed


async def get_index_stats(db) -> dict:
    """Get statistics about database indexes."""
    stats = {}
    collections = [
        "users", "transactions", "bill_payment_requests", "bank_transfer_requests",
        "bank_redeem_requests", "recharge_requests", "dmt_transactions",
        "subscription_payments", "unified_redemptions", "bank_transfers",
        "kyc", "notifications",
    ]
    for collection_name in collections:
        try:
            collection = db[collection_name]
            indexes = await collection.index_information()
            stats[collection_name] = {
                "index_count": len(indexes),
                "indexes": list(indexes.keys()),
            }
        except Exception as e:
            stats[collection_name] = {"error": str(e)}
    return stats
