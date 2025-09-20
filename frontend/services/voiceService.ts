// Voice interaction service for speech-to-text and text-to-speech

export interface VoiceServiceConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
}

// Extended type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionInterface extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  serviceURI: string;
  grammars: any;
  
  start(): void;
  stop(): void;
  abort(): void;
  
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onspeechstart: ((event: Event) => void) | null;
  onspeechend: ((event: Event) => void) | null;
  onsoundstart: ((event: Event) => void) | null;
  onsoundend: ((event: Event) => void) | null;
  onaudiostart: ((event: Event) => void) | null;
  onaudioend: ((event: Event) => void) | null;
  onnomatch: ((event: SpeechRecognitionEvent) => void) | null;
}

export class VoiceService {
  private recognition: SpeechRecognitionInterface | null = null;
  private synthesis: SpeechSynthesis;
  private isSupported: boolean;

  constructor() {
    // Check for browser support
    this.isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    this.synthesis = window.speechSynthesis;
    
    if (this.isSupported) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition() as SpeechRecognitionInterface;
    }
  }

  // Speech-to-Text functionality
  startListening(
    onResult: (transcript: string, isFinal: boolean) => void,
    onError: (error: string) => void,
    config: Partial<VoiceServiceConfig> = {}
  ): boolean {
    if (!this.recognition || !this.isSupported) {
      onError('Speech recognition is not supported in this browser');
      return false;
    }

    // Configure recognition
    this.recognition.continuous = config.continuous ?? false;
    this.recognition.interimResults = config.interimResults ?? true;
    this.recognition.lang = config.language ?? 'en-US';

    // Set up event handlers
    this.recognition.onresult = (event) => {
      let transcript = '';
      let isFinal = false;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          isFinal = true;
        }
      }

      onResult(transcript, isFinal);
    };

    this.recognition.onerror = (event) => {
      let errorMessage = 'Speech recognition error';
      
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'Microphone access denied or not available.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone permission denied.';
          break;
        case 'network':
          errorMessage = 'Network error during speech recognition.';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }
      
      onError(errorMessage);
    };

    this.recognition.onend = () => {
      // Recognition session ended
    };

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      onError('Failed to start speech recognition');
      return false;
    }
  }

  stopListening(): void {
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  // Text-to-Speech functionality
  speak(
    text: string,
    options: {
      voice?: SpeechSynthesisVoice;
      rate?: number;
      pitch?: number;
      volume?: number;
      onEnd?: () => void;
      onError?: (error: string) => void;
    } = {}
  ): boolean {
    if (!this.synthesis) {
      options.onError?.('Text-to-speech is not supported in this browser');
      return false;
    }

    // Stop any ongoing speech
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure utterance
    utterance.rate = options.rate ?? 0.9;
    utterance.pitch = options.pitch ?? 1;
    utterance.volume = options.volume ?? 0.8;
    
    if (options.voice) {
      utterance.voice = options.voice;
    }

    // Set up event handlers
    utterance.onend = () => {
      options.onEnd?.();
    };

    utterance.onerror = (event) => {
      options.onError?.(`Text-to-speech error: ${event.error}`);
    };

    try {
      this.synthesis.speak(utterance);
      return true;
    } catch (error) {
      options.onError?.('Failed to start text-to-speech');
      return false;
    }
  }

  stopSpeaking(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }

  // Get available voices
  getVoices(): SpeechSynthesisVoice[] {
    return this.synthesis ? this.synthesis.getVoices() : [];
  }

  // Check if voice features are supported
  isSpeechRecognitionSupported(): boolean {
    return this.isSupported;
  }

  isSpeechSynthesisSupported(): boolean {
    return !!this.synthesis;
  }

  // Request microphone permission
  async requestMicrophonePermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the stream
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      return false;
    }
  }
}

// Create singleton instance
export const voiceService = new VoiceService();

// Extend Window interface for TypeScript
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}