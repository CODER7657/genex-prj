/**
 * Chat Routes
 * Handles chat conversations, message history, and AI interactions
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const chatService = require('../ai/chatService');
const crisisDetection = require('../ai/crisisDetection');
const ChatSession = require('../models/ChatSession');
const Message = require('../models/Message');

const router = express.Router();

// Rate limiting for chat routes
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each user to 30 messages per minute
  message: { error: 'Too many messages, please slow down a bit.' }
});

/**
 * POST /api/chat/message
 * Send a message and get AI response
 */
router.post('/message', chatLimiter, [
  body('message').notEmpty().trim()
    .isLength({ max: 2000 })
    .withMessage('Message must be between 1 and 2000 characters'),
  body('sessionId').optional().isMongoId()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { message, sessionId } = req.body;
    const userId = req.user.userId;

    // Find or create chat session
    let chatSession;
    if (sessionId) {
      chatSession = await ChatSession.findOne({
        _id: sessionId,
        userId: userId
      });
    }

    if (!chatSession) {
      chatSession = new ChatSession({
        userId,
        startedAt: new Date(),
        lastActivity: new Date(),
        isActive: true
      });
      await chatSession.save();
    } else {
      chatSession.lastActivity = new Date();
      await chatSession.save();
    }

    // Save user message
    const userMessage = new Message({
      sessionId: chatSession._id,
      userId,
      content: message,
      type: 'user',
      timestamp: new Date()
    });
    await userMessage.save();

    // Process message through AI service
    const aiResponse = await chatService.processMessage(
      message,
      userId,
      chatSession._id.toString()
    );

    // Save AI response
    const aiMessage = new Message({
      sessionId: chatSession._id,
      userId,
      content: aiResponse.content,
      type: 'assistant',
      timestamp: new Date(),
      metadata: {
        sentiment: aiResponse.sentiment,
        crisisDetected: aiResponse.crisisDetected,
        crisisLevel: aiResponse.crisisLevel
      }
    });
    await aiMessage.save();

    // Update session with crisis info if detected
    if (aiResponse.crisisDetected) {
      chatSession.crisisDetected = true;
      chatSession.highestCrisisLevel = aiResponse.crisisLevel;
      await chatSession.save();
    }

    res.json({
      success: true,
      sessionId: chatSession._id,
      message: {
        id: aiMessage._id,
        content: aiResponse.content,
        type: 'assistant',
        timestamp: aiMessage.timestamp
      },
      sentiment: aiResponse.sentiment,
      crisisDetected: aiResponse.crisisDetected,
      crisisLevel: aiResponse.crisisLevel,
      emergencyResources: aiResponse.emergencyResources
    });

  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({
      error: 'Failed to process message',
      message: 'An error occurred while processing your message'
    });
  }
});

/**
 * GET /api/chat/sessions
 * Get user's chat sessions
 */
router.get('/sessions', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;

    const sessions = await ChatSession.find({ userId })
      .sort({ lastActivity: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('messages', 'content type timestamp', null, {
        sort: { timestamp: -1 },
        limit: 5
      });

    const total = await ChatSession.countDocuments({ userId });

    res.json({
      sessions: sessions.map(session => ({
        id: session._id,
        startedAt: session.startedAt,
        lastActivity: session.lastActivity,
        messageCount: session.messageCount,
        isActive: session.isActive,
        crisisDetected: session.crisisDetected,
        recentMessages: session.messages
      })),
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      error: 'Failed to retrieve chat sessions'
    });
  }
});

/**
 * GET /api/chat/sessions/:sessionId/messages
 * Get messages from a specific chat session
 */
router.get('/sessions/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;
    const { page = 1, limit = 50 } = req.query;

    // Verify session belongs to user
    const session = await ChatSession.findOne({
      _id: sessionId,
      userId
    });

    if (!session) {
      return res.status(404).json({
        error: 'Chat session not found'
      });
    }

    const messages = await Message.find({ sessionId })
      .sort({ timestamp: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Message.countDocuments({ sessionId });

    res.json({
      sessionId,
      messages: messages.map(msg => ({
        id: msg._id,
        content: msg.content,
        type: msg.type,
        timestamp: msg.timestamp,
        metadata: msg.metadata
      })),
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      error: 'Failed to retrieve messages'
    });
  }
});

/**
 * DELETE /api/chat/sessions/:sessionId
 * Delete a chat session and all its messages
 */
router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    // Verify session belongs to user
    const session = await ChatSession.findOne({
      _id: sessionId,
      userId
    });

    if (!session) {
      return res.status(404).json({
        error: 'Chat session not found'
      });
    }

    // Delete all messages in the session
    await Message.deleteMany({ sessionId });

    // Delete the session
    await ChatSession.findByIdAndDelete(sessionId);

    res.json({
      message: 'Chat session deleted successfully'
    });

  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({
      error: 'Failed to delete chat session'
    });
  }
});

/**
 * POST /api/chat/crisis-check
 * Perform crisis analysis on a message without saving
 */
router.post('/crisis-check', [
  body('message').notEmpty().trim()
    .isLength({ max: 2000 })
    .withMessage('Message must be between 1 and 2000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { message } = req.body;

    // Perform crisis analysis
    const analysis = crisisDetection.analyzeCrisis(message);
    const response = crisisDetection.getCrisisResponse(analysis.overallRisk);

    res.json({
      riskLevel: analysis.overallRisk,
      analysis: analysis.details,
      response: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Crisis check error:', error);
    res.status(500).json({
      error: 'Failed to analyze message for crisis indicators'
    });
  }
});

/**
 * GET /api/chat/export
 * Export user's chat data
 */
router.get('/export', async (req, res) => {
  try {
    const userId = req.user.userId;

    const sessions = await ChatSession.find({ userId }).populate('messages');
    
    const exportData = {
      exportDate: new Date().toISOString(),
      userId: userId,
      sessions: sessions.map(session => ({
        sessionId: session._id,
        startedAt: session.startedAt,
        lastActivity: session.lastActivity,
        messageCount: session.messageCount,
        crisisDetected: session.crisisDetected,
        messages: session.messages.map(msg => ({
          content: msg.content,
          type: msg.type,
          timestamp: msg.timestamp
        }))
      }))
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="chat-export-${userId}-${Date.now()}.json"`);
    res.json(exportData);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      error: 'Failed to export chat data'
    });
  }
});

module.exports = router;