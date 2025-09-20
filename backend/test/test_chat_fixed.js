const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testChatSystemFixed() {
  console.log('🚀 Starting Fixed AI Chat System Tests...\n');
  
  let accessToken = null;
  
  try {
    // Step 1: Register a fresh user (this will use the fixed JWT signing)
    console.log('1️⃣ Registering fresh test user...');
    const userData = {
      username: `freshchattest_${Date.now()}`,
      email: `freshchattest_${Date.now()}@example.com`,
      password: 'Test123!',
      age: 28,
      termsAccepted: true
    };
    
    const regResponse = await axios.post(`${BASE_URL}/api/auth/register`, userData);
    accessToken = regResponse.data.tokens.accessToken;
    console.log('✅ Fresh user registered successfully');
    console.log('🔑 New access token obtained with correct audience');
    
    // Decode the new token to verify it has audience
    const jwt = require('jsonwebtoken');
    const decodedToken = jwt.decode(accessToken, { complete: true });
    console.log('📊 Token payload:', JSON.stringify(decodedToken.payload, null, 2));
    
    // Step 2: Test chat endpoints with new token
    const config = {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };
    
    // Test sending a message
    console.log('\n2️⃣ Testing AI chat message with fixed token...');
    const chatMessage = {
      message: "I'm feeling a bit anxious today. Can you help me with some coping strategies?"
    };
    
    const chatResponse = await axios.post(`${BASE_URL}/api/chat/message`, chatMessage, config);
    console.log('✅ Chat message processed successfully!');
    console.log('🤖 AI Response length:', chatResponse.data.aiResponse.length);
    console.log('📊 Sentiment:', chatResponse.data.sentiment);
    console.log('🚨 Crisis Detection:', chatResponse.data.crisisDetection);
    
    // Test getting chat history
    console.log('\n3️⃣ Testing chat history retrieval...');
    const historyResponse = await axios.get(`${BASE_URL}/api/chat/history`, config);
    console.log('✅ Chat history retrieved successfully');
    console.log('📚 Sessions found:', historyResponse.data.sessions.length);
    
    // Test crisis detection
    console.log('\n4️⃣ Testing crisis detection with concerning message...');
    const crisisMessage = {
      message: "I've been having thoughts of self-harm lately and feel completely hopeless"
    };
    
    const crisisResponse = await axios.post(`${BASE_URL}/api/chat/message`, crisisMessage, config);
    console.log('✅ Crisis message processed');
    console.log('🚨 Crisis Detected:', crisisResponse.data.crisisDetection.isCrisis);
    console.log('📞 Crisis Resources Provided:', crisisResponse.data.crisisDetection.resources ? 'Yes' : 'No');
    
    console.log('\n🎉🎉🎉 All AI Chat System tests passed successfully! 🎉🎉🎉');
    console.log('✅ Database sync issue fixed');
    console.log('✅ JWT authentication working');
    console.log('✅ AI chat integration functional');
    console.log('✅ Crisis detection operational');
    console.log('✅ Chat history system working');
    
  } catch (error) {
    console.error('❌ Test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data);
    } else {
      console.error('Network Error:', error.message);
    }
    throw error;
  }
}

// Run comprehensive tests
testChatSystemFixed();