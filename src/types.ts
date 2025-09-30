export interface ModelPricing {
  inputTokensPer1M: number;  // Cost per 1 million input tokens
  outputTokensPer1M: number; // Cost per 1 million output tokens
}

export interface Model {
  id: string;
  display_name: string;
  pricing?: ModelPricing;
}

// Provider definition without API key (used in defaults.json)
export interface ProviderDefinition {
  id: string;
  name: string;
  models: Model[];
}

// Provider with API key (used in merged AppConfig)
export interface Provider extends ProviderDefinition {
  apiKey: string;
}

export interface ColorDefinition {
  name: string;
  value: string;
}

export interface ThemeColors {
  user: ColorDefinition;
  ai: ColorDefinition;
}

export interface Theme {
  id: string;
  name: string;
  fontColours: ThemeColors;
}

// Default configuration (shipped with app - version controlled)
export interface DefaultsConfig {
  providers: ProviderDefinition[];
  themes: Theme[];
}

// User configuration (managed by user - gitignored)
export interface UserConfig {
  apiKeys: {
    [providerId: string]: string;
  };
  activeProvider: string;
  activeModel: Model;
  activeTheme?: string;
}

// Legacy config format for backward compatibility
export interface LegacyConfig {
  activeProvider: string;
  activeModel: Model;
  activeTheme?: string;
}

export interface LegacyAppConfig {
  providers: Provider[];
  config: LegacyConfig;
  themes?: Theme[];
}

// Merged application configuration (used by the application)
export interface Config {
  activeProvider: string;
  activeModel: Model;
  activeTheme?: string;
}

export interface AppConfig {
  providers: Provider[];
  config: Config;
  themes?: Theme[];
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface MessageWithMetadata extends Message {
  timestamp: Date;
  tokenCount?: number; // Deprecated: use inputTokens/outputTokens instead
  inputTokens?: number;
  outputTokens?: number;
}