"""
Auth Routes - All authentication-related API endpoints
Extracted from server.py for better code organization

Includes:
- Registration (simple & full)
- Login (PIN/Password)
- Auth type checking
- PIN set/reset
- Password reset
- Forgot PIN with OTP
- Biometric authentication (WebAuthn)
"""

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict
import logging
import secrets
import string
import uuid
import os

# Create router
router = APIRouter(prefix="/auth", tags=["Authentication"])

# Database reference - will be set from main server
db = None

# Helper function references - will be set during initialization
hash_password = None
verify_password = None
generate_reset_token = None
pwd_context = None
get_client_ip = None
fraud_detector = None
create_security_alert = None
check_login_rate_limit = None
check_login_rate_limit_db = None
record_login_attempt = None
record_login_attempt_db = None
create_access_token = None
create_refresh_token = None
check_ip_whitelist = None
log_admin_action = None
log_activity = None
create_social_notification = None
parse_user_agent = None
User = None  # User model

# JWT config
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 60

def set_db(database):
    """Set the database reference"""
    global db
    db = database

def set_helpers(helpers: dict):
    """Set helper function references"""
    global hash_password, verify_password, generate_reset_token, pwd_context
    global get_client_ip, fraud_detector, create_security_alert
    global check_login_rate_limit, check_login_rate_limit_db
    global record_login_attempt, record_login_attempt_db
    global create_access_token, create_refresh_token
    global check_ip_whitelist, log_admin_action, log_activity
    global create_social_notification, parse_user_agent, User
    global JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    
    hash_password = helpers.get('hash_password')
    verify_password = helpers.get('verify_password')
    generate_reset_token = helpers.get('generate_reset_token')
    pwd_context = helpers.get('pwd_context')
    get_client_ip = helpers.get('get_client_ip')
    fraud_detector = helpers.get('fraud_detector')
    create_security_alert = helpers.get('create_security_alert')
    check_login_rate_limit = helpers.get('check_login_rate_limit')
    check_login_rate_limit_db = helpers.get('check_login_rate_limit_db')
    record_login_attempt = helpers.get('record_login_attempt')
    record_login_attempt_db = helpers.get('record_login_attempt_db')
    create_access_token = helpers.get('create_access_token')
    create_refresh_token = helpers.get('create_refresh_token')
    check_ip_whitelist = helpers.get('check_ip_whitelist')
    log_admin_action = helpers.get('log_admin_action')
    log_activity = helpers.get('log_activity')
    create_social_notification = helpers.get('create_social_notification')
    parse_user_agent = helpers.get('parse_user_agent')
    User = helpers.get('User')
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES = helpers.get('JWT_ACCESS_TOKEN_EXPIRE_MINUTES', 60)


# ========== PYDANTIC MODELS ==========

class ForgotPinRequest(BaseModel):
    mobile: str

class VerifyOTPRequest(BaseModel):
    mobile: str
    otp: str

class ResetPinRequest(BaseModel):
    mobile: str
    new_pin: str
    reset_token: str


# ========== REGISTRATION ROUTES ==========

