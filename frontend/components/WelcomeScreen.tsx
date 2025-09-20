
import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { HeartPulseIcon } from './icons';

interface WelcomeScreenProps {
    onStartChat: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStartChat }) => {
    const { theme, toggleTheme } = useTheme();

    const handleToggleTheme = () => {
        console.log('Theme toggle button clicked!');
        toggleTheme();
    };

    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-fade-in-up">
            <div className="absolute top-8 right-8 animate-scale-in">
                <button
                    onClick={handleToggleTheme}
                    className="p-3 rounded-full bg-white/60 dark:bg-gray-800/60 backdrop-blur-md hover:bg-white/80 dark:hover:bg-gray-700/80 transition-all duration-300 shadow-lg hover-lift button-press"
                    title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                >
                    {theme === 'light' ? '🌙' : '☀️'}
                </button>
            </div>
            
            <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md p-10 rounded-3xl shadow-lg hover-lift animate-scale-in">
                <HeartPulseIcon className="w-24 h-24 text-purple-500 dark:text-purple-400 mx-auto mb-6 animate-bounce-gentle" />
                <h1 className="text-4xl md:text-5xl font-bold text-gray-800 dark:text-gray-200 mb-3 animate-slide-in-right">
                    Welcome to Your AI Wellness Companion
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8 animate-slide-in-right [animation-delay:0.2s]">
                    A safe and supportive space to explore your thoughts and feelings. I'm here to listen, without judgment.
                </p>
                <button
                    onClick={onStartChat}
                    className="bg-purple-600 text-white font-bold py-3 px-8 rounded-full text-lg hover:bg-purple-700 focus:outline-none focus:ring-4 focus:ring-purple-300 transition-all duration-300 ease-in-out shadow-md hover-lift button-press animate-pulse-subtle gradient-shimmer overflow-hidden relative"
                >
                    <span className="relative z-10">Start a Conversation</span>
                </button>
            </div>
        </div>
    );
};

export default WelcomeScreen;
