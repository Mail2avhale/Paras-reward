"""
PARAS REWARD - Single Leg Tree & Formula Verification Script
Verifies ALL users joined after March 1, 2026:
1. Single Leg Tree (tree_position order)
2. Network Size (BFS referral chain)
3. Redeem Unlock % (tier calculation)
4. referred_by chain integrity
"""
import asyncio
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "paras_reward")

# Tier table for unlock %
TIERS = [
    (2, 4), (4, 4), (8, 5), (16, 6), (32, 6), (64, 6),
    (128, 7), (256, 7), (512, 8), (1024, 9), (2048, 9),
    (4096, 9), (8192, 10)
]

def calculate_growth_level(network_size):
    if network_size < 1:
        return 0
    total = 0
    prev = 0
    for threshold, contribution in TIERS:
        bracket_size = threshold - prev
        if network_size >= threshold:
            total += contribution
        elif network_size > prev:
            total += (network_size - prev) / bracket_size * contribution
            break
        else:
            break
        prev = threshold
    return round(total, 2)


async def get_network_size_bfs(db, user_id, referral_code, max_depth=10):
    """BFS network size calculation - same as growth_economy.py"""
    or_conditions = [{"referred_by": user_id}]
    if referral_code:
        or_conditions.append({"referred_by": referral_code})
    
    direct_count = await db.users.count_documents({"$or": or_conditions})
    if direct_count == 0:
        return 0, []
    
    total = 0
    all_members = []
    current_level_ids = [user_id]
    current_level_codes = [referral_code] if referral_code else []
    visited = {user_id}
    
    for depth in range(max_depth):
        if not current_level_ids and not current_level_codes:
            break
        search_values = list(set(current_level_ids + current_level_codes))
        if not search_values:
            break
        
        next_level_users = await db.users.find(
            {"referred_by": {"$in": search_values}},
            {"_id": 0, "uid": 1, "referral_code": 1, "name": 1, "referred_by": 1, 
             "tree_position": 1, "subscription_plan": 1, "created_at": 1}
        ).to_list(length=10000)
        
        if not next_level_users:
            break
        
        new_users = [u for u in next_level_users if u["uid"] not in visited]
        if not new_users:
            break
        
        total += len(new_users)
        for u in new_users:
            visited.add(u["uid"])
            all_members.append({
                "uid": u["uid"],
                "name": u.get("name", "?"),
                "referred_by": u.get("referred_by", "?"),
                "tree_position": u.get("tree_position"),
                "plan": u.get("subscription_plan", "?"),
                "depth": depth + 1
            })
        
        current_level_ids = [u["uid"] for u in new_users]
        current_level_codes = [u.get("referral_code", "") for u in new_users if u.get("referral_code")]
    
    return total, all_members


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    march_1 = datetime(2026, 3, 1, tzinfo=timezone.utc).isoformat()
    
    # Get ALL users joined after March 1
    users = await db.users.find(
        {"created_at": {"$gte": march_1}},
        {"_id": 0, "uid": 1, "name": 1, "referral_code": 1, "referred_by": 1,
         "tree_position": 1, "subscription_plan": 1, "prc_balance": 1,
         "total_mined": 1, "total_redeemed": 1, "created_at": 1,
         "mining_active": 1, "mining_session_end": 1}
    ).sort("tree_position", 1).to_list(10000)
    
    print(f"\n{'='*80}")
    print(f"PARAS REWARD - SINGLE LEG TREE & FORMULA VERIFICATION")
    print(f"Users joined after March 1, 2026: {len(users)}")
    print(f"{'='*80}")
    
    # ===== 1. SINGLE LEG TREE VERIFICATION =====
    print(f"\n{'='*80}")
    print("1. SINGLE LEG TREE (tree_position order)")
    print(f"{'='*80}")
    
    tree_issues = []
    prev_pos = None
    users_without_tree_pos = []
    users_with_tree_pos = []
    
    for u in users:
        pos = u.get("tree_position")
        if pos is None:
            users_without_tree_pos.append(u)
        else:
            users_with_tree_pos.append(u)
    
    # Sort by tree_position
    users_with_tree_pos.sort(key=lambda x: x.get("tree_position", 0))
    
    print(f"\nUsers WITH tree_position: {len(users_with_tree_pos)}")
    print(f"Users WITHOUT tree_position: {len(users_without_tree_pos)}")
    
    if users_without_tree_pos:
        print(f"\n  WARNING: Users missing tree_position:")
        for u in users_without_tree_pos[:10]:
            print(f"    - {u.get('name','?')} (uid: {u['uid'][:12]}...) | Plan: {u.get('subscription_plan','?')}")
        if len(users_without_tree_pos) > 10:
            print(f"    ... and {len(users_without_tree_pos)-10} more")
    
    print(f"\n  Single Leg Tree Order (tree_position):")
    print(f"  {'Pos':<6} {'Name':<25} {'Plan':<12} {'Referred By':<15} {'Created':<12}")
    print(f"  {'-'*70}")
    
    for i, u in enumerate(users_with_tree_pos[:50]):
        pos = u.get("tree_position", "?")
        ref_by = str(u.get("referred_by", "—"))[:12]
        created = str(u.get("created_at", ""))[:10]
        plan = u.get("subscription_plan", "?")
        name = str(u.get("name", "?"))[:24]
        print(f"  {pos:<6} {name:<25} {plan:<12} {ref_by:<15} {created}")
        
        if prev_pos is not None and pos is not None:
            if pos <= prev_pos:
                tree_issues.append(f"Position {pos} <= previous {prev_pos} for {u.get('name','?')}")
        prev_pos = pos
    
    if len(users_with_tree_pos) > 50:
        print(f"  ... showing 50 of {len(users_with_tree_pos)}")
    
    if tree_issues:
        print(f"\n  TREE POSITION ISSUES: {len(tree_issues)}")
        for issue in tree_issues[:10]:
            print(f"    - {issue}")
    else:
        print(f"\n  Tree position order: VALID (monotonically increasing)")
    
    # ===== 2. REFERRED_BY CHAIN INTEGRITY =====
    print(f"\n{'='*80}")
    print("2. REFERRED_BY CHAIN INTEGRITY")
    print(f"{'='*80}")
    
    # Build lookup maps
    uid_map = {}
    code_map = {}
    all_users_full = await db.users.find(
        {},
        {"_id": 0, "uid": 1, "referral_code": 1, "name": 1}
    ).to_list(100000)
    
    for u in all_users_full:
        uid_map[u["uid"]] = u.get("name", "?")
        if u.get("referral_code"):
            code_map[u["referral_code"]] = u["uid"]
    
    chain_issues = []
    orphan_users = []
    chain_stats = {"has_referrer": 0, "no_referrer": 0, "invalid_referrer": 0}
    
    for u in users:
        ref_by = u.get("referred_by")
        if not ref_by:
            chain_stats["no_referrer"] += 1
            continue
        
        chain_stats["has_referrer"] += 1
        # Check if referred_by points to a valid user (by uid or referral_code)
        if ref_by in uid_map:
            pass  # Valid - refers to uid
        elif ref_by in code_map:
            pass  # Valid - refers to referral_code
        else:
            chain_stats["invalid_referrer"] += 1
            chain_issues.append(f"{u.get('name','?')} (uid:{u['uid'][:12]}) → referred_by='{ref_by}' NOT FOUND in DB")
            orphan_users.append(u)
    
    print(f"\n  Users with referrer: {chain_stats['has_referrer']}")
    print(f"  Users without referrer: {chain_stats['no_referrer']}")
    print(f"  Invalid/broken referrer links: {chain_stats['invalid_referrer']}")
    
    if chain_issues:
        print(f"\n  BROKEN REFERRAL CHAINS:")
        for issue in chain_issues[:10]:
            print(f"    - {issue}")
    else:
        print(f"\n  All referral chains: VALID")
    
    # ===== 3. NETWORK SIZE & UNLOCK % VERIFICATION =====
    print(f"\n{'='*80}")
    print("3. NETWORK SIZE & REDEEM UNLOCK % VERIFICATION")
    print(f"{'='*80}")
    
    # Check a sample of users with referrals
    users_with_referrals = []
    for u in users:
        ref_code = u.get("referral_code", "")
        or_cond = [{"referred_by": u["uid"]}]
        if ref_code:
            or_cond.append({"referred_by": ref_code})
        count = await db.users.count_documents({"$or": or_cond})
        if count > 0:
            users_with_referrals.append((u, count))
    
    print(f"\n  Users with 1+ referrals: {len(users_with_referrals)}")
    print(f"\n  {'Name':<25} {'Direct':<8} {'BFS Net':<10} {'Unlock%':<10} {'Plan':<10} {'Balance':<12}")
    print(f"  {'-'*75}")
    
    for u, direct_count in users_with_referrals[:30]:
        uid = u["uid"]
        ref_code = u.get("referral_code", "")
        bfs_size, members = await get_network_size_bfs(db, uid, ref_code)
        unlock_pct = calculate_growth_level(bfs_size)
        balance = u.get("prc_balance", 0)
        plan = u.get("subscription_plan", "?")
        name = str(u.get("name", "?"))[:24]
        
        print(f"  {name:<25} {direct_count:<8} {bfs_size:<10} {unlock_pct:<10.2f} {plan:<10} {balance:<12.2f}")
        
        # Show tree members
        if members:
            for m in members[:5]:
                depth_indent = "  " * m["depth"]
                print(f"    {depth_indent}L{m['depth']}: {m['name'][:20]} | Pos: {m.get('tree_position','?')} | Plan: {m['plan']}")
            if len(members) > 5:
                print(f"    ... +{len(members)-5} more members")
    
    # ===== 4. REDEEM LIMIT FORMULA VERIFICATION =====
    print(f"\n{'='*80}")
    print("4. REDEEM LIMIT FORMULA VERIFICATION (total_earned = total_mined - total_redeemed)")
    print(f"{'='*80}")
    
    limit_issues = []
    print(f"\n  {'Name':<20} {'Mined':<12} {'Redeemed':<12} {'Balance':<12} {'Earned':<12} {'Unlock%':<9} {'Limit':<12}")
    print(f"  {'-'*89}")
    
    for u in users[:40]:
        uid = u["uid"]
        name = str(u.get("name", "?"))[:19]
        total_mined = u.get("total_mined", 0) or 0
        total_redeemed = u.get("total_redeemed", 0) or 0
        balance = u.get("prc_balance", 0) or 0
        
        total_earned = total_mined - total_redeemed
        if total_earned < 0:
            limit_issues.append(f"{name}: total_earned NEGATIVE ({total_earned:.2f}) = mined({total_mined:.2f}) - redeemed({total_redeemed:.2f})")
            total_earned = 0
        
        ref_code = u.get("referral_code", "")
        bfs_size, _ = await get_network_size_bfs(db, uid, ref_code)
        unlock_pct = calculate_growth_level(bfs_size)
        redeem_limit = total_earned * (unlock_pct / 100)
        
        print(f"  {name:<20} {total_mined:<12.2f} {total_redeemed:<12.2f} {balance:<12.2f} {total_earned:<12.2f} {unlock_pct:<9.2f} {redeem_limit:<12.2f}")
    
    if limit_issues:
        print(f"\n  ISSUES FOUND ({len(limit_issues)}):")
        for issue in limit_issues:
            print(f"    - {issue}")
    else:
        print(f"\n  All redeem limits: VALID (no negative total_earned)")
    
    # ===== 5. SUMMARY =====
    print(f"\n{'='*80}")
    print("5. VERIFICATION SUMMARY")
    print(f"{'='*80}")
    print(f"  Total users (after March 1): {len(users)}")
    print(f"  With tree_position: {len(users_with_tree_pos)}")
    print(f"  Without tree_position: {len(users_without_tree_pos)}")
    print(f"  Tree position order: {'VALID' if not tree_issues else f'ISSUES ({len(tree_issues)})'}")
    print(f"  Referral chain integrity: {'VALID' if not chain_issues else f'BROKEN ({len(chain_issues)})'}")
    print(f"  Users with referrals: {len(users_with_referrals)}")
    print(f"  Redeem formula issues: {len(limit_issues)}")
    print(f"{'='*80}\n")
    
    client.close()

asyncio.run(main())
