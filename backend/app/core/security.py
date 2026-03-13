"""
PARAS REWARD - Security Utilities
=================================
JWT token handling, password hashing, and security utilities.

Usage:
    from app.core.security import create_token, verify_token, hash_password
"""

import jwt
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from passlib.context import CryptContext

from .config import settings


# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT token.
    
    Args:
        data: Payload data to encode
        expires_delta: Optional custom expiry time
    
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRY_HOURS)
    
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.JWT_SECRET, 
        algorithm=settings.JWT_ALGORITHM
    )
    
    return encoded_jwt


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify and decode a JWT token.
    
    Args:
        token: JWT token string
    
    Returns:
        Decoded payload or None if invalid
    """
    try:
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET, 
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def generate_pin_hash(pin: str, salt: str = "") -> str:
    """Generate a hash for user PIN."""
    combined = f"{pin}{salt}"
    return hashlib.sha256(combined.encode()).hexdigest()


def verify_pin(pin: str, pin_hash: str, salt: str = "") -> bool:
    """Verify user PIN against stored hash."""
    return generate_pin_hash(pin, salt) == pin_hash


def generate_otp() -> str:
    """Generate a 6-digit OTP."""
    import random
    return str(random.randint(100000, 999999))


def mask_mobile(mobile: str) -> str:
    """Mask mobile number for display: 98****1234"""
    if len(mobile) >= 10:
        return f"{mobile[:2]}****{mobile[-4:]}"
    return mobile


def mask_account(account: str) -> str:
    """Mask bank account for display: ****1234"""
    if len(account) >= 4:
        return f"****{account[-4:]}"
    return account
