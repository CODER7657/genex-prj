# 🎨 Mental Wellness AI - Frontend Application

<div align="center">
  <img width="100" alt="React Native Logo" src="https://reactnative.dev/img/header_logo.svg" />
  
  **Modern React Native frontend with 3D animations, glass morphism, and AI chat interface**
  
  [![React Native](https://img.shields.io/badge/React%20Native-0.72-blue.svg)](https://reactnative.dev/)
  [![Expo](https://img.shields.io/badge/Expo-49.0-black.svg)](https://expo.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4-cyan.svg)](https://tailwindcss.com/)
</div>

---

## 📋 Quick Navigation

- [🚀 Quick Start](#-quick-start)
- [🔗 Backend Connection](#-backend-connection)
- [⚙️ Configuration](#️-configuration)
- [🎨 Features](#-features)
- [📱 Platform Support](#-platform-support)
- [🔧 Development](#-development)
- [🚀 Deployment](#-deployment)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Expo CLI** (`npm install -g @expo/cli`)
- **Backend Server** running on `http://localhost:5000`

### Installation

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start the development server
npm start
```

### Platform Access

After running `npm start`, you can access the app on:

| Platform | Command | URL |
|----------|---------|-----|
| 🌐 **Web Browser** | Press `w` | http://localhost:19006 |
| 📱 **iOS Simulator** | Press `i` | Requires Xcode |
| 🤖 **Android Emulator** | Press `a` | Requires Android Studio |
| 📲 **Physical Device** | Scan QR code | Use Expo Go app |

---

## 🔗 Backend Connection

### 🔧 API Service Configuration

The frontend connects to the backend through the API service layer:

```typescript
// services/apiService.js
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = null;
  }

  // Authentication
  async login(email, password) {
    const response = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return response.json();
  }

  // Chat messaging
  async sendMessage(message, sessionId) {
    const response = await fetch(`${this.baseURL}/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ message, sessionId })
    });
    return response.json();
  }
}
```

### 🔄 Real-time Connection (Socket.IO)

```typescript
// services/socketService.js
import io from 'socket.io-client';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:5000';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
  }

  connect(userId) {
    this.socket = io(SOCKET_URL, {
      auth: { userId },
      transports: ['websocket']
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to backend');
      this.connected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from backend');
      this.connected = false;
    });

    // Real-time message updates
    this.socket.on('message', (data) => {
      this.handleNewMessage(data);
    });
  }
}
```

---

## ⚙️ Configuration

### 🌐 Environment Variables

Create `.env` file in the frontend directory:

```bash
# =============================================================================
# FRONTEND CONFIGURATION
# =============================================================================

# Backend API Configuration
EXPO_PUBLIC_API_URL=http://localhost:5000/api
EXPO_PUBLIC_SOCKET_URL=http://localhost:5000

# Gemini AI (Client-side fallback)
EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-api-key-here

# App Configuration
EXPO_PUBLIC_APP_NAME=Mental Wellness AI
EXPO_PUBLIC_APP_VERSION=1.0.0

# Feature Flags
EXPO_PUBLIC_ENABLE_VOICE=true
EXPO_PUBLIC_ENABLE_ANALYTICS=true
EXPO_PUBLIC_ENABLE_3D_BACKGROUND=true

# Development Settings
EXPO_PUBLIC_DEBUG_MODE=true
EXPO_PUBLIC_API_TIMEOUT=10000
```

### 🔧 Backend Connection Status

Check backend connectivity with the health check endpoint:

```typescript
// utils/connectionHealth.js
export const checkBackendHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();
    
    return {
      connected: true,
      status: data.status,
      services: data.services
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message
    };
  }
};
```

### 🔄 Automatic Reconnection

```typescript
// hooks/useBackendConnection.js
import { useState, useEffect } from 'react';
import { checkBackendHealth } from '../utils/connectionHealth';

export const useBackendConnection = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const checkConnection = async () => {
      const health = await checkBackendHealth();
      setIsConnected(health.connected);
      
      if (!health.connected && retryCount < 5) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, 2000 * Math.pow(2, retryCount)); // Exponential backoff
      }
    };

    checkConnection();
  }, [retryCount]);

  return { isConnected, retryCount };
};
```

---

## 🎨 Features

### 🌟 UI/UX Features

#### 🎭 3D Grid Background
- **Animated Grid Lines** - Continuously moving 3D perspective
- **Floating Particles** - Dynamic particle system
- **Performance Optimized** - Smooth 60fps animations

#### 🔮 Glass Morphism Design
- **Backdrop Blur Effects** - Advanced CSS blur with fallbacks
- **Semi-transparent Surfaces** - Layered glass materials
- **Interactive Hover States** - Dynamic blur intensity

#### 🎨 Theme System
- **Light/Dark Modes** - System preference aware
- **Custom Color Palettes** - Mental wellness focused colors
- **Responsive Design** - Mobile-first approach

### 🤖 AI Integration

#### 💬 Chat Interface
```typescript
// components/ChatScreen.tsx
const ChatScreen = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (text) => {
    setIsLoading(true);
    try {
      // Send to backend API
      const response = await apiService.sendMessage(text);
      setMessages(prev => [...prev, response.message]);
    } catch (error) {
      // Fallback to direct Gemini API
      const fallbackResponse = await geminiService.generateResponse(text);
      setMessages(prev => [...prev, fallbackResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-container-3d">
      {/* 3D Background */}
      <div className="grid-3d-background">
        <div className="grid-3d-container">
          <div className="grid-3d-lines"></div>
        </div>
      </div>
      
      {/* Chat Interface */}
      <div className="glass-header">
        <h1>AI Wellness Companion</h1>
      </div>
      
      <div className="message-container">
        {messages.map((msg, index) => (
          <MessageBubble key={index} message={msg} />
        ))}
      </div>
      
      <div className="glass-footer">
        <MessageInput onSend={sendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
};
```

### 🎤 Voice Integration

```typescript
// services/voiceService.js
class VoiceService {
  constructor() {
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
  }

  startListening(onResult) {
    if ('webkitSpeechRecognition' in window) {
      this.recognition = new webkitSpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      
      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
      };
      
      this.recognition.start();
    }
  }

  speak(text, options = {}) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate || 0.9;
    utterance.pitch = options.pitch || 1;
    utterance.volume = options.volume || 0.8;
    
    this.synthesis.speak(utterance);
  }
}
```

---

## 📱 Platform Support

### 🌐 Web Browser
- **Chrome/Edge** - Full feature support
- **Firefox** - Full feature support
- **Safari** - Limited backdrop-filter support
- **Mobile Browsers** - Responsive design

### 📱 Mobile Applications

#### iOS Support
```bash
# Development build
npx expo run:ios

# Production build
eas build --platform ios --profile production
```

#### Android Support
```bash
# Development build
npx expo run:android

# Production build
eas build --platform android --profile production
```

### 📊 Feature Compatibility Matrix

| Feature | Web | iOS | Android | Status |
|---------|-----|-----|---------|--------|
| 💬 Chat Interface | ✅ | ✅ | ✅ | Complete |
| 🎭 3D Background | ✅ | ✅ | ✅ | Complete |
| 🔮 Glass Morphism | ⚠️ | ✅ | ✅ | Safari limitations |
| 🎤 Voice Input | ✅ | ✅ | ✅ | Complete |
| 📊 Analytics | ✅ | ✅ | ✅ | Complete |
| 🌙 Dark Mode | ✅ | ✅ | ✅ | Complete |
| 📱 Push Notifications | ❌ | ✅ | ✅ | Mobile only |

---

## 🔧 Development

### 🏗️ Project Structure

```
frontend/
├── 📄 App.js                     # Root component
├── 📄 app.json                   # Expo configuration
├── 📄 babel.config.js            # Babel configuration
├── 📄 tailwind.config.js         # Tailwind CSS configuration
├── 📄 metro.config.js            # Metro bundler configuration
├── 📁 components/                # Reusable UI components
│   ├── 💬 ChatScreen.tsx         # Main chat interface
│   ├── 😊 MoodCheckIn.tsx        # Mood tracking component
│   ├── 📊 MoodAnalytics.tsx      # Analytics dashboard
│   ├── 🎤 VoiceControls.tsx      # Voice interaction controls
│   ├── 🧘 WellnessResources.tsx  # Resource recommendations
│   └── 🎯 GoalsAndReminders.tsx  # Goal management
├── 📁 services/                  # API and external services
│   ├── 🔌 apiService.js          # Backend API client
│   ├── 🤖 geminiService.js       # Gemini AI integration
│   ├── 🎤 voiceService.js        # Speech recognition/synthesis
│   ├── 💾 storageService.js      # Local data persistence
│   └── 🔌 socketService.js       # Real-time communication
├── 📁 hooks/                     # Custom React hooks
│   ├── 🔐 useAuth.js             # Authentication state
│   ├── 🎨 useTheme.js            # Theme management
│   └── 🔗 useBackendConnection.js # Backend connectivity
├── 📁 contexts/                  # React context providers
│   ├── 🔐 AuthContext.js         # Authentication context
│   └── 🎨 ThemeContext.js        # Theme context
├── 📁 assets/                    # Static assets and styling
│   ├── 🎨 theme.js               # Design system configuration
│   ├── 🖼️ images/               # Image assets
│   └── 🔤 fonts/                # Custom fonts
├── 📁 types/                     # TypeScript type definitions
│   ├── 📝 Message.ts             # Chat message types
│   ├── 👤 User.ts                # User data types
│   └── 😊 Mood.ts                # Mood tracking types
└── 📁 utils/                     # Utility functions
    ├── 🔗 connectionHealth.js    # Backend health checks
    ├── 📅 dateUtils.js           # Date formatting utilities
    └── 🔒 encryption.js          # Client-side encryption
```

### 🛠️ Development Commands

```bash
# Start development server
npm start

# Start with specific platform
npm run ios          # iOS simulator
npm run android      # Android emulator
npm run web          # Web browser

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test

# Type checking
npm run type-check

# Lint code
npm run lint
npm run lint:fix

# Format code
npm run prettier
```

### 🔧 Debugging

#### React Native Debugger
```bash
# Install React Native Debugger
brew install --cask react-native-debugger

# Start debugging session
npm start
# Press 'd' in terminal to open developer menu
# Select "Debug JS Remotely"
```

#### Expo Dev Tools
```bash
# Open Expo dev tools
npm start
# Press 'd' to open developer tools in browser
```

#### Console Logging
```typescript
// Debug API calls
console.log('🔌 API Request:', { endpoint, data });
console.log('📨 API Response:', response);

// Debug component lifecycle
console.log('🎨 Component rendered:', componentName);

// Debug backend connection
console.log('🔗 Backend health:', await checkBackendHealth());
```

---

## 🚀 Deployment

### 🌐 Web Deployment

#### Vercel Deployment
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

#### Netlify Deployment
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy to production
netlify deploy --prod
```

### 📱 Mobile App Deployment

#### App Store (iOS)
```bash
# Configure EAS
eas login
eas init

# Build for App Store
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

#### Google Play Store (Android)
```bash
# Build for Play Store
eas build --platform android --profile production

# Submit to Play Store
eas submit --platform android
```

### 🔧 Environment-Specific Configurations

#### Production Configuration
```typescript
// app.config.js
export default {
  expo: {
    name: "Mental Wellness AI",
    slug: "mental-wellness-ai",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#6B46C1"
    },
    updates: {
      fallbackToCacheTimeout: 0
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.mentalwellness.ai"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#6B46C1"
      },
      package: "com.mentalwellness.ai"
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro"
    },
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY
    }
  }
};
```

---

## 📞 Support & Troubleshooting

### 🔧 Common Issues

#### Backend Connection Issues
```bash
# Check if backend is running
curl http://localhost:5000/api/health

# Check environment variables
echo $EXPO_PUBLIC_API_URL

# Clear Expo cache
expo r -c
```

#### Build Issues
```bash
# Clear all caches
expo r -c
npm start --reset-cache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### Platform-Specific Issues
```bash
# iOS simulator issues
npx expo run:ios --device

# Android emulator issues
npx expo run:android --device

# Web browser issues
npm run web
```

### 📚 Documentation Links

- **Expo Documentation**: https://docs.expo.dev/
- **React Native Documentation**: https://reactnative.dev/docs/getting-started
- **Tailwind CSS**: https://tailwindcss.com/docs
- **TypeScript**: https://www.typescriptlang.org/docs/

### 💬 Getting Help

- **GitHub Issues**: Report bugs and feature requests
- **Expo Forums**: Community support for Expo-specific issues
- **React Native Community**: General React Native questions
- **Discord Server**: Real-time development chat

---

<div align="center">
  <sub>🎨 Frontend built with React Native + Expo</sub>
  <br>
  <sub>✨ Featuring 3D animations and glass morphism design</sub>
</div>
