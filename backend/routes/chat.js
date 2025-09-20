/**
 * Chat Routes
 * Handles chat conversations, message history, and AI interactions
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const winston = require('winston');

const chatService = require('../ai/chatService');
const { authMiddleware } = require('../middlewares/auth');

const router = express.Router();

// Rate limiting for chat routes
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each user to 30 messages per minute
  message: { 
    success: false,
    error: 'Too many messages, please slow down a bit.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip
});

// Crisis rate limiting - more lenient
const crisisLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 messages per minute for crisis situations
  message: {
    success: false,
    error: 'Please wait before sending another message.',
    code: 'CRISIS_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * POST /api/chat/sessions
 * Create a new chat session
 */
router.post('/sessions', 
  authMiddleware,
  [
    body('title')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Title must be 1-100 characters'),
    body('initialMessage')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Initial message must be 1-1000 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { title, initialMessage } = req.body;
      const userId = req.user.userId;

      // Create new chat session
      const session = await req.app.locals.db.ChatSession.create({
        userId: userId,
        title: title || `Chat Session ${new Date().toLocaleString()}`,
        metadata: {
          createdAt: new Date(),
          userAgent: req.get('User-Agent'),
          ip: req.ip
        }
      });

      winston.info('New chat session created', { 
        sessionId: session.id, 
        userId: userId,
        hasInitialMessage: !!initialMessage
      });

      let initialResponse = null;
      
      // Process initial message if provided
      if (initialMessage) {
        try {
          initialResponse = await chatService.processMessage(
            initialMessage,
            userId,
            session.id
          );
        } catch (error) {
          winston.warn('Failed to process initial message', { 
            sessionId: session.id, 
            error: error.message 
          });
        }
      }

      res.status(201).json({
        success: true,
        data: {
          session: {
            id: session.id,
            title: session.title,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt
          },
          initialResponse: initialResponse
        }
      });

    } catch (error) {
      winston.error('Error creating chat session', { 
        error: error.message,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to create chat session'
      });
    }
  }
);

/**
 * POST /api/chat/message
 * Send a message and get AI response
 */
router.post('/message', 
  authMiddleware,
  chatLimiter, 
  [
    body('message')
      .isString()
      .trim()
      .isLength({ min: 1, max: 2000 })
      .withMessage('Message must be between 1 and 2000 characters'),
    body('sessionId')
      .optional()
      .isUUID()
      .withMessage('Invalid session ID format')
  ], 
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { message, sessionId } = req.body;
      const userId = req.user.userId;

      // Find or create chat session
      let chatSession;
      if (sessionId) {
        chatSession = await req.app.locals.db.ChatSession.findOne({
          where: {
            id: sessionId,
            userId: userId
          }
        });
      }

      if (!chatSession) {
        // Create new session if none provided or not found
        chatSession = await req.app.locals.db.ChatSession.create({
          userId,
          title: `Chat ${new Date().toLocaleDateString()}`,
          metadata: {
            autoCreated: true,
            userAgent: req.get('User-Agent'),
            ip: req.ip
          }
        });
      } else {
        // Update last activity
        await chatSession.update({ 
          updatedAt: new Date() 
        });
      }

      // Process message through AI service
      const aiResponse = await chatService.processMessage(
        message,
        userId,
        chatSession.id
      );

      // If crisis detected, log it
      if (aiResponse.crisisDetected) {
        winston.warn('Crisis situation detected in chat', {
          sessionId: chatSession.id,
          userId: userId,
          crisisLevel: aiResponse.crisisLevel
        });
      }

      res.json({
        success: true,
        data: {
          sessionId: chatSession.id,
          userMessage: {
            content: message,
            sender: 'user',
            timestamp: new Date().toISOString()
          },
          aiResponse: {
            content: aiResponse.content,
            sender: 'ai',
            timestamp: new Date().toISOString(),
            sentiment: aiResponse.sentiment,
            crisisDetected: aiResponse.crisisDetected,
            crisisLevel: aiResponse.crisisLevel,
            recommendations: aiResponse.recommendations
          }
        }
      });

    } catch (error) {
      winston.error('Chat message error', { 
        error: error.message,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to process message'
      });
    }
  }
);

/**
 * GET /api/chat/sessions
 * Get user's chat sessions
 */
router.get('/sessions', 
  authMiddleware,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const userId = req.user.userId;

      const { count, rows: sessions } = await req.app.locals.db.ChatSession.findAndCountAll({
        where: { userId: userId },
        order: [['updatedAt', 'DESC']],
        limit: limit,
        offset: offset,
        attributes: ['id', 'title', 'createdAt', 'updatedAt'],
        include: [{
          model: req.app.locals.db.Message,
          attributes: ['id', 'message', 'sender', 'createdAt'],
          limit: 1,
          order: [['createdAt', 'DESC']]
        }]
      });

      const totalPages = Math.ceil(count / limit);

      res.json({
        success: true,
        data: {
          sessions: sessions.map(session => ({
            id: session.id,
            title: session.title,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            lastMessage: session.Messages?.[0] || null
          })),
          pagination: {
            page: page,
            limit: limit,
            totalPages: totalPages,
            totalCount: count,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
          }
        }
      });

    } catch (error) {
      winston.error('Error fetching chat sessions', { 
        error: error.message,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch chat sessions'
      });
    }
  }
);

/**
 * GET /api/chat/sessions/:sessionId/messages
 * Get messages from a specific chat session
 */
