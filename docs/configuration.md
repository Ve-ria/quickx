# Configuration Reference

## Config file location

QuickCLI stores its own configuration at:

| Platform | Path |
|---|---|
| Linux / macOS | `~/.config/quickcli/config.yaml` |
| Windows | `%APPDATA%\quickcli\config.yaml` |

## Config schema

```yaml
active_config: myprovider      # currently active config name

configs:
  - name: myprovider
    display_name: My Provider
    scope: [codex]             # "codex", "claudecode", or both

    # Connection
    base_url: https://api.example.com/v1
    api_key: sk-xxx
    model: gpt-5-codex

    # Codex-specific
    wire_api: responses        # "responses" (default) or "chat"

    # Auth
    auth_method: api_key       # "api_key" | "chatgpt" | "aws" | "gcp" | "azure"

    # Inference options (written to ~/.codex/config.toml)
    reasoning_effort: high     # minimal | low | medium | high | xhigh
    model_verbosity: medium    # low | medium | high

    # Template reference (set automatically when created from a template)
    template_id: amethyst

    # Extra Codex config from a template's codex_toml_file (raw TOML string)
    codex_toml_content: ""
```

## What QuickCLI writes on `quick use`

### `~/.codex/config.toml`

```toml
# QuickCLI-managed block (always regenerated)
model_provider = "myprovider"
model = "gpt-5-codex"
model_reasoning_effort = "high"
model_verbosity = "medium"
disable_response_storage = true

[model_providers.myprovider]
name = "My Provider"
base_url = "https://api.example.com/v1"
wire_api = "responses"
requires_openai_auth = true

# User-preserved sections (not touched by QuickCLI) are kept below.
# If the config was created from a template with codex_toml_file,
# its contents are schema-aware merged here.
```

### `~/.claude/settings.json`

```json
{
  "env": {
    "ANTHROPIC_API_KEY": "sk-ant-xxx",
    "ANTHROPIC_BASE_URL": "https://api.example.com/v1"
  }
}
```

### Shell profile (`.zshrc` / `.bashrc` / PowerShell profile)

```bash
export OPENAI_API_KEY="sk-xxx"
export OPENAI_BASE_URL="https://api.example.com/v1"
export ANTHROPIC_API_KEY="sk-ant-xxx"
export ANTHROPIC_BASE_URL="https://api.example.com/v1"
```

## Key concepts

### Scope

Each config declares which tools it applies to:

| Scope value | Tool |
|---|---|
| `codex` | OpenAI Codex CLI |
| `claudecode` | Anthropic Claude Code |

A config can have both scopes (e.g. a proxy that speaks both APIs).

### Reasoning effort

Maps to Codex's `model_reasoning_effort` key:

| Value | Behaviour |
|---|---|
| `minimal` | Fastest, least reasoning |
| `low` | — |
| `medium` | Balanced |
| `high` | Default |
| `xhigh` | Maximum (model-dependent) |

### Wire API

| Value | Description |
|---|---|
| `responses` | OpenAI Responses API (default, recommended) |
| `chat` | Chat Completions API (for legacy / non-OpenAI providers) |
