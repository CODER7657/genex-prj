
import React, { useState } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import WelcomeScreen from './components/WelcomeScreen';
import ChatScreen from './components/ChatScreen';

const App: React.FC = () => {
    const [isChatting, setIsChatting] = useState(false);

    const handleStartChat = () => {
        setIsChatting(true);
    };

    return (
        <ThemeProvider>
            <main className="h-screen w-screen bg-gradient-to-br from-purple-100 via-purple-50 to-white dark:from-gray-900 dark:via-purple-900 dark:to-gray-800 font-sans text-gray-800 dark:text-gray-200 transition-colors duration-300">
                {isChatting ? (
                    <ChatScreen />
                ) : (
                    <WelcomeScreen onStartChat={handleStartChat} />
                )}
            </main>
        </ThemeProvider>
    );
};

export default App;
