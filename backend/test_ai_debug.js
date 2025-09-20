// Load environment variables FIRST
require('dotenv').config();

// Simple test to debug AI service directly
const chatService = require('./ai/chatService');

async function testAIService() {
  console.log('🧪 Testing AI Service directly...\n');
  
  try {
    console.log('Environment variables check:');
    console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set' : 'Not set');
    console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Set' : 'Not set');
    console.log('');
    
    const result = await chatService.processMessage('Hello, how are you?', 'test_user_123', null);
    
    console.log('✅ AI Service Response:');
    console.log('Content:', result.content);
    console.log('Source:', result.source);
    console.log('');
    console.log('🎉 AI Service test completed!');
    
  } catch (error) {
    console.error('❌ AI Service test failed:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAIService();