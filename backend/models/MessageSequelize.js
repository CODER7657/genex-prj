/**
 * Message Model
 * Sequelize model for individual chat messages
 */

const { DataTypes, Model } = require('sequelize');

class Message extends Model {
  async analyzeContent() {
    // Simulate content analysis (in real app, this would call AI service)
    const content = this.content.toLowerCase();
    
    // Simple crisis keyword detection
    const crisisKeywords = ['suicide', 'kill myself', 'end it all', 'hurt myself', 'no point', 'give up'];
    const hasCrisisKeywords = crisisKeywords.some(keyword => content.includes(keyword));
    
    if (hasCrisisKeywords) {
      this.crisisDetected = true;
      this.crisisSeverity = 'high';
      this.flagged = true;
    }
    
    // Simple sentiment analysis
    const positiveWords = ['good', 'happy', 'better', 'great', 'fine', 'well'];
    const negativeWords = ['bad', 'sad', 'worse', 'terrible', 'awful', 'depressed'];
    
    const positiveCount = positiveWords.reduce((count, word) => 
      count + (content.split(word).length - 1), 0);
    const negativeCount = negativeWords.reduce((count, word) => 
      count + (content.split(word).length - 1), 0);
    
    if (positiveCount > negativeCount) {
      this.sentiment = 'positive';
      this.sentimentScore = 0.7;
    } else if (negativeCount > positiveCount) {
      this.sentiment = 'negative';
      this.sentimentScore = 0.3;
    } else {
      this.sentiment = 'neutral';
      this.sentimentScore = 0.5;
    }
    
    await this.save();
  }

  async logFeedback(feedbackData) {
    this.userFeedback = {
      ...this.userFeedback,
      timestamp: new Date(),
      ...feedbackData
    };
    
    await this.save();
  }

  sanitizeForAudit() {
    return {
      id: this.id,
      sessionId: this.sessionId,
      userId: this.userId,
      sender: this.sender,
      messageType: this.messageType,
      contentLength: this.content ? this.content.length : 0,
      sentiment: this.sentiment,
      crisisDetected: this.crisisDetected,
      timestamp: this.createdAt
    };
  }
}

const initMessageModel = (sequelize) => {
  Message.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    sessionId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'chat_sessions',
        key: 'id'
      }
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    sender: {
      type: DataTypes.ENUM('user', 'ai', 'system'),
      allowNull: false
    },
    messageType: {
      type: DataTypes.ENUM('text', 'assessment', 'crisis_alert', 'resource', 'system_message'),
      defaultValue: 'text'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    aiMetadata: {
      type: DataTypes.JSON,
      defaultValue: {
        model_used: null,
        tokens_used: 0,
        response_time: 0,
        confidence_score: null
      }
    },
    sentiment: {
      type: DataTypes.ENUM('positive', 'negative', 'neutral'),
      allowNull: true
    },
    sentimentScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      validate: {
        min: 0,
        max: 1
      }
    },
    crisisDetected: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    crisisSeverity: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      allowNull: true
    },
    flagged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    flagReason: {
      type: DataTypes.STRING,
      allowNull: true
    },
    userFeedback: {
      type: DataTypes.JSON,
      allowNull: true
    },
    isAnonymized: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Message',
    tableName: 'messages',
    timestamps: true,
    paranoid: true, // Soft deletes for HIPAA compliance
    hooks: {
      afterCreate: async (message) => {
        // Auto-analyze user messages
        if (message.sender === 'user') {
          await message.analyzeContent();
        }
      }
    },
    indexes: [
      {
        fields: ['sessionId']
      },
      {
        fields: ['userId']
      },
      {
        fields: ['sender']
      },
      {
        fields: ['createdAt']
      },
      {
        fields: ['crisisDetected']
      },
      {
        fields: ['flagged']
      },
      {
        fields: ['sentiment']
      }
    ]
  });

  return Message;
};

module.exports = initMessageModel;