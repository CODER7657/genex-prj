import React, { useState, useEffect } from 'react';
import { voiceService } from '../services/voiceService';
import { useTheme } from '../contexts/ThemeContext';

interface VoiceControlsProps {
  onTranscript: (text: string) => void;
  onSpeakResponse: (text: string) => void;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const VoiceControls: React.FC<VoiceControlsProps> = ({
  onTranscript,
  onSpeakResponse,
  isEnabled,
  onToggle
}) => {
  const { preferences } = useTheme();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [transcript, setTranscript] = useState('');

  useEffect(() => {
    // Check for browser support and permissions on component mount
    if (voiceService.isSpeechRecognitionSupported()) {
      checkMicrophonePermission();
    }
  }, []);

  const checkMicrophonePermission = async () => {
    const permission = await voiceService.requestMicrophonePermission();
    setHasPermission(permission);
    if (!permission) {
      setError('Microphone access required for voice features');
    }
  };

  const startListening = () => {
    if (!hasPermission) {
      checkMicrophonePermission();
      return;
    }

    setError(null);
    setTranscript('');
    setIsListening(true);

    const success = voiceService.startListening(
      (text, isFinal) => {
        setTranscript(text);
        if (isFinal) {
          setIsListening(false);
          onTranscript(text);
          setTranscript('');
        }
      },
      (errorMsg) => {
        setError(errorMsg);
        setIsListening(false);
      },
      {
        continuous: false,
        interimResults: true,
        language: 'en-US'
      }
    );

    if (!success) {
      setIsListening(false);
    }
  };

  const stopListening = () => {
    voiceService.stopListening();
    setIsListening(false);
  };

  const speakText = (text: string) => {
    if (!voiceService.isSpeechSynthesisSupported()) {
      setError('Text-to-speech not supported in this browser');
      return;
    }

    setIsSpeaking(true);
    setError(null);

    voiceService.speak(text, {
      rate: 0.9,
      pitch: 1,
      volume: 0.8,
      onEnd: () => {
        setIsSpeaking(false);
      },
      onError: (errorMsg) => {
        setError(errorMsg);
        setIsSpeaking(false);
      }
    });
  };

  const stopSpeaking = () => {
    voiceService.stopSpeaking();
    setIsSpeaking(false);
  };

  const toggleVoiceFeatures = () => {
    const newState = !isEnabled;
    onToggle(newState);
    
    if (!newState) {
      stopListening();
      stopSpeaking();
    }
  };

  // Auto-speak AI responses when voice is enabled
  useEffect(() => {
    if (preferences.voiceEnabled && isEnabled) {
      // This will be called from parent component
    }
  }, [preferences.voiceEnabled, isEnabled]);

  if (!voiceService.isSpeechRecognitionSupported() && !voiceService.isSpeechSynthesisSupported()) {
    return null; // Don't render if no voice features are supported
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Voice Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Voice Features
        </span>
        <button
          onClick={toggleVoiceFeatures}
          className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400 ${
            isEnabled ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <div
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${
              isEnabled ? 'transform translate-x-6' : ''
            }`}
          />
        </button>
      </div>

      {/* Voice Controls */}
      {isEnabled && (
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          {/* Speech-to-Text */}
          {voiceService.isSpeechRecognitionSupported() && (
            <div className="flex flex-col items-center">
              <button
                onClick={isListening ? stopListening : startListening}
                disabled={!hasPermission}
                className={`p-3 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400 ${
                  isListening
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                    : 'bg-purple-100 dark:bg-purple-900 hover:bg-purple-200 dark:hover:bg-purple-800 text-purple-700 dark:text-purple-300'
                } ${!hasPermission ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isListening ? 'Stop listening' : 'Start voice input'}
              >
                {isListening ? '🔴' : '🎤'}
              </button>
              <span className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {isListening ? 'Listening...' : 'Voice Input'}
              </span>
            </div>
          )}

          {/* Text-to-Speech */}
          {voiceService.isSpeechSynthesisSupported() && (
            <div className="flex flex-col items-center">
              <button
                onClick={isSpeaking ? stopSpeaking : () => speakText('Voice output is ready')}
                className={`p-3 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                  isSpeaking
                    ? 'bg-blue-500 hover:bg-blue-600 text-white animate-pulse'
                    : 'bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300'
                }`}
                title={isSpeaking ? 'Stop speaking' : 'Test voice output'}
              >
                {isSpeaking ? '🔊' : '🔊'}
              </button>
              <span className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {isSpeaking ? 'Speaking...' : 'Voice Output'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Live Transcript */}
      {isListening && transcript && (
        <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded border-l-4 border-purple-500">
          <span className="text-sm text-purple-700 dark:text-purple-300">
            "{transcript}"
          </span>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded border-l-4 border-red-500">
          <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
        </div>
      )}

      {/* Browser Support Info */}
      {!hasPermission && isEnabled && (
        <div className="p-2 bg-yellow-50 dark:bg-yellow-900/30 rounded border-l-4 border-yellow-500">
          <span className="text-sm text-yellow-700 dark:text-yellow-300">
            Please allow microphone access for voice input features.
          </span>
        </div>
      )}
    </div>
  );
};

export default VoiceControls;