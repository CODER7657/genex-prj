/**
 * User Routes
 * User profile management and preferences
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const User = require('../models/User');
const { authMiddleware, auditMiddleware } = require('../middlewares/auth');
const { logger } = require('../middlewares/security');

const router = express.Router();

// Rate limiting for user operations
const userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: {
    error: 'Too many user requests, please try again later.'
  }
});

// Apply rate limiting and authentication to all user routes
router.use(userLimiter);
router.use(authMiddleware);

/**
 * GET /api/users/profile
 * Get current user profile
 */
router.get('/profile', auditMiddleware('profile_view'), async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        anonymous: user.anonymous,
        isActive: user.isActive,
        isVerified: user.isVerified,
        lastLogin: user.lastLogin,
        preferences: user.preferences,
        mentalHealthProfile: user.mentalHealthProfile,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    logger.error('Profile fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      message: error.message
    });
  }
});

/**
 * PUT /api/users/profile
 * Update user profile
 */
router.put('/profile', [
  body('email').optional().isEmail().normalizeEmail(),
  body('preferences').optional().isObject(),
  body('mentalHealthProfile').optional().isObject(),
  auditMiddleware('profile_update')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, preferences, mentalHealthProfile } = req.body;
    const updates = {};

    // Handle email update
    if (email) {
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
      updates.anonymous = false;
      updates.isVerified = false; // Require re-verification
    }

    // Handle preferences update
    if (preferences) {
      updates.preferences = { ...updates.preferences, ...preferences };
    }

    // Handle mental health profile update
    if (mentalHealthProfile) {
      updates.mentalHealthProfile = { ...updates.mentalHealthProfile, ...mentalHealthProfile };
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    // Log the update for HIPAA compliance
    await user.logAction('profile_update', req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        anonymous: user.anonymous,
        preferences: user.preferences,
        mentalHealthProfile: user.mentalHealthProfile
      }
    });

  } catch (error) {
    logger.error('Profile update error:', error);
    res.status(500).json({
      error: 'Profile update failed',
      message: error.message
    });
  }
});

/**
 * PUT /api/users/preferences
 * Update user preferences only
 */
router.put('/preferences', [
  body('notifications').optional().isBoolean(),
  body('dataSharing').optional().isBoolean(),
  body('language').optional().isIn(['en', 'es', 'fr', 'de', 'it', 'pt']),
  body('timezone').optional().isString(),
  body('theme').optional().isIn(['light', 'dark', 'auto']),
  auditMiddleware('preferences_update')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const allowedPreferences = ['notifications', 'dataSharing', 'language', 'timezone', 'theme'];
    const updates = {};
    
    allowedPreferences.forEach(pref => {
      if (req.body[pref] !== undefined) {
        updates[`preferences.${pref}`] = req.body[pref];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      updates,
      { new: true, runValidators: true }
    ).select('preferences');

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: user.preferences
    });

  } catch (error) {
    logger.error('Preferences update error:', error);
    res.status(500).json({
      error: 'Preferences update failed',
      message: error.message
    });
  }
});

/**
 * PUT /api/users/mental-health-profile
 * Update mental health profile
 */
router.put('/mental-health-profile', [
  body('concerns').optional().isArray(),
  body('concerns.*').isIn(['anxiety', 'depression', 'stress', 'trauma', 'relationships', 'sleep', 'other']),
  body('severityLevel').optional().isIn(['mild', 'moderate', 'severe']),
  body('goals').optional().isArray(),
  body('triggers').optional().isArray(),
  auditMiddleware('mental_health_profile_update')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { concerns, severityLevel, goals, triggers } = req.body;
    const updates = {};
    
    if (concerns !== undefined) {
      updates['mentalHealthProfile.concerns'] = concerns;
    }
    
    if (severityLevel !== undefined) {
      updates['mentalHealthProfile.severityLevel'] = severityLevel;
    }
    
    if (goals !== undefined) {
      updates['mentalHealthProfile.goals'] = goals;
    }
    
    if (triggers !== undefined) {
      // Note: In production, triggers should be encrypted
      updates['mentalHealthProfile.triggers'] = triggers;
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      updates,
      { new: true, runValidators: true }
    ).select('mentalHealthProfile');

    // Log the sensitive data update
    await user.logAction('mental_health_profile_update', req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'Mental health profile updated successfully',
      mentalHealthProfile: user.mentalHealthProfile
    });

  } catch (error) {
    logger.error('Mental health profile update error:', error);
    res.status(500).json({
      error: 'Mental health profile update failed',
      message: error.message
    });
  }
});

