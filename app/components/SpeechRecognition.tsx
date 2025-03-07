'use client';

import { useState, useEffect, useRef } from 'react';
import { FaPlay, FaPause, FaExclamationTriangle } from 'react-icons/fa';
import createSpeechRecognitionService, { 
  SpeechRecognitionServiceInstance,
  STTApi 
} from '../services/SpeechRecognitionService';

interface SpeechRecognitionProps {
  onTranscriptChange: (transcript: string) => void;
}

const SpeechRecognition = ({ onTranscriptChange }: SpeechRecognitionProps) => {
  const [isListening, setIsListening] = useState(false);
  const [selectedApi, setSelectedApi] = useState<STTApi>('webSpeech');
  const [error, setError] = useState<string | null>(null);
  
  // Reference to the speech recognition service
  const serviceRef = useRef<SpeechRecognitionServiceInstance | null>(null);
  
  // Initialize the speech recognition service
  useEffect(() => {
    // Create the service
    serviceRef.current = createSpeechRecognitionService({
      onTranscriptUpdate: onTranscriptChange,
      apiKey: process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY,
    });
    
    // Clean up on unmount
    return () => {
      if (serviceRef.current && serviceRef.current.isListening()) {
        serviceRef.current.stop();
      }
    };
  }, [onTranscriptChange]);
  
  // Toggle listening state
  const toggleListening = async () => {
    if (!serviceRef.current) return;
    
    // Clear any previous errors
    setError(null);
    
    if (isListening) {
      serviceRef.current.stop();
      setIsListening(false);
    } else {
      try {
        await serviceRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Error starting speech recognition:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(`Failed to start speech recognition: ${errorMessage}`);
      }
    }
  };
  
  // Handle API selection change
  const handleApiChange = (api: STTApi) => {
    if (!serviceRef.current) return;
    
    // Clear any previous errors
    setError(null);
    
    // Stop listening if currently listening
    if (isListening) {
      serviceRef.current.stop();
      setIsListening(false);
    }
    
    // Change the API
    serviceRef.current.changeApi(api);
    setSelectedApi(api);
  };
  
  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col space-y-2">
        <label className="font-medium text-lg">Speech-to-Text API:</label>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => handleApiChange('webSpeech')}
            className={`px-3 py-1 rounded-md ${
              selectedApi === 'webSpeech'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            Web Speech API
          </button>
          <button
            onClick={() => handleApiChange('realtime')}
            className={`px-3 py-1 rounded-md ${
              selectedApi === 'realtime'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            Realtime API
          </button>
          <button
            onClick={() => handleApiChange('assemblyAI')}
            className={`px-3 py-1 rounded-md ${
              selectedApi === 'assemblyAI'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            AssemblyAI
          </button>
          <button
            onClick={() => handleApiChange('whisper')}
            className={`px-3 py-1 rounded-md ${
              selectedApi === 'whisper'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            OpenAI Whisper
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative flex items-center">
          <FaExclamationTriangle className="mr-2" />
          <span>{error}</span>
        </div>
      )}
      
      <div className="flex items-center space-x-4">
        <button
          onClick={toggleListening}
          className={`flex items-center justify-center p-3 rounded-full ${
            isListening
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-blue-500 hover:bg-blue-600'
          } text-white transition-colors`}
          aria-label={isListening ? 'Stop listening' : 'Start listening'}
        >
          {isListening ? (
            <FaPause className="h-5 w-5" />
          ) : (
            <FaPlay className="h-5 w-5" />
          )}
        </button>
        <span className="text-sm">
          {isListening ? 'Listening...' : 'Click to start listening'}
        </span>
      </div>
      
      {selectedApi === 'assemblyAI' && (
        <div className="text-sm text-gray-600 italic">
          Note: AssemblyAI requires an API key. If you encounter issues, try using Web Speech API instead.
        </div>
      )}
    </div>
  );
};

export default SpeechRecognition; 