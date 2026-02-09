# Routes package
# This module contains all API route handlers organized by feature

from fastapi import APIRouter

# Import all routers here as they are created
from .auth import router as auth_router
from .referral import router as referral_router
from .users import router as users_router
from .wallet import router as wallet_router
# from .mining import router as mining_router
# from .admin import router as admin_router
