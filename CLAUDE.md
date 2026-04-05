# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn build          # Compile with tsup → dist/index.js
yarn check          # TypeScript type-check (no emit)
yarn dev            # Run from source with tsx (no build step)
node dist/index.js  # Run compiled output directly
```

There are no tests. Publishing is tag-driven: push a `v*` tag and GitHub Actions publishes to npm.

## Architecture

`quickx` is a Codex-only profile manager. It has two interaction surfaces sharing one API class:

- **Commander CLI** (`src/index.tsx`) — `quickx profiles add/edit/remove/list/login` (alias `config`), `quickx use`, `quickx status`, `quickx templates list/preview`
- **Ink TUI** (`src/tui.tsx` + `src/components/App.tsx`) — launched when no CLI args are given

### Core data flow

```
QuickxApi (src/api.ts)
  ├── lib/store.ts     → reads/writes ~/.config/quickx/config.json (quickx's own store)
  ├── lib/codex.ts     → writes ~/.codex/config.toml and ~/.codex/auth.json (Codex config)
  ├── lib/auth.ts      → reads Codex auth state (email, tokens)
  ├── lib/login.ts     → browser PKCE and device-code OAuth flows
  ├── lib/templates.ts → fetches/caches provider templates from AmethystDev-Labs/QuickCLI on GitHub
  ├── lib/paths.ts     → platform-aware config/data/cache paths (XDG-aware on Linux)
  └── lib/utils.ts     → helpers (openBrowser, sanitizeEmail, cloneProfiles, pickWindow)
```

`QuickxApi` is the single source of truth. It reloads from disk on every mutating call (50 ms TTL debounce) to avoid stale state. The CLI and TUI both instantiate one `QuickxApi` and call its methods directly — there is no HTTP layer between them.

### Commander + Ink output pattern

All CLI commands render output as Ink JSX components via `src/lib/render-once.tsx`:

```ts
await renderOnce(<MyOutput ... />);  // renders, waits for exit(), then resolves
```

Components call `useApp().exit()` in a `useEffect` once data is ready. Async work (API calls, OAuth) runs inside `useEffect` and updates state incrementally so the user sees progress.

### TUI structure

`src/components/App.tsx` is a thin router — it holds all state, a `stateRef` (updated every render so `useInput` closures read fresh values), and a single `useInput` handler. Rendering is delegated to:

- `src/components/screens/` — `StatusScreen`, `ProfilesScreen`, `TemplatesScreen`
- `src/components/forms/` — `AddProfileForm`, `EditProfileForm`, `LoginForm`, `ConfirmDeleteForm`, `TemplateAddForm`

Tab ids: `"status"`, `"profiles"`, `"templates"` (switched with keys `1` / `2` / `3`).

### Template system

Templates live in `AmethystDev-Labs/QuickCLI` on GitHub (fetched via GitHub API) and are merged with hardcoded `builtinTemplates` in `src/lib/templates.ts`. Dynamic fields use the magic syntax `${--:"Question text":"default"}` which is scanned by a regex (`MAGIC_RE`) and substituted interactively. Remote templates are cached for 1 hour in `~/.cache/quickx/template-cache/` (XDG-compliant).

### Store versioning

`StoreData` carries a `version: number` field. `migrateStore()` in `src/lib/store.ts` runs on every load and is the place to add future schema migrations.

### Codex config writing

`applyCodexProfile` in `src/lib/codex.ts` rewrites `~/.codex/config.toml` on every `quickx use`. It preserves non-`[model_providers.*]` TOML sections from the existing file and regenerates the `[model_providers.*]` blocks from all saved profiles, setting the active one at the top level. API key mode also updates `~/.codex/auth.json` via `lib/auth.ts`.

### Build

`tsup` bundles `src/index.tsx` → `dist/index.js` as a single ESM file with `#!/usr/bin/env node` prepended. No separate shebang step needed. Do not add a shebang to `src/index.tsx` — it would be duplicated in the output.
