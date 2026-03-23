package config

// Scope constants for config applicability.
const (
	ScopeCodex      = "codex"
	ScopeClaudeCode = "claudecode"
	ScopeOpenCode   = "opencode"
)

// Config is a named configuration that can be activated with `quick use <name>`.
// It replaces the previous Provider + Profile two-layer design: one Config is
// everything you need to switch tools in one command.
type Config struct {
	Name        string   `yaml:"name"`
	DisplayName string   `yaml:"display_name,omitempty"`
	Scope       []string `yaml:"scope"` // "codex", "claudecode", "opencode", or any combination

	// Connection
	BaseURL string `yaml:"base_url,omitempty"`
	APIKey  string `yaml:"api_key,omitempty"`
	Model   string `yaml:"model,omitempty"`

	// Codex-specific
	WireAPI string `yaml:"wire_api,omitempty"` // "responses" | "chat"

	// Auth
	AuthMethod string `yaml:"auth_method,omitempty"` // "api_key" | "chatgpt" | "aws" | "gcp" | "azure"

	// Claude Code model overrides
	CCOpus   string `yaml:"cc_opus,omitempty"`
	CCHaiku  string `yaml:"cc_haiku,omitempty"`
	CCSonnet string `yaml:"cc_sonnet,omitempty"`

	// Codex inference options (written verbatim to config.toml).
	// ReasoningEffort: minimal | low | medium | high | xhigh  (default: high)
	// ModelVerbosity:  low | medium | high  (empty = use model default)
	ReasoningEffort string `yaml:"reasoning_effort,omitempty"`
	ModelVerbosity  string `yaml:"model_verbosity,omitempty"`

	// Template reference (empty when created in Custom mode)
	TemplateID string `yaml:"template_id,omitempty"`

	// Extra Codex config supplied by the template (raw TOML string).
	// When non-empty, its content is schema-aware merged into
	// ~/.codex/config.toml on every `quick use`, after QuickCLI-owned keys
	// have been stripped via codexmerge.FilterOwned.
	CodexTomlContent string `yaml:"codex_toml_content,omitempty"`
}

// HasScope reports whether c is scoped to the given target.
func (c Config) HasScope(target string) bool {
	for _, s := range c.Scope {
		if s == target {
			return true
		}
	}
	return false
}

// HasClaudeCodeScope reports whether c applies to Claude Code.
func (c Config) HasClaudeCodeScope() bool { return c.HasScope(ScopeClaudeCode) }

// HasCodexScope reports whether c applies to Codex.
func (c Config) HasCodexScope() bool { return c.HasScope(ScopeCodex) }

// HasOpenCodeScope reports whether c applies to OpenCode.
func (c Config) HasOpenCodeScope() bool { return c.HasScope(ScopeOpenCode) }
