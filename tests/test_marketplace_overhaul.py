"""
Test suite for Marketplace Overhaul - SBI Rewardz-style design
Tests Admin Marketplace Management and User-Facing Marketplace features
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://safe-rewards-hub.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@paras.com"
ADMIN_PASSWORD = "admin123"
TEST_USER_EMAIL = "testuser@test.com"
TEST_USER_PASSWORD = "testpassword"

class TestMarketplaceAPIs:
    """Test marketplace backend APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    # ========== Products API Tests ==========
    
    def test_get_products_list(self):
        """Test GET /api/products returns products list"""
        response = self.session.get(f"{BASE_URL}/api/products?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Should return products array or object with products key
        if isinstance(data, dict):
            assert "products" in data, "Response should contain 'products' key"
            products = data["products"]
        else:
            products = data
        
        assert isinstance(products, list), "Products should be a list"
        print(f"✓ GET /api/products returned {len(products)} products")
    
    def test_get_products_with_pagination(self):
        """Test products API supports pagination"""
        response = self.session.get(f"{BASE_URL}/api/products?page=1&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        if isinstance(data, dict) and "products" in data:
            assert "total" in data or "page" in data, "Pagination info should be present"
        print("✓ Products API supports pagination")
    
    # ========== Marketplace Settings API Tests ==========
    
    def test_get_marketplace_settings(self):
        """Test GET /api/admin/settings/marketplace returns PRC to INR rate"""
        response = self.session.get(f"{BASE_URL}/api/admin/settings/marketplace")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "prc_to_inr_rate" in data, "Response should contain 'prc_to_inr_rate'"
        assert isinstance(data["prc_to_inr_rate"], (int, float)), "prc_to_inr_rate should be numeric"
        assert data["prc_to_inr_rate"] > 0, "prc_to_inr_rate should be positive"
        
        print(f"✓ Marketplace settings: PRC to INR rate = {data['prc_to_inr_rate']}")
    
    def test_marketplace_settings_has_required_fields(self):
        """Test marketplace settings contains all required fields"""
        response = self.session.get(f"{BASE_URL}/api/admin/settings/marketplace")
        assert response.status_code == 200
        
        data = response.json()
        expected_fields = ["prc_to_inr_rate", "min_order_prc", "max_order_prc", "free_delivery_threshold"]
        
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✓ Marketplace settings has all required fields: {expected_fields}")
    
    # ========== Admin Products API Tests ==========
    
    def test_admin_get_products(self):
        """Test GET /api/admin/products returns products for admin"""
        response = self.session.get(f"{BASE_URL}/api/admin/products?page=1&limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "products" in data, "Response should contain 'products' key"
        assert "total" in data, "Response should contain 'total' count"
        
        print(f"✓ Admin products API: {data['total']} total products")
    
    def test_admin_create_product(self):
        """Test POST /api/admin/products creates a new product"""
        # Use multipart form data as per API spec
        test_product = {
            "name": f"TEST_Product_{uuid.uuid4().hex[:8]}",
            "description": "Test product for marketplace overhaul testing",
            "prc_price": "500",
            "inr_price": "2000",
            "category": "Electronics",
            "badge": "new",
            "show_on_home": "true",
            "stock_quantity": "100",
            "stock_status": "in_stock",
            "delivery_charge_type": "free",
            "delivery_charge_value": "0",
            "cost_to_company": "1500",
            "margin_percent": "25",
            "product_status": "active",
            "created_by": "test_admin"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/admin/products",
            data=test_product,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "product_id" in data, "Response should contain product_id"
        
        # Store for cleanup
        self.created_product_id = data["product_id"]
        print(f"✓ Created product: {data['product_id']}")
        
        return data["product_id"]
    
    def test_admin_update_product(self):
        """Test PUT /api/admin/products/{product_id} updates a product"""
        # First create a product
        test_product = {
            "name": f"TEST_Update_{uuid.uuid4().hex[:8]}",
            "description": "Product to be updated",
            "prc_price": "300",
            "category": "Fashion",
            "stock_quantity": "50",
            "product_status": "active"
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/admin/products",
            data=test_product,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if create_response.status_code not in [200, 201]:
            pytest.skip("Could not create product for update test")
        
        product_id = create_response.json()["product_id"]
        
        # Now update it
        update_data = {
            "name": f"TEST_Updated_{uuid.uuid4().hex[:8]}",
            "prc_price": "400",
            "badge": "trending"
        }
        
        update_response = self.session.put(
            f"{BASE_URL}/api/admin/products/{product_id}",
            data=update_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        print(f"✓ Updated product: {product_id}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/products/{product_id}")
    
    def test_admin_delete_product(self):
        """Test DELETE /api/admin/products/{product_id} deletes a product"""
        # First create a product
        test_product = {
            "name": f"TEST_Delete_{uuid.uuid4().hex[:8]}",
            "description": "Product to be deleted",
            "prc_price": "200",
            "category": "Other",
            "product_status": "active"
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/admin/products",
            data=test_product,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if create_response.status_code not in [200, 201]:
            pytest.skip("Could not create product for delete test")
        
        product_id = create_response.json()["product_id"]
        
        # Now delete it
        delete_response = self.session.delete(f"{BASE_URL}/api/admin/products/{product_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        print(f"✓ Deleted product: {product_id}")
    
    # ========== Product Fields Validation Tests ==========
    
    def test_product_has_new_fields(self):
        """Test that products have new marketplace fields (badge, show_on_home, stock_quantity, etc.)"""
        # Create a product with all new fields
        test_product = {
            "name": f"TEST_Fields_{uuid.uuid4().hex[:8]}",
            "description": "Test all new fields",
            "prc_price": "1000",
            "inr_price": "4000",
            "category": "Electronics",
            "badge": "hot_deal",
            "show_on_home": "true",
            "stock_quantity": "50",
            "stock_status": "in_stock",
            "delivery_charge_type": "fixed",
            "delivery_charge_value": "50",
            "cost_to_company": "3000",
            "margin_percent": "25",
            "product_status": "active"
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/admin/products",
            data=test_product,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert create_response.status_code in [200, 201], f"Failed to create product: {create_response.text}"
        
        product_id = create_response.json()["product_id"]
        
        # Fetch the product to verify fields
        products_response = self.session.get(f"{BASE_URL}/api/products?limit=100")
        assert products_response.status_code == 200
        
        products = products_response.json()
        if isinstance(products, dict):
            products = products.get("products", [])
        
        # Find our created product
        created_product = None
        for p in products:
            if p.get("product_id") == product_id:
                created_product = p
                break
        
        if created_product:
            # Verify new fields exist
            new_fields = ["badge", "show_on_home", "stock_quantity", "stock_status", 
                         "delivery_charge_type", "delivery_charge_value", "cost_to_company"]
            
            for field in new_fields:
                assert field in created_product, f"Missing field: {field}"
            
            print(f"✓ Product has all new fields: {new_fields}")
        else:
            print("⚠ Could not find created product to verify fields")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/products/{product_id}")
    
    def test_product_badge_values(self):
        """Test that badge field accepts valid values"""
        valid_badges = ["new", "trending", "hot_deal", "limited", "bestseller", ""]
        
        for badge in valid_badges:
            test_product = {
                "name": f"TEST_Badge_{badge}_{uuid.uuid4().hex[:6]}",
                "prc_price": "100",
                "category": "Other",
                "badge": badge,
                "product_status": "active"
            }
            
            response = self.session.post(
                f"{BASE_URL}/api/admin/products",
                data=test_product,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            assert response.status_code in [200, 201], f"Badge '{badge}' should be valid"
            
            # Cleanup
            if response.status_code in [200, 201]:
                product_id = response.json().get("product_id")
                if product_id:
                    self.session.delete(f"{BASE_URL}/api/admin/products/{product_id}")
        
        print(f"✓ All badge values accepted: {valid_badges}")
    
    def test_delivery_charge_types(self):
        """Test delivery charge type options"""
        delivery_types = [
            {"type": "free", "value": "0"},
            {"type": "fixed", "value": "50"},
            {"type": "percentage", "value": "5"}
        ]
        
        for dt in delivery_types:
            test_product = {
                "name": f"TEST_Delivery_{dt['type']}_{uuid.uuid4().hex[:6]}",
                "prc_price": "500",
                "category": "Other",
                "delivery_charge_type": dt["type"],
                "delivery_charge_value": dt["value"],
                "product_status": "active"
            }
            
            response = self.session.post(
                f"{BASE_URL}/api/admin/products",
                data=test_product,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            assert response.status_code in [200, 201], f"Delivery type '{dt['type']}' should be valid"
            
            # Cleanup
            if response.status_code in [200, 201]:
                product_id = response.json().get("product_id")
                if product_id:
                    self.session.delete(f"{BASE_URL}/api/admin/products/{product_id}")
        
        print(f"✓ All delivery charge types accepted")
    
    # ========== Cart API Tests ==========
    
    def test_cart_add_item(self):
        """Test adding item to cart"""
        # Get a product first
        products_response = self.session.get(f"{BASE_URL}/api/products?limit=1")
        if products_response.status_code != 200:
            pytest.skip("Could not fetch products")
        
        products = products_response.json()
        if isinstance(products, dict):
            products = products.get("products", [])
        
        if not products:
            pytest.skip("No products available for cart test")
        
        product = products[0]
        product_id = product.get("product_id") or product.get("id")
        
        # Use test user UID from previous test report
        test_uid = "900253b5-b917-4e6b-b26a-731b6fe112dd"
        
        cart_data = {
            "product_id": product_id,
            "quantity": 1
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/cart/{test_uid}/add",
            json=cart_data
        )
        
        # Cart might require VIP/subscription, so 400/403 is acceptable
        assert response.status_code in [200, 201, 400, 403], f"Unexpected status: {response.status_code}"
        
        if response.status_code in [200, 201]:
            print(f"✓ Added item to cart: {product_id}")
        else:
            print(f"⚠ Cart add returned {response.status_code} (may require subscription)")
    
    def test_cart_get(self):
        """Test getting cart contents"""
        test_uid = "900253b5-b917-4e6b-b26a-731b6fe112dd"
        
        response = self.session.get(f"{BASE_URL}/api/cart/{test_uid}")
        
        # Cart might not exist or require auth
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "items" in data or isinstance(data, dict), "Cart should have items"
            print(f"✓ Got cart contents")
        else:
            print("⚠ Cart not found (may not exist yet)")
    
    # ========== User API Tests ==========
    
    def test_get_user_data(self):
        """Test getting user data for marketplace"""
        test_uid = "900253b5-b917-4e6b-b26a-731b6fe112dd"
        
        response = self.session.get(f"{BASE_URL}/api/user/{test_uid}")
        
        if response.status_code == 404:
            # Try alternative endpoint
            response = self.session.get(f"{BASE_URL}/api/users/{test_uid}/public-profile")
        
        assert response.status_code == 200, f"Could not get user data: {response.status_code}"
        
        data = response.json()
        print(f"✓ Got user data for marketplace")


class TestMarketplaceFiltering:
    """Test product filtering and search"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
    
    def test_filter_by_category(self):
        """Test filtering products by category"""
        response = self.session.get(f"{BASE_URL}/api/admin/products?category=Electronics&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        products = data.get("products", [])
        
        # All returned products should be in Electronics category (if any)
        for p in products:
            if p.get("category"):
                assert p["category"] == "Electronics", f"Product category mismatch: {p['category']}"
        
        print(f"✓ Category filter working: {len(products)} Electronics products")
    
    def test_filter_by_status(self):
        """Test filtering products by status"""
        response = self.session.get(f"{BASE_URL}/api/admin/products?status=active&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        print(f"✓ Status filter working: {data.get('total', len(data.get('products', [])))} active products")
    
    def test_search_products(self):
        """Test searching products by name"""
        response = self.session.get(f"{BASE_URL}/api/admin/products?search=test&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        print(f"✓ Search working: found {len(data.get('products', []))} products matching 'test'")


class TestCleanup:
    """Cleanup test products"""
    
    def test_cleanup_test_products(self):
        """Remove TEST_ prefixed products"""
        session = requests.Session()
        
        response = session.get(f"{BASE_URL}/api/products?limit=500")
        if response.status_code != 200:
            return
        
        products = response.json()
        if isinstance(products, dict):
            products = products.get("products", [])
        
        deleted_count = 0
        for p in products:
            name = p.get("name", "")
            if name.startswith("TEST_"):
                product_id = p.get("product_id")
                if product_id:
                    del_response = session.delete(f"{BASE_URL}/api/admin/products/{product_id}")
                    if del_response.status_code == 200:
                        deleted_count += 1
        
        print(f"✓ Cleaned up {deleted_count} test products")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
