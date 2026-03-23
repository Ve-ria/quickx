package template

import "testing"

func TestBuiltinTemplatesExposeOpenCodeScopeForOpenAICompatibleProviders(t *testing.T) {
	for _, id := range []string{"openai", "amethyst", "privnode", "azure-openai", "ollama", "lmstudio"} {
		tmpl := builtinTemplateByID(t, id)
		if !hasScope(tmpl.Scope, "opencode") {
			t.Fatalf("expected template %q to include opencode scope, got %v", id, tmpl.Scope)
		}
	}
}

func builtinTemplateByID(t *testing.T, id string) Template {
	t.Helper()
	for _, tmpl := range builtinTemplates {
		if tmpl.ID == id {
			return tmpl
		}
	}
	t.Fatalf("builtin template %q not found", id)
	return Template{}
}

func hasScope(scopes []string, want string) bool {
	for _, scope := range scopes {
		if scope == want {
			return true
		}
	}
	return false
}
