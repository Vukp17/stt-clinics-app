/**
 * RealtimeService.ts
 * A service for real-time speech-to-text processing using Web Audio API
 */

// Define types for the service
export interface RealtimeServiceOptions {
  onTranscriptUpdate: (text: string) => void;
  sampleRate?: number;
  bufferSize?: number;
  noiseThreshold?: number;
  silenceThreshold?: number; // in milliseconds
}

export interface RealtimeServiceInstance {
  start: () => Promise<void>;
  stop: () => void;
  isListening: () => boolean;
}

// Speech detection state
interface SpeechState {
  isSpeaking: boolean;
  lastSpeechTime: number;
  currentSentence: string;
  silenceStart: number | null;
}

/**
 * Creates a Realtime speech-to-text service
 */
export const createRealtimeService = (options: RealtimeServiceOptions): RealtimeServiceInstance => {
  // Default options
  const {
    onTranscriptUpdate,
    sampleRate = 16000,
    bufferSize = 4096,
    noiseThreshold = 0.015,
    silenceThreshold = 1500, // 1.5 seconds of silence to end a sentence
  } = options;

  // Service state
  let audioContext: AudioContext | null = null;
  let mediaStream: MediaStream | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let listening = false;
  
  // Speech detection state
  const speechState: SpeechState = {
    isSpeaking: false,
    lastSpeechTime: 0,
    currentSentence: '',
    silenceStart: null,
  };

  // Transcript history
  let fullTranscript = '';

  /**
   * Process audio data to detect speech
   */
  const processAudioData = (inputData: Float32Array): void => {
    // Calculate audio energy (volume)
    let sum = 0;
    for (let i = 0; i < inputData.length; i++) {
      sum += Math.abs(inputData[i]);
    }
    const average = sum / inputData.length;
    const now = Date.now();

    // Detect if there's sound above the threshold
    if (average > noiseThreshold) {
      // Speech detected
      if (!speechState.isSpeaking) {
        console.log('Speech started');
        speechState.isSpeaking = true;
        speechState.silenceStart = null;
      }
      
      speechState.lastSpeechTime = now;
    } else if (speechState.isSpeaking) {
      // Potential silence after speech
      if (speechState.silenceStart === null) {
        speechState.silenceStart = now;
      } else if (now - speechState.silenceStart > silenceThreshold) {
        // Silence threshold reached, end the sentence
        finalizeSentence();
      }
    }
  };

  /**
   * Finalize the current sentence and add it to the transcript
   */
  const finalizeSentence = (): void => {
    if (speechState.isSpeaking) {
      // Generate a simple placeholder for detected speech
      const timestamp = new Date().toLocaleTimeString();
      const sentence = `[Speech detected at ${timestamp}] `;
      
      // In a real implementation, this would be replaced with actual speech recognition
      // For now, we're just simulating detection
      
      // Add to full transcript
      fullTranscript += sentence;
      
      // Update the transcript
      onTranscriptUpdate(fullTranscript);
      
      // Reset speech state
      speechState.isSpeaking = false;
      speechState.currentSentence = '';
      speechState.silenceStart = null;
      
      console.log('Speech ended, sentence finalized');
    }
  };

  /**
   * Start the speech recognition service
   */
  const start = async (): Promise<void> => {
    if (listening) return;
    
    try {
      // Get microphone access
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      // Create audio context
      audioContext = new AudioContext({ sampleRate });
      
      // Create source from microphone
      source = audioContext.createMediaStreamSource(mediaStream);
      
      // Create processor node
      processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      // Process audio data
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        processAudioData(inputData);
      };
      
      // Connect nodes
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      // Set listening state
      listening = true;
      
      console.log('Realtime service started');
    } catch (error) {
      console.error('Error starting Realtime service:', error);
      throw error;
    }
  };

  /**
   * Stop the speech recognition service
   */
  const stop = (): void => {
    if (!listening) return;
    
    // Finalize any in-progress speech
    if (speechState.isSpeaking) {
      finalizeSentence();
    }
    
    // Disconnect and clean up audio nodes
    if (processor && source) {
      processor.disconnect();
      source.disconnect();
    }
    
    // Stop all tracks in the media stream
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    
    // Close audio context
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close();
    }
    
    // Reset references
    processor = null;
    source = null;
    mediaStream = null;
    audioContext = null;
    
    // Set listening state
    listening = false;
    
    console.log('Realtime service stopped');
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

export default createRealtimeService; 