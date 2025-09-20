/**
 * Assessment Routes
 * Mental health assessments and mood tracking
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const User = require('../models/User');
const { authMiddleware, auditMiddleware } = require('../middlewares/auth');
const { logger } = require('../middlewares/security');

const router = express.Router();

// Rate limiting for assessment operations
const assessmentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 assessment requests per windowMs
  message: {
    error: 'Too many assessment requests, please try again later.'
  }
});

// Apply rate limiting and authentication to all assessment routes
router.use(assessmentLimiter);
router.use(authMiddleware);

/**
 * POST /api/assessments/mood
 * Submit a mood assessment
 */
router.post('/mood', [
  body('mood').isInt({ min: 1, max: 10 }),
  body('energy').optional().isInt({ min: 1, max: 10 }),
  body('anxiety').optional().isInt({ min: 1, max: 10 }),
  body('notes').optional().isString().isLength({ max: 500 }),
  auditMiddleware('mood_assessment')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { mood, energy, anxiety, notes } = req.body;
    
    const assessment = {
      type: 'mood',
      timestamp: new Date(),
      data: {
        mood,
        energy: energy || null,
        anxiety: anxiety || null,
        notes: notes || ''
      }
    };

    // Store assessment (in a real app, you'd have an Assessment model)
    // For now, we'll add it to user's mental health profile
    const user = await User.findById(req.user.userId);
    if (!user.mentalHealthProfile.assessments) {
      user.mentalHealthProfile.assessments = [];
    }
    
    user.mentalHealthProfile.assessments.push(assessment);
    
    // Keep only last 100 assessments
    if (user.mentalHealthProfile.assessments.length > 100) {
      user.mentalHealthProfile.assessments = user.mentalHealthProfile.assessments.slice(-100);
    }
    
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Mood assessment recorded successfully',
      assessment: {
        id: assessment.timestamp.getTime(),
        type: assessment.type,
        timestamp: assessment.timestamp,
        data: assessment.data
      }
    });

  } catch (error) {
    logger.error('Mood assessment error:', error);
    res.status(500).json({
      error: 'Failed to record mood assessment',
      message: error.message
    });
  }
});

/**
 * GET /api/assessments/mood/history
 * Get mood assessment history
 */
router.get('/mood/history', [
  auditMiddleware('mood_history_view')
], async (req, res) => {
  try {
    const { days = 30, limit = 50 } = req.query;
    
    const user = await User.findById(req.user.userId);
    if (!user || !user.mentalHealthProfile.assessments) {
      return res.json({
        success: true,
        assessments: [],
        summary: {
          total: 0,
          avgMood: 0,
          avgEnergy: 0,
          avgAnxiety: 0
        }
      });
    }

    // Filter assessments by date range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    
    const assessments = user.mentalHealthProfile.assessments
      .filter(a => a.type === 'mood' && a.timestamp >= cutoffDate)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, parseInt(limit));

    // Calculate summary statistics
    const summary = {
      total: assessments.length,
      avgMood: 0,
      avgEnergy: 0,
      avgAnxiety: 0
    };

    if (assessments.length > 0) {
      const totals = assessments.reduce((acc, assessment) => {
        acc.mood += assessment.data.mood || 0;
        acc.energy += assessment.data.energy || 0;
        acc.anxiety += assessment.data.anxiety || 0;
        acc.energyCount += assessment.data.energy ? 1 : 0;
        acc.anxietyCount += assessment.data.anxiety ? 1 : 0;
        return acc;
      }, { mood: 0, energy: 0, anxiety: 0, energyCount: 0, anxietyCount: 0 });

      summary.avgMood = Math.round((totals.mood / assessments.length) * 10) / 10;
      summary.avgEnergy = totals.energyCount > 0 ? Math.round((totals.energy / totals.energyCount) * 10) / 10 : 0;
      summary.avgAnxiety = totals.anxietyCount > 0 ? Math.round((totals.anxiety / totals.anxietyCount) * 10) / 10 : 0;
    }

    res.json({
      success: true,
      assessments: assessments.map(a => ({
        id: a.timestamp.getTime(),
        timestamp: a.timestamp,
        mood: a.data.mood,
        energy: a.data.energy,
        anxiety: a.data.anxiety,
        notes: a.data.notes
      })),
      summary,
      dateRange: {
        from: cutoffDate.toISOString(),
        to: new Date().toISOString(),
        days: parseInt(days)
      }
    });

  } catch (error) {
    logger.error('Mood history fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch mood history',
      message: error.message
    });
  }
});

