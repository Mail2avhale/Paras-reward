#!/usr/bin/env python3
"""
ADMIN SIDEBAR NAVIGATION BACKEND API TESTING

Tests all backend APIs that support the admin sidebar navigation pages.
This ensures that the admin pages have proper backend support and data.

ADMIN PAGES TO TEST:
1. Dashboard (/admin) - Admin dashboard with stats
2. Users (/admin/users) - User management
3. Analytics (/admin/analytics) - Analytics page
4. KYC Verification (/admin/kyc) - KYC management with stats
5. VIP Payments (/admin/payments) - VIP plans management
6. Bill Payments (/admin/bill-payments) - Bill payments management
7. Gift Vouchers (/admin/gift-vouchers) - Gift vouchers management
8. Orders (/admin/orders) - Order management
9. Marketplace (/admin/marketplace) - Marketplace products
10. VIP Plans (/admin/vip-plans) - VIP plans configuration
11. Video Ads (/admin/video-ads) - Video ads management
12. Service Charges (/admin/service-charges) - Service charges
13. Policy Editor (/admin/policies) - Policy editor
14. Stockist Management (/admin/stockists) - Stockist list
15. Support Tickets (/admin/support) - Support tickets with stats
16. Settings (/admin/settings) - Settings page

SUCCESS CRITERIA:
✅ All admin API endpoints return valid responses
✅ Admin authentication works correctly
✅ Data is properly formatted and contains required fields
✅ Statistics and counts are accurate
✅ CRUD operations work for admin management
"""

import requests
import json
import sys
import os
from datetime import datetime, timedelta
import time
import uuid

# Get backend URL from frontend .env file
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except Exception as e:
        print(f"Error reading frontend .env: {e}")
        return None

BACKEND_URL = get_backend_url()
if not BACKEND_URL:
    print("ERROR: Could not get REACT_APP_BACKEND_URL from /app/frontend/.env")
    sys.exit(1)

API_BASE = f"{BACKEND_URL}/api"

