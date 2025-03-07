import { NextRequest } from 'next/server';
import { AssemblyAI } from 'assemblyai';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Initialize AssemblyAI client
const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    console.log('AssemblyAI Nano API route called');
    
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      console.error('No audio file provided');
      return new Response(
        JSON.stringify({ error: 'Audio file is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Received audio file: ${audioFile.name}, size: ${audioFile.size} bytes`);

    // Convert File to Buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save buffer to a temporary file
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `audio-${Date.now()}.wav`);
    
    fs.writeFileSync(tempFilePath, buffer);
    console.log(`Saved audio to temporary file: ${tempFilePath}`);

    // Check if API key is available
    if (!process.env.ASSEMBLYAI_API_KEY) {
      console.error('AssemblyAI API key is not available');
      fs.unlinkSync(tempFilePath); // Clean up
      return new Response(
        JSON.stringify({ error: 'AssemblyAI API key is not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Transcribe the audio using the Nano model (free tier)
    console.log('Sending request to AssemblyAI Nano model');
    const transcript = await client.transcripts.transcribe({
      audio: tempFilePath,
      speech_model: 'nano'
    });
    
    // Clean up the temporary file
    fs.unlinkSync(tempFilePath);
    
    console.log('Received transcript from AssemblyAI:', transcript.text);
    
    return new Response(
      JSON.stringify({ 
        text: transcript.text,
        status: transcript.status,
        id: transcript.id
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing AssemblyAI transcription:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to transcribe audio',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
} 