/**
 * WhisperService.ts
 * A service for real-time speech-to-text using OpenAI's Whisper API
 */

// Define types for the service
export interface WhisperServiceOptions {
  onTranscriptUpdate: (text: string) => void;
  onTranscriptionStart?: () => void;
  apiKey?: string;
  language?: string;
  sampleRate?: number;
  bufferSize?: number;
  debug?: boolean;
}

export interface WhisperServiceInstance {
  start: () => Promise<void>;
  stop: () => void;
  isListening: () => boolean;
  updateLanguage: (newLanguage: string) => void;
}

// Speech detection state
interface SpeechState {
  isSpeaking: boolean;
  lastSpeechTime: number;
  currentSentence: string;
  silenceStart: number | null;
}

export const createWhisperService = (options: WhisperServiceOptions): WhisperServiceInstance => {
  // Default options
  const {
    onTranscriptUpdate,
    onTranscriptionStart,
    apiKey = typeof window !== 'undefined' ? 
      process.env.NEXT_PUBLIC_OPENAI_API_KEY || '' : '',
    language = 'en',
    sampleRate = 16000,
    bufferSize = 4096,
    debug = true, // Enable debug mode by default
  } = options;

  // Store the language in a variable that can be updated
  let currentLanguage = language;

  console.log(`Creating WhisperService with language: ${currentLanguage}`);

  // Service state
  let audioContext: AudioContext | null = null;
  let mediaStream: MediaStream | null = null;
  let processor: ScriptProcessorNode | null = null;
  let input: MediaStreamAudioSourceNode | null = null;
  let isCurrentlyListening = false;
  let audioChunks: Float32Array[] = [];
  let finalizationTimer: NodeJS.Timeout | null = null;
  
  // Speech detection state
  const speechState: SpeechState = {
    isSpeaking: false,
    lastSpeechTime: 0,
    currentSentence: '',
    silenceStart: null,
  };

  // Constants for speech detection
  const noiseThreshold = 0.005;
  const silenceThreshold = 1000;
  const maxRecordingTime = 3000; // Force finalization after 3 seconds

  /**
   * Process audio data from the microphone
   */
  const processAudioData = (inputData: Float32Array): void => {
    // Add the audio chunk to the buffer
    audioChunks.push(new Float32Array(inputData));
    
    // Check if we have collected enough audio to force finalization
    // This is a fallback in case silence detection doesn't work
    if (audioChunks.length > 50) { // Reduced from 100 to 50 (about 1 second of audio)
      if (debug) console.log(`Forcing finalization after ${audioChunks.length} chunks`);
      finalizeSentence();
      return;
    }
    
    // Check if the user is speaking
    const volume = calculateVolume(inputData);
    const now = Date.now();
    
    // Log volume occasionally
    if (debug && audioChunks.length % 10 === 0) {
      console.log(`Current volume: ${volume.toFixed(4)}, threshold: ${noiseThreshold}, speaking: ${volume > noiseThreshold}`);
    }
    
    if (volume > noiseThreshold) {
      // User is speaking
      speechState.isSpeaking = true;
      speechState.lastSpeechTime = now;
      speechState.silenceStart = null;
      
      // Log when speech is detected
      if (debug && audioChunks.length % 10 === 0) {
        console.log('Speech detected');
      }
    } else if (speechState.isSpeaking) {
      // User was speaking but has stopped
      if (speechState.silenceStart === null) {
        speechState.silenceStart = now;
        if (debug) console.log('Silence started after speech');
      } else if (now - speechState.silenceStart > silenceThreshold) {
        // Silence has been detected for long enough, finalize the sentence
        if (debug) console.log(`Silence threshold reached (${now - speechState.silenceStart}ms > ${silenceThreshold}ms), finalizing sentence`);
        finalizeSentence();
      } else if (debug && audioChunks.length % 10 === 0) {
        // Log silence duration occasionally
        console.log(`Silence duration: ${now - speechState.silenceStart}ms / ${silenceThreshold}ms`);
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
   * Finalize the current sentence and send it to the Whisper API
   */
  const finalizeSentence = async (): Promise<void> => {
    if (audioChunks.length === 0) {
      if (debug) console.log('No audio chunks to finalize');
      return;
    }
    
    if (debug) console.log(`Finalizing sentence with ${audioChunks.length} chunks`);
    
    // Reset speech state
    speechState.isSpeaking = false;
    speechState.silenceStart = null;
    
    // Convert audio chunks to a single buffer
    const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const audioBuffer = new Float32Array(totalLength);
    
    let offset = 0;
    for (const chunk of audioChunks) {
      audioBuffer.set(chunk, offset);
      offset += chunk.length;
    }
    
    if (debug) console.log(`Created audio buffer with ${totalLength} samples`);
    
    // Clear audio chunks
    audioChunks = [];
    
    // Convert to WAV format
    const wavBuffer = float32ToWav(audioBuffer, sampleRate);
    
    if (debug) console.log(`Converted to WAV format, size: ${wavBuffer.byteLength} bytes`);
    
    try {
      // Notify that transcription is starting
      if (onTranscriptionStart) {
        onTranscriptionStart();
      }
      
      // Send to server for Whisper API processing
      const formData = new FormData();
      const audioBlob = new Blob([wavBuffer], { type: 'audio/wav' });
      formData.append('audio', audioBlob);
      formData.append('language', currentLanguage);
      
      console.log(`Sending audio to Whisper API with language: ${currentLanguage}`);
      
      const response = await fetch('/api/whisper', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to transcribe audio: ${response.statusText}, ${errorText}`);
      }
      
      const data = await response.json();
      
      if (debug) console.log(`Received response from Whisper API:`, data);
      
      if (data.text) {
        speechState.currentSentence += data.text + ' ';
        onTranscriptUpdate(speechState.currentSentence.trim());
      } else {
        if (debug) console.log('No text in response from Whisper API');
      }
    } catch (error) {
      console.error('Error transcribing audio with Whisper:', error);
    }
  };

  /**
   * Convert Float32Array to WAV format
   */
  const float32ToWav = (samples: Float32Array, sampleRate: number): ArrayBuffer => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    
    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // File length
    view.setUint32(4, 36 + samples.length * 2, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // Format chunk identifier
    writeString(view, 12, 'fmt ');
    // Format chunk length
    view.setUint32(16, 16, true);
    // Sample format (1 is PCM)
    view.setUint16(20, 1, true);
    // Channel count
    view.setUint16(22, 1, true);
    // Sample rate
    view.setUint32(24, sampleRate, true);
    // Byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * 2, true);
    // Block align (channel count * bytes per sample)
    view.setUint16(32, 2, true);
    // Bits per sample
    view.setUint16(34, 16, true);
    // Data chunk identifier
    writeString(view, 36, 'data');
    // Data chunk length
    view.setUint32(40, samples.length * 2, true);
    
    // Write the PCM samples
    const volume = 0.5;
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    }
    
    return buffer;
  };

  /**
   * Write a string to a DataView
   */
  const writeString = (view: DataView, offset: number, string: string): void => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  /**
   * Start the speech recognition service
   */
  const start = async (): Promise<void> => {
    if (isCurrentlyListening) return;
    
    console.log(`Starting WhisperService with language: ${currentLanguage}`);
    
    try {
      // Request microphone access
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
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
      
      // Update state
      isCurrentlyListening = true;
      speechState.currentSentence = '';
      audioChunks = []; // Clear any existing audio chunks
      
      // Set up a timer to force finalization after maxRecordingTime
      if (finalizationTimer) {
        clearTimeout(finalizationTimer);
      }
      
      finalizationTimer = setTimeout(() => {
        if (debug) console.log(`Forcing finalization after ${maxRecordingTime}ms timer`);
        if (audioChunks.length > 0) {
          finalizeSentence();
        }
      }, maxRecordingTime);
      
      console.log('Whisper service started');
    } catch (error) {
      console.error('Error starting Whisper service:', error);
      throw error;
    }
  };

  /**
   * Stop the speech recognition service
   */
  const stop = (): void => {
    if (!isCurrentlyListening) return;
    
    // Clear the finalization timer
    if (finalizationTimer) {
      clearTimeout(finalizationTimer);
      finalizationTimer = null;
    }
    
    // Finalize any remaining audio
    if (audioChunks.length > 0) {
      if (debug) console.log(`Finalizing ${audioChunks.length} chunks on stop`);
      finalizeSentence();
    }
    
    // Disconnect and clean up
    if (processor && input) {
      try {
        input.disconnect(processor);
        processor.disconnect();
      } catch (e) {
        console.error('Error disconnecting audio nodes:', e);
      }
    }
    
    // Stop the media stream
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    
    // Close the audio context
    if (audioContext && audioContext.state !== 'closed') {
      try {
        audioContext.close();
      } catch (e) {
        console.error('Error closing audio context:', e);
      }
    }
    
    // Reset state
    processor = null;
    input = null;
    mediaStream = null;
    audioContext = null;
    isCurrentlyListening = false;
    
    console.log('Whisper service stopped');
  };

  /**
   * Check if the service is currently listening
   */
  const isListening = (): boolean => {
    return isCurrentlyListening;
  };

  // Return the service instance with an additional method to update the language
  return {
    start,
    stop,
    isListening,
    updateLanguage: (newLanguage: string) => {
      currentLanguage = newLanguage;
      console.log(`Updated WhisperService language to: ${currentLanguage}`);
    }
  };
};

export default createWhisperService; 