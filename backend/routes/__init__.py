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
from .admin_finance import router as admin_finance_router
from .admin_users import router as admin_users_router
from .admin_fraud import router as admin_fraud_router
from .admin_reports import router as admin_reports_router
from .admin_accounting import router as admin_accounting_router
from .admin_orders import router as admin_orders_router
from .admin_settings import router as admin_settings_router
from .admin_withdrawals import router as admin_withdrawals_router
from .admin_dashboard import router as admin_dashboard_router
from .admin_products import router as admin_products_router
from .admin_misc import router as admin_misc_router
# from .mining import router as mining_router
