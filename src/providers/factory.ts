/**
 * Provider factory - creates the appropriate provider based on provider ID
 */

import { BaseProvider } from './base';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';

export class ProviderFactory {
  static createProvider(providerId: string, apiKey: string, modelId: string): BaseProvider {
    switch (providerId) {
      case 'anthropic':
        return new AnthropicProvider(apiKey, modelId);

      case 'openai':
        return new OpenAIProvider(apiKey, modelId);

      default:
        throw new Error(`Unsupported provider: ${providerId}`);
    }
  }
}