# QuickCLI (`quick`)

Switch AI coding assistant providers — Claude Code and OpenAI Codex — with a single command.

## Installation

```bash
npm install -g quickcli
```

Or download a binary directly from [GitHub Releases](https://github.com/quickcli/quick/releases).

## Quick Start

```bash
# Add a provider (interactive TUI wizard)
quick provider add

# Add a provider with flags
quick provider add privnode \
  --scope codex,claudecode \
  --base-url https://privnode.com/v1 \
  --api-key sk-xxx \
  --model gpt-5-codex

# Add a provider from a template
quick provider add --from-template privnode

# List providers
quick provider list

# Activate a provider (auto-creates and activates a profile)
quick use privnode

# Check current status
quick status

# Interactive TUI menu (bare invocation)
quick
```

## Commands

| Command | Description |
|---|---|
| `quick` | Open interactive TUI main menu |
| `quick provider add [name] [flags]` | Add a provider (TUI wizard or flags) |
| `quick provider list` | List all providers |
| `quick provider remove <name>` | Remove a provider |
| `quick template list` | List registry templates |
| `quick template preview <id>` | Preview a template |
| `quick profile create <name> [providers...]` | Create a profile |
| `quick profile list` | List profiles |
| `quick profile remove <name>` | Remove a profile |
| `quick use <name>` | Activate a profile or provider |
| `quick status` | Show active configuration |

## How It Works

`quick` writes provider configuration to:

| Tool | Files |
|---|---|
| Claude Code | `~/.claude/settings.json` (`env` key) + shell profile |
| Codex | `~/.codex/config.toml` + `~/.codex/auth.json` + shell profile |

Restart your shell (or `source ~/.zshrc`) after running `quick use` for environment variable changes to take effect.

## Provider Flags

| Flag | Description |
|---|---|
| `--scope` | Comma-separated: `codex`, `claudecode` (default: `codex`) |
| `--base-url` | Provider API base URL |
| `--api-key` | API key |
| `--model` | Default model |
| `--cc-opus` | Claude Code Opus model override |
| `--cc-haiku` | Claude Code Haiku model override |
| `--cc-sonnet` | Claude Code Sonnet model override |
| `--from-template` | Template ID or URL (mutually exclusive with manual flags) |

## Template Magic Syntax

Templates use `${--:"<question>":"<default>"}` placeholders. When you run `quick provider add --from-template <id>`, QuickCLI prompts you for each dynamic value:

```yaml
api_key: '${--:"Enter your API Key":""}'
model: '${--:"Default model":"gpt-5-codex"}'
```

## Configuration

Config is stored at:
- **Linux/macOS**: `~/.config/quickcli/config.yaml`
- **Windows**: `%APPDATA%\quickcli\config.yaml`

## License

GPL-v3

## Community
[Linux.do](https://linux.do)
