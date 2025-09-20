/**
 * ChatSession Model
 * Sequelize model for chat session data
 */

const { DataTypes, Model } = require('sequelize');

class ChatSession extends Model {
  async addMessage(messageData) {
    this.messageCount = (this.messageCount || 0) + 1;
    this.lastActivity = new Date();
    
    if (messageData.crisis_detected) {
      this.crisisEvents = this.crisisEvents || [];
      this.crisisEvents.push({
        timestamp: new Date(),
        severity: messageData.crisis_severity || 'medium',
        triggers: messageData.crisis_triggers || [],
        message_id: messageData.id
      });
    }
    
    await this.save();
  }

  async updateSessionStats(messageData) {
    if (!this.aiMetadata) {
      this.aiMetadata = {};
    }
    
    // Update sentiment tracking
    if (messageData.sentiment) {
      if (!this.aiMetadata.sentimentHistory) {
        this.aiMetadata.sentimentHistory = [];
      }
      this.aiMetadata.sentimentHistory.push({
        timestamp: new Date(),
        sentiment: messageData.sentiment,
        score: messageData.sentiment_score
      });
      
      // Keep only last 50 sentiment entries
      if (this.aiMetadata.sentimentHistory.length > 50) {
        this.aiMetadata.sentimentHistory = this.aiMetadata.sentimentHistory.slice(-50);
      }
    }
    
    await this.save();
  }

  async endSession(reason = 'user_ended') {
    this.status = 'completed';
    this.endedAt = new Date();
    this.endReason = reason;
    
    // Calculate session duration
    if (this.startedAt) {
      this.duration = Math.floor((this.endedAt - this.startedAt) / 1000); // Duration in seconds
    }
    
    await this.save();
  }

  getSessionSummary() {
    return {
      id: this.id,
      userId: this.userId,
      status: this.status,
      messageCount: this.messageCount,
      duration: this.duration,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      crisisEventsCount: this.crisisEvents ? this.crisisEvents.length : 0,
      averageSentiment: this.calculateAverageSentiment()
    };
  }

  calculateAverageSentiment() {
    if (!this.aiMetadata?.sentimentHistory?.length) return null;
    
    const scores = this.aiMetadata.sentimentHistory.map(s => s.score || 0);
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }
}

const initChatSessionModel = (sequelize) => {
  ChatSession.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    sessionType: {
      type: DataTypes.ENUM('general_support', 'crisis_intervention', 'assessment', 'check_in'),
      defaultValue: 'general_support'
    },
    status: {
      type: DataTypes.ENUM('active', 'completed', 'abandoned', 'crisis_escalated'),
      defaultValue: 'active'
    },
    messageCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    startedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    endedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    lastActivity: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    duration: {
      type: DataTypes.INTEGER, // Duration in seconds
      allowNull: true
    },
    endReason: {
      type: DataTypes.STRING,
      allowNull: true
    },
    aiMetadata: {
      type: DataTypes.JSON,
      defaultValue: {
        model_used: 'gpt-3.5-turbo',
        total_tokens: 0,
        sentiment_analysis: true,
        crisis_detection: true,
        sentimentHistory: []
      }
    },
    crisisEvents: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    sessionNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    userFeedback: {
      type: DataTypes.JSON,
      allowNull: true
    },
    isAnonymized: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    sequelize,
    modelName: 'ChatSession',
    tableName: 'chat_sessions',
    timestamps: true,
    paranoid: true, // Soft deletes for HIPAA compliance
    indexes: [
      {
        fields: ['userId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['startedAt']
      },
      {
        fields: ['lastActivity']
      },
      {
        fields: ['sessionType']
      }
    ]
  });

  return ChatSession;
};

module.exports = initChatSessionModel;