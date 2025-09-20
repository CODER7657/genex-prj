/**
 * API Integration Test
 * Test the complete chat API flow
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function runAPITests() {
  console.log('🧪 Testing Mental Wellness AI API...\n');

  try {
    // Test 1: Register a new user
    console.log('Test 1: User Registration');
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, {
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'User',
      age: 25,
      termsAccepted: true,
      anonymous: false
    });
    
    console.log('✅ User registered successfully');
    console.log('   Status:', registerResponse.status);
    console.log('   User ID:', registerResponse.data.user.id);
    const token = registerResponse.data.token;
    console.log();

    // Test 2: Login with the user
    console.log('Test 2: User Login');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      username: registerResponse.data.user.username,
      password: 'TestPass123!'
    });
    
    console.log('✅ User logged in successfully');
    console.log('   Status:', loginResponse.status);
    console.log('   Token received:', loginResponse.data.token ? 'Yes' : 'No');
    const authToken = loginResponse.data.token;
    console.log();

    // Test 3: Create a chat session
    console.log('Test 3: Create Chat Session');
    const sessionResponse = await axios.post(`${BASE_URL}/chat/sessions`, {
      title: 'Test Chat Session',
      initialMessage: 'Hello, I need someone to talk to.'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Chat session created successfully');
    console.log('   Session ID:', sessionResponse.data.session.id);
    const sessionId = sessionResponse.data.session.id;
    console.log();

    // Test 4: Send a chat message
    console.log('Test 4: Send Chat Message');
    const messageResponse = await axios.post(`${BASE_URL}/chat/message`, {
      sessionId: sessionId,
      message: "I'm feeling a bit anxious about my upcoming presentation. Can you help me?"
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Message sent successfully');
    console.log('   AI Response:', messageResponse.data.aiResponse.content.substring(0, 100) + '...');
    console.log('   Sentiment:', messageResponse.data.aiResponse.sentiment.label);
    console.log('   Crisis Detected:', messageResponse.data.aiResponse.crisisDetected);
    console.log();

    // Test 5: Get chat history
    console.log('Test 5: Get Chat History');
    const historyResponse = await axios.get(`${BASE_URL}/chat/sessions/${sessionId}/messages`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Chat history retrieved successfully');
    console.log('   Messages count:', historyResponse.data.messages.length);
    console.log('   Has user message:', historyResponse.data.messages.some(m => m.sender === 'user'));
    console.log('   Has AI response:', historyResponse.data.messages.some(m => m.sender === 'ai'));
    console.log();

    // Test 6: Get all sessions
    console.log('Test 6: Get All Sessions');
    const sessionsResponse = await axios.get(`${BASE_URL}/chat/sessions`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Sessions retrieved successfully');
    console.log('   Sessions count:', sessionsResponse.data.sessions.length);
    console.log('   Contains our session:', sessionsResponse.data.sessions.some(s => s.id === sessionId));
    console.log();

    console.log('🎉 All API tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   ✅ User registration and authentication');
    console.log('   ✅ Chat session management');
    console.log('   ✅ AI message processing');
    console.log('   ✅ Chat history retrieval');
    console.log('   ✅ Database integration');
    
  } catch (error) {
    console.error('❌ API Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAPITests();
}

module.exports = { runAPITests };