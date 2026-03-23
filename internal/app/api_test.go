package app

import (
	"testing"

	"github.com/quickcli/quick/internal/config"
)

func TestStatusIncludesOpenCodeConfig(t *testing.T) {
	a := &API{store: &config.Store{
		ActiveConfig: "demo",
		Configs: []config.Config{{
			Name:  "demo",
			Scope: []string{config.ScopeOpenCode},
		}},
	}}

	info := a.Status()
	if len(info.OpenCodeConfigs) != 1 {
		t.Fatalf("expected 1 OpenCode config, got %d", len(info.OpenCodeConfigs))
	}
	if info.OpenCodeConfigs[0].Name != "demo" {
		t.Fatalf("expected OpenCode config named demo, got %q", info.OpenCodeConfigs[0].Name)
	}
}
