/**
 * GoogleSpeechService.ts
 * A service for speech-to-text processing using Google Cloud Speech-to-Text API
 */

// Define types for the service
export interface GoogleSpeechServiceOptions {
  onTranscriptUpdate: (text: string) => void;
  language?: string;
  sampleRate?: number;
  bufferSize?: number;
}

export interface GoogleSpeechServiceInstance {
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
  isRecording: boolean;
}

export const createGoogleSpeechService = (options: GoogleSpeechServiceOptions): GoogleSpeechServiceInstance => {
  // Default options
  const {
    onTranscriptUpdate,
    language = 'en-US',
    sampleRate = 16000,
    bufferSize = 4096,
  } = options;

  // Service state
  let audioContext: AudioContext | null = null;
  let mediaStream: MediaStream | null = null;
  let processor: ScriptProcessorNode | null = null;
  let input: MediaStreamAudioSourceNode | null = null;
  let isCurrentlyListening = false;
  let audioChunks: Float32Array[] = [];
  let mediaRecorder: MediaRecorder | null = null;
  let recordedChunks: Blob[] = [];
  
  // Speech detection state
  const speechState: SpeechState = {
    isSpeaking: false,
    lastSpeechTime: 0,
    currentSentence: '',
    silenceStart: null,
    isRecording: false,
  };

  // Constants for speech detection
  const noiseThreshold = 0.01;
  const silenceThreshold = 2000; // in milliseconds - longer for Google to get more context

  /**
   * Process audio data from the microphone
   */
  const processAudioData = (inputData: Float32Array): void => {
    // Add the audio chunk to the buffer
    audioChunks.push(new Float32Array(inputData));
    
    // Check if the user is speaking
    const volume = calculateVolume(inputData);
    const now = Date.now();
    
    if (volume > noiseThreshold) {
      // User is speaking
      speechState.isSpeaking = true;
      speechState.lastSpeechTime = now;
      speechState.silenceStart = null;
    } else if (speechState.isSpeaking) {
      // User was speaking but has stopped
      if (speechState.silenceStart === null) {
        speechState.silenceStart = now;
      } else if (now - speechState.silenceStart > silenceThreshold) {
        // Silence has been detected for long enough, finalize the sentence
        finalizeSentence();
      }
    }
  };

  /**
   * Calculate the volume of an audio buffer
   */
  const calculateVolume = (buffer: Float32Array): number => {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  };

  /**
   * Finalize the current sentence and send it to the Google Cloud Speech API
   */
  const finalizeSentence = async (): Promise<void> => {
    if (recordedChunks.length === 0) return;
    
    // Reset speech state
    speechState.isSpeaking = false;
    speechState.silenceStart = null;
    speechState.isRecording = false;
    
    // Create a blob from the recorded chunks
    const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
    recordedChunks = [];
    
    try {
      // Send to server for Google Cloud Speech API processing
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('language', language);
      
      const response = await fetch('/api/google/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Failed to transcribe audio: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.text) {
        speechState.currentSentence += data.text + ' ';
        onTranscriptUpdate(speechState.currentSentence.trim());
      }
    } catch (error) {
      console.error('Error transcribing audio with Google Cloud Speech:', error);
    }
    
    // Start recording again
    if (isCurrentlyListening && mediaRecorder) {
      startRecording();
    }
  };

  /**
   * Start recording audio
   */
  const startRecording = (): void => {
    if (!mediaStream) return;
    
    try {
      // Create a new MediaRecorder
      mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: 'audio/webm',
      });
      
      // Handle data available event
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };
      
      // Handle stop event
      mediaRecorder.onstop = () => {
        if (speechState.isRecording) {
          finalizeSentence();
        }
      };
      
      // Start recording
      mediaRecorder.start();
      speechState.isRecording = true;
      
      // Set a timeout to stop recording after a certain amount of time
      // This is to ensure we don't record for too long
      setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 10000); // 10 seconds max recording time
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  /**
   * Start the speech recognition service
   */
  const start = async (): Promise<void> => {
    if (isCurrentlyListening) return;
    
    try {
      // Request microphone access
      mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      // Create audio context
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate,
      });
      
      // Create audio source
      input = audioContext.createMediaStreamSource(mediaStream);
      
      // Create script processor
      processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      // Process audio data
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        processAudioData(inputData);
      };
      
      // Connect nodes
      input.connect(processor);
      processor.connect(audioContext.destination);
      
      // Start recording
      startRecording();
      
      // Update state
      isCurrentlyListening = true;
      speechState.currentSentence = '';
      
      console.log('Google Speech service started');
    } catch (error) {
      console.error('Error starting Google Speech service:', error);
      throw error;
    }
  };

  /**
   * Stop the speech recognition service
   */
  const stop = (): void => {
    if (!isCurrentlyListening) return;
    
    // Stop recording
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    
    // Disconnect and clean up
    if (processor && input) {
      processor.disconnect();
      input.disconnect();
    }
    
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
    }
    
    // Close audio context
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close();
    }
    
    // Reset state
    audioContext = null;
    mediaStream = null;
    processor = null;
    input = null;
    mediaRecorder = null;
    isCurrentlyListening = false;
    audioChunks = [];
    
    // Finalize any remaining audio
    if (recordedChunks.length > 0) {
      finalizeSentence();
    }
    
    console.log('Google Speech service stopped');
  };

  /**
   * Check if the service is currently listening
   */
  const isListening = (): boolean => {
    return isCurrentlyListening;
  };

  // Return the service instance
  return {
    start,
    stop,
    isListening,
  };
};

export default createGoogleSpeechService; 