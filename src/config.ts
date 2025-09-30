import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import type { AppConfig, Provider, Theme, DefaultsConfig, UserConfig, LegacyAppConfig } from './types';

export class ConfigLoader {
  private configPath: string;
  private defaultsPath: string;
  private userConfig: UserConfig | null = null;

  constructor(configPath: string = './config.json', defaultsPath: string = './src/defaults.json') {
    this.configPath = resolve(configPath);
    this.defaultsPath = resolve(defaultsPath);
  }

  async load(): Promise<AppConfig> {
    try {
      // Load defaults (shipped with app)
      const defaultsContent = await readFile(this.defaultsPath, 'utf-8');
      const defaults: DefaultsConfig = JSON.parse(defaultsContent);

      // Try to load user config, create if it doesn't exist
      let rawConfig: any;
      try {
        const configContent = await readFile(this.configPath, 'utf-8');
        rawConfig = JSON.parse(configContent);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          // config.json doesn't exist - create default one
          console.log('⚠️  config.json not found. Creating with default settings...');
          this.userConfig = this.createDefaultUserConfig(defaults);
          const appConfig = this.mergeConfigs(defaults, this.userConfig);
          await this.save(appConfig);
          console.log('✓ Created config.json. Use /configure to add API keys.\n');
          return appConfig;
        }
        throw error;
      }

      // Check if it's the old format and migrate if necessary
      if (this.isLegacyFormat(rawConfig)) {
        console.log('⚠️  Detected old config format. Migrating to new format...');
        this.userConfig = this.migrateLegacyConfig(rawConfig as LegacyAppConfig);
        await this.save(this.mergeConfigs(defaults, this.userConfig));
        console.log('✓ Config migration complete!\n');
      } else {
        this.userConfig = rawConfig as UserConfig;
      }

      // Merge defaults with user config
      const appConfig = this.mergeConfigs(defaults, this.userConfig);

      this.validate(appConfig);

      return appConfig;
    } catch (error) {
      if (error instanceof Error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new Error('defaults.json not found. Please check your installation.');
        }
        if (error instanceof SyntaxError) {
          throw new Error(`Invalid JSON in config file: ${error.message}`);
        }
        throw error;
      }
      throw new Error('Unknown error loading config');
    }
  }

  /**
   * Check if config is in legacy format (has providers array with models and API keys)
   */
  private isLegacyFormat(config: any): boolean {
    return (
      config.providers &&
      Array.isArray(config.providers) &&
      config.providers.length > 0 &&
      config.providers[0].models !== undefined
    );
  }

  /**
   * Migrate legacy config format to new format
   */
  private migrateLegacyConfig(legacyConfig: LegacyAppConfig): UserConfig {
    const apiKeys: { [providerId: string]: string } = {};

    // Extract API keys from providers
    for (const provider of legacyConfig.providers) {
      if (provider.apiKey) {
        apiKeys[provider.id] = provider.apiKey;
      }
    }

    return {
      apiKeys,
      activeProvider: legacyConfig.config.activeProvider,
      activeModel: legacyConfig.config.activeModel,
      activeTheme: legacyConfig.config.activeTheme,
    };
  }

  /**
   * Create default user config from defaults
   */
  private createDefaultUserConfig(defaults: DefaultsConfig): UserConfig {
    // Use first provider and first model as defaults
    const firstProvider = defaults.providers[0];
    if (!firstProvider) {
      throw new Error('No providers found in defaults.json');
    }

    const firstModel = firstProvider.models[0];
    if (!firstModel) {
      throw new Error(`No models found for provider ${firstProvider.id}`);
    }

    const firstTheme = defaults.themes[0];
    if (!firstTheme) {
      throw new Error('No themes found in defaults.json');
    }

    return {
      apiKeys: {}, // Empty API keys - user will configure via /configure
      activeProvider: firstProvider.id,
      activeModel: {
        id: firstModel.id,
        display_name: firstModel.display_name,
      },
      activeTheme: firstTheme.id,
    };
  }

  /**
   * Merge defaults with user config to create AppConfig
   */
  private mergeConfigs(defaults: DefaultsConfig, userConfig: UserConfig): AppConfig {
    // Merge provider definitions with API keys
    const providers: Provider[] = defaults.providers.map(providerDef => {
      const apiKey = userConfig.apiKeys[providerDef.id] || '';
      return {
        ...providerDef,
        apiKey,
      };
    });

    // Enrich activeModel with pricing information from defaults
    let enrichedActiveModel = userConfig.activeModel;
    for (const provider of defaults.providers) {
      const modelWithPricing = provider.models.find(m => m.id === userConfig.activeModel.id);
      if (modelWithPricing) {
        enrichedActiveModel = {
          ...userConfig.activeModel,
          pricing: modelWithPricing.pricing,
        };
        break;
      }
    }

    return {
      providers,
      config: {
        activeProvider: userConfig.activeProvider,
        activeModel: enrichedActiveModel,
        activeTheme: userConfig.activeTheme,
      },
      themes: defaults.themes,
    };
  }

  private validate(config: AppConfig, requireApiKey: boolean = true): void {
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

    // Only require API key for active provider if requireApiKey is true
    if (requireApiKey && !activeProvider.apiKey) {
      throw new Error(`Provider "${activeProvider.id}" is missing an API key. Use /configure ${activeProvider.id} to add one.`);
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

  /**
   * Check if setup is needed (no API keys configured)
   */
  needsSetup(config: AppConfig): boolean {
    return Object.keys(config.providers.reduce((acc, p) => {
      if (p.apiKey) acc[p.id] = true;
      return acc;
    }, {} as { [key: string]: boolean })).length === 0;
  }

  /**
   * Update API key for a provider
   */
  async updateApiKey(config: AppConfig, providerId: string, apiKey: string): Promise<void> {
    const provider = config.providers.find(p => p.id === providerId);
    if (!provider) {
      throw new Error(`Provider "${providerId}" not found`);
    }

    // Update in-memory config
    provider.apiKey = apiKey;

    // Save to file
    await this.save(config);
  }

  async save(config: AppConfig): Promise<void> {
    try {
      // Extract user config from full AppConfig
      const apiKeys: { [providerId: string]: string } = {};
      for (const provider of config.providers) {
        if (provider.apiKey) {
          apiKeys[provider.id] = provider.apiKey;
        }
      }

      const userConfig: UserConfig = {
        apiKeys,
        activeProvider: config.config.activeProvider,
        activeModel: config.config.activeModel,
        activeTheme: config.config.activeTheme,
      };

      // Save only user config
      const jsonContent = JSON.stringify(userConfig, null, 2);
      await writeFile(this.configPath, jsonContent, 'utf-8');

      // Update cached user config
      this.userConfig = userConfig;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to save config: ${error.message}`);
      }
      throw new Error('Unknown error saving config');
    }
  }
}