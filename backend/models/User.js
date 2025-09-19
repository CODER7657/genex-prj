/**
 * User Model
 * Defines the user schema for MongoDB
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Information
  email: {
    type: String,
    sparse: true, // Allows null for anonymous users
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    select: false // Don't return password by default
  },
  age: {
    type: Number,
    required: true,
    min: 13,
    max: 120
  },
  anonymous: {
    type: Boolean,
    default: true
  },

  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  termsAccepted: {
    type: Boolean,
    required: true
  },

  // User Preferences
  preferences: {
    notifications: {
      dailyCheckin: {
        type: Boolean,
        default: true
      },
      crisisAlerts: {
        type: Boolean,
        default: true
      },
      weeklyReport: {
        type: Boolean,
        default: false
      }
    },
    privacy: {
      shareAnonymousData: {
        type: Boolean,
        default: false
      },
      allowResearch: {
        type: Boolean,
        default: false
      }
    },
    chat: {
      aiPersonality: {
        type: String,
        enum: ['supportive', 'professional', 'friendly'],
        default: 'supportive'
      },
      crisisDetectionSensitivity: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
      }
    }
  },

  // Mental Health Profile
  mentalHealthProfile: {
    primaryConcerns: [{
      type: String,
      enum: ['anxiety', 'depression', 'stress', 'relationships', 'school', 'family', 'identity', 'other']
    }],
    previousTherapy: {
      type: Boolean,
      default: null
    },
    currentSupport: [{
      type: String,
      enum: ['family', 'friends', 'therapist', 'counselor', 'support_group', 'none']
    }],
    emergencyContacts: [{
      name: String,
      phone: String,
      relationship: String
    }]
  },

  // Data Tracking
  totalChatSessions: {
    type: Number,
    default: 0
  },
  totalMessages: {
    type: Number,
    default: 0
  },
  crisisEventsCount: {
    type: Number,
    default: 0
  },
  lastCrisisEvent: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      return ret;
    }
  }
});

// Virtual for mood entries
userSchema.virtual('moodEntries', {
  ref: 'MoodEntry',
  localField: '_id',
  foreignField: 'userId'
});

// Virtual for chat sessions
userSchema.virtual('chatSessions', {
  ref: 'ChatSession',
  localField: '_id',
  foreignField: 'userId'
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    const hashedPassword = await bcrypt.hash(this.password, 12);
    this.password = hashedPassword;
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to update activity
userSchema.methods.updateActivity = function() {
  this.lastLogin = new Date();
  return this.save();
};

// Method to increment chat stats
userSchema.methods.incrementChatStats = function() {
  this.totalChatSessions += 1;
  this.totalMessages += 1;
  return this.save();
};

// Method to record crisis event
userSchema.methods.recordCrisisEvent = function() {
  this.crisisEventsCount += 1;
  this.lastCrisisEvent = new Date();
  return this.save();
};

// Method to get user summary (anonymized)
userSchema.methods.getAnonymizedSummary = function() {
  return {
    id: this._id.toString().substring(0, 8) + '...',
    age: this.age,
    anonymous: this.anonymous,
    registrationMonth: this.registrationDate.getMonth() + 1,
    registrationYear: this.registrationDate.getFullYear(),
    totalSessions: this.totalChatSessions,
    totalMessages: this.totalMessages,
    primaryConcerns: this.mentalHealthProfile?.primaryConcerns || []
  };
};

// Indexes for performance
userSchema.index({ email: 1 }, { sparse: true });
userSchema.index({ anonymous: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ registrationDate: -1 });
userSchema.index({ lastLogin: -1 });

// Static method to find active users
userSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Static method to get user statistics
userSchema.statics.getUserStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        anonymousUsers: {
          $sum: { $cond: [{ $eq: ['$anonymous', true] }, 1, 0] }
        },
        registeredUsers: {
          $sum: { $cond: [{ $eq: ['$anonymous', false] }, 1, 0] }
        },
        averageAge: { $avg: '$age' },
        totalChatSessions: { $sum: '$totalChatSessions' },
        totalMessages: { $sum: '$totalMessages' },
        totalCrisisEvents: { $sum: '$crisisEventsCount' }
      }
    }
  ]);

  return stats[0] || {};
};

module.exports = mongoose.model('User', userSchema);