@router.post("/register/simple")
async def simple_register(request: Request):
    """Simplified registration - full name, mobile, email, password required"""
    # Check if registration is enabled
    settings = await db.settings.find_one({}, {"_id": 0, "registration_enabled": 1, "registration_message": 1})
    if settings and not settings.get("registration_enabled", True):
        message = settings.get("registration_message", "New user registrations are currently closed. Please check back later.")
        raise HTTPException(status_code=403, detail=message)
    
    data = await request.json()
    
    full_name = data.get("full_name", "").strip()
    mobile = data.get("mobile", "").strip()
    email = data.get("email")
    password = data.get("password")
    role = data.get("role", "user")
    referral_code = data.get("referral_code", "").strip()
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    
    if full_name and len(full_name) < 2:
        raise HTTPException(status_code=400, detail="Full name must be at least 2 characters")
    
    if mobile:
        mobile = mobile.replace(" ", "").replace("-", "")
        if not mobile.isdigit() or len(mobile) != 10:
            raise HTTPException(status_code=400, detail="Mobile number must be 10 digits")
        
        existing_mobile = await db.users.find_one({"mobile": mobile})
        if existing_mobile:
            raise HTTPException(status_code=400, detail="Mobile number already registered")
    
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    referrer = None
    if referral_code:
        referrer = await db.users.find_one({"referral_code": referral_code})
        if not referrer:
            raise HTTPException(status_code=400, detail="Invalid referral code")
    
    user_data = {
        "uid": str(uuid.uuid4()),
        "email": email,
        "mobile": mobile if mobile else None,
        "password_hash": hash_password(password),
        "role": role,
        "name": full_name if full_name else email.split("@")[0],
        "profile_complete": bool(full_name and mobile),
        "profile_picture": None,
        "prc_balance": 0,
        "total_mined": 0,
        "cashback_wallet_balance": 0,
        "profit_wallet_balance": 0,
        "membership_type": "free",
        "kyc_status": "not_submitted",
        "is_active": True,
        "is_banned": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "referred_by": referrer["uid"] if referrer else None,
        "referral_count": 0
    }
    
    user_data["referral_code"] = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
    
    await db.users.insert_one(user_data)
    
    if referrer:
        await db.users.update_one(
            {"uid": referrer["uid"]},
            {
                "$inc": {"referral_count": 1},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
    
    return {
        "message": "Registration successful!" if user_data["profile_complete"] else "Registration successful! Please complete your profile.",
        "uid": user_data["uid"],
        "profile_complete": user_data["profile_complete"],
        "referred_by": referrer["name"] if referrer else None
    }


@router.post("/register")
async def register_user(request: Request):
    """Enhanced user registration with fraud detection"""
    settings = await db.settings.find_one({}, {"_id": 0, "registration_enabled": 1, "registration_message": 1})
    if settings and not settings.get("registration_enabled", True):
        message = settings.get("registration_message", "New user registrations are currently closed. Please check back later.")
        raise HTTPException(status_code=403, detail=message)
    
    data = await request.json()
    
    client_ip = get_client_ip(request)
    device_fingerprint = data.get('device_fingerprint')
    
    # Fraud detection
    fraud_check = await fraud_detector.assess_registration_risk(
        ip_address=client_ip,
        device_fingerprint=device_fingerprint,
        aadhaar=data.get('aadhaar_number'),
        pan=data.get('pan_number'),
        mobile=data.get('mobile'),
        referral_code=data.get('referred_by') or data.get('referral_code')
    )
    
    await fraud_detector.log_registration_attempt(
        ip=client_ip,
        device=device_fingerprint,
        success=fraud_check["allowed"],
        reason=fraud_check.get("block_reason")
    )
    
    if not fraud_check["allowed"]:
        raise HTTPException(status_code=403, detail=fraud_check["block_reason"])
    
    if data.get('first_name') or data.get('last_name'):
        name_parts = []
        if data.get('first_name'):
            name_parts.append(data['first_name'])
        if data.get('middle_name'):
            name_parts.append(data['middle_name'])
        if data.get('last_name'):
            name_parts.append(data['last_name'])
        data['name'] = ' '.join(name_parts)
    
    # Check for duplicate email
    if data.get("email"):
        existing = await db.users.find_one({"email": data["email"]})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    if data.get('password'):
        data['password_hash'] = hash_password(data['password'])
        del data['password']
    
    data['registration_ip'] = client_ip
    data['device_fingerprint'] = device_fingerprint
    data['fraud_risk_score'] = fraud_check.get('risk_score', 0)
    data['fraud_risk_level'] = fraud_check.get('risk_level', 'low')
    
    user = User(**data)
    user_dict = user.model_dump()
    
    for field in ["created_at", "updated_at", "last_login"]:
        if user_dict.get(field):
            user_dict[field] = user_dict[field].isoformat()
    
    await db.users.insert_one(user_dict)
    
    # Notify referrer
    if user_dict.get("referred_by"):
        referrer_uid = user_dict["referred_by"]
        referrer = await db.users.find_one({"uid": referrer_uid}, {"_id": 0, "name": 1})
        new_user_name = user_dict.get("name", "Someone")
        
        await create_social_notification(
            user_uid=referrer_uid,
            notification_type="new_referral",
            title="🎉 New Referral Joined!",
            message=f"{new_user_name} just joined using your referral link! Help them get started.",
            from_uid=user.uid,
            from_name=new_user_name,
            icon="👋",
            action_url=f"/messages/{user.uid}"
        )
        
        await log_activity(
            user_id=referrer_uid,
            action_type="new_referral_joined",
            description=f"New referral: {new_user_name} joined your network",
            metadata={"new_user_uid": user.uid, "new_user_name": new_user_name}
        )
    
    return {
        "message": "Registration successful", 
        "uid": user.uid,
        "risk_level": fraud_check.get('risk_level', 'low')
    }


# ========== AUTH TYPE CHECK ==========

@router.get("/check-auth-type")
async def check_auth_type(identifier: str):
    """Check if user should use PIN or Password login"""
    normalized_identifier = identifier.lower().strip()
    
    user = await db.users.find_one({
        "$or": [
            {"email": {"$regex": f"^{normalized_identifier}$", "$options": "i"}},
            {"mobile": normalized_identifier},
            {"uid": normalized_identifier}
        ]
    }, {"_id": 0, "pin_migrated": 1, "email": 1})
    
    if not user:
        return {"auth_type": "pin", "user_exists": False}
    
    if user.get("pin_migrated", False):
        return {"auth_type": "pin", "user_exists": True}
    else:
        return {"auth_type": "password", "user_exists": True, "needs_migration": True}


# ========== PIN MANAGEMENT ==========

@router.post("/set-new-pin")
async def set_new_pin(request: Request):
    """Set new PIN for existing users (migration from password to PIN)"""
    try:
        body = await request.json()
        user_id = body.get('user_id')
        new_pin = body.get('new_pin')
        
        if not user_id or not new_pin:
            raise HTTPException(status_code=400, detail="User ID and new PIN are required")
        
        if not new_pin.isdigit() or len(new_pin) != 6:
            raise HTTPException(status_code=400, detail="PIN must be exactly 6 digits")
        
        if len(set(new_pin)) == 1:
            raise HTTPException(status_code=400, detail="PIN cannot be all same digits")
        
        sequential = ['012345', '123456', '234567', '345678', '456789', '567890', 
                      '987654', '876543', '765432', '654321', '543210']
        if new_pin in sequential:
            raise HTTPException(status_code=400, detail="PIN cannot be sequential numbers")
        
        user = await db.users.find_one({
            "$or": [
                {"uid": user_id},
                {"email": {"$regex": f"^{user_id}$", "$options": "i"}}
            ]
        })
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        hashed_pin = pwd_context.hash(new_pin)
        
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "password": hashed_pin,
                    "password_hash": hashed_pin,
                    "pin_migrated": True,
                    "pin_migrated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return {"success": True, "message": "PIN set successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========== LOGIN ==========

@router.post("/login")
async def login(
    request: Request,
    identifier: str,
    password: str,
    device_id: Optional[str] = None,
    ip_address: Optional[str] = None
):
    """User login with email/mobile and password"""
    real_ip = get_client_ip(request) or ip_address or "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    
    logging.info(f"[LOGIN DEBUG] Attempt for: {identifier}, IP: {real_ip}")
    
    # Fraud detection: IP login limit
    ip_ok, ip_msg = await fraud_detector.check_ip_login_limit(real_ip)
    if not ip_ok:
        logging.warning(f"[LOGIN DEBUG] IP BLOCKED for {identifier}: {ip_msg}")
        raise HTTPException(status_code=429, detail=ip_msg)
    
    # Rate limit check
    allowed, locked_seconds, attempts_left, lockout_message = check_login_rate_limit(identifier)
    logging.info(f"[LOGIN DEBUG] Rate limit check for {identifier}: allowed={allowed}, locked_seconds={locked_seconds}, attempts_left={attempts_left}")
    
    if not allowed:
        logging.warning(f"[LOGIN DEBUG] USER RATE LIMITED: {identifier}, message: {lockout_message}")
        raise HTTPException(status_code=429, detail=lockout_message)
    
    # Database lockout check
    db_allowed, db_locked_seconds, db_lockout_msg = await check_login_rate_limit_db(db, identifier)
    if not db_allowed:
        logging.warning(f"[LOGIN DEBUG] USER DB LOCKED: {identifier}, message: {db_lockout_msg}")
        raise HTTPException(status_code=429, detail=db_lockout_msg)
    
    normalized_identifier = identifier.lower() if '@' in identifier else identifier
    
    user = await db.users.find_one({
        "$or": [
            {"email": {"$regex": f"^{normalized_identifier}$", "$options": "i"}},
            {"mobile": identifier},
            {"uid": identifier}
        ]
    }, {"_id": 0})
    
    if not user:
        record_login_attempt(identifier, False)
        await record_login_attempt_db(db, identifier, False, real_ip)
        await create_security_alert(
            alert_type="failed_login",
            severity="low",
            title="Failed Login Attempt",
            message=f"Login attempt with non-existent user: {identifier}",
            details={"identifier": identifier, "reason": "user_not_found"},
            ip_address=real_ip,
            user_identifier=identifier
        )
        raise HTTPException(status_code=404, detail="User not registered. Please register to continue.")
    
    stored_password = user.get("password_hash") or user.get("password")
    if stored_password:
        if not verify_password(password, stored_password):
            record_login_attempt(identifier, False)
            await record_login_attempt_db(db, identifier, False, real_ip)
            alert_severity = "medium" if attempts_left <= 2 else "low"
            await create_security_alert(
                alert_type="failed_login",
                severity=alert_severity,
                title="Failed Password Attempt",
                message=f"Invalid password for user: {user.get('email', identifier)}. {attempts_left - 1} attempts remaining.",
                details={"identifier": identifier, "email": user.get('email'), "attempts_left": attempts_left - 1},
                ip_address=real_ip,
                user_identifier=identifier
            )
            if attempts_left <= 1:
                await create_security_alert(
                    alert_type="brute_force",
                    severity="critical",
                    title="🚨 Account Locked - 2 Hour Lockout",
                    message=f"Account {user.get('email', identifier)} has been locked for 2 hours due to 5 failed login attempts.",
                    details={"identifier": identifier, "email": user.get('email'), "lockout_hours": 2, "ip": real_ip},
                    ip_address=real_ip,
                    user_identifier=identifier
                )
            elif attempts_left <= 2:
                await create_security_alert(
                    alert_type="suspicious_login",
                    severity="high",
                    title="⚠️ Account Temporarily Locked",
                    message=f"Account {user.get('email', identifier)} temporarily locked (15 min) after 4 failed attempts.",
                    details={"identifier": identifier, "email": user.get('email'), "lockout_minutes": 15},
                    ip_address=real_ip,
                    user_identifier=identifier
                )
            raise HTTPException(status_code=401, detail=f"Wrong PIN. {attempts_left - 1} attempts remaining.")
    else:
        record_login_attempt(identifier, False)
        await record_login_attempt_db(db, identifier, False, real_ip)
        raise HTTPException(status_code=401, detail="PIN not set. Please contact Admin to reset your PIN.")
    
    if user.get("is_banned"):
        raise HTTPException(status_code=403, detail=f"Account suspended: {user.get('suspension_reason', 'Contact support')}")
    
    # Admin IP whitelist check
    if user.get("role") in ["admin", "sub_admin"]:
        ip_allowed = await check_ip_whitelist(real_ip, user["uid"])
        if not ip_allowed:
            await log_admin_action(
                admin_uid=user["uid"],
                action="login_blocked_ip",
                entity_type="security",
                details={"reason": "IP not whitelisted", "ip": real_ip},
                ip_address=real_ip,
                user_agent=user_agent
            )
            await create_security_alert(
                alert_type="ip_blocked",
                severity="high",
                title="🚫 Admin Login Blocked - IP Not Whitelisted",
                message=f"Admin {user.get('email')} attempted login from non-whitelisted IP: {real_ip}",
                details={"email": user.get('email'), "ip": real_ip, "uid": user.get('uid')},
                ip_address=real_ip,
                user_identifier=user.get('email')
            )
            raise HTTPException(status_code=403, detail="Access denied. IP not whitelisted for admin access.")
    
    # Record successful login
    record_login_attempt(identifier, True)
    await record_login_attempt_db(db, identifier, True, real_ip)
    
    # Save login history
    login_history_entry = {
        "user_id": user["uid"],
        "login_time": datetime.now(timezone.utc).isoformat(),
        "ip_address": real_ip,
        "device_id": device_id or "unknown",
        "user_agent": user_agent[:200] if user_agent else "unknown",
        "device_info": parse_user_agent(user_agent) if user_agent else {},
        "login_type": "pin",
        "success": True
    }
    await db.login_history.insert_one(login_history_entry)
    
    await db.users.update_one(
        {"uid": user["uid"]},
        {
            "$set": {
                "last_login": datetime.now(timezone.utc).isoformat(),
                "last_login_ip": real_ip,
                "last_login_device": device_id or "unknown"
            }
        }
    )
    
    # VIP expiry check
    vip_expiry_message = None
    if user.get("membership_type") == "vip":
        vip_expiry_str = user.get("vip_expiry")
        if vip_expiry_str:
            try:
                vip_expiry = datetime.fromisoformat(vip_expiry_str.replace('Z', '+00:00'))
                now = datetime.now(timezone.utc)
                if vip_expiry < now:
                    days_expired = (now - vip_expiry).days
                    vip_expiry_message = f"⚠️ Your VIP membership expired {days_expired} days ago! Please renew."
                    user["vip_expired"] = True
                    user["vip_days_expired"] = days_expired
                    user["vip_expiry_message"] = vip_expiry_message
            except:
                pass
    
    # Enforce PRC = 0 for free users
    if user.get("membership_type") != "vip" and user.get("prc_balance", 0) > 0:
        await db.users.update_one({"uid": user["uid"]}, {"$set": {"prc_balance": 0}})
        user["prc_balance"] = 0
    
    # Generate JWT tokens for admin
    token_id = str(uuid.uuid4())
    access_token = None
    refresh_token = None
    
    if user.get("role") in ["admin", "sub_admin"]:
        token_data = {
            "uid": user["uid"],
            "email": user.get("email"),
            "role": user.get("role"),
            "token_id": token_id
        }
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        
        session_data = {
            "session_id": str(uuid.uuid4()),
            "uid": user["uid"],
            "token_id": token_id,
            "is_active": True,
            "ip_address": real_ip,
            "user_agent": user_agent,
            "device_id": device_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_activity": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)).isoformat()
        }
        await db.admin_sessions.insert_one(session_data)
        
        await log_admin_action(
            admin_uid=user["uid"],
            action="login",
            entity_type="auth",
            details={"device_id": device_id, "identifier": identifier},
            ip_address=real_ip,
            user_agent=user_agent
        )
    
    update_data = {"last_login": datetime.now(timezone.utc).isoformat()}
    if device_id:
        update_data["device_id"] = device_id
    if ip_address:
        update_data["ip_address"] = ip_address
    
    await db.users.update_one(
        {"uid": user["uid"]},
        {"$set": update_data, "$inc": {"login_count": 1}}
    )
    
    await log_activity(
        user_id=user["uid"],
        action_type="login",
        description=f"User logged in from {real_ip}",
        metadata={"device_id": device_id, "identifier": identifier},
        ip_address=real_ip
    )
    
    # Convert datetime strings
    for field in ["created_at", "updated_at", "last_login", "membership_expiry"]:
        if user.get(field) and isinstance(user[field], str):
            try:
                user[field] = datetime.fromisoformat(user[field])
            except:
                pass
    
    if "password_hash" in user:
        del user["password_hash"]
    
    response_data = User(**user).model_dump()
    
    if not user.get("pin_migrated", False):
        response_data["needs_pin_migration"] = True
    
    if access_token:
        response_data["access_token"] = access_token
        response_data["refresh_token"] = refresh_token
        response_data["token_type"] = "bearer"
        response_data["expires_in"] = JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    
    return response_data


# ========== FORGOT PASSWORD ==========

@router.post("/forgot-password")
async def forgot_password(email: str):
    """Request password reset"""
    user = await db.users.find_one({"email": email})
    if not user:
        return {"message": "If the email exists, a reset link has been sent"}
    
    reset_token = generate_reset_token()
    reset_expiry = datetime.now(timezone.utc) + timedelta(hours=1)
    
    await db.users.update_one(
        {"email": email},
        {"$set": {"reset_token": reset_token, "reset_token_expiry": reset_expiry.isoformat()}}
    )
    
    return {"message": "Reset token generated", "reset_token": reset_token}


# ========== FORGOT PIN WITH OTP ==========

@router.post("/forgot-pin/check-mobile")
async def forgot_pin_check_mobile(request: ForgotPinRequest):
    """Check if mobile number exists and send OTP"""
    mobile = request.mobile.strip()
    
    if not mobile.startswith("91") and not mobile.startswith("+91"):
        mobile = "91" + mobile
    mobile = mobile.replace("+", "")
    
    user = await db.users.find_one({
        "$or": [
            {"mobile": mobile},
            {"mobile": mobile[-10:]},
            {"mobile_number": mobile},
            {"mobile_number": mobile[-10:]}
        ]
    })
    
    if not user:
        raise HTTPException(status_code=404, detail="Mobile number not registered")
    
    auth_key = os.environ.get("MSG91_AUTH_KEY", "")
    template_id = os.environ.get("MSG91_TEMPLATE_ID", "")
    
    if not auth_key:
        raise HTTPException(status_code=500, detail="MSG91 not configured")
    
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://control.msg91.com/api/v5/otp?template_id={template_id}&mobile={mobile}",
                headers={"authkey": auth_key, "Content-Type": "application/json"}
            )
            result = response.json()
            
            if result.get("type") == "error":
                raise HTTPException(status_code=400, detail=result.get("message", "Failed to send OTP"))
                
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"Failed to send OTP: {str(e)}")
    
    return {"success": True, "message": "OTP sent successfully", "mobile": mobile[-4:]}


