/**
 * Database Configuration
 * SQLite for development, PostgreSQL for production
 * HIPAA-compliant setup with proper error handling
 */

const { Sequelize } = require('sequelize');
const winston = require('winston');
const path = require('path');

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Database configuration based on environment
const getDatabaseConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction && process.env.DATABASE_URL) {
    // Production PostgreSQL configuration
    return {
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false // For some cloud providers
        }
      },
      url: process.env.DATABASE_URL,
      logging: false, // Disable SQL logging in production
      pool: {
        max: 20,
        min: 0,
        acquire: 60000,
        idle: 10000
      }
    };
  } else {
    // Development SQLite configuration
    const dbPath = path.join(__dirname, '..', 'data', 'mental_wellness_dev.sqlite');
    return {
      dialect: 'sqlite',
      storage: dbPath,
      logging: (sql) => logger.debug(`SQL: ${sql}`), // Log SQL in development
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    };
  }
};

// Create Sequelize instance
let sequelize = null;

/**
 * Initialize database connection
 */
const initDB = async () => {
  try {
    const config = getDatabaseConfig();
    
    if (config.url) {
      // Production with connection string
      sequelize = new Sequelize(config.url, config);
      logger.info('🔄 Connecting to PostgreSQL...');
    } else {
      // Development SQLite
      // Ensure data directory exists
      const dataDir = path.dirname(config.storage);
      const fs = require('fs').promises;
      try {
        await fs.mkdir(dataDir, { recursive: true });
      } catch (err) {
        // Directory might already exist
      }
      
      sequelize = new Sequelize(config);
      logger.info('🔄 Connecting to SQLite database...');
    }
    
    // Test the connection
    await sequelize.authenticate();
    logger.info('✅ Database connection established successfully');
    
    // Note: Table synchronization will happen after models are defined
    
    return sequelize;
  } catch (error) {
    logger.error('❌ Database connection error:', error);
    throw error;
  }
};

/**
 * Set up database connection event listeners
 */
const setupConnectionListeners = () => {
  if (!sequelize) return;
  
  // Handle application termination
  process.on('SIGINT', async () => {
    await closeConnection();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await closeConnection();
    process.exit(0);
  });
};

/**
 * Close database connection gracefully
 */
const closeConnection = async () => {
  try {
    if (sequelize) {
      await sequelize.close();
      logger.info('🔒 Database connection closed successfully');
    }
  } catch (error) {
    logger.error('❌ Error closing database connection:', error);
  }
};

/**
 * Get database connection status
 */
const getConnectionStatus = () => {
  if (!sequelize) {
    return {
      state: 'disconnected',
      type: 'none'
    };
  }
  
  return {
    state: 'connected',
    type: sequelize.getDialect(),
    database: sequelize.getDatabaseName(),
    host: sequelize.config.host,
    port: sequelize.config.port
  };
};

/**
 * Health check for database
 */
const healthCheck = async () => {
  try {
    if (!sequelize) {
      throw new Error('No database connection');
    }
    
    await sequelize.authenticate();
    return {
      status: 'healthy',
      connection: getConnectionStatus(),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('❌ Database health check failed:', error);
    return {
      status: 'unhealthy',
      error: error.message,
      connection: getConnectionStatus(),
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * HIPAA-compliant data encryption for sensitive fields
 */
const encryptSensitiveData = (data) => {
  if (!process.env.HIPAA_ENCRYPTION_KEY) {
    logger.warn('⚠️ HIPAA encryption key not set');
    return data;
  }
  
  const crypto = require('crypto');
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.HIPAA_ENCRYPTION_KEY, 'hex');
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key);
  
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
};

/**
 * Decrypt HIPAA-compliant encrypted data
 */
const decryptSensitiveData = (encryptedData) => {
  if (!process.env.HIPAA_ENCRYPTION_KEY || !encryptedData.encrypted) {
    return encryptedData;
  }
  
  const crypto = require('crypto');
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.HIPAA_ENCRYPTION_KEY, 'hex');
  
  const decipher = crypto.createDecipher(algorithm, key);
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
};

module.exports = {
  initDB,
  closeConnection,
  getConnectionStatus,
  healthCheck,
  encryptSensitiveData,
  decryptSensitiveData,
  logger
};