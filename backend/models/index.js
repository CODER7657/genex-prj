/**
 * Database Models Index
 * Initialize all Sequelize models and define relationships
 */

const { initDB } = require('../config/database');
const initUserModel = require('./UserSequelize');
const initChatSessionModel = require('./ChatSessionSequelize');
const initMessageModel = require('./MessageSequelize');

let db = {};

/**
 * sync() never adds a column to a table that already exists, so a development
 * database made before the session title column needs it added.
 */
const addTitleColumn = async (sequelize, ChatSession) => {
  const queryInterface = sequelize.getQueryInterface();
  const table = ChatSession.getTableName();
  const columns = await queryInterface.describeTable(table);
  if (columns.title) return false;

  await queryInterface.addColumn(table, 'title', {
    type: sequelize.Sequelize.STRING(100),
    allowNull: true
  });
  return true;
};

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
      await addTitleColumn(sequelize, ChatSession);
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
  addTitleColumn,
  db
};