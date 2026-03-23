package tui

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/quickcli/quick/internal/app"
	"github.com/quickcli/quick/internal/config"
)

type statusScreen struct {
	api   *app.API
	info  app.StatusInfo
	width int
}

func newStatusScreen(api *app.API) *statusScreen {
	return &statusScreen{api: api, info: api.Status()}
}

func (m *statusScreen) Init() tea.Cmd { return nil }

func (m *statusScreen) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
	case ScreenFocusedMsg:
		m.info = m.api.Status()
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q", "esc":
			return m, Pop()
		}
	}
	return m, nil
}

func (m *statusScreen) View() string {
	var sb strings.Builder
	sb.WriteString(styleTitle.Render("Status") + "\n\n")
	sb.WriteString(styleDim.Render("Config file  ") + m.info.ConfigFile + "\n")
	sb.WriteString(styleDim.Render("Active       ") + orNoneStr(m.info.ActiveConfig) + "\n")

	sb.WriteString("\n")
	sb.WriteString(renderToolStatus("Claude Code", m.info.ClaudeConfigs))
	sb.WriteString(renderToolStatus("Codex", m.info.CodexConfigs))
	sb.WriteString(renderToolStatus("OpenCode", m.info.OpenCodeConfigs))

	sb.WriteString("\n" + hint("q back"))

	w := 52
	if m.width > 0 && m.width < w+4 {
		w = m.width - 4
	}
	return box(sb.String(), w)
}

func renderToolStatus(tool string, configs []config.Config) string {
	var sb strings.Builder
	sb.WriteString(styleSelected.Render(tool) + "\n")
	if len(configs) == 0 {
		sb.WriteString("  " + styleDim.Render("(not configured)") + "\n")
		return sb.String()
	}
	for _, c := range configs {
		name := c.DisplayName
		if name == "" {
			name = c.Name
		}
		sb.WriteString(fmt.Sprintf("  %-12s %s\n", styleDim.Render("config"), name+" ("+c.Name+")"))
		sb.WriteString(fmt.Sprintf("  %-12s %s\n", styleDim.Render("base url"), orNoneStr(c.BaseURL)))
		sb.WriteString(fmt.Sprintf("  %-12s %s\n", styleDim.Render("api key"), maskKeyStr(c.APIKey)))
		sb.WriteString(fmt.Sprintf("  %-12s %s\n", styleDim.Render("model"), orNoneStr(c.Model)))
	}
	return sb.String()
}

func orNoneStr(s string) string {
	if s == "" {
		return styleDim.Render("(none)")
	}
	return s
}

func maskKeyStr(key string) string {
	if key == "" {
		return styleDim.Render("(not set)")
	}
	visible := 4
	if len(key) <= visible {
		return strings.Repeat("*", len(key))
	}
	return key[:visible] + strings.Repeat("*", len(key)-visible)
}
