/**
 * Command system for handling special user commands
 */

import type { AppConfig } from './types';
import { ChatManager } from './chat';
import { ConfigLoader } from './config';
import { UIRenderer } from './ui';
import { ProviderFactory } from './providers/factory';
import { writeFile, mkdir } from 'fs/promises';

export interface CommandResult {
  success: boolean;
  message: string;
  shouldExit?: boolean;
  shouldClearScreen?: boolean;
  shouldUpdatePrompt?: boolean;
  data?: any;
}

export class CommandHandler {
  private chatManager: ChatManager;
  private config: AppConfig;
  private configLoader: ConfigLoader;
  private ui: UIRenderer;

  constructor(chatManager: ChatManager, config: AppConfig, configLoader: ConfigLoader, ui: UIRenderer) {
    this.chatManager = chatManager;
    this.config = config;
    this.configLoader = configLoader;
    this.ui = ui;
  }

  /**
   * Check if input is a command
   */
  isCommand(input: string): boolean {
    return input.startsWith('/');
  }

  /**
   * Get list of available commands for autocomplete
   */
  getAvailableCommands(): Array<{ command: string; description: string }> {
    return [
      { command: '/help', description: 'Show this help message' },
      { command: '/exit', description: 'Exit the application' },
      { command: '/quit', description: 'Exit the application' },
      { command: '/clear', description: 'Clear conversation history' },
      { command: '/provider', description: 'Show current provider or switch providers' },
      { command: '/model', description: 'Show current model or switch models' },
      { command: '/theme', description: 'Show current theme or switch themes' },
      { command: '/export', description: 'Export conversation to file' },
      { command: '/history', description: 'Show conversation statistics' },
      { command: '/settings', description: 'Show current configuration' },
    ];
  }

  /**
   * Execute a command
   */
  async execute(input: string): Promise<CommandResult> {
    const parts = input.trim().split(/\s+/);
    const command = parts[0]?.toLowerCase() || '';
    const args = parts.slice(1);

    switch (command) {
      case '/exit':
      case '/quit':
        return this.handleExit();

      case '/clear':
        return this.handleClear();

      case '/help':
        return this.handleHelp();

      case '/provider':
      case '/providers':
        return await this.handleProvider(args);

      case '/model':
      case '/models':
        return await this.handleModel(args);

      case '/export':
        return await this.handleExport(args);

      case '/history':
        return this.handleHistory();

      case '/settings':
        return this.handleSettings();

      case '/theme':
      case '/themes':
        return await this.handleTheme(args);

      default:
        return {
          success: false,
          message: `Unknown command: ${command}. Type /help for available commands.`,
        };
    }
  }

  /**
   * Handle /exit command
   */
  private handleExit(): CommandResult {
    return {
      success: true,
      message: '👋 Goodbye!',
      shouldExit: true,
    };
  }

  /**
   * Handle /clear command
   */
  private handleClear(): CommandResult {
    this.chatManager.clearHistory();
    return {
      success: true,
      message: '✓ Conversation history cleared',
      shouldClearScreen: true,
    };
  }

  /**
   * Handle /help command
   */
  private handleHelp(): CommandResult {
    const helpText = `
Available Commands:
──────────────────────────────────────────────────────────────────

  /help                 Show this help message
  /exit or /quit        Exit the application
  /clear                Clear conversation history
  /provider [provider]  Show current provider or switch providers instantly
  /model [model-id]     Show current model or switch models instantly
  /theme [theme-id]     Show current theme or switch themes instantly
  /export [filename]    Export conversation to conversations/ folder (auto-timestamped)
  /history              Show conversation statistics
  /settings             Show current configuration

──────────────────────────────────────────────────────────────────
`;

    return {
      success: true,
      message: helpText,
    };
  }

