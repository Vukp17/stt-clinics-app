'use client';

import { useState } from 'react';
import SpeechRecognition from './components/SpeechRecognition';
import TextProcessor from './components/TextProcessor';
import RealtimeChat from './components/RealtimeChat';
import UnifiedSTTChat from './components/UnifiedSTTChat';

export default function Home() {
  const [transcribedText, setTranscribedText] = useState('');
  const [activeTab, setActiveTab] = useState<'standard' | 'realtime' | 'unified'>('unified');

  const handleTranscriptChange = (text: string) => {
    setTranscribedText(text);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Speech-to-Text Processor</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Transcribe speech and process it with AI
          </p>
        </header>

        <div className="max-w-4xl mx-auto mb-6">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              className={`py-2 px-4 font-medium ${
                activeTab === 'unified'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('unified')}
            >
              Unified STT Chat
            </button>
          </div>
        </div>

        <main className="max-w-4xl mx-auto space-y-8">
          {activeTab === 'standard' && (
            <>
              <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">Speech Recognition</h2>
                <SpeechRecognition onTranscriptChange={handleTranscriptChange} />
              </section>

              <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">Transcribed Text</h2>
                <textarea
                  value={transcribedText}
                  onChange={(e) => setTranscribedText(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md min-h-[150px] bg-white dark:bg-gray-800 dark:border-gray-700"
                  placeholder="Your transcribed text will appear here..."
                />
              </section>

              <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">AI Text Processing</h2>
                <TextProcessor inputText={transcribedText} />
              </section>
            </>
          )}
          
          {activeTab === 'realtime' && (
            <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Realtime ChatGPT</h2>
              <RealtimeChat systemPrompt="You are a helpful assistant. Respond in a concise and friendly manner." />
            </section>
          )}
          
          {activeTab === 'unified' && (
            <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Unified STT with ChatGPT</h2>
              <UnifiedSTTChat defaultPrompt="You are a helpful assistant. Respond in a concise and friendly manner." />
            </section>
          )}
        </main>

        <footer className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Speech-to-Text App with Web Speech API, AssemblyAI, OpenAI Whisper, and ChatGPT
          </p>
        </footer>
      </div>
    </div>
  );
}
