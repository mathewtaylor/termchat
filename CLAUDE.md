# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TermChat is a terminal-based multi-provider AI chat application built with Bun. It supports real-time streaming conversations with Anthropic Claude and OpenAI GPT models through a terminal interface.

## Commands

### Development
```bash
bun install           # Install dependencies
bun start             # Run the application (same as bun run src/index.ts)
```

### Configuration Setup
```bash
cp config.example.json config.json
# Then edit config.json to add API keys for desired providers
```

## Architecture

### Core Components

**Entry Point**: [src/index.ts](src/index.ts)
- Application initialization and main event loop
- Sets up readline interface with command autocomplete
- Manages streaming response display with spinner and cursor control
- Handles graceful exit (Ctrl+C, Ctrl+D, /exit)

**ChatManager**: [src/chat.ts](src/chat.ts)
- Manages conversation history and message metadata (timestamps, token counts)
- Provider-agnostic interface for sending messages
- Supports hot-swapping providers and models at runtime
- Token estimation using rough approximation (4 chars ≈ 1 token)

**CommandHandler**: [src/commands.ts](src/commands.ts)
- Slash command system (`/help`, `/model`, `/provider`, `/theme`, `/export`, etc.)
- Handles runtime model/provider/theme switching without restart
- Clears conversation history when switching models or providers
- Exports conversations to timestamped files in `conversations/` directory

**ConfigLoader**: [src/config.ts](src/config.ts)
- Loads and validates `config.json`
- Saves configuration changes (model, provider, theme selections persist)
- Provides access to active provider, model, and theme

**UIRenderer**: [src/ui.ts](src/ui.ts)
- Terminal UI rendering with ANSI colors
- Theme management with 5 built-in color schemes
- Formats headers, footers, errors, and messages

### Provider System

**ProviderFactory**: [src/providers/factory.ts](src/providers/factory.ts)
- Creates provider instances based on provider ID
- Currently supports: `anthropic`, `openai`

**BaseProvider**: [src/providers/base.ts](src/providers/base.ts)
- Abstract class defining provider interface
- All providers implement `sendMessage()` for streaming responses
- Providers manage their own model IDs and can be hot-swapped

**Provider Implementations**:
- [src/providers/anthropic.ts](src/providers/anthropic.ts) - Anthropic Claude integration
- [src/providers/openai.ts](src/providers/openai.ts) - OpenAI GPT integration

### Type Definitions

[src/types.ts](src/types.ts) contains all TypeScript interfaces:
- `Provider`, `Model` - Multi-provider configuration
- `Theme`, `ThemeColors` - Color theme system
- `AppConfig`, `Config` - Application configuration
- `Message`, `MessageWithMetadata` - Chat history

### Configuration System

`config.json` structure:
```json
{
  "providers": [/* Provider configs with models and API keys */],
  "config": {
    "activeProvider": "provider-id",
    "activeModel": { "id": "...", "display_name": "..." },
    "activeTheme": "theme-id"
  },
  "themes": [/* Theme definitions */]
}
```

- Each provider has multiple models that can be switched on-the-fly
- Changes to active provider/model/theme persist to `config.json` automatically
- Switching models or providers clears conversation history

## Key Patterns

### Hot-Swapping
The application supports runtime changes to provider, model, and theme without restart:
1. User executes command (e.g., `/model claude-opus-4-1-20250805`)
2. `CommandHandler` validates new selection
3. Config updated in memory and saved to `config.json`
4. `ChatManager.setProvider()` or `ChatManager.setModel()` updates active instance
5. UI updates (theme) or history clears (model/provider)

### Streaming Display
1. User input submitted via readline
2. Processing flag set to ignore additional input
3. Spinner displayed while waiting for first chunk
4. Chunks streamed to stdout with ANSI colors
5. Cursor hidden during streaming, shown after completion
6. Processing flag cleared to accept new input

### Provider Abstraction
All providers implement `BaseProvider.sendMessage()` which:
- Accepts full conversation history
- Streams responses via callback with token counts
- Returns complete response text
- Each provider handles its own SDK integration and streaming format

## Development Notes

- Uses Bun runtime (not Node.js)
- Conversation exports saved to `conversations/` (auto-created)
- Token estimates are rough approximations (4 chars per token)
- `intro.txt` displays ASCII art at startup (optional file)
- Version number stored in [src/version.ts](src/version.ts)