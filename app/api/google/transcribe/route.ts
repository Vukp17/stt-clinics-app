import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SpeechClient } from '@google-cloud/speech';

// Initialize Google Cloud Speech client with explicit credentials path
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const languageCode = formData.get('language') as string || 'en-US';
    
    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: 'Audio file is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Convert File to Buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Save buffer to a temporary file
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `audio-${Date.now()}.wav`);
    
    fs.writeFileSync(tempFilePath, buffer);
    
    // Read the file into memory for Google Cloud Speech API
    const audioBytes = fs.readFileSync(tempFilePath).toString('base64');
    
    // Configure the request
    const audio = {
      content: audioBytes,
    };
    
    const config = {
      encoding: 'LINEAR16' as const,
      sampleRateHertz: 16000,
      languageCode: languageCode,
      model: 'default',
      useEnhanced: true,
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: false,
    };
    
    const googleRequest = {
      audio: audio,
      config: config,
    };
    
    try {
      const speechClient = new SpeechClient();

      // Detects speech in the audio file
      const [response] = await speechClient.recognize(googleRequest);
      
      // Extract the transcription
      const transcription = response.results
        ?.map(result => result.alternatives?.[0]?.transcript)
        .filter(Boolean)
        .join('\n');
      
      // Clean up the temporary file
      fs.unlinkSync(tempFilePath);
      
      return new Response(
        JSON.stringify({ 
          text: transcription || '',
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (googleError) {
      console.error('Google Speech API error:', googleError);
      
      // If Google API fails, return a fallback response
      return new Response(
        JSON.stringify({ 
          text: "Sorry, there was an issue with the Google Speech API. Please check your credentials or try again later.",
          error: googleError instanceof Error ? googleError.message : 'Google Speech API error'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error processing Google Cloud Speech-to-Text:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to transcribe audio' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}