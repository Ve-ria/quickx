# Contributing

## Contributing a template

The fastest way to contribute is to add a new provider template so the community can use `quick config add --from-template <your-id>`.

### 1 — Fork and clone

```bash
gh repo fork AmethystDev-Labs/QuickCLI --clone
cd QuickCLI
```

### 2 — Create the template directory

```bash
mkdir templates/my-provider
```

The directory name becomes the template ID.  
Use lowercase letters and hyphens only — no spaces or special characters.

### 3 — Write `template.yaml`

```yaml
id: my-provider
display_name: My Provider
scope:
  - codex          # or claudecode, or both
base_url: https://api.myprovider.com/v1
api_key: '${--:"My Provider API Key":""}'
model: '${--:"Default model":"gpt-5-codex"}'
wire_api: responses
auth_method: api_key
docs_url: https://docs.myprovider.com
```

See [Templates](./templates.md) for the full field reference.

### 4 — (Optional) Add a `config.toml`

If your provider benefits from extra Codex configuration (MCP servers, features, sandbox settings), add a `config.toml` and reference it:

```yaml
# in template.yaml
codex_toml_file: config.toml
```

See [TemplateFiles](./template-files.md) for the merge rules and security constraints.

> **Tip:** Use the [Template Builder](../webground/README.md) web UI to generate both files interactively.

### 5 — Open a pull request

```bash
git checkout -b templates/my-provider
git add templates/my-provider/
git commit -m "feat(templates): add my-provider"
gh pr create --title "feat(templates): add my-provider" \
             --body "Brief description of the provider."
```

### Rules

- `scope` must be accurate — don't add `claudecode` to a Codex-only provider.
- `api_key` must use magic syntax `${--:"...":""}` if users supply their own key.
- Never include real API keys, secrets, or personal credentials.
- `codex_toml_file` must not set security-protected keys (`approval_policy`, `chatgpt_base_url`, etc.).

## Contributing code

Standard Go project workflow:

```bash
go build ./...
go vet ./...
go test ./...
```

Key packages:

| Package | Role |
|---|---|
| `internal/app` | Business logic facade (no UI) |
| `internal/config` | Config store (load / save `config.yaml`) |
| `internal/template` | Template registry, fetching, placeholder substitution |
| `internal/writer` | Writes `~/.codex/config.toml`, `~/.claude/settings.json`, shell profile |
| `internal/config_merge/codex` | Schema-aware TOML merge for TemplateFiles |
| `internal/login` | OAuth PKCE and device-code flows |
| `internal/tui` | Bubbletea TUI |
| `cmd/` | Cobra CLI commands |

## License

All contributions are accepted under the [GPL v3](../LICENSE) license.
