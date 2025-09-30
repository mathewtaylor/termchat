import * as readline from 'readline';
import { ConfigLoader } from './config';
import { ChatManager } from './chat';

async function main() {
  console.log('🤖 Terminal Chat - Starting...\n');

  // Load configuration
  let config;
  let chatManager: ChatManager;

  try {
    const configLoader = new ConfigLoader();
    config = await configLoader.load();

    const activeProvider = configLoader.getActiveProvider(config);
    if (!activeProvider) {
      console.error('❌ Error: Could not find active provider');
      process.exit(1);
    }

    console.log(`✓ Connected to: ${config.config.activeModel.display_name}`);
    console.log(`✓ Provider: ${activeProvider.name}\n`);
    console.log('Type your message and press Enter. Type /exit to quit.\n');
    console.log('─'.repeat(50));
    console.log();

    chatManager = new ChatManager(activeProvider.apiKey, config.config.activeModel.id);
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
    prompt: '\n💬 You: ',
  });

  rl.prompt();

  rl.on('line', async (line: string) => {
    const input = line.trim();

    // Check for exit command (only if it's the first text)
    if (input === '/exit') {
      console.log('\n👋 Goodbye!');
      rl.close();
      process.exit(0);
    }

    if (!input) {
      rl.prompt();
      return;
    }

    try {
      process.stdout.write('\n🤖 Assistant: ');

      await chatManager.sendMessage(input, (chunk) => {
        process.stdout.write(chunk);
      });

      console.log('\n');
      console.log('─'.repeat(50));
    } catch (error) {
      console.log('\n');
      if (error instanceof Error) {
        console.error(`\n❌ ${error.message}`);
      } else {
        console.error('\n❌ An unknown error occurred');
      }
      console.log('─'.repeat(50));
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\n👋 Goodbye!');
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});