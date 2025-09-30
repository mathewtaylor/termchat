/**
 * Base provider interface for LLM providers
 */

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface StreamChunk {
  text: string;
  tokenCount: number;
}

export interface MessageResponse {
  response: string;
  usage: TokenUsage;
}

export abstract class BaseProvider {
  protected modelId: string;

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  /**
   * Send a message and receive streaming response
   */
  abstract sendMessage(
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    onStreamChunk: (chunk: StreamChunk) => void,
    signal?: AbortSignal
  ): Promise<MessageResponse>;

  /**
   * Get the current model ID
   */
  getModelId(): string {
    return this.modelId;
  }

  /**
   * Set the model ID for future requests
   */
  setModel(modelId: string): void {
    this.modelId = modelId;
  }

  /**
   * Estimate token count from text
   * (Rough estimation: 4 chars ≈ 1 token)
   */
  protected estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}