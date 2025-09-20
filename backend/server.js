/**
 * Mental Wellness AI Backend Server
 * HIPAA-compliant backend with AI chat capabilities, database integration,
 * and comprehensive security measures
 */

// Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const winston = require('winston');

// Import configurations
const { healthCheck: dbHealthCheck, logger: dbLogger } = require('./config/database');
const { initRedis, createSessionConfig, healthCheck: redisHealthCheck, logger: redisLogger } = require('./config/redis');

// Import middleware
const { authMiddleware, optionalAuthMiddleware, authRateLimit } = require('./middlewares/auth');
const { 
  corsOptions, 
  rateLimiters, 
  helmetConfig, 
  sanitizeRequest, 
  hipaaCompliance, 
  errorHandler,
  requestTimeout,
  validateContentType
} = require('./middlewares/security');

// Import routes
const authRoutes = require('./routes/authSequelize');
const chatRoutes = require('./routes/chat');
const userRoutes = require('./routes/user');
const assessmentRoutes = require('./routes/assessment');

// Import AI services
const chatService = require('./ai/chatService');

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'mental-wellness-backend' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with proper CORS
const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

/**
 * Initialize database connections
 */
const initializeConnections = async () => {
  try {
    // Initialize SQLite/PostgreSQL with Sequelize
    const { initializeModels } = require('./models');
    const dbModels = await initializeModels();
    
    // Make database models available to routes
    app.locals.db = dbModels;
    
    logger.info('✅ Database connected successfully');
    
    // Initialize Redis
    await initRedis();
    logger.info('✅ Redis connected successfully');
    
    return true;
  } catch (error) {
    logger.error('❌ Failed to initialize connections:', error);
    process.exit(1);
  }
};

/**
 * Setup middleware stack
 */