  /**
   * Handle /provider command
   */
  private async handleProvider(args: string[]): Promise<CommandResult> {
    const currentProviderId = this.config.config.activeProvider;
    const currentProvider = this.config.providers.find(p => p.id === currentProviderId);

    // If no args, show current provider and available providers
    if (args.length === 0) {
      const providerList = this.config.providers
        .map(p => {
          const active = p.id === currentProviderId ? '* ' : '  ';
          const modelCount = p.models.length;
          return `${active}${p.name} (${p.id}) - ${modelCount} model${modelCount !== 1 ? 's' : ''}`;
        })
        .join('\n');

      return {
        success: true,
        message: `
Current Provider:
  ${currentProvider?.name || 'Unknown'} (${currentProviderId})

Available Providers:
${providerList}

To switch providers, use: /provider <provider-id>
`,
      };
    }

    // Provider switching implementation
    const providerId = args[0];

    // Validate provider exists
    const newProvider = this.config.providers.find(p => p.id === providerId);
    if (!newProvider) {
      return {
        success: false,
        message: `Provider "${providerId}" not found. Use /provider to see available providers.`,
      };
    }

    // Check if provider has an API key
    if (!newProvider.apiKey) {
      return {
        success: false,
        message: `Provider "${newProvider.name}" is missing an API key in config.json`,
      };
    }

    // Check if provider has models
    if (!newProvider.models || newProvider.models.length === 0) {
      return {
        success: false,
        message: `Provider "${newProvider.name}" has no models configured.`,
      };
    }

    try {
      // Update config in memory - switch to first model of new provider
      const firstModel = newProvider.models[0];
      this.config.config.activeProvider = newProvider.id;
      this.config.config.activeModel = {
        id: firstModel.id,
        display_name: firstModel.display_name,
      };

      // Save to file
      await this.configLoader.save(this.config);

      // Create new provider instance and hot-swap it
      const provider = ProviderFactory.createProvider(
        newProvider.id,
        newProvider.apiKey,
        firstModel.id
      );
      this.chatManager.setProvider(provider);

      // Clear conversation history (different providers have different contexts)
      this.chatManager.clearHistory();

      return {
        success: true,
        message: `✓ Switched to ${newProvider.name} (${firstModel.display_name})
  Conversation history has been cleared.`,
        shouldClearScreen: true,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to switch provider: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Handle /model command
   */
  private async handleModel(args: string[]): Promise<CommandResult> {
    const activeProvider = this.config.providers.find(
      p => p.id === this.config.config.activeProvider
    );

    if (!activeProvider) {
      return {
        success: false,
        message: 'Error: Could not find active provider',
      };
    }

    // If no args, show current model and available models
    if (args.length === 0) {
      const currentModel = this.config.config.activeModel;
      const availableModels = activeProvider.models
        .map(m => {
          const active = m.id === currentModel.id ? '* ' : '  ';
          return `${active}${m.display_name} (${m.id})`;
        })
        .join('\n');

      return {
        success: true,
        message: `
Current Provider: ${activeProvider.name}
Current Model: ${currentModel.display_name} (${currentModel.id})

Available Models (${activeProvider.name}):
${availableModels}

To switch models, use: /model <model-id>
To switch providers, use: /provider <provider-id>
`,
      };
    }

    // Model switching implementation
    const modelId = args[0];

    // Validate model exists
    const newModel = activeProvider.models.find(m => m.id === modelId);
    if (!newModel) {
      return {
        success: false,
        message: `Model "${modelId}" not found. Use /model to see available models.`,
      };
    }

    try {
      // Update config in memory
      this.config.config.activeModel = {
        id: newModel.id,
        display_name: newModel.display_name,
      };

      // Save to file
      await this.configLoader.save(this.config);

      // Update ChatManager with new model
      this.chatManager.setModel(newModel.id);

      // Clear conversation history (different models have different contexts)
      this.chatManager.clearHistory();

      return {
        success: true,
        message: `✓ Switched to ${newModel.display_name}\n  Conversation history has been cleared.`,
        shouldClearScreen: true,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to switch model: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Handle /export command
   */
  private async handleExport(args: string[]): Promise<CommandResult> {
    const history = this.chatManager.getHistory();

    if (history.length === 0) {
      return {
        success: false,
        message: 'No conversation to export',
      };
    }

    try {
      // Create conversations directory if it doesn't exist
      const conversationsDir = './conversations';
      await mkdir(conversationsDir, { recursive: true });

      // Generate timestamp-based filename if not provided
      let filename: string;
      if (args[0]) {
        // User provided custom filename, save in conversations folder
        filename = `${conversationsDir}/${args[0]}`;
      } else {
        // Generate default timestamp-based filename
        const now = new Date();
        const timestamp = now.getFullYear().toString() +
          (now.getMonth() + 1).toString().padStart(2, '0') +
          now.getDate().toString().padStart(2, '0') +
          now.getHours().toString().padStart(2, '0') +
          now.getMinutes().toString().padStart(2, '0') +
          now.getSeconds().toString().padStart(2, '0');
        filename = `${conversationsDir}/conversation-${timestamp}.txt`;
      }

      const content = this.formatHistoryForExport(history);
      await writeFile(filename, content, 'utf-8');

      return {
        success: true,
        message: `✓ Conversation exported to ${filename}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error exporting conversation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Handle /history command
   */
  private handleHistory(): CommandResult {
    const history = this.chatManager.getHistory();
    const messageCount = history.length;
    const userMessages = history.filter(m => m.role === 'user').length;
    const assistantMessages = history.filter(m => m.role === 'assistant').length;
    const tokenEstimate = this.chatManager.getTokenEstimate();

    return {
      success: true,
      message: `
Conversation Statistics:
────────────────────────────────────────────────────────────────
  Total messages:      ${messageCount}
  Your messages:       ${userMessages}
  Assistant messages:  ${assistantMessages}
  Estimated tokens:    ~${tokenEstimate.toLocaleString()}
────────────────────────────────────────────────────────────────
`,
    };
  }

  /**
   * Handle /settings command
   */
  private handleSettings(): CommandResult {
    const activeProvider = this.config.providers.find(
      p => p.id === this.config.config.activeProvider
    );

    const activeThemeId = this.config.config.activeTheme || 'None';
    const activeTheme = this.config.themes?.find(t => t.id === activeThemeId);
    const themeName = activeTheme?.name || 'No theme';

    return {
      success: true,
      message: `
Current Settings:
────────────────────────────────────────────────────────────────
  Provider:  ${activeProvider?.name || 'Unknown'}
  Model:     ${this.config.config.activeModel.display_name}
  Model ID:  ${this.config.config.activeModel.id}
  Theme:     ${themeName} (${activeThemeId})
────────────────────────────────────────────────────────────────
`,
    };
  }

  /**
   * Handle /theme command
   */
  private async handleTheme(args: string[]): Promise<CommandResult> {
    // If no args, show current theme and available themes
    if (args.length === 0) {
      const activeThemeId = this.config.config.activeTheme;
      const currentTheme = this.config.themes?.find(t => t.id === activeThemeId);
      const availableThemes = this.config.themes || [];

      if (availableThemes.length === 0) {
        return {
          success: true,
          message: `
Current Theme: ${currentTheme?.name || 'No theme configured'}

No themes available in configuration.
`,
        };
      }

      const themeList = availableThemes
        .map(t => {
          const active = t.id === activeThemeId ? '* ' : '  ';
          return `${active}${t.name} (${t.id}) - User: ${t.fontColours.user.name}, AI: ${t.fontColours.ai.name}`;
        })
        .join('\n');

      return {
        success: true,
        message: `
Current Theme: ${currentTheme?.name || 'No theme'}

Available Themes:
${themeList}

To switch themes, use: /theme <theme-id>
`,
      };
    }

    // Theme switching implementation
    const themeId = args[0];
    const availableThemes = this.config.themes || [];

    // Validate theme exists
    const newTheme = availableThemes.find(t => t.id === themeId);
    if (!newTheme) {
      return {
        success: false,
        message: `Theme "${themeId}" not found. Use /theme to see available themes.`,
      };
    }

    try {
      // Update config in memory
      this.config.config.activeTheme = themeId;

      // Save to file
      await this.configLoader.save(this.config);

      // Update UI renderer with new theme
      this.ui.setTheme(newTheme);

      return {
        success: true,
        message: `✓ Theme switched to "${newTheme.name}"`,
        shouldUpdatePrompt: true,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to switch theme: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Format conversation history for export
   */
  private formatHistoryForExport(history: Array<{ role: string; content: string; timestamp?: Date }>): string {
    const lines: string[] = [];
    lines.push('Terminal Chat Conversation Export');
    lines.push(`Exported: ${new Date().toISOString()}`);
    lines.push('='.repeat(70));
    lines.push('');

    for (const msg of history) {
      const timestamp = msg.timestamp ? ` [${msg.timestamp.toLocaleString()}]` : '';
      lines.push(`${msg.role.toUpperCase()}${timestamp}:`);
      lines.push(msg.content);
      lines.push('');
      lines.push('-'.repeat(70));
      lines.push('');
    }

    return lines.join('\n');
  }
}