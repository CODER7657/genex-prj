/**
 * Redis Configuration
 * Session management and caching setup with HIPAA compliance
 * Falls back to memory store when Redis is unavailable
 */

const redis = require('redis');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const winston = require('winston');

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

// Check if Redis should be used (skip in development if unavailable)
const useRedis = process.env.NODE_ENV === 'production' || process.env.FORCE_REDIS === 'true';

// Redis client configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  
  // Connection options
  connectTimeout: 5000, // Reduced timeout for faster fallback
  lazyConnect: true,
  maxRetriesPerRequest: 2, // Reduced retries
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  
  // Security options for production
  ...(process.env.NODE_ENV === 'production' && {
    tls: {
      rejectUnauthorized: false
    }
  })
};

let redisClient;
let isRedisAvailable = false;

/**
 * Initialize Redis client
 */
const initRedis = async () => {
  if (!useRedis) {
    logger.info('⚠️ Redis disabled for development - using memory store');
    isRedisAvailable = false;
    return null;
  }

  try {
    logger.info('🔄 Connecting to Redis...');
    
    redisClient = redis.createClient(redisConfig);
    
    // Set up event listeners
    setupRedisEventListeners();
    
    // Try to connect with timeout
    const connectionPromise = redisClient.connect();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
    });
    
    await Promise.race([connectionPromise, timeoutPromise]);
    
    isRedisAvailable = true;
    logger.info('✅ Successfully connected to Redis');
    
    return redisClient;
  } catch (error) {
    logger.warn('⚠️ Redis unavailable, falling back to memory store:', error.message);
    isRedisAvailable = false;
    
    // Don't throw error, just return null to use memory store
    return null;
  }
};

/**
 * Set up Redis event listeners
 */
const setupRedisEventListeners = () => {
  redisClient.on('connect', () => {
    logger.info('📊 Redis client connected');
    isRedisAvailable = true;
  });
  
  redisClient.on('ready', () => {
    logger.info('🚀 Redis client ready');
    isRedisAvailable = true;
  });
  
  redisClient.on('error', (error) => {
    logger.error('❌ Redis client error:', error);
    isRedisAvailable = false;
  });
  
  redisClient.on('end', () => {
    logger.warn('⚠️ Redis client disconnected');
    isRedisAvailable = false;
  });
  
  redisClient.on('reconnecting', () => {
    logger.info('🔄 Redis client reconnecting...');
  });
};

/**
 * Create Express session configuration with Redis store or memory fallback
 */
const createSessionConfig = () => {
  const baseConfig = {
    secret: process.env.SESSION_SECRET || 'your-super-secret-session-key',
    name: 'mental_wellness_session',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true, // Prevent XSS attacks
      maxAge: parseInt(process.env.SESSION_TIMEOUT) || 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict' // CSRF protection
    },
    
    // HIPAA compliance
    genid: () => {
      const crypto = require('crypto');
      return crypto.randomBytes(32).toString('hex');
    }
  };

  // Use Redis store if available, otherwise fall back to memory store
  if (isRedisAvailable && redisClient) {
    logger.info('🔧 Using Redis session store');
    baseConfig.store = new RedisStore({ 
      client: redisClient,
      prefix: 'mental_wellness_session:'
    });
  } else {
    logger.warn('⚠️ Using memory session store (not suitable for production)');
    // Memory store is the default when no store is specified
  }
  
  return baseConfig;
};

/**
 * Cache utility functions (with memory fallback)
 */
// Simple memory cache for when Redis is unavailable
const memoryCache = new Map();

