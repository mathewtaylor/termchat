/**
 * UI rendering components for the terminal chat application
 */

export interface MessageDisplay {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokenCount?: number;
  isStreaming?: boolean;
}

export class UIRenderer {
  private terminalWidth: number;

  constructor() {
    this.terminalWidth = process.stdout.columns || 80;
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
   * Render a message (minimalist - no borders)
   */
  renderMessageBubble(message: MessageDisplay): string {
    const role = message.role === 'user' ? 'You' : 'Claude';
    const lines: string[] = [];

    // Role header
    lines.push(`${role}:`);

    // Content (preserve line breaks)
    lines.push(message.content);

    // Add streaming indicator if applicable
    if (message.isStreaming && message.tokenCount !== undefined) {
      lines.push(`... (${message.tokenCount} tokens)`);
    }

    return lines.join('\n');
  }

  /**
   * Render the footer separator (minimalist)
   */
  renderFooter(): string {
    const width = this.getTerminalWidth();
    return [
      '─'.repeat(Math.min(width, 60)),
      'Type /help for commands',
    ].join('\n');
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