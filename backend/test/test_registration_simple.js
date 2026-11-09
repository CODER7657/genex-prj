const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testRegistration() {
  console.log('🧪 Testing Registration Endpoint...');
  
  try {
    const userData = {
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      password: 'Test123!',
      age: 25,
      termsAccepted: true
    };

    console.log('📤 Registering user:', userData.username);
    
    const response = await axios.post(`${BASE_URL}/api/auth/register`, userData);
    
    console.log('✅ Registration successful!');
    console.log('📊 Status:', response.status);
    console.log('📋 Response:', response.data);
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Registration failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data);
    } else {
      console.error('Network Error:', error.message);
    }
    throw error;
  }
}

async function testBasicEndpoints() {
  console.log('\n🚀 Starting Basic API Tests...\n');
  
  try {
    // Test server health
    console.log('💓 Testing server health...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server is healthy:', healthResponse.data);
    
    // Test registration
    await testRegistration();
    
    console.log('\n🎉 All tests passed!');
    
  } catch (error) {
    console.log('\n❌ Tests failed');
    process.exit(1);
  }
}

// Run tests
testBasicEndpoints();