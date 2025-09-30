/**
 * UI rendering components for the terminal chat application
 */

import type { Theme } from './types';

export interface MessageDisplay {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokenCount?: number;
  isStreaming?: boolean;
}

export class UIRenderer {
  private terminalWidth: number;
  private theme?: Theme;
  private readonly RESET = '\x1b[0m';

  constructor(theme?: Theme) {
    this.terminalWidth = process.stdout.columns || 80;
    this.theme = theme;
  }

  /**
   * Get current terminal width
   */
  getTerminalWidth(): number {
    return process.stdout.columns || this.terminalWidth;
  }

  /**
   * Render the application header (minimalist)
   */
  renderHeader(modelName: string, providerName: string): string {
    return `🤖 TermChat  ${modelName}`;
  }

  /**
   * Render a message (minimalist - no borders, with theme colors)
   */
  renderMessageBubble(message: MessageDisplay): string {
    const role = message.role === 'user' ? 'You' : 'Claude';
    const lines: string[] = [];

    // Get color for this role
    const color = this.getColorForRole(message.role);

    // Role header with color
    lines.push(`${color}${role}:${this.RESET}`);

    // Content with color (preserve line breaks)
    lines.push(`${color}${message.content}${this.RESET}`);

    // Add streaming indicator if applicable
    if (message.isStreaming && message.tokenCount !== undefined) {
      lines.push(`${color}... (${message.tokenCount} tokens)${this.RESET}`);
    }

    return lines.join('\n');
  }

  /**
   * Get ANSI color code for a role
   */
  private getColorForRole(role: 'user' | 'assistant'): string {
    if (!this.theme) {
      return ''; // No theme, no color
    }

    if (role === 'user') {
      return this.theme.fontColours.user.value;
    } else {
      return this.theme.fontColours.ai.value;
    }
  }

  /**
   * Render the footer separator (minimalist)
   */
  renderFooter(): string {
    const width = this.getTerminalWidth();
    const helpText = 'Type /help for commands';
    const lineWidth = Math.min(width, 60);
    const padding = Math.floor((lineWidth - helpText.length) / 2);

    // Dim color for subtle separator
    const dim = '\x1b[2m';
    const reset = '\x1b[0m';

    // Center the help text above the line, then show line, then space
    const centeredHelp = ' '.repeat(Math.max(0, padding)) + helpText;
    const line = dim + '─'.repeat(lineWidth) + reset;

    return [centeredHelp, line, ''].join('\n');
  }

  /**
   * Clear the screen
   */
  clearScreen(): void {
    process.stdout.write('\x1b[2J\x1b[0f');
  }

  /**
   * Render an error message
   */
  renderError(message: string): string {
    return `❌ ${message}`;
  }
}