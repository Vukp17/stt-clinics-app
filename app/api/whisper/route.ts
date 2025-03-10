import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { Readable } from 'stream';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    console.log('Whisper API route called');
    
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const language = formData.get('language') as string || 'en';

    if (!audioFile) {
      console.error('No audio file provided');
      return new Response(
        JSON.stringify({ error: 'Audio file is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Received audio file: ${audioFile.name}, size: ${audioFile.size} bytes, language: ${language}`);

    // Check if API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is not available');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key is not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create a readable stream from the buffer
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    // Call Whisper API
    console.log('Sending request to OpenAI Whisper API');
    console.log(`Using language: ${language}`);
    const response = await openai.audio.transcriptions.create({
      file: new File([buffer], 'audio.wav', { type: 'audio/wav' }),
      model: 'whisper-1',
      language,
      response_format: 'json',
    });

    console.log('Received transcript from Whisper:', response.text);
    
    return new Response(
      JSON.stringify({ text: response.text }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing Whisper request:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to transcribe audio',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
} 