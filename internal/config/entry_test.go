package config

import "testing"

func TestHasOpenCodeScope(t *testing.T) {
	cfg := Config{Scope: []string{ScopeOpenCode}}

	if !cfg.HasOpenCodeScope() {
		t.Fatal("expected opencode-scoped config to report HasOpenCodeScope")
	}
}
