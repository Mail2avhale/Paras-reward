"""
E2E TEST — 10-Tier Mining Commission (Mixed Elite + Explorer)
==============================================================
Scenario: 12-level referral chain with mixed statuses
- Admin sets custom 10-tier config with varying percentages
- Collector at bottom triggers mining collect
- Verify:
  1. Only ELITE uplines get PRC (Explorer skipped via roll-up)
  2. Each Elite upline gets EXACTLY collected × their_tier_%
  3. PRC ledger 'Referral Reward' entries created for each
  4. Live Referral Ping notification for each
  5. Admin % change on live → next collect applies new %
  6. Toggle OFF → no commissions distributed
"""
import os, sys, asyncio, uuid, requests, jwt
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
sys.path.insert(0, '/app/backend')

from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta

API = 'https://formula-audit-fix.preview.emergentagent.com'
SECRET = os.environ['JWT_SECRET_KEY']

PASS = '\033[92m✅\033[0m'
FAIL = '\033[91m❌\033[0m'
INFO = '\033[94mℹ️\033[0m '


def check(label, actual, expected, tol=0.0001):
    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        ok = abs(actual - expected) < tol
    else:
        ok = actual == expected
    mark = PASS if ok else FAIL
    print(f"  {mark} {label}: got={actual!r} expected={expected!r}")
    return ok


