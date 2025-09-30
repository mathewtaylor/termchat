import Anthropic from '@anthropic-ai/sdk';
import type { Message } from './types';

export class ChatManager {
  private client: Anthropic;
  private modelId: string;
  private conversationHistory: Array<Anthropic.MessageParam> = [];

  constructor(apiKey: string, modelId: string) {
    this.client = new Anthropic({ apiKey });
    this.modelId = modelId;
  }

  async sendMessage(userMessage: string, onStreamChunk: (text: string) => void): Promise<void> {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    try {
      // Create streaming request
      const stream = await this.client.messages.stream({
        model: this.modelId,
        max_tokens: 8192,
        messages: this.conversationHistory,
      });

      let fullResponse = '';

      // Process the stream
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          const text = chunk.delta.text;
          fullResponse += text;
          onStreamChunk(text);
        }
      }

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: fullResponse,
      });
    } catch (error) {
      // Remove the user message from history since the request failed
      this.conversationHistory.pop();

      if (error instanceof Anthropic.APIError) {
        throw new Error(`API Error: ${error.message}`);
      }

      if (error instanceof Error) {
        throw new Error(`Error: ${error.message}`);
      }

      throw new Error('An unknown error occurred');
    }
  }

  getHistory(): Message[] {
    return this.conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: typeof msg.content === 'string' ? msg.content : msg.content[0].text,
    }));
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }
}