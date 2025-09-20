import { Message, MoodLog } from '../types';

const STORAGE_KEYS = {
  MOOD_LOGS: 'wellness-companion-mood-logs',
  CHAT_HISTORY: 'wellness-companion-chat-history',
  USER_PREFERENCES: 'wellness-companion-preferences'
} as const;

export interface UserPreferences {
  theme: 'light' | 'dark';
  voiceEnabled: boolean;
  voiceAutoSpeak: boolean;
  reminderEnabled: boolean;
  reminderTime?: string;
}

// Mood Logs Storage
export const saveMoodLogs = (moodLogs: MoodLog[]): void => {
  try {
    const serializedLogs = JSON.stringify(moodLogs.map(log => ({
      ...log,
      timestamp: log.timestamp.toISOString()
    })));
    localStorage.setItem(STORAGE_KEYS.MOOD_LOGS, serializedLogs);
  } catch (error) {
    console.error('Error saving mood logs:', error);
  }
};

export const loadMoodLogs = (): MoodLog[] => {
  try {
    const serializedLogs = localStorage.getItem(STORAGE_KEYS.MOOD_LOGS);
    if (!serializedLogs) return [];
    
    const parsedLogs = JSON.parse(serializedLogs);
    return parsedLogs.map((log: any) => ({
      ...log,
      timestamp: new Date(log.timestamp)
    }));
  } catch (error) {
    console.error('Error loading mood logs:', error);
    return [];
  }
};

// Chat History Storage
export const saveChatHistory = (messages: Message[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(messages));
  } catch (error) {
    console.error('Error saving chat history:', error);
  }
};

export const loadChatHistory = (): Message[] => {
  try {
    const serializedHistory = localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
    if (!serializedHistory) return [];
    
    return JSON.parse(serializedHistory);
  } catch (error) {
    console.error('Error loading chat history:', error);
    return [];
  }
};

export const clearChatHistory = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.CHAT_HISTORY);
  } catch (error) {
    console.error('Error clearing chat history:', error);
  }
};

// User Preferences Storage
export const saveUserPreferences = (preferences: UserPreferences): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(preferences));
  } catch (error) {
    console.error('Error saving user preferences:', error);
  }
};

export const loadUserPreferences = (): UserPreferences => {
  try {
    const serializedPrefs = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
    if (!serializedPrefs) {
      // Return default preferences
      return {
        theme: 'light',
        voiceEnabled: false,
        voiceAutoSpeak: false,
        reminderEnabled: false
      };
    }
    
    return JSON.parse(serializedPrefs);
  } catch (error) {
    console.error('Error loading user preferences:', error);
    return {
      theme: 'light',
      voiceEnabled: false,
      voiceAutoSpeak: false,
      reminderEnabled: false
    };
  }
};

// Utility functions
export const exportUserData = () => {
  const moodLogs = loadMoodLogs();
  const chatHistory = loadChatHistory();
  const preferences = loadUserPreferences();
  
  return {
    moodLogs,
    chatHistory,
    preferences,
    exportDate: new Date().toISOString()
  };
};

export const clearAllData = (): void => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('Error clearing all data:', error);
  }
};