'use client';

import { useState, useEffect, useRef } from 'react';
import { FaSpinner, FaPaperPlane, FaMicrophone, FaStop, FaGoogle, FaRobot, FaClock, FaExclamationTriangle } from 'react-icons/fa';
import createSpeechRecognitionService, { SpeechRecognitionServiceInstance, STTApi } from '../services/SpeechRecognitionService';

interface UnifiedSTTChatProps {
  defaultPrompt?: string;
}

const UnifiedSTTChat = ({ defaultPrompt = "You are a professional and empathetic doctor conducting an online consultation. The patient will describe their symptoms, and you should respond with a thoughtful and detailed analysis. Ask relevant follow-up questions to clarify the condition. Provide possible explanations, suggest next steps, and recommend whether they should seek immediate medical attention or follow home remedies. Do not provide a final diagnosis but instead offer guidance based on best medical practices. Keep the tone reassuring and professional." }: UnifiedSTTChatProps) => {
  const [inputText, setInputText] = useState<string>('');
  const [prompt, setPrompt] = useState<string>(defaultPrompt);
  const [responseText, setResponseText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [selectedApi, setSelectedApi] = useState<STTApi>('webSpeech');
  const [error, setError] = useState<string | null>(null);
  const [recordingAnimation, setRecordingAnimation] = useState<boolean>(false);
  const [processingAnimation, setProcessingAnimation] = useState<boolean>(false);
  const [speechDuration, setSpeechDuration] = useState<number>(0);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  
  // Reference to the speech recognition service
  const speechServiceRef = useRef<SpeechRecognitionServiceInstance | null>(null);
  
  // Initialize the speech recognition service
  useEffect(() => {
    // Create the service
    speechServiceRef.current = createSpeechRecognitionService({
      onTranscriptUpdate: (text) => {
        setInputText(text);
        setIsTranscribing(false);
      },
      onDurationUpdate: (durationMs) => {
        setSpeechDuration(durationMs);
      },
      onTranscriptionStart: () => {
        setIsTranscribing(true);
      },
    });
    
    // Clean up on unmount
    return () => {
      if (speechServiceRef.current && speechServiceRef.current.isListening()) {
        speechServiceRef.current.stop();
      }
    };
  }, []);
  
  // Format duration as mm:ss.ms
  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10); // Get only 2 digits of ms
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };
  
  // Handle API change
  const handleApiChange = (api: STTApi) => {
    if (!speechServiceRef.current) return;
    
    // Stop current service if it's listening
    if (isListening) {
      speechServiceRef.current.stop();
      setIsListening(false);
      setRecordingAnimation(false);
    }
    
    // Clear input text when changing API
    setInputText('');
    setError(null);
    
    // Change API
    speechServiceRef.current.changeApi(api);
    setSelectedApi(api);
  };
  
  // Toggle speech recognition
  const toggleListening = async () => {
    if (!speechServiceRef.current) return;
    
    setError(null);
    
    if (isListening) {
      speechServiceRef.current.stop();
      setIsListening(false);
      setRecordingAnimation(false);
      setIsTranscribing(false);
    } else {
      // Clear input text when starting new recording
      setInputText('');
      
      try {
        setIsTranscribing(true);
        await speechServiceRef.current.start();
        setIsListening(true);
        setRecordingAnimation(true);
      } catch (err) {
        console.error('Error starting speech recognition:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(`Failed to start speech recognition: ${errorMessage}`);
        setIsTranscribing(false);
        
        // If the current API fails, try switching to Web Speech API
        if (selectedApi !== 'webSpeech') {
          try {
            handleApiChange('webSpeech');
            setIsTranscribing(true);
            await speechServiceRef.current?.start();
            setIsListening(true);
            setRecordingAnimation(true);
            setError(`${selectedApi} failed, switched to Web Speech API`);
          } catch (fallbackErr) {
            console.error('Error starting fallback speech recognition:', fallbackErr);
            const fallbackErrorMessage = fallbackErr instanceof Error ? fallbackErr.message : 'Unknown error occurred';
            setError(`Failed to start speech recognition: ${fallbackErrorMessage}`);
            setIsTranscribing(false);
          }
        }
      }
    }
  };
  
  // Send message to ChatGPT
  const sendMessage = async () => {
    if (!inputText.trim()) {
      setError('Please provide some text to process');
      return;
    }
    
    setIsProcessing(true);
    setProcessingAnimation(true);
    setError(null);
    setResponseText('');
    
    try {
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: inputText,
          prompt,
          stream: true,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to process text: ${response.statusText}`);
      }
      
      // Process the event stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Decode the chunk and add it to the buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete events in the buffer
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              break;
            }
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullResponse += parsed.content;
                setResponseText(fullResponse);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error processing text:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to process text: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
      setProcessingAnimation(false);
    }
  };
  
  // Get API display name
  const getApiDisplayName = (api: STTApi): string => {
    switch (api) {
      case 'webSpeech':
        return 'Web Speech API';
      case 'realtime':
        return 'Realtime API';
      case 'assemblyAI':
        return 'AssemblyAI';
      case 'assemblyAINano':
        return 'AssemblyAI Nano (Free)';
      case 'whisper':
        return 'OpenAI Whisper';
      case 'googleSpeech':
        return 'Google Speech';
      default:
        return api;
    }
  };
  
  return (
    <div className="w-full space-y-4">
      <div className="space-y-2">
        <label htmlFor="prompt" className="font-medium text-lg">
          System Prompt:
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-md min-h-[80px] bg-white dark:bg-gray-800 dark:border-gray-700"
          placeholder="Enter your system prompt here..."
        />
      </div>
      
      <div className="space-y-2">
        <label className="font-medium text-lg">Speech-to-Text API:</label>
        <div className="flex flex-wrap gap-2">
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
            onClick={() => handleApiChange('assemblyAINano')}
            className={`px-3 py-1 rounded-md ${
              selectedApi === 'assemblyAINano'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            AssemblyAI Nano (Free)
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
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label htmlFor="input-text" className="font-medium text-lg">
            Your Message:
          </label>
          <div className="flex items-center">
            <div className="relative mr-2">
              {recordingAnimation && (
                <div className="absolute -top-1 -left-1 w-10 h-10 rounded-full bg-red-500 opacity-75 animate-ping"></div>
              )}
              <button
                onClick={toggleListening}
                className={`relative z-10 flex items-center justify-center p-2 rounded-full ${
                  isListening
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-blue-500 hover:bg-blue-600'
                } text-white transition-colors`}
                title={isListening ? 'Stop listening' : 'Start listening'}
                disabled={isTranscribing && !isListening}
              >
                {isListening ? <FaStop /> : isTranscribing ? <FaSpinner className="animate-spin" /> : <FaMicrophone />}
              </button>
            </div>
            <div className="text-sm text-gray-500 flex items-center">
              <span className="mr-2">Using: {getApiDisplayName(selectedApi)}</span>
              {isListening && (
                <div className="flex items-center text-red-500">
                  <FaClock className="mr-1" />
                  <span>{formatDuration(speechDuration)}</span>
                </div>
              )}
              {isTranscribing && !isListening && (
                <div className="flex items-center text-blue-500 ml-2">
                  <FaSpinner className="animate-spin mr-1" />
                  <span>Transcribing...</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="relative">
          <textarea
            id="input-text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md min-h-[100px] bg-white dark:bg-gray-800 dark:border-gray-700"
            placeholder={isTranscribing ? "Transcribing your speech..." : "Type or speak your message here..."}
            readOnly={isTranscribing}
          />
          {isListening && !recordingAnimation && (
            <div className="absolute bottom-2 right-2 flex items-center text-sm text-red-500">
              <FaClock className="mr-1" />
              <span>{formatDuration(speechDuration)}</span>
            </div>
          )}
          {isTranscribing && !isListening && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 dark:bg-gray-800 dark:bg-opacity-70">
              <div className="flex flex-col items-center">
                <FaSpinner className="animate-spin text-blue-500 text-2xl mb-2" />
                <span className="text-blue-500">Transcribing your speech...</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex justify-between items-center">
        <div>
          {isListening && (
            <div className="text-sm flex items-center text-gray-600">
              <span className="font-medium mr-1">Recording duration:</span>
              <span className="text-red-500">{formatDuration(speechDuration)}</span>
            </div>
          )}
        </div>
        <button
          onClick={sendMessage}
          disabled={isProcessing || !inputText.trim() || isTranscribing}
          className={`flex items-center justify-center px-4 py-2 rounded-md ${
            isProcessing || !inputText.trim() || isTranscribing
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600'
          } text-white transition-colors`}
        >
          {isProcessing ? (
            <>
              <FaSpinner className="animate-spin mr-2" />
              Processing...
            </>
          ) : (
            <>
              <FaPaperPlane className="mr-2" />
              Send
            </>
          )}
        </button>
      </div>
      
      {error && <p className="text-red-500 flex items-center"><FaExclamationTriangle className="mr-2" />{error}</p>}
      
      <div className="space-y-2">
        <label htmlFor="response-text" className="font-medium text-lg">
          ChatGPT Response:
        </label>
        <div className="relative">
          {processingAnimation && !responseText && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center space-x-2">
                <FaRobot className="text-blue-500 text-2xl animate-bounce" />
                <div className="flex space-x-1">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div
            id="response-text"
            className="w-full p-3 border border-gray-300 rounded-md min-h-[150px] bg-white dark:bg-gray-800 dark:border-gray-700 whitespace-pre-wrap"
          >
            {responseText || (
              <span className="text-gray-400">
                {isProcessing ? 'Thinking...' : 'ChatGPT response will appear here...'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedSTTChat; 