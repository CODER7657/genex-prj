/**
 * User Model
 * Sequelize model for user data with HIPAA compliance
 */

const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

class User extends Model {
  // Instance methods
  async comparePassword(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
  }

  async updateLoginAttempt(isSuccessful) {
    if (isSuccessful) {
      this.loginAttempts = 0;
      this.lockUntil = null;
      this.lastLogin = new Date();
    } else {
      this.loginAttempts = (this.loginAttempts || 0) + 1;
      
      // Lock account after 5 failed attempts for 30 minutes
      if (this.loginAttempts >= 5) {
        this.lockUntil = new Date(Date.now() + 30 * 60 * 1000);
      }
    }
    
    await this.save();
  }

  isAccountLocked() {
    return this.lockUntil && this.lockUntil > new Date();
  }

  async logAuditEvent(action, details = {}) {
    const auditEntry = {
      timestamp: new Date(),
      action,
      details,
      ipAddress: details.ipAddress || 'unknown',
      userAgent: details.userAgent || 'unknown'
    };
    
    if (!this.auditLog) {
      this.auditLog = [];
    }
    
    this.auditLog.push(auditEntry);
    
    // Keep only last 100 audit entries
    if (this.auditLog.length > 100) {
      this.auditLog = this.auditLog.slice(-100);
    }
    
    await this.save();
  }

  async anonymizeData() {
    this.firstName = 'Anonymous';
    this.lastName = 'User';
    this.email = `anonymous_${crypto.randomBytes(8).toString('hex')}@deleted.local`;
    this.phone = null;
    this.dateOfBirth = null;
    this.emergencyContact = null;
    this.mentalHealthProfile = {
      conditions: [],
      medications: [],
      therapistInfo: null,
      preferences: this.mentalHealthProfile?.preferences || {}
    };
    this.isAnonymized = true;
    
    await this.save();
  }

  // Static methods
  static async findByEmail(email) {
    return await this.findOne({ 
      where: { email: email.toLowerCase() } 
    });
  }

  static async isEmailTaken(email, excludeUserId) {
    const where = { email: email.toLowerCase() };
    if (excludeUserId) {
      where.id = { [require('sequelize').Op.ne]: excludeUserId };
    }
    
    const user = await this.findOne({ where });
    return !!user;
  }
}

const initUserModel = (sequelize) => {
  User.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    firstName: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [2, 50]
      }
    },
    lastName: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [2, 50]
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true, // Allow anonymous users
      unique: true,
      validate: {
        isEmail: true,
        len: [5, 255]
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true, // Allow anonymous users
      validate: {
        len: [8, 128]
      }
    },
    age: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 13,
        max: 120
      }
    },
    anonymous: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        is: /^\+?[\d\s\-\(\)]{10,15}$/
      }
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: true,
        isBefore: new Date().toISOString()
      }
    },
    emergencyContact: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null
    },
    mentalHealthProfile: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {
        conditions: [],
        medications: [],
        therapistInfo: null,
        preferences: {
          crisisAlerts: true,
          dataSharing: false,
          reminderNotifications: true
        },
        assessments: []
      }
    },
    preferences: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {
        theme: 'light',
        language: 'en',
        notifications: {
          email: true,
          push: true,
          sms: false
        },
        privacy: {
          shareProgress: false,
          anonymousData: true
        }
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    loginAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    lockUntil: {
      type: DataTypes.DATE,
      allowNull: true
    },
    lastLogin: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    auditLog: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    isAnonymized: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    termsAccepted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    privacyPolicyAccepted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    paranoid: true, // Soft deletes for HIPAA compliance
    defaultScope: {
      attributes: { exclude: ['password'] }
    },
    scopes: {
      withPassword: {
        attributes: { include: ['password'] }
      }
    },
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(12);
          user.password = await bcrypt.hash(user.password, salt);
        }
        if (user.email) {
          user.email = user.email.toLowerCase();
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password') && user.password) {
          const salt = await bcrypt.genSalt(12);
          user.password = await bcrypt.hash(user.password, salt);
        }
        if (user.changed('email') && user.email) {
          user.email = user.email.toLowerCase();
        }
      }
    },
    indexes: [
      {
        unique: true,
        fields: ['email'],
        where: {
          email: {
            [require('sequelize').Op.ne]: null
          }
        }
      },
      {
        fields: ['lastLogin']
      },
      {
        fields: ['createdAt']
      },
      {
        fields: ['anonymous']
      }
    ]
  });

  return User;
};

module.exports = initUserModel;