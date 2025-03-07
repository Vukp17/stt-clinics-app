import { NextRequest } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text, prompt, stream } = await request.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // For streaming responses
    if (stream) {
      const systemPrompt = prompt || "You are a helpful assistant.";
      
      // Create a stream from OpenAI
      const openaiStream = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
        stream: true,
      });

      // Create a TransformStream to process the OpenAI stream
      const encoder = new TextEncoder();
      
      // Create a ReadableStream from the OpenAI stream
      const readableStream = new ReadableStream({
        async start(controller) {
          for await (const chunk of openaiStream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      // Return a streaming response
      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // For non-streaming responses (legacy support)
    const fullPrompt = prompt ? prompt.replace('....', text) : text;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return new Response(
      JSON.stringify({
        result: response.choices[0].message.content,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing OpenAI request:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process text' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
} 