@router.post("/forgot-pin/verify-otp")
async def forgot_pin_verify_otp(request: VerifyOTPRequest):
    """Verify OTP and generate reset token"""
    import httpx
    
    mobile = request.mobile.strip().replace("+", "")
    if not mobile.startswith("91"):
        mobile = "91" + mobile
    
    otp = request.otp.strip()
    if not otp or len(otp) < 4:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    auth_key = os.environ.get("MSG91_AUTH_KEY", "")
    
    if not auth_key:
        raise HTTPException(status_code=500, detail="MSG91 not configured")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://control.msg91.com/api/v5/otp/verify?mobile={mobile}&otp={otp}",
                headers={"authkey": auth_key}
            )
            result = response.json()
            
            if result.get("type") == "error" or result.get("message") != "OTP verified successfully":
                raise HTTPException(status_code=400, detail=result.get("message", "Invalid OTP"))
            
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"MSG91 API error: {str(e)}")
    
    user = await db.users.find_one({
        "$or": [
            {"mobile": mobile},
            {"mobile": mobile[-10:]},
            {"mobile_number": mobile},
            {"mobile_number": mobile[-10:]}
        ]
    })
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    reset_token = secrets.token_urlsafe(32)
    reset_expiry = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"pin_reset_token": reset_token, "pin_reset_expiry": reset_expiry.isoformat()}}
    )
    
    return {"success": True, "message": "OTP verified successfully", "reset_token": reset_token, "mobile": mobile[-4:]}


