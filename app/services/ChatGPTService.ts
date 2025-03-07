/**
 * ChatGPTService.ts
 * A service for real-time integration with the ChatGPT API
 */

// Define types for the service
export interface ChatGPTServiceOptions {
  onMessageUpdate: (message: string) => void;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatGPTServiceInstance {
  sendMessage: (message: string, systemPrompt?: string) => Promise<void>;
  abort: () => void;
  isProcessing: () => boolean;
}

export const createChatGPTService = (options: ChatGPTServiceOptions): ChatGPTServiceInstance => {
  // Default options
  const {
    onMessageUpdate,
    apiKey = typeof window !== 'undefined' ? 
      process.env.NEXT_PUBLIC_OPENAI_API_KEY || '' : '',
    model = 'gpt-3.5-turbo',
    temperature = 0.7,
    maxTokens = 500,
  } = options;

  // Service state
  let isCurrentlyProcessing = false;
  let abortController: AbortController | null = null;

  /**
   * Send a message to the ChatGPT API
   */
  const sendMessage = async (message: string, systemPrompt?: string): Promise<void> => {
    if (!message.trim()) {
      throw new Error('Message cannot be empty');
    }

    if (isCurrentlyProcessing) {
      abort();
    }

    isCurrentlyProcessing = true;
    abortController = new AbortController();
    let fullResponse = '';

    try {
      // Use the server-side API endpoint
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: message,
          prompt: systemPrompt,
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      // Process the event stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const decoder = new TextDecoder();
      let buffer = '';

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
                onMessageUpdate(fullResponse);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Request was aborted');
      } else {
        console.error('Error sending message to ChatGPT:', error);
        throw error;
      }
    } finally {
      isCurrentlyProcessing = false;
      abortController = null;
    }
  };

  /**
   * Abort the current request
   */
  const abort = (): void => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    isCurrentlyProcessing = false;
  };

  /**
   * Check if a request is currently being processed
   */
  const isProcessing = (): boolean => {
    return isCurrentlyProcessing;
  };

  // Return the service instance
  return {
    sendMessage,
    abort,
    isProcessing,
  };
};

export default createChatGPTService; 