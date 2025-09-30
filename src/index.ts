import * as readline from 'readline';
import { ConfigLoader } from './config';
import { ChatManager } from './chat';
import { UIRenderer, type MessageDisplay } from './ui';
import { CommandHandler } from './commands';
import type { AppConfig } from './types';

async function main() {
  // Load configuration
  let config: AppConfig;
  let chatManager: ChatManager;
  let ui: UIRenderer;
  let commandHandler: CommandHandler;

  try {
    const configLoader = new ConfigLoader();
    config = await configLoader.load();

    const activeProvider = configLoader.getActiveProvider(config);
    if (!activeProvider) {
      console.error('❌ Error: Could not find active provider');
      process.exit(1);
    }

    chatManager = new ChatManager(activeProvider.apiKey, config.config.activeModel.id);
    ui = new UIRenderer();
    commandHandler = new CommandHandler(chatManager, config);

    // Initial UI render
    ui.clearScreen();
    console.log(ui.renderHeader(config.config.activeModel.display_name, activeProvider.name));
    console.log('');
    console.log(ui.renderInfo('Welcome to Terminal Chat! Type /help for commands.'));
    console.log('');
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Configuration Error: ${error.message}`);
    } else {
      console.error('❌ An unknown error occurred loading configuration');
    }
    process.exit(1);
  }

  // Set up readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Display footer
  console.log(ui.renderFooter());

  // Move cursor to input position
  process.stdout.write('\x1b[2A'); // Move up 2 lines
  process.stdout.write('\x1b[19C'); // Move right to after "💬 Your message: "

  rl.on('line', async (line: string) => {
    const input = line.trim();

    if (!input) {
      // Redraw footer and reposition cursor
      process.stdout.write('\x1b[2A');
      process.stdout.write('\x1b[19C');
      return;
    }

    // Clear the input line and footer
    process.stdout.write('\x1b[2K\r'); // Clear current line
    process.stdout.write('\x1b[1B\x1b[2K\r'); // Move down and clear
    process.stdout.write('\x1b[1B\x1b[2K\r'); // Move down and clear
    process.stdout.write('\x1b[1B\x1b[2K\r'); // Move down and clear
    process.stdout.write('\x1b[3A'); // Move back up

    // Handle commands
    if (commandHandler.isCommand(input)) {
      try {
        const result = await commandHandler.execute(input);

        if (result.shouldClearScreen) {
          ui.clearScreen();
          console.log(ui.renderHeader(config.config.activeModel.display_name,
            config.providers.find(p => p.id === config.config.activeProvider)?.name || 'Unknown'));
          console.log('');
        }

        // Display command result
        if (result.message) {
          console.log(result.message);
        }

        if (result.shouldExit) {
          rl.close();
          process.exit(0);
        }
      } catch (error) {
        console.log(ui.renderError(error instanceof Error ? error.message : 'Command failed'));
      }

      console.log(ui.renderFooter());
      process.stdout.write('\x1b[2A');
      process.stdout.write('\x1b[19C');
      return;
    }

    // Display user message
    const userMessage: MessageDisplay = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    console.log(ui.renderMessageBubble(userMessage));
    console.log('');

    // Prepare for assistant response
    const assistantStartTime = new Date();
    let assistantContent = '';
    let currentTokenCount = 0;

    try {
      await chatManager.sendMessage(input, (chunk, tokenCount) => {
        assistantContent += chunk;
        currentTokenCount = tokenCount;

        // Update display (clear and redraw streaming message)
        const streamingMessage: MessageDisplay = {
          role: 'assistant',
          content: assistantContent,
          timestamp: assistantStartTime,
          tokenCount: currentTokenCount,
          isStreaming: true,
        };

        // Calculate how many lines to move up
        const renderedBubble = ui.renderMessageBubble(streamingMessage);
        const lineCount = renderedBubble.split('\n').length;

        // Move cursor up and clear
        if (assistantContent.length > chunk.length) {
          process.stdout.write(`\x1b[${lineCount}A`);
        }

        // Render the updated bubble
        process.stdout.write('\r' + renderedBubble + '\n');
      });

      // Final render without streaming indicator
      const finalMessage: MessageDisplay = {
        role: 'assistant',
        content: assistantContent,
        timestamp: assistantStartTime,
        tokenCount: currentTokenCount,
        isStreaming: false,
      };

      const finalBubble = ui.renderMessageBubble(finalMessage);
      const lineCount = finalBubble.split('\n').length;
      process.stdout.write(`\x1b[${lineCount + 1}A`);
      console.log(finalBubble);
      console.log('');

    } catch (error) {
      console.log('');
      if (error instanceof Error) {
        console.log(ui.renderError(error.message));
      } else {
        console.log(ui.renderError('An unknown error occurred'));
      }
      console.log('');
    }

    // Redraw footer and reposition cursor
    console.log(ui.renderFooter());
    process.stdout.write('\x1b[2A');
    process.stdout.write('\x1b[19C');
  });

  rl.on('close', () => {
    console.log('\n\n👋 Goodbye!');
    process.exit(0);
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n\n👋 Goodbye!');
    rl.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});