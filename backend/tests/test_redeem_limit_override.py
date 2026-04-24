"""
Regression test: Admin Redeem Limit Override
=============================================
Bug: Production user 9970100782 had PRC balance but got
"Insufficient redeem limit 0 available" because
`calculate_user_redeem_limit` ignored admin-set
`redeem_limit_override` field. With zero active network,
formula returned redeemable=0 → available=0 → blocked.

Fix: `calculate_user_redeem_limit` now honors
`redeem_limit_override` as ADDITIONAL headroom on top
of `total_redeemed`, and `check_redeem_limit` skips the
"zero unlock" block when an override is active.
"""
import asyncio
import pytest
import sys

sys.path.insert(0, "/app/backend")


@pytest.mark.asyncio
async def test_override_raises_effective_available():
    from server import calculate_user_redeem_limit, db

    # Pick any user with prc_balance > 0 and zero active network
    user = await db.users.find_one(
        {"prc_balance": {"$gt": 100}},
        {"_id": 0, "uid": 1, "prc_balance": 1}
    )
    assert user, "No candidate user in DB"
    uid = user["uid"]

    # Baseline (no override)
    await db.users.update_one({"uid": uid}, {"$unset": {"redeem_limit_override": ""}})
    baseline = await calculate_user_redeem_limit(uid)

    # Apply override of 25,000 PRC
    await db.users.update_one({"uid": uid}, {"$set": {"redeem_limit_override": 25000}})
    try:
        result = await calculate_user_redeem_limit(uid)

        assert result["override_active"] is True
        assert result["override_value"] == 25000.0
        # Redeemable must increase by at least the granted amount
        assert result["redeemable"] >= baseline["redeemable"] + 25000 - 1
        # Available (new headroom) must be > 0 when balance is positive
        assert result["available"] > 0
        assert result["effective_available"] > 0
        # Effective must be capped at current balance
        assert result["effective_available"] <= result["current_balance"]
    finally:
        await db.users.update_one({"uid": uid}, {"$unset": {"redeem_limit_override": ""}})


@pytest.mark.asyncio
async def test_check_redeem_limit_bypasses_zero_unlock_with_override():
    from server import check_redeem_limit, db

    user = await db.users.find_one(
        {"prc_balance": {"$gt": 100}},
        {"_id": 0, "uid": 1, "prc_balance": 1}
    )
    assert user
    uid = user["uid"]
    balance = float(user["prc_balance"])
    amount_to_redeem = min(50.0, balance * 0.1)

    await db.users.update_one({"uid": uid}, {"$set": {"redeem_limit_override": 10000}})
    try:
        chk = await check_redeem_limit(uid, amount_to_redeem)
        assert chk["allowed"] is True, f"Expected allowed=True got: {chk}"
    finally:
        await db.users.update_one({"uid": uid}, {"$unset": {"redeem_limit_override": ""}})


@pytest.mark.asyncio
async def test_zero_override_is_noop():
    from server import calculate_user_redeem_limit, db

    user = await db.users.find_one({"prc_balance": {"$gt": 100}}, {"_id": 0, "uid": 1})
    uid = user["uid"]
    await db.users.update_one({"uid": uid}, {"$set": {"redeem_limit_override": 0}})
    try:
        result = await calculate_user_redeem_limit(uid)
        assert result["override_active"] is False
    finally:
        await db.users.update_one({"uid": uid}, {"$unset": {"redeem_limit_override": ""}})


if __name__ == "__main__":
    async def _run_all():
        await test_override_raises_effective_available()
        await test_check_redeem_limit_bypasses_zero_unlock_with_override()
        await test_zero_override_is_noop()
    asyncio.run(_run_all())
    print("All redeem override regression tests PASSED")
