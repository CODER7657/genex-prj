import React, { useState } from 'react';
import { PreferencesProvider } from './contexts/PreferencesContext';
import WelcomeScreen from './components/WelcomeScreen';
import ChatScreen from './components/ChatScreen';

const App: React.FC = () => {
    const [isChatting, setIsChatting] = useState(false);

    const handleStartChat = () => {
        setIsChatting(true);
    };

    return (
        <PreferencesProvider>
            <main className="min-h-screen w-full bg-mint">
                {isChatting ? (
                    <ChatScreen />
                ) : (
                    <WelcomeScreen onStartChat={handleStartChat} />
                )}
            </main>
        </PreferencesProvider>
    );
};

export default App;
