/**
 * SpeechRecognitionService.ts
 * A factory service that provides a unified interface for all speech recognition services
 */

import createWebSpeechService, { WebSpeechServiceInstance } from './WebSpeechService';
import createRealtimeService, { RealtimeServiceInstance } from './RealtimeService';
import createAssemblyAIService, { AssemblyAIServiceInstance } from './AssemblyAIService';
import createWhisperService, { WhisperServiceInstance } from './WhisperService';
import createAssemblyAINanoService, { AssemblyAINanoServiceInstance } from './AssemblyAINanoService';
import createGoogleSpeechService, { GoogleSpeechServiceInstance } from './GoogleSpeechService';

// Define the STT API types
export type STTApi = 'webSpeech' | 'realtime' | 'assemblyAI' | 'whisper' | 'assemblyAINano' | 'googleSpeech';

// Define the service options
export interface SpeechRecognitionServiceOptions {
  onTranscriptUpdate: (transcript: string) => void;
  onDurationUpdate?: (durationMs: number) => void;
  onTranscriptionStart?: () => void;
  apiKey?: string;
  sampleRate?: number;
  bufferSize?: number;
  language?: string;
  wordBoost?: string[];
  debug?: boolean;
}

// Define the service instance
export interface SpeechRecognitionServiceInstance {
  start: () => Promise<void>;
  stop: () => void;
  isListening: () => boolean;
  getApi: () => STTApi;
  changeApi: (api: STTApi) => void;
  getDuration: () => number;
  updateLanguage: (language: string) => void;
  forceFinalize: () => void;
}

/**
 * Creates a speech recognition service factory
 */
