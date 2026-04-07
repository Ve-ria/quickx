import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyCodexProfile } from "./codex.js";
import type { CodexProfile } from "../types.js";

// Redirect HOME so codex files land in a temp dir
let tmpHome: string;
const origHome = process.env.HOME;

beforeEach(() => {
  tmpHome = path.join(
    os.tmpdir(),
    `quickx-codex-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(path.join(tmpHome, ".codex"), { recursive: true });
  process.env.HOME = tmpHome;
});

afterEach(() => {
  if (origHome !== undefined) {
    process.env.HOME = origHome;
  } else {
    delete process.env.HOME;
  }
});

function readConfigToml(): string {
  return readFileSync(path.join(tmpHome, ".codex", "config.toml"), "utf8");
}

function makeProfile(overrides: Partial<CodexProfile> = {}): CodexProfile {
  return {
    name: "default",
    displayName: "Default",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o",
    wireApi: "responses",
    authMethod: "api_key",
    reasoningEffort: "high",
    modelVerbosity: "",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// TOML output structure
// ---------------------------------------------------------------------------

describe("applyCodexProfile — TOML output", () => {
  it("sets model_provider to the active profile name", () => {
    const profile = makeProfile({ name: "my-provider" });
    applyCodexProfile(profile, [profile]);
    expect(readConfigToml()).toContain('model_provider = "my-provider"');
  });

  it("sets model to the active profile model", () => {
    const profile = makeProfile({ model: "gpt-4o" });
    applyCodexProfile(profile, [profile]);
    expect(readConfigToml()).toContain('model = "gpt-4o"');
  });

  it("omits model line when model is empty", () => {
    const profile = makeProfile({ model: "" });
    applyCodexProfile(profile, [profile]);
    expect(readConfigToml()).not.toMatch(/^model = /m);
  });

  it("sets model_reasoning_effort from the active profile", () => {
    const profile = makeProfile({ reasoningEffort: "low" });
    applyCodexProfile(profile, [profile]);
    expect(readConfigToml()).toContain('model_reasoning_effort = "low"');
  });

  it("defaults reasoning effort to high when not set", () => {
    const profile = makeProfile({ reasoningEffort: "" });
    applyCodexProfile(profile, [profile]);
    expect(readConfigToml()).toContain('model_reasoning_effort = "high"');
  });

  it("omits model_verbosity when empty", () => {
    const profile = makeProfile({ modelVerbosity: "" });
    applyCodexProfile(profile, [profile]);
    expect(readConfigToml()).not.toContain("model_verbosity");
  });

  it("includes model_verbosity when set", () => {
    const profile = makeProfile({ modelVerbosity: "verbose" });
    applyCodexProfile(profile, [profile]);
    expect(readConfigToml()).toContain('model_verbosity = "verbose"');
  });

  it("always includes disable_response_storage = true", () => {
    const profile = makeProfile();
    applyCodexProfile(profile, [profile]);
    expect(readConfigToml()).toContain("disable_response_storage = true");
  });

  it("writes a section for every profile", () => {
    const alpha = makeProfile({ name: "alpha", displayName: "Alpha" });
    const beta = makeProfile({ name: "beta", displayName: "Beta" });
    applyCodexProfile(alpha, [alpha, beta]);
    const toml = readConfigToml();
    expect(toml).toContain('[model_providers.alpha]');
    expect(toml).toContain('[model_providers.beta]');
  });

  it("includes base_url in each provider section when set", () => {
    const profile = makeProfile({ baseUrl: "https://custom.api.com/v1" });
    applyCodexProfile(profile, [profile]);
    expect(readConfigToml()).toContain('base_url = "https://custom.api.com/v1"');
  });

  it("omits base_url when empty", () => {
    const profile = makeProfile({ baseUrl: "" });
    applyCodexProfile(profile, [profile]);
    const section = readConfigToml().split("[model_providers.")[1] ?? "";
    expect(section).not.toContain("base_url");
  });

  it("sets requires_openai_auth = true for chatgpt authMethod", () => {
    const profile = makeProfile({ authMethod: "chatgpt", apiKey: "" });
    applyCodexProfile(profile, [profile]);
    expect(readConfigToml()).toContain("requires_openai_auth = true");
  });

  it("sets requires_openai_auth = true when api key is present", () => {
    const profile = makeProfile({ authMethod: "api_key", apiKey: "sk-test" });
    applyCodexProfile(profile, [profile]);
    expect(readConfigToml()).toContain("requires_openai_auth = true");
  });

  it("omits requires_openai_auth when api_key auth with no key", () => {
    const profile = makeProfile({ authMethod: "api_key", apiKey: "" });
    applyCodexProfile(profile, [profile]);
    expect(readConfigToml()).not.toContain("requires_openai_auth");
  });
});

// ---------------------------------------------------------------------------
// preservedSections — user sections survive rewrites
// ---------------------------------------------------------------------------

describe("applyCodexProfile — preserves non-managed sections", () => {
  it("retains foreign sections from an existing config", () => {
    const existing = `model_provider = "old"\n\n[history]\nmax_entries = 100\n\n[model_providers.old]\nname = "Old"\n`;
    writeFileSync(path.join(tmpHome, ".codex", "config.toml"), existing);

    const profile = makeProfile({ name: "new-profile" });
    applyCodexProfile(profile, [profile]);

    const toml = readConfigToml();
    expect(toml).toContain("[history]");
    expect(toml).toContain("max_entries = 100");
  });

  it("strips old [model_providers.*] sections and replaces with new ones", () => {
    const existing = `model_provider = "old"\n\n[model_providers.old]\nname = "Old"\n`;
    writeFileSync(path.join(tmpHome, ".codex", "config.toml"), existing);

    const profile = makeProfile({ name: "fresh" });
    applyCodexProfile(profile, [profile]);

    const toml = readConfigToml();
    expect(toml).not.toContain('[model_providers.old]');
    expect(toml).toContain('[model_providers.fresh]');
  });
});
