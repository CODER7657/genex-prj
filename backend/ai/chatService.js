/**
 * AI Chat Service
 * Handles conversation with Gemini/GPT, crisis detection, and sentiment analysis
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const natural = require('natural');
const Sentiment = require('sentiment');
const winston = require('winston');

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ 
      filename: 'logs/ai-service.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
});

// Initialize AI clients with error handling
let genAI = null;
let openai = null;

// Initialize Gemini
try {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your-gemini-api-key-here') {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    logger.info('✅ Gemini AI client initialized');
  } else {
    logger.warn('⚠️ Gemini API key not configured');
  }
} catch (error) {
  logger.warn('⚠️ Failed to initialize Gemini AI client:', error.message);
}

// Initialize OpenAI
try {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    logger.info('✅ OpenAI client initialized');
  } else {
    logger.warn('⚠️ OpenAI API key not configured');
  }
} catch (error) {
  logger.warn('⚠️ Failed to initialize OpenAI client:', error.message);
}

// Initialize sentiment analyzer
const sentiment = new Sentiment();

// Crisis keywords and patterns (enhanced)
const CRISIS_KEYWORDS = [
  'suicide', 'kill myself', 'end my life', 'want to die', 'better off dead',
  'self-harm', 'hurt myself', 'cut myself', 'overdose', 'pills',
  'hopeless', 'worthless', 'nobody cares', 'give up', 'can\'t go on',
  'end it all', 'no point', 'done with life', 'tired of living'
];

const CRISIS_PATTERNS = [
  /I (want to|will|am going to) (kill|hurt|harm) myself/i,
  /I'm (going to|planning to) (die|kill myself|end it)/i,
  /life isn't worth living/i,
  /(nobody|no one) would miss me/i,
  /planning to (hurt|harm|kill)/i,
  /have nothing to live for/i,
  /ready to give up/i
];

// Positive indicators for mood tracking
const POSITIVE_KEYWORDS = [
  'happy', 'good', 'better', 'great', 'fine', 'well', 'excited',
  'hopeful', 'grateful', 'proud', 'accomplished', 'content', 'peaceful'
];

// Anxiety indicators
const ANXIETY_KEYWORDS = [
  'anxious', 'worried', 'panic', 'scared', 'frightened', 'nervous',
  'overwhelmed', 'stressed', 'tense', 'on edge', 'racing thoughts'
];

class ChatService {
  constructor() {
    this.conversationHistory = new Map(); // In-memory fallback
    this.userProfiles = new Map();
    this.responseCache = new Map(); // Cache for similar messages
    this.stats = {
      messagesProcessed: 0,
      crisisDetected: 0,
      aiResponses: 0,
      fallbackResponses: 0
    };
    
    // Import database models
    this.models = null;
    this.initializeModels();
  }

  /**
   * Initialize database models
   */
  async initializeModels() {
    try {
      const { db } = require('../models');
      this.models = db;
      logger.info('✅ AI Service connected to database models');
    } catch (error) {
      logger.warn('⚠️ AI Service could not connect to database models:', error.message);
    }
  }

  /**
   * Process user message through AI and crisis detection
   */
  async processMessage(message, userId, sessionId = null) {
    try {
      this.stats.messagesProcessed++;
      
      // Log interaction (anonymized)
      logger.info(`Processing message for user: ${userId.substring(0, 8)}...`);

      // Enhanced crisis detection
      const crisisAnalysis = await this.detectCrisis(message, userId);
      
      // Enhanced sentiment analysis
      const sentimentAnalysis = this.analyzeSentiment(message);
      
      // Get conversation context from database or memory
      const context = await this.getConversationContext(userId, sessionId);
      
      // Generate AI response
      const aiResponse = await this.generateResponse(message, context, crisisAnalysis, sentimentAnalysis);
      
      // Store conversation in database
      await this.storeConversation(userId, sessionId, message, aiResponse, crisisAnalysis, sentimentAnalysis);
      
      // Update user profile with sentiment tracking
      await this.updateUserProfile(userId, sentimentAnalysis, crisisAnalysis);
      
      // Prepare comprehensive response object
      const response = {
        content: aiResponse.content,
        source: aiResponse.source,
        sentiment: sentimentAnalysis,
        crisisDetected: crisisAnalysis.detected,
        crisisLevel: crisisAnalysis.level,
        crisisTriggers: crisisAnalysis.triggers,
        emergencyResources: crisisAnalysis.detected ? this.getEmergencyResources() : null,
        recommendations: this.generateRecommendations(sentimentAnalysis, crisisAnalysis),
        timestamp: new Date().toISOString(),
        sessionId: sessionId || this.generateSessionId(),
        metadata: {
          processingTime: Date.now() - Date.now(), // Will be calculated
          aiModel: aiResponse.source,
          confidence: aiResponse.confidence || 0.8
        }
      };

      // Log crisis detection if triggered
      if (crisisAnalysis.detected) {
        this.stats.crisisDetected++;
        logger.warn(`🚨 Crisis detected for user ${userId.substring(0, 8)}... - Level: ${crisisAnalysis.level}`);
        
        // Store crisis event in database
        await this.storeCrisisEvent(userId, sessionId, crisisAnalysis, message);
      }

      if (aiResponse.source === 'fallback' || aiResponse.source === 'fallback_error') {
        this.stats.fallbackResponses++;
      } else {
        this.stats.aiResponses++;
      }

      return response;

    } catch (error) {
      logger.error('Error processing message:', error);
      
      // Return safe fallback response
      return {
        content: "I'm having some technical difficulties right now, but I want you to know that I'm here to support you. If you're in crisis or need immediate help, please contact 988 (Suicide & Crisis Lifeline) or your local emergency services.",
        source: 'error_fallback',
        sentiment: { score: 0, label: 'neutral' },
        crisisDetected: false,
        timestamp: new Date().toISOString(),
        error: true
      };
    }
  }

  /**
   * Enhanced crisis detection with user history
   */
  async detectCrisis(message, userId) {
    const lowerMessage = message.toLowerCase();
    let detected = false;
    let level = 'none';
    let triggers = [];
    let confidence = 0;

    // Check for crisis keywords
    CRISIS_KEYWORDS.forEach(keyword => {
      if (lowerMessage.includes(keyword)) {
        detected = true;
        triggers.push(keyword);
        confidence += 0.1;
      }
    });

    // Check for crisis patterns
    CRISIS_PATTERNS.forEach((pattern, index) => {
      if (pattern.test(message)) {
        detected = true;
        triggers.push(`pattern_${index + 1}`);
        confidence += 0.15;
      }
    });

    // Enhanced context analysis
    const contextWords = lowerMessage.split(' ');
    let contextScore = 0;
    
    // Check for escalating language
    const escalatingWords = ['always', 'never', 'everything', 'nothing', 'everyone', 'nobody'];
    escalatingWords.forEach(word => {
      if (contextWords.includes(word)) {
        contextScore += 0.05;
      }
    });

    // Check for time-specific crisis language
    const immediateWords = ['tonight', 'today', 'now', 'soon', 'planning'];
    immediateWords.forEach(word => {
      if (contextWords.includes(word)) {
        contextScore += 0.1;
        triggers.push(`immediate_${word}`);
      }
    });

    confidence += contextScore;

    // Determine crisis level based on triggers and confidence
    if (detected) {
      if (triggers.some(t => ['suicide', 'kill myself', 'end my life', 'overdose'].includes(t)) || confidence > 0.3) {
        level = 'high';
      } else if (triggers.some(t => ['self-harm', 'hurt myself', 'hopeless', 'worthless'].includes(t)) || confidence > 0.2) {
        level = 'medium';
      } else {
        level = 'low';
      }
    }

    // Check user's recent crisis history if available
    try {
      if (this.models && this.models.User) {
        const user = await this.models.User.findByPk(userId);
        if (user && user.mentalHealthProfile && user.mentalHealthProfile.assessments) {
          const recentCrisis = user.mentalHealthProfile.assessments
            .filter(a => a.type === 'crisis' && new Date(a.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
            .length;
          
          if (recentCrisis > 0 && detected) {
            level = level === 'low' ? 'medium' : level === 'medium' ? 'high' : level;
            triggers.push('recent_crisis_history');
          }
        }
      }
    } catch (error) {
      logger.warn('Could not check crisis history:', error.message);
    }

    return { 
      detected, 
      level, 
      triggers, 
      confidence: Math.min(confidence, 1.0),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Enhanced sentiment analysis
   */
  analyzeSentiment(message) {
    // Use the sentiment library
    const sentimentResult = sentiment.analyze(message);
    
    // Enhanced analysis with custom indicators
    const lowerMessage = message.toLowerCase();
    let customScore = 0;
    let indicators = [];

    // Check for positive indicators
    POSITIVE_KEYWORDS.forEach(word => {
      if (lowerMessage.includes(word)) {
        customScore += 1;
        indicators.push({ type: 'positive', word });
      }
    });

    // Check for anxiety indicators
    ANXIETY_KEYWORDS.forEach(word => {
      if (lowerMessage.includes(word)) {
        customScore -= 0.5;
        indicators.push({ type: 'anxiety', word });
      }
    });

    // Determine overall label
    let label = 'neutral';
    const finalScore = sentimentResult.score + customScore;
    
    if (finalScore > 2) {
      label = 'very_positive';
    } else if (finalScore > 0) {
      label = 'positive';
    } else if (finalScore < -2) {
      label = 'very_negative';
    } else if (finalScore < 0) {
      label = 'negative';
    }

    return {
      score: finalScore,
      comparative: sentimentResult.comparative,
      label,
      indicators,
      tokens: sentimentResult.tokens,
      positive: sentimentResult.positive,
      negative: sentimentResult.negative,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate AI response using Gemini or GPT with enhanced prompts
   */
  async generateResponse(message, context, crisisAnalysis, sentimentAnalysis) {
    const systemPrompt = this.buildSystemPrompt(crisisAnalysis, sentimentAnalysis);
    const conversationPrompt = this.buildConversationPrompt(message, context);

    try {
      // Try Gemini first
      if (genAI && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your-gemini-api-key-here') {
        logger.info('🚀 Attempting Gemini response generation...');
        return await this.generateGeminiResponse(systemPrompt, conversationPrompt);
      }
      
      // Fallback to OpenAI GPT
      if (openai && process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
        logger.info('🚀 Attempting OpenAI response generation...');
        return await this.generateGPTResponse(systemPrompt, conversationPrompt);
      }

      // No AI clients available - return helpful fallback
      logger.warn('⚠️ No AI API keys configured, using fallback responses');
      return {
        content: this.getFallbackResponse(message, crisisAnalysis, sentimentAnalysis),
        source: 'fallback',
        confidence: 0.7
      };

    } catch (error) {
      logger.error('❌ AI generation error:', error.message, error.stack);
      return {
        content: this.getFallbackResponse(message, crisisAnalysis, sentimentAnalysis),
        source: 'fallback_error',
        confidence: 0.5
      };
    }
  }

  /**
   * Generate response using Google Gemini
   */
  async generateGeminiResponse(systemPrompt, conversationPrompt) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const result = await model.generateContent([
        { text: systemPrompt },
        { text: conversationPrompt }
      ]);

      const responseText = result.response.text();
      logger.info('✅ Gemini response generated successfully');
      
      return {
        content: responseText,
        source: 'gemini'
      };
    } catch (error) {
      logger.error('❌ Gemini API error:', error.message);
      throw error;
    }
  }

  /**
   * Generate response using OpenAI GPT
   */
  async generateGPTResponse(systemPrompt, conversationPrompt) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: conversationPrompt }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const responseText = completion.choices[0].message.content;
      logger.info('✅ OpenAI response generated successfully');
      
      return {
        content: responseText,
        source: 'openai'
      };
    } catch (error) {
      logger.error('❌ OpenAI API error:', error.message);
      throw error;
    }
  }

  /**
   * Build enhanced system prompt for AI
   */
  buildSystemPrompt(crisisAnalysis, sentimentAnalysis) {
    let prompt = `You are a compassionate AI mental health companion designed to support young people (ages 13-25). 

CORE PRINCIPLES:
- Be empathetic, non-judgmental, and genuinely caring
- Use age-appropriate language that feels natural and relatable to Gen-Z
- Validate both physical and emotional experiences
- Show genuine concern for their wellbeing
- Encourage professional help when appropriate
- Never provide medical diagnoses or specific treatment advice
- Focus on active listening, emotional support, and practical comfort

COMMUNICATION STYLE:
- Warm, authentic, and understanding - avoid sounding robotic or clinical
- Use "I" statements and reflective listening
- Express genuine empathy: "That sounds really tough" or "I'm sorry you're dealing with this"
- Ask caring follow-up questions to show interest
- Acknowledge the connection between physical symptoms and mental wellness
- Be conversational but meaningful (2-4 sentences)
- Match their emotional tone appropriately

PHYSICAL SYMPTOMS SUPPORT:
- Acknowledge physical discomfort with genuine empathy
- Recognize the mind-body connection (stress can cause headaches, etc.)
- Suggest gentle comfort measures without medical advice
- Validate that physical symptoms can affect mood and mental state
- Show care about their overall wellbeing

SAFETY PROTOCOLS:
- If you detect crisis language, prioritize safety and provide resources
- Always encourage professional support for serious mental health concerns
- Maintain appropriate boundaries as an AI companion

CURRENT CONTEXT:`;

    // Add sentiment context
    if (sentimentAnalysis) {
      prompt += `\n- User's current emotional state: ${sentimentAnalysis.label} (score: ${sentimentAnalysis.score})`;
      
      if (sentimentAnalysis.indicators.length > 0) {
        const indicators = sentimentAnalysis.indicators.map(i => i.word).join(', ');
        prompt += `\n- Key emotional indicators: ${indicators}`;
      }
    }

    // Add crisis context
    if (crisisAnalysis.detected) {
      prompt += `\n\n⚠️ CRISIS DETECTED - LEVEL: ${crisisAnalysis.level.toUpperCase()}
- Confidence: ${(crisisAnalysis.confidence * 100).toFixed(1)}%
- Triggers detected: ${crisisAnalysis.triggers.join(', ')}

IMMEDIATE RESPONSE REQUIREMENTS:
- Acknowledge their pain and validate their feelings
- Express genuine concern for their safety
- Provide immediate crisis resources
- Encourage professional help urgently
- Be direct but compassionate about seeking help
- Do NOT minimize their feelings or give false reassurance`;
    } else {
      prompt += `\n\n- No crisis indicators detected
- Focus on supportive conversation and emotional validation`;
    }

    return prompt;
  }

  /**
   * Build conversation prompt with context
   */
  buildConversationPrompt(message, context) {
    let prompt = '';
    
    if (context && context.length > 0) {
      prompt += 'Previous conversation context:\n';
      context.slice(-3).forEach(msg => {
        prompt += `${msg.role}: ${msg.content}\n`;
      });
      prompt += '\n';
    }

    prompt += `Current message: "${message}"\n\nProvide a supportive, empathetic response:`;
    
    return prompt;
  }

  /**
   * Get conversation context for user
   */
  getConversationContext(userId, conversationId) {
    const key = `${userId}-${conversationId || 'default'}`;
    return this.conversationHistory.get(key) || [];
  }

  /**
   * Update conversation history
   */
  updateConversationHistory(userId, conversationId, userMessage, aiResponse) {
    const key = `${userId}-${conversationId || 'default'}`;
    const history = this.conversationHistory.get(key) || [];
    
    history.push(
      { role: 'user', content: userMessage, timestamp: new Date() },
      { role: 'assistant', content: aiResponse, timestamp: new Date() }
    );

    // Keep only last 10 messages
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }

    this.conversationHistory.set(key, history);
  }

  /**
   * Generate session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Store conversation in database
   */
  async storeConversation(userId, sessionId, userMessage, aiResponse, crisisAnalysis, sentimentAnalysis) {
    try {
      if (!this.models) return;

      // Find or create chat session
      let session = null;
      if (sessionId) {
        session = await this.models.ChatSession.findByPk(sessionId);
      }

      if (!session) {
        session = await this.models.ChatSession.create({
          userId,
          sessionType: crisisAnalysis.detected ? 'crisis_intervention' : 'general_support',
          aiMetadata: {
            model_used: aiResponse.source,
            total_tokens: 0,
            sentiment_analysis: true,
            crisis_detection: true
          }
        });
      }

      // Store user message
      const userMsg = await this.models.Message.create({
        sessionId: session.id,
        userId,
        sender: 'user',
        content: userMessage,
        sentiment: sentimentAnalysis.label,
        sentimentScore: sentimentAnalysis.comparative,
        crisisDetected: crisisAnalysis.detected,
        crisisSeverity: crisisAnalysis.level !== 'none' ? crisisAnalysis.level : null
      });

      // Store AI response
      const aiMsg = await this.models.Message.create({
        sessionId: session.id,
        userId,
        sender: 'ai',
        content: aiResponse.content,
        aiMetadata: {
          model_used: aiResponse.source,
          confidence_score: aiResponse.confidence || 0.8,
          response_time: 0
        }
      });

      // Update session statistics
      await session.addMessage({ 
        crisis_detected: crisisAnalysis.detected,
        crisis_severity: crisisAnalysis.level,
        sentiment: sentimentAnalysis.label,
        sentiment_score: sentimentAnalysis.comparative
      });

      logger.debug(`Stored conversation: ${session.id}`);
      return session.id;

    } catch (error) {
      logger.error('Error storing conversation:', error);
    }
  }

  /**
   * Store crisis event in database
   */
  async storeCrisisEvent(userId, sessionId, crisisAnalysis, message) {
    try {
      if (!this.models || !this.models.User) return;

      const user = await this.models.User.findByPk(userId);
      if (!user) return;

      const crisisEvent = {
        timestamp: new Date(),
        severity: crisisAnalysis.level,
        triggers: crisisAnalysis.triggers,
        confidence: crisisAnalysis.confidence,
        message_excerpt: message.substring(0, 100), // Store first 100 chars
        session_id: sessionId
      };

      // Add to user's mental health profile
      if (!user.mentalHealthProfile.crisisEvents) {
        user.mentalHealthProfile.crisisEvents = [];
      }
      
      user.mentalHealthProfile.crisisEvents.push(crisisEvent);
      
      // Keep only last 20 crisis events
      if (user.mentalHealthProfile.crisisEvents.length > 20) {
        user.mentalHealthProfile.crisisEvents = user.mentalHealthProfile.crisisEvents.slice(-20);
      }

      await user.save();
      
      logger.warn(`Crisis event stored for user ${userId.substring(0, 8)}...`);

    } catch (error) {
      logger.error('Error storing crisis event:', error);
    }
  }

  /**
   * Update user profile with sentiment tracking
   */
  async updateUserProfile(userId, sentimentAnalysis, crisisAnalysis) {
    try {
      if (!this.models || !this.models.User) return;

      const user = await this.models.User.findByPk(userId);
      if (!user) return;

      // Initialize mood tracking if it doesn't exist
      if (!user.mentalHealthProfile.moodHistory) {
        user.mentalHealthProfile.moodHistory = [];
      }

      // Add current mood data
      const moodEntry = {
        timestamp: new Date(),
        sentiment: sentimentAnalysis.label,
        score: sentimentAnalysis.score,
        crisis_detected: crisisAnalysis.detected
      };

      user.mentalHealthProfile.moodHistory.push(moodEntry);

      // Keep only last 50 mood entries
      if (user.mentalHealthProfile.moodHistory.length > 50) {
        user.mentalHealthProfile.moodHistory = user.mentalHealthProfile.moodHistory.slice(-50);
      }

      await user.save();

    } catch (error) {
      logger.error('Error updating user profile:', error);
    }
  }

  /**
   * Get conversation context from database
   */
  async getConversationContext(userId, sessionId) {
    try {
      if (!this.models || !sessionId) {
        // Fallback to memory
        const key = `${userId}-${sessionId || 'default'}`;
        return this.conversationHistory.get(key) || [];
      }

      // Get recent messages from database
      const messages = await this.models.Message.find({
        where: { sessionId },
        order: [['createdAt', 'DESC']],
        limit: 10
      });

      return messages.reverse().map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: msg.createdAt
      }));

    } catch (error) {
      logger.warn('Could not get context from database, using memory fallback:', error.message);
      const key = `${userId}-${sessionId || 'default'}`;
      return this.conversationHistory.get(key) || [];
    }
  }

  /**
   * Generate personalized recommendations
   */
  generateRecommendations(sentimentAnalysis, crisisAnalysis) {
    const recommendations = [];

    if (crisisAnalysis.detected) {
      recommendations.push({
        type: 'immediate_action',
        priority: 'high',
        message: 'Please consider reaching out to a crisis counselor or trusted person immediately.',
        resources: ['988 Suicide & Crisis Lifeline', 'Crisis Text Line: Text HOME to 741741']
      });
    }

    if (sentimentAnalysis.label === 'very_negative' || sentimentAnalysis.label === 'negative') {
      recommendations.push({
        type: 'mood_support',
        priority: 'medium',
        message: 'It sounds like you\'re going through a difficult time. Consider these coping strategies:',
        suggestions: [
          'Deep breathing exercises',
          'Talking to a trusted friend or family member',
          'Engaging in a favorite activity',
          'Professional counseling if feelings persist'
        ]
      });
    }

    if (sentimentAnalysis.indicators.some(i => i.type === 'anxiety')) {
      recommendations.push({
        type: 'anxiety_management',
        priority: 'medium',
        message: 'For anxiety management, try these techniques:',
        suggestions: [
          '4-7-8 breathing technique',
          'Grounding exercises (5-4-3-2-1 method)',
          'Progressive muscle relaxation',
          'Regular exercise and sleep schedule'
        ]
      });
    }

    if (sentimentAnalysis.label === 'positive' || sentimentAnalysis.label === 'very_positive') {
      recommendations.push({
        type: 'positive_reinforcement',
        priority: 'low',
        message: 'It\'s great to hear you\'re feeling positive! Keep nurturing your mental health:',
        suggestions: [
          'Continue activities that bring you joy',
          'Practice gratitude',
          'Maintain your support connections',
          'Consider helping others when you feel able'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Get emergency resources
   */
  getEmergencyResources() {
    return {
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
        "Go to your nearest emergency room",
        "Call 911 if you're in immediate danger",
        "Remove any means of self-harm from your environment"
      ],
      resources: [
        {
          name: "National Institute of Mental Health",
          url: "https://www.nimh.nih.gov/health/find-help"
        },
        {
          name: "Mental Health America",
          url: "https://www.mhanational.org/finding-help"
        }
      ]
    };
  }

  /**
   * Get enhanced fallback response when AI is not available
   */
  getFallbackResponse(message, crisisAnalysis, sentimentAnalysis) {
    if (crisisAnalysis.detected) {
      const crisisResponse = "I'm very concerned about what you've shared. Please know that you're not alone and help is available. I strongly encourage you to reach out to a crisis helpline immediately:\n\n🆘 **Crisis Resources:**\n• 988 (Suicide & Crisis Lifeline) - Call or text\n• Crisis Text Line: Text HOME to 741741\n• Your local emergency services: 911\n\nYour life has value and there are people who want to help you through this difficult time. Please reach out now.";
      
      return crisisResponse;
    }

    // Enhanced responses based on sentiment and keywords
    const lowerMessage = message.toLowerCase();
    
    // Physical symptoms support
    if (lowerMessage.includes('headache') || lowerMessage.includes('head hurts') || lowerMessage.includes('migraine')) {
      return "I'm sorry you're dealing with a headache - that can really affect your whole day and mood. Physical pain like headaches can be so draining. Have you been under more stress lately, or noticed if anything specific tends to trigger them? Sometimes headaches can be connected to stress, dehydration, or lack of sleep. While I can't give medical advice, gentle things like staying hydrated, resting in a quiet space, or some light stretching might help provide comfort.";
    }
    
    if (lowerMessage.includes('tired') || lowerMessage.includes('exhausted') || lowerMessage.includes('fatigue')) {
      return "Being tired and exhausted can make everything feel harder to handle. It sounds like you're really drained right now. Sometimes our bodies are telling us we need rest, but other times fatigue can be connected to stress or our emotional state. Are you able to get enough sleep, or is something keeping you from feeling rested? Taking care of your basic needs - sleep, food, water - can sometimes make a big difference in how we feel overall.";
    }
    
    if (lowerMessage.includes('sick') || lowerMessage.includes('not feeling well') || lowerMessage.includes('unwell')) {
      return "I'm sorry you're not feeling well - that's never fun to deal with. When we're physically unwell, it can also affect our mood and mental state. Are you feeling sick physically, emotionally, or maybe both? Sometimes our bodies and minds are more connected than we realize. I hope you're able to take some time to rest and take care of yourself.";
    }
    
    if (sentimentAnalysis && sentimentAnalysis.label === 'very_negative') {
      return "I can sense that you're going through something really tough right now. Those difficult feelings are completely valid, and I want you to know that it's okay to not be okay sometimes. Even though I'm having some technical difficulties, please know that support is available to you. If you're in crisis, please reach out to 988 or your local crisis line. Otherwise, talking to a trusted friend, family member, or counselor can really help during hard times.";
    }

    if (lowerMessage.includes('anxious') || lowerMessage.includes('anxiety') || 
        sentimentAnalysis?.indicators.some(i => i.type === 'anxiety')) {
      return "I hear that you're feeling anxious, and that can be really overwhelming. Anxiety affects both our minds and bodies. Sometimes simple breathing exercises can help - try breathing in slowly for 4 counts, holding for 7, then breathing out for 8. Grounding yourself can also help - try noticing 5 things you can see around you, 4 things you can touch, 3 things you can hear. What's been making you feel most anxious lately?";
    }
    
    if (lowerMessage.includes('depressed') || lowerMessage.includes('depression') || lowerMessage.includes('sad')) {
      return "Thank you for sharing that you're feeling down. Depression can make everything feel heavier and more difficult. What you're experiencing is real and valid. Many people find that talking through their feelings helps, even when it feels hard to put them into words. Can you tell me more about what's been weighing on you? If these feelings are persistent or getting worse, please consider reaching out to a mental health professional who can provide proper support.";
    }
    
    if (lowerMessage.includes('stress') || lowerMessage.includes('overwhelmed')) {
      return "It sounds like you're dealing with a lot of stress right now, and feeling overwhelmed is completely understandable when there's too much going on. Sometimes stress can even show up as physical symptoms like headaches or feeling tired. Let's talk about what's causing you the most stress - what feels like the biggest challenge you're facing right now? Sometimes breaking things down into smaller pieces can make them feel more manageable.";
    }
    
    if (lowerMessage.includes('lonely') || lowerMessage.includes('alone')) {
      return "Loneliness can be really painful to experience, and I appreciate you being brave enough to reach out and share that with me. Even when we feel completely alone, there are people who care and want to help. Sometimes talking through these feelings can help us understand them better and find ways to connect. What's been making you feel most lonely? Is it feeling disconnected from others, or maybe feeling like no one understands what you're going through?";
    }
    
    if (sentimentAnalysis && (sentimentAnalysis.label === 'positive' || sentimentAnalysis.label === 'very_positive')) {
      return "It's really nice to hear some positivity from you! I appreciate you sharing that with me. Even though I'm having some technical difficulties right now, I'm glad you reached out. How can I best support you today? Is there something specific you'd like to talk about, or are you just checking in?";
    }
    
    // Default supportive response
    return "I'm here to listen and support you, and I appreciate you reaching out to me. That takes courage. While I'm having some technical difficulties right now, I want you to know that I care about how you're doing. Could you tell me more about what's going on for you today? Sometimes just talking through what's on our minds can help us feel a little better. If you're in crisis or need immediate help, please don't hesitate to contact 988 or your local emergency services.";
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      memoryConversations: this.conversationHistory.size,
      uptime: process.uptime(),
      aiClientsAvailable: {
        gemini: !!genAI && !!process.env.GEMINI_API_KEY,
        openai: !!openai && !!process.env.OPENAI_API_KEY
      }
    };
  }

  /**
   * Clear old conversation history (memory cleanup)
   */
  cleanupMemory() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [key, history] of this.conversationHistory) {
      const lastMessage = history[history.length - 1];
      if (lastMessage && new Date(lastMessage.timestamp).getTime() < cutoff) {
        this.conversationHistory.delete(key);
      }
    }
    
    logger.info(`Memory cleanup completed. Active conversations: ${this.conversationHistory.size}`);
  }
}

module.exports = new ChatService();