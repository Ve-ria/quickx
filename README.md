# QuickCLI (`quick`)

[![Release](https://github.com/AmethystDev-Labs/QuickCLI/actions/workflows/release.yml/badge.svg)](https://github.com/AmethystDev-Labs/QuickCLI/actions/workflows/release.yml)
[![npm version](https://img.shields.io/npm/v/@amethyst-labs/quickcli)](https://www.npmjs.com/package/@amethyst-labs/quickcli)
[![npm downloads](https://img.shields.io/npm/dm/@amethyst-labs/quickcli)](https://www.npmjs.com/package/@amethyst-labs/quickcli)
[![Node.js ≥16](https://img.shields.io/node/v/@amethyst-labs/quickcli)](https://nodejs.org)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

Switch AI coding assistant providers — Claude Code, OpenAI Codex, and OpenCode — with a single command.

## Documentation

| Guide | Description |
|---|---|
| [Installation](docs/installation.md) | npm, pre-built binaries, build from source |
| [Commands](docs/commands.md) | Full CLI command reference |
| [Configuration](docs/configuration.md) | Config file schema and what QuickCLI writes |
| [Templates](docs/templates.md) | Template registry and magic syntax |
| [TemplateFiles](docs/template-files.md) | Shipping extra Codex config with a template |
| [Login](docs/login.md) | ChatGPT OAuth browser & device-code flows |
| [Contributing](docs/contributing.md) | Add templates or contribute code |

## Installation

```bash
npm install -g @amethyst-labs/quickcli
```

Or download a packed npm package from [GitHub Releases](https://github.com/AmethystDev-Labs/QuickCLI/releases).

## Quick Start

```bash
# Interactive TUI menu (bare invocation)
quick

# Add a config (interactive TUI wizard)
quick config add

# Add a config with flags
quick config add privnode \
  --scope codex,claudecode \
  --base-url https://privnode.com/v1 \
  --api-key sk-xxx \
  --model gpt-5-codex

# Add a config from a template
quick config add --from-template openai

# Log in with ChatGPT (creates a Codex config automatically)
quick config login
quick config login --device   # SSH / headless environments

# List configs
quick config list

# Activate a config
quick use privnode

# Check current status
quick status
```

## Commands

| Command | Description |
|---|---|
| `quick` | Open interactive TUI main menu |
| `quick config add [name] [flags]` | Add a config (TUI wizard or flags) |
| `quick config list` | List all configs |
| `quick config remove <name>` | Remove a config |
| `quick config login [name]` | Log in with ChatGPT and create a Codex config |
| `quick template list` | List registry templates |
| `quick template preview <id>` | Preview a template |
| `quick use <config-name>` | Activate a config |
| `quick status` | Show active configuration |

## How It Works

`quick` writes configuration to:

| Tool | Files |
|---|---|
| Claude Code | `~/.claude/settings.json` (`env` key) + shell profile |
| Codex | `~/.codex/config.toml` + `~/.codex/auth.json` + shell profile |
| OpenCode | `~/.config/opencode/opencode.json` or an existing `*.jsonc` / `*.json` main config in `~/.config/opencode/` |

Restart your shell (or `source ~/.zshrc`) after running `quick use` for environment variable changes to take effect.

## Config Flags

| Flag | Description |
|---|---|
| `--scope` | Comma-separated: `codex`, `claudecode`, `opencode` (default: `codex`) |
| `--base-url` | Provider API base URL |
| `--api-key` | API key |
| `--model` | Default model |
| `--wire-api` | `responses` or `chat` |
| `--auth-method` | `api_key`, `chatgpt`, `aws`, `gcp`, `azure` |
| `--from-template` | Template ID (mutually exclusive with manual flags) |

## Template Magic Syntax

Templates use `${--:"<question>":"<default>"}` placeholders. When you run `quick config add --from-template <id>`, QuickCLI prompts you for each dynamic value:

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
