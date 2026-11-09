import React, { createContext, useContext, useEffect, useState } from 'react';
import { loadUserPreferences, saveUserPreferences, UserPreferences } from '../services/storageService';

/**
 * User preferences (voice and the like), persisted to localStorage. This replaced
 * ThemeContext when dark mode was removed: the Clay design is light only.
 */
interface PreferencesContextType {
    preferences: UserPreferences;
    updatePreferences: (preferences: Partial<UserPreferences>) => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export const usePreferences = () => {
    const context = useContext(PreferencesContext);
    if (!context) {
        throw new Error('usePreferences must be used within a PreferencesProvider');
    }
    return context;
};

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [preferences, setPreferences] = useState<UserPreferences>(() => loadUserPreferences());

    useEffect(() => {
        saveUserPreferences(preferences);
    }, [preferences]);

    const updatePreferences = (newPreferences: Partial<UserPreferences>) => {
        setPreferences(prev => ({ ...prev, ...newPreferences }));
    };

    return (
        <PreferencesContext.Provider value={{ preferences, updatePreferences }}>
            {children}
        </PreferencesContext.Provider>
    );
};
