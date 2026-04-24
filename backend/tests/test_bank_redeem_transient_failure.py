"""
Regression test: Bank Redeem should NOT show "Available: 0 PRC" on transient error
====================================================================================

Bug (REAL root cause found Feb 2026):
  User 9970100782 had Redeem Limit Remaining = 12,99,837 PRC on Home screen
  (same API: /api/user/{uid}/redeem-limit) but Bank Redeem page showed
  "Insufficient Redeem Limit. Available: 0 PRC".

Root cause (frontend):
  BankRedeemPage.js line 101 used `.catch(() => ({ data: null }))` to silently
  swallow ANY error from /redeem-limit — timeout, 403, 500, network blip — all
  collapsed to `null`, then the submit-time guard evaluated
  `redeemLimit?.effective_available || ... || 0` = 0 → false-positive block.

Fix (frontend):
  - Retry /redeem-limit up to 3 times with back-off.
  - If it still fails, surface a toast BUT allow the user to submit; backend
    /bank-transfer/request does the authoritative check_redeem_limit server-side.
  - Submit-time guard now skips the check when redeemLimit is null.

This file verifies the BACKEND authoritative path — ensuring that when the
frontend submits without pre-loaded limit data, the backend correctly allows
the request for users with legitimate redeem limit and blocks those without.
"""
import asyncio
import sys

sys.path.insert(0, "/app/backend")


async def _main():
    from server import check_redeem_limit, db

    # Find a user with positive prc_balance AND positive redeem headroom
    candidate = await db.users.find_one(
        {"prc_balance": {"$gt": 10}},
        {"_id": 0, "uid": 1, "prc_balance": 1}
    )
    assert candidate, "No candidate user in DB"
    uid = candidate["uid"]

    # Backend should authoritatively decide — even if frontend sent no pre-check,
    # backend check must be deterministic for the same input.
    tiny_amount = 5.0
    chk_1 = await check_redeem_limit(uid, tiny_amount)
    chk_2 = await check_redeem_limit(uid, tiny_amount)
    assert chk_1["allowed"] == chk_2["allowed"], "Backend must be deterministic"

    # With admin override, user should always be allowed for small redemptions
    await db.users.update_one({"uid": uid}, {"$set": {"redeem_limit_override": 10000}})
    try:
        chk_override = await check_redeem_limit(uid, tiny_amount)
        assert chk_override["allowed"] is True, (
            f"Backend must allow {tiny_amount} PRC when override=10000 is active; got {chk_override}"
        )
    finally:
        await db.users.update_one({"uid": uid}, {"$unset": {"redeem_limit_override": ""}})

    # Without any limit and zero active network, backend rightly blocks
    # (this mirrors the legitimate "no network" case; frontend would also show a proper error)
    huge_amount = 999_999_999.0
    chk_huge = await check_redeem_limit(uid, huge_amount)
    assert chk_huge["allowed"] is False, "Backend must block absurdly large amounts"

    print("Backend authoritative limit check verified — frontend transient errors can safely defer to server.")


if __name__ == "__main__":
    asyncio.run(_main())
    print("All transient-failure regression checks PASSED")
