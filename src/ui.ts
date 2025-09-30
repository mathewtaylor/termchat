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
   * Render the application header
   */
  renderHeader(modelName: string, providerName: string): string {
    const width = this.getTerminalWidth();
    const title = `🤖 Terminal Chat`;
    const info = `${modelName} │ ${providerName}`;
    const actions = `[/help] [/settings]`;

    // Calculate spacing
    const contentWidth = width - 4;
    const titleAndInfo = `${title} │ ${info}`;
    const padding = Math.max(1, contentWidth - titleAndInfo.length - actions.length);

    const headerContent = `${titleAndInfo}${' '.repeat(padding)}${actions}`;

    return [
      `┌${'─'.repeat(width - 2)}┐`,
      `│ ${this.truncate(headerContent, contentWidth)} │`,
      `├${'─'.repeat(width - 2)}┤`,
    ].join('\n');
  }

  /**
   * Render a message bubble
   */
  renderMessageBubble(message: MessageDisplay): string {
    const width = this.getTerminalWidth();
    const maxContentWidth = width - 6; // Account for borders and padding

    const role = message.role === 'user' ? 'You' : 'Claude';
    const time = this.formatTime(message.timestamp);

    // Create header line
    const headerDashes = '─'.repeat(Math.max(1, maxContentWidth - role.length - time.length - 5));
    const header = `─ ${role} ${headerDashes} ${time} ─`;

    // Wrap content
    const wrappedLines = this.wrapText(message.content, maxContentWidth);

    // Build bubble
    const lines: string[] = [];
    lines.push(`  ┌${header}┐`);

    for (const line of wrappedLines) {
      const padding = maxContentWidth - this.getDisplayLength(line);
      lines.push(`  │ ${line}${' '.repeat(Math.max(0, padding))} │`);
    }

    // Add streaming indicator if applicable
    if (message.isStreaming && message.tokenCount !== undefined) {
      const indicator = `[●] Streaming... (${message.tokenCount} tokens)`;
      const padding = maxContentWidth - indicator.length;
      lines.push(`  │ ${indicator}${' '.repeat(Math.max(0, padding))} │`);
    }

    lines.push(`  └${'─'.repeat(maxContentWidth + 2)}┘`);

    return lines.join('\n');
  }

  /**
   * Render the footer/input area
   */
  renderFooter(showHistory: boolean = false): string {
    const width = this.getTerminalWidth();
    const historyIndicator = showHistory ? '[↑ History]  ' : '';
    const promptText = `💬 Your message: `;

    const helpText = 'Press Enter to send • /exit to quit • /help for commands';
    const helpPadding = Math.max(0, width - 4 - helpText.length);

    return [
      `├${'─'.repeat(width - 2)}┤`,
      `│ ${promptText}${' '.repeat(Math.max(0, width - 4 - promptText.length - historyIndicator.length))}${historyIndicator}│`,
      `│ ${helpText}${' '.repeat(helpPadding)} │`,
      `└${'─'.repeat(width - 2)}┘`,
    ].join('\n');
  }

  /**
   * Render a separator line
   */
  renderSeparator(): string {
    const width = this.getTerminalWidth();
    return `├${'─'.repeat(width - 2)}┤`;
  }

  /**
   * Clear the screen
   */
  clearScreen(): void {
    process.stdout.write('\x1b[2J\x1b[0f');
  }

  /**
   * Format time as HH:MM AM/PM
   */
  private formatTime(date: Date): string {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  }

  /**
   * Wrap text to fit within a specified width
   */
  private wrapText(text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      if (paragraph.trim() === '') {
        lines.push('');
        continue;
      }

      const words = paragraph.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;

        if (this.getDisplayLength(testLine) <= maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            lines.push(currentLine);
          }

          // Handle very long words
          if (this.getDisplayLength(word) > maxWidth) {
            let remainingWord = word;
            while (this.getDisplayLength(remainingWord) > maxWidth) {
              lines.push(remainingWord.slice(0, maxWidth));
              remainingWord = remainingWord.slice(maxWidth);
            }
            currentLine = remainingWord;
          } else {
            currentLine = word;
          }
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }
    }

    return lines;
  }

  /**
   * Get display length of text (accounting for emoji and special chars)
   */
  private getDisplayLength(text: string): number {
    // Simple approach: count characters
    // Could be enhanced with better Unicode handling
    return text.length;
  }

  /**
   * Truncate text to fit width
   */
  private truncate(text: string, maxWidth: number): string {
    if (text.length <= maxWidth) {
      return text;
    }
    return text.slice(0, maxWidth - 3) + '...';
  }

  /**
   * Move cursor up N lines
   */
  moveCursorUp(lines: number): void {
    process.stdout.write(`\x1b[${lines}A`);
  }

  /**
   * Move cursor to beginning of line and clear
   */
  clearLine(): void {
    process.stdout.write('\x1b[2K\r');
  }

  /**
   * Render a simple info message
   */
  renderInfo(message: string): string {
    const width = this.getTerminalWidth();
    const padding = Math.max(0, width - 4 - message.length);
    return `│ ${message}${' '.repeat(padding)} │`;
  }

  /**
   * Render an error message
   */
  renderError(message: string): string {
    const width = this.getTerminalWidth();
    const errorText = `❌ ${message}`;
    const padding = Math.max(0, width - 4 - errorText.length);
    return `│ ${errorText}${' '.repeat(padding)} │`;
  }
}