import React, { createContext, useContext, useEffect, useState } from 'react';
import { loadUserPreferences, saveUserPreferences, UserPreferences } from '../services/storageService';

interface ThemeContextType {
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    preferences: UserPreferences;
    updatePreferences: (preferences: Partial<UserPreferences>) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

interface ThemeProviderProps {
    children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [preferences, setPreferences] = useState<UserPreferences>(() => loadUserPreferences());

    useEffect(() => {
        // Apply theme to document
        const root = document.documentElement;
        if (preferences.theme === 'dark') {
            root.classList.add('dark');
            console.log('Dark mode applied');
        } else {
            root.classList.remove('dark');
            console.log('Light mode applied');
        }
        
        // Save preferences
        saveUserPreferences(preferences);
    }, [preferences]);

    const toggleTheme = () => {
        console.log('Toggle theme called, current theme:', preferences.theme);
        setPreferences(prev => ({
            ...prev,
            theme: prev.theme === 'light' ? 'dark' : 'light'
        }));
    };

    const updatePreferences = (newPreferences: Partial<UserPreferences>) => {
        setPreferences(prev => ({
            ...prev,
            ...newPreferences
        }));
    };

    return (
        <ThemeContext.Provider value={{
            theme: preferences.theme,
            toggleTheme,
            preferences,
            updatePreferences
        }}>
            {children}
        </ThemeContext.Provider>
    );
};