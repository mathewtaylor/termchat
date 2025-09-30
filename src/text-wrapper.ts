/**
 * Text wrapper utility for terminal output with word-boundary wrapping
 * Handles ANSI color codes and wraps text at word boundaries
 */

export class TextWrapper {
  private linePosition: number = 0;
  private maxWidth: number;
  private readonly rightMargin: number = 6; // chars from terminal edge
  private wordBuffer: string = ''; // Buffer for current word being built
  private lineBuffer: string = ''; // Buffer for current line being built

  constructor(terminalWidth: number = 80, initialPosition: number = 0) {
    // Ensure reasonable min width and apply right margin
    this.maxWidth = Math.max(40, terminalWidth - this.rightMargin);
    this.linePosition = initialPosition;
  }

  /**
   * Wrap text chunk at word boundaries
   * @param chunk Text chunk (plain text, no ANSI codes)
   * @returns Wrapped text with newlines inserted at word boundaries
   */
  wrapChunk(chunk: string): string {
    let result = '';

    for (let i = 0; i < chunk.length; i++) {
      const char = chunk[i];

      // Handle newlines in input
      if (char === '\n') {
        result += this.flushWord() + this.flushLine() + '\n';
        this.linePosition = 0;
        continue;
      }

      // Check if this is a space (word boundary)
      if (char === ' ') {
        // Flush current word to line buffer
        const word = this.flushWord();
        const wordLength = word.length;

        // Check if adding this word would exceed line width
        if (this.linePosition + wordLength > this.maxWidth && this.linePosition > 0) {
          // Wrap: output current line and start new one
          result += this.flushLine() + '\n';
          this.linePosition = 0;
          this.lineBuffer = word; // Start new line with this word
          this.linePosition = wordLength;
        } else {
          // Add word to current line
          this.lineBuffer += word;
          this.linePosition += wordLength;
        }

        // Add the space
        if (this.linePosition + 1 <= this.maxWidth) {
          this.lineBuffer += ' ';
          this.linePosition++;
        }
        continue;
      }

      // Regular character - add to word buffer
      this.wordBuffer += char;
    }

    // Flush word if it would exceed max width
    if (this.wordBuffer) {
      const wordLength = this.wordBuffer.length;

      // If word alone exceeds max width, flush it anyway (long word)
      if (wordLength > this.maxWidth) {
        result += this.flushWord();
        this.linePosition += wordLength;
      } else if (this.linePosition + wordLength > this.maxWidth && this.linePosition > 0) {
        // Current word would exceed line, wrap now
        result += this.flushLine() + '\n';
        this.linePosition = 0;
      }
    }

    // Output any complete lines from line buffer
    if (this.lineBuffer) {
      result += this.lineBuffer;
      this.lineBuffer = '';
    }

    return result;
  }

  /**
   * Flush any remaining buffered content
   */
  flush(): string {
    let result = this.flushWord();
    result += this.flushLine();
    return result;
  }

  /**
   * Flush current word buffer
   */
  private flushWord(): string {
    const word = this.wordBuffer;
    this.wordBuffer = '';
    return word;
  }

  /**
   * Flush current line buffer
   */
  private flushLine(): string {
    const line = this.lineBuffer;
    this.lineBuffer = '';
    return line;
  }

  /**
   * Reset line position (call at start of new message)
   */
  reset(initialPosition: number = 0): void {
    this.linePosition = initialPosition;
    this.wordBuffer = '';
    this.lineBuffer = '';
  }

  /**
   * Update max width when terminal is resized
   */
  updateWidth(terminalWidth: number): void {
    this.maxWidth = Math.max(40, terminalWidth - this.rightMargin);
  }
}