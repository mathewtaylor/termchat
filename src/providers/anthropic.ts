/**
 * Anthropic provider implementation
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider, type MessageResponse } from './base';

export class AnthropicProvider extends BaseProvider {
  private client: Anthropic;

  constructor(apiKey: string, modelId: string) {
    super(modelId);
    this.client = new Anthropic({ apiKey });
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

      // Convert conversation history to Anthropic format
      const messages: Array<Anthropic.MessageParam> = conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Create streaming request
      const stream = await this.client.messages.stream({
        model: this.modelId,
        max_tokens: 8192,
        messages: messages,
      });

      let fullResponse = '';

      // Process the stream
      for await (const chunk of stream) {
        // Check if aborted during streaming
        if (signal?.aborted) {
          throw new Error('Request cancelled');
        }

        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          const text = chunk.delta.text;
          fullResponse += text;
          const tokenCount = this.estimateTokens(fullResponse);
          onStreamChunk({ text, tokenCount });
        }
      }

      // Get the final message with usage data
      const finalMessage = await stream.finalMessage();

      return {
        response: fullResponse,
        usage: {
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
          totalTokens: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
        },
      };
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new Error(`Anthropic API Error: ${error.message}`);
      }

      if (error instanceof Error) {
        throw new Error(`Error: ${error.message}`);
      }

      throw new Error('An unknown error occurred');
    }
  }
}