package config

import (
	"strings"
	"testing"
)

func TestAddCmdRegistersWireAndAuthFlags(t *testing.T) {
	if AddCmd.Flags().Lookup("wire-api") == nil {
		t.Fatal("expected --wire-api flag to be registered")
	}
	if AddCmd.Flags().Lookup("auth-method") == nil {
		t.Fatal("expected --auth-method flag to be registered")
	}
}

func TestAddCmdRejectsTemplateWithWireOrAuthFlags(t *testing.T) {
	resetAddFlags()
	addFromTemplate = "openai"
	addWireAPI = "chat"

	err := AddCmd.RunE(AddCmd, []string{"demo"})
	if err == nil || !strings.Contains(err.Error(), "mutually exclusive") {
		t.Fatalf("expected mutual exclusion error, got %v", err)
	}

	resetAddFlags()
	addFromTemplate = "openai"
	addAuthMethod = "chatgpt"

	err = AddCmd.RunE(AddCmd, []string{"demo"})
	if err == nil || !strings.Contains(err.Error(), "mutually exclusive") {
		t.Fatalf("expected mutual exclusion error, got %v", err)
	}
}

func resetAddFlags() {
	addScope = "codex"
	addBaseURL = ""
	addAPIKey = ""
	addModel = ""
	addWireAPI = "responses"
	addAuthMethod = "api_key"
	addFromTemplate = ""
}
