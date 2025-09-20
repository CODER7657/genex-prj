/**
 * JWT Authentication Middleware
 * Handles token generation, validation, and user authentication
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { promisify } = require('util');
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

// JWT Configuration
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  issuer: process.env.JWT_ISSUER || 'mental-wellness-ai',
  audience: process.env.JWT_AUDIENCE || 'mental-wellness-users'
};

// Rate limiting for authentication endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Maximum 5 attempts per window
  message: {
    error: 'Too many authentication attempts. Please try again in 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV === 'development';
  }
});

/**
 * Password utilities
 */
const passwordUtils = {
  /**
   * Hash password using bcrypt
   */
  hash: async (password) => {
    try {
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      return hashedPassword;
    } catch (error) {
      logger.error('❌ Password hashing error:', error);
      throw new Error('Password hashing failed');
    }
  },
  
  /**
   * Compare password with hash
   */
  compare: async (password, hash) => {
    try {
      const isMatch = await bcrypt.compare(password, hash);
      return isMatch;
    } catch (error) {
      logger.error('❌ Password comparison error:', error);
      throw new Error('Password verification failed');
    }
  },
  
  /**
   * Validate password strength
   */
  validate: (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const errors = [];
    
    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`);
    }
    
    if (!hasUpperCase) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!hasLowerCase) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!hasNumbers) {
      errors.push('Password must contain at least one number');
    }
    
    if (!hasSpecialChar) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

/**
 * JWT token utilities
 */
const tokenUtils = {
  /**
   * Generate JWT token
   */
  generate: (payload) => {
    try {
      const token = jwt.sign(payload, JWT_CONFIG.secret, {
        expiresIn: JWT_CONFIG.expiresIn,
        issuer: JWT_CONFIG.issuer,
        audience: JWT_CONFIG.audience,
        algorithm: 'HS256'
      });
      
      logger.info(`🔑 JWT token generated for user: ${payload.userId}`);
      return token;
    } catch (error) {
      logger.error('❌ JWT generation error:', error);
      throw new Error('Token generation failed');
    }
  },
  
  /**
   * Verify JWT token
   */
  verify: (token) => {
    try {
      const decoded = jwt.verify(token, JWT_CONFIG.secret, {
        issuer: JWT_CONFIG.issuer,
        audience: JWT_CONFIG.audience,
        algorithms: ['HS256']
      });
      
      return {
        valid: true,
        payload: decoded
      };
    } catch (error) {
      logger.warn(`⚠️ JWT verification failed: ${error.message}`);
      
      let errorType = 'INVALID_TOKEN';
      if (error.name === 'TokenExpiredError') {
        errorType = 'TOKEN_EXPIRED';
      } else if (error.name === 'JsonWebTokenError') {
        errorType = 'MALFORMED_TOKEN';
      } else if (error.name === 'NotBeforeError') {
        errorType = 'TOKEN_NOT_ACTIVE';
      }
      
      return {
        valid: false,
        error: errorType,
        message: error.message
      };
    }
  },
  
  /**
   * Decode token without verification (for debugging)
   */
  decode: (token) => {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      logger.error('❌ JWT decode error:', error);
      return null;
    }
  },
  
  /**
   * Generate refresh token
   */
  generateRefresh: (payload) => {
    try {
      const refreshToken = jwt.sign(payload, JWT_CONFIG.secret, {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
        issuer: JWT_CONFIG.issuer,
        audience: JWT_CONFIG.audience,
        algorithm: 'HS256'
      });
      
      return refreshToken;
    } catch (error) {
      logger.error('❌ Refresh token generation error:', error);
      throw new Error('Refresh token generation failed');
    }
  }
};

/**
 * Authentication middleware
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Extract token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access token required',
        code: 'MISSING_TOKEN'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const verificationResult = tokenUtils.verify(token);
    if (!verificationResult.valid) {
      return res.status(401).json({
        error: 'Invalid or expired token',
        code: verificationResult.error,
        message: verificationResult.message
      });
    }
    
    // Add user info to request
    req.user = verificationResult.payload;
    req.token = token;
    
    logger.info(`✅ User authenticated: ${req.user.userId}`);
    next();
    
  } catch (error) {
    logger.error('❌ Auth middleware error:', error);
    res.status(500).json({
      error: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
};

/**
 * Optional authentication middleware (for public routes that benefit from user context)
 */
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const verificationResult = tokenUtils.verify(token);
      
      if (verificationResult.valid) {
        req.user = verificationResult.payload;
        req.token = token;
        logger.info(`✅ Optional auth successful: ${req.user.userId}`);
      } else {
        logger.info('ℹ️ Optional auth failed, continuing as anonymous');
      }
    }
    
    next();
    
  } catch (error) {
    logger.error('❌ Optional auth middleware error:', error);
    // Don't fail the request for optional auth
    next();
  }
};

/**
 * Role-based access control middleware
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }
    
    const userRoles = req.user.roles || [];
    const hasRequiredRole = roles.some(role => userRoles.includes(role));
    
    if (!hasRequiredRole) {
      logger.warn(`⚠️ Access denied for user ${req.user.userId}: insufficient permissions`);
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: roles,
        userRoles
      });
    }
    
    next();
  };
};

/**
 * Session validation middleware
 */
const validateSession = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: 'Valid session required',
      code: 'INVALID_SESSION'
    });
  }
  
  // Check if session user matches JWT user (if present)
  if (req.user && req.session.userId !== req.user.userId) {
    logger.warn(`⚠️ Session/JWT user mismatch: session=${req.session.userId}, jwt=${req.user.userId}`);
    return res.status(401).json({
      error: 'Session validation failed',
      code: 'SESSION_JWT_MISMATCH'
    });
  }
  
  next();
};

/**
 * HIPAA audit logging middleware
 */
const auditMiddleware = (action) => {
  return (req, res, next) => {
    const auditLog = {
      action,
      userId: req.user?.userId || 'anonymous',
      sessionId: req.sessionID,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    };
    
    // Log to audit system (implement actual audit logging)
    logger.info(`📋 AUDIT: ${JSON.stringify(auditLog)}`);
    
    next();
  };
};

module.exports = {
  passwordUtils,
  tokenUtils,
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  validateSession,
  auditMiddleware,
  authRateLimit,
  logger
};