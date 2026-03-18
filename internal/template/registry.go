package template

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/quickcli/quick/pkg/xdg"
	"gopkg.in/yaml.v3"
)

const (
	registryOwner  = "AmethystDev-Labs"
	registryRepo   = "QuickCLI"
	registryBranch = "main"
	registryPath   = "templates"
	// GitHub API endpoint to list the templates/ directory of the repo.
	registryAPIURL = "https://api.github.com/repos/" + registryOwner + "/" + registryRepo + "/contents/" + registryPath + "?ref=" + registryBranch
	cacheTTL       = 1 * time.Hour
)

// cacheDir returns the path for the local template cache.
func cacheDir() string {
	return filepath.Join(xdg.ConfigHome(), "template-cache")
}

// cacheIndexPath returns the path for the cached index JSON.
func cacheIndexPath() string {
	return filepath.Join(cacheDir(), "index.json")
}

// RegistryEntry is one entry from the GitHub API directory listing.
type registryEntry struct {
	Name        string `json:"name"`
	Type        string `json:"type"` // "dir" or "file"
	DownloadURL string `json:"download_url"`
}

// FetchAll returns the full template list.
// It first tries the local cache, then the remote GitHub registry.
// If the registry is unreachable (no internet, repo not yet created, etc.)
// it falls back to the built-in templates bundled with the binary.
func FetchAll() ([]Template, error) {
	remote, err := fetchFromGitHub()
	if err == nil && len(remote) > 0 {
		merged := mergeTemplates(builtinTemplates, remote)
		return merged, nil
	}
	// Remote unavailable — try local cache, then fall back to built-ins.
	if cached, ok := loadCache(); ok {
		return mergeTemplates(builtinTemplates, cached), nil
	}
	return builtinTemplates, nil
}

// mergeTemplates returns base overridden by any remote entry with the same ID,
// plus any remote entries whose IDs don't exist in base.
func mergeTemplates(base, remote []Template) []Template {
	byID := make(map[string]Template, len(base))
	order := make([]string, 0, len(base))
	for _, t := range base {
		byID[t.ID] = t
		order = append(order, t.ID)
	}
	for _, t := range remote {
		if _, exists := byID[t.ID]; !exists {
			order = append(order, t.ID)
		}
		byID[t.ID] = t
	}
	out := make([]Template, 0, len(order))
	for _, id := range order {
		out = append(out, byID[id])
	}
	return out
}

func loadCache() ([]Template, bool) {
	info, err := os.Stat(cacheIndexPath())
	if err != nil {
		return nil, false
	}
	if time.Since(info.ModTime()) > cacheTTL {
		return nil, false
	}
	data, err := os.ReadFile(cacheIndexPath())
	if err != nil {
		return nil, false
	}
	var templates []Template
	if err := json.Unmarshal(data, &templates); err != nil {
		return nil, false
	}
	return templates, true
}

func saveCache(templates []Template) {
	_ = os.MkdirAll(cacheDir(), 0o700)
	data, err := json.Marshal(templates)
	if err != nil {
		return
	}
	_ = os.WriteFile(cacheIndexPath(), data, 0o600)
}

func fetchFromGitHub() ([]Template, error) {
	entries, err := listRegistryEntries()
	if err != nil {
		return nil, err
	}

	var templates []Template
	for _, e := range entries {
		if e.Type != "dir" {
			continue
		}
		// loadFiles=false: listing only, no extra file downloads.
		tmpl, err := fetchTemplate(e.Name, false)
		if err != nil {
			// Skip unreadable templates rather than failing entirely.
			continue
		}
		templates = append(templates, *tmpl)
	}

	saveCache(templates)
	return templates, nil
}

func listRegistryEntries() ([]registryEntry, error) {
	resp, err := httpGet(registryAPIURL)
	if err != nil {
		return nil, fmt.Errorf("fetch template registry: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("template registry returned %s", resp.Status)
	}
	var entries []registryEntry
	if err := json.NewDecoder(resp.Body).Decode(&entries); err != nil {
		return nil, fmt.Errorf("decode registry index: %w", err)
	}
	return entries, nil
}

// fetchTemplate fetches a single template's YAML from GitHub.
// When loadFiles is true and the template declares a codex_toml_file, the
// referenced file is also fetched and stored in Template.CodexTomlContent.
func fetchTemplate(id string, loadFiles bool) (*Template, error) {
	rawURL := fmt.Sprintf(
		"https://raw.githubusercontent.com/%s/%s/%s/%s/%s/template.yaml",
		registryOwner, registryRepo, registryBranch, registryPath, id,
	)
	resp, err := httpGet(rawURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("template %q returned %s", id, resp.Status)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var tmpl Template
	if err := yaml.Unmarshal(body, &tmpl); err != nil {
		return nil, err
	}
	if tmpl.ID == "" {
		tmpl.ID = id
	}

	if loadFiles && tmpl.CodexTomlFile != "" {
		tomlURL := fmt.Sprintf(
			"https://raw.githubusercontent.com/%s/%s/%s/%s/%s/%s",
			registryOwner, registryRepo, registryBranch, registryPath, id, tmpl.CodexTomlFile,
		)
		if content, fetchErr := fetchRawText(tomlURL); fetchErr == nil {
			tmpl.CodexTomlContent = content
		}
		// Silently ignore fetch errors — the field stays empty and the writer
		// will simply skip the merge step.
	}

	return &tmpl, nil
}

// FetchByID fetches a single template by id or by raw URL, including any
// associated template files (e.g. codex_toml_file).  It is used when the user
// is actually applying a template, so we need the full content.
func FetchByID(idOrURL string) (*Template, error) {
	if strings.HasPrefix(idOrURL, "http://") || strings.HasPrefix(idOrURL, "https://") {
		return fetchTemplateFromURL(idOrURL)
	}
	// Check built-ins first so the tool works offline.
	for _, t := range builtinTemplates {
		if t.ID == idOrURL {
			copy := t
			return &copy, nil
		}
	}
	// loadFiles=true: fetch associated files (codex_toml_file) as well.
	return fetchTemplate(idOrURL, true)
}

func fetchTemplateFromURL(rawURL string) (*Template, error) {
	resp, err := httpGet(rawURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var tmpl Template
	if err := yaml.Unmarshal(body, &tmpl); err != nil {
		return nil, err
	}
	return &tmpl, nil
}

func httpGet(url string) (*http.Response, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "quickcli/quick")
	return client.Do(req)
}

// fetchRawText fetches a URL and returns its body as a string.
func fetchRawText(url string) (string, error) {
	resp, err := httpGet(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("fetch %s: %s", url, resp.Status)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}
