'use client';

import { useState } from 'react';
import SpeechRecognition from './components/SpeechRecognition';
import TextProcessor from './components/TextProcessor';
import RealtimeChat from './components/RealtimeChat';
import UnifiedSTTChat from './components/UnifiedSTTChat';
import { FaHeartbeat, FaUserMd, FaClinicMedical } from 'react-icons/fa';

export default function Home() {
  const [transcribedText, setTranscribedText] = useState('');
  const [activeTab, setActiveTab] = useState<'standard' | 'realtime' | 'unified'>('unified');

  const handleTranscriptChange = (text: string) => {
    setTranscribedText(text);
  };

  return (
    <div className="min-h-screen bg-blue-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8 text-center">
          <div className="flex items-center justify-center mb-3">
            <FaClinicMedical className="text-teal-600 text-4xl mr-3" />
            <h1 className="text-3xl font-bold text-teal-700 dark:text-teal-400">Virtual Medical Consultation</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Secure and confidential telemedicine platform
          </p>
        </header>

        <div className="max-w-4xl mx-auto mb-6">
          <div className="flex border-b border-teal-200 dark:border-teal-800">
            <button
              className={`py-2 px-4 font-medium flex items-center ${
                activeTab === 'unified'
                  ? 'border-b-2 border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('unified')}
            >
              <FaUserMd className="mr-2" />
              Medical Consultation
            </button>
          </div>
        </div>

        <main className="max-w-4xl mx-auto space-y-8">
          {activeTab === 'standard' && (
            <>
              <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-teal-500">
                <h2 className="text-xl font-semibold mb-4 text-teal-700 dark:text-teal-400">Speech Recognition</h2>
                <SpeechRecognition onTranscriptChange={handleTranscriptChange} />
              </section>

              <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-teal-500">
                <h2 className="text-xl font-semibold mb-4 text-teal-700 dark:text-teal-400">Transcribed Text</h2>
                <textarea
                  value={transcribedText}
                  onChange={(e) => setTranscribedText(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md min-h-[150px] bg-white dark:bg-gray-800 dark:border-gray-700"
                  placeholder="Your symptoms will appear here..."
                />
              </section>

              <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-teal-500">
                <h2 className="text-xl font-semibold mb-4 text-teal-700 dark:text-teal-400">Medical Analysis</h2>
                <TextProcessor inputText={transcribedText} />
              </section>
            </>
          )}
          
          {activeTab === 'realtime' && (
            <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-teal-500">
              <h2 className="text-xl font-semibold mb-4 text-teal-700 dark:text-teal-400">Realtime Consultation</h2>
              <RealtimeChat systemPrompt="Structure the text like an emr rerocrd" />
            </section>
          )}
          
          {activeTab === 'unified' && (
            <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-teal-500">
              <div className="flex items-center mb-4">
                <FaHeartbeat className="text-red-500 mr-2 text-xl" />
                <h2 className="text-xl font-semibold text-teal-700 dark:text-teal-400">Virtual Doctor Consultation</h2>
                </div>
                <UnifiedSTTChat defaultPrompt="Structure the text like an emr rerocrd" />
            </section>
          )}
        </main>

        <footer className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Virtual Medical Consultation Platform | Secure & Confidential | <span className="text-teal-600">HIPAA Compliant</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
