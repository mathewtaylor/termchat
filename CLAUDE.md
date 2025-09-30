# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TermChat is a terminal-based multi-provider AI chat application built with Bun and Ink (React-based TUI). It supports real-time streaming conversations with Anthropic Claude and OpenAI GPT models through a clean, interactive terminal interface.

## Commands

### Development
```bash
bun install           # Install dependencies
bun start             # Run the application (same as bun run src/index.ts)
```

### Configuration Setup
First-time setup runs automatically on launch if no API keys are configured. Alternatively:
```bash
cp config.example.json config.json
# Edit config.json to add API keys, or use /configure command in-app
```

## Architecture Overview

### UI Layer (Ink/React)

**Entry Point**: [src/index.ts](src/index.ts)
- Loads configuration and runs first-time setup if needed
- Clears screen and renders Ink UI using `render()`
- Passes ChatManager, CommandHandler, and config as props to React component

**ChatUI Component**: [src/components/ChatUI.tsx](src/components/ChatUI.tsx)
- Main React component for the TUI
- Uses Ink's `Box`, `Text`, `TextInput`, and `Spinner` components
- Manages local state for messages, input, and loading indicators
- Handles keyboard shortcuts (Ctrl+C to exit)
- Streams AI responses by updating message state in real-time
- Shows animated spinner while waiting for first AI response chunk

**Message Component**: [src/components/Message.tsx](src/components/Message.tsx)
- Displays individual messages with role-based colors (user/assistant/system)
- Maps ANSI color codes from theme config to Ink color names
- System messages have no prefix label for clean UI

### Core Services

**ChatManager**: [src/chat.ts](src/chat.ts)
- Provider-agnostic interface for sending messages
- Maintains conversation history with metadata (timestamps, token counts)
- Supports hot-swapping providers and models at runtime
- Streams responses via callback for real-time updates
- Calculates session costs based on token usage and model pricing

**CommandHandler**: [src/commands.ts](src/commands.ts)
- Slash command system: `/help`, `/model`, `/provider`, `/theme`, `/export`, `/setup`, `/clear`, `/cost`, etc.
- Handles runtime model/provider/theme switching without restart
- Clears conversation history when switching models or providers
- Exports conversations to timestamped files in `conversations/` directory

**SetupManager**: [src/setup.ts](src/setup.ts)
- Interactive first-time setup wizard
- Prompts user to configure providers by number selection (1, 2, or "all")
- Validates and saves API keys to config.json
- Also handles `/configure` and `/setup` commands for runtime configuration

### Configuration System

**ConfigLoader**: [src/config.ts](src/config.ts)
- Loads `config.json` (user settings) and merges with `src/defaults.json` (version-controlled)
- Separation of concerns: defaults.json has providers/models/themes, config.json has API keys + selections
- Automatically migrates legacy config format
- Validates configuration and provides helpful error messages
- Saves changes when user switches providers/models/themes

**Two-file system**:
- `src/defaults.json` - Version controlled, contains provider definitions, models, themes (shipped with app)
- `config.json` - Gitignored, contains API keys and user preferences (activeProvider, activeModel, activeTheme)

Structure:
```json
// config.json (UserConfig)
{
  "apiKeys": {
    "anthropic": "sk-...",
    "openai": "sk-..."
  },
  "activeProvider": "anthropic",
  "activeModel": { "id": "claude-sonnet-4-5-20250929", "display_name": "Claude Sonnet 4.5" },
  "activeTheme": "theme-1"
}
```

### Provider System

**ProviderFactory**: [src/providers/factory.ts](src/providers/factory.ts)
- Creates provider instances based on provider ID
- Currently supports: `anthropic`, `openai`

**BaseProvider**: [src/providers/base.ts](src/providers/base.ts)
- Abstract class defining provider interface
- All providers implement `sendMessage()` for streaming responses
- Returns usage data (inputTokens, outputTokens)

**Provider Implementations**:
- [src/providers/anthropic.ts](src/providers/anthropic.ts) - Uses @anthropic-ai/sdk
- [src/providers/openai.ts](src/providers/openai.ts) - Uses openai SDK

### Type Definitions

[src/types.ts](src/types.ts) contains TypeScript interfaces:
- `DefaultsConfig` - Structure of defaults.json (providers, themes)
- `UserConfig` - Structure of config.json (API keys, selections)
- `AppConfig` - Merged configuration used by application
- `Provider`, `ProviderDefinition`, `Model` - Multi-provider configuration
- `Theme`, `ThemeColors` - Color theme system
- `Message`, `MessageWithMetadata` - Chat history with metadata

## Key Architectural Patterns

### Hot-Swapping Without Restart
The application supports runtime changes to provider, model, and theme:
1. User executes command (e.g., `/model claude-opus-4-1-20250805`)
2. `CommandHandler` validates selection against available models
3. Config updated in memory and saved to `config.json` via ConfigLoader
4. `ChatManager.setProvider()` or `ChatManager.setModel()` updates active instance
5. For theme changes, `ChatUI.setTheme()` updates UI colors
6. Conversation history clears when switching models or providers (different contexts)

### React State-Based Streaming
AI responses stream in real-time using React state:
1. User submits message via TextInput component
2. Message added to state, empty AI message placeholder created
3. Loading spinner shown (just dots, no label)
4. `ChatManager.sendMessage()` called with callback
5. Each chunk updates the last message in state array
6. First chunk hides spinner, subsequent chunks accumulate
7. React re-renders on each state update, user sees text appear progressively

### Config Separation (Defaults vs User Settings)
- `defaults.json` is version controlled and contains provider/model definitions
- `config.json` is gitignored and contains user's API keys + selections
- ConfigLoader merges them on startup
- New providers/models can be added to defaults.json without affecting user configs
- Users never edit defaults.json, only config.json (or use /configure command)

### Provider Abstraction
All providers implement `BaseProvider.sendMessage()`:
- Accepts full conversation history array
- Streams responses via callback: `(chunk: StreamChunk) => void`
- Returns `{ response: string, usage: TokenUsage }`
- Each provider handles its own SDK, request format, and streaming implementation

## Development Notes

- **Runtime**: Bun (not Node.js)
- **UI Framework**: Ink 6.3.1 (React-based TUI, same as Claude Code uses)
- **No double-input issues**: Ink's TextInput handles input correctly (previous blessed library had bugs)
- **Word wrapping**: Handled automatically by Ink's TextInput component
- **Conversation exports**: Saved to `conversations/` directory (auto-created)
- **Token estimates**: Rough approximation (4 chars ≈ 1 token) for context limits
- **Intro ASCII art**: Optional `intro.txt` file displays on startup if present
- **Version**: Stored in [src/version.ts](src/version.ts)
- **Setup flow**: Automatic first-time setup if no API keys found, can re-run with `/setup` command