/**
 * POST /api/assessments/phq9
 * Submit PHQ-9 depression screening
 */
router.post('/phq9', [
  body('responses').isArray({ min: 9, max: 9 }),
  body('responses.*').isInt({ min: 0, max: 3 }),
  auditMiddleware('phq9_assessment')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed - PHQ-9 requires exactly 9 responses, each between 0-3',
        details: errors.array()
      });
    }

    const { responses } = req.body;
    
    // Calculate PHQ-9 score
    const score = responses.reduce((sum, response) => sum + response, 0);
    
    // Determine severity level
    let severity, recommendation;
    if (score >= 0 && score <= 4) {
      severity = 'minimal';
      recommendation = 'Continue monitoring your mental health. Consider lifestyle improvements like regular exercise, adequate sleep, and stress management.';
    } else if (score >= 5 && score <= 9) {
      severity = 'mild';
      recommendation = 'Consider speaking with a healthcare professional about your symptoms. Self-care strategies and counseling may be beneficial.';
    } else if (score >= 10 && score <= 14) {
      severity = 'moderate';
      recommendation = 'It is recommended to consult with a mental health professional. Treatment options may include therapy and/or medication.';
    } else if (score >= 15 && score <= 19) {
      severity = 'moderately_severe';
      recommendation = 'Please consult with a mental health professional promptly. Professional treatment is strongly recommended.';
    } else if (score >= 20 && score <= 27) {
      severity = 'severe';
      recommendation = 'Please seek immediate professional help. Contact a mental health provider or crisis service right away.';
    }

    const assessment = {
      type: 'phq9',
      timestamp: new Date(),
      data: {
        responses,
        score,
        severity,
        recommendation
      }
    };

    // Store assessment
    const user = await User.findById(req.user.userId);
    if (!user.mentalHealthProfile.assessments) {
      user.mentalHealthProfile.assessments = [];
    }
    
    user.mentalHealthProfile.assessments.push(assessment);
    await user.save();

    // Log severe scores for monitoring
    if (score >= 15) {
      logger.warn(`High PHQ-9 score recorded for user ${req.user.userId}: ${score}`, {
        userId: req.user.userId,
        score,
        severity,
        timestamp: new Date()
      });
    }

    res.status(201).json({
      success: true,
      message: 'PHQ-9 assessment completed successfully',
      assessment: {
        id: assessment.timestamp.getTime(),
        type: 'phq9',
        timestamp: assessment.timestamp,
        score,
        severity,
        recommendation,
        resources: score >= 10 ? {
          crisis_lines: [
            {
              name: "National Suicide Prevention Lifeline",
              number: "988",
              description: "24/7 free and confidential support"
            }
          ],
          professional_help: [
            "Contact your primary care doctor",
            "Find a local mental health provider",
            "Consider online therapy options"
          ]
        } : null
      }
    });

  } catch (error) {
    logger.error('PHQ-9 assessment error:', error);
    res.status(500).json({
      error: 'Failed to complete PHQ-9 assessment',
      message: error.message
    });
  }
});

/**
 * POST /api/assessments/gad7
 * Submit GAD-7 anxiety screening
 */
