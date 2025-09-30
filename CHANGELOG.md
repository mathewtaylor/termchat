# Changelog

All notable changes to TermChat will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-01-30

### Added
- Real-time word wrapping while typing
- Real-time token usage tracking in status bar
- Session cost calculation and display
- Model name display in status bar
- Horizontal separator line below intro
- Enhanced loading indicators with proper alignment
- Right-aligned timestamps on messages

### Changed
- **Major UI redesign**: Migrated from readline to Ink/React framework
- Complete chat interface overhaul with separated history and input areas
- Message display now shows clean role labels (You/AI) instead of emojis
- System messages styled with off-white color
- Status bar now shows keyboard shortcuts and model info
- Input box with proper placeholder text
- Improved visual consistency with gray borders throughout

### Fixed
- Configuration system now properly merges pricing data from defaults
- Word wrapping works correctly during typing (not just after submission)
- Input text no longer displays twice
- Gaps between UI sections eliminated

### Technical
- React-based component architecture (ChatUI, Message components)
- State-based streaming for AI responses
- Better error handling and edge cases
- Improved token tracking accuracy

## [1.1.0] - 2024-12-15

### Added
- OpenAI provider support with 4 models:
  - GPT-5
  - GPT-5 Mini
  - GPT-5 Nano
  - GPT-5 Codex
- Hot-swapping between providers at runtime
- Interactive first-time setup wizard
- Numbered provider selection in setup
- Configuration migration support

### Changed
- Provider-agnostic chat interface
- Enhanced configuration system with provider separation
- Better provider management commands

## [1.0.0] - 2024-11-01

### Added
- Initial release
- Anthropic Claude integration:
  - Claude Sonnet 4.5
  - Claude Opus 4.1
- Real-time streaming responses
- Conversation history management
- Token usage tracking and estimation
- Cost calculation based on model pricing
- 5 color themes for customization
- Slash command system:
  - `/help` - Show available commands
  - `/clear` - Clear conversation history
  - `/export` - Export conversation to file
  - `/model` - Switch AI model
  - `/provider` - Switch provider
  - `/theme` - Change color theme
  - `/history` - View conversation stats
  - `/cost` - Show session cost breakdown
  - `/version` - Show version information
  - `/exit` - Exit application
- Export conversations to timestamped files
- Configuration management via config.json
- Terminal-based chat interface
- Graceful error handling
