# Terminal Chat

A simple terminal-based chat application for interacting with Claude AI models using the Anthropic API.

## Features

- 💬 Interactive terminal chat interface
- 🔄 Streaming responses in real-time
- 📝 Conversation context maintained throughout session
- ⚙️ Configurable model selection
- 🔐 Secure API key management

## Setup

1. Install dependencies:
```bash
bun install
```

2. Create your config file:
```bash
cp config.example.json config.json
```

3. Edit `config.json` and add your Anthropic API key:
```json
{
  "providers": [
    {
      "id": "anthropic",
      "name": "Anthropic",
      "models": [...],
      "apiKey": "your-actual-api-key-here"
    }
  ],
  ...
}
```

## Usage

Start the chat application:
```bash
bun start
```

Or run directly:
```bash
bun run src/index.ts
```

### Commands

- Type your message and press Enter to chat
- Type `/exit` to quit the application

## Configuration

The `config.json` file supports:
- Multiple providers (currently Anthropic)
- Multiple models per provider
- Active provider and model selection

See `config.example.json` for the full configuration structure.

## Built with

- [Bun](https://bun.sh) - Fast JavaScript runtime
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) - Official TypeScript SDK
