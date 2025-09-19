# Mental Wellness AI - Setup Guide for Development Team

## 🚀 Quick Start

This project is organized for a 3-member team structure:
- **Member 1**: AI/Backend Lead (Node.js, Express, AI integration)
- **Member 2**: Frontend/Mobile Lead (React Native, Firebase Auth)
- **Member 3**: DevOps/Security & Integration (Docker, CI/CD, HIPAA compliance)

## 📁 Project Structure

```
mental-wellness-ai-prototype/
├── backend/                 # Node.js API & AI Services (Member 1)
│   ├── server.js           # Main Express server
│   ├── package.json        # Backend dependencies
│   ├── ai/                 # AI chatbot & crisis detection
│   ├── routes/             # API routes (auth, chat, users)
│   ├── models/             # MongoDB schemas
│   ├── middlewares/        # Auth, HIPAA, rate limiting
│   └── config/             # Database & app configuration
├── frontend/               # React Native App (Member 2)
│   ├── App.js              # Main React Native app
│   ├── package.json        # Frontend dependencies
│   ├── screens/            # App screens (Chat, Auth, etc.)
│   ├── components/         # Reusable UI components
│   ├── hooks/              # Custom hooks (useAuth, useChat)
│   ├── api/                # API client & Firebase config
│   └── assets/             # Images, fonts, themes
├── devops/                 # CI/CD & Deployment (Member 3)
│   ├── docker-compose.yml  # Full stack deployment
│   ├── .github/workflows/  # GitHub Actions CI/CD
│   ├── monitoring/         # Prometheus, Grafana configs
│   └── security/           # HIPAA compliance scripts
├── docs/                   # Documentation & Presentation
├── tests/                  # Testing (unit, integration, e2e)
└── scripts/                # Development & deployment scripts
```

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- MongoDB 7.0+
- Redis 7.0+
- Docker & Docker Compose
- Firebase Account
- OpenAI/Gemini API Keys

### Environment Variables

Create `.env` files in both `backend/` and `frontend/` directories:

**Backend `.env`:**
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/mental_wellness_ai
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-key-change-this
OPENAI_API_KEY=your-openai-api-key
GEMINI_API_KEY=your-gemini-api-key
FIREBASE_PROJECT_ID=your-firebase-project
ALLOWED_ORIGINS=http://localhost:3000,exp://localhost:19000
HIPAA_ENCRYPTION_KEY=your-hipaa-encryption-key
```

**Frontend `.env`:**
```env
EXPO_PUBLIC_API_URL=http://localhost:5000/api
EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

## 🎯 Member-Specific Setup Guides

### Member 1 - AI/Backend Lead

#### Tech Stack
- Node.js + Express.js
- MongoDB + Mongoose
- Socket.IO for real-time chat
- OpenAI/Gemini API integration
- Natural language processing (sentiment analysis)
- HIPAA-compliant security

#### Getting Started
```bash
cd backend
npm install
npm run dev
```

#### Key Responsibilities
- ✅ AI chatbot implementation (GPT/Gemini integration)
- ✅ Crisis detection system (keywords + sentiment analysis)
- ✅ REST API development (auth, chat, users)
- ✅ MongoDB schema design
- ✅ Real-time chat with Socket.IO
- ✅ HIPAA compliance measures

#### Priority Tasks
1. Set up MongoDB connection and user schemas
2. Implement Firebase Auth verification middleware
3. Build AI chat service with crisis detection
4. Create REST APIs for chat, mood tracking
5. Add Socket.IO for real-time messaging
6. Implement data encryption and audit logging

### Member 2 - Frontend/Mobile Lead

#### Tech Stack
- React Native + Expo
- Firebase Authentication
- Redux Toolkit for state management
- React Native Paper for UI components
- Socket.IO client for real-time chat
- Gifted Chat for chat interface

#### Getting Started
```bash
cd frontend
npm install
npx expo start
```

#### Key Responsibilities
- ✅ React Native app with Expo
- ✅ Firebase Auth integration (anonymous + email)
- ✅ Real-time chat UI with crisis alerts
- ✅ Mood check-in interface
- ✅ API integration with backend
- ✅ Accessible, Gen-Z friendly UI/UX

