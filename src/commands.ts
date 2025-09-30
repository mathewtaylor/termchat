/**
 * Command system for handling special user commands
 */

import type { AppConfig } from './types';
import { ChatManager } from './chat';
import { ConfigLoader } from './config';
import { UIRenderer } from './ui';
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

      case '/model':
      case '/models':
        return this.handleModel(args);

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

  /help              Show this help message
  /exit or /quit     Exit the application
  /clear             Clear conversation history
  /model [name]      Show current model or switch to a different model
  /theme [theme-id]  Show current theme or switch themes instantly
  /export [filename] Export conversation to conversations/ folder (auto-timestamped)
  /history           Show conversation statistics
  /settings          Show current configuration

──────────────────────────────────────────────────────────────────
`;

    return {
      success: true,
      message: helpText,
    };
  }

  /**
   * Handle /model command
   */
  private handleModel(args: string[]): CommandResult {
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
        .map(m => `  • ${m.display_name} (${m.id})`)
        .join('\n');

      return {
        success: true,
        message: `
Current Model:
  ${currentModel.display_name} (${currentModel.id})

Available Models:
${availableModels}

To switch models, use: /model <model-id>
Note: Model switching requires app restart to take effect.
`,
      };
    }

    // Model switching would require config file update
    return {
      success: false,
      message: 'Model switching is not yet implemented. Please update config.json manually.',
    };
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