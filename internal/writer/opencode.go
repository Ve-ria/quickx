package writer

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"unicode"

	"github.com/quickcli/quick/internal/config"
	"github.com/tailscale/hujson"
)

var openCodeConfigCandidates = []string{
	"opencode.jsonc",
	"config.jsonc",
	"opencode.json",
	"config.json",
}

// WriteOpenCode updates the user's OpenCode config for configs that have
// opencode scope.
func WriteOpenCode(configs []config.Config) error {
	var active *config.Config
	for i := range configs {
		if configs[i].HasOpenCodeScope() {
			active = &configs[i]
		}
	}
	if active == nil {
		return nil
	}

	dir := openCodeConfigDir()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("create opencode config dir: %w", err)
	}

	path := openCodeConfigPath(dir)
	doc, err := loadOpenCodeDoc(path)
	if err != nil {
		return err
	}

	mergeOpenCodeConfig(doc, *active)

	data, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal opencode config: %w", err)
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return fmt.Errorf("write opencode config: %w", err)
	}
	return nil
}

func openCodeConfigDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "opencode")
}

func openCodeConfigPath(dir string) string {
	for _, name := range openCodeConfigCandidates {
		path := filepath.Join(dir, name)
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}
	return filepath.Join(dir, "opencode.json")
}

func loadOpenCodeDoc(path string) (map[string]any, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]any{}, nil
		}
		return nil, fmt.Errorf("read opencode config: %w", err)
	}

	standard, err := hujson.Standardize(data)
	if err != nil {
		return nil, fmt.Errorf("parse opencode config %s: %w", path, err)
	}

	var doc map[string]any
	if err := json.Unmarshal(standard, &doc); err != nil {
		return nil, fmt.Errorf("decode opencode config %s: %w", path, err)
	}
	if doc == nil {
		doc = map[string]any{}
	}
	return doc, nil
}

func mergeOpenCodeConfig(doc map[string]any, c config.Config) {
	doc["$schema"] = "https://opencode.ai/config.json"
	providerRoot := ensureMap(doc, "provider")

	wireAPI := c.WireAPI
	if wireAPI == "" {
		wireAPI = "responses"
	}

	if wireAPI == "chat" {
		providerID := openCodeProviderID(c.Name)
		provider := ensureMap(providerRoot, providerID)
		provider["npm"] = "@ai-sdk/openai-compatible"
		provider["name"] = displayName(c)

		options := ensureMap(provider, "options")
		setString(options, "baseURL", c.BaseURL)
		setString(options, "apiKey", c.APIKey)

		models := ensureMap(provider, "models")
		if c.Model != "" {
			ensureMap(models, c.Model)
			doc["model"] = providerID + "/" + c.Model
		} else {
			delete(doc, "model")
		}
		return
	}

	provider := ensureMap(providerRoot, "openai")
	options := ensureMap(provider, "options")
	setString(options, "baseURL", c.BaseURL)
	setString(options, "apiKey", c.APIKey)

	models := ensureMap(provider, "models")
	if c.Model != "" {
		modelCfg := ensureMap(models, c.Model)
		modelOptions := ensureMap(modelCfg, "options")
		setString(modelOptions, "reasoningEffort", c.ReasoningEffort)
		setString(modelOptions, "textVerbosity", c.ModelVerbosity)
		doc["model"] = "openai/" + c.Model
	} else {
		delete(doc, "model")
	}
}

func ensureMap(root map[string]any, key string) map[string]any {
	if existing, ok := root[key].(map[string]any); ok {
		return existing
	}
	created := map[string]any{}
	root[key] = created
	return created
}

func setString(root map[string]any, key, value string) {
	if value == "" {
		delete(root, key)
		return
	}
	root[key] = value
}

func displayName(c config.Config) string {
	if c.DisplayName != "" {
		return c.DisplayName
	}
	if c.Name != "" {
		return c.Name
	}
	return "QuickCLI Provider"
}

func openCodeProviderID(name string) string {
	var b strings.Builder
	lastDash := false
	for _, r := range strings.ToLower(name) {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			b.WriteRune(r)
			lastDash = false
		case r == '-' || r == '_' || r == '.':
			b.WriteRune(r)
			lastDash = false
		default:
			if !lastDash && b.Len() > 0 {
				b.WriteByte('-')
				lastDash = true
			}
		}
	}
	slug := strings.Trim(b.String(), "-._")
	if slug == "" {
		return "quickcli"
	}
	return slug
}
