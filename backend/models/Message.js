/**
 * Message Model
 * Individual messages within chat sessions
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // References
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession',
    required: true,
    index: true
  },
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Message identification
  messageId: {
    type: String,
    unique: true,
    required: true
  },
  
  // Message content
  content: {
    type: String,
    required: true,
    maxlength: 4000
  },
  
  // Message metadata
  sender: {
    type: String,
    enum: ['user', 'ai'],
    required: true,
    index: true
  },
  
  messageType: {
    type: String,
    enum: ['text', 'system', 'crisis_alert', 'resource_share', 'assessment'],
    default: 'text'
  },
  
  // AI-specific fields
  aiMetadata: {
    model: {
      type: String,
      enum: ['gemini-pro', 'gpt-3.5-turbo', 'gpt-4', 'fallback']
    },
    responseTime: {
      type: Number // milliseconds
    },
    tokensUsed: {
      type: Number
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    fallbackUsed: {
      type: Boolean,
      default: false
    }
  },
  
  // Sentiment analysis
  sentiment: {
    score: {
      type: Number,
      min: -5,
      max: 5
    },
    magnitude: {
      type: Number,
      min: 0,
      max: 5
    },
    label: {
      type: String,
      enum: ['very_negative', 'negative', 'neutral', 'positive', 'very_positive']
    },
    keywords: [String]
  },
  
  // Crisis detection
  crisisAnalysis: {
    detected: {
      type: Boolean,
      default: false,
      index: true
    },
    severity: {
      type: String,
      enum: ['none', 'low', 'medium', 'high', 'critical']
    },
    keywords: [String],
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    escalated: {
      type: Boolean,
      default: false
    },
    resourcesProvided: {
      type: Boolean,
      default: false
    }
  },
  
  // Message status
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'read', 'archived'],
    default: 'sent',
    index: true
  },
  
  // Threading support
  parentMessageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  
  threadDepth: {
    type: Number,
    default: 0
  },
  
  // Feedback and quality
  feedback: {
    helpful: {
      type: Boolean,
      default: null
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      maxlength: 500
    },
    reportedIssue: {
      type: Boolean,
      default: false
    }
  },
  
  // Content analysis
  analysis: {
    topics: [String],
    emotions: [{
      emotion: String,
      confidence: Number
    }],
    intents: [String],
    entities: [{
      type: String,
      value: String,
      confidence: Number
    }]
  },
  
  // Privacy and security
  privacy: {
    encrypted: {
      type: Boolean,
      default: true
    },
    sanitized: {
      type: Boolean,
      default: false
    },
    redacted: {
      type: Boolean,
      default: false
    }
  },
  
  // Edit history (for AI messages that might be regenerated)
  editHistory: [{
    previousContent: String,
    editReason: String,
    editedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Delivery tracking
  delivery: {
    attempts: {
      type: Number,
      default: 0
    },
    lastAttempt: {
      type: Date
    },
    successful: {
      type: Boolean,
      default: true
    },
    error: String
  }
  
}, {
  timestamps: true,
  collection: 'messages'
});

// Indexes for performance
messageSchema.index({ sessionId: 1, createdAt: 1 });
messageSchema.index({ userId: 1, createdAt: -1 });
messageSchema.index({ messageId: 1 }, { unique: true });
messageSchema.index({ 'crisisAnalysis.detected': 1, 'crisisAnalysis.severity': 1 });
messageSchema.index({ sender: 1, status: 1 });

// Virtual for message age in human readable format
messageSchema.virtual('ageFormatted').get(function() {
  const now = new Date();
  const diffMs = now - this.createdAt;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} days ago`;
});

// Virtual for crisis status
messageSchema.virtual('hasCrisis').get(function() {
  return this.crisisAnalysis && this.crisisAnalysis.detected && 
         ['medium', 'high', 'critical'].includes(this.crisisAnalysis.severity);
});

// Pre-save middleware to generate messageId if not provided
messageSchema.pre('save', function(next) {
  if (!this.messageId) {
    this.messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

// Method to add sentiment analysis
messageSchema.methods.addSentimentAnalysis = function(score, magnitude, label, keywords = []) {
  this.sentiment = {
    score,
    magnitude,
    label,
    keywords
  };
  return this.save();
};

// Method to add crisis analysis
messageSchema.methods.addCrisisAnalysis = function(detected, severity, keywords = [], confidence = 0) {
  this.crisisAnalysis = {
    detected,
    severity: detected ? severity : 'none',
    keywords,
    confidence
  };
  return this.save();
};

// Method to mark crisis as escalated
messageSchema.methods.escalateCrisis = function() {
  if (this.crisisAnalysis) {
    this.crisisAnalysis.escalated = true;
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to add feedback
messageSchema.methods.addFeedback = function(helpful, rating = null, comment = '') {
  this.feedback = {
    helpful,
    rating,
    comment,
    reportedIssue: false
  };
  return this.save();
};

// Method to report issue
messageSchema.methods.reportIssue = function(comment = '') {
  this.feedback = this.feedback || {};
  this.feedback.reportedIssue = true;
  this.feedback.comment = comment;
  return this.save();
};

// Method to edit message content (for AI messages)
messageSchema.methods.editContent = function(newContent, reason = 'content_improvement') {
  // Store previous content in edit history
  this.editHistory.push({
    previousContent: this.content,
    editReason: reason,
    editedAt: new Date()
  });
  
  // Update content
  this.content = newContent;
  
  return this.save();
};

// Static method to find crisis messages
messageSchema.statics.findCrisisMessages = function(userId, limit = 50) {
  return this.find({
    userId,
    'crisisAnalysis.detected': true
  }).sort({ createdAt: -1 }).limit(limit);
};

// Static method to find messages by session
messageSchema.statics.findBySession = function(sessionId, limit = 100) {
  return this.find({ sessionId })
    .sort({ createdAt: 1 })
    .limit(limit)
    .populate('parentMessageId', 'content sender createdAt');
};

// Static method to find recent messages for user
messageSchema.statics.findRecentForUser = function(userId, limit = 20) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sessionId', 'title status');
};

// Static method to get conversation thread
messageSchema.statics.getThread = function(messageId) {
  return this.findById(messageId)
    .populate({
      path: 'parentMessageId',
      populate: { path: 'parentMessageId' }
    });
};

// Static method for analytics - get sentiment trends
messageSchema.statics.getSentimentTrends = function(userId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate },
        'sentiment.score': { $exists: true }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
        },
        avgSentiment: { $avg: "$sentiment.score" },
        messageCount: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

// Transform JSON output (remove sensitive data)
messageSchema.methods.toJSON = function() {
  const messageObject = this.toObject();
  
  // Remove sensitive fields for client
  if (messageObject.privacy && !messageObject.privacy.sanitized) {
    // Keep original content but mark as potentially sensitive
    messageObject.contentSensitive = true;
  }
  
  return messageObject;
};

// Method to sanitize message content
messageSchema.methods.sanitize = function() {
  // Remove or mask sensitive information
  const sensitivePatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b\d{16}\b/g, // Credit card
    /\b[\w._%+-]+@[\w.-]+\.[A-Z]{2,}\b/gi, // Email
    /\b\d{3}-\d{3}-\d{4}\b/g // Phone
  ];
  
  let sanitizedContent = this.content;
  sensitivePatterns.forEach(pattern => {
    sanitizedContent = sanitizedContent.replace(pattern, '[REDACTED]');
  });
  
  this.content = sanitizedContent;
  this.privacy.sanitized = true;
  
  return this.save();
};

module.exports = mongoose.model('Message', messageSchema);