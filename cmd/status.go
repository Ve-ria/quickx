package cmd

import (
	"fmt"
	"strings"

	"github.com/quickcli/quick/internal/app"
	"github.com/quickcli/quick/internal/config"
	"github.com/spf13/cobra"
)

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show current configuration",
	RunE: func(cmd *cobra.Command, args []string) error {
		api, err := app.New()
		if err != nil {
			return err
		}
		info := api.Status()

		fmt.Println("quick status")
		fmt.Println(strings.Repeat("─", 40))
		fmt.Printf("Config file  : %s\n", info.ConfigFile)
		fmt.Printf("Active       : %s\n", orNone(info.ActiveConfig))
		fmt.Println()

		if info.ActiveConfig == "" {
			fmt.Println("No active config. Run `quick use <name>` to activate one.")
			return nil
		}

		printToolStatus("Claude Code", info.ClaudeConfigs)
		printToolStatus("Codex", info.CodexConfigs)
		printToolStatus("OpenCode", info.OpenCodeConfigs)
		return nil
	},
}

func printToolStatus(tool string, configs []config.Config) {
	fmt.Printf("\n%s\n", tool)
	fmt.Println(strings.Repeat("─", 20))
	if len(configs) == 0 {
		fmt.Println("  (not configured)")
		return
	}
	for _, c := range configs {
		name := c.DisplayName
		if name == "" {
			name = c.Name
		}
		fmt.Printf("  Config    : %s (%s)\n", name, c.Name)
		fmt.Printf("  Base URL  : %s\n", orNone(c.BaseURL))
		fmt.Printf("  API Key   : %s\n", maskKey(c.APIKey))
		fmt.Printf("  Model     : %s\n", orNone(c.Model))
	}
}

func maskKey(key string) string {
	if key == "" {
		return "(not set)"
	}
	visible := 4
	if len(key) <= visible {
		return strings.Repeat("*", len(key))
	}
	return key[:visible] + strings.Repeat("*", len(key)-visible)
}

func orNone(s string) string {
	if s == "" {
		return "(none)"
	}
	return s
}
