/**
 * Security Middleware
 * HIPAA-compliant security measures and data protection
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const compression = require('compression');
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

/**
 * CORS configuration for HIPAA compliance
 */
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGINS 
      ? process.env.CORS_ORIGINS.split(',')
      : [
          'http://localhost:19006', // Expo web
          'http://localhost:3000',  // React dev server
          'http://localhost:5173',  // Vite dev server
          'http://localhost:5174',  // Vite dev server (alternative port)
          'http://127.0.0.1:5173',  // Alternative localhost
          'http://127.0.0.1:5174'   // Alternative localhost (alternative port)
        ]; // Default for development
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`⚠️ CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Session-ID',
    'X-Request-ID'
  ],
  exposedHeaders: ['X-Request-ID'],
  maxAge: 86400 // 24 hours
};

/**
 * Rate limiting configurations
 */
const rateLimiters = {
  // General API rate limiting
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Maximum 100 requests per window
    message: {
      error: 'Too many requests from this IP. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === 'development'
  }),
  
  // Strict rate limiting for authentication endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Maximum 5 attempts per window
    message: {
      error: 'Too many authentication attempts. Please try again later.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
  }),
  
  // AI chat rate limiting
  chat: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Maximum 10 messages per minute
    message: {
      error: 'Too many chat messages. Please slow down.',
      code: 'CHAT_RATE_LIMIT_EXCEEDED',
      retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false
  }),
  
  // Password reset rate limiting
  passwordReset: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Maximum 3 password reset attempts per hour
    message: {
      error: 'Too many password reset attempts. Please try again later.',
      code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
      retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false
  })
};

/**
 * Helmet security configuration
 */
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.openai.com', 'wss:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for mobile apps
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
};

/**
 * Request sanitization middleware
 */
const sanitizeRequest = (req, res, next) => {
  try {
    // Log request for audit purposes
    logger.info(`📨 Request: ${req.method} ${req.path} from ${req.ip}`);
    
    // Add request ID for tracking
    req.requestId = require('crypto').randomUUID();
    res.set('X-Request-ID', req.requestId);
    
    // Sanitize request body and query parameters
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    
    next();
  } catch (error) {
    logger.error('❌ Request sanitization error:', error);
    res.status(400).json({
      error: 'Invalid request format',
      code: 'REQUEST_SANITIZATION_ERROR'
    });
  }
};

/**
 * Sanitize object recursively
 */
const sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Remove potentially dangerous keys
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    
    sanitized[key] = sanitizeObject(value);
  }
  
  return sanitized;
};

/**
 * HIPAA compliance middleware
 */
const hipaaCompliance = (req, res, next) => {
  // Add HIPAA-required headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
    'Cache-Control': 'no-cache, no-store, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  // Log access for audit trail
  const auditData = {
    requestId: req.requestId,
    userId: req.user?.userId || 'anonymous',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    sessionId: req.sessionID
  };
  
  logger.info(`🔒 HIPAA Access: ${JSON.stringify(auditData)}`);
  
  next();
};

/**
 * Error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  logger.error('❌ Server error:', {
    error: err.message,
    stack: err.stack,
    requestId: req.requestId,
    userId: req.user?.userId,
    path: req.path,
    method: req.method
  });
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  let statusCode = err.statusCode || 500;
  let message = 'Internal Server Error';
  let code = 'INTERNAL_SERVER_ERROR';
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
    code = 'UNAUTHORIZED';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
    code = 'FORBIDDEN';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Not Found';
    code = 'NOT_FOUND';
  }
  
  const errorResponse = {
    error: message,
    code,
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  };
  
  // Include additional details in development
  if (isDevelopment) {
    errorResponse.details = err.message;
    errorResponse.stack = err.stack;
  }
  
  res.status(statusCode).json(errorResponse);
};

/**
 * Request timeout middleware
 */
const requestTimeout = (timeoutMs = 30000) => {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn(`⚠️ Request timeout: ${req.method} ${req.path}`);
        res.status(408).json({
          error: 'Request timeout',
          code: 'REQUEST_TIMEOUT',
          requestId: req.requestId
        });
      }
    }, timeoutMs);
    
    res.on('finish', () => {
      clearTimeout(timeout);
    });
    
    next();
  };
};

/**
 * Content validation middleware
 */
const validateContentType = (allowedTypes = ['application/json']) => {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'DELETE') {
      return next();
    }
    
    const contentType = req.get('Content-Type');
    if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
      return res.status(415).json({
        error: 'Unsupported Media Type',
        code: 'UNSUPPORTED_MEDIA_TYPE',
        supportedTypes: allowedTypes
      });
    }
    
    next();
  };
};

module.exports = {
  corsOptions,
  rateLimiters,
  helmetConfig,
  sanitizeRequest,
  hipaaCompliance,
  errorHandler,
  requestTimeout,
  validateContentType,
  logger
};