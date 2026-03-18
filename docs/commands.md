# Command Reference

## Global

| Command | Description |
|---|---|
| `quick` | Open the interactive TUI main menu |
| `quick --version` | Print version information |
| `quick --help` | Show help for any command |

---

## `quick config`

Manage named provider configurations.

### `quick config add [name] [flags]`

Add a new config.  Calling without flags launches the interactive TUI wizard.

```bash
# Interactive TUI wizard
quick config add

# From a registry template (wizard fills dynamic fields)
quick config add --from-template amethyst

# Fully non-interactive
quick config add myprovider \
  --scope codex \
  --base-url https://api.example.com/v1 \
  --api-key sk-xxx \
  --model gpt-5-codex
```

**Flags**

| Flag | Type | Description |
|---|---|---|
| `--scope` | string | Comma-separated: `codex`, `claudecode` (default: `codex`) |
| `--base-url` | string | Provider API base URL |
| `--api-key` | string | API key |
| `--model` | string | Default model name |
| `--wire-api` | string | Wire protocol: `responses` (default) or `chat` |
| `--auth-method` | string | `api_key` (default), `chatgpt`, `aws`, `gcp`, `azure` |
| `--from-template` | string | Template ID — mutually exclusive with manual flags |

---

### `quick config list`

List all saved configs and highlight the active one.

```bash
quick config list
```

---

### `quick config remove <name>`

Delete a saved config by name.

```bash
quick config remove myprovider
```

---

### `quick config login [name]`

Log in with ChatGPT (OAuth PKCE browser flow) and automatically create a Codex config.

```bash
# Browser-based login
quick config login

# Device-code flow for SSH / headless environments
quick config login --device

# Specify a custom config name
quick config login myaccount
quick config login myaccount --device
```

See [Login Guide](./login.md) for the full authentication flow.

---

## `quick template`

Browse and preview the community template registry.

### `quick template list`

Fetch and display all available templates (GitHub registry + built-ins).

```bash
quick template list
```

### `quick template preview <id>`

Preview a template's fields and metadata before creating a config from it.

```bash
quick template preview amethyst
quick template preview openai
```

---

## `quick use <name>`

Activate a saved config and write all tool configuration files.

```bash
quick use myprovider
```

After activation QuickCLI writes:
- `~/.codex/config.toml` — Codex provider + inference settings
- `~/.codex/auth.json` — API key or OAuth tokens
- `~/.claude/settings.json` — Claude Code API key
- Shell profile (`~/.zshrc`, `~/.bashrc`, etc.) — `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`

**Restart your shell** (or `source ~/.zshrc`) for environment variable changes to take effect.

---

## `quick status`

Show the currently active config and what it controls.

```bash
quick status
```

---

## Shell auto-completion

```bash
quick completion zsh    # Zsh
quick completion bash   # Bash
quick completion fish   # Fish
quick completion powershell   # PowerShell
```
