/**
 * AI Service Test
 * Simple test to verify AI chat service functionality
 */

// Setup minimal environment for testing
process.env.NODE_ENV = 'test';

const path = require('path');
const { Sequelize } = require('sequelize');
const winston = require('winston');

// Configure logger for testing
const logger = winston.createLogger({
  level: 'error', // Only show errors during testing
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console({ silent: true }) // Silent during tests
  ]
});

// Setup in-memory database for testing
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false
});

// Initialize models for testing
async function initializeTestDatabase() {
  try {
    // Define minimal models for testing
    const User = sequelize.define('User', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      }
    });

    const ChatSession = sequelize.define('ChatSession', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false
      }
    });

    const Message = sequelize.define('Message', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      sessionId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      sender: {
        type: Sequelize.ENUM('user', 'ai'),
        allowNull: false
      }
    });

    // Set up associations
    User.hasMany(ChatSession, { foreignKey: 'userId' });
    ChatSession.belongsTo(User, { foreignKey: 'userId' });
    ChatSession.hasMany(Message, { foreignKey: 'sessionId' });
    Message.belongsTo(ChatSession, { foreignKey: 'sessionId' });

    // Sync database
    await sequelize.sync({ force: true });
    
    // Make models available globally for the AI service
    global.db = { User, ChatSession, Message, sequelize };
    
    return { User, ChatSession, Message };
  } catch (error) {
    console.error('Failed to initialize test database:', error);
    throw error;
  }
}

const chatService = require('../ai/chatService');

// Test function
async function testAIService() {
  console.log('🧪 Testing AI Chat Service...\n');

  try {
    // Initialize test database first
    console.log('Setting up test database...');
    await initializeTestDatabase();
    console.log('✅ Test database ready\n');

    // Test 1: Basic positive message
    console.log('Test 1: Basic positive message');
    const response1 = await chatService.processMessage(
      "Hi, I'm feeling pretty good today!",
      'test-user-1',
      'test-session-1'
    );
    console.log('✅ Response:', response1.content.substring(0, 100) + '...');
    console.log('   Sentiment:', response1.sentiment.label);
    console.log('   Crisis detected:', response1.crisisDetected);
    console.log();

    // Test 2: Anxious message
    console.log('Test 2: Anxious message');
    const response2 = await chatService.processMessage(
      "I'm feeling really anxious about my exam tomorrow. I can't stop worrying.",
      'test-user-2',
      'test-session-2'
    );
    console.log('✅ Response:', response2.content.substring(0, 100) + '...');
    console.log('   Sentiment:', response2.sentiment.label);
    console.log('   Crisis detected:', response2.crisisDetected);
    console.log();

    // Test 3: Crisis message (be careful with this one)
    console.log('Test 3: Crisis detection');
    const response3 = await chatService.processMessage(
      "I feel really hopeless and don't know what to do anymore.",
      'test-user-3',
      'test-session-3'
    );
    console.log('✅ Response:', response3.content.substring(0, 100) + '...');
    console.log('   Sentiment:', response3.sentiment.label);
    console.log('   Crisis detected:', response3.crisisDetected);
    console.log('   Crisis level:', response3.crisisLevel);
    console.log();

    // Test 4: Get service stats
    console.log('Test 4: Service statistics');
    const stats = chatService.getStats();
    console.log('✅ Stats:', {
      messagesProcessed: stats.messagesProcessed,
      crisisDetected: stats.crisisDetected,
      aiResponses: stats.aiResponses,
      fallbackResponses: stats.fallbackResponses,
      geminiAvailable: stats.aiClientsAvailable.gemini,
      openaiAvailable: stats.aiClientsAvailable.openai
    });
    console.log();

    console.log('🎉 AI Service tests completed successfully!');
    
    if (stats.fallbackResponses === stats.messagesProcessed) {
      console.log('\n⚠️  Note: All responses used fallback (no AI API keys configured)');
      console.log('   This is expected in development. Add GEMINI_API_KEY or OPENAI_API_KEY to .env for full AI functionality.');
    }

    // Clean up
    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testAIService();
}

module.exports = { testAIService };