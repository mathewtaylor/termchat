/**
 * Interactive setup manager for configuring providers
 */

import * as readline from 'readline';
import type { AppConfig, Provider } from './types';
import { ConfigLoader } from './config';

export class SetupManager {
  private config: AppConfig;
  private configLoader: ConfigLoader;

  constructor(config: AppConfig, configLoader: ConfigLoader) {
    this.config = config;
    this.configLoader = configLoader;
  }

  /**
   * Run first-time setup wizard
   */
  async runFirstTimeSetup(): Promise<boolean> {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    Welcome to TermChat!                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    console.log('Let\'s set up your AI providers. You need at least one API key to continue.\n');

    // Display available providers
    console.log('Available Providers:');
    console.log('─'.repeat(64));
    for (let i = 0; i < this.config.providers.length; i++) {
      const provider = this.config.providers[i];
      const status = provider.apiKey ? '✓ Configured' : '✗ Not configured';
      const modelCount = provider.models.length;
      console.log(`  ${i + 1}. ${provider.name.padEnd(15)} ${status.padEnd(20)} (${modelCount} model${modelCount !== 1 ? 's' : ''})`);
    }
    console.log('─'.repeat(64) + '\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let configuredAny = false;

    // Ask which providers to configure
    const selectedProviders = await this.selectProvidersToConfigureInteractive(rl);

    if (selectedProviders.length === 0) {
      console.log('\n⚠️  No providers selected. Exiting setup.\n');
      rl.close();
      return false;
    }

    // Configure selected providers
    for (const provider of selectedProviders) {
      const configured = await this.configureProviderInteractive(rl, provider);
      if (configured) {
        configuredAny = true;
      }
    }

    rl.close();

    if (!configuredAny) {
      console.log('\n⚠️  No API keys configured. You need at least one to use TermChat.');
      console.log('Run the application again to configure, or use /configure command.\n');
      return false;
    }

    // Switch to the first configured provider if the current active provider isn't configured
    const activeProvider = this.configLoader.getActiveProvider(this.config);
    if (!activeProvider?.apiKey) {
      const firstConfigured = this.configLoader.getFirstConfiguredProvider(this.config);
      if (firstConfigured) {
        console.log(`\n✓ Setting active provider to ${firstConfigured.name}...`);

        // Update active provider
        this.config.config.activeProvider = firstConfigured.id;

        // Update active model to first model of the new provider
        const firstModel = firstConfigured.models[0];
        if (firstModel) {
          this.config.config.activeModel = {
            id: firstModel.id,
            display_name: firstModel.display_name,
            pricing: firstModel.pricing,
          };
        }

        // Save the updated config
        await this.configLoader.save(this.config);
      }
    }

    console.log('\n✓ Setup complete! Starting TermChat...\n');
    return true;
  }

  /**
   * Let user select which providers to configure
   */
  private async selectProvidersToConfigureInteractive(
    rl: readline.Interface
  ): Promise<Provider[]> {
    return new Promise((resolve) => {
      rl.question(
        'Enter provider numbers to configure (e.g., 1,2 or "all" for all providers): ',
        (answer) => {
          const trimmed = answer.trim().toLowerCase();

          if (trimmed === 'all') {
            resolve(this.config.providers);
            return;
          }

          if (!trimmed) {
            resolve([]);
            return;
          }

          // Parse numbers
          const numbers = trimmed
            .split(',')
            .map(s => parseInt(s.trim(), 10))
            .filter(n => !isNaN(n) && n >= 1 && n <= this.config.providers.length);

          const selected = numbers.map(n => this.config.providers[n - 1]).filter(Boolean);
          resolve(selected);
        }
      );
    });
  }

  /**
   * Configure a specific provider interactively
   */
  async configureProviderInteractive(
    rl: readline.Interface,
    provider: Provider
  ): Promise<boolean> {
    return new Promise((resolve) => {
      console.log(`\n╭${'─'.repeat(62)}╮`);
      console.log(`│ Configuring: ${provider.name.padEnd(47)}│`);
      console.log(`╰${'─'.repeat(62)}╯`);

      rl.question(`\nEnter your ${provider.name} API key (or press Enter to skip): `, async (apiKey) => {
        const trimmedKey = apiKey.trim();

        if (!trimmedKey) {
          console.log(`⏭️  Skipped ${provider.name}`);
          resolve(false);
          return;
        }

        try {
          await this.configLoader.updateApiKey(this.config, provider.id, trimmedKey);
          console.log(`✓ ${provider.name} API key saved successfully!`);
          resolve(true);
        } catch (error) {
          console.log(`❌ Error saving API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
          resolve(false);
        }
      });
    });
  }

  /**
   * Configure a specific provider by ID (for /configure command)
   */
  async configureProvider(providerId: string): Promise<string> {
    const provider = this.config.providers.find(p => p.id === providerId);

    if (!provider) {
      throw new Error(`Provider "${providerId}" not found`);
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve, reject) => {
      const currentStatus = provider.apiKey ? 'configured' : 'not configured';
      console.log(`\n${provider.name} is currently ${currentStatus}`);

      const prompt = provider.apiKey
        ? `Enter new API key (or press Enter to keep current): `
        : `Enter ${provider.name} API key: `;

      rl.question(prompt, async (apiKey) => {
        rl.close();

        const trimmedKey = apiKey.trim();

        // If empty and already have a key, keep the current one
        if (!trimmedKey && provider.apiKey) {
          resolve('API key unchanged');
          return;
        }

        // If empty and no existing key, error
        if (!trimmedKey) {
          reject(new Error('API key cannot be empty'));
          return;
        }

        try {
          await this.configLoader.updateApiKey(this.config, provider.id, trimmedKey);
          resolve(`✓ ${provider.name} API key saved`);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Show all providers and their configuration status
   */
  getProvidersStatus(): string {
    let output = '\nProvider Configuration Status:\n';
    output += '─'.repeat(64) + '\n';

    for (const provider of this.config.providers) {
      const status = provider.apiKey ? '✓ Configured' : '✗ Not configured';
      const models = provider.models.length;
      output += `  ${provider.name.padEnd(15)} ${status.padEnd(20)} (${models} model${models !== 1 ? 's' : ''})\n`;
    }

    output += '─'.repeat(64) + '\n';
    output += '\nTo configure a provider, use: /configure <provider-id>\n';
    output += 'Available providers: ' + this.config.providers.map(p => p.id).join(', ') + '\n';

    return output;
  }
}