
import React, { useState, useRef, useEffect } from 'react';
import { EmergencyResources, Message, Mood, MoodLog } from '../types';
import { apiService } from '../services/apiService';
import { saveMoodLogs, loadMoodLogs, saveChatHistory, loadChatHistory, clearChatHistory } from '../services/storageService';
import { voiceService } from '../services/voiceService';
import { usePreferences } from '../contexts/PreferencesContext';
import MoodCheckIn from './MoodCheckIn';
import MoodAnalytics from './MoodAnalytics';
import WellnessResources from './WellnessResources';
import VoiceControls from './VoiceControls';
import GoalsAndReminders from './GoalsAndReminders';
import CrisisAlert from './CrisisAlert';
import { BarChart3, HeartPulse, Mic, RotateCcw, SendHorizontal, Smile, Sprout, Target } from 'lucide-react';
import { ClaySwitch } from './clay';

// Define components outside to prevent re-creation on re-renders
const AIMessageBubble: React.FC<{ text: string }> = ({ text }) => (
    <div className="flex justify-start">
        <div className="clay-card max-w-[85%] rounded-bl-md px-5 py-3.5 sm:max-w-lg">
            <p className="text-base text-ink">{text}</p>
        </div>
    </div>
);

const UserMessageBubble: React.FC<{ text: string }> = ({ text }) => (
    <div className="flex justify-end">
        <div className="clay-card max-w-[85%] rounded-br-md bg-sand px-5 py-3.5 sm:max-w-lg">
            <p className="text-base text-ink">{text}</p>
        </div>
    </div>
);

const LoadingBubble: React.FC = () => (
    <div className="flex justify-start" role="status">
        <div className="clay-card rounded-bl-md px-5 py-4">
            <span className="sr-only">Aura is replying</span>
            <div className="flex items-center gap-1.5" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-leaf" />
                <span className="h-2.5 w-2.5 rounded-full bg-sand" />
                <span className="h-2.5 w-2.5 rounded-full bg-coral" />
            </div>
        </div>
    </div>
);

const ChatScreen: React.FC = () => {
    const { preferences, updatePreferences } = usePreferences();
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
    const [crisisResources, setCrisisResources] = useState<EmergencyResources | null>(null);
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
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        messagesEndRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
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
                setCrisisResources(response.data.aiResponse.emergencyResources ?? null);
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
        <div className="relative mx-auto flex h-[100dvh] max-w-4xl flex-col">
            {/* Main Chat Container */}
            <div className="clay-surface flex h-full min-h-0 flex-col gap-3 p-3 sm:gap-4 sm:p-5">
                {showMoodModal && <MoodCheckIn onClose={() => setShowMoodModal(false)} onSaveMood={handleSaveMood} />}
                {showAnalytics && <MoodAnalytics moodLogs={moodLogs} onClose={() => setShowAnalytics(false)} />}
                {showResources && <WellnessResources onClose={() => setShowResources(false)} />}
                {showGoalsReminders && <GoalsAndReminders onClose={() => setShowGoalsReminders(false)} />}
            <header className="clay-card flex flex-col gap-3 p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-coral shadow-clay-sm" aria-hidden="true">
                            <HeartPulse className="h-6 w-6" strokeWidth={2.25} />
                        </span>
                        <h1 className="text-xl font-extrabold leading-tight text-ink">AI Wellness Companion</h1>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                            className={`clay-btn clay-btn-icon ${preferences.voiceEnabled ? 'clay-leaf' : ''}`}
                            aria-pressed={showVoiceSettings}
                            aria-label="Voice settings"
                            title="Voice settings"
                        >
                            <Mic className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            onClick={handleClearChat}
                            className="clay-btn clay-btn-icon sm:w-auto sm:px-4"
                            aria-label="Clear Chat"
                            title="Clear chat history"
                        >
                            <RotateCcw className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
                            <span className="hidden text-sm sm:inline">Clear Chat</span>
                        </button>
                    </div>
                </div>
                <nav className="flex items-center gap-2 sm:gap-3" aria-label="Wellness tools">
                    <button
                        type="button"
                        onClick={() => setShowMoodModal(true)}
                        className="clay-btn clay-coral flex-1 px-4 font-extrabold sm:flex-none sm:px-6"
                    >
                        <Smile className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
                        <span>How are you?</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowGoalsReminders(true)}
                        className="clay-btn clay-btn-icon clay-sand md:w-auto md:px-4"
                        aria-label="Goals"
                        title="Goals and reminders"
                    >
                        <Target className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
                        <span className="hidden md:inline">Goals</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowResources(true)}
                        className="clay-btn clay-btn-icon clay-mint md:w-auto md:px-4"
                        aria-label="Resources"
                        title="Wellness resources"
                    >
                        <Sprout className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
                        <span className="hidden md:inline">Resources</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowAnalytics(true)}
                        className="clay-btn clay-btn-icon clay-mint md:w-auto md:px-4"
                        aria-label="Analytics"
                        title="View mood analytics"
                    >
                        <BarChart3 className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
                        <span className="hidden md:inline">Analytics</span>
                    </button>
                </nav>

            {/* Voice Settings Panel */}
            {showVoiceSettings && (
                <div className="clay-well p-4">
                    <VoiceControls
                        onTranscript={handleVoiceTranscript}
                        onSpeakResponse={handleSpeakResponse}
                        isEnabled={preferences.voiceEnabled}
                        onToggle={handleVoiceToggle}
                    />

                    {/* Auto-speak setting */}
                    {preferences.voiceEnabled && (
                        <div className="mt-3 flex items-center justify-between gap-4">
                            <span className="text-sm font-bold text-ink">
                                Auto-speak AI responses
                            </span>
                            <ClaySwitch
                                checked={preferences.voiceAutoSpeak}
                                onChange={() => updatePreferences({ voiceAutoSpeak: !preferences.voiceAutoSpeak })}
                                label="Auto-speak AI responses"
                            />
                        </div>
                    )}
                </div>
            )}
            </header>

            <div className="clay-scroll -mx-3 min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-2 sm:-mx-5 sm:px-5" aria-live="polite">
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

            <footer className="clay-card p-3 sm:p-4">
                {error && (
                    <div className="mb-3 flex items-start gap-3 rounded-clay bg-sand px-4 py-3" role="alert">
                        <span className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-clay" aria-hidden="true" />
                        <p className="text-sm font-bold text-ink">{error}</p>
                    </div>
                )}
                <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type your message here..."
                        aria-label="Message"
                        className="clay-input min-h-[3.25rem] flex-1 rounded-full px-5 text-base"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !inputValue.trim()}
                        className="clay-btn clay-coral h-[3.25rem] w-[3.25rem] flex-shrink-0 p-0"
                        aria-label="Send message"
                    >
                        <SendHorizontal className="h-6 w-6" strokeWidth={2.25} aria-hidden="true" />
                    </button>
                </form>
            </footer>
            </div>

            {/* Crisis Alert Modal */}
            {showCrisisAlert && (
                <CrisisAlert resources={crisisResources} onClose={() => setShowCrisisAlert(false)} />
            )}
        </div>
    );
};

export default ChatScreen;
