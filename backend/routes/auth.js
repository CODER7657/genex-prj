/**
 * Authentication Routes
 * Handles user registration, login, and token management
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const User = require('../models/User');
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
  body('email').optional().isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
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

    const { email, password, anonymous = false } = req.body;

    // Check if user already exists (for non-anonymous users)
    if (!anonymous && email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          error: 'User already exists with this email'
        });
      }
    }

    // Validate password strength
    const passwordValidation = passwordUtils.validate(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: 'Password does not meet requirements',
        details: passwordValidation.errors
      });
    }

    // Create user data
    const userData = {
      anonymous,
      password: await passwordUtils.hash(password),
      isActive: true,
      preferences: {
        notifications: true,
        dataSharing: false
      }
    };

    if (!anonymous && email) {
      userData.email = email;
    }

    // Create user
    const user = new User(userData);
    await user.save();

    // Generate JWT token
    const token = tokenUtils.generate({
      userId: user._id,
      email: user.email,
      anonymous: user.anonymous
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        anonymous: user.anonymous
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
 * Login user with email and password
 */
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
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

    // Find user by email
    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Verify password
    const isValidPassword = await passwordUtils.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = tokenUtils.generate({
      userId: user._id,
      email: user.email,
      anonymous: user.anonymous
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        anonymous: user.anonymous
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
    const token = tokenUtils.generate({
      userId: user._id,
      email: user.email,
      anonymous: user.anonymous
    });

    res.json({
      message: 'Token refreshed successfully',
      token
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (invalidate session)
 */
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    // In a production app, you'd want to blacklist the token
    // For now, just clear the session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
      }
    });

    res.json({
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
 * GET /api/auth/profile
 * Get current user profile
 */
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        anonymous: user.anonymous,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        preferences: user.preferences
      }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      message: error.message
    });
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile', authMiddleware, [
  body('email').optional().isEmail().normalizeEmail(),
  body('preferences').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, preferences } = req.body;
    const updates = {};

    if (email) {
      // Check if email is already in use by another user
      const existingUser = await User.findOne({ 
        email, 
        _id: { $ne: req.user.userId }
      });
      
      if (existingUser) {
        return res.status(400).json({
          error: 'Email already in use by another user'
        });
      }
      
      updates.email = email;
      updates.anonymous = false; // If setting email, no longer anonymous
    }

    if (preferences) {
      updates.preferences = { ...updates.preferences, ...preferences };
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      updates,
      { new: true }
    ).select('-password');

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        anonymous: user.anonymous,
        preferences: user.preferences
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      error: 'Profile update failed',
      message: error.message
    });
  }
});

module.exports = router;