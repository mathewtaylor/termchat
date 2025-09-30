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
    prompt: '💬 ',
  });

  // Display footer
  console.log(ui.renderFooter());

  // Show the prompt
  rl.prompt();

  rl.on('line', async (line: string) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

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

      console.log('');
      console.log(ui.renderFooter());
      rl.prompt();
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
    let lastLineCount = 0;

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

        const renderedBubble = ui.renderMessageBubble(streamingMessage);
        const lineCount = renderedBubble.split('\n').length;

        // Move cursor up to overwrite previous bubble
        if (lastLineCount > 0) {
          process.stdout.write(`\x1b[${lastLineCount}A`);
        }

        // Clear lines and render updated bubble
        for (let i = 0; i < lastLineCount; i++) {
          process.stdout.write('\x1b[2K\x1b[1B');
        }
        if (lastLineCount > 0) {
          process.stdout.write(`\x1b[${lastLineCount}A`);
        }

        console.log(renderedBubble);
        lastLineCount = lineCount;
      });

      // Final render without streaming indicator
      const finalMessage: MessageDisplay = {
        role: 'assistant',
        content: assistantContent,
        timestamp: assistantStartTime,
        tokenCount: currentTokenCount,
        isStreaming: false,
      };

      // Move up and clear the streaming version
      if (lastLineCount > 0) {
        process.stdout.write(`\x1b[${lastLineCount}A`);
        for (let i = 0; i < lastLineCount; i++) {
          process.stdout.write('\x1b[2K\x1b[1B');
        }
        process.stdout.write(`\x1b[${lastLineCount}A`);
      }

      // Render final version
      console.log(ui.renderMessageBubble(finalMessage));
      console.log('');

    } catch (error) {
      if (error instanceof Error) {
        console.log(ui.renderError(error.message));
      } else {
        console.log(ui.renderError('An unknown error occurred'));
      }
      console.log('');
    }

    // Redraw footer and show prompt
    console.log(ui.renderFooter());
    rl.prompt();
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