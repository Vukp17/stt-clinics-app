'use client';

import { useState, useEffect, useRef } from 'react';
import { FaSpinner, FaPaperPlane, FaMicrophone, FaStop } from 'react-icons/fa';
import createChatGPTService, { ChatGPTServiceInstance } from '../services/ChatGPTService';
import createSpeechRecognitionService, { SpeechRecognitionServiceInstance } from '../services/SpeechRecognitionService';

interface RealtimeChatProps {
  systemPrompt?: string;
}

const RealtimeChat = ({ systemPrompt = "You are a helpful assistant." }: RealtimeChatProps) => {
  const [inputText, setInputText] = useState<string>('');
  const [responseText, setResponseText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // References to services
  const chatServiceRef = useRef<ChatGPTServiceInstance | null>(null);
  const speechServiceRef = useRef<SpeechRecognitionServiceInstance | null>(null);
  
  // Initialize services
  useEffect(() => {
    // Create ChatGPT service
    chatServiceRef.current = createChatGPTService({
      onMessageUpdate: (message) => {
        setResponseText(message);
      },
      apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
    });
    
    // Create speech recognition service
    speechServiceRef.current = createSpeechRecognitionService({
      onTranscriptUpdate: (text) => {
        setInputText(text);
      },
    });
    
    // Clean up on unmount
    return () => {
      if (chatServiceRef.current && chatServiceRef.current.isProcessing()) {
        chatServiceRef.current.abort();
      }
      
      if (speechServiceRef.current && speechServiceRef.current.isListening()) {
        speechServiceRef.current.stop();
      }
    };
  }, []);
  
  // Send message to ChatGPT
  const sendMessage = async () => {
    if (!inputText.trim() || !chatServiceRef.current) {
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setResponseText('');
    
    try {
      await chatServiceRef.current.sendMessage(inputText, systemPrompt);
    } catch (err) {
      console.error('Error sending message to ChatGPT:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to send message: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Toggle speech recognition
  const toggleListening = async () => {
    if (!speechServiceRef.current) return;
    
    setError(null);
    
    if (isListening) {
      speechServiceRef.current.stop();
      setIsListening(false);
    } else {
      try {
        await speechServiceRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Error starting speech recognition:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(`Failed to start speech recognition: ${errorMessage}`);
      }
    }
  };
  
  return (
    <div className="w-full space-y-4">
      <div className="space-y-2">
        <label htmlFor="system-prompt" className="font-medium text-lg">
          System Prompt:
        </label>
        <textarea
          id="system-prompt"
          value={systemPrompt}
          readOnly
          className="w-full p-3 border border-gray-300 rounded-md min-h-[80px] bg-gray-50 dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label htmlFor="input-text" className="font-medium text-lg">
            Your Message:
          </label>
          <button
            onClick={toggleListening}
            className={`flex items-center justify-center p-2 rounded-full ${
              isListening
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-blue-500 hover:bg-blue-600'
            } text-white transition-colors`}
            title={isListening ? 'Stop listening' : 'Start listening'}
          >
            {isListening ? <FaStop /> : <FaMicrophone />}
          </button>
        </div>
        <textarea
          id="input-text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-md min-h-[100px] bg-white dark:bg-gray-800 dark:border-gray-700"
          placeholder="Type or speak your message here..."
        />
      </div>
      
      <div className="flex justify-end">
        <button
          onClick={sendMessage}
          disabled={isProcessing || !inputText.trim()}
          className={`flex items-center justify-center px-4 py-2 rounded-md ${
            isProcessing || !inputText.trim()
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
      
      {error && <p className="text-red-500">{error}</p>}
      
      <div className="space-y-2">
        <label htmlFor="response-text" className="font-medium text-lg">
          ChatGPT Response:
        </label>
        <div
          id="response-text"
          className="w-full p-3 border border-gray-300 rounded-md min-h-[150px] bg-white dark:bg-gray-800 dark:border-gray-700 whitespace-pre-wrap"
        >
          {responseText || (
            <span className="text-gray-400">
              {isProcessing ? 'Waiting for response...' : 'ChatGPT response will appear here...'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default RealtimeChat; 