const setupMiddleware = () => {
  // Trust proxy (for load balancers, reverse proxies)
  app.set('trust proxy', 1);
  
  // Request timeout
  app.use(requestTimeout(30000)); // 30 seconds
  
  // Security headers with Helmet
  app.use(helmet(helmetConfig));
  
  // CORS configuration
  app.use(cors(corsOptions));
  
  // Compression middleware
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));
  
  // Rate limiting
  app.use('/api/', rateLimiters.general);
  app.use('/api/auth/', rateLimiters.auth);
  app.use('/api/chat/', rateLimiters.chat);
  app.use('/api/auth/reset-password', rateLimiters.passwordReset);
  
  // Body parsing with size limits
  app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // Security sanitization
  app.use(mongoSanitize());
  app.use(xss());
  app.use(hpp());
  
  // Custom security middleware
  app.use(sanitizeRequest);
  app.use(hipaaCompliance);
  
  // Content type validation for POST/PUT requests
  app.use(validateContentType(['application/json', 'multipart/form-data']));
  
  // Session configuration
  try {
    const sessionConfig = createSessionConfig();
    app.use(session(sessionConfig));
    logger.info('✅ Session middleware configured');
  } catch (error) {
    logger.error('❌ Session configuration failed:', error);
  }
  
  // Request logging
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path} - ${req.ip}`);
    next();
  });
};

/**
 * Setup API routes
 */
const setupRoutes = () => {
  // Health check endpoint
  app.get('/health', async (req, res) => {
    try {
      const [dbHealth, redisHealth] = await Promise.all([
        dbHealthCheck(),
        redisHealthCheck()
      ]);
      
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        database: dbHealth,
        redis: redisHealth,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      };
      
      // Return 503 if any critical service is unhealthy
      if (dbHealth.status === 'unhealthy' || redisHealth.status === 'unhealthy') {
        health.status = 'degraded';
        return res.status(503).json(health);
      }
      
      res.json(health);
    } catch (error) {
      logger.error('❌ Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });
  
  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/chat', authMiddleware, chatRoutes);
  app.use('/api/users', authMiddleware, userRoutes);
  app.use('/api/assessments', authMiddleware, assessmentRoutes);
  
  // Public route (with optional authentication)
  app.get('/api/public', optionalAuthMiddleware, (req, res) => {
    res.json({
      message: 'Public endpoint',
      authenticated: !!req.user,
      user: req.user ? { id: req.user.userId, email: req.user.email } : null
    });
  });
  
  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Endpoint not found',
      code: 'NOT_FOUND',
      path: req.originalUrl
    });
  });
  
  // Global error handler
  app.use(errorHandler);
};

/**
 * Setup Socket.IO for real-time chat
 */
const setupSocketIO = () => {
  io.use(async (socket, next) => {
    try {
      // Extract token from auth header or query
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }
      
      const { tokenUtils } = require('./middlewares/auth');
      const verificationResult = tokenUtils.verify(token);
      
      if (!verificationResult.valid) {
        return next(new Error('Invalid authentication token'));
      }
      
      socket.userId = verificationResult.payload.userId;
      socket.userEmail = verificationResult.payload.email;
      
      logger.info(`🔌 Socket connected: ${socket.userId}`);
      next();
    } catch (error) {
      logger.error('❌ Socket authentication failed:', error);
      next(new Error('Authentication failed'));
    }
  });
  
  io.on('connection', (socket) => {
    logger.info(`✅ User connected via Socket.IO: ${socket.userId}`);
    
    // Join user to their private room
    socket.join(`user_${socket.userId}`);
    
    // Handle chat messages
    socket.on('chat_message', async (data) => {
      try {
        logger.info(`💬 Chat message from ${socket.userId}:`, data);
        
        // Process message with AI service
        const response = await chatService.processMessage(
          data.message, 
          socket.userId,
          data.conversationId
        );
        
        // Emit response back to user
        socket.emit('chat_response', {
          id: require('crypto').randomUUID(),
          message: response.message,
          timestamp: new Date().toISOString(),
          conversationId: data.conversationId,
          isCrisisDetected: response.isCrisisDetected,
          sentiment: response.sentiment,
          resources: response.resources
        });
        
        // Log for audit purposes
        logger.info(`🤖 AI response sent to ${socket.userId}`);
        
      } catch (error) {
        logger.error('❌ Chat message processing error:', error);
        socket.emit('chat_error', {
          error: 'Failed to process message',
          code: 'CHAT_PROCESSING_ERROR'
        });
      }
    });
    
    // Handle typing indicators
    socket.on('typing_start', () => {
      socket.to(`user_${socket.userId}`).emit('user_typing', { userId: socket.userId });
    });
    
    socket.on('typing_stop', () => {
      socket.to(`user_${socket.userId}`).emit('user_stopped_typing', { userId: socket.userId });
    });
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`🔌 User disconnected: ${socket.userId}, reason: ${reason}`);
    });
    
    // Handle errors
    socket.on('error', (error) => {
      logger.error(`❌ Socket error for user ${socket.userId}:`, error);
    });
  });
};

/**
 * Start the server
 */
const startServer = async () => {
  try {
    // Initialize connections
    await initializeConnections();
    
    // Setup middleware
    setupMiddleware();
    
    // Setup routes
    setupRoutes();
    
    // Setup Socket.IO
    setupSocketIO();
    
    // Start the server
    const PORT = process.env.PORT || 5000;
    
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
      
      // Log memory usage
      const memoryUsage = process.memoryUsage();
      logger.info(`💾 Memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
    });
    
    // Graceful shutdown handlers
    const gracefulShutdown = async (signal) => {
      logger.info(`🛑 Received ${signal}. Starting graceful shutdown...`);
      
      try {
        // Close HTTP server
        server.close(() => {
          logger.info('🔒 HTTP server closed');
        });
        
        // Close Socket.IO connections
        io.close(() => {
          logger.info('🔒 Socket.IO server closed');
        });
        
        // Close database connections
        const { closeConnection: closeDBConnection } = require('./config/database');
        const { closeConnection: closeRedisConnection } = require('./config/redis');
        
        await Promise.all([
          closeDBConnection(),
          closeRedisConnection()
        ]);
        
        logger.info('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };
    
    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('❌ Uncaught Exception:', error);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
    
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

module.exports = { app, server, io };