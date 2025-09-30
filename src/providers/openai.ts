/**
 * OpenAI provider implementation
 */

import OpenAI from 'openai';
import { BaseProvider, type MessageResponse } from './base';

export class OpenAIProvider extends BaseProvider {
  private client: OpenAI;

  constructor(apiKey: string, modelId: string) {
    super(modelId);
    this.client = new OpenAI({ apiKey });
  }

  async sendMessage(
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    onStreamChunk: (chunk: { text: string; tokenCount: number }) => void,
    signal?: AbortSignal
  ): Promise<MessageResponse> {
    try {
      // Check if already aborted
      if (signal?.aborted) {
        throw new Error('Request cancelled');
      }

      // Convert conversation history to OpenAI format
      const messages: Array<OpenAI.Chat.ChatCompletionMessageParam> = conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Create streaming request with usage tracking enabled
      const stream = await this.client.chat.completions.create({
        model: this.modelId,
        messages: messages,
        stream: true,
        stream_options: { include_usage: true },
      });

      let fullResponse = '';
      let usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;

      // Process the stream
      for await (const chunk of stream) {
        // Check if aborted during streaming
        if (signal?.aborted) {
          throw new Error('Request cancelled');
        }

        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          const text = delta.content;
          fullResponse += text;
          const tokenCount = this.estimateTokens(fullResponse);
          onStreamChunk({ text, tokenCount });
        }

        // Capture usage from the final chunk
        if (chunk.usage) {
          usage = chunk.usage;
        }
      }

      // Return response with actual token usage
      return {
        response: fullResponse,
        usage: {
          inputTokens: usage?.prompt_tokens || 0,
          outputTokens: usage?.completion_tokens || 0,
          totalTokens: usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new Error(`OpenAI API Error: ${error.message}`);
      }

      if (error instanceof Error) {
        throw new Error(`Error: ${error.message}`);
      }

      throw new Error('An unknown error occurred');
    }
  }
}