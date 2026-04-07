import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import type { CodexProfile } from "../types.js";
import { clearAuthMode, writeApiKey } from "./auth.js";
import { codexConfigFile, codexHome } from "./paths.js";

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function preservedSections(path: string): string {
  try {
    const data = readFileSync(path, "utf8");
    const lines = data.split("\n");
    const preserved: string[] = [];
    let inForeignSection = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("[")) {
        if (trimmed.startsWith("[model_providers.")) {
          inForeignSection = false;
          continue;
        }

        inForeignSection = true;
      }

      if (inForeignSection) {
        preserved.push(line);
      }
    }

    return preserved.join("\n").replace(/\n+$/u, "\n");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return "";
    }

    throw error;
  }
}

function buildManagedConfig(
  profiles: CodexProfile[],
  active: CodexProfile,
): string {
  const lines: string[] = [];

  lines.push(`model_provider = ${tomlString(active.name)}`);
  if (active.model) {
    lines.push(`model = ${tomlString(active.model)}`);
  }

  lines.push(
    `model_reasoning_effort = ${tomlString(active.reasoningEffort || "high")}`,
  );

  if (active.modelVerbosity) {
    lines.push(`model_verbosity = ${tomlString(active.modelVerbosity)}`);
  }

  lines.push("disable_response_storage = true");
  lines.push("");

  for (const profile of profiles) {
    lines.push(`[model_providers.${profile.name}]`);
    lines.push(`name = ${tomlString(profile.displayName || profile.name)}`);

    if (profile.baseUrl) {
      lines.push(`base_url = ${tomlString(profile.baseUrl)}`);
    }

    lines.push(`wire_api = ${tomlString(profile.wireApi || "responses")}`);

    if (profile.authMethod === "chatgpt" || profile.apiKey) {
      lines.push("requires_openai_auth = true");
    }

    lines.push("");
  }

  return `${lines.join("\n").replace(/\n+$/u, "")}\n`;
}

function writeCodexAuth(profile: CodexProfile): void {
  if (profile.authMethod === "chatgpt") {
    return;
  }

  if (profile.apiKey) {
    writeApiKey(profile.apiKey);
    return;
  }

  clearAuthMode();
}

export function applyCodexProfile(
  active: CodexProfile,
  profiles: CodexProfile[],
): void {
  mkdirSync(codexHome(), { recursive: true, mode: 0o700 });

  const preserved = preservedSections(codexConfigFile());
  const result = buildManagedConfig(profiles, active) + (preserved ? `\n${preserved}` : "");
  writeFileSync(codexConfigFile(), result, { mode: 0o600 });
  writeCodexAuth(active);
}
