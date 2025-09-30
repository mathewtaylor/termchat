import type { Message, MessageWithMetadata } from './types';
import type { BaseProvider } from './providers/base';

export class ChatManager {
  private provider: BaseProvider;
  private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  private messageMetadata: Map<number, { timestamp: Date; tokenCount?: number }> = new Map();

  constructor(provider: BaseProvider) {
    this.provider = provider;
  }

  /**
   * Replace the provider (for hot-swapping between providers)
   */
  setProvider(provider: BaseProvider): void {
    this.provider = provider;
  }

  /**
   * Update the model ID for future conversations
   */
  setModel(modelId: string): void {
    this.provider.setModel(modelId);
  }

  /**
   * Get the current model ID
   */
  getModelId(): string {
    return this.provider.getModelId();
  }

  async sendMessage(
    userMessage: string,
    onStreamChunk: (text: string, tokenCount: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    // Add user message to history with timestamp
    const userMessageIndex = this.conversationHistory.length;
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });
    this.messageMetadata.set(userMessageIndex, { timestamp: new Date() });

    try {
      // Send message through provider and get streaming response
      let tokenCount = 0;
      const fullResponse = await this.provider.sendMessage(
        this.conversationHistory,
        (chunk) => {
          tokenCount = chunk.tokenCount;
          onStreamChunk(chunk.text, chunk.tokenCount);
        },
        signal
      );

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

      if (error instanceof Error) {
        throw new Error(`Error: ${error.message}`);
      }

      throw new Error('An unknown error occurred');
    }
  }

  getHistory(): Message[] {
    return this.conversationHistory.map((msg, index) => {
      const metadata = this.messageMetadata.get(index);
      return {
        role: msg.role,
        content: msg.content,
        timestamp: metadata?.timestamp,
      };
    });
  }

  getHistoryWithMetadata(): MessageWithMetadata[] {
    return this.conversationHistory.map((msg, index) => {
      const metadata = this.messageMetadata.get(index) || { timestamp: new Date() };
      return {
        role: msg.role,
        content: msg.content,
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
      // Rough token estimation (4 chars ≈ 1 token)
      total += Math.ceil(msg.content.length / 4);
    }
    return total;
  }
}