'use client';

import { useState } from 'react';
import { FaSpinner } from 'react-icons/fa';

interface TextProcessorProps {
  inputText: string;
}

const TextProcessor = ({ inputText }: TextProcessorProps) => {
  const [prompt, setPrompt] = useState<string>(
    "Imagine you are an absent-minded professor. I will give you some text at the end of this prompt. The doctor is analye should re-formulate this text/statement in the most confusing way. The length should be about three times the lenght of the original statement. This statement you process is: ...."
  );
  const [processedText, setProcessedText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const processText = async () => {
    if (!inputText.trim()) {
      setError('Please provide some text to process');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: inputText,
          prompt,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process text');
      }

      const data = await response.json();
      setProcessedText(data.result || 'No result returned');
    } catch (err) {
      console.error('Error processing text:', err);
      setError('Failed to process text. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="space-y-2">
        <label htmlFor="prompt" className="font-medium text-lg">
          Prompt Template:
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-md min-h-[100px] bg-white dark:bg-gray-800 dark:border-gray-700"
          placeholder="Enter your prompt template here..."
        />
      </div>

      <button
        onClick={processText}
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
          'Process Text'
        )}
      </button>

      {error && <p className="text-red-500">{error}</p>}

      <div className="space-y-2">
        <label htmlFor="processed-text" className="font-medium text-lg">
          Processed Text:
        </label>
        <textarea
          id="processed-text"
          value={processedText}
          readOnly
          className="w-full p-3 border border-gray-300 rounded-md min-h-[150px] bg-white dark:bg-gray-800 dark:border-gray-700"
          placeholder="Processed text will appear here..."
        />
      </div>
    </div>
  );
};

export default TextProcessor; 