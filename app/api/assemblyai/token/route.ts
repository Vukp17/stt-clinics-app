import { NextRequest } from 'next/server';
import { AssemblyAI } from 'assemblyai';

export async function GET(request: NextRequest) {
  try {
    // Initialize AssemblyAI client
    const client = new AssemblyAI({
      apiKey: process.env.ASSEMBLYAI_API_KEY || process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY || '',
    });

    // Create a temporary token
    const tempToken = await client.realtime.createTemporaryToken({
      expires_in: 3600 // 1 hour
    });

    // Return the token
    return new Response(
      JSON.stringify({ token: tempToken }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating AssemblyAI token:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate token' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
} 