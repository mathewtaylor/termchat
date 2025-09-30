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

export interface Config {
  activeProvider: string;
  activeModel: Model;
}

export interface AppConfig {
  providers: Provider[];
  config: Config;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}