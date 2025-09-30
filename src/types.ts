export interface Model {
  id: string;
  display_name: string;
}

export interface Provider {
  id: string;
  name: string;
  models: Model[];
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

export interface Config {
  activeProvider: string;
  activeModel: Model;
  theme?: Theme;
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

export interface MessageWithMetadata extends Message {
  timestamp: Date;
  tokenCount?: number;
}