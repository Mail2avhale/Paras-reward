"""
Authentication & Authorization Middleware
SECURITY: All protected endpoints must use these dependencies
"""
import os
import jwt
import logging
from datetime import datetime, timezone
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional

# JWT Configuration - Must match server.py JWT_SECRET_KEY
import secrets
JWT_SECRET = os.environ.get("JWT_SECRET_KEY", "paras-reward-secret-key-2024")
JWT_ALGORITHM = "HS256"

security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> dict:
    """
    Verify JWT token and return current user
    Use as: Depends(get_current_user)
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = credentials.credentials
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("uid") or payload.get("user_id") or payload.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        # Check token expiration
        exp = payload.get("exp")
        if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Token expired")
        
        return {
            "uid": user_id,
            "email": payload.get("email"),
            "role": payload.get("role", "user"),
            "is_admin": payload.get("is_admin", False) or payload.get("role") == "admin"
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        logging.warning(f"[AUTH] Invalid token: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_admin(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Verify user is an admin
    Use as: Depends(get_current_admin)
    """
    if not current_user.get("is_admin") and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return current_user


async def verify_user_access(
    requested_uid: str,
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Verify user can only access their own data (unless admin)
    """
    if current_user.get("is_admin") or current_user.get("role") == "admin":
        return current_user  # Admin can access any user
    
    if current_user.get("uid") != requested_uid:
        raise HTTPException(status_code=403, detail="Access denied. You can only access your own data.")
    
    return current_user


def create_access_token(user_data: dict, expires_hours: int = 24) -> str:
    """Create JWT access token"""
    from datetime import timedelta
    
    payload = {
        "uid": user_data.get("uid"),
        "email": user_data.get("email"),
        "role": user_data.get("role", "user"),
        "is_admin": user_data.get("is_admin", False),
        "exp": datetime.now(timezone.utc) + timedelta(hours=expires_hours)
    }
    
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
