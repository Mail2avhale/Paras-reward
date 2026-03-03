"""
Create 5-Level Referral Test Structure
--------------------------------------
Creates users with proper referral chain to test mining calculations
"""

import os
import uuid
import bcrypt
from datetime import datetime, timezone
from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

def create_test_referral_structure():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=" * 60)
    print("CREATING 5-LEVEL REFERRAL TEST STRUCTURE")
    print("=" * 60)
    
    # Generate unique prefix
    prefix = str(uuid.uuid4())[:4]
    
    # Create ROOT user (the one whose mining we'll check)
    root_uid = f"root_{prefix}"
    root_code = f"ROOT{prefix.upper()}"
    password_hash = bcrypt.hashpw('test123'.encode(), bcrypt.gensalt()).decode()
    
    root_user = {
        'uid': root_uid,
        'email': f'root_{prefix}@test.com',
        'password': password_hash,
        'login_pin': '123456',
        'name': 'Root Test User',
        'mobile': f'98{prefix}00000',
        'role': 'user',
        'subscription_plan': 'growth',  # PAID - 2x multiplier
        'kyc_status': 'verified',
        'prc_balance': 10000,
        'is_verified': True,
        'referral_code': root_code,
        'referred_by': None,
        'failed_login_attempts': 0,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    # Delete existing test users
    db.users.delete_many({'email': {'$regex': f'{prefix}@test.com'}})
    
    # Insert root user
    db.users.insert_one(root_user)
    print(f"\n✅ ROOT User: {root_user['email']} (uid: {root_uid})")
    print(f"   Referral Code: {root_code}")
    print(f"   Plan: growth (2x multiplier)")
    
    # Create Level 1 users (referred by ROOT) - 3 users
    level_1_users = []
    for i in range(3):
        l1_uid = f"l1_{prefix}_{i}"
        l1_code = f"L1{prefix.upper()}{i}"
        l1_user = {
            'uid': l1_uid,
            'email': f'l1_{prefix}_{i}@test.com',
            'password': password_hash,
            'login_pin': '123456',
            'name': f'Level 1 User {i}',
            'mobile': f'98{prefix}1000{i}',
            'role': 'user',
            'subscription_plan': 'startup' if i < 2 else 'explorer',  # 2 paid, 1 free
            'kyc_status': 'verified',
            'prc_balance': 5000,
            'is_verified': True,
            'referral_code': l1_code,
            'referred_by': root_code,  # Referred by ROOT
            'failed_login_attempts': 0,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        db.users.insert_one(l1_user)
        level_1_users.append(l1_user)
        plan_status = "PAID" if l1_user['subscription_plan'] in ['startup', 'growth', 'elite'] else "FREE"
        print(f"   L1-{i}: {l1_user['email']} [{plan_status}] -> referred by ROOT")
    
    # Create Level 2 users (referred by L1 users) - 2 per L1 = 6 users
    level_2_users = []
    for l1_idx, l1_user in enumerate(level_1_users):
        for i in range(2):
            l2_uid = f"l2_{prefix}_{l1_idx}_{i}"
            l2_code = f"L2{prefix.upper()}{l1_idx}{i}"
            l2_user = {
                'uid': l2_uid,
                'email': f'l2_{prefix}_{l1_idx}_{i}@test.com',
                'password': password_hash,
                'login_pin': '123456',
                'name': f'Level 2 User {l1_idx}-{i}',
                'mobile': f'98{prefix}2{l1_idx}0{i}',
                'role': 'user',
                'subscription_plan': 'startup',  # All paid
                'kyc_status': 'verified',
                'prc_balance': 3000,
                'is_verified': True,
                'referral_code': l2_code,
                'referred_by': l1_user['referral_code'],
                'failed_login_attempts': 0,
                'created_at': datetime.now(timezone.utc).isoformat()
            }
            db.users.insert_one(l2_user)
            level_2_users.append(l2_user)
            print(f"   L2-{l1_idx}-{i}: {l2_user['email']} [PAID] -> referred by L1-{l1_idx}")
    
    # Create Level 3 users (referred by L2 users) - 1 per L2 = 6 users
    level_3_users = []
    for l2_idx, l2_user in enumerate(level_2_users):
        l3_uid = f"l3_{prefix}_{l2_idx}"
        l3_code = f"L3{prefix.upper()}{l2_idx}"
        l3_user = {
            'uid': l3_uid,
            'email': f'l3_{prefix}_{l2_idx}@test.com',
            'password': password_hash,
            'login_pin': '123456',
            'name': f'Level 3 User {l2_idx}',
            'mobile': f'98{prefix}30{l2_idx}',
            'role': 'user',
            'subscription_plan': 'growth' if l2_idx < 3 else 'explorer',  # 3 paid, 3 free
            'kyc_status': 'verified',
            'prc_balance': 2000,
            'is_verified': True,
            'referral_code': l3_code,
            'referred_by': l2_user['referral_code'],
            'failed_login_attempts': 0,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        db.users.insert_one(l3_user)
        level_3_users.append(l3_user)
        plan_status = "PAID" if l3_user['subscription_plan'] in ['startup', 'growth', 'elite'] else "FREE"
        print(f"   L3-{l2_idx}: {l3_user['email']} [{plan_status}] -> referred by L2-{l2_idx}")
    
    # Create Level 4 users (referred by L3 users) - 1 per L3 = 6 users
    level_4_users = []
    for l3_idx, l3_user in enumerate(level_3_users):
        l4_uid = f"l4_{prefix}_{l3_idx}"
        l4_code = f"L4{prefix.upper()}{l3_idx}"
        l4_user = {
            'uid': l4_uid,
            'email': f'l4_{prefix}_{l3_idx}@test.com',
            'password': password_hash,
            'login_pin': '123456',
            'name': f'Level 4 User {l3_idx}',
            'mobile': f'98{prefix}40{l3_idx}',
            'role': 'user',
            'subscription_plan': 'startup',  # All paid
            'kyc_status': 'verified',
            'prc_balance': 1000,
            'is_verified': True,
            'referral_code': l4_code,
            'referred_by': l3_user['referral_code'],
            'failed_login_attempts': 0,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        db.users.insert_one(l4_user)
        level_4_users.append(l4_user)
        print(f"   L4-{l3_idx}: {l4_user['email']} [PAID] -> referred by L3-{l3_idx}")
    
    # Create Level 5 users (referred by L4 users) - 1 per L4 = 6 users
    level_5_users = []
    for l4_idx, l4_user in enumerate(level_4_users):
        l5_uid = f"l5_{prefix}_{l4_idx}"
        l5_code = f"L5{prefix.upper()}{l4_idx}"
        l5_user = {
            'uid': l5_uid,
            'email': f'l5_{prefix}_{l4_idx}@test.com',
            'password': password_hash,
            'login_pin': '123456',
            'name': f'Level 5 User {l4_idx}',
            'mobile': f'98{prefix}50{l4_idx}',
            'role': 'user',
            'subscription_plan': 'growth' if l4_idx < 4 else 'explorer',  # 4 paid, 2 free
            'kyc_status': 'verified',
            'prc_balance': 500,
            'is_verified': True,
            'referral_code': l5_code,
            'referred_by': l4_user['referral_code'],
            'failed_login_attempts': 0,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        db.users.insert_one(l5_user)
        level_5_users.append(l5_user)
        plan_status = "PAID" if l5_user['subscription_plan'] in ['startup', 'growth', 'elite'] else "FREE"
        print(f"   L5-{l4_idx}: {l5_user['email']} [{plan_status}] -> referred by L4-{l4_idx}")
    
    # Summary
    print("\n" + "=" * 60)
    print("REFERRAL STRUCTURE SUMMARY")
    print("=" * 60)
    print(f"ROOT: 1 user (growth plan)")
    print(f"L1: 3 users (2 paid, 1 free) -> should contribute to ROOT mining")
    print(f"L2: 6 users (6 paid) -> should contribute to ROOT mining")
    print(f"L3: 6 users (3 paid, 3 free) -> should contribute to ROOT mining")
    print(f"L4: 6 users (6 paid) -> should contribute to ROOT mining")
    print(f"L5: 6 users (4 paid, 2 free) -> should contribute to ROOT mining")
    print(f"\nTotal: 28 users")
    
    print("\n" + "=" * 60)
    print("TEST CREDENTIALS")
    print("=" * 60)
    print(f"Email: root_{prefix}@test.com")
    print(f"PIN: 123456")
    print(f"UID: {root_uid}")
    
    client.close()
    
    return root_uid, f"root_{prefix}@test.com"


if __name__ == "__main__":
    uid, email = create_test_referral_structure()
    print(f"\n✅ Test structure created! Root UID: {uid}")
