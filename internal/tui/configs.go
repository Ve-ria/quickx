package tui

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/quickcli/quick/internal/app"
	"github.com/quickcli/quick/internal/config"
	tmplpkg "github.com/quickcli/quick/internal/template"
)

// --- result messages ---

type configActivatedMsg struct{ name string }
type configAddedMsg struct{ name string }
type configRemovedMsg struct{ name string }

// ─────────────────────────────────────────────────────────────────────────────
// Config list screen
// ─────────────────────────────────────────────────────────────────────────────

type configListScreen struct {
	api        *app.API
	items      []config.Config
	cursor     int
	selectMode bool // enter activates vs just manages
	width      int
}

func newConfigListScreen(api *app.API, selectMode bool) *configListScreen {
	return &configListScreen{
		api:        api,
		items:      api.ListConfigs(),
		selectMode: selectMode,
	}
}

func (m *configListScreen) Init() tea.Cmd { return nil }

func (m *configListScreen) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width

	case ScreenFocusedMsg:
		m.items = m.api.ListConfigs()
		if m.cursor >= len(m.items) && m.cursor > 0 {
			m.cursor = len(m.items) - 1
		}

	case configActivatedMsg:
		m.items = m.api.ListConfigs()
		return m, FlashOK(fmt.Sprintf("Config %q activated. Restart shell to apply env vars.", msg.name))

	case configAddedMsg:
		m.items = m.api.ListConfigs()
		return m, FlashOK(fmt.Sprintf("Config %q added.", msg.name))

	case configRemovedMsg:
		m.items = m.api.ListConfigs()
		if m.cursor >= len(m.items) && m.cursor > 0 {
			m.cursor = len(m.items) - 1
		}
		return m, FlashOK(fmt.Sprintf("Config %q removed.", msg.name))

	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q", "esc":
			return m, Pop()
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "down", "j":
			if m.cursor < len(m.items)-1 {
				m.cursor++
			}
		case "enter", " ":
			if len(m.items) == 0 {
				return m, nil
			}
			if m.selectMode {
				name := m.items[m.cursor].Name
				return m, func() tea.Msg {
					if err := m.api.UseConfig(name); err != nil {
						return FlashMsg{err.Error(), true}
					}
					return configActivatedMsg{name}
				}
			}
		case "a":
			return m, Push(newConfigAddScreen(m.api, nil))
		case "t":
			return m, Push(newTemplateListScreen(m.api))
		case "d", "delete":
			if len(m.items) == 0 {
				return m, nil
			}
			name := m.items[m.cursor].Name
			return m, Push(newConfirmScreen(
				fmt.Sprintf("Remove config %q?", name),
				tea.Sequence(
					Pop(),
					func() tea.Msg {
						if err := m.api.RemoveConfig(name); err != nil {
							return FlashMsg{err.Error(), true}
						}
						return configRemovedMsg{name}
					},
				),
			))
		}
	}
	return m, nil
}

func (m *configListScreen) View() string {
	var sb strings.Builder
	title := "Configs"
	if m.selectMode {
		title = "Use a Config"
	}
	sb.WriteString(styleTitle.Render(title) + "\n\n")

	active := m.api.ActiveConfig()

	if len(m.items) == 0 {
		sb.WriteString(styleDim.Render("No configs yet. Press a to add one.") + "\n\n")
	} else {
		for i, c := range m.items {
			scope := strings.Join(c.Scope, ",")
			activeMarker := ""
			if c.Name == active {
				activeMarker = "  " + styleSuccess.Render("✓")
			}
			line := fmt.Sprintf("%-18s %-14s %s%s", c.Name, scope, styleDim.Render(c.DisplayName), activeMarker)
			if i == m.cursor {
				sb.WriteString(styleSelected.Render("> "+line) + "\n")
			} else {
				sb.WriteString("  " + line + "\n")
			}
		}
		sb.WriteString("\n")
	}

	if m.selectMode {
		sb.WriteString(hint("enter activate  a add  t from-template  d delete  q back"))
	} else {
		sb.WriteString(hint("a add  t from-template  d delete  q back"))
	}

	w := 60
	if m.width > 0 && m.width < w+4 {
		w = m.width - 4
	}
	return box(sb.String(), w)
}

// ─────────────────────────────────────────────────────────────────────────────
// Config add screen (wraps wizardScreen)
// ─────────────────────────────────────────────────────────────────────────────

type configAddScreen struct {
	inner tea.Model
}

func newConfigAddScreen(api *app.API, tmpl *tmplpkg.Template) *configAddScreen {
	var fields []Field
	var doAdd func(answers []string) error

	if tmpl == nil {
		// Custom mode.
		fields = []Field{
			{Label: "Config name", Placeholder: "my-config"},
			{Label: "Scope (codex / claudecode / opencode / any comma-combo)", Default: "codex"},
			{Label: "Base URL", Placeholder: "https://api.example.com/v1"},
			{Label: "API Key (leave blank to skip)", Secret: true},
			{Label: "Default model (optional)", Placeholder: "gpt-4o"},
			{Label: "Wire API", Default: "responses", Placeholder: "responses or chat"},
			{Label: "Auth method", Default: "api_key", Placeholder: "api_key / chatgpt / aws / gcp / azure"},
		}
		doAdd = func(a []string) error {
			return api.AddConfig(config.Config{
				Name:       a[0],
				Scope:      parseScopeStr(a[1]),
				BaseURL:    a[2],
				APIKey:     a[3],
				Model:      a[4],
				WireAPI:    a[5],
				AuthMethod: a[6],
			})
		}
	} else {
		// Template mode: name first, then dynamic placeholders from magic syntax.
		combined := strings.Join([]string{tmpl.APIKey, tmpl.Model, tmpl.BaseURL}, "|")
		placeholders := tmplpkg.FindPlaceholders(combined)

		fields = append(fields, Field{Label: "Config name", Default: tmpl.ID})
		for _, ph := range placeholders {
			fields = append(fields, Field{
				Label:   ph.Question(),
				Default: ph.Default(),
				Secret:  strings.Contains(strings.ToLower(ph.Question()), "key"),
			})
		}

		doAdd = func(a []string) error {
			name := a[0]
			answerMap := map[string]string{}
			combined2 := strings.Join([]string{tmpl.APIKey, tmpl.Model, tmpl.BaseURL}, "|")
			phs := tmplpkg.FindPlaceholders(combined2)
			for i, ph := range phs {
				if i+1 < len(a) {
					answerMap[ph.Question()] = a[i+1]
				}
			}
			return api.CreateConfigFromTemplate(name, *tmpl, answerMap)
		}
	}

	onDone := func(answers []string) tea.Cmd {
		return tea.Sequence(
			Pop(),
			func() tea.Msg {
				if err := doAdd(answers); err != nil {
					return FlashMsg{err.Error(), true}
				}
				return configAddedMsg{answers[0]}
			},
		)
	}

	return &configAddScreen{
		inner: newWizardScreen("Add Config", fields, onDone, Pop()),
	}
}

func (m *configAddScreen) Init() tea.Cmd { return m.inner.Init() }

func (m *configAddScreen) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	m.inner, cmd = m.inner.Update(msg)
	return m, cmd
}

func (m *configAddScreen) View() string { return m.inner.View() }

// parseScopeStr splits "codex,claudecode" → ["codex","claudecode"].
func parseScopeStr(s string) []string {
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
