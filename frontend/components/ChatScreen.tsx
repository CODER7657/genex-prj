
import React, { useState, useRef, useEffect } from 'react';
import { Message, Mood, MoodLog } from '../types';
import { apiService } from '../services/apiService';
import { saveMoodLogs, loadMoodLogs, saveChatHistory, loadChatHistory, clearChatHistory } from '../services/storageService';
import { voiceService } from '../services/voiceService';
import { useTheme } from '../contexts/ThemeContext';
import MoodCheckIn from './MoodCheckIn';
import MoodAnalytics from './MoodAnalytics';
import WellnessResources from './WellnessResources';
import VoiceControls from './VoiceControls';
import GoalsAndReminders from './GoalsAndReminders';
import CrisisAlert from './CrisisAlert';
import { FaceSmileIcon, SendIcon } from './icons';

// Define components outside to prevent re-creation on re-renders
const AIMessageBubble: React.FC<{ text: string }> = ({ text }) => (
    <div className="flex justify-start animate-slide-in-right">
        <div className="glass-message-ai text-gray-800 dark:text-gray-200 rounded-2xl rounded-bl-none p-3 max-w-lg message-bubble hover-lift">
            <p className="text-sm">{text}</p>
        </div>
    </div>
);

const UserMessageBubble: React.FC<{ text: string }> = ({ text }) => (
    <div className="flex justify-end animate-slide-in-right">
        <div className="glass-message-user text-white rounded-2xl rounded-br-none p-3 max-w-lg message-bubble hover-lift">
            <p className="text-sm">{text}</p>
        </div>
    </div>
);

const LoadingBubble: React.FC = () => (
    <div className="flex justify-start animate-scale-in">
        <div className="glass-message-ai rounded-2xl rounded-bl-none p-3 max-w-lg">
            <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce"></div>
            </div>
        </div>
    </div>
);

