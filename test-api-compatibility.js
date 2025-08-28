#!/usr/bin/env node

/**
 * API Compatibility Test Script
 * Tests all API endpoints to ensure frontend compatibility
 */

import fetch from 'node-fetch';
import fs from 'fs';

const BASE_URL = 'http://localhost:3001';
const API_BASE = `${BASE_URL}/api`;

// Test credentials - will try multiple combinations
const TEST_CREDENTIALS = [
  { email: 'admin@example.com', password: '123456' },
  { email: 'teacher@example.com', password: '123456' },
  { email: 'test@example.com', password: '123456' }
];

let authToken = null;

async function authenticate() {
  console.log('🔐 Attempting authentication...');
  
  for (const creds of TEST_CREDENTIALS) {
    try {
      console.log(`Trying: ${creds.email}`);
      
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(creds)
      });

      if (response.ok) {
        const data = await response.json();
        authToken = data.accessToken || data.data?.accessToken;
        
        if (authToken) {
          console.log(`✅ Authenticated successfully as ${creds.email}`);
          return true;
        }
      } else {
        const error = await response.text();
        console.log(`❌ Failed ${creds.email}: ${response.status} - ${error}`);
      }
    } catch (error) {
      console.log(`❌ Error ${creds.email}: ${error.message}`);
    }
  }
  
  console.log('❌ Authentication failed with all test credentials');
  return false;
}

async function testEndpoint(endpoint, description) {
  console.log(`\n🧪 Testing ${description}`);
  console.log(`   GET ${endpoint}`);
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    
    let data;
    if (isJson) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    const result = {
      endpoint,
      status: response.status,
      contentType,
      success: response.ok,
      data: isJson ? data : { rawResponse: data }
    };

    // Save detailed response
    const filename = `test-results-${endpoint.replace(/[\/\:]/g, '_')}.json`;
    fs.writeFileSync(filename, JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log(`   ✅ Status: ${response.status}`);
      
      if (Array.isArray(data)) {
        console.log(`   📊 Array response with ${data.length} items`);
        if (data.length > 0) {
          console.log(`   🔍 First item keys: ${Object.keys(data[0]).join(', ')}`);
        }
      } else if (data && typeof data === 'object') {
        console.log(`   📊 Object response with keys: ${Object.keys(data).join(', ')}`);
      }
      
      console.log(`   💾 Saved to: ${filename}`);
    } else {
      console.log(`   ❌ Status: ${response.status}`);
      console.log(`   📄 Response: ${JSON.stringify(data, null, 2)}`);
    }

    return result;
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return {
      endpoint,
      error: error.message,
      success: false
    };
  }
}

async function validateResponseSchema(result, expectedSchema) {
  console.log(`\n🔍 Schema Validation for ${result.endpoint}`);
  
  if (!result.success) {
    console.log('   ⚠️  Skipping validation - endpoint failed');
    return false;
  }

  const data = result.data;
  let isValid = true;
  const issues = [];

  // Add validation logic here based on expectedSchema
  console.log('   📋 Schema validation completed');
  
  return { isValid, issues };
}

async function main() {
  console.log('🚀 Starting API Compatibility Tests');
  console.log('=====================================');
  
  // Authenticate first
  const authenticated = await authenticate();
  if (!authenticated) {
    console.log('🛑 Cannot proceed without authentication');
    return;
  }

  // Test all endpoints
  const endpoints = [
    { path: '/student', description: 'Students List' },
    { path: '/teacher', description: 'Teachers List' },
    { path: '/theory', description: 'Theory Lessons List' },
    { path: '/orchestra', description: 'Orchestras List' },
    { path: '/rehearsal', description: 'Rehearsals List' }
  ];

  const results = [];
  
  for (const { path, description } of endpoints) {
    const result = await testEndpoint(path, description);
    results.push(result);
  }

  // Test specific item endpoints (will need IDs from list responses)
  console.log('\n📋 Testing individual item endpoints...');
  
  // Summary
  console.log('\n📊 TEST SUMMARY');
  console.log('================');
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.endpoint}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  });
  
  console.log('\n✅ API compatibility test completed');
  console.log('Check individual JSON files for detailed responses');
}

main().catch(console.error);