@router.post("/forgot-pin/reset")
async def forgot_pin_reset(request: ResetPinRequest):
    """Reset PIN after OTP verification"""
    mobile = request.mobile.strip().replace("+", "")
    if not mobile.startswith("91"):
        mobile = "91" + mobile
    
    new_pin = request.new_pin.strip()
    
    if not new_pin or len(new_pin) != 6 or not new_pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN must be 6 digits")
    
    if len(set(new_pin)) == 1:
        raise HTTPException(status_code=400, detail="PIN cannot be all same digits")
    
    sequential = ["012345", "123456", "234567", "345678", "456789", "567890", 
                  "987654", "876543", "765432", "654321", "543210"]
    if new_pin in sequential:
        raise HTTPException(status_code=400, detail="PIN cannot be sequential numbers")
    
    user = await db.users.find_one({
        "$or": [
            {"mobile": mobile},
            {"mobile": mobile[-10:]},
            {"mobile_number": mobile},
            {"mobile_number": mobile[-10:]}
        ],
        "pin_reset_token": request.reset_token
    })
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    expiry_str = user.get("pin_reset_expiry", "")
    if expiry_str:
        try:
            expiry = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > expiry:
                raise HTTPException(status_code=400, detail="Reset token expired")
        except:
            pass
    
    hashed_pin = hash_password(new_pin)
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password": hashed_pin, "pin_migrated": True},
            "$unset": {"pin_reset_token": "", "pin_reset_expiry": ""}
        }
    )
    
    await db.login_attempts.delete_many({
        "$or": [
            {"identifier": mobile},
            {"identifier": mobile[-10:]},
            {"identifier": user.get("email", "")}
        ]
    })
    
    return {"success": True, "message": "PIN reset successfully. Please login with your new PIN."}


