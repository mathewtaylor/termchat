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

    const activeTheme = configLoader.getActiveTheme(config);

    chatManager = new ChatManager(activeProvider.apiKey, config.config.activeModel.id);
    ui = new UIRenderer(activeTheme);
    commandHandler = new CommandHandler(chatManager, config, configLoader, ui);

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

    // Show model info with robot emoji
    console.log(`🤖 ${config.config.activeModel.display_name}`);
    console.log('');
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Configuration Error: ${error.message}`);
    } else {
      console.error('❌ An unknown error occurred loading configuration');
    }
    process.exit(1);
  }

  // Set up readline interface with colored prompt and autocomplete
  const userColor = ui.getUserColor();
  const reset = '\x1b[0m';

  // Completer function for command autocomplete
  const completer = (line: string): [string[], string] => {
    const commands = commandHandler.getAvailableCommands();
    const completions = commands.map(c => c.command);
    const hits = completions.filter(c => c.startsWith(line));

    // Show all commands if the line is empty or just "/"
    return [hits.length > 0 ? hits : (line === '/' || line === '' ? completions : []), line];
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${userColor}💬 ${reset}`,
    completer: completer,
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

        if (result.shouldUpdatePrompt) {
          const newUserColor = ui.getUserColor();
          const reset = '\x1b[0m';
          rl.setPrompt(`${newUserColor}💬 ${reset}`);
        }
      } catch (error) {
        console.log(ui.renderError(error instanceof Error ? error.message : 'Command failed'));
      }

      console.log('');
      rl.prompt();
      return;
    }

    // Prepare for assistant response (no need to echo user input, they just typed it)
    console.log(''); // Add spacing before AI response
    const color = ui.getAIColor();
    const reset = '\x1b[0m';
    process.stdout.write(`${color}🤖${reset} `);

    const assistantStartTime = new Date();
    let assistantContent = '';

    try {
      await chatManager.sendMessage(input, (chunk, tokenCount) => {
        assistantContent += chunk;

        // Write chunk with color
        process.stdout.write(`${color}${chunk}${reset}`);
      });

      // Done streaming - add spacing
      console.log('\n\n');

    } catch (error) {
      console.log('');
      if (error instanceof Error) {
        console.log(ui.renderError(error.message));
      } else {
        console.log(ui.renderError('An unknown error occurred'));
      }
      console.log('');
    }

    // Show prompt
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