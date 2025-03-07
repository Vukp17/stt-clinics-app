/**
 * AssemblyAINanoService.ts
 * A service for speech-to-text processing using AssemblyAI's free Nano model
 */

// Define types for the service
export interface AssemblyAINanoServiceOptions {
  onTranscriptUpdate: (text: string) => void;
  onTranscriptionStart?: () => void;
  language?: string;
  sampleRate?: number;
  bufferSize?: number;
}

export interface AssemblyAINanoServiceInstance {
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

export const createAssemblyAINanoService = (options: AssemblyAINanoServiceOptions): AssemblyAINanoServiceInstance => {
  // Default options
  const {
    onTranscriptUpdate,
    onTranscriptionStart,
    language = 'en',
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
  
  // Speech detection state
  const speechState: SpeechState = {
    isSpeaking: false,
    lastSpeechTime: 0,
    currentSentence: '',
    silenceStart: null,
  };

  // Constants for speech detection
  const noiseThreshold = 0.01;
  const silenceThreshold = 1500; // in milliseconds

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
   * Finalize the current sentence and send it to the AssemblyAI Nano API
   */
  const finalizeSentence = async (): Promise<void> => {
    if (audioChunks.length === 0) return;
    
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
    
    // Clear audio chunks
    audioChunks = [];
    
    // Convert to WAV format
    const wavBuffer = float32ToWav(audioBuffer, sampleRate);
    
    try {
      // Notify that transcription is starting
      if (onTranscriptionStart) {
        onTranscriptionStart();
      }
      
      // Send to server for AssemblyAI Nano API processing
      const formData = new FormData();
      const audioBlob = new Blob([wavBuffer], { type: 'audio/wav' });
      formData.append('audio', audioBlob);
      
      const response = await fetch('/api/assemblyai/transcribe', {
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
      console.error('Error transcribing audio with AssemblyAI Nano:', error);
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
      
      console.log('AssemblyAI Nano service started');
    } catch (error) {
      console.error('Error starting AssemblyAI Nano service:', error);
      throw error;
    }
  };

  /**
   * Stop the speech recognition service
   */
  const stop = (): void => {
    if (!isCurrentlyListening) return;
    
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
    isCurrentlyListening = false;
    audioChunks = [];
    
    // Finalize any remaining audio
    if (speechState.isSpeaking) {
      finalizeSentence();
    }
    
    console.log('AssemblyAI Nano service stopped');
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

export default createAssemblyAINanoService; 