# ========== EMAIL OTP FOR FORGOT PIN ==========

class ForgotPinEmailRequest(BaseModel):
    email: str

@router.post("/forgot-pin/send-email-otp")
async def forgot_pin_send_email_otp(request: ForgotPinEmailRequest):
    """Send OTP to user's email for PIN reset"""
    import random
    
    email = request.email.strip().lower()
    
    # Find user by email
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="Email not registered")
    
    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))
    otp_expiry = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    # Store OTP in database
    await db.email_otps.update_one(
        {"email": email},
        {
            "$set": {
                "email": email,
                "otp": otp,
                "purpose": "pin_reset",
                "expiry": otp_expiry.isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "verified": False
            }
        },
        upsert=True
    )
    
    # For now, store OTP in user document (in production, send via email service)
    await db.users.update_one(
        {"email": email},
        {
            "$set": {
                "email_otp": otp,
                "email_otp_expiry": otp_expiry.isoformat(),
                "email_otp_purpose": "pin_reset"
            }
        }
    )
    
    # Log for admin visibility (in production, this would be sent via email)
    print(f"[EMAIL OTP] User: {email}, OTP: {otp}, Expiry: 10 minutes")
    
    return {
        "success": True, 
        "message": "OTP sent to your email",
        "email_hint": f"{email[:3]}***{email.split('@')[0][-1]}@{email.split('@')[1]}" if '@' in email else email[:4] + "***"
    }


@router.post("/forgot-pin/verify-email-otp")
async def forgot_pin_verify_email_otp(request: Request):
    """Verify Email OTP and generate reset token"""
    data = await request.json()
    email = data.get("email", "").strip().lower()
    otp = data.get("otp", "").strip()
    
    if not email or not otp:
        raise HTTPException(status_code=400, detail="Email and OTP are required")
    
    # Find user and verify OTP
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="Email not registered")
    
    stored_otp = user.get("email_otp")
    expiry_str = user.get("email_otp_expiry", "")
    
    if not stored_otp:
        raise HTTPException(status_code=400, detail="No OTP found. Please request a new one.")
    
    # Check expiry
    if expiry_str:
        try:
            expiry = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > expiry:
                raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
        except:
            pass
    
    # Verify OTP
    if stored_otp != otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Generate reset token
    reset_token = str(uuid.uuid4())
    reset_expiry = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    # Store reset token and clear OTP
    await db.users.update_one(
        {"email": email},
        {
            "$set": {
                "pin_reset_token": reset_token,
                "pin_reset_expiry": reset_expiry.isoformat()
            },
            "$unset": {
                "email_otp": "",
                "email_otp_expiry": "",
                "email_otp_purpose": ""
            }
        }
    )
    
    return {
        "success": True,
        "message": "OTP verified successfully",
        "reset_token": reset_token
    }


