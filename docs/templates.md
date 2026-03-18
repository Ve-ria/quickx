# Templates

Templates are provider blueprints stored in the [QuickCLI GitHub repository](https://github.com/AmethystDev-Labs/QuickCLI/tree/main/templates).  
Running `quick config add --from-template <id>` fetches the template, prompts you for any dynamic values, and saves a ready-to-use config.

## Template registry

```
templates/
  amethyst/
    template.yaml
    config.toml          # optional — see TemplateFiles
  openai/
    template.yaml
  imsnake/
    template.yaml
```

## `template.yaml` fields

| Field | Required | Description |
|---|---|---|
| `id` | ✓ | Unique identifier, must match directory name |
| `display_name` | ✓ | Human-readable name shown in the TUI |
| `scope` | ✓ | `[codex]`, `[claudecode]`, or both |
| `base_url` | | Provider API base URL |
| `api_key` | | API key (use magic syntax for user-supplied keys) |
| `model` | | Default model name |
| `wire_api` | | `responses` (default) or `chat` |
| `auth_method` | | `api_key` (default), `chatgpt`, `aws`, `gcp`, `azure` |
| `docs_url` | | Link to provider documentation |
| `required_envs` | | Environment variables the user must export (list) |
| `reasoning_effort` | | Codex reasoning effort preset (see below) |
| `model_verbosity` | | Codex verbosity preset |
| `codex_toml_file` | | Filename of an extra Codex config to merge — see [TemplateFiles](./template-files.md) |

## Magic syntax for dynamic fields

Placeholders that prompt the user at config-creation time:

```
${--:"Question shown to user":"default value"}
```

Leave the default empty `""` if there is no sensible default.  
The TUI wizard automatically masks the input when the question text contains the word `key`, `secret`, or `token`.

### Example `template.yaml`

```yaml
id: myprovider
display_name: My Provider
scope:
  - codex
base_url: https://api.myprovider.com/v1
api_key: '${--:"My Provider API Key":""}'
model: '${--:"Default model":"gpt-5-codex"}'
wire_api: responses
auth_method: api_key
reasoning_effort: '${--:"Reasoning effort (minimal/low/medium/high/xhigh)":"high"}'
docs_url: https://docs.myprovider.com
codex_toml_file: config.toml   # optional — attach extra Codex settings
```

## Fetching behaviour

When you run `quick template list` or `quick config add`:

1. QuickCLI tries to fetch the latest template index from GitHub.
2. On network failure it falls back to the local cache (valid for 1 hour).
3. If both fail, it falls back to built-in templates bundled with the binary.

When applying a template (`quick config add --from-template <id>`), QuickCLI additionally fetches the file named in `codex_toml_file` (if declared) and stores its content in the config for use on every `quick use`.

## Contributing a template

1. Fork [AmethystDev-Labs/QuickCLI](https://github.com/AmethystDev-Labs/QuickCLI).
2. Create `templates/<your-id>/template.yaml` following the schema above.
3. Open a pull request with a brief description of the provider.

**Rules**
- `scope` must be accurate — don't add `claudecode` to a Codex-only provider.
- `api_key` must use magic syntax if users supply their own key.
- Do not include real API keys or secrets.
- Template ID must be lowercase with hyphens only (no spaces or special characters).

> **Tip:** Use the [Template Builder](../webground/README.md) web UI to generate `template.yaml` and `config.toml` files without writing YAML by hand.
