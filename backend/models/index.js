/**
 * Database Models Index
 * Initialize all Sequelize models and define relationships
 */

const { initDB } = require('../config/database');
const initUserModel = require('./UserSequelize');
const initChatSessionModel = require('./ChatSessionSequelize');
const initMessageModel = require('./MessageSequelize');

let db = {};

const initializeModels = async () => {
  try {
    // Initialize database connection
    const sequelize = await initDB();
    
    // Initialize models
    const User = initUserModel(sequelize);
    const ChatSession = initChatSessionModel(sequelize);
    const Message = initMessageModel(sequelize);
    
    // Define associations
    User.hasMany(ChatSession, { 
      foreignKey: 'userId', 
      as: 'chatSessions',
      onDelete: 'CASCADE'
    });
    ChatSession.belongsTo(User, { 
      foreignKey: 'userId', 
      as: 'user'
    });
    
    ChatSession.hasMany(Message, { 
      foreignKey: 'sessionId', 
      as: 'messages',
      onDelete: 'CASCADE'
    });
    Message.belongsTo(ChatSession, { 
      foreignKey: 'sessionId', 
      as: 'session'
    });
    
    User.hasMany(Message, { 
      foreignKey: 'userId', 
      as: 'messages',
      onDelete: 'CASCADE'
    });
    Message.belongsTo(User, { 
      foreignKey: 'userId', 
      as: 'user'
    });
    
    // Store models in db object
    db.sequelize = sequelize;
    db.User = User;
    db.ChatSession = ChatSession;
    db.Message = Message;
    
    // Sync database schema (create tables) - only after models are defined
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ force: false });
      console.log('📊 Database schema synchronized');
    }
    
    console.log('✅ All models initialized successfully');
    return db;
    
  } catch (error) {
    console.error('❌ Failed to initialize models:', error);
    throw error;
  }
};

module.exports = {
  initializeModels,
  db
};