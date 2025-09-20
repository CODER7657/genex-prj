/**
 * Authentication Routes (Sequelize)
 * Handles user registration, login, and token management
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { db } = require('../models');

const { authMiddleware, passwordUtils, tokenUtils } = require('../middlewares/auth');

const router = express.Router();

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.'
  }
});

/**
 * POST /api/auth/register
 * Register a new user (anonymous or with email)
 */
router.post('/register', authLimiter, [
  body('age').isInt({ min: 13, max: 120 }).withMessage('Age must be between 13 and 120'),
  body('email').optional().isEmail().normalizeEmail(),
  body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('anonymous').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { age, email, password, anonymous = true, termsAccepted } = req.body;

    // Check terms acceptance
    if (!termsAccepted) {
      return res.status(400).json({
        error: 'Terms must be accepted'
      });
    }

    // Check if user already exists (for non-anonymous users)
    if (!anonymous && email) {
      const existingUser = await db.User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          error: 'User already exists with this email'
        });
      }
    }

    // Create user data
    const userData = {
      age,
      anonymous,
      termsAccepted,
      privacyPolicyAccepted: termsAccepted
    };

    // Add email/password for registered users
    if (!anonymous) {
      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required for registered users'
        });
      }
      userData.email = email;
      userData.password = password;
    }

    // Create new user
    const user = await db.User.create(userData);

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        anonymous: user.anonymous 
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: anonymous ? '24h' : '7d',
        issuer: 'mental-wellness-ai',
        audience: 'mental-wellness-users'
      }
    );

    // Generate refresh token for registered users
    let refreshToken = null;
    if (!anonymous) {
      refreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_REFRESH_SECRET,
        { 
          expiresIn: '30d',
          issuer: 'mental-wellness-ai',
          audience: 'mental-wellness-users'
        }
      );
    }

    // Log registration event
    await user.logAuditEvent('user_registered', {
      method: anonymous ? 'anonymous' : 'email',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      message: anonymous ? 'Anonymous user created successfully' : 'User registered successfully',
      user: {
        id: user.id,
        anonymous: user.anonymous,
        email: user.anonymous ? null : user.email,
        age: user.age,
        createdAt: user.createdAt
      },
      tokens: {
        accessToken: token,
        refreshToken,
        expiresIn: anonymous ? '24h' : '7d'
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/login
 * Login existing user
 */
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user with password included
    const user = await db.User.scope('withPassword').findByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Check if account is locked
    if (user.isAccountLocked()) {
      return res.status(423).json({
        error: 'Account temporarily locked due to multiple failed login attempts',
        lockUntil: user.lockUntil
      });
    }

    // Verify password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      await user.updateLoginAttempt(false);
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Successful login
    await user.updateLoginAttempt(true);

    // Generate tokens
    const token = jwt.sign(
      { 
        userId: user.id,
        anonymous: false 
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: '7d',
        issuer: 'mental-wellness-ai'
      }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET,
      { 
        expiresIn: '30d',
        issuer: 'mental-wellness-ai'
      }
    );

    // Log login event
    await user.logAuditEvent('user_login', {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        anonymous: user.anonymous,
        age: user.age,
        lastLogin: user.lastLogin,
        preferences: user.preferences
      },
      tokens: {
        accessToken: token,
        refreshToken,
        expiresIn: '7d'
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', [
  body('refreshToken').notEmpty()
], async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // Find user
    const user = await db.User.findByPk(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Invalid refresh token'
      });
    }

    // Generate new access token
    const newToken = jwt.sign(
      { 
        userId: user.id,
        anonymous: user.anonymous 
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: '7d',
        issuer: 'mental-wellness-ai'
      }
    );

    res.json({
      success: true,
      tokens: {
        accessToken: newToken,
        expiresIn: '7d'
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Invalid or expired refresh token'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user and invalidate tokens
 */
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const user = await db.User.findByPk(req.user.userId);
    if (user) {
      await user.logAuditEvent('user_logout', {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

    // In a production app, you'd want to blacklist the token
    // For now, we'll just return success
    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: error.message
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.User.findByPk(req.user.userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.anonymous ? null : user.email,
        anonymous: user.anonymous,
        age: user.age,
        preferences: user.preferences,
        mentalHealthProfile: user.mentalHealthProfile,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to get user profile',
      message: error.message
    });
  }
});

module.exports = router;