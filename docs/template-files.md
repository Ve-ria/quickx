# TemplateFiles

TemplateFiles lets a template ship an optional `config.toml` alongside its `template.yaml`.  
When you activate a config that was created from such a template, QuickCLI schema-aware merges that extra TOML into your `~/.codex/config.toml`.

## Motivation

`template.yaml` covers the basics — provider URL, API key, model, wire protocol.  
But Codex has dozens of additional settings (MCP servers, features, sandbox policy, history, …) that a template author may want to pre-configure.  
Rather than stuffing those into `template.yaml`, `codex_toml_file` lets you ship a real TOML file with full Codex config syntax and comments.

## How to declare it

In `template.yaml`, add:

```yaml
codex_toml_file: config.toml
```

The value is a filename relative to the template's directory on GitHub.  
QuickCLI fetches it when the template is applied (not when the template list is browsed).

## Example template directory

```
templates/my-provider/
  template.yaml          ← declares codex_toml_file: config.toml
  config.toml            ← extra Codex settings
```

```toml
# templates/my-provider/config.toml
sandbox_mode = "workspace-write"
web_search   = "cached"

[features]
undo        = true
shell_tool  = true
multi_agent = true

[history]
persistence = "save-all"

[mcp_servers.github]
command  = "npx"
args     = ["-y", "@modelcontextprotocol/server-github"]
env_vars = ["GITHUB_PERSONAL_ACCESS_TOKEN", "GITHUB_TOKEN"]
```

## Merge model

```
result = [QuickCLI-managed block]
       + Merge(preserved_user_sections, FilterOwned(codex_toml_content))
```

### QuickCLI-managed block (always regenerated, immune to template changes)

| Key | Written by |
|---|---|
| `model_provider` | QuickCLI |
| `model` | QuickCLI |
| `model_reasoning_effort` | QuickCLI |
| `model_verbosity` | QuickCLI |
| `disable_response_storage` | QuickCLI |
| `[model_providers.*]` | QuickCLI |

### Security-protected scalars (stripped from template TOML before merge)

These keys must be configured by the user — a template cannot set them:

| Key | Reason |
|---|---|
| `chatgpt_base_url` / `openai_base_url` | Could redirect API traffic to a phishing endpoint |
| `forced_login_method` / `forced_chatgpt_workspace_id` | Forced auth changes |
| `cli_auth_credentials_store` / `mcp_oauth_*` | Credential storage routing |
| `approval_policy` | Setting `"never"` would disable all safety gates |
| `default_permissions` | Whole-session sandbox policy |

### Merge conflict rules

| Situation | Result |
|---|---|
| Key is QuickCLI-managed or security-protected | Template value **discarded** |
| Key is in `mcp_servers.*` or `permissions.*` | Template entry added **only if no entry with that name already exists** |
| Same section + same key in both user config and template | Template **overwrites** |
| Section exists in user config, key missing | Template value **inserted** |
| Section not present in user config | Entire section **inserted** |

### `mcp_servers` / `permissions` — add-only policy

Your existing MCP server configurations are never overwritten.  
A template can add new servers you don't have, but cannot replace the `command`, `args`, or credentials of a server you've already configured.

```toml
# User already has:
[mcp_servers.github]
command = "uvx"
args    = ["mcp-server-git"]   ← kept as-is

# Template wants to add:
[mcp_servers.github]           ← skipped (already exists)
command = "npx"                ← ignored
[mcp_servers.filesystem]       ← added (new)
command = "npx"
args    = ["-y", "@modelcontextprotocol/server-filesystem", "."]
```

## Data flow

```
template.yaml  ──codex_toml_file──▶  GitHub Raw fetch
                                          │
                                   Template.CodexTomlContent  (in-memory)
                                          │
                              CreateConfigFromTemplate()
                                          │
                               Config.CodexTomlContent  (stored in config.yaml)
                                          │
                                    quick use
                                          │
                          codexmerge.FilterOwned()  ← strip protected keys
                                          │
                          codexmerge.Merge(preserved, filtered)
                                          │
                              ~/.codex/config.toml  ✓
```
