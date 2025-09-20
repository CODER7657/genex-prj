const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testSimpleChat() {
  console.log('🧪 Testing Simple Chat...\n');
  
  let accessToken = null;
  
  try {
    // Step 1: Register user
    console.log('1️⃣ Registering user...');
    const userData = {
      username: `simplechat_${Date.now()}`,
      email: `simplechat_${Date.now()}@example.com`,
      password: 'Test123!',
      age: 25,
      termsAccepted: true
    };
    
    const regResponse = await axios.post(`${BASE_URL}/api/auth/register`, userData);
    accessToken = regResponse.data.tokens.accessToken;
    
    // Decode the token to verify audience
    const jwt = require('jsonwebtoken');
    const decodedToken = jwt.decode(accessToken, { complete: true });
    console.log('✅ User registered with JWT audience:', decodedToken.payload.aud);
    
    // Step 2: Simple chat test
    const config = {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };
    
    console.log('\n2️⃣ Testing simple chat message...');
    const chatMessage = {
      message: "Hello, how are you today?"
    };
    
    console.log('📤 Sending message:', chatMessage.message);
    const chatResponse = await axios.post(`${BASE_URL}/api/chat/message`, chatMessage, config);
    
    console.log('✅ Chat response received successfully!');
    console.log('🤖 AI Response:', chatResponse.data.data.aiResponse.content.substring(0, 100) + '...');
    console.log('📊 Status:', chatResponse.status);
    console.log('🔍 Session ID:', chatResponse.data.data.sessionId);
    
    console.log('\n🎉 Simple chat test passed!');
    
  } catch (error) {
    console.error('❌ Simple chat test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', Object.keys(error.response.headers));
      console.error('Error data:', error.response.data);
    } else {
      console.error('Network Error:', error.message);
    }
    throw error;
  }
}

// Run simple test
testSimpleChat();