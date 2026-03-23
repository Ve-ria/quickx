package cmd

import (
	"os"

	configcmd "github.com/quickcli/quick/cmd/config"
	templatecmd "github.com/quickcli/quick/cmd/template"
	"github.com/quickcli/quick/internal/app"
	"github.com/quickcli/quick/internal/tui"
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "quick",
	Short: "quick — switch AI coding assistant providers in one command",
	Long: `quick lets you switch between AI coding assistant configurations
(Claude Code, Codex, OpenCode) with a single command or through an interactive TUI.

Run without arguments to open the interactive TUI.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		api, err := app.New()
		if err != nil {
			return err
		}
		return tui.Run(api)
	},
}

// Execute is the entrypoint called from main.go.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	rootCmd.SilenceUsage = true

	// Config subcommands (replaces provider + profile)
	configCmd := &cobra.Command{Use: "config", Short: "Manage configs"}
	configCmd.AddCommand(
		configcmd.AddCmd,
		configcmd.ListCmd,
		configcmd.RemoveCmd,
		configcmd.LoginCmd,
	)
	rootCmd.AddCommand(configCmd)

	// Template subcommands
	templateCmd := &cobra.Command{Use: "template", Short: "Browse provider templates from the registry"}
	templateCmd.AddCommand(templatecmd.ListCmd, templatecmd.PreviewCmd)
	rootCmd.AddCommand(templateCmd)

	rootCmd.AddCommand(useCmd)
	rootCmd.AddCommand(statusCmd)
}
