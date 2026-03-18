package codexmerge

// ownedScalars are top-level scalar keys that QuickCLI writes itself.
// They must be stripped from any template-supplied TOML before merging
// so the template cannot overwrite QuickCLI's managed values.
var ownedScalars = map[string]bool{
	"model_provider":           true,
	"model":                    true,
	"model_reasoning_effort":   true,
	"model_verbosity":          true,
	"disable_response_storage": true,
}

// protectedScalars are top-level scalar keys that are security-sensitive.
// Templates may NOT set these; they must be configured by the user directly.
//
//   - Auth/redirect keys: a malicious template could point chatgpt_base_url or
//     openai_base_url at a phishing endpoint to steal tokens.
//   - approval_policy: setting this to "never" would silently disable all safety
//     approval gates that Codex shows the user before executing commands.
//   - default_permissions / forced_login_method: affect the security posture of
//     the whole session in ways that should remain under user control.
var protectedScalars = map[string]bool{
	// Authentication / credential routing
	"forced_login_method":         true,
	"forced_chatgpt_workspace_id": true,
	"chatgpt_base_url":            true,
	"openai_base_url":             true,
	"cli_auth_credentials_store":  true,
	"mcp_oauth_credentials_store": true,
	"mcp_oauth_callback_url":      true,
	"mcp_oauth_callback_port":     true,
	// Safety / approval gates
	"approval_policy":    true,
	"default_permissions": true,
}

// ownedTablePrefixes are top-level TOML table names (or dotted prefixes)
// that QuickCLI owns entirely. Any table whose name starts with one of
// these strings will be stripped from template-supplied TOML.
var ownedTablePrefixes = []string{
	"model_providers",
}

// noOverwriteTablePrefixes are top-level table names where a template may
// ADD new entries (sub-keys that don't already exist) but must NEVER
// overwrite entries the user has already configured.
//
//   - mcp_servers: templates are encouraged to ship pre-configured MCP servers,
//     but an attacker must not be able to silently replace a trusted server with
//     a malicious one.
//   - permissions: the user's named permission profiles are part of their security
//     model and should not be overridden by a template.
var noOverwriteTablePrefixes = []string{
	"mcp_servers",
	"permissions",
}

// isOwnedTable reports whether a top-level TOML key is QuickCLI-owned.
func isOwnedTable(tableKey string) bool {
	return matchesPrefix(tableKey, ownedTablePrefixes)
}

// isNoOverwriteTable reports whether a top-level TOML key belongs to a table
// where template entries may be added but not overwrite existing user entries.
func isNoOverwriteTable(tableKey string) bool {
	return matchesPrefix(tableKey, noOverwriteTablePrefixes)
}

func matchesPrefix(key string, prefixes []string) bool {
	for _, prefix := range prefixes {
		if key == prefix {
			return true
		}
		if len(key) > len(prefix) && key[:len(prefix)] == prefix && key[len(prefix)] == '.' {
			return true
		}
	}
	return false
}
