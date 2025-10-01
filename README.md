# TermChat

**Chat with AI directly from your terminal.**

TermChat is a lightweight, terminal-based chat interface for AI models. It's built for developers and power users who live in their terminal and want instant access to LLM assistance without context switching.

Supports multiple AI providers including **Anthropic** (Claude) and **OpenAI** (GPT).

## Why TermChat?

- **Stay in your workflow** - No need to switch to a browser or separate app
- **Lightning fast** - Launch and start chatting in seconds
- **Terminal native** - Feels like a natural part of your command-line toolkit
- **Streaming responses** - See answers appear in real-time
- **Conversation context** - Full chat history maintained throughout your session
- **Highly configurable** - Multiple models, custom themes, and instant switching

## Installation

### Global Installation (Recommended)

Install globally to use `termchat` or `tc` from anywhere:

```bash
# Using Bun (recommended)
bun install -g termchat

# Or using npm (requires Bun runtime)
npm install -g termchat
```

Then run:
```bash
termchat
# or use the short alias
tc
```

### From Source

```bash
# Clone the repository
git clone https://github.com/mathewtaylor/termchat.git
cd termchat

# Install dependencies
bun install

# Set up your config
cp config.example.json config.json
# Edit config.json and add your API key(s)

# Start chatting
bun start
```

On first run, you'll be guided through an interactive setup to configure your API keys.

For detailed setup and configuration instructions, see [DEVELOPMENT.md](DEVELOPMENT.md).

## Features

- 💬 Interactive streaming chat with AI models
- 🔄 Multiple AI providers (Anthropic & OpenAI) - switch instantly with `/provider`
- 🤖 Multiple models per provider - switch anytime with `/model`
- 🎨 5 color themes - switch anytime with `/theme`
- 📝 Export conversations to timestamped files
- ⚡ Hot-swapping - no restart needed for provider/model/theme changes
- 📊 Conversation statistics and token estimates

Type `/help` in the app to see all available commands.

## Requirements

- [Bun](https://bun.sh) runtime
- API key for at least one provider:
  - [Anthropic API key](https://console.anthropic.com/) (for Claude models)
  - [OpenAI API key](https://platform.openai.com/) (for GPT models)

## License

Apache License 2.0