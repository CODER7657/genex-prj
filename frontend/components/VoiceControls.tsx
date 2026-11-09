import React, { useState, useEffect } from 'react';
import { voiceService } from '../services/voiceService';
import { Mic, Square, Volume2 } from 'lucide-react';
import { usePreferences } from '../contexts/PreferencesContext';
import { ClaySwitch } from './clay';

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
  const { preferences } = usePreferences();
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
    <div className="flex flex-col gap-3">
      {/* Voice Toggle */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-bold text-ink">
          Voice Features
        </span>
        <ClaySwitch checked={isEnabled} onChange={toggleVoiceFeatures} label="Voice Features" />
      </div>

      {/* Voice Controls */}
      {isEnabled && (
        <div className="flex items-center gap-6 rounded-clay bg-mint p-3">
          {/* Speech-to-Text */}
          {voiceService.isSpeechRecognitionSupported() && (
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                disabled={!hasPermission}
                className={`clay-btn clay-btn-icon ${isListening ? 'clay-coral' : ''}`}
                aria-pressed={isListening}
                aria-label={isListening ? 'Stop listening' : 'Start voice input'}
                title={isListening ? 'Stop listening' : 'Start voice input'}
              >
                {isListening
                  ? <Square className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
                  : <Mic className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />}
              </button>
              <span className="text-sm text-ink">
                {isListening ? 'Listening...' : 'Voice Input'}
              </span>
            </div>
          )}

          {/* Text-to-Speech */}
          {voiceService.isSpeechSynthesisSupported() && (
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={isSpeaking ? stopSpeaking : () => speakText('Voice output is ready')}
                className={`clay-btn clay-btn-icon ${isSpeaking ? 'clay-coral' : ''}`}
                aria-pressed={isSpeaking}
                aria-label={isSpeaking ? 'Stop speaking' : 'Test voice output'}
                title={isSpeaking ? 'Stop speaking' : 'Test voice output'}
              >
                {isSpeaking
                  ? <Square className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
                  : <Volume2 className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />}
              </button>
              <span className="text-sm text-ink">
                {isSpeaking ? 'Speaking...' : 'Voice Output'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Live Transcript */}
      {isListening && transcript && (
        <div className="rounded-clay border-l-4 border-leaf bg-white p-3 shadow-well">
          <span className="text-sm text-ink">
            "{transcript}"
          </span>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="rounded-clay border-l-4 border-clay bg-sand p-3" role="alert">
          <span className="text-sm font-bold text-ink">{error}</span>
        </div>
      )}

      {/* Browser Support Info */}
      {!hasPermission && isEnabled && (
        <div className="rounded-clay border-l-4 border-coral bg-sand p-3">
          <span className="text-sm text-ink">
            Please allow microphone access for voice input features.
          </span>
        </div>
      )}
    </div>
  );
};

export default VoiceControls;