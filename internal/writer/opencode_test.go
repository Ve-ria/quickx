package writer

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/quickcli/quick/internal/config"
)

func TestWriteOpenCodeResponsesUsesBuiltInOpenAI(t *testing.T) {
	home := configureTestHome(t)

	err := WriteOpenCode([]config.Config{{
		Name:            "demo",
		Scope:           []string{config.ScopeOpenCode},
		BaseURL:         "https://api.example.com/v1",
		APIKey:          "sk-demo",
		Model:           "gpt-5.4",
		WireAPI:         "responses",
		ReasoningEffort: "xhigh",
		ModelVerbosity:  "low",
		DisplayName:     "Demo",
		AuthMethod:      "api_key",
	}})
	if err != nil {
		t.Fatalf("WriteOpenCode returned error: %v", err)
	}

	doc := readOpenCodeDoc(t, filepath.Join(home, ".config", "opencode", "opencode.json"))
	if got := stringValue(t, doc["model"]); got != "openai/gpt-5.4" {
		t.Fatalf("expected OpenCode model openai/gpt-5.4, got %q", got)
	}

	provider := mapValue(t, mapValue(t, doc["provider"])["openai"])
	options := mapValue(t, provider["options"])
	if got := stringValue(t, options["baseURL"]); got != "https://api.example.com/v1" {
		t.Fatalf("expected baseURL to be preserved, got %q", got)
	}
	if got := stringValue(t, options["apiKey"]); got != "sk-demo" {
		t.Fatalf("expected apiKey to be preserved, got %q", got)
	}

	modelCfg := mapValue(t, mapValue(t, provider["models"])["gpt-5.4"])
	modelOptions := mapValue(t, modelCfg["options"])
	if got := stringValue(t, modelOptions["reasoningEffort"]); got != "xhigh" {
		t.Fatalf("expected reasoningEffort xhigh, got %q", got)
	}
	if got := stringValue(t, modelOptions["textVerbosity"]); got != "low" {
		t.Fatalf("expected textVerbosity low, got %q", got)
	}
}

func TestWriteOpenCodeChatUsesCustomProvider(t *testing.T) {
	home := configureTestHome(t)

	err := WriteOpenCode([]config.Config{{
		Name:        "My Proxy/Prod",
		DisplayName: "My Proxy Prod",
		Scope:       []string{config.ScopeOpenCode},
		BaseURL:     "https://proxy.example.com/v1",
		APIKey:      "sk-proxy",
		Model:       "gpt-4o",
		WireAPI:     "chat",
		AuthMethod:  "api_key",
	}})
	if err != nil {
		t.Fatalf("WriteOpenCode returned error: %v", err)
	}

	doc := readOpenCodeDoc(t, filepath.Join(home, ".config", "opencode", "opencode.json"))
	if got := stringValue(t, doc["model"]); got != "my-proxy-prod/gpt-4o" {
		t.Fatalf("expected custom provider model path, got %q", got)
	}

	provider := mapValue(t, mapValue(t, doc["provider"])["my-proxy-prod"])
	if got := stringValue(t, provider["npm"]); got != "@ai-sdk/openai-compatible" {
		t.Fatalf("expected openai-compatible npm package, got %q", got)
	}
	if got := stringValue(t, provider["name"]); got != "My Proxy Prod" {
		t.Fatalf("expected display name to be preserved, got %q", got)
	}

	options := mapValue(t, provider["options"])
	if got := stringValue(t, options["baseURL"]); got != "https://proxy.example.com/v1" {
		t.Fatalf("expected baseURL to be preserved, got %q", got)
	}
	if got := stringValue(t, options["apiKey"]); got != "sk-proxy" {
		t.Fatalf("expected apiKey to be preserved, got %q", got)
	}
}

func TestWriteOpenCodePrefersExistingJSONCConfigAndPreservesUnmanagedKeys(t *testing.T) {
	home := configureTestHome(t)
	configDir := filepath.Join(home, ".config", "opencode")
	if err := os.MkdirAll(configDir, 0o700); err != nil {
		t.Fatalf("create config dir: %v", err)
	}

	path := filepath.Join(configDir, "config.jsonc")
	existing := []byte("// existing jsonc\n{\n  \"share\": \"disabled\",\n  \"plugin\": [\"foo\"],\n  \"provider\": {\n    \"keepme\": {\n      \"models\": {\n        \"bar\": {}\n      }\n    }\n  },\n}\n")
	if err := os.WriteFile(path, existing, 0o600); err != nil {
		t.Fatalf("write existing config: %v", err)
	}

	err := WriteOpenCode([]config.Config{{
		Name:       "demo",
		Scope:      []string{config.ScopeOpenCode},
		BaseURL:    "https://api.example.com/v1",
		APIKey:     "sk-demo",
		Model:      "gpt-5.4",
		WireAPI:    "responses",
		AuthMethod: "api_key",
	}})
	if err != nil {
		t.Fatalf("WriteOpenCode returned error: %v", err)
	}

	if _, err := os.Stat(filepath.Join(configDir, "opencode.json")); !os.IsNotExist(err) {
		t.Fatalf("expected writer to keep using existing config.jsonc, got stat err=%v", err)
	}

	doc := readOpenCodeDoc(t, path)
	if got := stringValue(t, doc["share"]); got != "disabled" {
		t.Fatalf("expected unmanaged share key to be preserved, got %q", got)
	}

	plugin, ok := doc["plugin"].([]any)
	if !ok || len(plugin) != 1 || stringValue(t, plugin[0]) != "foo" {
		t.Fatalf("expected unmanaged plugin list to be preserved, got %#v", doc["plugin"])
	}

	providerRoot := mapValue(t, doc["provider"])
	if _, ok := providerRoot["keepme"]; !ok {
		t.Fatalf("expected unmanaged provider to be preserved, got %#v", providerRoot)
	}
	if got := stringValue(t, doc["model"]); got != "openai/gpt-5.4" {
		t.Fatalf("expected built-in openai model path, got %q", got)
	}
}

