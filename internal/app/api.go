// Package app is the business-logic layer. Both the TUI and CLI call this;
// neither UI concern leaks in here.
package app

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/quickcli/quick/internal/config"
	"github.com/quickcli/quick/internal/login"
	tmplpkg "github.com/quickcli/quick/internal/template"
	"github.com/quickcli/quick/internal/writer"
	"github.com/quickcli/quick/pkg/xdg"
)

// StatusInfo is a snapshot of the current configuration state.
type StatusInfo struct {
	ActiveConfig  string
	ConfigFile    string
	ClaudeConfigs []config.Config
	CodexConfigs  []config.Config
}

// API is the pure business-logic facade. No UI, no printing.
type API struct {
	store *config.Store
}

// New loads the on-disk config and returns a ready API.
func New() (*API, error) {
	store, err := config.Load()
	if err != nil {
		return nil, err
	}
	return &API{store: store}, nil
}

// --- Configs ---

func (a *API) ListConfigs() []config.Config {
	return a.store.Configs
}

func (a *API) GetConfig(name string) *config.Config {
	return a.store.Get(name)
}

func (a *API) AddConfig(c config.Config) error {
	if c.DisplayName == "" {
		c.DisplayName = c.Name
	}
	if err := a.store.Add(c); err != nil {
		return err
	}
	return a.store.Save()
}

func (a *API) RemoveConfig(name string) error {
	if err := a.store.Remove(name); err != nil {
		return err
	}
	return a.store.Save()
}

// CreateConfigFromTemplate fills a template with answers and saves the config.
func (a *API) CreateConfigFromTemplate(name string, tmpl tmplpkg.Template, answers map[string]string) error {
	c := config.Config{
		Name:            name,
		DisplayName:     tmpl.DisplayName,
		Scope:           tmpl.Scope,
		BaseURL:         tmplpkg.Substitute(tmpl.BaseURL, answers),
		APIKey:          tmplpkg.Substitute(tmpl.APIKey, answers),
		Model:           tmplpkg.Substitute(tmpl.Model, answers),
		WireAPI:         tmpl.WireAPI,
		AuthMethod:      tmpl.AuthMethod,
		ReasoningEffort: tmpl.ReasoningEffort,
		ModelVerbosity:  tmpl.ModelVerbosity,
		TemplateID:      tmpl.ID,
	}
	if c.DisplayName == "" {
		c.DisplayName = name
	}
	return a.AddConfig(c)
}

// ActiveConfig returns the name of the currently active config.
func (a *API) ActiveConfig() string {
	return a.store.ActiveConfig
}

// UseConfig activates the named config and writes all tool configs + shell env vars.
// name may be a single config name.
func (a *API) UseConfig(name string) error {
	c := a.store.Get(name)
	if c == nil {
		return fmt.Errorf("no config named %q", name)
	}

	// Collect the single config (slice for writer compatibility).
	configs := []config.Config{*c}

	var warns []string
	if err := writer.WriteClaudeCode(configs); err != nil {
		warns = append(warns, "claude code: "+err.Error())
	}
	if err := writer.WriteCodex(configs); err != nil {
		warns = append(warns, "codex: "+err.Error())
	}
	if err := writer.WriteShellEnv(configs); err != nil {
		warns = append(warns, "shell profile: "+err.Error())
	}

	a.store.ActiveConfig = name
	if err := a.store.Save(); err != nil {
		return err
	}
	if len(warns) > 0 {
		return fmt.Errorf("activated %q (warnings: %s)", name, strings.Join(warns, "; "))
	}
	return nil
}

// --- Status ---

func (a *API) Status() StatusInfo {
	info := StatusInfo{
		ActiveConfig: a.store.ActiveConfig,
		ConfigFile:   xdg.ConfigFile(),
	}
	if a.store.ActiveConfig != "" {
		c := a.store.Get(a.store.ActiveConfig)
		if c != nil {
			if c.HasClaudeCodeScope() {
				info.ClaudeConfigs = append(info.ClaudeConfigs, *c)
			}
			if c.HasCodexScope() {
				info.CodexConfigs = append(info.CodexConfigs, *c)
			}
		}
	}
	return info
}

// --- Templates ---

func (a *API) FetchTemplates() ([]tmplpkg.Template, error) {
	return tmplpkg.FetchAll()
}