router.get('/sessions/:sessionId/messages', 
  authMiddleware,
  [
    param('sessionId')
      .isUUID()
      .withMessage('Invalid session ID'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { sessionId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;
      const userId = req.user.userId;

      // Check if session belongs to user
      const session = await req.app.locals.db.ChatSession.findOne({
        where: { 
          id: sessionId, 
          userId: userId 
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Chat session not found'
        });
      }

      // Get messages for the session
      const { count, rows: messages } = await req.app.locals.db.Message.findAndCountAll({
        where: { sessionId: sessionId },
        order: [['createdAt', 'ASC']], // Chronological order for chat
        limit: limit,
        offset: offset,
        attributes: ['id', 'message', 'sender', 'createdAt', 'metadata']
      });

      const totalPages = Math.ceil(count / limit);

      res.json({
        success: true,
        data: {
          session: {
            id: session.id,
            title: session.title,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt
          },
          messages: messages,
          pagination: {
            page: page,
            limit: limit,
            totalPages: totalPages,
            totalCount: count,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
          }
        }
      });

    } catch (error) {
      winston.error('Error fetching chat session', { 
        error: error.message,
        sessionId: req.params.sessionId,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch chat session'
      });
    }
  }
);

/**
 * DELETE /api/chat/sessions/:sessionId
 * Delete a chat session and all its messages
 */
router.delete('/sessions/:sessionId', 
  authMiddleware,
  [
    param('sessionId')
      .isUUID()
      .withMessage('Invalid session ID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { sessionId } = req.params;
      const userId = req.user.userId;

      // Check if session belongs to user
      const session = await req.app.locals.db.ChatSession.findOne({
        where: { 
          id: sessionId, 
          userId: userId 
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Chat session not found'
        });
      }

      // Delete session and associated messages (cascading delete)
      await session.destroy();

      winston.info('Chat session deleted', { 
        sessionId: sessionId,
        userId: userId
      });

      res.json({
        success: true,
        message: 'Chat session deleted successfully'
      });

    } catch (error) {
      winston.error('Error deleting chat session', { 
        error: error.message,
        sessionId: req.params.sessionId,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to delete chat session'
      });
    }
  }
);

/**
 * POST /api/chat/crisis-check
 * Perform crisis analysis on a message without saving
 */
router.post('/crisis-check', 
  authMiddleware,
  [
    body('message')
      .isString()
      .trim()
      .isLength({ min: 1, max: 2000 })
      .withMessage('Message must be between 1 and 2000 characters')
  ], 
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { message } = req.body;

      // Use the AI service's crisis detection
      const analysis = await chatService.detectCrisis(message, req.user.userId);

      res.json({
        success: true,
        data: {
          crisisDetected: analysis.detected,
          crisisLevel: analysis.level,
          confidence: analysis.confidence,
          indicators: analysis.indicators,
          recommendations: analysis.recommendations,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      winston.error('Crisis check error', { 
        error: error.message,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to analyze message for crisis indicators'
      });
    }
  }
);

/**
 * GET /api/chat/export
 * Export user's chat data
 */
router.get('/export', 
  authMiddleware,
  async (req, res) => {
    try {
      const userId = req.user.userId;

      // Get all sessions with messages for the user
      const sessions = await req.app.locals.db.ChatSession.findAll({
        where: { userId: userId },
        include: [{
          model: req.app.locals.db.Message,
          attributes: ['id', 'message', 'sender', 'createdAt', 'metadata']
        }],
        order: [['createdAt', 'DESC']]
      });
      
      const exportData = {
        exportDate: new Date().toISOString(),
        userId: userId,
        totalSessions: sessions.length,
        sessions: sessions.map(session => ({
          sessionId: session.id,
          title: session.title,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          messageCount: session.Messages?.length || 0,
          messages: session.Messages?.map(msg => ({
            id: msg.id,
            content: msg.message,
            sender: msg.sender,
            timestamp: msg.createdAt,
            metadata: msg.metadata
          })) || []
        }))
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="mental-wellness-chat-export-${userId}-${Date.now()}.json"`);
      
      res.json({
        success: true,
        data: exportData
      });

    } catch (error) {
      winston.error('Export error', { 
        error: error.message,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to export chat data'
      });
    }
  }
);

/**
 * GET /api/chat/stats
 * Get user's chat statistics
 */
router.get('/stats',
  authMiddleware,
  async (req, res) => {
    try {
      const userId = req.user.userId;

      // Get various statistics
      const [
        totalSessions,
        totalMessages,
        recentSessions,
        serviceStats
      ] = await Promise.all([
        req.app.locals.db.ChatSession.count({ where: { userId } }),
        req.app.locals.db.Message.count({
          include: [{
            model: req.app.locals.db.ChatSession,
            where: { userId },
            attributes: []
          }]
        }),
        req.app.locals.db.ChatSession.count({
          where: { 
            userId,
            createdAt: {
              [req.app.locals.db.sequelize.Sequelize.Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            }
          }
        }),
        Promise.resolve(chatService.getStats())
      ]);

      res.json({
        success: true,
        data: {
          user: {
            totalSessions,
            totalMessages,
            recentSessions
          },
          service: {
            totalMessagesProcessed: serviceStats.messagesProcessed,
            crisisDetected: serviceStats.crisisDetected,
            aiResponses: serviceStats.aiResponses,
            fallbackResponses: serviceStats.fallbackResponses,
            averageResponseTime: serviceStats.averageResponseTime,
            uptime: serviceStats.uptime
          }
        }
      });

    } catch (error) {
      winston.error('Error fetching chat statistics', { 
        error: error.message,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch statistics'
      });
    }
  }
);

module.exports = router;