func TestWriteOpenCodePrefersJSONCOverJSONWhenBothExist(t *testing.T) {
	home := configureTestHome(t)
	configDir := filepath.Join(home, ".config", "opencode")
	if err := os.MkdirAll(configDir, 0o700); err != nil {
		t.Fatalf("create config dir: %v", err)
	}

	jsonPath := filepath.Join(configDir, "opencode.json")
	jsoncPath := filepath.Join(configDir, "config.jsonc")
	if err := os.WriteFile(jsonPath, []byte(`{"model":"openai/old-json"}`), 0o600); err != nil {
		t.Fatalf("write json config: %v", err)
	}
	if err := os.WriteFile(jsoncPath, []byte("// preferred jsonc\n{\n  \"model\": \"openai/old-jsonc\"\n}\n"), 0o600); err != nil {
		t.Fatalf("write jsonc config: %v", err)
	}

	err := WriteOpenCode([]config.Config{{
		Name:       "demo",
		Scope:      []string{config.ScopeOpenCode},
		BaseURL:    "https://api.example.com/v1",
		APIKey:     "sk-demo",
		Model:      "gpt-5.4",
		WireAPI:    "responses",
		AuthMethod: "api_key",
	}})
	if err != nil {
		t.Fatalf("WriteOpenCode returned error: %v", err)
	}

	jsonDoc := readOpenCodeDoc(t, jsonPath)
	if got := stringValue(t, jsonDoc["model"]); got != "openai/old-json" {
		t.Fatalf("expected plain json file to remain untouched, got %q", got)
	}

	jsoncDoc := readOpenCodeDoc(t, jsoncPath)
	if got := stringValue(t, jsoncDoc["model"]); got != "openai/gpt-5.4" {
		t.Fatalf("expected jsonc file to be preferred, got %q", got)
	}
}

func TestWriteOpenCodeClearsStaleModelWhenActivatedConfigHasNoModel(t *testing.T) {
	home := configureTestHome(t)
	configDir := filepath.Join(home, ".config", "opencode")
	if err := os.MkdirAll(configDir, 0o700); err != nil {
		t.Fatalf("create config dir: %v", err)
	}

	path := filepath.Join(configDir, "opencode.json")
	if err := os.WriteFile(path, []byte(`{"model":"openai/old-model"}`), 0o600); err != nil {
		t.Fatalf("write existing config: %v", err)
	}

	err := WriteOpenCode([]config.Config{{
		Name:       "demo",
		Scope:      []string{config.ScopeOpenCode},
		BaseURL:    "https://api.example.com/v1",
		APIKey:     "sk-demo",
		WireAPI:    "responses",
		AuthMethod: "api_key",
	}})
	if err != nil {
		t.Fatalf("WriteOpenCode returned error: %v", err)
	}

	doc := readOpenCodeDoc(t, path)
	if _, ok := doc["model"]; ok {
		t.Fatalf("expected stale model to be cleared, got %#v", doc["model"])
	}
}

func configureTestHome(t *testing.T) string {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("APPDATA", filepath.Join(home, "AppData", "Roaming"))
	return home
}

func readOpenCodeDoc(t *testing.T, path string) map[string]any {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read opencode config %s: %v", path, err)
	}
	var doc map[string]any
	if err := json.Unmarshal(data, &doc); err != nil {
		t.Fatalf("unmarshal opencode config %s: %v\n%s", path, err, string(data))
	}
	return doc
}

func mapValue(t *testing.T, value any) map[string]any {
	t.Helper()
	m, ok := value.(map[string]any)
	if !ok {
		t.Fatalf("expected map[string]any, got %#v", value)
	}
	return m
}

func stringValue(t *testing.T, value any) string {
	t.Helper()
	s, ok := value.(string)
	if !ok {
		t.Fatalf("expected string, got %#v", value)
	}
	return s
}
