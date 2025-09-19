/**
 * Backend API Integration Tests
 * Tests the complete backend API functionality
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../backend/server');
const User = require('../../backend/models/User');

describe('Mental Wellness AI - Backend Integration Tests', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mental_wellness_ai_test';
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    // Clean up test database
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear database before each test
    await User.deleteMany({});
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/register', () => {
      it('should register an anonymous user', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            age: 18,
            anonymous: true,
            termsAccepted: true
          });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('token');
        expect(response.body.user).toHaveProperty('id');
        expect(response.body.user.anonymous).toBe(true);
      });

      it('should register a user with email', async () => {
        const userData = {
          email: 'test@example.com',
          password: 'securePassword123',
          age: 20,
          anonymous: false,
          termsAccepted: true
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('token');
        expect(response.body.user.email).toBe(userData.email);
        expect(response.body.user.anonymous).toBe(false);
      });

      it('should reject registration with invalid data', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            age: 12, // Too young
            termsAccepted: false // Terms not accepted
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });
    });

    describe('POST /api/auth/login', () => {
      beforeEach(async () => {
        // Create a test user
        testUser = new User({
          email: 'test@example.com',
          password: 'securePassword123',
          age: 20,
          anonymous: false,
          termsAccepted: true
        });
        await testUser.save();
      });

      it('should login with valid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'securePassword123'
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token');
        expect(response.body.user.email).toBe('test@example.com');
        
        authToken = response.body.token;
      });

      it('should reject invalid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongPassword'
          });

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Chat Endpoints', () => {
    beforeEach(async () => {
      // Create and authenticate test user
      testUser = new User({
        email: 'chattest@example.com',
        password: 'securePassword123',
        age: 19,
        anonymous: false,
        termsAccepted: true
      });
      await testUser.save();

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'chattest@example.com',
          password: 'securePassword123'
        });

      authToken = loginResponse.body.token;
    });

    describe('POST /api/chat/message', () => {
      it('should process a normal chat message', async () => {
        const response = await request(app)
          .post('/api/chat/message')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Hello, I am feeling a bit stressed about school today.'
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toHaveProperty('content');
        expect(response.body).toHaveProperty('sentiment');
        expect(response.body.crisisDetected).toBe(false);
      });

      it('should detect crisis language', async () => {
        const response = await request(app)
          .post('/api/chat/message')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'I feel hopeless and want to hurt myself'
          });

        expect(response.status).toBe(200);
        expect(response.body.crisisDetected).toBe(true);
        expect(response.body).toHaveProperty('crisisLevel');
        expect(response.body).toHaveProperty('emergencyResources');
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/chat/message')
          .send({
            message: 'Hello'
          });

        expect(response.status).toBe(401);
      });

      it('should validate message length', async () => {
        const longMessage = 'a'.repeat(2001); // Exceeds 2000 character limit

        const response = await request(app)
          .post('/api/chat/message')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: longMessage
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/chat/sessions', () => {
      it('should return user chat sessions', async () => {
        // First send a message to create a session
        await request(app)
          .post('/api/chat/message')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Hello, this is a test message'
          });

        const response = await request(app)
          .get('/api/chat/sessions')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('sessions');
        expect(Array.isArray(response.body.sessions)).toBe(true);
        expect(response.body).toHaveProperty('pagination');
      });
    });
  });

  describe('Crisis Detection', () => {
    beforeEach(async () => {
      // Create and authenticate test user
      testUser = new User({
        email: 'crisistest@example.com',
        password: 'securePassword123',
        age: 17,
        anonymous: false,
        termsAccepted: true
      });
      await testUser.save();

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'crisistest@example.com',
          password: 'securePassword123'
        });

      authToken = loginResponse.body.token;
    });

    describe('POST /api/chat/crisis-check', () => {
      it('should analyze crisis indicators', async () => {
        const testMessages = [
          {
            message: 'I want to kill myself',
            expectedRisk: 'high'
          },
          {
            message: 'I hate my life and feel worthless',
            expectedRisk: 'medium'
          },
          {
            message: 'I am feeling sad today',
            expectedRisk: 'low'
          },
          {
            message: 'What a beautiful day!',
            expectedRisk: 'none'
          }
        ];

        for (const test of testMessages) {
          const response = await request(app)
            .post('/api/chat/crisis-check')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              message: test.message
            });

          expect(response.status).toBe(200);
          expect(response.body).toHaveProperty('riskLevel');
          expect(response.body).toHaveProperty('analysis');
          
          if (test.expectedRisk !== 'none') {
            expect(response.body).toHaveProperty('response');
          }
        }
      });
    });
  });

  describe('Health and Status', () => {
    describe('GET /health', () => {
      it('should return health status', async () => {
        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'healthy');
        expect(response.body).toHaveProperty('service', 'mental-wellness-ai-backend');
        expect(response.body).toHaveProperty('timestamp');
      });
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      // Create and authenticate test user
      testUser = new User({
        email: 'ratetest@example.com',
        password: 'securePassword123',
        age: 21,
        anonymous: false,
        termsAccepted: true
      });
      await testUser.save();

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'ratetest@example.com',
          password: 'securePassword123'
        });

      authToken = loginResponse.body.token;
    });

    it('should enforce rate limiting on chat messages', async () => {
      const promises = [];
      
      // Send 35 messages rapidly (exceeds 30 per minute limit)
      for (let i = 0; i < 35; i++) {
        promises.push(
          request(app)
            .post('/api/chat/message')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              message: `Test message ${i}`
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});