@router.post("/forgot-pin/reset-by-email")
async def forgot_pin_reset_by_email(request: Request):
    """Reset PIN after email OTP verification"""
    data = await request.json()
    email = data.get("email", "").strip().lower()
    reset_token = data.get("reset_token", "")
    new_pin = data.get("new_pin", "").strip()
    
    if not email or not reset_token or not new_pin:
        raise HTTPException(status_code=400, detail="Email, reset token and new PIN are required")
    
    if len(new_pin) != 6 or not new_pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN must be 6 digits")
    
    if len(set(new_pin)) == 1:
        raise HTTPException(status_code=400, detail="PIN cannot be all same digits")
    
    # Find user with valid reset token
    user = await db.users.find_one({
        "email": email,
        "pin_reset_token": reset_token
    })
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Check token expiry
    expiry_str = user.get("pin_reset_expiry", "")
    if expiry_str:
        try:
            expiry = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > expiry:
                raise HTTPException(status_code=400, detail="Reset token expired. Please start again.")
        except:
            pass
    
    # Hash and save new PIN
    hashed_pin = hash_password(new_pin)
    
    await db.users.update_one(
        {"email": email},
        {
            "$set": {
                "password": hashed_pin,
                "pin_migrated": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$unset": {
                "pin_reset_token": "",
                "pin_reset_expiry": ""
            }
        }
    )
    
    # Clear any lockouts for this user
    await db.login_attempts.delete_many({"identifier": email})
    
    return {"success": True, "message": "PIN reset successfully. Please login with your new PIN."}


# ========== BIOMETRIC AUTHENTICATION ==========

