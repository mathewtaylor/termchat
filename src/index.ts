import * as readline from 'readline';
import { readFile } from 'fs/promises';
import { ConfigLoader } from './config';
import { ChatManager } from './chat';
import { UIRenderer, type MessageDisplay } from './ui';
import { CommandHandler } from './commands';
import { ProviderFactory } from './providers/factory';
import { SetupManager } from './setup';
import { TextWrapper } from './text-wrapper';
import { VERSION } from './version';
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

    // Check if first-time setup is needed
    if (configLoader.needsSetup(config)) {
      const setupManager = new SetupManager(config, configLoader);
      const setupSuccess = await setupManager.runFirstTimeSetup();

      if (!setupSuccess) {
        process.exit(1);
      }

      // Reload config after setup
      config = await configLoader.load();
    }

    const activeProvider = configLoader.getActiveProvider(config);
    if (!activeProvider) {
      console.error('❌ Error: Could not find active provider');
      process.exit(1);
    }

    const activeTheme = configLoader.getActiveTheme(config);

    // Create provider using factory
    const provider = ProviderFactory.createProvider(
      activeProvider.id,
      activeProvider.apiKey,
      config.config.activeModel.id
    );

    chatManager = new ChatManager(provider);
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

    // Show model info with robot emoji and version
    console.log(`🤖 ${config.config.activeModel.display_name}`);
    console.log(`v${VERSION}`);
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

  // Track whether exit was explicit (command or Ctrl+C)
  let explicitExit = false;

  // Track if currently processing to ignore input
  let isProcessing = false;

  // Show the prompt
  rl.prompt();

  rl.on('line', async (line: string) => {
    const input = line.trim();

    // Ignore input if currently processing a request
    if (isProcessing) {
      return;
    }

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
          explicitExit = true;
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

    // Mark as processing to ignore any new input
    isProcessing = true;

    // Display user's message with word wrapping
    console.log('');
    const userColor = ui.getUserColor();
    const reset = '\x1b[0m';

    // Wrap and display user input
    const userWrapper = new TextWrapper(process.stdout.columns || 80, 0);
    const wrappedUserInput = userWrapper.wrapChunk(input);
    const userLines = wrappedUserInput.split('\n');

    // Display user message with color
    console.log(`${userColor}💬 You:${reset}`);
    for (const line of userLines) {
      console.log(`${userColor}${line}${reset}`);
    }
    console.log(''); // Spacing before AI response

    // Prepare for assistant response
    const color = ui.getAIColor();
    process.stdout.write(`${color}🤖${reset}  `);

    // Hide cursor during loading
    process.stdout.write('\x1b[?25l');

    // Start loading spinner
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinnerIndex = 0;
    let firstChunk = true;

    const spinnerInterval = setInterval(() => {
      process.stdout.write(`\b${spinner[spinnerIndex]}`);
      spinnerIndex = (spinnerIndex + 1) % spinner.length;
    }, 80);

    const assistantStartTime = new Date();
    let assistantContent = '';

    // Create text wrapper for word-boundary wrapping
    // Account for the emoji and spaces at start of line (🤖 + 2 spaces = ~5 chars)
    const textWrapper = new TextWrapper(process.stdout.columns || 80, 5);

    try {
      await chatManager.sendMessage(input, (chunk, tokenCount) => {
        // On first chunk, clear spinner
        if (firstChunk) {
          clearInterval(spinnerInterval);
          process.stdout.write('\b '); // Erase spinner with space
          firstChunk = false;
        }

        assistantContent += chunk;

        // Wrap chunk at word boundaries
        const wrappedChunk = textWrapper.wrapChunk(chunk);

        // Apply color to each line
        const lines = wrappedChunk.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (i > 0) process.stdout.write('\n'); // Add newline between lines
          process.stdout.write(`${color}${lines[i]}${reset}`);
        }
      });

      // Done streaming - show cursor and allow new input
      console.log('\n\n');
      process.stdout.write('\x1b[?25h'); // Show cursor
      isProcessing = false;
      rl.prompt();

    } catch (error) {
      // Clear spinner if error occurs before first chunk
      clearInterval(spinnerInterval);
      process.stdout.write('\b \b'); // Erase spinner

      // Show cursor and allow new input
      process.stdout.write('\x1b[?25h');
      isProcessing = false;

      console.log('');
      if (error instanceof Error) {
        console.log(ui.renderError(error.message));
      } else {
        console.log(ui.renderError('An unknown error occurred'));
      }
      console.log('');

      // Show prompt
      rl.prompt();
    }
  });

  rl.on('close', () => {
    // Only print goodbye if it wasn't an explicit exit (handles Ctrl+D)
    if (!explicitExit) {
      console.log('\n\n👋 Goodbye!');
    }
    process.exit(0);
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    explicitExit = true;
    console.log('\n\n👋 Goodbye!');
    rl.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});