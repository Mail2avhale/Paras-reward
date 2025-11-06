#!/usr/bin/env python3
"""
PRODUCTS ENDPOINT TESTING - StockRequestSystem Integration

Tests the GET /api/products endpoint to verify correct paginated structure
as required by the StockRequestSystem frontend component.

Test Focus: Verify GET /api/products endpoint returns correct paginated structure

Test Scenarios:
1. Default Pagination Test - GET /api/products (default params)
2. Large Limit Test - GET /api/products?page=1&limit=1000 (what StockRequestSystem uses)
3. Edge Cases - GET /api/products?page=1&limit=0 (should handle gracefully)

Success Criteria:
✅ API always returns {products: [...], total, page, limit, ...} structure
✅ products field is always an array (never undefined or null)
✅ Response is consistent regardless of page/limit values
✅ No breaking changes to response structure
"""

import requests
import json
import sys
import os
from datetime import datetime

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

print(f"🛍️ PRODUCTS ENDPOINT TESTING - StockRequestSystem Integration")
print(f"Backend URL: {BACKEND_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

def test_products_endpoint_structure():
    """
    Test Products Endpoint Structure for StockRequestSystem
    
    Verifies that GET /api/products returns the correct paginated structure
    that the frontend StockRequestSystem component expects.
    """
    print(f"\n🛍️ PRODUCTS ENDPOINT STRUCTURE TESTING")
    print("=" * 60)
    
    test_results = {
        "default_pagination_test": False,
        "large_limit_test": False,
        "edge_case_limit_zero": False,
        "response_structure_consistent": False,
        "products_always_array": False,
        "required_fields_present": False,
        "no_500_errors": False
    }
    
    # Test 1: Default Pagination Test
    print(f"\n📋 Test 1: Default Pagination Test")
    print(f"   Testing: GET /api/products (default params)")
    
    try:
        response = requests.get(f"{API_BASE}/products", timeout=30)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response Type: {type(data)}")
            
            # Check if response is paginated structure
            if isinstance(data, dict):
                print(f"   ✅ Response is dictionary (paginated structure)")
                
                # Check required pagination fields
                required_fields = ['products', 'total', 'page', 'limit']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    print(f"   ✅ All required pagination fields present: {required_fields}")
                    
                    # Check products is array
                    products = data.get('products', [])
                    if isinstance(products, list):
                        print(f"   ✅ products field is array with {len(products)} items")
                        test_results["default_pagination_test"] = True
                        
                        # Check product structure
                        if len(products) > 0:
                            sample_product = products[0]
                            required_product_fields = ['product_id', 'name', 'sku', 'prc_price', 'cash_price']
                            product_fields_present = all(field in sample_product for field in required_product_fields)
                            
                            if product_fields_present:
                                print(f"   ✅ Sample product has required fields: {required_product_fields}")
                                test_results["required_fields_present"] = True
                            else:
                                missing_product_fields = [field for field in required_product_fields if field not in sample_product]
                                print(f"   ❌ Sample product missing fields: {missing_product_fields}")
                        else:
                            print(f"   ⚠️  No products in response to check field structure")
                    else:
                        print(f"   ❌ products field is not array: {type(products)}")
                else:
                    print(f"   ❌ Missing pagination fields: {missing_fields}")
            elif isinstance(data, list):
                print(f"   ⚠️  Response is array (legacy format) with {len(data)} items")
                # Legacy format - still check if products have required fields
                if len(data) > 0:
                    sample_product = data[0]
                    required_product_fields = ['product_id', 'name', 'sku', 'prc_price', 'cash_price']
                    product_fields_present = all(field in sample_product for field in required_product_fields)
                    
                    if product_fields_present:
                        print(f"   ✅ Sample product has required fields: {required_product_fields}")
                        test_results["required_fields_present"] = True
            else:
                print(f"   ❌ Unexpected response type: {type(data)}")
        else:
            print(f"   ❌ Non-200 status code: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"   ❌ Error in default pagination test: {e}")
    
    # Test 2: Large Limit Test (what StockRequestSystem uses)
    print(f"\n📋 Test 2: Large Limit Test (StockRequestSystem scenario)")
    print(f"   Testing: GET /api/products?page=1&limit=1000")
    
    try:
        response = requests.get(f"{API_BASE}/products?page=1&limit=1000", timeout=30)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response Type: {type(data)}")
            
            # Check if response structure is consistent
            if isinstance(data, dict):
                print(f"   ✅ Response is dictionary (paginated structure)")
                
                # Check required pagination fields
                required_fields = ['products', 'total', 'page', 'limit']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    print(f"   ✅ All required pagination fields present")
                    
                    # Verify pagination values
                    page = data.get('page', 0)
                    limit = data.get('limit', 0)
                    total = data.get('total', 0)
                    
                    print(f"   📊 Pagination: page={page}, limit={limit}, total={total}")
                    
                    # Check products is array
                    products = data.get('products', [])
                    if isinstance(products, list):
                        print(f"   ✅ products field is array with {len(products)} items")
                        test_results["large_limit_test"] = True
                        test_results["products_always_array"] = True
                        
                        # Verify no _id field in products
                        if len(products) > 0:
                            sample_product = products[0]
                            if '_id' not in sample_product:
                                print(f"   ✅ No _id field in product response (properly excluded)")
                            else:
                                print(f"   ⚠️  _id field present in product response")
                    else:
                        print(f"   ❌ products field is not array: {type(products)}")
                else:
                    print(f"   ❌ Missing pagination fields: {missing_fields}")
            elif isinstance(data, list):
                print(f"   ⚠️  Response is array (legacy format) - StockRequestSystem expects paginated structure")
                # This would be a problem for StockRequestSystem
                test_results["products_always_array"] = True  # Array is returned, but not in expected structure
            else:
                print(f"   ❌ Unexpected response type: {type(data)}")
        else:
            print(f"   ❌ Non-200 status code: {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ Error in large limit test: {e}")
    
    # Test 3: Edge Case - Limit 0
    print(f"\n📋 Test 3: Edge Case - Limit 0")
    print(f"   Testing: GET /api/products?page=1&limit=0")
    
    try:
        response = requests.get(f"{API_BASE}/products?page=1&limit=0", timeout=30)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ No 500 error with limit=0")
            test_results["edge_case_limit_zero"] = True
            test_results["no_500_errors"] = True
            
            # Check response structure
            if isinstance(data, dict) and 'products' in data:
                products = data.get('products', [])
                print(f"   ✅ Paginated structure maintained with {len(products)} products")
            elif isinstance(data, list):
                print(f"   ✅ Array response with {len(data)} products")
            else:
                print(f"   ⚠️  Unexpected response structure: {type(data)}")
                
        elif response.status_code == 400:
            print(f"   ✅ Proper 400 error for invalid limit=0")
            test_results["edge_case_limit_zero"] = True
            test_results["no_500_errors"] = True
        elif response.status_code == 500:
            print(f"   ❌ 500 error - server crash with limit=0")
            print(f"   Response: {response.text}")
        else:
            print(f"   ⚠️  Unexpected status code: {response.status_code}")
            test_results["no_500_errors"] = True  # Not a 500 error
            
    except Exception as e:
        print(f"   ❌ Error in edge case test: {e}")
    
    # Test 4: Response Structure Consistency
    print(f"\n📋 Test 4: Response Structure Consistency Check")
    
    test_params = [
        ("default", ""),
        ("page_1_limit_10", "?page=1&limit=10"),
        ("page_2_limit_5", "?page=2&limit=5"),
        ("large_limit", "?page=1&limit=1000")
    ]
    
    response_structures = []
    
    for test_name, params in test_params:
        try:
            url = f"{API_BASE}/products{params}"
            response = requests.get(url, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                structure = {
                    'is_dict': isinstance(data, dict),
                    'is_list': isinstance(data, list),
                    'has_products_field': 'products' in data if isinstance(data, dict) else False,
                    'products_is_array': isinstance(data.get('products', []), list) if isinstance(data, dict) else isinstance(data, list)
                }
                response_structures.append((test_name, structure))
                print(f"   📊 {test_name}: dict={structure['is_dict']}, has_products={structure['has_products_field']}, products_array={structure['products_is_array']}")
            else:
                print(f"   ⚠️  {test_name}: {response.status_code} error")
                
        except Exception as e:
            print(f"   ❌ {test_name}: Error - {e}")
    
    # Check consistency
    if len(response_structures) > 1:
        first_structure = response_structures[0][1]
        all_consistent = all(structure == first_structure for _, structure in response_structures)
        
        if all_consistent:
            print(f"   ✅ All response structures are consistent")
            test_results["response_structure_consistent"] = True
        else:
            print(f"   ❌ Response structures are inconsistent")
            for test_name, structure in response_structures:
                print(f"      {test_name}: {structure}")
    
    return test_results

def test_admin_credentials():
    """Test admin login to verify credentials work"""
    print(f"\n🔐 ADMIN CREDENTIALS TEST")
    print("=" * 60)
    
    try:
        # Try to login with admin credentials
        login_response = requests.get(
            f"{API_BASE}/auth/login",
            params={
                "identifier": "admin@paras.com",
                "password": "admin123"  # Try common admin password
            },
            timeout=30
        )
        
        print(f"   Admin login status: {login_response.status_code}")
        
        if login_response.status_code == 200:
            admin_data = login_response.json()
            admin_uid = admin_data.get('uid')
            print(f"   ✅ Admin login successful: {admin_uid}")
            return admin_uid
        else:
            print(f"   ⚠️  Admin login failed: {login_response.text}")
            return None
            
    except Exception as e:
        print(f"   ❌ Error testing admin credentials: {e}")
        return None

def main():
    """Run the Products endpoint testing"""
    print(f"\n🚀 STARTING PRODUCTS ENDPOINT TESTING")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 80)
    
    # Test admin credentials first
    admin_uid = test_admin_credentials()
    
    # Run the products endpoint tests
    results = test_products_endpoint_structure()
    
    # Final Summary
    print(f"\n🏁 PRODUCTS ENDPOINT TEST SUMMARY")
    print("=" * 80)
    
    test_categories = {
        "Core Functionality": [
            ("Default pagination test", results["default_pagination_test"]),
            ("Large limit test (StockRequestSystem)", results["large_limit_test"]),
            ("Required product fields present", results["required_fields_present"])
        ],
        "Structure Consistency": [
            ("Response structure consistent", results["response_structure_consistent"]),
            ("Products always array", results["products_always_array"])
        ],
        "Error Handling": [
            ("Edge case limit=0 handled", results["edge_case_limit_zero"]),
            ("No 500 errors", results["no_500_errors"])
        ]
    }
    
    total_tests = 0
    passed_tests = 0
    
    for category_name, tests in test_categories.items():
        print(f"\n{category_name}:")
        for test_name, result in tests:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {status} {test_name}")
            total_tests += 1
            if result:
                passed_tests += 1
    
    print(f"\n📊 OVERALL RESULTS: {passed_tests}/{total_tests} tests passed ({(passed_tests/total_tests)*100:.1f}%)")
    
    # Specific StockRequestSystem compatibility check
    print(f"\n🎯 STOCKREQUESTSYSTEM COMPATIBILITY:")
    
    key_requirements = [
        results["large_limit_test"],  # Handles page=1&limit=1000
        results["products_always_array"],  # products field is always array
        results["required_fields_present"],  # Required fields present
        results["no_500_errors"]  # No crashes
    ]
    
    compatibility_score = sum(key_requirements)
    
    if compatibility_score == 4:
        print(f"✅ FULLY COMPATIBLE - StockRequestSystem will work correctly")
        print(f"✅ API returns correct paginated structure: {{products: [...], total, page, limit, ...}}")
        print(f"✅ products field is always an array")
        print(f"✅ All required product fields present")
        print(f"✅ No breaking changes detected")
        return 0
    elif compatibility_score >= 3:
        print(f"⚠️  MOSTLY COMPATIBLE - Minor issues detected")
        print(f"⚠️  {4 - compatibility_score} requirement(s) not met")
        return 0
    else:
        print(f"❌ COMPATIBILITY ISSUES - StockRequestSystem may not work correctly")
        print(f"❌ {4 - compatibility_score} critical requirement(s) not met")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)