router.post('/gad7', [
  body('responses').isArray({ min: 7, max: 7 }),
  body('responses.*').isInt({ min: 0, max: 3 }),
  auditMiddleware('gad7_assessment')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed - GAD-7 requires exactly 7 responses, each between 0-3',
        details: errors.array()
      });
    }

    const { responses } = req.body;
    
    // Calculate GAD-7 score
    const score = responses.reduce((sum, response) => sum + response, 0);
    
    // Determine severity level
    let severity, recommendation;
    if (score >= 0 && score <= 4) {
      severity = 'minimal';
      recommendation = 'Your anxiety levels appear minimal. Continue with healthy lifestyle practices.';
    } else if (score >= 5 && score <= 9) {
      severity = 'mild';
      recommendation = 'You may be experiencing mild anxiety. Consider relaxation techniques and speak with a healthcare professional if symptoms persist.';
    } else if (score >= 10 && score <= 14) {
      severity = 'moderate';
      recommendation = 'Moderate anxiety detected. Professional consultation is recommended to explore treatment options.';
    } else if (score >= 15 && score <= 21) {
      severity = 'severe';
      recommendation = 'Severe anxiety detected. Please seek professional help promptly. Treatment can significantly improve your quality of life.';
    }

    const assessment = {
      type: 'gad7',
      timestamp: new Date(),
      data: {
        responses,
        score,
        severity,
        recommendation
      }
    };

    // Store assessment
    const user = await User.findById(req.user.userId);
    if (!user.mentalHealthProfile.assessments) {
      user.mentalHealthProfile.assessments = [];
    }
    
    user.mentalHealthProfile.assessments.push(assessment);
    await user.save();

    // Log high anxiety scores
    if (score >= 10) {
      logger.warn(`High GAD-7 score recorded for user ${req.user.userId}: ${score}`, {
        userId: req.user.userId,
        score,
        severity,
        timestamp: new Date()
      });
    }

    res.status(201).json({
      success: true,
      message: 'GAD-7 assessment completed successfully',
      assessment: {
        id: assessment.timestamp.getTime(),
        type: 'gad7',
        timestamp: assessment.timestamp,
        score,
        severity,
        recommendation
      }
    });

  } catch (error) {
    logger.error('GAD-7 assessment error:', error);
    res.status(500).json({
      error: 'Failed to complete GAD-7 assessment',
      message: error.message
    });
  }
});

/**
 * GET /api/assessments/history
 * Get all assessment history
 */
router.get('/history', [
  auditMiddleware('assessment_history_view')
], async (req, res) => {
  try {
    const { type, days = 90, limit = 100 } = req.query;
    
    const user = await User.findById(req.user.userId);
    if (!user || !user.mentalHealthProfile.assessments) {
      return res.json({
        success: true,
        assessments: [],
        summary: { total: 0 }
      });
    }

    // Filter assessments
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    
    let assessments = user.mentalHealthProfile.assessments
      .filter(a => a.timestamp >= cutoffDate);
    
    if (type) {
      assessments = assessments.filter(a => a.type === type);
    }
    
    assessments = assessments
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, parseInt(limit));

    // Create summary
    const summary = {
      total: assessments.length,
      byType: assessments.reduce((acc, a) => {
        acc[a.type] = (acc[a.type] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({
      success: true,
      assessments: assessments.map(a => ({
        id: a.timestamp.getTime(),
        type: a.type,
        timestamp: a.timestamp,
        score: a.data.score || null,
        severity: a.data.severity || null,
        data: a.data
      })),
      summary,
      dateRange: {
        from: cutoffDate.toISOString(),
        to: new Date().toISOString(),
        days: parseInt(days)
      }
    });

  } catch (error) {
    logger.error('Assessment history fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch assessment history',
      message: error.message
    });
  }
});

/**
 * GET /api/assessments/forms
 * Get available assessment forms and their descriptions
 */
router.get('/forms', async (req, res) => {
  try {
    const forms = {
      mood: {
        name: 'Daily Mood Check-in',
        description: 'Quick daily assessment of your mood, energy, and anxiety levels',
        duration: '1-2 minutes',
        frequency: 'Daily'
      },
      phq9: {
        name: 'PHQ-9 Depression Screening',
        description: 'Patient Health Questionnaire for depression screening',
        duration: '3-5 minutes',
        frequency: 'Weekly or as needed'
      },
      gad7: {
        name: 'GAD-7 Anxiety Screening',
        description: 'Generalized Anxiety Disorder 7-item scale',
        duration: '2-3 minutes',
        frequency: 'Weekly or as needed'
      }
    };

    res.json({
      success: true,
      forms
    });

  } catch (error) {
    logger.error('Forms fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch assessment forms',
      message: error.message
    });
  }
});

module.exports = router;