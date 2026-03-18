# ChatGPT Login

QuickCLI supports logging in with your ChatGPT account to use OpenAI Codex without a separate API key.  
Two flows are available: browser (PKCE) for interactive sessions, and device-code for SSH / headless environments.

## Browser flow (recommended)

```bash
quick config login
```

1. QuickCLI opens your default browser to the OpenAI authorization page.
2. Log in with your ChatGPT account and approve access.
3. The browser redirects to a local callback server; QuickCLI captures the code and exchanges it for tokens.
4. Tokens are stored in `~/.codex/auth.json`.
5. A Codex config named `codex-<your-email>` is created and activated automatically.

## Device-code flow (SSH / headless)

```bash
quick config login --device
```

1. QuickCLI prints a short **user code** and a **verification URL**.
2. On any device with a browser, visit the URL and enter the code.
3. QuickCLI polls until the code is approved, then stores the tokens and creates the config.

## Custom config name

By default the config is named `codex-<sanitized-email>` (e.g. `codex-alice-example-com`).  
Supply a name to override:

```bash
quick config login mywork
quick config login mywork --device
```

## Token storage

| File | Contents |
|---|---|
| `~/.codex/auth.json` | OAuth tokens (`access_token`, `refresh_token`, `id_token`) |

QuickCLI extracts your email from the `id_token` JWT (no network call needed) to generate a human-readable config name and display name.

## Re-login / token refresh

Running `quick config login` again replaces the stored tokens with fresh ones.  
Codex handles access-token refresh automatically using the stored `refresh_token`.

## Switching back to API key auth

```bash
quick config add myprovider --api-key sk-xxx --scope codex
quick use myprovider
```

This writes `auth_mode = "apikey"` to `auth.json`, overriding any ChatGPT session.
