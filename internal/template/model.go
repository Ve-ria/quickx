package template

// Template is a provider blueprint stored in the GitHub template registry.
// Fields that contain ${--:"<question>":"<default>"} placeholders are dynamic
// and must be filled in by the user through the TUI wizard before a Provider
// is created.
type Template struct {
	ID          string   `yaml:"id"`
	DisplayName string   `yaml:"display_name"`
	Scope       []string `yaml:"scope"`
	BaseURL     string   `yaml:"base_url"`
	APIKey      string   `yaml:"api_key"`
	Model       string   `yaml:"model"`
	WireAPI     string   `yaml:"wire_api"`
	AuthMethod  string   `yaml:"auth_method"`
	DocsURL     string   `yaml:"docs_url,omitempty"`
	RequiredEnvs []string `yaml:"required_envs,omitempty"`

	// Codex inference options (written to config.toml top-level keys).
	// ReasoningEffort: minimal | low | medium | high | xhigh
	// ModelVerbosity:  low | medium | high  (omit to use model default)
	ReasoningEffort string `yaml:"reasoning_effort,omitempty"`
	ModelVerbosity  string `yaml:"model_verbosity,omitempty"`
}
