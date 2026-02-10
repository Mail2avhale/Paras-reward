# Routes package
# This module contains all API route handlers organized by feature

from fastapi import APIRouter

# Import all routers here as they are created
from .auth import router as auth_router
from .referral import router as referral_router
from .users import router as users_router
from .wallet import router as wallet_router
from .admin import router as admin_router
from .admin_vip import router as admin_vip_router
from .admin_delivery import router as admin_delivery_router
from .admin_system import router as admin_system_router
# from .mining import router as mining_router