async def main():
    c = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = c[os.environ['DB_NAME']]

    all_pass = []
    users_to_cleanup = []

    # ---------- STEP 1: Admin login ----------
    print("\n" + "=" * 70)
    print("STEP 1: Admin JWT login")
    print("=" * 70)
    r = requests.post(f'{API}/api/auth/login', json={'mobile': '9999999999', 'pin': '153759'})
    admin_token = r.json().get('token')
    admin_headers = {'Authorization': f'Bearer {admin_token}'}
    all_pass.append(check('Admin login HTTP', r.status_code, 200))
    all_pass.append(check('JWT format', admin_token.count('.'), 2))

    # ---------- STEP 2: Save custom 10-tier config ----------
    print("\n" + "=" * 70)
    print("STEP 2: Admin saves custom 10-tier config")
    print("=" * 70)
    # Percentages: descending — 1.5, 1.2, 1.0, 0.9, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2 (sum=7.4%)
    ten_tiers = [
        {'tier': 1, 'percent': 1.5},
        {'tier': 2, 'percent': 1.2},
        {'tier': 3, 'percent': 1.0},
        {'tier': 4, 'percent': 0.9},
        {'tier': 5, 'percent': 0.8},
        {'tier': 6, 'percent': 0.6},
        {'tier': 7, 'percent': 0.5},
        {'tier': 8, 'percent': 0.4},
        {'tier': 9, 'percent': 0.3},
        {'tier': 10, 'percent': 0.2},
    ]
    expected_sum = sum(t['percent'] for t in ten_tiers)  # 7.4
    r = requests.post(
        f'{API}/api/admin/settings/mining-commission-tiers',
        headers=admin_headers,
        json={'enabled': True, 'tiers': ten_tiers, 'elite_only': True, 'roll_up': True},
    )
    all_pass.append(check('POST 10 tiers HTTP', r.status_code, 200))
    resp = r.json()
    all_pass.append(check('total_percent returned', resp.get('total_percent'), expected_sum))
    all_pass.append(check('saved tier count', len(resp.get('tiers', [])), 10))

    # ---------- STEP 3: Build mixed 12-level chain ----------
    print("\n" + "=" * 70)
    print("STEP 3: Build 12-level referral chain (mixed Elite + Explorer)")
    print("=" * 70)

    async def mkuser(name, elite, ref=None):
        uid = 'e2e-' + str(uuid.uuid4())[:8]
        await db.users.insert_one({
            'uid': uid, 'name': name, 'prc_balance': 500.0,
            'email': f'{uid}@e2e.local',
            'mobile': '5' + str(uuid.uuid4().int)[:9],
            'membership_type': 'elite' if elite else 'explorer',
            'subscription_plan': 'elite' if elite else 'explorer',
            'subscription_expired': False,
            'referred_by': ref,
            'referral_code': 'RC_' + uid[-6:],
        })
        users_to_cleanup.append(uid)
        return uid

    # Chain from top → bottom (top has no referrer). Mix in explorers to
    # exercise roll-up. Labels indicate the expected TIER SLOT assignment.
    # Reading bottom-up (from Collector's perspective):
    #   position 1  (L1 in chain) → Explorer → SKIP
    #   position 2  (L2) → Elite → gets TIER 1 (1.5%)
    #   position 3  (L3) → Elite → gets TIER 2 (1.2%)
    #   position 4  (L4) → Explorer → SKIP
    #   position 5  (L5) → Elite → gets TIER 3 (1.0%)
    #   position 6  (L6) → Elite → gets TIER 4 (0.9%)
    #   position 7  (L7) → Explorer → SKIP
    #   position 8  (L8) → Elite → gets TIER 5 (0.8%)
    #   position 9  (L9) → Elite → gets TIER 6 (0.6%)
    #   position 10 (L10) → Elite → gets TIER 7 (0.5%)
    #   position 11 (L11) → Elite → gets TIER 8 (0.4%)
    #   position 12 (L12) → Elite → gets TIER 9 (0.3%)
    #   position 13 (L13) → Elite → gets TIER 10 (0.2%)
    #   position 14 (L14) → Elite → No slot left (only 10 tiers), NOTHING
    chain_spec = [
        ('L14-Elite',    True,   True),   # (name, elite?, expected_paid?)
        ('L13-Tier10',   True,   True),
        ('L12-Tier9',    True,   True),
        ('L11-Tier8',    True,   True),
        ('L10-Tier7',    True,   True),
        ('L9-Tier6',     True,   True),
        ('L8-Tier5',     True,   True),
        ('L7-Explorer',  False,  False),
        ('L6-Tier4',     True,   True),
        ('L5-Tier3',     True,   True),
        ('L4-Explorer',  False,  False),
        ('L3-Tier2',     True,   True),
        ('L2-Tier1',     True,   True),
        ('L1-Explorer',  False,  False),
    ]
    # Note L14-Elite is NOT expected to receive because we only have 10 tier
    # slots and L14 is the 11th elite in the roll-up sequence.
    chain_spec[0] = ('L14-Elite-No-Slot', True, False)

    prev_uid = None
    node_uids = []
    node_meta = []
    for name, is_elite, expected_paid in chain_spec:
        uid = await mkuser(name, is_elite, prev_uid)
        node_uids.append(uid)
        node_meta.append({'uid': uid, 'name': name, 'elite': is_elite, 'expected_paid': expected_paid})
        prev_uid = uid

    # Collector at the bottom (Elite, mining active)
    collector_uid = await mkuser('Collector', True, prev_uid)
    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {'uid': collector_uid},
        {'$set': {
            'mining_active': True,
            'mining_start_time': (now - timedelta(seconds=200)).isoformat(),
            'mining_session_end': (now + timedelta(seconds=3400)).isoformat(),
        }}
    )
    print(f"  {INFO} Chain built: 14 uplines above collector (top='L14-Elite-No-Slot', bottom='L1-Explorer')")

    # ---------- STEP 4: Trigger mining collect ----------
    print("\n" + "=" * 70)
    print("STEP 4: Trigger /api/mining/collect and verify PRC distribution")
    print("=" * 70)
    exp = datetime.now(timezone.utc) + timedelta(hours=1)
    coll_token = jwt.encode(
        {'sub': collector_uid, 'uid': collector_uid, 'role': 'user', 'type': 'access', 'exp': exp},
        SECRET, algorithm='HS256'
    )
    r = requests.post(
        f'{API}/api/mining/collect/{collector_uid}',
        headers={'Authorization': f'Bearer {coll_token}'}
    )
    all_pass.append(check('Collect HTTP', r.status_code, 200))
    collected = r.json().get('collected_amount', 0)
    print(f"  {INFO} Collected PRC = {collected:.4f}")
    assert collected > 0, 'Collect returned 0 PRC — cannot verify'

    await asyncio.sleep(1.2)  # allow async ledger + notification to settle

    # ---------- STEP 5: Verify each upline balance + ledger + notification ----------
    print("\n" + "=" * 70)
    print("STEP 5: Verify PRC credited to each upline per tier %")
    print("=" * 70)

    # Chain order from collector's upline outward:
    # collector → node_uids[-1] (L1-Explorer) → node_uids[-2] (L2-Tier1) → ...
    # So the reverse of node_uids is the walk order from collector upward.
    walk = list(reversed(node_uids))  # [L1-Explorer, L2-Tier1, L3-Tier2, ..., L14]
    walk_meta = list(reversed(node_meta))
    tier_idx = 0
    for meta in walk_meta:
        u = await db.users.find_one({'uid': meta['uid']}, {'prc_balance': 1, 'name': 1})
        bal = round(u['prc_balance'] - 500.0, 4)  # increment from initial 500

        if meta['expected_paid'] and tier_idx < 10:
            pct = ten_tiers[tier_idx]['percent']
            expected = round(collected * pct / 100.0, 6)
            ok = check(f"{meta['name']}: PRC credited (T{tier_idx + 1} = {pct}%)", bal, round(expected, 4))
            all_pass.append(ok)

            # Ledger entry?
            led = await db.prc_ledger.find_one(
                {'user_id': meta['uid'], 'type': 'mining_referral_reward'},
                {'amount': 1, 'tier_index': 1, 'tier_percent': 1, 'downline_name': 1, 'description': 1}
            )
            all_pass.append(check(f"  Ledger row exists", led is not None, True))
            if led:
                all_pass.append(check(f"  Ledger tier_index", led['tier_index'], tier_idx + 1))
                all_pass.append(check(f"  Ledger tier_percent", led['tier_percent'], pct))
                all_pass.append(check(f"  Ledger downline_name", led['downline_name'], 'Collector'))

            # Notification?
            notif = await db.notifications.find_one(
                {'user_uid': meta['uid'], 'type': 'mining_referral_reward'},
                {'title': 1, 'message': 1}
            )
            all_pass.append(check(f"  🔔 Notification exists", notif is not None, True))
            if notif:
                all_pass.append(check(f"  Notification title", '🎉' in notif['title'], True))
                has_collector = 'Collector' in notif['message']
                all_pass.append(check(f"  Notification names downline", has_collector, True))

            tier_idx += 1
        else:
            # Explorer or beyond 10-tier slot — must have NO credit
            reason = 'Explorer (skipped)' if not meta['elite'] else 'no slot left'
            all_pass.append(check(f"{meta['name']}: NO credit ({reason})", bal, 0))

    # ---------- STEP 6: Verify PRC Statement API ----------
    print("\n" + "=" * 70)
    print("STEP 6: PRC Statement API — Referral Reward category")
    print("=" * 70)
    tier1_uid = walk_meta[1]['uid']  # L2-Tier1 (the first Elite upline)
    tier1_token = jwt.encode(
        {'sub': tier1_uid, 'uid': tier1_uid, 'role': 'user', 'type': 'access', 'exp': exp},
        SECRET, algorithm='HS256'
    )
    r = requests.get(
        f'{API}/api/prc-statement/{tier1_uid}',
        headers={'Authorization': f'Bearer {tier1_token}'}
    )
    all_pass.append(check('PRC Statement HTTP', r.status_code, 200))
    if r.status_code == 200:
        entries = r.json().get('entries', [])
        rr = [e for e in entries if e.get('type') == 'Referral Reward']
        all_pass.append(check('Referral Reward count in statement', len(rr) >= 1, True))
        if rr:
            print(f"  {INFO} Sample narration: {rr[0]['narration'][:120]}")
            all_pass.append(check('Narration mentions Collector', 'Collector' in rr[0]['narration'], True))
            all_pass.append(check('Credit amount matches', rr[0]['credit'] > 0, True))

    # ---------- STEP 7: Admin changes tier 1 % → next collect uses new % ----------
    print("\n" + "=" * 70)
    print("STEP 7: Admin CHANGES tier 1 from 1.5% to 3.0% → next collect verify")
    print("=" * 70)
    new_tiers = [dict(t) for t in ten_tiers]
    new_tiers[0]['percent'] = 3.0
    r = requests.post(
        f'{API}/api/admin/settings/mining-commission-tiers',
        headers=admin_headers,
        json={'enabled': True, 'tiers': new_tiers, 'elite_only': True, 'roll_up': True},
    )
    all_pass.append(check('Update T1 to 3% HTTP', r.status_code, 200))

    # Bump collector session & re-collect
    now2 = datetime.now(timezone.utc)
    await db.users.update_one(
        {'uid': collector_uid},
        {'$set': {
            'mining_active': True,
            'mining_start_time': (now2 - timedelta(seconds=200)).isoformat(),
            'mining_session_end': (now2 + timedelta(seconds=3400)).isoformat(),
        }}
    )
    tier1_bal_before = (await db.users.find_one({'uid': tier1_uid}, {'prc_balance': 1}))['prc_balance']
    r = requests.post(
        f'{API}/api/mining/collect/{collector_uid}',
        headers={'Authorization': f'Bearer {coll_token}'}
    )
    all_pass.append(check('2nd collect HTTP', r.status_code, 200))
    collected2 = r.json().get('collected_amount', 0)
    await asyncio.sleep(1.2)
    tier1_bal_after = (await db.users.find_one({'uid': tier1_uid}, {'prc_balance': 1}))['prc_balance']
    got = round(tier1_bal_after - tier1_bal_before, 6)
    expected2 = round(collected2 * 0.03, 6)
    all_pass.append(check(f'T1 got 3% of {collected2:.4f}', got, round(expected2, 6)))

    # ---------- STEP 8: Toggle OFF → next collect distributes nothing ----------
    print("\n" + "=" * 70)
    print("STEP 8: Toggle OFF → verify next collect distributes NO commission")
    print("=" * 70)
    r = requests.post(
        f'{API}/api/admin/settings/mining-commission-tiers',
        headers=admin_headers,
        json={'enabled': False, 'tiers': new_tiers, 'elite_only': True, 'roll_up': True},
    )
    all_pass.append(check('Disable HTTP', r.status_code, 200))
    now3 = datetime.now(timezone.utc)
    await db.users.update_one(
        {'uid': collector_uid},
        {'$set': {
            'mining_active': True,
            'mining_start_time': (now3 - timedelta(seconds=200)).isoformat(),
            'mining_session_end': (now3 + timedelta(seconds=3400)).isoformat(),
        }}
    )
    ledger_count_before = await db.prc_ledger.count_documents({'user_id': tier1_uid, 'type': 'mining_referral_reward'})
    r = requests.post(
        f'{API}/api/mining/collect/{collector_uid}',
        headers={'Authorization': f'Bearer {coll_token}'}
    )
    await asyncio.sleep(1.0)
    ledger_count_after = await db.prc_ledger.count_documents({'user_id': tier1_uid, 'type': 'mining_referral_reward'})
    all_pass.append(check('No new ledger rows when disabled', ledger_count_after, ledger_count_before))

    # ---------- STEP 9: Validation errors ----------
    print("\n" + "=" * 70)
    print("STEP 9: Admin API validation")
    print("=" * 70)
    r = requests.post(
        f'{API}/api/admin/settings/mining-commission-tiers',
        headers=admin_headers,
        json={'enabled': True, 'tiers': [{'tier': i, 'percent': 1} for i in range(1, 12)]}
    )
    all_pass.append(check('11 tiers → 400', r.status_code, 400))

    r = requests.post(
        f'{API}/api/admin/settings/mining-commission-tiers',
        headers=admin_headers,
        json={'enabled': True, 'tiers': [{'tier': 1, 'percent': 60}, {'tier': 2, 'percent': 50}]}
    )
    all_pass.append(check('Sum >100 → 400', r.status_code, 400))

    r = requests.post(
        f'{API}/api/admin/settings/mining-commission-tiers',
        headers=admin_headers,
        json={'enabled': True, 'tiers': [{'tier': 1, 'percent': -5}]}
    )
    all_pass.append(check('Negative % → 400', r.status_code, 400))

    r = requests.get(f'{API}/api/admin/settings/mining-commission-tiers')
    all_pass.append(check('No admin JWT → 401/403', r.status_code in (401, 403), True))

    # ---------- STEP 10: Cleanup ----------
    print("\n" + "=" * 70)
    print("CLEANUP")
    print("=" * 70)
    all_uids = users_to_cleanup + [collector_uid] if collector_uid not in users_to_cleanup else users_to_cleanup
    await db.users.delete_many({'uid': {'$in': all_uids}})
    await db.prc_ledger.delete_many({
        '$or': [
            {'user_id': {'$in': all_uids}},
            {'downline_uid': {'$in': all_uids}},
        ]
    })
    await db.transactions.delete_many({
        '$or': [
            {'user_id': {'$in': all_uids}},
            {'downline_uid': {'$in': all_uids}},
        ]
    })
    await db.notifications.delete_many({'user_uid': {'$in': all_uids}})
    await db.app_settings.delete_one({'key': 'mining_commission_tiers'})
    print(f"  {PASS} Cleanup done")

    # ---------- FINAL VERDICT ----------
    print("\n" + "=" * 70)
    total = len(all_pass)
    passed = sum(1 for p in all_pass if p)
    if passed == total:
        print(f"{PASS}  ALL {total}/{total} CHECKS PASSED  {PASS}")
    else:
        print(f"{FAIL} {passed}/{total} passed ({total - passed} failed)")
    print("=" * 70)

asyncio.run(main())
