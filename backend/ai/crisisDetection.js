/**
 * Crisis Detection Service
 * Advanced crisis detection with ML models and pattern matching
 */

const natural = require('natural');
const Sentiment = require('sentiment');

class CrisisDetectionService {
  constructor() {
    this.sentiment = new Sentiment();
    this.classifier = new natural.BayesClassifier();
    this.initializeClassifier();
  }

  /**
   * Initialize and train the crisis detection classifier
   */
  initializeClassifier() {
    // Training data for crisis detection
    const trainingData = [
      // High risk
      { text: "I want to kill myself", label: 'high_risk' },
      { text: "I'm planning to end my life", label: 'high_risk' },
      { text: "I have pills and I want to take them all", label: 'high_risk' },
      { text: "Nobody would miss me if I'm gone", label: 'high_risk' },
      { text: "I can't take this pain anymore", label: 'high_risk' },
      
      // Medium risk
      { text: "I hate my life", label: 'medium_risk' },
      { text: "I want to hurt myself", label: 'medium_risk' },
      { text: "Everything is hopeless", label: 'medium_risk' },
      { text: "I feel worthless and alone", label: 'medium_risk' },
      
      // Low risk
      { text: "I'm feeling really sad today", label: 'low_risk' },
      { text: "I'm stressed about school", label: 'low_risk' },
      { text: "I'm having trouble sleeping", label: 'low_risk' },
      
      // No risk
      { text: "How are you today?", label: 'no_risk' },
      { text: "I had a good day at work", label: 'no_risk' },
      { text: "What's the weather like?", label: 'no_risk' }
    ];

    // Train classifier
    trainingData.forEach(item => {
      this.classifier.addDocument(item.text, item.label);
    });
    
    this.classifier.train();
  }

  /**
   * Analyze message for crisis indicators
   */
  analyzeCrisis(message) {
    const sentimentAnalysis = this.sentiment.analyze(message);
    const classification = this.classifier.classify(message);
    const keywordAnalysis = this.analyzeKeywords(message);
    const patternAnalysis = this.analyzePatterns(message);

    return {
      overallRisk: this.calculateOverallRisk({
        sentiment: sentimentAnalysis,
        classification,
        keywords: keywordAnalysis,
        patterns: patternAnalysis
      }),
      details: {
        sentiment: sentimentAnalysis,
        classification,
        keywords: keywordAnalysis,
        patterns: patternAnalysis
      }
    };
  }

  /**
   * Analyze crisis keywords
   */
  analyzeKeywords(message) {
    const crisisKeywords = {
      high_risk: [
        'suicide', 'kill myself', 'end my life', 'want to die',
        'overdose', 'pills', 'razor', 'cutting', 'hanging'
      ],
      medium_risk: [
        'self-harm', 'hurt myself', 'hopeless', 'worthless',
        'nobody cares', 'can\'t go on', 'give up', 'trapped'
      ],
      low_risk: [
        'depressed', 'anxious', 'stressed', 'overwhelmed',
        'tired', 'lonely', 'sad', 'empty'
      ]
    };

    const found = {
      high_risk: [],
      medium_risk: [],
      low_risk: []
    };

    const lowerMessage = message.toLowerCase();

    Object.keys(crisisKeywords).forEach(level => {
      crisisKeywords[level].forEach(keyword => {
        if (lowerMessage.includes(keyword)) {
          found[level].push(keyword);
        }
      });
    });

    return found;
  }

  /**
   * Analyze crisis patterns using regex
   */
  analyzePatterns(message) {
    const patterns = {
      high_risk: [
        /I want to (kill|hurt|harm) myself/i,
        /I'm going to (die|kill myself|end it)/i,
        /planning to (hurt|harm|kill) myself/i,
        /have a plan to/i,
        /tonight I will/i
      ],
      medium_risk: [
        /life isn't worth living/i,
        /nobody would miss me/i,
        /can't take it anymore/i,
        /everything is hopeless/i,
        /I hate myself/i
      ],
      low_risk: [
        /feeling really (sad|down|depressed)/i,
        /having a hard time/i,
        /struggling with/i,
        /don't know what to do/i
      ]
    };

    const matches = {
      high_risk: [],
      medium_risk: [],
      low_risk: []
    };

    Object.keys(patterns).forEach(level => {
      patterns[level].forEach((pattern, index) => {
        if (pattern.test(message)) {
          matches[level].push(`pattern_${index}`);
        }
      });
    });

    return matches;
  }

  /**
   * Calculate overall risk level
   */
  calculateOverallRisk({ sentiment, classification, keywords, patterns }) {
    let riskScore = 0;

    // Sentiment scoring
    if (sentiment.score < -5) riskScore += 3;
    else if (sentiment.score < -2) riskScore += 2;
    else if (sentiment.score < 0) riskScore += 1;

    // Classification scoring
    switch (classification) {
      case 'high_risk': riskScore += 5; break;
      case 'medium_risk': riskScore += 3; break;
      case 'low_risk': riskScore += 1; break;
    }

    // Keyword scoring
    riskScore += keywords.high_risk.length * 3;
    riskScore += keywords.medium_risk.length * 2;
    riskScore += keywords.low_risk.length * 1;

    // Pattern scoring
    riskScore += patterns.high_risk.length * 4;
    riskScore += patterns.medium_risk.length * 2;
    riskScore += patterns.low_risk.length * 1;

    // Determine risk level
    if (riskScore >= 8) return 'high';
    if (riskScore >= 4) return 'medium';
    if (riskScore >= 1) return 'low';
    return 'none';
  }

  /**
   * Get crisis response recommendations
   */
  getCrisisResponse(riskLevel) {
    const responses = {
      high: {
        immediate: true,
        message: "I'm very concerned about what you've shared. Your life has value and there are people who want to help you. Please reach out to a crisis counselor right away.",
        actions: [
          "Contact National Suicide Prevention Lifeline: 988",
          "Text HOME to 741741 for Crisis Text Line",
          "Go to your nearest emergency room",
          "Call 911 if you're in immediate danger"
        ]
      },
      medium: {
        immediate: false,
        message: "It sounds like you're going through a really difficult time. I want you to know that these feelings can change and support is available.",
        actions: [
          "Consider talking to a counselor or therapist",
          "Reach out to a trusted friend or family member",
          "Contact a mental health helpline for support",
          "Practice self-care and safety planning"
        ]
      },
      low: {
        immediate: false,
        message: "I hear that you're struggling right now. It's brave of you to share these feelings.",
        actions: [
          "Consider professional counseling",
          "Practice stress management techniques",
          "Maintain connection with supportive people",
          "Focus on self-care activities"
        ]
      }
    };

    return responses[riskLevel] || null;
  }
}

module.exports = new CrisisDetectionService();