/**
 * POST /api/users/crisis-event
 * Record a crisis event
 */
router.post('/crisis-event', [
  body('severity').isIn(['low', 'medium', 'high', 'critical']),
  body('notes').optional().isString().isLength({ max: 1000 }),
  auditMiddleware('crisis_event_recorded')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { severity, notes } = req.body;
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Add crisis event
    await user.addCrisisEvent(severity, notes);

    // Log the crisis event
    logger.warn(`Crisis event recorded for user ${req.user.userId}: ${severity}`, {
      userId: req.user.userId,
      severity,
      timestamp: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Crisis event recorded successfully',
      resources: {
        crisis_lines: [
          {
            name: "National Suicide Prevention Lifeline",
            number: "988",
            description: "24/7 free and confidential support"
          },
          {
            name: "Crisis Text Line",
            number: "Text HOME to 741741",
            description: "24/7 text-based crisis support"
          }
        ],
        immediate_actions: [
          "Reach out to a trusted friend, family member, or counselor",
          "Go to your nearest emergency room if in immediate danger",
          "Call 911 if you're in immediate danger"
        ]
      }
    });

  } catch (error) {
    logger.error('Crisis event recording error:', error);
    res.status(500).json({
      error: 'Failed to record crisis event',
      message: error.message
    });
  }
});

/**
 * GET /api/users/statistics
 * Get user's usage statistics
 */
router.get('/statistics', auditMiddleware('statistics_view'), async (req, res) => {
  try {
    const ChatSession = require('../models/ChatSession');
    const Message = require('../models/Message');

    // Get user's chat statistics
    const [sessionStats, messageStats, recentActivity] = await Promise.all([
      ChatSession.aggregate([
        { $match: { userId: req.user.userId } },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            activeSessions: {
              $sum: {
                $cond: [{ $eq: ['$status', 'active'] }, 1, 0]
              }
            },
            totalDuration: { $sum: '$stats.duration' },
            avgDuration: { $avg: '$stats.duration' },
            totalCrisisEvents: { $sum: '$stats.crisisEventsDetected' }
          }
        }
      ]),
      
      Message.aggregate([
        { $match: { userId: req.user.userId } },
        {
          $group: {
            _id: null,
            totalMessages: { $sum: 1 },
            userMessages: {
              $sum: {
                $cond: [{ $eq: ['$sender', 'user'] }, 1, 0]
              }
            },
            aiMessages: {
              $sum: {
                $cond: [{ $eq: ['$sender', 'ai'] }, 1, 0]
              }
            },
            avgSentiment: { $avg: '$sentiment.score' }
          }
        }
      ]),
      
      Message.find({ userId: req.user.userId })
        .sort({ createdAt: -1 })
        .limit(7)
        .select('createdAt sender')
    ]);

    const stats = {
      sessions: sessionStats[0] || {
        totalSessions: 0,
        activeSessions: 0,
        totalDuration: 0,
        avgDuration: 0,
        totalCrisisEvents: 0
      },
      messages: messageStats[0] || {
        totalMessages: 0,
        userMessages: 0,
        aiMessages: 0,
        avgSentiment: 0
      },
      recentActivity: recentActivity.map(msg => ({
        date: msg.createdAt.toISOString().split('T')[0],
        type: msg.sender
      }))
    };

    res.json({
      success: true,
      statistics: stats
    });

  } catch (error) {
    logger.error('Statistics fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

/**
 * DELETE /api/users/account
 * Delete user account (HIPAA right to be forgotten)
 */
router.delete('/account', [
  body('confirmation').equals('DELETE_MY_ACCOUNT'),
  auditMiddleware('account_deletion')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Account deletion requires confirmation',
        details: 'Please provide confirmation: DELETE_MY_ACCOUNT'
      });
    }

    // Anonymize user data instead of hard delete (HIPAA compliance)
    await User.anonymizeUser(req.user.userId);

    // Also anonymize related chat sessions and messages
    const ChatSession = require('../models/ChatSession');
    const Message = require('../models/Message');
    
    await Promise.all([
      ChatSession.updateMany(
        { userId: req.user.userId },
        { $set: { 'privacy.anonymized': true } }
      ),
      Message.updateMany(
        { userId: req.user.userId },
        { $set: { 'privacy.anonymized': true } }
      )
    ]);

    logger.info(`User account anonymized: ${req.user.userId}`);

    res.json({
      success: true,
      message: 'Account has been successfully anonymized and deactivated'
    });

  } catch (error) {
    logger.error('Account deletion error:', error);
    res.status(500).json({
      error: 'Account deletion failed',
      message: error.message
    });
  }
});

module.exports = router;