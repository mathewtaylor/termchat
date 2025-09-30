import * as readline from 'readline';
import { readFile } from 'fs/promises';
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

    // Try to display intro ASCII art if available
    try {
      const introText = await readFile('./intro.txt', 'utf-8');
      console.log(introText);
      console.log('');
    } catch {
      // Intro file not found, skip silently
    }

    // Show model info
    console.log(`Using: ${config.config.activeModel.display_name}`);
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
    console.log('Claude:');

    const assistantStartTime = new Date();
    let assistantContent = '';
    let isFirstChunk = true;

    try {
      await chatManager.sendMessage(input, (chunk, tokenCount) => {
        assistantContent += chunk;

        // Just write the chunk as it arrives
        process.stdout.write(chunk);
      });

      // Done streaming - add blank line
      console.log('\n');

    } catch (error) {
      console.log('');
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