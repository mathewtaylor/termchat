# TermChat Development Guide

This guide contains technical setup, configuration, and usage information for TermChat developers and contributors.

## Prerequisites

- [Bun](https://bun.sh) - Fast JavaScript runtime
- Anthropic API key

## Setup

1. **Install dependencies:**
```bash
bun install
```

2. **Create your config file:**
```bash
cp config.example.json config.json
```

3. **Add your Anthropic API key:**

Edit `config.json` and add your API key:
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

## Running the Application

Start the chat application:
```bash
bun start
```

Or run directly:
```bash
bun run src/index.ts
```

## Usage

### Basic Chat

- Type your message and press Enter to chat with Claude
- Messages stream in real-time as the AI responds
- Conversation context is maintained throughout your session

### Available Commands

TermChat includes several slash commands for controlling the application:

| Command | Description |
|---------|-------------|
| `/help` | Show list of available commands |
| `/exit` or `/quit` | Exit the application |
| `/clear` | Clear conversation history |
| `/model [model-id]` | Show current model or switch to a different model |
| `/theme [theme-id]` | Show current theme or switch color themes |
| `/export [filename]` | Export conversation to `conversations/` folder |
| `/history` | Show conversation statistics (message count, token estimate) |
| `/settings` | Show current configuration (provider, model, theme) |

### Command Examples

**Switch models:**
```
/model claude-opus-4-1-20250805
```

**Switch themes:**
```
/theme theme-2
```

**Export conversation:**
```
/export my-conversation.txt
```
Or let it auto-generate a timestamped filename:
```
/export
```

## Configuration

The `config.json` file controls all aspects of TermChat:

### Structure

```json
{
  "providers": [
    {
      "id": "anthropic",
      "name": "Anthropic",
      "models": [
        {
          "id": "claude-sonnet-4-5-20250929",
          "display_name": "Claude Sonnet 4.5"
        }
      ],
      "apiKey": "your-api-key"
    }
  ],
  "config": {
    "activeProvider": "anthropic",
    "activeModel": {
      "id": "claude-sonnet-4-5-20250929",
      "display_name": "Claude Sonnet 4.5"
    },
    "activeTheme": "theme-1"
  },
  "themes": [...]
}
```

### Providers

Configure multiple AI providers (currently supports Anthropic):
- `id`: Unique identifier for the provider
- `name`: Display name
- `models`: Array of available models
- `apiKey`: Your API key for this provider

### Active Configuration

- `activeProvider`: Which provider to use
- `activeModel`: Which model to use (id and display_name)
- `activeTheme`: Which color theme to use (references theme id)

### Themes

TermChat includes 5 built-in color themes:
- `theme-1`: Classic (Cyan/Green)
- `theme-2`: High Contrast (Bright Blue/Yellow)
- `theme-3`: Modern (Magenta/Cyan)
- `theme-4`: Traditional (Bright White/Bright Green)
- `theme-5`: Soft (Bright Cyan/Bright Magenta)

You can switch themes on-the-fly using `/theme <theme-id>` without restarting the app.

## Project Structure

```
termchat/
├── src/
│   ├── index.ts       # Main application entry point
│   ├── chat.ts        # ChatManager - handles API communication
│   ├── commands.ts    # CommandHandler - processes slash commands
│   ├── config.ts      # ConfigLoader - loads and validates config
│   ├── ui.ts          # UIRenderer - terminal UI rendering
│   └── types.ts       # TypeScript type definitions
├── config.json        # Your configuration (not in git)
├── config.example.json # Example configuration template
└── conversations/     # Exported conversations (auto-created)
```

## Built With

- [Bun](https://bun.sh) - Fast JavaScript runtime and package manager
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) - Official TypeScript SDK for Claude API
- Node.js `readline` - Terminal input/output interface
- ANSI escape codes - Terminal colors and formatting

## Development Tips

- Model and theme changes persist to `config.json` automatically
- Conversation history is cleared when switching models
- Exported conversations are timestamped automatically if no filename is provided
- Token estimates use ~4 characters per token (rough approximation)