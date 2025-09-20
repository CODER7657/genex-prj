/**
 * ChatSession Model
 * Represents a conversation session between user and AI
 */

const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema({
  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Session identification
  sessionId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  
  // Session metadata
  title: {
    type: String,
    default: 'New Conversation',
    maxlength: 200
  },
  
  description: {
    type: String,
    maxlength: 500
  },
  
  // Session status
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'archived'],
    default: 'active',
    index: true
  },
  
  // AI model used
  aiModel: {
    type: String,
    enum: ['gemini-pro', 'gpt-3.5-turbo', 'gpt-4', 'fallback'],
    default: 'gemini-pro'
  },
  
  // Session settings
  settings: {
    language: {
      type: String,
      default: 'en'
    },
    tone: {
      type: String,
      enum: ['supportive', 'professional', 'casual', 'empathetic'],
      default: 'empathetic'
    },
    crisisDetectionEnabled: {
      type: Boolean,
      default: true
    }
  },
  
  // Session statistics
  stats: {
    messageCount: {
      type: Number,
      default: 0
    },
    duration: {
      type: Number, // in minutes
      default: 0
    },
    lastActivity: {
      type: Date,
      default: Date.now,
      index: true
    },
    crisisEventsDetected: {
      type: Number,
      default: 0
    }
  },
  
  // Mental health context
  context: {
    primaryConcerns: [{
      type: String,
      enum: ['anxiety', 'depression', 'stress', 'trauma', 'relationships', 'sleep', 'other']
    }],
    sessionGoals: [String],
    moodAtStart: {
      type: Number,
      min: 1,
      max: 10
    },
    moodAtEnd: {
      type: Number,
      min: 1,
      max: 10
    }
  },
  
  // Crisis detection history for this session
  crisisEvents: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true
    },
    triggerWords: [String],
    aiResponse: String,
    resolved: {
      type: Boolean,
      default: false
    },
    escalated: {
      type: Boolean,
      default: false
    }
  }],
  
  // Session summary (generated at end)
  summary: {
    keyTopics: [String],
    sentiment: {
      overall: String,
      trend: String // improving, stable, declining
    },
    recommendedFollowUp: String,
    aiGeneratedSummary: String
  },
  
  // HIPAA compliance
  dataRetention: {
    expiresAt: {
      type: Date,
      // Default to 7 years for HIPAA compliance
      default: () => new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000)
    },
    archived: {
      type: Boolean,
      default: false
    }
  },
  
  // Privacy settings
  privacy: {
    encrypted: {
      type: Boolean,
      default: true
    },
    anonymized: {
      type: Boolean,
      default: false
    },
    sharedWithProvider: {
      type: Boolean,
      default: false
    }
  }
  
}, {
  timestamps: true,
  collection: 'chatSessions'
});

// Indexes for performance
chatSessionSchema.index({ userId: 1, createdAt: -1 });
chatSessionSchema.index({ sessionId: 1 }, { unique: true });
chatSessionSchema.index({ status: 1, 'stats.lastActivity': -1 });
chatSessionSchema.index({ 'dataRetention.expiresAt': 1 }); // For data cleanup

// Virtual for session duration in human readable format
chatSessionSchema.virtual('durationFormatted').get(function() {
  const minutes = this.stats.duration;
  if (minutes < 60) {
    return `${minutes} minutes`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
});

// Virtual for active status check
chatSessionSchema.virtual('isActive').get(function() {
  return this.status === 'active' && 
         this.stats.lastActivity > new Date(Date.now() - 30 * 60 * 1000); // Active if used in last 30 minutes
});

// Pre-save middleware to update stats
chatSessionSchema.pre('save', function(next) {
  if (this.isModified('stats.lastActivity')) {
    // Update session duration when activity changes
    if (this.createdAt) {
      this.stats.duration = Math.floor((this.stats.lastActivity - this.createdAt) / (1000 * 60));
    }
  }
  next();
});

// Method to add a crisis event
chatSessionSchema.methods.addCrisisEvent = function(severity, triggerWords = [], aiResponse = '') {
  this.crisisEvents.push({
    severity,
    triggerWords,
    aiResponse,
    timestamp: new Date()
  });
  
  this.stats.crisisEventsDetected = (this.stats.crisisEventsDetected || 0) + 1;
  
  return this.save();
};

// Method to update activity and message count
chatSessionSchema.methods.recordActivity = function() {
  this.stats.lastActivity = new Date();
  this.stats.messageCount = (this.stats.messageCount || 0) + 1;
  
  return this.save();
};

// Method to complete session and generate summary
chatSessionSchema.methods.completeSession = async function(moodAtEnd, aiGeneratedSummary) {
  this.status = 'completed';
  this.context.moodAtEnd = moodAtEnd;
  this.summary.aiGeneratedSummary = aiGeneratedSummary;
  
  // Calculate mood trend
  if (this.context.moodAtStart && moodAtEnd) {
    const improvement = moodAtEnd - this.context.moodAtStart;
    if (improvement >= 2) {
      this.summary.sentiment.trend = 'improving';
    } else if (improvement <= -2) {
      this.summary.sentiment.trend = 'declining';
    } else {
      this.summary.sentiment.trend = 'stable';
    }
  }
  
  return this.save();
};

// Static method to find active sessions for user
chatSessionSchema.statics.findActiveForUser = function(userId) {
  return this.find({
    userId,
    status: 'active',
    'stats.lastActivity': { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
  }).sort({ 'stats.lastActivity': -1 });
};

// Static method to find sessions that need cleanup (expired)
chatSessionSchema.statics.findExpiredSessions = function() {
  return this.find({
    'dataRetention.expiresAt': { $lt: new Date() },
    'dataRetention.archived': false
  });
};

// Static method to get user's session history
chatSessionSchema.statics.getUserHistory = function(userId, limit = 10) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('title status stats.messageCount stats.duration createdAt summary.keyTopics');
};

// Transform JSON output (remove sensitive data)
chatSessionSchema.methods.toJSON = function() {
  const sessionObject = this.toObject();
  
  // Remove sensitive fields for client
  if (sessionObject.privacy && !sessionObject.privacy.sharedWithProvider) {
    delete sessionObject.crisisEvents;
    delete sessionObject.summary.aiGeneratedSummary;
  }
  
  return sessionObject;
};

// Method to anonymize session data
chatSessionSchema.methods.anonymize = function() {
  this.privacy.anonymized = true;
  this.context.sessionGoals = [];
  this.crisisEvents = [];
  this.summary = {
    keyTopics: [],
    sentiment: {},
    recommendedFollowUp: '',
    aiGeneratedSummary: ''
  };
  
  return this.save();
};

module.exports = mongoose.model('ChatSession', chatSessionSchema);