const cache = {
  /**
   * Set value in cache with TTL
   */
  set: async (key, value, ttlSeconds = 3600) => {
    try {
      if (isRedisAvailable && redisClient) {
        const serialized = JSON.stringify(value);
        await redisClient.setEx(key, ttlSeconds, serialized);
        logger.debug(`🔧 Redis Cache SET: ${key}`);
      } else {
        // Use memory cache with expiration
        const expiresAt = Date.now() + (ttlSeconds * 1000);
        memoryCache.set(key, { value, expiresAt });
        logger.debug(`🔧 Memory Cache SET: ${key}`);
        
        // Clean up expired entries
        setTimeout(() => {
          if (memoryCache.has(key)) {
            const cached = memoryCache.get(key);
            if (cached && cached.expiresAt <= Date.now()) {
              memoryCache.delete(key);
            }
          }
        }, ttlSeconds * 1000);
      }
    } catch (error) {
      logger.error('❌ Cache SET error:', error);
      throw error;
    }
  },
  
  /**
   * Get value from cache
   */
  get: async (key) => {
    try {
      if (isRedisAvailable && redisClient) {
        const cached = await redisClient.get(key);
        if (cached) {
          logger.debug(`✅ Redis Cache HIT: ${key}`);
          return JSON.parse(cached);
        }
        logger.debug(`❌ Redis Cache MISS: ${key}`);
        return null;
      } else {
        // Use memory cache
        if (memoryCache.has(key)) {
          const cached = memoryCache.get(key);
          if (cached.expiresAt > Date.now()) {
            logger.debug(`✅ Memory Cache HIT: ${key}`);
            return cached.value;
          } else {
            // Expired, remove it
            memoryCache.delete(key);
          }
        }
        logger.debug(`❌ Memory Cache MISS: ${key}`);
        return null;
      }
    } catch (error) {
      logger.error('❌ Cache GET error:', error);
      return null;
    }
  },
  
  /**
   * Delete key from cache
   */
  del: async (key) => {
    try {
      if (isRedisAvailable && redisClient) {
        await redisClient.del(key);
        logger.debug(`🗑️ Redis Cache DEL: ${key}`);
      } else {
        memoryCache.delete(key);
        logger.debug(`🗑️ Memory Cache DEL: ${key}`);
      }
    } catch (error) {
      logger.error('❌ Cache DEL error:', error);
      throw error;
    }
  },
  
  /**
   * Check if key exists
   */
  exists: async (key) => {
    try {
      if (isRedisAvailable && redisClient) {
        const exists = await redisClient.exists(key);
        return Boolean(exists);
      } else {
        const cached = memoryCache.get(key);
        return cached && cached.expiresAt > Date.now();
      }
    } catch (error) {
      logger.error('❌ Cache EXISTS error:', error);
      return false;
    }
  },
  
  /**
   * Set expiration on existing key
   */
  expire: async (key, ttlSeconds) => {
    try {
      if (isRedisAvailable && redisClient) {
        await redisClient.expire(key, ttlSeconds);
        logger.debug(`⏱️ Redis Cache EXPIRE: ${key} (${ttlSeconds}s)`);
      } else {
        if (memoryCache.has(key)) {
          const cached = memoryCache.get(key);
          cached.expiresAt = Date.now() + (ttlSeconds * 1000);
          memoryCache.set(key, cached);
          logger.debug(`⏱️ Memory Cache EXPIRE: ${key} (${ttlSeconds}s)`);
        }
      }
    } catch (error) {
      logger.error('❌ Cache EXPIRE error:', error);
      throw error;
    }
  }
};

/**
 * Session utility functions
 */
const sessionUtils = {
  /**
   * Get user session data
   */
  getUserSession: async (sessionId) => {
    try {
      const sessionKey = `sess:${sessionId}`;
      return await cache.get(sessionKey);
    } catch (error) {
      logger.error('❌ Get user session error:', error);
      return null;
    }
  },
  
  /**
   * Delete user session
   */
  deleteUserSession: async (sessionId) => {
    try {
      const sessionKey = `sess:${sessionId}`;
      await cache.del(sessionKey);
      logger.info(`🔒 Session deleted: ${sessionId}`);
    } catch (error) {
      logger.error('❌ Delete user session error:', error);
      throw error;
    }
  },
  
  /**
   * Get all active sessions for a user
   */
  getUserActiveSessions: async (userId) => {
    try {
      if (isRedisAvailable && redisClient) {
        const pattern = `sess:*`;
        const keys = await redisClient.keys(pattern);
        
        const activeSessions = [];
        for (const key of keys) {
          const sessionData = await cache.get(key);
          if (sessionData && sessionData.userId === userId) {
            activeSessions.push({
              sessionId: key.replace('sess:', ''),
              ...sessionData
            });
          }
        }
        
        return activeSessions;
      } else {
        // Memory cache doesn't support pattern matching, so iterate through all keys
        const activeSessions = [];
        for (const [key, cached] of memoryCache) {
          if (key.startsWith('sess:') && cached.expiresAt > Date.now()) {
            if (cached.value && cached.value.userId === userId) {
              activeSessions.push({
                sessionId: key.replace('sess:', ''),
                ...cached.value
              });
            }
          }
        }
        return activeSessions;
      }
    } catch (error) {
      logger.error('❌ Get user active sessions error:', error);
      return [];
    }
  }
};

/**
 * Health check for Redis
 */
const healthCheck = async () => {
  try {
    if (isRedisAvailable && redisClient && redisClient.isReady) {
      const start = Date.now();
      await redisClient.ping();
      const responseTime = Date.now() - start;
      
      return {
        status: 'healthy',
        type: 'redis',
        responseTime: `${responseTime}ms`,
        connected: true,
        memoryUsage: await redisClient.memory('usage'),
        timestamp: new Date().toISOString()
      };
    } else {
      return {
        status: 'healthy',
        type: 'memory_fallback',
        responseTime: '1ms',
        connected: false,
        cacheSize: memoryCache.size,
        message: 'Using memory cache fallback',
        timestamp: new Date().toISOString()
      };
    }
  } catch (error) {
    logger.error('❌ Redis health check failed:', error);
    return {
      status: 'unhealthy',
      type: 'redis',
      error: error.message,
      connected: false,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Close Redis connection gracefully
 */
const closeConnection = async () => {
  try {
    if (redisClient && isRedisAvailable) {
      await redisClient.quit();
      logger.info('🔒 Redis connection closed successfully');
    } else {
      logger.info('🔒 Memory cache cleared');
      memoryCache.clear();
    }
  } catch (error) {
    logger.error('❌ Error closing Redis connection:', error);
  }
};

// Graceful shutdown
process.on('SIGINT', closeConnection);
process.on('SIGTERM', closeConnection);

module.exports = {
  initRedis,
  createSessionConfig,
  cache,
  sessionUtils,
  healthCheck,
  closeConnection,
  getClient: () => redisClient,
  isRedisAvailable: () => isRedisAvailable,
  logger
};