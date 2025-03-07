/**
 * WebSpeechService.ts
 * A service for speech-to-text processing using the Web Speech API
 */

// Define types for the service
export interface WebSpeechServiceOptions {
  onTranscriptUpdate: (text: string) => void;
  onTranscriptionStart?: () => void;
  continuous?: boolean;
  interimResults?: boolean;
  language?: string;
}

export interface WebSpeechServiceInstance {
  start: () => Promise<void>;
  stop: () => void;
  isListening: () => boolean;
}

/**
 * Creates a Web Speech API service
 */
export const createWebSpeechService = (options: WebSpeechServiceOptions): WebSpeechServiceInstance => {
  // Default options
  const {
    onTranscriptUpdate,
    onTranscriptionStart,
    continuous = true,
    interimResults = true,
    language = 'en-US',
  } = options;

  // Service state
  let recognition: any = null;
  let listening = false;
  
  // Transcript history
  let fullTranscript = '';

  /**
   * Initialize the Web Speech API
   */
  const initialize = (): void => {
    if (typeof window === 'undefined') {
      throw new Error('Web Speech API is only available in browser environments');
    }
    
    // Check if Web Speech API is supported
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      throw new Error('Web Speech API is not supported in this browser');
    }
    
    // Create recognition instance
    // @ts-ignore - SpeechRecognition is not in the types
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    
    // Configure recognition
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;
    
    // Set up event handlers
    recognition.onstart = () => {
      console.log('Web Speech recognition started');
      listening = true;
    };
    
    recognition.onend = () => {
      console.log('Web Speech recognition ended');
      listening = false;
    };
    
    recognition.onerror = (event: any) => {
      console.error('Web Speech recognition error:', event.error);
      listening = false;
    };
    
    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      // If we have a final transcript, add it to the full transcript
      if (finalTranscript) {
        fullTranscript += ' ' + finalTranscript;
        onTranscriptUpdate(fullTranscript.trim());
      } else if (interimTranscript) {
        // For interim results, send the combined transcript
        onTranscriptUpdate((fullTranscript + ' ' + interimTranscript).trim());
      }
    };
  };

  /**
   * Start the speech recognition service
   */
  const start = async (): Promise<void> => {
    if (listening) return;
    
    try {
      // Initialize if not already initialized
      if (!recognition) {
        initialize();
      }
      
      // Notify that transcription is starting
      if (onTranscriptionStart) {
        onTranscriptionStart();
      }
      
      // Start recognition
      recognition.start();
      
      // Wait for recognition to start
      await new Promise<void>((resolve, reject) => {
        const onStart = () => {
          recognition.removeEventListener('start', onStart);
          resolve();
        };
        
        const onError = (event: any) => {
          recognition.removeEventListener('error', onError);
          reject(new Error(`Web Speech recognition failed to start: ${event.error}`));
        };
        
        recognition.addEventListener('start', onStart);
        recognition.addEventListener('error', onError);
      });
    } catch (error) {
      console.error('Error starting Web Speech recognition:', error);
      throw error;
    }
  };

  /**
   * Stop the speech recognition service
   */
  const stop = (): void => {
    if (!listening || !recognition) return;
    
    try {
      // Stop recognition
      recognition.stop();
      
      console.log('Web Speech service stopped');
    } catch (error) {
      console.error('Error stopping Web Speech service:', error);
    }
  };

  /**
   * Check if the service is currently listening
   */
  const isListening = (): boolean => {
    return listening;
  };

  // Return the service instance
  return {
    start,
    stop,
    isListening,
  };
};

export default createWebSpeechService; 