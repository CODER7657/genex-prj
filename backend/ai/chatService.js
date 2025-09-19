/**
 * AI Chat Service
 * Handles conversation with Gemini/GPT, crisis detection, and sentiment analysis
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const natural = require('natural');
const Sentiment = require('sentiment');
const winston = require('winston');

// Initialize AI clients
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const sentiment = new Sentiment();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/ai-service.log' })
  ]
});

// Crisis keywords and patterns
const CRISIS_KEYWORDS = [
  'suicide', 'kill myself', 'end my life', 'want to die', 'better off dead',
  'self-harm', 'hurt myself', 'cut myself', 'overdose', 'pills',
  'hopeless', 'worthless', 'nobody cares', 'give up', 'can\'t go on'
];

const CRISIS_PATTERNS = [
  /I want to (kill|hurt|harm) myself/i,
  /I'm going to (die|kill myself)/i,
  /life isn't worth living/i,
  /nobody would miss me/i,
  /planning to (hurt|harm|kill)/i
];

class ChatService {
  constructor() {
    this.conversationHistory = new Map();
    this.userProfiles = new Map();
  }

  /**
   * Process user message through AI and crisis detection
   */
  async processMessage(message, userId, conversationId = null) {
    try {
      // Log interaction (anonymized)
      logger.info(`Processing message for user: ${userId.substring(0, 8)}...`);

      // Crisis detection first
      const crisisAnalysis = this.detectCrisis(message);
      
      // Sentiment analysis
      const sentimentScore = sentiment.analyze(message);
      
      // Get conversation context
      const context = this.getConversationContext(userId, conversationId);
      
      // Generate AI response
      const aiResponse = await this.generateResponse(message, context, crisisAnalysis);
      
      // Update conversation history
      this.updateConversationHistory(userId, conversationId, message, aiResponse.content);
      
      // Prepare response object
      const response = {
        content: aiResponse.content,
        sentiment: {
          score: sentimentScore.score,
          comparative: sentimentScore.comparative,
          tokens: sentimentScore.tokens.length
        },
        crisisDetected: crisisAnalysis.detected,
        crisisLevel: crisisAnalysis.level,
        emergencyResources: crisisAnalysis.detected ? this.getEmergencyResources() : null,
        timestamp: new Date().toISOString(),
        conversationId: conversationId || this.generateConversationId()
      };

      // Log crisis detection if triggered
      if (crisisAnalysis.detected) {
        logger.warn(`Crisis detected for user ${userId.substring(0, 8)}... - Level: ${crisisAnalysis.level}`);
      }

      return response;

    } catch (error) {
      logger.error('Error processing message:', error);
      throw new Error('Failed to process message');
    }
  }

  /**
   * Detect crisis indicators in user message
   */
  detectCrisis(message) {
    const lowerMessage = message.toLowerCase();
    let detected = false;
    let level = 'none';
    let triggers = [];

    // Check for crisis keywords
    CRISIS_KEYWORDS.forEach(keyword => {
      if (lowerMessage.includes(keyword)) {
        detected = true;
        triggers.push(keyword);
      }
    });

    // Check for crisis patterns
    CRISIS_PATTERNS.forEach(pattern => {
      if (pattern.test(message)) {
        detected = true;
        triggers.push('pattern_match');
      }
    });

    // Determine crisis level
    if (detected) {
      if (triggers.some(t => ['suicide', 'kill myself', 'end my life'].includes(t))) {
        level = 'high';
      } else if (triggers.some(t => ['self-harm', 'hurt myself', 'hopeless'].includes(t))) {
        level = 'medium';
      } else {
        level = 'low';
      }
    }

    return { detected, level, triggers };
  }

  /**
   * Generate AI response using Gemini or GPT
   */
  async generateResponse(message, context, crisisAnalysis) {
    const systemPrompt = this.buildSystemPrompt(crisisAnalysis);
    const conversationPrompt = this.buildConversationPrompt(message, context);

    try {
      // Try Gemini first
      if (process.env.GEMINI_API_KEY) {
        return await this.generateGeminiResponse(systemPrompt, conversationPrompt);
      }
      
      // Fallback to OpenAI GPT
      if (process.env.OPENAI_API_KEY) {
        return await this.generateGPTResponse(systemPrompt, conversationPrompt);
      }

      throw new Error('No AI API keys configured');

    } catch (error) {
      logger.error('AI generation error:', error);
      return {
        content: "I'm here to listen and support you. Could you tell me more about what you're experiencing right now?",
        source: 'fallback'
      };
    }
  }

  /**
   * Generate response using Google Gemini
   */
  async generateGeminiResponse(systemPrompt, conversationPrompt) {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: conversationPrompt }
    ]);

    return {
      content: result.response.text(),
      source: 'gemini'
    };
  }

  /**
   * Generate response using OpenAI GPT
   */
  async generateGPTResponse(systemPrompt, conversationPrompt) {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: conversationPrompt }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    return {
      content: completion.choices[0].message.content,
      source: 'openai'
    };
  }

  /**
   * Build system prompt for AI
   */
  buildSystemPrompt(crisisAnalysis) {
    let prompt = `You are a compassionate AI mental health companion designed to support young people (ages 13-25). 

CORE PRINCIPLES:
- Be empathetic, non-judgmental, and supportive
- Use age-appropriate language that resonates with Gen-Z
- Validate emotions and experiences
- Encourage professional help when appropriate
- Never provide medical diagnoses or specific treatment advice
- Focus on active listening and emotional support

COMMUNICATION STYLE:
- Warm, genuine, and relatable
- Use "I" statements and reflective listening
- Ask open-ended questions to encourage sharing
- Acknowledge their courage in reaching out
- Be concise but meaningful (2-3 sentences max)

SAFETY PROTOCOLS:
- If you detect crisis language, prioritize safety and provide resources
- Always encourage professional support for serious mental health concerns
- Maintain appropriate boundaries as an AI companion`;

    if (crisisAnalysis.detected) {
      prompt += `

⚠️ CRISIS DETECTED - LEVEL: ${crisisAnalysis.level.toUpperCase()}
- Prioritize immediate safety and support
- Acknowledge their pain and courage in sharing
- Provide crisis resources and encourage immediate professional help
- Be direct but compassionate about seeking help`;
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
   * Generate conversation ID
   */
  generateConversationId() {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
}

module.exports = new ChatService();