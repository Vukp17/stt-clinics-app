/**
 * AssemblyAIService.ts
 * A service for real-time speech-to-text processing using AssemblyAI
 */

import { AssemblyAI, RealtimeTranscriber } from 'assemblyai';

// Define types for the service
export interface AssemblyAIServiceOptions {
  onTranscriptUpdate: (text: string) => void;
  apiKey?: string;
  sampleRate?: number;
  bufferSize?: number;
  wordBoost?: string[];
}

export interface AssemblyAIServiceInstance {
  start: () => Promise<void>;
  stop: () => void;
  isListening: () => boolean;
}

/**
 * Creates an AssemblyAI speech-to-text service
 */
export const createAssemblyAIService = (options: AssemblyAIServiceOptions): AssemblyAIServiceInstance => {
  // Default options
  const {
    onTranscriptUpdate,
    apiKey = process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY || '',
    sampleRate = 16000,
    bufferSize = 4096,
    wordBoost = [],
  } = options;

  // Service state
  let transcriber: RealtimeTranscriber | null = null;
  let audioContext: AudioContext | null = null;
  let mediaStream: MediaStream | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let listening = false;
  
  // Transcript history
  let fullTranscript = '';

  /**
   * Convert Float32Array to Int16Array for AssemblyAI
   */
  const convertFloat32ToInt16 = (buffer: Float32Array): ArrayBuffer => {
    const l = buffer.length;
    const buf = new Int16Array(l);
    
    for (let i = 0; i < l; i++) {
      buf[i] = Math.min(1, Math.max(-1, buffer[i])) * 0x7FFF;
    }
    
    return buf.buffer;
  };

  /**
   * Start the speech recognition service
   */
  const start = async (): Promise<void> => {
    if (listening) return;
    
    try {
      // Validate API key
      if (!apiKey) {
        throw new Error('AssemblyAI API key is required');
      }
      
      // Get microphone access
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      // Initialize AssemblyAI client
      const client = new AssemblyAI({
        apiKey,
      });
      
      // Create a temporary token for client-side use
      // This is a workaround for the WebSocket subprotocol issue
      try {
        // Get token from backend API instead of direct API call
        const response = await fetch('/api/assemblyai/token');
        if (!response.ok) {
          throw new Error(`Failed to get token: ${response.statusText}`);
        }
        
        const data = await response.json();
        const tempToken = data.token;
        
        if (!tempToken) {
          throw new Error('No token received from server');
        }
        
        // Create AssemblyAI real-time transcriber with token
        transcriber = new RealtimeTranscriber({
          token: tempToken,
          sampleRate,
          wordBoost,
        });
      } catch (error) {
        console.error('Error getting token from server:', error);
        
        // Fallback to direct API key usage
        console.log('Falling back to direct API key usage');
        transcriber = client.realtime.transcriber({
          sampleRate,
          wordBoost,
        });
      }
      
      // Set up event handlers
      transcriber.on('open', ({ sessionId }) => {
        console.log(`AssemblyAI session opened with ID: ${sessionId}`);
      });
      
      transcriber.on('error', (error) => {
        console.error('AssemblyAI error:', error);
        stop();
      });
      
      transcriber.on('close', (code, reason) => {
        console.log('AssemblyAI session closed:', code, reason);
      });
      
      transcriber.on('transcript', (transcriptMessage) => {
        if (!transcriptMessage.text) return;
        
        if (transcriptMessage.message_type === 'FinalTranscript') {
          // Add final transcript to the full transcript
          fullTranscript += ' ' + transcriptMessage.text;
          
          // Update the transcript
          onTranscriptUpdate(fullTranscript.trim());
          
          console.log('Final transcript:', transcriptMessage.text);
        }
      });
      
      // Connect to AssemblyAI
      await transcriber.connect();
      
      // Create audio context
      audioContext = new AudioContext({ sampleRate });
      
      // Create source from microphone
      source = audioContext.createMediaStreamSource(mediaStream);
      
      // Create processor node
      processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      // Process audio data
      processor.onaudioprocess = (e) => {
        if (!transcriber) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert audio data to format expected by AssemblyAI
        const audioData = convertFloat32ToInt16(inputData);
        
        // Send audio data to AssemblyAI
        transcriber.sendAudio(audioData);
      };
      
      // Connect nodes
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      // Set listening state
      listening = true;
      
      console.log('AssemblyAI service started');
    } catch (error) {
      console.error('Error starting AssemblyAI service:', error);
      throw error;
    }
  };

  /**
   * Stop the speech recognition service
   */
  const stop = (): void => {
    if (!listening) return;
    
    // Close AssemblyAI connection
    if (transcriber) {
      transcriber.close();
      transcriber = null;
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
    
    console.log('AssemblyAI service stopped');
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

export default createAssemblyAIService; 