#### Priority Tasks
1. Set up Firebase Auth (anonymous + Google/email)
2. Build chat interface with Gifted Chat
3. Implement mood tracking and visualization
4. Create onboarding flow for users
5. Add crisis alert notifications
6. Design accessible, youth-friendly UI

### Member 3 - DevOps/Security & Integration

#### Tech Stack
- Docker + Docker Compose
- GitHub Actions CI/CD
- Nginx reverse proxy
- Prometheus + Grafana monitoring
- MongoDB + Redis containerized
- HIPAA security scanning

#### Getting Started
```bash
cd devops
docker-compose up -d
```

#### Key Responsibilities
- ✅ Complete containerized deployment
- ✅ CI/CD pipeline with GitHub Actions
- ✅ HIPAA compliance automation
- ✅ Monitoring and logging setup
- ✅ Security scanning and backups
- ✅ Production deployment orchestration

#### Priority Tasks
1. Set up Docker containers for full stack
2. Configure CI/CD pipeline with security scans
3. Implement HIPAA compliance checks
4. Set up monitoring (Prometheus/Grafana)
5. Configure automated backups
6. Deploy to cloud infrastructure

## 🔐 HIPAA Compliance Checklist

- [x] Data encryption in transit (TLS 1.2+)
- [x] Data encryption at rest (AES-256)
- [x] Access controls and authentication
- [x] Audit logging for all data access
- [x] Automatic session timeouts
- [x] Secure password policies
- [x] Regular security vulnerability scans
- [x] Data backup and recovery procedures
- [x] User data anonymization options
- [x] Breach notification procedures

## 🧪 Testing Strategy

- **Unit Tests**: Jest for backend/frontend components
- **Integration Tests**: API endpoint testing with Supertest
- **E2E Tests**: User flow testing with Detox
- **Load Tests**: Performance testing with Artillery
- **Security Tests**: OWASP ZAP security scanning
- **Crisis Detection Tests**: ML model validation

## 📊 Key Features to Implement

### Core Features
1. **AI-Powered Chat**: Empathetic conversation with GPT/Gemini
2. **Crisis Detection**: Real-time analysis of user messages
3. **Mood Tracking**: Daily check-ins and mood visualization
4. **Anonymous Support**: Privacy-first approach for users
5. **Emergency Resources**: Crisis hotlines and resources
6. **Real-time Alerts**: Immediate crisis response system

### Technical Features
1. **Real-time Communication**: Socket.IO chat implementation
2. **Offline Support**: Local storage and sync capabilities
3. **Push Notifications**: Crisis alerts and check-in reminders
4. **Data Analytics**: Anonymized usage and wellness metrics
5. **Multi-platform**: Mobile and web accessibility
6. **Scalable Infrastructure**: Cloud-native deployment

## 🚀 Deployment Process

### Development Environment
```bash
# Start all services
docker-compose -f devops/docker-compose.dev.yml up -d

# Backend development
cd backend && npm run dev

# Frontend development  
cd frontend && npx expo start
```

### Staging Deployment
```bash
# Automated via GitHub Actions on push to 'develop' branch
git push origin develop
```

### Production Deployment
```bash
# Automated via GitHub Actions on push to 'main' branch
git push origin main
```

## 📈 Success Metrics

- **Technical Metrics**: API response times, uptime, error rates
- **User Engagement**: Daily active users, session duration
- **Crisis Response**: Alert response times, resource engagement
- **Compliance**: Security scan results, audit log completeness
- **Performance**: Load handling, scalability metrics

## 🆘 Crisis Response Protocol

1. **Immediate Detection**: Real-time message analysis
2. **Alert System**: Instant notifications to user
3. **Resource Provision**: Crisis hotlines and local resources
4. **Professional Escalation**: When to involve human counselors
5. **Follow-up**: Check-in procedures after crisis events

## 📞 Support & Resources

- **Crisis Text Line**: Text HOME to 741741
- **National Suicide Prevention Lifeline**: 988
- **Mental Health America**: https://mhanational.org/
- **HIPAA Compliance Guide**: https://www.hhs.gov/hipaa/

---

**Remember**: This is a mental health application dealing with sensitive data. Always prioritize user safety, data privacy, and HIPAA compliance in every decision.