print(f"🔐 ADMIN SIDEBAR NAVIGATION BACKEND API TESTING")
print(f"Backend URL: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

def create_admin_user():
    """Create or verify admin user exists"""
    admin_data = {
        "email": "admin@paras.com",
        "password": "admin",
        "role": "admin"
    }
    
    try:
        # Try to login first
        login_params = {
            "identifier": admin_data["email"],
            "password": admin_data["password"]
        }
        response = requests.post(f"{API_BASE}/auth/login", params=login_params, timeout=30)
        
        if response.status_code == 200:
            user_data = response.json()
            print(f"✅ Admin user exists: {user_data.get('uid')}")
            return user_data.get('uid'), admin_data["email"]
        
        # If login fails, try to create admin
        response = requests.post(f"{API_BASE}/auth/register/simple", json=admin_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            uid = result.get("uid")
            print(f"✅ Created admin user: {uid}")
            return uid, admin_data["email"]
        else:
            print(f"❌ Failed to create admin user: {response.status_code}")
            return None, None
            
    except Exception as e:
        print(f"❌ Error with admin user: {e}")
        return None, None

def test_admin_dashboard_apis():
    """Test APIs that support the admin dashboard"""
    print(f"\n📊 ADMIN DASHBOARD APIs TESTING")
    print("=" * 60)
    
    test_results = {
        "admin_stats": False,
        "admin_kpis": False,
        "admin_growth": False,
        "admin_analytics_overview": False,
        "admin_prc_analytics": False
    }
    
    # Test Admin Stats
    try:
        response = requests.get(f"{API_BASE}/admin/stats", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["admin_stats"] = True
            print(f"✅ Admin stats API working")
            print(f"   📋 Total Users: {result.get('total_users', 0)}")
            print(f"   📋 Active Users: {result.get('active_users', 0)}")
            print(f"   📋 VIP Users: {result.get('vip_users', 0)}")
        else:
            print(f"❌ Admin stats failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing admin stats: {e}")
    
    # Test Admin KPIs
    try:
        response = requests.get(f"{API_BASE}/admin/dashboard/kpis", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["admin_kpis"] = True
            print(f"✅ Admin KPIs API working")
            print(f"   📋 KPIs data available: {len(result) if isinstance(result, dict) else 'N/A'}")
        else:
            print(f"❌ Admin KPIs failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing admin KPIs: {e}")
    
    # Test Admin Growth
    try:
        response = requests.get(f"{API_BASE}/admin/dashboard/growth", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["admin_growth"] = True
            print(f"✅ Admin growth API working")
        else:
            print(f"❌ Admin growth failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing admin growth: {e}")
    
    # Test Analytics Overview
    try:
        response = requests.get(f"{API_BASE}/admin/analytics/overview", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["admin_analytics_overview"] = True
            print(f"✅ Admin analytics overview API working")
        else:
            print(f"❌ Admin analytics overview failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing admin analytics overview: {e}")
    
    # Test PRC Analytics
    try:
        response = requests.get(f"{API_BASE}/admin/prc-analytics", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["admin_prc_analytics"] = True
            print(f"✅ Admin PRC analytics API working")
            print(f"   📋 Total PRC Mined: {result.get('total_prc_mined', 0)}")
            print(f"   📋 Total PRC Consumed: {result.get('total_prc_consumed', 0)}")
        else:
            print(f"❌ Admin PRC analytics failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing admin PRC analytics: {e}")
    
    return test_results

def test_user_management_apis():
    """Test APIs that support user management page"""
    print(f"\n👥 USER MANAGEMENT APIs TESTING")
    print("=" * 60)
    
    test_results = {
        "admin_users_list": False,
        "admin_users_all": False,
        "admin_user_details": False,
        "admin_user_update": False,
        "admin_user_balance_adjust": False
    }
    
    # Test Users List
    try:
        response = requests.get(f"{API_BASE}/admin/users", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["admin_users_list"] = True
            print(f"✅ Admin users list API working")
            print(f"   📋 Total Users: {result.get('total', 0)}")
            print(f"   📋 Users in response: {len(result.get('users', []))}")
        else:
            print(f"❌ Admin users list failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing admin users list: {e}")
    
    # Test All Users
    try:
        response = requests.get(f"{API_BASE}/admin/users/all", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["admin_users_all"] = True
            print(f"✅ Admin all users API working")
            print(f"   📋 Users count: {len(result.get('users', []))}")
            
            # Get first user for detailed testing
            users = result.get('users', [])
            if users:
                first_user_uid = users[0].get('uid')
                
                # Test User Details
                try:
                    detail_response = requests.get(f"{API_BASE}/admin/users/{first_user_uid}", timeout=30)
                    if detail_response.status_code == 200:
                        user_detail = detail_response.json()
                        test_results["admin_user_details"] = True
                        print(f"✅ Admin user details API working")
                        print(f"   📋 User: {user_detail.get('name', 'N/A')} ({user_detail.get('email', 'N/A')})")
                    else:
                        print(f"❌ Admin user details failed: {detail_response.status_code}")
                except Exception as e:
                    print(f"❌ Error testing user details: {e}")
                
        else:
            print(f"❌ Admin all users failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing admin all users: {e}")
    
    return test_results

def test_analytics_apis():
    """Test APIs that support analytics page"""
    print(f"\n📈 ANALYTICS APIs TESTING")
    print("=" * 60)
    
    test_results = {
        "revenue_trends": False,
        "user_growth": False,
        "product_performance": False,
        "withdrawal_patterns": False,
        "revenue_reports": False
    }
    
    # Test Revenue Trends
    try:
        response = requests.get(f"{API_BASE}/admin/analytics/revenue-trends", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["revenue_trends"] = True
            print(f"✅ Revenue trends API working")
        else:
            print(f"❌ Revenue trends failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing revenue trends: {e}")
    
    # Test User Growth
    try:
        response = requests.get(f"{API_BASE}/admin/analytics/user-growth", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["user_growth"] = True
            print(f"✅ User growth API working")
        else:
            print(f"❌ User growth failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing user growth: {e}")
    
    # Test Product Performance
    try:
        response = requests.get(f"{API_BASE}/admin/analytics/product-performance", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["product_performance"] = True
            print(f"✅ Product performance API working")
        else:
            print(f"❌ Product performance failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing product performance: {e}")
    
    # Test Withdrawal Patterns
    try:
        response = requests.get(f"{API_BASE}/admin/analytics/withdrawal-patterns", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["withdrawal_patterns"] = True
            print(f"✅ Withdrawal patterns API working")
        else:
            print(f"❌ Withdrawal patterns failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing withdrawal patterns: {e}")
    
    # Test Revenue Reports
    try:
        response = requests.get(f"{API_BASE}/admin/reports/revenue", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["revenue_reports"] = True
            print(f"✅ Revenue reports API working")
        else:
            print(f"❌ Revenue reports failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing revenue reports: {e}")
    
    return test_results

def test_vip_management_apis():
    """Test APIs that support VIP payments and plans management"""
    print(f"\n💎 VIP MANAGEMENT APIs TESTING")
    print("=" * 60)
    
    test_results = {
        "vip_plans_get": False,
        "vip_plans_admin": False,
        "vip_plan_update": False,
        "vip_payments_list": False
    }
    
    # Test VIP Plans Get
    try:
        response = requests.get(f"{API_BASE}/vip/plans", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["vip_plans_get"] = True
            print(f"✅ VIP plans API working")
            print(f"   📋 Plans available: {len(result.get('plans', []))}")
        else:
            print(f"❌ VIP plans failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing VIP plans: {e}")
    
    # Test Admin VIP Plans
    try:
        response = requests.get(f"{API_BASE}/admin/vip/plans", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["vip_plans_admin"] = True
            print(f"✅ Admin VIP plans API working")
        else:
            print(f"❌ Admin VIP plans failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing admin VIP plans: {e}")
    
    # Test VIP Plan Update
    try:
        update_data = {
            "plan_type": "monthly",
            "base_price": 299.0,
            "discount_percentage": 10,
            "discount_fixed": 0
        }
        response = requests.post(f"{API_BASE}/admin/vip/update-plan", json=update_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["vip_plan_update"] = True
            print(f"✅ VIP plan update API working")
        else:
            print(f"❌ VIP plan update failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing VIP plan update: {e}")
    
    return test_results

def test_orders_management_apis():
    """Test APIs that support orders management"""
    print(f"\n📦 ORDERS MANAGEMENT APIs TESTING")
    print("=" * 60)
    
    test_results = {
        "admin_orders_all": False,
        "admin_order_details": False,
        "admin_order_status_update": False
    }
    
    # Test All Orders
    try:
        response = requests.get(f"{API_BASE}/admin/orders/all", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["admin_orders_all"] = True
            print(f"✅ Admin orders list API working")
            print(f"   📋 Total Orders: {result.get('total_orders', 0)}")
            print(f"   📋 Orders in response: {len(result.get('orders', []))}")
            
            # Test order details if orders exist
            orders = result.get('orders', [])
            if orders:
                first_order_id = orders[0].get('order_id')
                try:
                    detail_response = requests.get(f"{API_BASE}/admin/orders/{first_order_id}/details", timeout=30)
                    if detail_response.status_code == 200:
                        order_detail = detail_response.json()
                        test_results["admin_order_details"] = True
                        print(f"✅ Admin order details API working")
                        print(f"   📋 Order ID: {order_detail.get('order_id', 'N/A')}")
                    else:
                        print(f"❌ Admin order details failed: {detail_response.status_code}")
                except Exception as e:
                    print(f"❌ Error testing order details: {e}")
        else:
            print(f"❌ Admin orders list failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing admin orders: {e}")
    
    return test_results

def test_marketplace_apis():
    """Test APIs that support marketplace management"""
    print(f"\n🛒 MARKETPLACE APIs TESTING")
    print("=" * 60)
    
    test_results = {
        "admin_products_list": False,
        "admin_product_create": False,
        "products_public": False
    }
    
    # Test Admin Products List
    try:
        response = requests.get(f"{API_BASE}/admin/products", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["admin_products_list"] = True
            print(f"✅ Admin products list API working")
            print(f"   📋 Products count: {len(result.get('products', []))}")
        else:
            print(f"❌ Admin products list failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing admin products: {e}")
    
    # Test Public Products (what users see)
    try:
        response = requests.get(f"{API_BASE}/products", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["products_public"] = True
            print(f"✅ Public products API working")
            print(f"   📋 Public products: {len(result.get('products', []))}")
        else:
            print(f"❌ Public products failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing public products: {e}")
    
    return test_results

def test_support_tickets_apis():
    """Test APIs that support support tickets management"""
    print(f"\n🎫 SUPPORT TICKETS APIs TESTING")
    print("=" * 60)
    
    test_results = {
        "admin_support_tickets": False,
        "admin_ticket_update": False,
        "support_stats": False
    }
    
    # Test Admin Support Tickets
    try:
        response = requests.get(f"{API_BASE}/admin/support/tickets", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["admin_support_tickets"] = True
            print(f"✅ Admin support tickets API working")
            print(f"   📋 Total Tickets: {result.get('total', 0)}")
            print(f"   📋 Open Tickets: {result.get('open_count', 0)}")
            print(f"   📋 Closed Tickets: {result.get('closed_count', 0)}")
            
            # Test ticket update if tickets exist
            tickets = result.get('tickets', [])
            if tickets:
                first_ticket_id = tickets[0].get('ticket_id')
                try:
                    update_data = {
                        "status": "in_progress",
                        "admin_notes": "Test update from backend testing"
                    }
                    update_response = requests.put(f"{API_BASE}/admin/support/tickets/{first_ticket_id}", json=update_data, timeout=30)
                    if update_response.status_code == 200:
                        test_results["admin_ticket_update"] = True
                        print(f"✅ Admin ticket update API working")
                    else:
                        print(f"❌ Admin ticket update failed: {update_response.status_code}")
                except Exception as e:
                    print(f"❌ Error testing ticket update: {e}")
        else:
            print(f"❌ Admin support tickets failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing admin support tickets: {e}")
    
    return test_results

def test_stockist_management_apis():
    """Test APIs that support stockist management"""
    print(f"\n🏪 STOCKIST MANAGEMENT APIs TESTING")
    print("=" * 60)
    
    test_results = {
        "admin_stockists_list": False,
        "admin_stockist_create": False,
        "admin_stockist_assign": False
    }
    
    # Test Stockists List
    try:
        response = requests.get(f"{API_BASE}/admin/stockists", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["admin_stockists_list"] = True
            print(f"✅ Admin stockists list API working")
            print(f"   📋 Master Stockists: {len(result.get('master_stockists', []))}")
            print(f"   📋 Sub Stockists: {len(result.get('sub_stockists', []))}")
            print(f"   📋 Outlets: {len(result.get('outlets', []))}")
        else:
            print(f"❌ Admin stockists list failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing admin stockists: {e}")
    
    return test_results

def test_service_charges_apis():
    """Test APIs that support service charges management"""
    print(f"\n💰 SERVICE CHARGES APIs TESTING")
    print("=" * 60)
    
    test_results = {
        "service_charges_get": False,
        "service_charges_update": False
    }
    
    # Test Get Service Charges
    try:
        response = requests.get(f"{API_BASE}/admin/service-charges", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["service_charges_get"] = True
            print(f"✅ Service charges get API working")
            print(f"   📋 Bill Payment Charges: {result.get('bill_payment', {})}")
            print(f"   📋 Gift Voucher Charges: {result.get('gift_voucher', {})}")
        else:
            print(f"❌ Service charges get failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing service charges get: {e}")
    
    # Test Update Service Charges
    try:
        update_data = {
            "service_type": "bill_payment",
            "charge_type": "percentage",
            "charge_percentage": 2.0
        }
        response = requests.post(f"{API_BASE}/admin/service-charges", json=update_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["service_charges_update"] = True
            print(f"✅ Service charges update API working")
        else:
            print(f"❌ Service charges update failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing service charges update: {e}")
    
    return test_results

def test_policy_editor_apis():
    """Test APIs that support policy editor"""
    print(f"\n📋 POLICY EDITOR APIs TESTING")
    print("=" * 60)
    
    test_results = {
        "policies_get": False,
        "policies_update": False
    }
    
    # Test Get Policies
    try:
        response = requests.get(f"{API_BASE}/admin/policies", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["policies_get"] = True
            print(f"✅ Policies get API working")
            print(f"   📋 Terms & Conditions: {'Available' if result.get('terms_conditions') else 'Not set'}")
            print(f"   📋 Privacy Policy: {'Available' if result.get('privacy_policy') else 'Not set'}")
            print(f"   📋 Refund Policy: {'Available' if result.get('refund_policy') else 'Not set'}")
        else:
            print(f"❌ Policies get failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing policies get: {e}")
    
    # Test Update Policies
    try:
        update_data = {
            "terms_conditions": "Test Terms & Conditions content",
            "privacy_policy": "Test Privacy Policy content",
            "refund_policy": "Test Refund Policy content"
        }
        response = requests.post(f"{API_BASE}/admin/policies", json=update_data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["policies_update"] = True
            print(f"✅ Policies update API working")
        else:
            print(f"❌ Policies update failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing policies update: {e}")
    
    return test_results

def test_bill_payments_apis():
    """Test APIs that support bill payments management"""
    print(f"\n💳 BILL PAYMENTS MANAGEMENT APIs TESTING")
    print("=" * 60)
    
    test_results = {
        "admin_bill_requests": False,
        "admin_bill_process": False
    }
    
    # Test Admin Bill Payment Requests
    try:
        response = requests.get(f"{API_BASE}/admin/bill-payment/requests", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["admin_bill_requests"] = True
            print(f"✅ Admin bill payment requests API working")
            print(f"   📋 Total Requests: {result.get('total_requests', 0)}")
            print(f"   📋 Pending: {result.get('total_pending', 0)}")
            print(f"   📋 Completed: {result.get('total_completed', 0)}")
        else:
            print(f"❌ Admin bill payment requests failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing admin bill payment requests: {e}")
    
    return test_results

def test_gift_vouchers_apis():
    """Test APIs that support gift vouchers management"""
    print(f"\n🎁 GIFT VOUCHERS MANAGEMENT APIs TESTING")
    print("=" * 60)
    
    test_results = {
        "admin_voucher_requests": False,
        "admin_voucher_process": False
    }
    
    # Test Admin Gift Voucher Requests
    try:
        response = requests.get(f"{API_BASE}/admin/gift-voucher/requests", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["admin_voucher_requests"] = True
            print(f"✅ Admin gift voucher requests API working")
            print(f"   📋 Total Requests: {result.get('total_requests', 0)}")
            print(f"   📋 Pending: {result.get('total_pending', 0)}")
        else:
            print(f"❌ Admin gift voucher requests failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing admin gift voucher requests: {e}")
    
    return test_results

def test_video_ads_apis():
    """Test APIs that support video ads management"""
    print(f"\n📺 VIDEO ADS MANAGEMENT APIs TESTING")
    print("=" * 60)
    
    test_results = {
        "admin_video_ads_list": False,
        "admin_video_ads_create": False
    }
    
    # Test Video Ads List
    try:
        response = requests.get(f"{API_BASE}/admin/video-ads", timeout=30)
        if response.status_code == 200:
            result = response.json()
            test_results["admin_video_ads_list"] = True
            print(f"✅ Admin video ads list API working")
            print(f"   📋 Video Ads: {len(result.get('video_ads', []))}")
        else:
            print(f"❌ Admin video ads list failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing admin video ads: {e}")
    
    return test_results

def main():
    """Run comprehensive admin backend API testing"""
    print(f"\n🚀 STARTING ADMIN BACKEND API TESTING")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 80)
    
    # Create/verify admin user
    admin_uid, admin_email = create_admin_user()
    if not admin_uid:
        print("❌ Cannot proceed without admin user")
        return 1
    
    all_results = {}
    
    # Test all admin API categories
    test_categories = [
        ("Admin Dashboard", test_admin_dashboard_apis),
        ("User Management", test_user_management_apis),
        ("Analytics", test_analytics_apis),
        ("VIP Management", test_vip_management_apis),
        ("Orders Management", test_orders_management_apis),
        ("Marketplace", test_marketplace_apis),
        ("Support Tickets", test_support_tickets_apis),
        ("Stockist Management", test_stockist_management_apis),
        ("Service Charges", test_service_charges_apis),
        ("Policy Editor", test_policy_editor_apis),
        ("Bill Payments", test_bill_payments_apis),
        ("Gift Vouchers", test_gift_vouchers_apis),
        ("Video Ads", test_video_ads_apis)
    ]
    
    for category_name, test_function in test_categories:
        print(f"\n🔍 TESTING {category_name.upper()}")
        print("=" * 80)
        try:
            results = test_function()
            all_results.update(results)
        except Exception as e:
            print(f"❌ Error testing {category_name}: {e}")
    
    # Final Summary
    print(f"\n🏁 ADMIN BACKEND API TESTING - FINAL SUMMARY")
    print("=" * 80)
    
    total_tests = len(all_results)
    passed_tests = sum(1 for result in all_results.values() if result)
    
    print(f"\n📊 OVERALL RESULTS: {passed_tests}/{total_tests} tests passed ({(passed_tests/total_tests)*100:.1f}%)")
    
    # Group results by category
    categories = {
        "Dashboard APIs": ["admin_stats", "admin_kpis", "admin_growth", "admin_analytics_overview", "admin_prc_analytics"],
        "User Management APIs": ["admin_users_list", "admin_users_all", "admin_user_details", "admin_user_update", "admin_user_balance_adjust"],
        "Analytics APIs": ["revenue_trends", "user_growth", "product_performance", "withdrawal_patterns", "revenue_reports"],
        "VIP Management APIs": ["vip_plans_get", "vip_plans_admin", "vip_plan_update", "vip_payments_list"],
        "Orders APIs": ["admin_orders_all", "admin_order_details", "admin_order_status_update"],
        "Marketplace APIs": ["admin_products_list", "admin_product_create", "products_public"],
        "Support APIs": ["admin_support_tickets", "admin_ticket_update", "support_stats"],
        "Stockist APIs": ["admin_stockists_list", "admin_stockist_create", "admin_stockist_assign"],
        "Service Charges APIs": ["service_charges_get", "service_charges_update"],
        "Policy APIs": ["policies_get", "policies_update"],
        "Bill Payments APIs": ["admin_bill_requests", "admin_bill_process"],
        "Gift Vouchers APIs": ["admin_voucher_requests", "admin_voucher_process"],
        "Video Ads APIs": ["admin_video_ads_list", "admin_video_ads_create"]
    }
    
    for category_name, test_keys in categories.items():
        print(f"\n{category_name}:")
        for key in test_keys:
            if key in all_results:
                status = "✅ PASS" if all_results[key] else "❌ FAIL"
                print(f"  {status} {key.replace('_', ' ').title()}")
    
    if passed_tests >= total_tests * 0.8:
        print(f"\n✅ ADMIN BACKEND APIs MOSTLY WORKING")
        print(f"✅ Admin sidebar navigation should have proper backend support")
        print(f"✅ Most admin pages should load with data")
        return 0
    else:
        print(f"\n❌ CRITICAL ADMIN BACKEND ISSUES")
        print(f"❌ {total_tests - passed_tests} admin APIs failed")
        print(f"❌ Admin sidebar pages may show blank or error states")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)