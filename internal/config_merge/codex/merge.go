// Package codexmerge provides schema-aware TOML merge utilities for
// ~/.codex/config.toml.
//
// Merge strategy:
//  1. FilterOwned strips QuickCLI-managed AND security-protected keys from an
//     incoming template TOML string so templates cannot overwrite values that
//     must remain under user/QuickCLI control.
//  2. Merge combines a "preserved" TOML string (user's existing non-QuickCLI
//     sections) with a "template extra" TOML string using the following rules:
//     - For regular tables: same section + same key → template wins (overwrite);
//       section exists but key missing → insert; section missing → insert whole.
//     - For "no-overwrite" tables (mcp_servers, permissions): template may only
//       ADD new entries; existing user-configured entries are never touched.
//     - Top-level scalars: template wins on conflict, otherwise inserted.
package codexmerge

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/pelletier/go-toml/v2"
)

// FilterOwned removes QuickCLI-owned keys from content and returns the
// filtered TOML string.  The result is safe to pass to Merge.
func FilterOwned(content string) (string, error) {
	if strings.TrimSpace(content) == "" {
		return "", nil
	}

	// Parse into a generic tree.
	var tree map[string]any
	if err := toml.Unmarshal([]byte(content), &tree); err != nil {
		return "", fmt.Errorf("filter owned: parse toml: %w", err)
	}

	// Remove owned top-level scalars (QuickCLI-managed).
	for k := range ownedScalars {
		delete(tree, k)
	}
	// Remove security-protected top-level scalars.
	for k := range protectedScalars {
		delete(tree, k)
	}

	// Remove owned tables (e.g. "model_providers").
	for k := range tree {
		if isOwnedTable(k) {
			delete(tree, k)
		}
	}

	if len(tree) == 0 {
		return "", nil
	}

	out, err := toml.Marshal(tree)
	if err != nil {
		return "", fmt.Errorf("filter owned: marshal toml: %w", err)
	}
	return string(out), nil
}

// Merge combines preserved (user's existing non-QuickCLI sections) with
// templateExtra (already filtered by FilterOwned).
//
// Rules:
//   - Top-level scalars: template wins on conflict, otherwise inserted.
//   - Table keys: template wins on conflict (same section + same key),
//     new keys/sections are inserted.
func Merge(preserved, templateExtra string) (string, error) {
	if strings.TrimSpace(templateExtra) == "" {
		return preserved, nil
	}
	if strings.TrimSpace(preserved) == "" {
		return templateExtra, nil
	}

	var pTree map[string]any
	if err := toml.Unmarshal([]byte(preserved), &pTree); err != nil {
		return "", fmt.Errorf("merge: parse preserved toml: %w", err)
	}
	if pTree == nil {
		pTree = map[string]any{}
	}

	var eTree map[string]any
	if err := toml.Unmarshal([]byte(templateExtra), &eTree); err != nil {
		return "", fmt.Errorf("merge: parse template extra toml: %w", err)
	}

	mergeInto(pTree, eTree)

	var buf bytes.Buffer
	enc := toml.NewEncoder(&buf)
	if err := enc.Encode(pTree); err != nil {
		return "", fmt.Errorf("merge: marshal result toml: %w", err)
	}
	return buf.String(), nil
}

// mergeInto deep-merges src into dst.
//
// For top-level keys that are "no-overwrite" tables (mcp_servers, permissions),
// only new sub-entries from src are inserted; existing dst entries are kept.
// For all other tables, src wins on key conflict (deep-merge for sub-tables,
// overwrite for scalars/arrays).
func mergeInto(dst, src map[string]any) {
	for k, srcVal := range src {
		dstVal, exists := dst[k]
		if !exists {
			dst[k] = srcVal
			continue
		}
		// Both exist — decide strategy based on table type.
		srcMap, srcIsMap := srcVal.(map[string]any)
		dstMap, dstIsMap := dstVal.(map[string]any)
		if srcIsMap && dstIsMap {
			if isNoOverwriteTable(k) {
				// Protected table: template may add new entries, never overwrite.
				mergeIntoAddOnly(dstMap, srcMap)
			} else {
				// Regular table: deep-merge, template wins on conflict.
				mergeIntoDeep(dstMap, srcMap)
			}
		} else {
			// Scalar or array conflict at top level → template wins.
			dst[k] = srcVal
		}
	}
}

// mergeIntoDeep recursively merges src into dst, with src winning on conflict.
func mergeIntoDeep(dst, src map[string]any) {
	for k, srcVal := range src {
		dstVal, exists := dst[k]
		if !exists {
			dst[k] = srcVal
			continue
		}
		srcMap, srcIsMap := srcVal.(map[string]any)
		dstMap, dstIsMap := dstVal.(map[string]any)
		if srcIsMap && dstIsMap {
			mergeIntoDeep(dstMap, srcMap)
		} else {
			dst[k] = srcVal
		}
	}
}

// mergeIntoAddOnly inserts keys from src into dst only when the key does not
// already exist in dst.  Existing dst entries are never modified.
// Used for security-sensitive tables such as mcp_servers and permissions.
func mergeIntoAddOnly(dst, src map[string]any) {
	for k, v := range src {
		if _, exists := dst[k]; !exists {
			dst[k] = v
		}
		// Key already present → skip; user's config takes precedence.
	}
}
