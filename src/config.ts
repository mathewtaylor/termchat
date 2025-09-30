import { readFile } from 'fs/promises';
import { resolve } from 'path';
import type { AppConfig, Provider } from './types';

export class ConfigLoader {
  private configPath: string;

  constructor(configPath: string = './config.json') {
    this.configPath = resolve(configPath);
  }

  async load(): Promise<AppConfig> {
    try {
      const fileContent = await readFile(this.configPath, 'utf-8');
      const config: AppConfig = JSON.parse(fileContent);

      this.validate(config);

      return config;
    } catch (error) {
      if (error instanceof Error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new Error(`Config file not found at: ${this.configPath}`);
        }
        if (error instanceof SyntaxError) {
          throw new Error(`Invalid JSON in config file: ${error.message}`);
        }
        throw error;
      }
      throw new Error('Unknown error loading config');
    }
  }

  private validate(config: AppConfig): void {
    if (!config.providers || !Array.isArray(config.providers)) {
      throw new Error('Config must have a "providers" array');
    }

    if (config.providers.length === 0) {
      throw new Error('Config must have at least one provider');
    }

    if (!config.config?.activeProvider) {
      throw new Error('Config must specify an "activeProvider"');
    }

    if (!config.config?.activeModel?.id) {
      throw new Error('Config must specify an "activeModel" with an "id"');
    }

    const activeProvider = this.getActiveProvider(config);

    if (!activeProvider) {
      throw new Error(`Active provider "${config.config.activeProvider}" not found in providers list`);
    }

    if (!activeProvider.apiKey) {
      throw new Error(`Provider "${activeProvider.id}" is missing an API key`);
    }

    const modelExists = activeProvider.models.some(
      model => model.id === config.config.activeModel.id
    );

    if (!modelExists) {
      throw new Error(
        `Active model "${config.config.activeModel.id}" not found in provider "${activeProvider.id}"`
      );
    }
  }

  getActiveProvider(config: AppConfig): Provider | undefined {
    return config.providers.find(p => p.id === config.config.activeProvider);
  }
}