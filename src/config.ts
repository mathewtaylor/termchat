import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import type { AppConfig, Provider, Theme } from './types';

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

    // Validate theme if specified
    if (config.config.activeTheme) {
      // If themes array exists, verify the theme exists in it
      if (!config.themes || config.themes.length === 0) {
        throw new Error('Config specifies activeTheme but no themes array is defined');
      }

      const theme = config.themes.find(t => t.id === config.config.activeTheme);
      if (!theme) {
        throw new Error(`Active theme "${config.config.activeTheme}" not found in themes list`);
      }

      // Validate the theme structure
      this.validateTheme(theme);
    }
  }

  private validateTheme(theme: any): void {
    if (!theme.id || !theme.name || !theme.fontColours) {
      throw new Error('Theme must have id, name, and fontColours');
    }

    if (!theme.fontColours.user || !theme.fontColours.ai) {
      throw new Error('Theme fontColours must have user and ai properties');
    }

    if (!theme.fontColours.user.name || !theme.fontColours.user.value) {
      throw new Error('Theme user color must have name and value');
    }

    if (!theme.fontColours.ai.name || !theme.fontColours.ai.value) {
      throw new Error('Theme AI color must have name and value');
    }
  }

  getActiveProvider(config: AppConfig): Provider | undefined {
    return config.providers.find(p => p.id === config.config.activeProvider);
  }

  getActiveTheme(config: AppConfig): Theme | undefined {
    if (!config.config.activeTheme) {
      return undefined;
    }
    return config.themes?.find(t => t.id === config.config.activeTheme);
  }

  async save(config: AppConfig): Promise<void> {
    try {
      const jsonContent = JSON.stringify(config, null, 2);
      await writeFile(this.configPath, jsonContent, 'utf-8');
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to save config: ${error.message}`);
      }
      throw new Error('Unknown error saving config');
    }
  }
}