import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { QuickxApi } from "./api.js";

let tmpDir: string;
const origHome = process.env.HOME;

beforeEach(() => {
  tmpDir = path.join(
    os.tmpdir(),
    `quickx-api-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(tmpDir, { recursive: true });
  process.env.XDG_CONFIG_HOME = tmpDir;
  process.env.HOME = tmpDir;
  mkdirSync(path.join(tmpDir, ".codex"), { recursive: true });
});

afterEach(() => {
  delete process.env.XDG_CONFIG_HOME;
  if (origHome !== undefined) {
    process.env.HOME = origHome;
  } else {
    delete process.env.HOME;
  }
});

function makeApi(): QuickxApi {
  return new QuickxApi();
}

// ---------------------------------------------------------------------------
// duplicateProfile
// ---------------------------------------------------------------------------

describe("QuickxApi.duplicateProfile", () => {
  it("creates a copy of an existing profile", () => {
    const api = makeApi();
    api.addProfile({ name: "original", model: "gpt-4o", baseUrl: "https://api.example.com" });
    const copy = api.duplicateProfile("original", "copy");

    expect(copy.name).toBe("copy");
    expect(copy.model).toBe("gpt-4o");
    expect(copy.baseUrl).toBe("https://api.example.com");

    const profiles = api.listProfiles().profiles;
    expect(profiles).toHaveLength(2);
    expect(profiles.map((p) => p.name)).toContain("copy");
  });

  it("throws when source does not exist", () => {
    const api = makeApi();
    expect(() => api.duplicateProfile("ghost", "copy")).toThrow(/No profile named "ghost"/);
  });

  it("throws when new name already exists", () => {
    const api = makeApi();
    api.addProfile({ name: "alpha" });
    api.addProfile({ name: "beta" });
    expect(() => api.duplicateProfile("alpha", "beta")).toThrow(/already exists/);
  });
});

// ---------------------------------------------------------------------------
// renameProfile
// ---------------------------------------------------------------------------

describe("QuickxApi.renameProfile", () => {
  it("renames a profile", () => {
    const api = makeApi();
    api.addProfile({ name: "old-name", model: "gpt-4o" });
    api.renameProfile("old-name", "new-name");

    const profiles = api.listProfiles().profiles;
    expect(profiles.map((p) => p.name)).not.toContain("old-name");
    expect(profiles.map((p) => p.name)).toContain("new-name");
  });

  it("preserves profile data after rename", () => {
    const api = makeApi();
    api.addProfile({ name: "src", model: "gpt-4o", baseUrl: "https://api.example.com" });
    const renamed = api.renameProfile("src", "dst");

    expect(renamed.model).toBe("gpt-4o");
    expect(renamed.baseUrl).toBe("https://api.example.com");
  });

  it("updates activeProfile if the active profile is renamed", () => {
    const api = makeApi();
    api.addProfile({ name: "active" });
    api.useProfile("active");

    api.renameProfile("active", "renamed");
    expect(api.listProfiles().activeProfile).toBe("renamed");
  });

  it("throws when source does not exist", () => {
    const api = makeApi();
    expect(() => api.renameProfile("ghost", "new")).toThrow(/No profile named "ghost"/);
  });
});

// ---------------------------------------------------------------------------
// exportProfiles / importProfiles
// ---------------------------------------------------------------------------

describe("QuickxApi.exportProfiles", () => {
  it("exports all profiles as JSON", () => {
    const api = makeApi();
    api.addProfile({ name: "alpha", model: "gpt-4o" });
    api.addProfile({ name: "beta", model: "gpt-3.5" });

    const json = api.exportProfiles();
    const data = JSON.parse(json) as { profiles: Array<{ name: string }> };

    expect(data.profiles).toHaveLength(2);
    expect(data.profiles.map((p) => p.name)).toContain("alpha");
    expect(data.profiles.map((p) => p.name)).toContain("beta");
  });

  it("exports an empty array when there are no profiles", () => {
    const api = makeApi();
    const data = JSON.parse(api.exportProfiles()) as { profiles: unknown[] };
    expect(data.profiles).toHaveLength(0);
  });
});

describe("QuickxApi.importProfiles", () => {
  it("imports profiles from a JSON export into a fresh store", () => {
    const exporter = makeApi();
    exporter.addProfile({ name: "alpha", model: "gpt-4o" });
    exporter.addProfile({ name: "beta", model: "gpt-3.5" });
    const json = exporter.exportProfiles();

    // Fresh config dir so the importer starts empty
    const importDir = path.join(tmpDir, "fresh-import");
    mkdirSync(importDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = importDir;

    const importer = makeApi();
    const result = importer.importProfiles(json);
    expect(result.added).toBe(2);
    expect(result.skipped).toBe(0);
    expect(importer.listProfiles().profiles).toHaveLength(2);
  });

  it("skips existing profiles by default", () => {
    const api = makeApi();
    api.addProfile({ name: "alpha", model: "gpt-4o" });
    const json = api.exportProfiles();

    const result = api.importProfiles(json);
    expect(result.skipped).toBe(1);
    expect(result.added).toBe(0);
    expect(api.listProfiles().profiles).toHaveLength(1);
  });

  it("overwrites existing profiles with --overwrite flag", () => {
    const api = makeApi();
    api.addProfile({ name: "alpha", model: "gpt-4o" });

    const exportData = JSON.stringify({ profiles: [{ name: "alpha", model: "gpt-5", displayName: "", baseUrl: "", apiKey: "", wireApi: "responses", authMethod: "api_key", reasoningEffort: "", modelVerbosity: "" }] });
    const result = api.importProfiles(exportData, true);

    expect(result.added).toBe(1);
    const profile = api.listProfiles().profiles.find((p) => p.name === "alpha");
    expect(profile?.model).toBe("gpt-5");
  });

  it("throws for malformed JSON", () => {
    const api = makeApi();
    expect(() => api.importProfiles("not json")).toThrow();
  });

  it("throws when profiles array is missing", () => {
    const api = makeApi();
    expect(() => api.importProfiles('{"version":1}')).toThrow(/missing profiles array/);
  });
});

// ---------------------------------------------------------------------------
// Error messages with similar name suggestions
// ---------------------------------------------------------------------------

describe("Error suggestions", () => {
  it("suggests similar profile names when profile is not found", () => {
    const api = makeApi();
    api.addProfile({ name: "openai" });
    api.addProfile({ name: "azure" });

    expect(() => api.useProfile("opneai")).toThrow(/Did you mean.*openai/);
  });

  it("gives no suggestions when no similar names exist", () => {
    const api = makeApi();
    api.addProfile({ name: "openai" });

    const err = (() => {
      try { api.useProfile("zzz"); } catch (e) { return e as Error; }
    })();
    expect(err?.message).not.toContain("Did you mean");
  });
});
