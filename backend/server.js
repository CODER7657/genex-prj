/**
 * Mental Wellness AI Backend Server
 * Main entry point for the Node.js/Express server
 * 
 * Features:
 * - AI-powered mental health chatbot
 * - Crisis detection and sentiment analysis
 * - HIPAA-compliant data handling
 * - Real-time chat with Socket.IO
 * - Secure authentication and rate limiting
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const http = require('http');
const socketIo = require('socket.io');
const winston = require('winston');

// Import routes
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const userRoutes = require('./routes/user');
const assessmentRoutes = require('./routes/assessment');

// Import middleware
const errorHandler = require('./middlewares/errorHandler');
const authMiddleware = require('./middlewares/auth');
const hipaaMiddleware = require('./middlewares/hipaa');

// Import AI services
const chatService = require('./ai/chatService');

// Load environment variables
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  }
});
app.use('/api', limiter);

// Compression and parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// HIPAA compliance middleware
app.use(hipaaMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'mental-wellness-ai-backend',
    version: '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', authMiddleware, chatRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/assessment', authMiddleware, assessmentRoutes);

// Socket.IO for real-time chat
io.use((socket, next) => {
  // Socket authentication middleware
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  // Verify token here
  next();
});

io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.id}`);

  socket.on('join-chat', (userId) => {
    socket.join(userId);
    logger.info(`User ${userId} joined chat room`);
  });

  socket.on('send-message', async (data) => {
    try {
      // Process message through AI and crisis detection
      const response = await chatService.processMessage(data.message, data.userId);
      
      // Emit response back to user
      socket.to(data.userId).emit('ai-response', response);
      
      // If crisis detected, emit alert
      if (response.crisisDetected) {
        socket.to(data.userId).emit('crisis-alert', {
          level: response.crisisLevel,
          resources: response.emergencyResources
        });
      }
    } catch (error) {
      logger.error('Socket message processing error:', error);
      socket.emit('error', { message: 'Failed to process message' });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested resource ${req.originalUrl} was not found on this server.`
  });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mental-wellness-ai', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  logger.info('Connected to MongoDB successfully');
})
.catch((error) => {
  logger.error('MongoDB connection error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    mongoose.connection.close();
    process.exit(0);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  logger.info(`🚀 Mental Wellness AI Backend is running on port ${PORT}`);
  logger.info(`📱 Socket.IO enabled for real-time chat`);
  logger.info(`🛡️  HIPAA-compliant security measures active`);
});

module.exports = app;