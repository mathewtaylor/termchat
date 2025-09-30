/**
 * Command system for handling special user commands
 */

import type { AppConfig } from './types';
import { ChatManager } from './chat';
import { writeFile } from 'fs/promises';

export interface CommandResult {
  success: boolean;
  message: string;
  shouldExit?: boolean;
  shouldClearScreen?: boolean;
  data?: any;
}

export class CommandHandler {
  private chatManager: ChatManager;
  private config: AppConfig;

  constructor(chatManager: ChatManager, config: AppConfig) {
    this.chatManager = chatManager;
    this.config = config;
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
  /export [filename] Export conversation to a file (default: conversation.txt)
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
    const filename = args[0] || 'conversation.txt';
    const history = this.chatManager.getHistory();

    if (history.length === 0) {
      return {
        success: false,
        message: 'No conversation to export',
      };
    }

    try {
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

    return {
      success: true,
      message: `
Current Settings:
────────────────────────────────────────────────────────────────
  Provider:  ${activeProvider?.name || 'Unknown'}
  Model:     ${this.config.config.activeModel.display_name}
  Model ID:  ${this.config.config.activeModel.id}
────────────────────────────────────────────────────────────────
`,
    };
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