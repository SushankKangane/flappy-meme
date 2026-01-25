#!/usr/bin/env python3
"""
Backend API Testing for Flappy Bird Game
Tests the FastAPI backend endpoints
"""

import requests
import json
import sys
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:8001')
API_BASE_URL = f"{BACKEND_URL}/api"

def test_root_endpoint():
    """Test the root API endpoint"""
    try:
        response = requests.get(f"{API_BASE_URL}/", timeout=10)
        print(f"✅ Root endpoint status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Root response: {data}")
            return True
        else:
            print(f"❌ Root endpoint failed with status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Root endpoint error: {str(e)}")
        return False

def test_create_status_check():
    """Test creating a status check"""
    try:
        payload = {
            "client_name": "flappy_bird_game_test"
        }
        
        response = requests.post(
            f"{API_BASE_URL}/status", 
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"✅ Create status check status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Created status check: {data}")
            
            # Verify response structure
            required_fields = ['id', 'client_name', 'timestamp']
            for field in required_fields:
                if field not in data:
                    print(f"❌ Missing field in response: {field}")
                    return False
            
            if data['client_name'] != payload['client_name']:
                print(f"❌ Client name mismatch: expected {payload['client_name']}, got {data['client_name']}")
                return False
                
            return True
        else:
            print(f"❌ Create status check failed with status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Create status check error: {str(e)}")
        return False

def test_get_status_checks():
    """Test retrieving status checks"""
    try:
        response = requests.get(f"{API_BASE_URL}/status", timeout=10)
        print(f"✅ Get status checks status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Retrieved {len(data)} status checks")
            
            # Verify response is a list
            if not isinstance(data, list):
                print(f"❌ Expected list, got {type(data)}")
                return False
            
            # If there are items, verify structure
            if len(data) > 0:
                item = data[0]
                required_fields = ['id', 'client_name', 'timestamp']
                for field in required_fields:
                    if field not in item:
                        print(f"❌ Missing field in status check item: {field}")
                        return False
            
            return True
        else:
            print(f"❌ Get status checks failed with status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Get status checks error: {str(e)}")
        return False

def test_backend_connectivity():
    """Test basic backend connectivity"""
    try:
        response = requests.get(BACKEND_URL, timeout=5)
        print(f"✅ Backend connectivity test status: {response.status_code}")
        return response.status_code in [200, 404]  # 404 is OK as root might not be defined
    except Exception as e:
        print(f"❌ Backend connectivity error: {str(e)}")
        return False

def run_all_tests():
    """Run all backend tests"""
    print("=" * 60)
    print("🧪 FLAPPY BIRD BACKEND API TESTS")
    print("=" * 60)
    print(f"Testing backend at: {API_BASE_URL}")
    print()
    
    tests = [
        ("Backend Connectivity", test_backend_connectivity),
        ("Root Endpoint", test_root_endpoint),
        ("Create Status Check", test_create_status_check),
        ("Get Status Checks", test_get_status_checks),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"🔍 Running: {test_name}")
        try:
            result = test_func()
            results.append((test_name, result))
            print(f"{'✅ PASS' if result else '❌ FAIL'}: {test_name}")
        except Exception as e:
            print(f"❌ ERROR in {test_name}: {str(e)}")
            results.append((test_name, False))
        print("-" * 40)
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All backend tests passed!")
        return True
    else:
        print("⚠️  Some backend tests failed!")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)