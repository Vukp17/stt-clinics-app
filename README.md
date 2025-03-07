# Speech-to-Text Processor

A web application that transcribes speech to text using multiple speech recognition APIs and processes the text using OpenAI's GPT-4.

## Features

- Speech-to-Text transcription with three different APIs:
  - Web Speech API (built into modern browsers)
  - Realtime API (custom audio processing implementation)
  - AssemblyAI (real-time transcription service)
- Play/Pause button to control speech recognition
- Text processing with OpenAI's GPT-4
- Customizable prompt template
- Modern, responsive UI with dark mode support
- Service-oriented architecture for maintainability and extensibility

## Getting Started

### Prerequisites

- Node.js 18.x or later
- An OpenAI API key
- An AssemblyAI API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/speech-to-text-app.git
   cd speech-to-text-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory and add your API keys:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   NEXT_PUBLIC_ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Select one of the three Speech-to-Text APIs using the radio buttons:
   - Web Speech API: Uses the browser's built-in speech recognition
   - Realtime API: Uses a custom audio processing implementation
   - AssemblyAI: Uses the AssemblyAI real-time transcription service
2. Click the Play button to start speech recognition.
3. Speak into your microphone to transcribe your speech to text.
4. Click the Pause button to stop speech recognition.
5. The transcribed text will appear in the text area.
6. Customize the prompt template if desired.
7. Click the "Process Text" button to send the transcribed text to OpenAI for processing.
8. The processed text will appear in the output area.

## Architecture

The application follows a service-oriented architecture:

- **Services Layer**: Contains the core functionality for each speech recognition API
  - `WebSpeechService.ts`: Handles the Web Speech API integration
  - `RealtimeService.ts`: Implements custom audio processing
  - `AssemblyAIService.ts`: Integrates with the AssemblyAI API
  - `SpeechRecognitionService.ts`: Factory service that provides a unified interface

- **Components Layer**: React components that use the services
  - `SpeechRecognition.tsx`: UI component for speech recognition
  - `TextProcessor.tsx`: UI component for text processing with OpenAI

- **API Layer**: Server-side API routes
  - `app/api/openai/route.ts`: API route for OpenAI integration

## Implementation Notes

- The Web Speech API is implemented using the browser's built-in `SpeechRecognition` API.
- The Realtime API implementation uses the Web Audio API to process audio data in real-time.
- The AssemblyAI implementation uses the AssemblyAI JavaScript SDK to perform real-time transcription.
- To use AssemblyAI, you need to sign up for an account and get an API key from [AssemblyAI](https://www.assemblyai.com/).

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with Next.js, React, and Tailwind CSS
- Uses OpenAI's GPT-4 for text processing
- Uses AssemblyAI for speech recognition