@router.post("/biometric/register-options")
async def get_biometric_register_options(user_id: str):
    """Get WebAuthn registration options for biometric setup"""
    from webauthn import generate_registration_options
    from webauthn.helpers.structs import (
        PublicKeyCredentialDescriptor,
        AuthenticatorSelectionCriteria,
        UserVerificationRequirement,
        AuthenticatorAttachment,
        ResidentKeyRequirement
    )
    
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing_creds = await db.biometric_credentials.find({"user_id": user_id}).to_list(None)
    exclude_credentials = [
        PublicKeyCredentialDescriptor(id=bytes.fromhex(cred["credential_raw_id"]))
        for cred in existing_creds
    ]
    
    webauthn_rp_id = os.environ.get('WEBAUTHN_RP_ID', 'localhost')
    options = generate_registration_options(
        rp_id=webauthn_rp_id,
        rp_name="PARAS REWARD",
        user_id=user_id.encode('utf-8'),
        user_name=user.get("email", "user"),
        user_display_name=user.get("name", "User"),
        exclude_credentials=exclude_credentials,
        authenticator_selection=AuthenticatorSelectionCriteria(
            authenticator_attachment=AuthenticatorAttachment.PLATFORM,
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED
        ),
        timeout=60000
    )
    
    await db.webauthn_challenges.insert_one({
        "user_id": user_id,
        "challenge": options.challenge.hex(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    })
    
    return {
        "options": {
            "challenge": options.challenge.hex(),
            "rp": {"id": options.rp.id, "name": options.rp.name},
            "user": {
                "id": options.user.id.hex(),
                "name": options.user.name,
                "displayName": options.user.display_name
            },
            "pubKeyCredParams": [{"type": p.type, "alg": p.alg} for p in options.pub_key_cred_params],
            "timeout": options.timeout,
            "excludeCredentials": [{"id": c.id.hex(), "type": c.type} for c in options.exclude_credentials],
            "authenticatorSelection": {
                "authenticatorAttachment": options.authenticator_selection.authenticator_attachment,
                "residentKey": options.authenticator_selection.resident_key,
                "userVerification": options.authenticator_selection.user_verification
            },
            "attestation": options.attestation
        }
    }


@router.post("/biometric/register")
async def register_biometric_credential(user_id: str, device_name: str, credential_data: Dict):
    """Register a new biometric credential"""
    from webauthn import verify_registration_response
    from webauthn.helpers.structs import RegistrationCredential
    
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing_count = await db.biometric_credentials.count_documents({"user_id": user_id})
    if existing_count >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 devices allowed. Please remove an old device first.")
    
    challenge_doc = await db.webauthn_challenges.find_one({"user_id": user_id}, sort=[("created_at", -1)])
    
    if not challenge_doc:
        raise HTTPException(status_code=400, detail="No registration challenge found. Please restart registration.")
    
    expires_at = datetime.fromisoformat(challenge_doc["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Registration challenge expired. Please restart registration.")
    
    try:
        credential = RegistrationCredential(
            id=credential_data["id"],
            raw_id=bytes.fromhex(credential_data["rawId"]),
            response={
                "client_data_json": bytes.fromhex(credential_data["response"]["clientDataJSON"]),
                "attestation_object": bytes.fromhex(credential_data["response"]["attestationObject"]),
            },
            type=credential_data["type"]
        )
        
        webauthn_origin = os.environ.get('WEBAUTHN_ORIGIN', 'http://localhost:3000')
        webauthn_rp_id = os.environ.get('WEBAUTHN_RP_ID', 'localhost')
        
        verification = verify_registration_response(
            credential=credential,
            expected_challenge=bytes.fromhex(challenge_doc["challenge"]),
            expected_origin=webauthn_origin,
            expected_rp_id=webauthn_rp_id
        )
        
        biometric_cred = {
            "credential_id": str(uuid.uuid4()),
            "user_id": user_id,
            "device_name": device_name,
            "credential_public_key": verification.credential_public_key.hex(),
            "credential_raw_id": verification.credential_id.hex(),
            "counter": verification.sign_count,
            "transports": credential_data.get("transports", []),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_used_at": None
        }
        
        await db.biometric_credentials.insert_one(biometric_cred)
        await db.webauthn_challenges.delete_one({"_id": challenge_doc["_id"]})
        
        await log_activity(
            user_id=user_id,
            action_type="biometric_registered",
            description=f"Registered biometric credential on {device_name}",
            metadata={"device_name": device_name}
        )
        
        return {"message": "Biometric credential registered successfully", "credential_id": biometric_cred["credential_id"]}
        
    except Exception as e:
        logging.error(f"Biometric registration error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to register biometric: {str(e)}")


@router.post("/biometric/login-options")
async def get_biometric_login_options(email: str):
    """Get WebAuthn authentication options for biometric login"""
    from webauthn import generate_authentication_options
    from webauthn.helpers.structs import PublicKeyCredentialDescriptor
    
    user = await db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    credentials = await db.biometric_credentials.find({"user_id": user["uid"]}).to_list(None)
    if not credentials:
        raise HTTPException(status_code=404, detail="No biometric credentials registered for this user")
    
    allow_credentials = [
        PublicKeyCredentialDescriptor(id=bytes.fromhex(cred["credential_raw_id"]))
        for cred in credentials
    ]
    
    webauthn_rp_id = os.environ.get('WEBAUTHN_RP_ID', 'localhost')
    options = generate_authentication_options(
        rp_id=webauthn_rp_id,
        allow_credentials=allow_credentials,
        user_verification="preferred",
        timeout=60000
    )
    
    await db.webauthn_challenges.insert_one({
        "user_id": user["uid"],
        "challenge": options.challenge.hex(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    })
    
    return {
        "options": {
            "challenge": options.challenge.hex(),
            "timeout": options.timeout,
            "rpId": options.rp_id,
            "allowCredentials": [{"id": c.id.hex(), "type": c.type} for c in options.allow_credentials],
            "userVerification": options.user_verification
        }
    }


@router.post("/biometric/login")
async def biometric_login(email: str, credential_data: Dict):
    """Authenticate user with biometric"""
    from webauthn import verify_authentication_response
    from webauthn.helpers.structs import AuthenticationCredential
    
    user = await db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    challenge_doc = await db.webauthn_challenges.find_one({"user_id": user["uid"]}, sort=[("created_at", -1)])
    if not challenge_doc:
        raise HTTPException(status_code=400, detail="No authentication challenge found")
    
    credential_raw_id = credential_data["rawId"]
    stored_credential = await db.biometric_credentials.find_one({
        "user_id": user["uid"],
        "credential_raw_id": credential_raw_id
    })
    
    if not stored_credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    try:
        credential = AuthenticationCredential(
            id=credential_data["id"],
            raw_id=bytes.fromhex(credential_data["rawId"]),
            response={
                "client_data_json": bytes.fromhex(credential_data["response"]["clientDataJSON"]),
                "authenticator_data": bytes.fromhex(credential_data["response"]["authenticatorData"]),
                "signature": bytes.fromhex(credential_data["response"]["signature"]),
                "user_handle": bytes.fromhex(credential_data["response"].get("userHandle", "")) if credential_data["response"].get("userHandle") else None
            },
            type=credential_data["type"]
        )
        
        webauthn_origin = os.environ.get('WEBAUTHN_ORIGIN', 'http://localhost:3000')
        webauthn_rp_id = os.environ.get('WEBAUTHN_RP_ID', 'localhost')
        
        verification = verify_authentication_response(
            credential=credential,
            expected_challenge=bytes.fromhex(challenge_doc["challenge"]),
            expected_origin=webauthn_origin,
            expected_rp_id=webauthn_rp_id,
            credential_public_key=bytes.fromhex(stored_credential["credential_public_key"]),
            credential_current_sign_count=stored_credential["counter"]
        )
        
        await db.biometric_credentials.update_one(
            {"credential_id": stored_credential["credential_id"]},
            {"$set": {"counter": verification.new_sign_count, "last_used_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        await db.users.update_one(
            {"uid": user["uid"]},
            {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}, "$inc": {"login_count": 1}}
        )
        
        await db.webauthn_challenges.delete_one({"_id": challenge_doc["_id"]})
        
        await log_activity(
            user_id=user["uid"],
            action_type="biometric_login",
            description=f"Logged in with biometric on {stored_credential['device_name']}",
            metadata={"device_name": stored_credential["device_name"]}
        )
        
        user.pop("password_hash", None)
        user.pop("reset_token", None)
        
        return User(**user)
        
    except Exception as e:
        logging.error(f"Biometric authentication error: {str(e)}")
        raise HTTPException(status_code=401, detail="Biometric authentication failed")


@router.get("/biometric/credentials/{user_id}")
async def get_user_biometric_credentials(user_id: str):
    """Get list of registered biometric credentials for a user"""
    credentials = await db.biometric_credentials.find({"user_id": user_id}).to_list(None)
    
    for cred in credentials:
        cred.pop("_id", None)
        cred.pop("credential_public_key", None)
    
    return {"credentials": credentials, "count": len(credentials), "max_devices": 5}


@router.delete("/biometric/credentials/{credential_id}")
async def delete_biometric_credential(credential_id: str, user_id: str):
    """Delete a biometric credential"""
    result = await db.biometric_credentials.delete_one({"credential_id": credential_id, "user_id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    await log_activity(
        user_id=user_id,
        action_type="biometric_removed",
        description="Removed biometric credential",
        metadata={"credential_id": credential_id}
    )
    
    return {"message": "Biometric credential deleted successfully"}


# ========== PASSWORD RESET ==========

@router.post("/reset-password-request")
async def reset_password_request(email: str):
    """Request password reset"""
    user = await db.users.find_one({"email": email})
    if not user:
        return {"message": "If the email exists, a reset link has been sent"}
    
    reset_token = generate_reset_token()
    reset_expiry = datetime.now(timezone.utc) + timedelta(hours=1)
    
    await db.users.update_one(
        {"email": email},
        {"$set": {"reset_token": reset_token, "reset_token_expiry": reset_expiry.isoformat()}}
    )
    
    return {
        "message": "Password reset token generated",
        "reset_token": reset_token,
        "note": "In production, this would be sent via email"
    }


@router.post("/reset-password")
async def reset_password(reset_token: str, new_password: str):
    """Reset password using token"""
    user = await db.users.find_one({"reset_token": reset_token})
    
    if not user:
        raise HTTPException(status_code=404, detail="Invalid reset token")
    
    if user.get("reset_token_expiry"):
        expiry = datetime.fromisoformat(user["reset_token_expiry"])
        if datetime.now(timezone.utc) > expiry:
            raise HTTPException(status_code=400, detail="Reset token expired")
    
    await db.users.update_one(
        {"uid": user["uid"]},
        {"$set": {"password_hash": hash_password(new_password), "reset_token": None, "reset_token_expiry": None}}
    )
    
    return {"message": "Password reset successful"}


@router.post("/change-password")
async def change_password(uid: str, old_password: str, new_password: str):
    """Change password for logged in user"""
    user = await db.users.find_one({"uid": uid})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("password_hash"):
        if not verify_password(old_password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    await db.users.update_one({"uid": uid}, {"$set": {"password_hash": hash_password(new_password)}})
    
    return {"message": "Password changed successfully"}


# ========== USER DATA ==========

@router.get("/user/{uid}")
async def get_auth_user(uid: str):
    """Get user details"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    if isinstance(user.get('last_login'), str):
        user['last_login'] = datetime.fromisoformat(user['last_login'])
    if user.get('membership_expiry') and isinstance(user['membership_expiry'], str):
        user['membership_expiry'] = datetime.fromisoformat(user['membership_expiry'])
    
    return User(**user)



# ========== SESSION MANAGEMENT ==========

# Reference to verify_token - will be set during initialization
verify_token = None

def set_verify_token(func):
    global verify_token
    verify_token = func


@router.post("/refresh-token")
async def refresh_access_token(refresh_token: str):
    """Refresh access token using refresh token"""
    payload = verify_token(refresh_token, token_type="refresh")
    
    uid = payload.get("uid")
    user = await db.users.find_one({"uid": uid}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    token_id = str(uuid.uuid4())
    token_data = {
        "uid": user["uid"],
        "email": user.get("email"),
        "role": user.get("role"),
        "token_id": token_id
    }
    new_access_token = create_access_token(token_data)
    
    if user.get("role") in ["admin", "sub_admin"]:
        await db.admin_sessions.update_one(
            {"uid": uid, "is_active": True},
            {"$set": {
                "token_id": token_id,
                "last_activity": datetime.now(timezone.utc).isoformat(),
                "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)).isoformat()
            }}
        )
    
    return {
        "access_token": new_access_token,
        "token_type": "bearer",
        "expires_in": JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }


@router.post("/logout")
async def logout(request: Request):
    """Logout and invalidate session"""
    auth_header = request.headers.get("authorization", "")
    if not auth_header or not auth_header.startswith("Bearer "):
        return {"message": "Already logged out"}
    
    token = auth_header.replace("Bearer ", "")
    
    try:
        payload = verify_token(token)
        uid = payload.get("uid")
        token_id = payload.get("token_id")
        
        await db.admin_sessions.update_one(
            {"uid": uid, "token_id": token_id},
            {"$set": {"is_active": False, "logged_out_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        real_ip = request.client.host if request.client else "unknown"
        if log_admin_action:
            await log_admin_action(
                admin_uid=uid,
                action="logout",
                entity_type="auth",
                ip_address=real_ip,
                user_agent=request.headers.get("user-agent", "unknown")
            )
    except:
        pass
    
    return {"message": "Logged out successfully"}


@router.post("/logout-all-sessions")
async def logout_all_sessions(uid: str, admin_uid: str):
    """Logout from all sessions (admin only)"""
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.admin_sessions.update_many(
        {"uid": uid, "is_active": True},
        {"$set": {"is_active": False, "logged_out_at": datetime.now(timezone.utc).isoformat(), "logout_reason": "admin_forced"}}
    )
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_uid,
            action="force_logout_all",
            entity_type="security",
            entity_id=uid,
            details={"sessions_terminated": result.modified_count}
        )
    
    return {"message": f"Logged out {result.modified_count} sessions"}


# ========== PASSWORD RECOVERY ==========

@router.post("/password-recovery/verify")
async def verify_password_recovery(request: Request):
    """Verify password recovery token"""
    data = await request.json()
    token = data.get("token")
    
    if not token:
        raise HTTPException(status_code=400, detail="Token is required")
    
    user = await db.users.find_one({"reset_token": token})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    if user.get("reset_token_expiry"):
        try:
            expiry = datetime.fromisoformat(user["reset_token_expiry"].replace('Z', '+00:00'))
            if datetime.now(timezone.utc) > expiry:
                raise HTTPException(status_code=400, detail="Reset token has expired")
        except ValueError:
            pass
    
    return {"valid": True, "email": user.get("email", "")[:3] + "***"}


@router.post("/password-recovery/reset")
async def reset_password_recovery(request: Request):
    """Reset password using recovery token"""
    data = await request.json()
    token = data.get("token")
    new_password = data.get("new_password")
    
    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Token and new password are required")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    user = await db.users.find_one({"reset_token": token})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    if user.get("reset_token_expiry"):
        try:
            expiry = datetime.fromisoformat(user["reset_token_expiry"].replace('Z', '+00:00'))
            if datetime.now(timezone.utc) > expiry:
                raise HTTPException(status_code=400, detail="Reset token has expired")
        except ValueError:
            pass
    
    hashed_password = hash_password(new_password)
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password_hash": hashed_password, "password": hashed_password},
            "$unset": {"reset_token": "", "reset_token_expiry": ""}
        }
    )
    
    return {"success": True, "message": "Password reset successfully"}