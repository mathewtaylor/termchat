import React from 'react';
import { render } from 'ink';
import { readFile } from 'fs/promises';
import { ConfigLoader } from './config';
import { ChatManager } from './chat';
import { UIRenderer } from './ui';
import { CommandHandler } from './commands';
import { ProviderFactory } from './providers/factory';
import { SetupManager } from './setup';
import { ChatUI } from './components/ChatUI';
import { VERSION } from './version';
import type { AppConfig } from './types';

async function main() {
  // Load configuration
  let config: AppConfig;
  let chatManager: ChatManager;
  let ui: UIRenderer;
  let commandHandler: CommandHandler;
  let configLoader: ConfigLoader;

  try {
    configLoader = new ConfigLoader();
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

    // Prepare welcome message
    let welcomeMessage = `Welcome to TermChat v${VERSION}!\nType your message below or /help for commands.`;
    try {
      const introText = await readFile('./intro.txt', 'utf-8');
      welcomeMessage = introText;
    } catch {
      // Intro file not found, use default welcome message
    }

    // Render the Ink UI
    render(
      React.createElement(ChatUI, {
        chatManager,
        config,
        theme: activeTheme,
        commandHandler,
        welcomeMessage,
      })
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Configuration Error: ${error.message}`);
    } else {
      console.error('❌ An unknown error occurred loading configuration');
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});