const ChatScreen: React.FC = () => {
    const { theme, toggleTheme, preferences, updatePreferences } = useTheme();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [showMoodModal, setShowMoodModal] = useState(false);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [showResources, setShowResources] = useState(false);
    const [showVoiceSettings, setShowVoiceSettings] = useState(false);
    const [showGoalsReminders, setShowGoalsReminders] = useState(false);
    const [showCrisisAlert, setShowCrisisAlert] = useState(false);
    const [crisisLevel, setCrisisLevel] = useState<'low' | 'medium' | 'high'>('low');
    const [moodLogs, setMoodLogs] = useState<MoodLog[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load data from localStorage on component mount
    useEffect(() => {
        const savedMessages = loadChatHistory();
        const savedMoodLogs = loadMoodLogs();
        const savedSessionId = localStorage.getItem('currentSessionId');
        
        if (savedSessionId) {
            setSessionId(savedSessionId);
        }
        
        if (savedMessages.length > 0) {
            setMessages(savedMessages);
        } else {
            // Set default welcome message if no chat history
            const welcomeMessage: Message = { 
                role: 'model', 
                parts: [{ text: "Hello! I'm Aura, your AI wellness companion designed especially for you. I'm here to provide mental health support using evidence-based techniques. How are you feeling today?" }] 
            };
            setMessages([welcomeMessage]);
        }
        
        setMoodLogs(savedMoodLogs);
    }, []);

    // Save chat history and session whenever messages change
    useEffect(() => {
        if (messages.length > 0) {
            saveChatHistory(messages);
        }
    }, [messages]);

    // Save session ID whenever it changes
    useEffect(() => {
        if (sessionId) {
            localStorage.setItem('currentSessionId', sessionId);
        }
    }, [sessionId]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    // Auto-register user for demo purposes
    useEffect(() => {
        const initializeUser = async () => {
            try {
                // Check if we already have a token
                if (apiService.getToken()) {
                    return;
                }

                // Register a demo user
                const userData = {
                    username: `demo_user_${Date.now()}`,
                    email: `demo_${Date.now()}@example.com`,
                    password: 'Demo123!',
                    age: 25,
                    termsAccepted: true
                };

                await apiService.register(userData);
                console.log('✅ User registered and authenticated');
            } catch (error) {
                console.error('❌ Auto-registration failed:', error);
                setError('Failed to connect to backend. Please check if the server is running.');
            }
        };

        initializeUser();
    }, []);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;

        const userMessage: Message = { role: 'user', parts: [{ text: inputValue }] };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);
        setError(null);

        try {
            // Send message to backend API with current session
            const response = await apiService.sendMessage(
                userMessage.parts[0].text, 
                sessionId || undefined
            );
            
            console.log('🔄 Chat Response:', response);
            
            // Update session ID if provided (new session created or existing session)
            if (response.data?.sessionId && response.data.sessionId !== sessionId) {
                console.log('📝 Session ID updated:', response.data.sessionId);
                setSessionId(response.data.sessionId);
            }
            
            // Get AI response from backend response
            const aiResponseText = response.data?.aiResponse?.content || 
                                  response.data?.response || 
                                  response.aiResponse || 
                                  "I'm here to help you navigate your mental wellness journey.";
                                  
            const aiMessage: Message = { 
                role: 'model', 
                parts: [{ text: aiResponseText }] 
            };
            
            setMessages(prev => [...prev, aiMessage]);
            
            // Handle crisis detection
            if (response.data?.aiResponse?.crisisDetected) {
                const level = response.data.aiResponse.crisisLevel || 'low';
                console.log('🚨 Crisis detected:', level);
                setCrisisLevel(level as 'low' | 'medium' | 'high');
                setShowCrisisAlert(true);
                
                // Log crisis event for analytics
                console.log('Crisis triggers:', response.data.aiResponse.crisisTriggers);
            }
            
            // Auto-speak AI response if voice is enabled
            if (preferences.voiceEnabled && preferences.voiceAutoSpeak) {
                voiceService.speak(aiResponseText, {
                    rate: 0.9,
                    pitch: 1,
                    volume: 0.8
                });
            }
        } catch (err) {
            console.error('💥 Chat error:', err);
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            setError(errorMessage);
            
            const errorResponse: Message = { 
                role: 'model', 
                parts: [{ 
                    text: "I'm sorry, I'm experiencing some technical difficulties right now. Your mental wellness is important to me, so please try again in a moment. If you're in crisis, please contact emergency services or a crisis helpline immediately." 
                }] 
            };
            setMessages(prev => [...prev, errorResponse]);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSaveMood = (mood: Mood, note?: string) => {
      const newLog: MoodLog = { mood, note, timestamp: new Date() };
      setMoodLogs(prev => [...prev, newLog]);
      setShowMoodModal(false);
    };

    const handleClearChat = () => {
        if (window.confirm('Are you sure you want to start a new conversation? This will clear your chat history and start fresh.')) {
            const welcomeMessage: Message = { 
                role: 'model', 
                parts: [{ text: "Hello! I'm Aura, your AI wellness companion designed especially for you. I'm here to provide mental health support using evidence-based techniques. How are you feeling today?" }] 
            };
            setMessages([welcomeMessage]);
            setSessionId(null); // Clear session to start fresh
            localStorage.removeItem('currentSessionId'); // Clear from storage
            clearChatHistory();
        }
    };

    const handleVoiceTranscript = (transcript: string) => {
        setInputValue(transcript);
    };

    const handleVoiceToggle = (enabled: boolean) => {
        updatePreferences({ voiceEnabled: enabled });
    };

    const handleSpeakResponse = (text: string) => {
        if (preferences.voiceEnabled) {
            voiceService.speak(text);
        }
    };

    return (
        <div className="relative flex flex-col h-screen max-w-4xl mx-auto overflow-hidden">
            {/* 3D Grid Background */}
            <div className="grid-3d-background">
                <div className="grid-3d-container">
                    <div className="grid-3d-lines"></div>
                    <div className="grid-3d-dots"></div>
                </div>
                <div className="grid-particles">
                    <div className="particle"></div>
                    <div className="particle"></div>
                    <div className="particle"></div>
                    <div className="particle"></div>
                    <div className="particle"></div>
                    <div className="particle"></div>
                    <div className="particle"></div>
                    <div className="particle"></div>
                    <div className="particle"></div>
                </div>
            </div>
            
            {/* Main Chat Container */}
            <div className="chat-container-3d flex flex-col h-full rounded-lg overflow-hidden transition-all duration-300 animate-scale-in">
                {showMoodModal && <MoodCheckIn onClose={() => setShowMoodModal(false)} onSaveMood={handleSaveMood} />}
                {showAnalytics && <MoodAnalytics moodLogs={moodLogs} onClose={() => setShowAnalytics(false)} />}
                {showResources && <WellnessResources onClose={() => setShowResources(false)} />}
                {showGoalsReminders && <GoalsAndReminders onClose={() => setShowGoalsReminders(false)} />}
            <header className="glass-header flex items-center justify-between p-4 transition-all duration-300">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-purple-700 dark:text-purple-400 animate-pulse-subtle">AI Wellness Companion</h1>
                    <button 
                        onClick={handleClearChat}
                        className="glass-button text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all duration-200 px-3 py-1 rounded-full button-press hover-lift"
                        title="Clear chat history"
                    >
                        Clear Chat
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            console.log('ChatScreen theme toggle clicked!');
                            toggleTheme();
                        }}
                        className="glass-button p-2 rounded-full hover:bg-gray-200/50 dark:hover:bg-gray-600/50 transition-all duration-200 button-press hover-lift"
                        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                    >
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>
                    <button 
                        onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                        className={`glass-button p-2 rounded-full transition-all duration-200 button-press hover-lift ${
                            preferences.voiceEnabled 
                                ? 'bg-green-100/70 dark:bg-green-900/70 text-green-700 dark:text-green-300 animate-pulse-subtle' 
                                : 'hover:bg-gray-200/50 dark:hover:bg-gray-600/50'
                        }`}
                        title="Voice settings"
                    >
                        🎤
                    </button>
                    <button 
                        onClick={() => setShowGoalsReminders(true)}
                        className="glass-button flex items-center gap-2 bg-yellow-100/70 dark:bg-yellow-900/70 text-yellow-700 dark:text-yellow-300 font-semibold py-2 px-4 rounded-full hover:bg-yellow-200/70 dark:hover:bg-yellow-800/70 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 button-press hover-lift"
                        title="Goals and reminders"
                    >
                        🎯 Goals
                    </button>
                    <button 
                        onClick={() => setShowResources(true)}
                        className="glass-button flex items-center gap-2 bg-green-100/70 dark:bg-green-900/70 text-green-700 dark:text-green-300 font-semibold py-2 px-4 rounded-full hover:bg-green-200/70 dark:hover:bg-green-800/70 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-400 button-press hover-lift"
                        title="Wellness resources"
                    >
                        🧘 Resources
                    </button>
                    <button 
                        onClick={() => setShowAnalytics(true)}
                        className="glass-button flex items-center gap-2 bg-blue-100/70 dark:bg-blue-900/70 text-blue-700 dark:text-blue-300 font-semibold py-2 px-4 rounded-full hover:bg-blue-200/70 dark:hover:bg-blue-800/70 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 button-press hover-lift"
                        title="View mood analytics"
                    >
                        📊 Analytics
                    </button>
                    <button 
                      onClick={() => setShowMoodModal(true)}
                      className="glass-button flex items-center gap-2 bg-purple-100/70 dark:bg-purple-900/70 text-purple-700 dark:text-purple-300 font-semibold py-2 px-4 rounded-full hover:bg-purple-200/70 dark:hover:bg-purple-800/70 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-400 button-press hover-lift animate-bounce-gentle"
                    >
                      <FaceSmileIcon className="w-5 h-5"/>
                      <span>How are you?</span>
                    </button>
                </div>
            </header>

            {/* Voice Settings Panel */}
            {showVoiceSettings && (
                <div className="glass-header border-b-0 p-4">
                    <VoiceControls
                        onTranscript={handleVoiceTranscript}
                        onSpeakResponse={handleSpeakResponse}
                        isEnabled={preferences.voiceEnabled}
                        onToggle={handleVoiceToggle}
                    />
                    
                    {/* Auto-speak setting */}
                    {preferences.voiceEnabled && (
                        <div className="mt-3 flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Auto-speak AI responses
                            </span>
                            <button
                                onClick={() => updatePreferences({ voiceAutoSpeak: !preferences.voiceAutoSpeak })}
                                className={`glass-button relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400 ${
                                    preferences.voiceAutoSpeak ? 'bg-purple-600/80' : 'bg-gray-300/80 dark:bg-gray-600/80'
                                }`}
                            >
                                <div
                                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${
                                        preferences.voiceAutoSpeak ? 'transform translate-x-6' : ''
                                    }`}
                                />
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {messages.map((msg, index) =>
                    msg.role === 'model' ? (
                        <AIMessageBubble key={index} text={msg.parts[0].text} />
                    ) : (
                        <UserMessageBubble key={index} text={msg.parts[0].text} />
                    )
                )}
                {isLoading && <LoadingBubble />}
                <div ref={messagesEndRef} />
            </div>

            <footer className="glass-footer p-4 transition-all duration-300">
                {error && (
                    <div className="mb-2 p-3 bg-red-50/80 dark:bg-red-900/50 border border-red-200/50 dark:border-red-800/50 rounded-lg animate-scale-in backdrop-blur-sm">
                        <p className="text-red-500 dark:text-red-400 text-sm text-center">{error}</p>
                    </div>
                )}
                <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type your message here..."
                        className="glass-input flex-1 p-3 rounded-full text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none transition-all duration-200 hover-lift"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !inputValue.trim()}
                        className="glass-button bg-purple-600/90 text-white p-3 rounded-full hover:bg-purple-700/90 disabled:bg-purple-300/70 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-purple-300/50 transition-all duration-300 transform hover:scale-110 button-press hover-lift"
                    >
                        <SendIcon className="w-6 h-6"/>
                    </button>
                </form>
            </footer>
            </div>
            
            {/* Crisis Alert Modal */}
            {showCrisisAlert && (
                <CrisisAlert 
                    level={crisisLevel}
                    onClose={() => setShowCrisisAlert(false)}
                    onContactCrisisLine={() => {
                        // Try to open phone dialer first, fallback to tel link
                        if (navigator.userAgent.includes('Mobile')) {
                            window.location.href = 'tel:988';
                        } else {
                            window.open('tel:988', '_blank');
                        }
                    }}
                    onContactEmergency={() => {
                        // Emergency contact
                        if (navigator.userAgent.includes('Mobile')) {
                            window.location.href = 'tel:911';
                        } else {
                            window.open('tel:911', '_blank');
                        }
                    }}
                />
            )}
        </div>
    );
};

export default ChatScreen;
