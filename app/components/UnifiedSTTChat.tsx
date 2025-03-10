'use client';

import { useState, useEffect, useRef } from 'react';
import { FaSpinner, FaPaperPlane, FaMicrophone, FaStop, FaGoogle, FaRobot, FaClock, FaExclamationTriangle, FaHeartbeat, FaStethoscope, FaNotesMedical, FaUserMd, FaHospital } from 'react-icons/fa';
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
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isMonitoringAudio, setIsMonitoringAudio] = useState<boolean>(false);
  
  // Reference to the speech recognition service
  const speechServiceRef = useRef<SpeechRecognitionServiceInstance | null>(null);
  // Reference to the audio analyzer
  const analyzerRef = useRef<{
    audioContext: AudioContext | null;
    analyzer: AnalyserNode | null;
    dataArray: Uint8Array | null;
    stream: MediaStream | null;
    animationFrame: number | null;
  }>({
    audioContext: null,
    analyzer: null,
    dataArray: null,
    stream: null,
    animationFrame: null,
  });
  
  // Initialize the speech recognition service
  useEffect(() => {
    console.log(`Initializing speech recognition service with language: ${selectedLanguage}`);
    
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
      language: selectedLanguage,
      debug: true, // Enable debug mode
    });
    
    // If an API was previously selected, make sure to set it again
    if (selectedApi !== 'webSpeech' && speechServiceRef.current) {
      speechServiceRef.current.changeApi(selectedApi);
    }
    
    // Clean up on unmount
    return () => {
      if (speechServiceRef.current && speechServiceRef.current.isListening()) {
        speechServiceRef.current.stop();
      }
      stopAudioMonitoring();
    };
  }, []);  // Only run once on mount
  
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
    
    console.log(`Changing API to ${api} with language: ${selectedLanguage}`);
    
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
  
  // Handle language change
  const handleLanguageChange = (language: string) => {
    console.log(`Language changed to: ${language}`);
    setSelectedLanguage(language);
    
    // If the service is already created, update the language
    if (speechServiceRef.current) {
      // Use the direct updateLanguage method
      speechServiceRef.current.updateLanguage(language);
      
      // If we were listening, we need to reset the UI state since the service was stopped
      if (isListening) {
        setIsListening(false);
        setRecordingAnimation(false);
        
        // Log the current API and language
        console.log(`After language change - API: ${selectedApi}, Language: ${language}`);
      }
    }
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
      
      // Stop audio monitoring when stopping recording
      stopAudioMonitoring();
    } else {
      // Clear input text when starting new recording
      setInputText('');
      
      try {
        console.log(`Starting speech recognition with API: ${selectedApi}, Language: ${selectedLanguage}`);
        
        // Always update the language before starting to ensure it's using the correct language
        speechServiceRef.current.updateLanguage(selectedLanguage);
        
        // Start audio monitoring when starting recording
        startAudioMonitoring();
        
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
  
  // Force finalization of the current sentence
  const forceFinalization = () => {
    if (!speechServiceRef.current || !isListening) return;
    
    console.log('Manually forcing finalization');
    
    // Use the direct forceFinalize method
    speechServiceRef.current.forceFinalize();
    setIsListening(false);
    setRecordingAnimation(false);
    
    // Small delay to ensure the service has time to finalize
    setTimeout(() => {
      // Restart the service if needed
      if (speechServiceRef.current) {
        console.log('Restarting speech recognition service');
        setIsTranscribing(true);
        speechServiceRef.current.start().then(() => {
          setIsListening(true);
          setRecordingAnimation(true);
        }).catch(error => {
          console.error('Error restarting speech recognition:', error);
          setError(`Failed to restart speech recognition: ${error instanceof Error ? error.message : String(error)}`);
        });
      }
    }, 1000);
  };
  
  // Start monitoring audio levels
  const startAudioMonitoring = async () => {
    if (isMonitoringAudio) return;
    
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create audio source
      const input = audioContext.createMediaStreamSource(stream);
      
      // Create analyzer node
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 2048;
      
      // Connect nodes
      input.connect(analyzer);
      
      // Create data array
      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      
      // Store references
      analyzerRef.current = {
        audioContext,
        analyzer,
        dataArray,
        stream,
        animationFrame: null,
      };
      
      // Start monitoring
      setIsMonitoringAudio(true);
      
      // Update audio level in animation frame
      const updateAudioLevel = () => {
        if (!analyzerRef.current.analyzer || !analyzerRef.current.dataArray) return;
        
        // Get volume level
        analyzerRef.current.analyzer.getByteTimeDomainData(analyzerRef.current.dataArray);
        
        // Calculate volume
        let sum = 0;
        for (let i = 0; i < analyzerRef.current.dataArray.length; i++) {
          const value = (analyzerRef.current.dataArray[i] - 128) / 128;
          sum += value * value;
        }
        const volume = Math.sqrt(sum / analyzerRef.current.dataArray.length);
        
        // Update state
        setAudioLevel(volume);
        
        // Schedule next update
        analyzerRef.current.animationFrame = requestAnimationFrame(updateAudioLevel);
      };
      
      // Start updating
      updateAudioLevel();
    } catch (error) {
      console.error('Error starting audio monitoring:', error);
      setError(`Failed to start audio monitoring: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  // Stop monitoring audio levels
  const stopAudioMonitoring = () => {
    if (!isMonitoringAudio) return;
    
    // Cancel animation frame
    if (analyzerRef.current.animationFrame) {
      cancelAnimationFrame(analyzerRef.current.animationFrame);
    }
    
    // Stop media stream
    if (analyzerRef.current.stream) {
      analyzerRef.current.stream.getTracks().forEach(track => track.stop());
    }
    
    // Close audio context
    if (analyzerRef.current.audioContext) {
      analyzerRef.current.audioContext.close();
    }
    
    // Reset references
    analyzerRef.current = {
      audioContext: null,
      analyzer: null,
      dataArray: null,
      stream: null,
      animationFrame: null,
    };
    
    // Update state
    setIsMonitoringAudio(false);
    setAudioLevel(0);
  };
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopAudioMonitoring();
    };
  }, []);
  
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
      <div className="space-y-2 bg-teal-50 dark:bg-teal-900/20 p-4 rounded-lg border border-teal-200 dark:border-teal-800">
        <label htmlFor="prompt" className="font-medium text-lg flex items-center text-teal-700 dark:text-teal-400">
          <FaUserMd className="mr-2" />
          Medical Consultation Protocol:
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full p-3 border border-teal-300 rounded-md min-h-[80px] bg-white dark:bg-gray-800 dark:border-teal-700 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          placeholder="Enter your medical consultation protocol here..."
        />
      </div>
      
      <div className="space-y-2 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <label className="font-medium text-lg flex items-center text-blue-700 dark:text-blue-400">
          <FaStethoscope className="mr-2" />
          Voice Recognition Technology:
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleApiChange('webSpeech')}
            className={`px-3 py-1 rounded-md ${
              selectedApi === 'webSpeech'
                ? 'bg-teal-500 text-white'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-teal-100 dark:hover:bg-teal-900/30'
            }`}
          >
            Web Speech API
          </button>
          <button
            onClick={() => handleApiChange('assemblyAINano')}
            className={`px-3 py-1 rounded-md ${
              selectedApi === 'assemblyAINano'
                ? 'bg-teal-500 text-white'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-teal-100 dark:hover:bg-teal-900/30'
            }`}
          >
            AssemblyAI Nano (Free)
          </button>
          <button
            onClick={() => handleApiChange('whisper')}
            className={`px-3 py-1 rounded-md ${
              selectedApi === 'whisper'
                ? 'bg-teal-500 text-white'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-teal-100 dark:hover:bg-teal-900/30'
            }`}
          >
            OpenAI Whisper
          </button>
        </div>
      </div>
      
      {/* Language Selection - Only show for Whisper and AssemblyAI Nano */}
      {(selectedApi === 'whisper' || selectedApi === 'assemblyAINano') && (
        <div className="space-y-2 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <label className="font-medium text-lg flex items-center text-blue-700 dark:text-blue-400">
            <FaHospital className="mr-2" />
            Consultation Language:
          </label>
          <div className="flex space-x-4 p-3 bg-white dark:bg-gray-800 rounded-md border border-blue-200 dark:border-blue-800">
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio h-4 w-4 text-teal-600"
                checked={selectedLanguage === 'en'}
                onChange={() => handleLanguageChange('en')}
              />
              <span className="ml-2 text-sm">English</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio h-4 w-4 text-teal-600"
                checked={selectedLanguage === 'de'}
                onChange={() => handleLanguageChange('de')}
              />
              <span className="ml-2 text-sm">German</span>
            </label>
          </div>
        </div>
      )}
      
      {/* Audio Level Monitor */}
      <div className="space-y-2 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex justify-between items-center">
          <label className="font-medium text-lg flex items-center text-blue-700 dark:text-blue-400">
            <FaHeartbeat className="mr-2" />
            Voice Signal Strength:
          </label>
          <div className="text-sm text-gray-500">
            {isMonitoringAudio ? 'Monitoring active' : 'Monitoring inactive'}
          </div>
        </div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden border border-blue-200 dark:border-blue-800">
          <div
            className="h-full bg-teal-500 transition-all duration-100"
            style={{ width: `${Math.min(audioLevel * 100 * 5, 100)}%` }}
          ></div>
        </div>
        <div className="text-xs text-gray-500 flex justify-between">
          <span>0</span>
          <span>Current: {audioLevel.toFixed(4)}</span>
          <span>0.2</span>
        </div>
      </div>
      
      <div className="space-y-2 bg-teal-50 dark:bg-teal-900/20 p-4 rounded-lg border border-teal-200 dark:border-teal-800">
        <div className="flex justify-between items-center">
          <label htmlFor="input-text" className="font-medium text-lg flex items-center text-teal-700 dark:text-teal-400">
            <FaNotesMedical className="mr-2" />
            Patient Symptoms:
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
                    : 'bg-teal-500 hover:bg-teal-600'
                } text-white transition-colors`}
                title={isListening ? 'Stop recording' : 'Start recording'}
                disabled={isTranscribing && !isListening}
              >
                {isListening ? <FaStop /> : isTranscribing ? <FaSpinner className="animate-spin" /> : <FaMicrophone />}
              </button>
              
              {/* Add manual finalization button */}
              {isListening && (selectedApi === 'assemblyAINano' || selectedApi === 'whisper') && (
                <button
                  onClick={forceFinalization}
                  className="ml-2 relative z-10 flex items-center justify-center p-2 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors"
                  title="Complete recording"
                >
                  <FaPaperPlane />
                </button>
              )}
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
                <div className="flex items-center text-teal-500 ml-2">
                  <FaSpinner className="animate-spin mr-1" />
                  <span>Processing speech...</span>
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
            className="w-full p-3 border border-teal-300 rounded-md min-h-[100px] bg-white dark:bg-gray-800 dark:border-teal-700 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            placeholder={isTranscribing ? "Processing your symptoms..." : "Describe your symptoms here..."}
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
                <FaSpinner className="animate-spin text-teal-500 text-2xl mb-2" />
                <span className="text-teal-500">Processing your symptoms...</span>
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
              : 'bg-teal-500 hover:bg-teal-600'
          } text-white transition-colors`}
        >
          {isProcessing ? (
            <>
              <FaSpinner className="animate-spin mr-2" />
              Consulting...
            </>
          ) : (
            <>
              <FaPaperPlane className="mr-2" />
              Submit Symptoms
            </>
          )}
        </button>
      </div>
      
      {error && <p className="text-red-500 flex items-center"><FaExclamationTriangle className="mr-2" />{error}</p>}
      
      <div className="space-y-2 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <label htmlFor="response-text" className="font-medium text-lg flex items-center text-blue-700 dark:text-blue-400">
          <FaUserMd className="mr-2" />
          Doctor's Assessment:
        </label>
        <div className="relative">
          {processingAnimation && !responseText && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center space-x-2">
                <FaUserMd className="text-teal-500 text-2xl animate-bounce" />
                <div className="flex space-x-1">
                  <div className="w-3 h-3 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                  <div className="w-3 h-3 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-3 h-3 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div
            id="response-text"
            className="w-full p-3 border border-blue-300 rounded-md min-h-[150px] bg-white dark:bg-gray-800 dark:border-blue-700 whitespace-pre-wrap"
          >
            {responseText || (
              <span className="text-gray-400">
                {isProcessing ? 'Doctor is analyzing your symptoms...' : 'Medical assessment will appear here...'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedSTTChat; 