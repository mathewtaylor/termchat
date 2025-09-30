import Anthropic from '@anthropic-ai/sdk';
import type { Message, MessageWithMetadata } from './types';

export class ChatManager {
  private client: Anthropic;
  private modelId: string;
  private conversationHistory: Array<Anthropic.MessageParam> = [];
  private messageMetadata: Map<number, { timestamp: Date; tokenCount?: number }> = new Map();

  constructor(apiKey: string, modelId: string) {
    this.client = new Anthropic({ apiKey });
    this.modelId = modelId;
  }

  /**
   * Update the model ID for future conversations
   */
  setModel(modelId: string): void {
    this.modelId = modelId;
  }

  /**
   * Get the current model ID
   */
  getModelId(): string {
    return this.modelId;
  }

  async sendMessage(
    userMessage: string,
    onStreamChunk: (text: string, tokenCount: number) => void
  ): Promise<void> {
    // Add user message to history with timestamp
    const userMessageIndex = this.conversationHistory.length;
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });
    this.messageMetadata.set(userMessageIndex, { timestamp: new Date() });

    try {
      // Create streaming request
      const stream = await this.client.messages.stream({
        model: this.modelId,
        max_tokens: 8192,
        messages: this.conversationHistory,
      });

      let fullResponse = '';
      let tokenCount = 0;

      // Process the stream
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          const text = chunk.delta.text;
          fullResponse += text;
          tokenCount = this.estimateTokens(fullResponse);
          onStreamChunk(text, tokenCount);
        }
      }

      // Add assistant response to history with metadata
      const assistantMessageIndex = this.conversationHistory.length;
      this.conversationHistory.push({
        role: 'assistant',
        content: fullResponse,
      });
      this.messageMetadata.set(assistantMessageIndex, {
        timestamp: new Date(),
        tokenCount: tokenCount,
      });
    } catch (error) {
      // Remove the user message from history since the request failed
      this.conversationHistory.pop();
      this.messageMetadata.delete(userMessageIndex);

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
    return this.conversationHistory.map((msg, index) => {
      const metadata = this.messageMetadata.get(index);
      const content = typeof msg.content === 'string'
        ? msg.content
        : (msg.content[0] && 'text' in msg.content[0] ? msg.content[0].text : '');
      return {
        role: msg.role as 'user' | 'assistant',
        content,
        timestamp: metadata?.timestamp,
      };
    });
  }

  getHistoryWithMetadata(): MessageWithMetadata[] {
    return this.conversationHistory.map((msg, index) => {
      const metadata = this.messageMetadata.get(index) || { timestamp: new Date() };
      const content = typeof msg.content === 'string'
        ? msg.content
        : (msg.content[0] && 'text' in msg.content[0] ? msg.content[0].text : '');
      return {
        role: msg.role as 'user' | 'assistant',
        content,
        timestamp: metadata.timestamp,
        tokenCount: metadata.tokenCount,
      };
    });
  }

  clearHistory(): void {
    this.conversationHistory = [];
    this.messageMetadata.clear();
  }

  getMessageCount(): number {
    return this.conversationHistory.length;
  }

  getTokenEstimate(): number {
    let total = 0;
    for (const msg of this.conversationHistory) {
      const content = typeof msg.content === 'string'
        ? msg.content
        : (msg.content[0] && 'text' in msg.content[0] ? msg.content[0].text : '');
      total += this.estimateTokens(content);
    }
    return total;
  }

  /**
   * Rough token estimation (4 chars ≈ 1 token)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}