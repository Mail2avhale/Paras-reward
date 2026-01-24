"""
Fraud Detection & Prevention System
====================================
Free, built-in fraud detection for Paras Reward Platform
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List, Tuple
import hashlib
import logging

# ========== FRAUD RISK LEVELS ==========
RISK_LOW = "low"
RISK_MEDIUM = "medium"
RISK_HIGH = "high"
RISK_BLOCKED = "blocked"

# ========== CONFIGURATION ==========
FRAUD_CONFIG = {
    # IP Rate Limiting
    "max_registrations_per_ip_per_day": 3,
    "max_registrations_per_ip_per_hour": 2,
    "max_login_attempts_per_ip_per_hour": 10,
    
    # Device Rate Limiting
    "max_accounts_per_device": 2,
    
    # Transaction Velocity
    "max_bill_payments_per_day": 10,
    "max_gift_vouchers_per_day": 5,
    "max_orders_per_day": 10,
    "max_total_redemption_per_day_inr": 50000,
    
    # Referral Limits
    "max_referrals_from_same_ip": 5,
    "min_referral_account_age_hours": 24,
    
    # Suspicious Patterns
    "suspicious_night_hours": (0, 5),  # 12 AM to 5 AM
    "new_account_high_value_threshold_inr": 5000,
    "new_account_age_days": 7,
}


class FraudDetector:
    """Fraud detection and prevention system"""
    
    def __init__(self, db):
        self.db = db
        self.config = FRAUD_CONFIG
    
    # ========== IP-BASED CHECKS ==========
    
    async def check_ip_registration_limit(self, ip_address: str) -> Tuple[bool, str]:
        """Check if IP has exceeded registration limits"""
        if not ip_address or ip_address in ['127.0.0.1', 'localhost', '::1']:
            return True, "localhost"
        
        now = datetime.now(timezone.utc)
        one_hour_ago = (now - timedelta(hours=1)).isoformat()
        one_day_ago = (now - timedelta(days=1)).isoformat()
        
        # Check hourly limit
        hourly_count = await self.db.users.count_documents({
            "registration_ip": ip_address,
            "created_at": {"$gte": one_hour_ago}
        })
        
        if hourly_count >= self.config["max_registrations_per_ip_per_hour"]:
            return False, f"Too many registrations from this network. Please try after 1 hour."
        
        # Check daily limit
        daily_count = await self.db.users.count_documents({
            "registration_ip": ip_address,
            "created_at": {"$gte": one_day_ago}
        })
        
        if daily_count >= self.config["max_registrations_per_ip_per_day"]:
            return False, f"Daily registration limit reached. Please try tomorrow."
        
        return True, "ok"
    
    async def check_ip_login_limit(self, ip_address: str) -> Tuple[bool, str]:
        """Check if IP has too many failed login attempts"""
        if not ip_address:
            return True, "ok"
        
        one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        
        failed_attempts = await self.db.login_attempts.count_documents({
            "ip_address": ip_address,
            "success": False,
            "timestamp": {"$gte": one_hour_ago}
        })
        
        if failed_attempts >= self.config["max_login_attempts_per_ip_per_hour"]:
            return False, "Too many login attempts. Please try after 1 hour."
        
        return True, "ok"
    
    # ========== DEVICE FINGERPRINT CHECKS ==========
    
    async def check_device_limit(self, device_fingerprint: str) -> Tuple[bool, str]:
        """Check if device has too many accounts"""
        if not device_fingerprint:
            return True, "ok"
        
        account_count = await self.db.users.count_documents({
            "device_fingerprint": device_fingerprint
        })
        
        if account_count >= self.config["max_accounts_per_device"]:
            return False, "Maximum accounts reached for this device."
        
        return True, "ok"
    
    async def get_device_accounts(self, device_fingerprint: str) -> List[Dict]:
        """Get all accounts associated with a device"""
        if not device_fingerprint:
            return []
        
        accounts = await self.db.users.find(
            {"device_fingerprint": device_fingerprint},
            {"_id": 0, "uid": 1, "email": 1, "name": 1, "created_at": 1}
        ).to_list(length=100)
        
        return accounts
    
    # ========== DUPLICATE DOCUMENT CHECKS ==========
    
    async def check_duplicate_aadhaar(self, aadhaar_number: str, exclude_uid: str = None) -> Tuple[bool, str]:
        """Check if Aadhaar is already registered"""
        if not aadhaar_number:
            return True, "ok"
        
        # Clean Aadhaar number
        clean_aadhaar = aadhaar_number.replace(" ", "").replace("-", "")
        
        query = {"aadhaar_number": {"$regex": f"^{clean_aadhaar}$", "$options": "i"}}
        if exclude_uid:
            query["uid"] = {"$ne": exclude_uid}
        
        existing = await self.db.users.find_one(query, {"_id": 0, "uid": 1})
        
        if existing:
            return False, "This Aadhaar number is already registered with another account."
        
        return True, "ok"
    
    async def check_duplicate_pan(self, pan_number: str, exclude_uid: str = None) -> Tuple[bool, str]:
        """Check if PAN is already registered"""
        if not pan_number:
            return True, "ok"
        
        query = {"pan_number": {"$regex": f"^{pan_number}$", "$options": "i"}}
        if exclude_uid:
            query["uid"] = {"$ne": exclude_uid}
        
        existing = await self.db.users.find_one(query, {"_id": 0, "uid": 1})
        
        if existing:
            return False, "This PAN number is already registered with another account."
        
        return True, "ok"
    
    async def check_duplicate_mobile(self, mobile: str, exclude_uid: str = None) -> Tuple[bool, str]:
        """Check if mobile is already registered"""
        if not mobile:
            return True, "ok"
        
        clean_mobile = mobile.replace(" ", "").replace("-", "")[-10:]
        
        query = {"$or": [
            {"mobile": {"$regex": f"{clean_mobile}$"}},
            {"phone": {"$regex": f"{clean_mobile}$"}}
        ]}
        if exclude_uid:
            query["uid"] = {"$ne": exclude_uid}
        
        existing = await self.db.users.find_one(query, {"_id": 0, "uid": 1})
        
        if existing:
            return False, "This mobile number is already registered."
        
        return True, "ok"
    
    async def check_duplicate_bank_account(self, account_number: str, ifsc: str, exclude_uid: str = None) -> Tuple[bool, str]:
        """Check if bank account is already registered"""
        if not account_number or not ifsc:
            return True, "ok"
        
        query = {
            "bank_account_number": account_number,
            "bank_ifsc": ifsc.upper()
        }
        if exclude_uid:
            query["uid"] = {"$ne": exclude_uid}
        
        existing = await self.db.users.find_one(query, {"_id": 0, "uid": 1})
        
        if existing:
            return False, "This bank account is already linked to another user."
        
        return True, "ok"
    
    # ========== VELOCITY CHECKS ==========
    
    async def check_transaction_velocity(self, user_id: str, transaction_type: str) -> Tuple[bool, str]:
        """Check if user has exceeded daily transaction limits"""
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        
        limits = {
            "bill_payment": ("bill_payment_requests", self.config["max_bill_payments_per_day"]),
            "gift_voucher": ("gift_voucher_requests", self.config["max_gift_vouchers_per_day"]),
            "order": ("orders", self.config["max_orders_per_day"]),
        }
        
        if transaction_type not in limits:
            return True, "ok"
        
        collection_name, max_count = limits[transaction_type]
        collection = self.db[collection_name]
        
        today_count = await collection.count_documents({
            "user_id": user_id,
            "created_at": {"$gte": today_start}
        })
        
        if today_count >= max_count:
            return False, f"Daily limit of {max_count} {transaction_type.replace('_', ' ')}s reached. Try tomorrow."
        
        return True, "ok"
    
    async def check_daily_redemption_value(self, user_id: str, new_amount_inr: float) -> Tuple[bool, str]:
        """Check if user has exceeded daily redemption value limit"""
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        
        # Sum today's bill payments
        bill_pipeline = [
            {"$match": {"user_id": user_id, "created_at": {"$gte": today_start}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount_inr"}}}
        ]
        bill_result = await self.db.bill_payment_requests.aggregate(bill_pipeline).to_list(1)
        bill_total = bill_result[0]["total"] if bill_result else 0
        
        # Sum today's gift vouchers
        voucher_pipeline = [
            {"$match": {"user_id": user_id, "created_at": {"$gte": today_start}}},
            {"$group": {"_id": None, "total": {"$sum": "$denomination"}}}
        ]
        voucher_result = await self.db.gift_voucher_requests.aggregate(voucher_pipeline).to_list(1)
        voucher_total = voucher_result[0]["total"] if voucher_result else 0
        
        total_today = bill_total + voucher_total + new_amount_inr
        max_limit = self.config["max_total_redemption_per_day_inr"]
        
        if total_today > max_limit:
            return False, f"Daily redemption limit of ₹{max_limit:,.0f} exceeded. Try tomorrow."
        
        return True, "ok"
    
    # ========== REFERRAL FRAUD CHECKS ==========
    
    async def check_referral_fraud(self, referrer_uid: str, new_user_ip: str, new_user_device: str) -> Tuple[bool, str, str]:
        """
        Check for referral fraud patterns
        Returns: (is_valid, message, risk_level)
        """
        risk_level = RISK_LOW
        
        # Get referrer info
        referrer = await self.db.users.find_one(
            {"uid": referrer_uid},
            {"_id": 0, "registration_ip": 1, "device_fingerprint": 1, "created_at": 1}
        )
        
        if not referrer:
            return False, "Invalid referral code.", RISK_BLOCKED
        
        # Check 1: Self-referral (same IP)
        if new_user_ip and referrer.get("registration_ip") == new_user_ip:
            risk_level = RISK_HIGH
            # Log but allow with warning
            await self._log_fraud_event(referrer_uid, "self_referral_ip", {
                "ip": new_user_ip
            })
        
        # Check 2: Self-referral (same device)
        if new_user_device and referrer.get("device_fingerprint") == new_user_device:
            return False, "Cannot refer from the same device.", RISK_BLOCKED
        
        # Check 3: Too many referrals from same IP
        if new_user_ip:
            same_ip_referrals = await self.db.users.count_documents({
                "referred_by": referrer_uid,
                "registration_ip": new_user_ip
            })
            
            if same_ip_referrals >= self.config["max_referrals_from_same_ip"]:
                return False, "Too many referrals from this network.", RISK_BLOCKED
        
        # Check 4: Referrer account too new
        if referrer.get("created_at"):
            try:
                referrer_created = datetime.fromisoformat(referrer["created_at"].replace('Z', '+00:00'))
                min_age = timedelta(hours=self.config["min_referral_account_age_hours"])
                
                if datetime.now(timezone.utc) - referrer_created < min_age:
                    return False, "Referrer account is too new. Please try a different referral code.", RISK_MEDIUM
            except:
                pass
        
        return True, "ok", risk_level
    
    async def detect_referral_rings(self, user_id: str, depth: int = 3) -> List[Dict]:
        """Detect circular referral patterns"""
        visited = set()
        rings = []
        
        async def trace_referrals(uid, path):
            if uid in visited:
                if uid in path:
                    # Found a ring
                    ring_start = path.index(uid)
                    rings.append(path[ring_start:])
                return
            
            visited.add(uid)
            path.append(uid)
            
            if len(path) > depth:
                return
            
            # Get users referred by this user
            referrals = await self.db.users.find(
                {"referred_by": uid},
                {"_id": 0, "uid": 1}
            ).to_list(100)
            
            for ref in referrals:
                await trace_referrals(ref["uid"], path.copy())
        
        await trace_referrals(user_id, [])
        return rings
    
    # ========== NEW ACCOUNT HIGH VALUE CHECK ==========
    
    async def check_new_account_high_value(self, user_id: str, amount_inr: float) -> Tuple[bool, str]:
        """Flag high-value transactions from new accounts"""
        user = await self.db.users.find_one(
            {"uid": user_id},
            {"_id": 0, "created_at": 1, "kyc_status": 1}
        )
        
        if not user:
            return False, "User not found"
        
        # Check account age
        try:
            created_at = datetime.fromisoformat(user["created_at"].replace('Z', '+00:00'))
            account_age = datetime.now(timezone.utc) - created_at
            
            is_new = account_age.days < self.config["new_account_age_days"]
            is_high_value = amount_inr >= self.config["new_account_high_value_threshold_inr"]
            is_kyc_verified = user.get("kyc_status") == "verified"
            
            if is_new and is_high_value and not is_kyc_verified:
                return False, f"High-value transactions require KYC verification for new accounts."
        except:
            pass
        
        return True, "ok"
    
    # ========== SUSPICIOUS TIME CHECK ==========
    
    def is_suspicious_time(self) -> bool:
        """Check if current time is in suspicious hours"""
        current_hour = datetime.now(timezone.utc).hour
        start, end = self.config["suspicious_night_hours"]
        return start <= current_hour <= end
    
    # ========== COMPREHENSIVE RISK ASSESSMENT ==========
    
    async def assess_registration_risk(
        self, 
        ip_address: str, 
        device_fingerprint: str,
        aadhaar: str,
        pan: str,
        mobile: str,
        referral_code: str = None
    ) -> Dict:
        """
        Comprehensive risk assessment for new registration
        Returns risk score and blocking reasons
        """
        risk_score = 0
        flags = []
        blocked = False
        block_reason = None
        
        # IP check
        ip_ok, ip_msg = await self.check_ip_registration_limit(ip_address)
        if not ip_ok:
            blocked = True
            block_reason = ip_msg
            flags.append(("ip_limit", ip_msg))
            risk_score += 50
        
        # Device check
        device_ok, device_msg = await self.check_device_limit(device_fingerprint)
        if not device_ok:
            blocked = True
            block_reason = device_msg
            flags.append(("device_limit", device_msg))
            risk_score += 50
        
        # Duplicate document checks
        aadhaar_ok, aadhaar_msg = await self.check_duplicate_aadhaar(aadhaar)
        if not aadhaar_ok:
            blocked = True
            block_reason = aadhaar_msg
            flags.append(("duplicate_aadhaar", aadhaar_msg))
            risk_score += 100
        
        pan_ok, pan_msg = await self.check_duplicate_pan(pan)
        if not pan_ok:
            blocked = True
            block_reason = pan_msg
            flags.append(("duplicate_pan", pan_msg))
            risk_score += 100
        
        mobile_ok, mobile_msg = await self.check_duplicate_mobile(mobile)
        if not mobile_ok:
            blocked = True
            block_reason = mobile_msg
            flags.append(("duplicate_mobile", mobile_msg))
            risk_score += 80
        
        # Referral fraud check
        if referral_code:
            ref_ok, ref_msg, ref_risk = await self.check_referral_fraud(
                referral_code, ip_address, device_fingerprint
            )
            if not ref_ok:
                blocked = True
                block_reason = ref_msg
            if ref_risk == RISK_HIGH:
                flags.append(("referral_suspicious", ref_msg))
                risk_score += 30
        
        # Suspicious time
        if self.is_suspicious_time():
            flags.append(("suspicious_time", "Registration during unusual hours"))
            risk_score += 10
        
        # Determine risk level
        if risk_score >= 100 or blocked:
            risk_level = RISK_BLOCKED if blocked else RISK_HIGH
        elif risk_score >= 50:
            risk_level = RISK_HIGH
        elif risk_score >= 20:
            risk_level = RISK_MEDIUM
        else:
            risk_level = RISK_LOW
        
        return {
            "allowed": not blocked,
            "block_reason": block_reason,
            "risk_level": risk_level,
            "risk_score": min(risk_score, 100),
            "flags": flags
        }
    
    async def assess_transaction_risk(
        self,
        user_id: str,
        transaction_type: str,
        amount_inr: float,
        ip_address: str = None
    ) -> Dict:
        """
        Comprehensive risk assessment for transactions
        """
        risk_score = 0
        flags = []
        blocked = False
        block_reason = None
        
        # Velocity check
        velocity_ok, velocity_msg = await self.check_transaction_velocity(user_id, transaction_type)
        if not velocity_ok:
            blocked = True
            block_reason = velocity_msg
            flags.append(("velocity_limit", velocity_msg))
            risk_score += 50
        
        # Daily redemption limit
        daily_ok, daily_msg = await self.check_daily_redemption_value(user_id, amount_inr)
        if not daily_ok:
            blocked = True
            block_reason = daily_msg
            flags.append(("daily_limit", daily_msg))
            risk_score += 50
        
        # New account high value
        new_ok, new_msg = await self.check_new_account_high_value(user_id, amount_inr)
        if not new_ok:
            blocked = True
            block_reason = new_msg
            flags.append(("new_account_high_value", new_msg))
            risk_score += 40
        
        # Suspicious time for high value
        if self.is_suspicious_time() and amount_inr >= 1000:
            flags.append(("suspicious_time_high_value", "High-value transaction during unusual hours"))
            risk_score += 20
        
        # Determine risk level
        if blocked:
            risk_level = RISK_BLOCKED
        elif risk_score >= 50:
            risk_level = RISK_HIGH
        elif risk_score >= 20:
            risk_level = RISK_MEDIUM
        else:
            risk_level = RISK_LOW
        
        return {
            "allowed": not blocked,
            "block_reason": block_reason,
            "risk_level": risk_level,
            "risk_score": min(risk_score, 100),
            "flags": flags
        }
    
    # ========== LOGGING ==========
    
    async def _log_fraud_event(self, user_id: str, event_type: str, details: Dict):
        """Log fraud-related events for analysis"""
        await self.db.fraud_logs.insert_one({
            "user_id": user_id,
            "event_type": event_type,
            "details": details,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "risk_level": RISK_HIGH
        })
    
    async def log_registration_attempt(self, ip: str, device: str, success: bool, reason: str = None):
        """Log registration attempts"""
        await self.db.registration_attempts.insert_one({
            "ip_address": ip,
            "device_fingerprint": device,
            "success": success,
            "reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    async def log_login_attempt(self, ip: str, identifier: str, success: bool):
        """Log login attempts"""
        await self.db.login_attempts.insert_one({
            "ip_address": ip,
            "identifier": identifier,
            "success": success,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })


# ========== HELPER FUNCTIONS ==========

def generate_device_fingerprint(user_agent: str, screen_res: str, timezone: str, language: str) -> str:
    """Generate a simple device fingerprint from browser info"""
    raw = f"{user_agent}|{screen_res}|{timezone}|{language}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def get_client_ip(request) -> str:
    """Extract real client IP from request headers"""
    # Check various headers for real IP (behind proxies/load balancers)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    return request.client.host if request.client else None
