/**
 * Authentication Routes
 * Handles user registration, login, and token management
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const User = require('../models/User');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: 'Too many authentication attempts, please try again later.' }
});

/**
 * POST /api/auth/register
 * Register a new user (anonymous or with email)
 */
router.post('/register', authLimiter, [
  body('email').optional().isEmail().normalizeEmail(),
  body('password').optional().isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('age').isInt({ min: 13, max: 120 })
    .withMessage('Age must be between 13 and 120'),
  body('anonymous').optional().isBoolean(),
  body('termsAccepted').equals('true')
    .withMessage('You must accept the terms and conditions')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password, age, anonymous = true, termsAccepted } = req.body;

    // Check if user already exists (for non-anonymous)
    if (email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          error: 'User already exists with this email'
        });
      }
    }

    // Create user
    const userData = {
      age,
      anonymous,
      termsAccepted: true,
      registrationDate: new Date(),
      isActive: true
    };

    if (!anonymous && email && password) {
      userData.email = email;
      userData.password = await bcrypt.hash(password, 12);
    }

    const user = new User(userData);
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id,
        anonymous: user.anonymous 
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        anonymous: user.anonymous,
        age: user.age,
        email: user.email || null
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'An error occurred during registration'
    });
  }
});

/**
 * POST /api/auth/login
 * Login user with email and password
 */
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
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

    // Find user
    const user = await User.findOne({ email, anonymous: false });
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id,
        anonymous: user.anonymous 
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        age: user.age,
        anonymous: user.anonymous
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'An error occurred during login'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'User not found or inactive'
      });
    }

    // Generate new token
    const token = jwt.sign(
      { 
        userId: user._id,
        anonymous: user.anonymous 
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Token refreshed successfully',
      token
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (invalidate token)
 */
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    // In a production environment, you might want to blacklist the token
    // For now, we'll just return a success message
    res.json({
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('-password')
      .populate('moodEntries', null, null, { 
        sort: { createdAt: -1 }, 
        limit: 5 
      });

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email || null,
        age: user.age,
        anonymous: user.anonymous,
        registrationDate: user.registrationDate,
        lastLogin: user.lastLogin,
        preferences: user.preferences,
        recentMoodEntries: user.moodEntries
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to get user information'
    });
  }
});

/**
 * DELETE /api/auth/account
 * Delete user account and all associated data
 */
router.delete('/account', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Delete user and all associated data
    await User.findByIdAndDelete(userId);
    
    // Additional cleanup for related collections would go here
    // e.g., chat history, mood entries, etc.

    res.json({
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({
      error: 'Failed to delete account'
    });
  }
});

module.exports = router;