func (a *API) FetchTemplate(id string) (*tmplpkg.Template, error) {
	return tmplpkg.FetchByID(id)
}

// --- Codex Login ---

// DeviceCodeInfo carries what the UI needs to show the user.
type DeviceCodeInfo struct {
	VerificationURL string
	UserCode        string
}

// DeviceCodeHandle is an opaque token for an in-progress device-code login.
// Obtain one from LoginCodexRequestDevice; pass it to LoginCodexCompleteDevice.
type DeviceCodeHandle struct {
	dc        *login.DeviceCode
	codexHome string
}

// LoginCodexRequestDevice starts the device-code flow and returns display info.
// The caller should show DeviceCodeInfo to the user, then call LoginCodexCompleteDevice.
func (a *API) LoginCodexRequestDevice() (*DeviceCodeHandle, DeviceCodeInfo, error) {
	dc, err := login.RequestDeviceCode()
	if err != nil {
		return nil, DeviceCodeInfo{}, fmt.Errorf("request device code: %w", err)
	}
	home, _ := os.UserHomeDir()
	return &DeviceCodeHandle{dc: dc, codexHome: filepath.Join(home, ".codex")},
		DeviceCodeInfo{VerificationURL: dc.VerificationURL, UserCode: dc.UserCode},
		nil
}

// LoginCodexCompleteDevice polls, exchanges the code, and persists tokens to auth.json.
// tickFn (may be nil) is called before each poll attempt so the UI can pulse a spinner.
func (a *API) LoginCodexCompleteDevice(h *DeviceCodeHandle, tickFn func()) error {
	return login.CompleteDeviceLogin(h.dc, h.codexHome, tickFn)
}

// LoginCodexBrowser starts the PKCE browser-based login flow.
// It returns the URL the user should open in a browser, plus a wait function that
// blocks until the browser callback completes (or ctx is cancelled).
func (a *API) LoginCodexBrowser(ctx context.Context) (authURL string, wait func() error, err error) {
	home, _ := os.UserHomeDir()
	return login.LoginWithBrowser(ctx, filepath.Join(home, ".codex"))
}

// CreateCodexLoginConfig creates (or updates) a config entry for the account
// that just logged in.
//
// configName may be empty, in which case the name is derived automatically from
// the email in the stored id_token:  "codex-{sanitized-email}".
// The display name always shows the original email for readability.
// Returns the config name that was created or already existed.
func (a *API) CreateCodexLoginConfig(configName string) (string, error) {
	email := a.codexLoginEmail()

	if configName == "" {
		if email != "" {
			configName = "codex-" + sanitizeEmail(email)
		} else {
			configName = "codex-chatgpt"
		}
	}

	displayName := "OpenAI Codex (ChatGPT)"
	if email != "" {
		displayName = "OpenAI Codex (" + email + ")"
	}

	// If a config with this name already exists, update its display name in
	// case the email changed (e.g. token refresh for a different sub-account).
	if existing := a.store.Get(configName); existing != nil {
		existing.DisplayName = displayName
		return configName, a.store.Save()
	}

	c := config.Config{
		Name:        configName,
		DisplayName: displayName,
		Scope:       []string{config.ScopeCodex},
		AuthMethod:  "chatgpt",
	}
	if err := a.AddConfig(c); err != nil {
		return "", fmt.Errorf("create config %q: %w", configName, err)
	}
	return configName, nil
}

// codexLoginEmail reads the email from the id_token currently stored in
// ~/.codex/auth.json.  Returns "" if unavailable.
func (a *API) codexLoginEmail() string {
	home, _ := os.UserHomeDir()
	data, err := os.ReadFile(filepath.Join(home, ".codex", "auth.json"))
	if err != nil {
		return ""
	}
	var auth struct {
		Tokens *struct {
			IDToken string `json:"id_token"`
		} `json:"tokens"`
	}
	if err := json.Unmarshal(data, &auth); err != nil || auth.Tokens == nil {
		return ""
	}
	return login.EmailFromIDToken(auth.Tokens.IDToken)
}

// sanitizeEmail converts an email address into a safe config/TOML key by
// replacing @ and . with -.  e.g. "srv@dart.cc.cd" → "srv-dart-cc-cd".
func sanitizeEmail(email string) string {
	r := strings.NewReplacer("@", "-", ".", "-")
	return r.Replace(email)
}