export const createSpeechRecognitionService = (
  options: SpeechRecognitionServiceOptions
): SpeechRecognitionServiceInstance => {
  // Default options
  const {
    onTranscriptUpdate,
    onDurationUpdate,
    onTranscriptionStart,
    apiKey = typeof window !== 'undefined' ? 
      (window as any).__NEXT_DATA__?.props?.pageProps?.assemblyAIApiKey || 
      process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY || 
      '' : '',
    sampleRate = 16000,
    bufferSize = 4096,
    language = 'en-US',
    wordBoost = [],
    debug = true,
  } = options;

  // Service state
  let currentApi: STTApi = 'webSpeech';
  let currentService: WebSpeechServiceInstance | RealtimeServiceInstance | AssemblyAIServiceInstance | WhisperServiceInstance | AssemblyAINanoServiceInstance | GoogleSpeechServiceInstance | null = null;
  
  // Duration tracking
  let startTime: number | null = null;
  let endTime: number | null = null;
  let durationMs: number = 0;
  let durationInterval: NodeJS.Timeout | null = null;
  
  // Log API key status (without revealing the key)
  console.log(`AssemblyAI API key ${apiKey ? 'is' : 'is not'} available`);
  
  /**
   * Create a service instance based on the selected API
   */
  const createService = (api: STTApi) => {
    switch (api) {
      case 'webSpeech':
        return createWebSpeechService({
          onTranscriptUpdate,
          language,
        });
      case 'realtime':
        return createRealtimeService({
          onTranscriptUpdate,
          sampleRate,
          bufferSize,
        });
      case 'assemblyAI':
        if (!apiKey) {
          console.warn('AssemblyAI API key is not available. Some features may not work properly.');
        }
        
        return createAssemblyAIService({
          onTranscriptUpdate,
          apiKey,
          sampleRate,
          bufferSize,
          wordBoost,
        });
      case 'whisper':
        return createWhisperService({
          onTranscriptUpdate,
          onTranscriptionStart,
          apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
          language: language.split('-')[0], // Convert 'en-US' to 'en'
          sampleRate,
          bufferSize,
          debug,
        });
      case 'assemblyAINano':
        return createAssemblyAINanoService({
          onTranscriptUpdate,
          onTranscriptionStart,
          language: language.split('-')[0], // Convert 'en-US' to 'en'
          sampleRate,
          bufferSize,
          debug,
        });
      case 'googleSpeech':
        return createGoogleSpeechService({
          onTranscriptUpdate,
          language,
          sampleRate,
          bufferSize,
        });
      default:
        throw new Error(`Unsupported API: ${api}`);
    }
  };

  /**
   * Start tracking speech duration
   */
  const startDurationTracking = (): void => {
    startTime = Date.now();
    durationMs = 0;
    
    // Update duration every 100ms
    if (durationInterval) {
      clearInterval(durationInterval);
    }
    
    durationInterval = setInterval(() => {
      if (startTime) {
        durationMs = Date.now() - startTime;
        if (onDurationUpdate) {
          onDurationUpdate(durationMs);
        }
      }
    }, 100);
  };

  /**
   * Stop tracking speech duration
   */
  const stopDurationTracking = (): void => {
    endTime = Date.now();
    
    if (startTime && endTime) {
      durationMs = endTime - startTime;
      if (onDurationUpdate) {
        onDurationUpdate(durationMs);
      }
    }
    
    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }
  };

  /**
   * Start the speech recognition service
   */
  const start = async (): Promise<void> => {
    // Create service if not already created
    if (!currentService) {
      currentService = createService(currentApi);
    }
    
    try {
      // Notify that transcription is starting
      if (onTranscriptionStart) {
        onTranscriptionStart();
      }
      
      // Start the service
      await currentService.start();
      
      // Start tracking duration
      startDurationTracking();
    } catch (error) {
      console.error(`Error starting ${currentApi} service:`, error);
      
      // If any service fails, try falling back to Web Speech API
      if (currentApi !== 'webSpeech') {
        console.log('Falling back to Web Speech API');
        currentApi = 'webSpeech';
        currentService = createService(currentApi);
        
        // Notify that transcription is starting again with fallback
        if (onTranscriptionStart) {
          onTranscriptionStart();
        }
        
        await currentService.start();
        
        // Start tracking duration
        startDurationTracking();
      } else {
        throw error;
      }
    }
  };

  /**
   * Stop the speech recognition service
   */
  const stop = (): void => {
    if (currentService) {
      currentService.stop();
      
      // Stop tracking duration
      stopDurationTracking();
    }
  };

  /**
   * Check if the service is currently listening
   */
  const isListening = (): boolean => {
    return currentService ? currentService.isListening() : false;
  };

  /**
   * Get the current API
   */
  const getApi = (): STTApi => {
    return currentApi;
  };

  /**
   * Change the API
   */
  const changeApi = (api: STTApi): void => {
    // Stop current service if it's listening
    if (currentService && currentService.isListening()) {
      currentService.stop();
      
      // Stop tracking duration
      stopDurationTracking();
    }
    
    // Update current API
    currentApi = api;
    
    // Create new service with the current API
    currentService = createService(currentApi);
    
    console.log(`Changed API to ${api} with language ${language}`);
  };

  /**
   * Get the current speech duration in milliseconds
   */
  const getDuration = (): number => {
    return durationMs;
  };

  /**
   * Update the language
   */
  const updateLanguage = (newLanguage: string): void => {
    // Update language
    options.language = newLanguage;
    
    console.log(`Updated language to: ${newLanguage}`);
    
    // If the service is listening, stop it
    if (currentService && currentService.isListening()) {
      currentService.stop();
      
      // Stop tracking duration
      stopDurationTracking();
    }
    
    // If the current service has an updateLanguage method, use it
    if (currentService && 'updateLanguage' in currentService) {
      (currentService as any).updateLanguage(newLanguage.split('-')[0]); // Convert 'en-US' to 'en'
    } else {
      // Otherwise, recreate the service with the new language
      currentService = createService(currentApi);
    }
    
    // Log the current API and language
    console.log(`Current API: ${currentApi}, Language: ${newLanguage}`);
  };

  /**
   * Force finalization of the current audio
   */
  const forceFinalize = (): void => {
    if (!currentService || !currentService.isListening()) {
      console.log('No active service to finalize');
      return;
    }
    
    console.log('Forcing finalization of current audio');
    
    // For now, the simplest way to force finalization is to stop and restart
    currentService.stop();
    
    // We don't automatically restart here, as the caller should handle that if needed
  };

  // Initialize the service
  currentService = createService(currentApi);

  // Return the service instance
  return {
    start,
    stop,
    isListening,
    getApi,
    changeApi,
    getDuration,
    updateLanguage,
    forceFinalize,
  };
};

export default createSpeechRecognitionService; 