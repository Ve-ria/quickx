package config

import (
	"fmt"
	"strings"

	"github.com/quickcli/quick/internal/app"
	internalconfig "github.com/quickcli/quick/internal/config"
	"github.com/quickcli/quick/internal/template"
	"github.com/quickcli/quick/internal/tui"
	"github.com/spf13/cobra"
)

var (
	addScope        string
	addBaseURL      string
	addAPIKey       string
	addModel        string
	addWireAPI      string
	addAuthMethod   string
	addFromTemplate string
)

var AddCmd = &cobra.Command{
	Use:   "add [name]",
	Short: "Add a new config",
	Long: `Add a new config using flags or from a template.
--from-template and manual flags (--base-url, --api-key, --model) are mutually exclusive.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if addFromTemplate != "" && (addBaseURL != "" || addAPIKey != "" || addModel != "" || addWireAPI != "responses" || addAuthMethod != "api_key") {
			return fmt.Errorf("--from-template and manual flags are mutually exclusive")
		}
		name := ""
		if len(args) > 0 {
			name = args[0]
		}
		if addFromTemplate != "" {
			return runAddFromTemplate(name, addFromTemplate)
		}
		return runAddCustom(name)
	},
}

func init() {
	AddCmd.Flags().StringVar(&addScope, "scope", "codex", "Comma-separated scopes: codex,claudecode,opencode")
	AddCmd.Flags().StringVar(&addBaseURL, "base-url", "", "Provider API base URL")
	AddCmd.Flags().StringVar(&addAPIKey, "api-key", "", "API key")
	AddCmd.Flags().StringVar(&addModel, "model", "", "Default model name")
	AddCmd.Flags().StringVar(&addWireAPI, "wire-api", "responses", "Wire protocol: responses or chat")
	AddCmd.Flags().StringVar(&addAuthMethod, "auth-method", "api_key", "Auth method: api_key, chatgpt, aws, gcp, azure")
	AddCmd.Flags().StringVar(&addFromTemplate, "from-template", "", "Template ID (mutually exclusive with manual flags)")
}

func runAddCustom(name string) error {
	scopes := parseScopes(addScope)

	// Prompt for missing fields.
	var fields []tui.Field
	if name == "" {
		fields = append(fields, tui.Field{Label: "Config name", Placeholder: "my-config"})
	}
	if addBaseURL == "" {
		fields = append(fields, tui.Field{Label: "Base URL", Placeholder: "https://api.example.com/v1"})
	}
	if addAPIKey == "" {
		fields = append(fields, tui.Field{Label: "API Key (leave blank to skip)", Secret: true})
	}
	if addModel == "" {
		fields = append(fields, tui.Field{Label: "Default model (optional)", Placeholder: "gpt-4o"})
	}

	if len(fields) > 0 {
		answers, err := tui.RunWizard("Add Config", fields)
		if answers == nil || err != nil {
			return fmt.Errorf("aborted")
		}
		i := 0
		if name == "" {
			name = answers[i]
			i++
		}
		if addBaseURL == "" && i < len(answers) {
			addBaseURL = answers[i]
			i++
		}
		if addAPIKey == "" && i < len(answers) {
			addAPIKey = answers[i]
			i++
		}
		if addModel == "" && i < len(answers) {
			addModel = answers[i]
		}
	}

	if name == "" {
		return fmt.Errorf("config name is required")
	}

	api, err := app.New()
	if err != nil {
		return err
	}
	if err := api.AddConfig(internalconfig.Config{
		Name:       name,
		Scope:      scopes,
		BaseURL:    addBaseURL,
		APIKey:     addAPIKey,
		Model:      addModel,
		WireAPI:    addWireAPI,
		AuthMethod: addAuthMethod,
	}); err != nil {
		return err
	}
	fmt.Printf("Config %q added.\n", name)
	fmt.Printf("Run `quick use %s` to activate it.\n", name)
	return nil
}

func runAddFromTemplate(name, id string) error {
	fmt.Printf("Fetching template %q…\n", id)
	tmpl, err := template.FetchByID(id)
	if err != nil {
		return fmt.Errorf("fetch template: %w", err)
	}
	if name == "" {
		name = tmpl.ID
	}

	combined := strings.Join([]string{tmpl.APIKey, tmpl.Model, tmpl.BaseURL}, "|")
	placeholders := template.FindPlaceholders(combined)

	var fields []tui.Field
	for _, ph := range placeholders {
		fields = append(fields, tui.Field{
			Label:   ph.Question(),
			Default: ph.Default(),
			Secret:  strings.Contains(strings.ToLower(ph.Question()), "key"),
		})
	}

	answers, err := tui.RunWizard("Configure "+tmpl.DisplayName, fields)
	if answers == nil || err != nil {
		return fmt.Errorf("aborted")
	}

	answerMap := map[string]string{}
	for i, ph := range placeholders {
		if i < len(answers) {
			answerMap[ph.Question()] = answers[i]
		}
	}

	api, err := app.New()
	if err != nil {
		return err
	}
	if err := api.CreateConfigFromTemplate(name, *tmpl, answerMap); err != nil {
		return err
	}
	fmt.Printf("Config %q added from template %q.\n", name, id)
	fmt.Printf("Run `quick use %s` to activate it.\n", name)
	return nil
}

func parseScopes(s string) []string {
	parts := strings.Split(s, ",")
	var out []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return []string{"codex"}
	}
	return out
}
