import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { emptyStore, getProfile, loadStore, normalizeProfile, saveStore } from "./store.js";

// Redirect config to a temp dir so tests never touch real config
let tmpDir: string;

beforeEach(() => {
  tmpDir = path.join(os.tmpdir(), `quickx-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  process.env.XDG_CONFIG_HOME = tmpDir;
});

afterEach(() => {
  delete process.env.XDG_CONFIG_HOME;
});

// ---------------------------------------------------------------------------
// normalizeProfile
// ---------------------------------------------------------------------------

describe("normalizeProfile", () => {
  it("creates a profile with all required fields", () => {
    const profile = normalizeProfile({
      name: "my-profile",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-abc",
      model: "gpt-4o",
    });

    expect(profile.name).toBe("my-profile");
    expect(profile.baseUrl).toBe("https://api.openai.com/v1");
    expect(profile.apiKey).toBe("sk-abc");
    expect(profile.model).toBe("gpt-4o");
  });

  it("defaults displayName to name when not provided", () => {
    const profile = normalizeProfile({ name: "foo" });
    expect(profile.displayName).toBe("foo");
  });

  it("defaults wireApi to responses", () => {
    expect(normalizeProfile({ name: "foo" }).wireApi).toBe("responses");
  });

  it("accepts chat wireApi", () => {
    expect(normalizeProfile({ name: "foo", wireApi: "chat" }).wireApi).toBe("chat");
  });

  it("defaults authMethod to api_key", () => {
    expect(normalizeProfile({ name: "foo" }).authMethod).toBe("api_key");
  });

  it("accepts chatgpt authMethod", () => {
    expect(normalizeProfile({ name: "foo", authMethod: "chatgpt" }).authMethod).toBe("chatgpt");
  });

  it("trims whitespace from name", () => {
    const profile = normalizeProfile({ name: "  trimmed  " });
    expect(profile.name).toBe("trimmed");
  });

  it("throws when name is empty", () => {
    expect(() => normalizeProfile({ name: "" })).toThrow("Profile name is required");
  });

  it("throws when name is only whitespace", () => {
    expect(() => normalizeProfile({ name: "   " })).toThrow("Profile name is required");
  });

  it("throws when name contains spaces", () => {
    expect(() => normalizeProfile({ name: "my profile" })).toThrow(
      /contain only/,
    );
  });

  it("throws when name contains special characters", () => {
    expect(() => normalizeProfile({ name: "profile[1]" })).toThrow(/contain only/);
    expect(() => normalizeProfile({ name: "foo=bar" })).toThrow(/contain only/);
    expect(() => normalizeProfile({ name: "foo.bar" })).toThrow(/contain only/);
  });

  it("allows hyphens and underscores in name", () => {
    expect(() => normalizeProfile({ name: "my-profile_v2" })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// saveStore / loadStore (atomic write round-trip)
// ---------------------------------------------------------------------------

describe("saveStore + loadStore", () => {
  it("round-trips store data through disk", () => {
    const store = {
      ...emptyStore(),
      activeProfile: "default",
      profiles: [
        normalizeProfile({ name: "default", model: "gpt-4o", apiKey: "sk-test" }),
      ],
    };

    saveStore(store);
    const loaded = loadStore();

    expect(loaded.activeProfile).toBe("default");
    expect(loaded.profiles).toHaveLength(1);
    expect(loaded.profiles[0]?.name).toBe("default");
    expect(loaded.profiles[0]?.model).toBe("gpt-4o");
  });

  it("does not leave a .tmp file after saving", () => {
    saveStore(emptyStore());
    const configDir = path.join(tmpDir, "quickx");
    const files = readdirSync(configDir);
    expect(files.some((f) => f.endsWith(".tmp"))).toBe(false);
  });

  it("returns emptyStore when config file does not exist", () => {
    const store = loadStore();
    expect(store).toEqual(emptyStore());
  });

  it("throws for invalid JSON", () => {
    const configDir = path.join(tmpDir, "quickx");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(path.join(configDir, "config.json"), "not json");
    expect(() => loadStore()).toThrow();
  });

  it("silently drops profiles with invalid names (backward compat)", () => {
    // Simulate a config written before name validation was added
    const configDir = path.join(tmpDir, "quickx");
    mkdirSync(configDir, { recursive: true });
    const raw = {
      version: 1,
      activeProfile: "",
      profiles: [
        { name: "valid-profile", displayName: "", baseUrl: "", apiKey: "", model: "", wireApi: "responses", authMethod: "api_key", reasoningEffort: "", modelVerbosity: "" },
        { name: "has.dots", displayName: "", baseUrl: "", apiKey: "", model: "", wireApi: "responses", authMethod: "api_key", reasoningEffort: "", modelVerbosity: "" },
        { name: "has spaces", displayName: "", baseUrl: "", apiKey: "", model: "", wireApi: "responses", authMethod: "api_key", reasoningEffort: "", modelVerbosity: "" },
        { name: "", displayName: "" },
      ],
    };
    writeFileSync(path.join(configDir, "config.json"), JSON.stringify(raw));
    // Must not throw — invalid profiles are silently dropped
    const loaded = loadStore();
    expect(loaded.profiles).toHaveLength(1);
    expect(loaded.profiles[0]?.name).toBe("valid-profile");
  });
});

// ---------------------------------------------------------------------------
// getProfile
// ---------------------------------------------------------------------------

describe("getProfile", () => {
  it("returns the matching profile", () => {
    const store = {
      ...emptyStore(),
      profiles: [
        normalizeProfile({ name: "alpha" }),
        normalizeProfile({ name: "beta" }),
      ],
    };

    expect(getProfile(store, "alpha")?.name).toBe("alpha");
    expect(getProfile(store, "beta")?.name).toBe("beta");
  });

  it("returns undefined when profile does not exist", () => {
    expect(getProfile(emptyStore(), "missing")).toBeUndefined();
  });
});
