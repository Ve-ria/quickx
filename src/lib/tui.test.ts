import { describe, expect, it } from "vitest";

import {
  defaultAddDraft,
  defaultEditDraft,
  isPrintableInput,
  nextFieldIndex,
  prevFieldIndex,
  profileToEditDraft,
  statusLines,
} from "./tui.js";
import type { CodexProfile, StatusInfo } from "../types.js";

// ---------------------------------------------------------------------------
// nextFieldIndex / prevFieldIndex
// ---------------------------------------------------------------------------

describe("nextFieldIndex", () => {
  it("advances to the next field", () => {
    expect(nextFieldIndex(0, 5)).toBe(1);
    expect(nextFieldIndex(3, 5)).toBe(4);
  });

  it("wraps around at the end", () => {
    expect(nextFieldIndex(4, 5)).toBe(0);
  });

  it("wraps with a single field", () => {
    expect(nextFieldIndex(0, 1)).toBe(0);
  });
});

describe("prevFieldIndex", () => {
  it("goes back to the previous field", () => {
    expect(prevFieldIndex(3, 5)).toBe(2);
    expect(prevFieldIndex(1, 5)).toBe(0);
  });

  it("wraps around at the start", () => {
    expect(prevFieldIndex(0, 5)).toBe(4);
  });

  it("wraps with a single field", () => {
    expect(prevFieldIndex(0, 1)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isPrintableInput
// ---------------------------------------------------------------------------

describe("isPrintableInput", () => {
  it("returns true for printable ASCII characters", () => {
    expect(isPrintableInput("a", {})).toBe(true);
    expect(isPrintableInput("Z", {})).toBe(true);
    expect(isPrintableInput("5", {})).toBe(true);
    expect(isPrintableInput(" ", {})).toBe(true);
    expect(isPrintableInput("!", {})).toBe(true);
  });

  it("returns false when ctrl is held", () => {
    expect(isPrintableInput("a", { ctrl: true })).toBe(false);
  });

  it("returns false when meta is held", () => {
    expect(isPrintableInput("a", { meta: true })).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(isPrintableInput("", {})).toBe(false);
  });

  it("returns false for non-printable characters", () => {
    expect(isPrintableInput("\x00", {})).toBe(false); // NUL
    expect(isPrintableInput("\x1b", {})).toBe(false); // ESC
    expect(isPrintableInput("\x7f", {})).toBe(false); // DEL
  });

  it("returns false for multi-character strings", () => {
    expect(isPrintableInput("ab", {})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// profileToEditDraft
// ---------------------------------------------------------------------------

describe("profileToEditDraft", () => {
  const profile: CodexProfile = {
    name: "my-profile",
    displayName: "My Profile",
    baseUrl: "https://api.example.com/v1",
    apiKey: "sk-secret",
    model: "gpt-4o",
    wireApi: "responses",
    authMethod: "api_key",
    reasoningEffort: "high",
    modelVerbosity: "",
  };

  it("copies all editable fields", () => {
    const draft = profileToEditDraft(profile);
    expect(draft.displayName).toBe("My Profile");
    expect(draft.baseUrl).toBe("https://api.example.com/v1");
    expect(draft.apiKey).toBe("sk-secret");
    expect(draft.model).toBe("gpt-4o");
    expect(draft.wireApi).toBe("responses");
    expect(draft.authMethod).toBe("api_key");
  });

  it("does not include the profile name (name is not editable)", () => {
    const draft = profileToEditDraft(profile);
    expect(draft).not.toHaveProperty("name");
  });
});

// ---------------------------------------------------------------------------
// defaultAddDraft / defaultEditDraft
// ---------------------------------------------------------------------------

describe("defaultAddDraft", () => {
  it("returns sensible defaults", () => {
    const draft = defaultAddDraft();
    expect(draft.name).toBe("");
    expect(draft.wireApi).toBe("responses");
    expect(draft.authMethod).toBe("api_key");
    expect(draft.baseUrl).toBeTruthy();
  });
});

describe("defaultEditDraft", () => {
  it("returns sensible defaults", () => {
    const draft = defaultEditDraft();
    expect(draft.wireApi).toBe("responses");
    expect(draft.authMethod).toBe("api_key");
  });
});

// ---------------------------------------------------------------------------
// statusLines
// ---------------------------------------------------------------------------

describe("statusLines", () => {
  const baseInfo: StatusInfo = {
    activeProfile: "",
    configFile: "/home/user/.config/quickx/config.json",
    codexConfigFile: "/home/user/.codex/config.toml",
    authFile: "/home/user/.codex/auth.json",
    loggedInEmail: "",
    profiles: [],
  };

  it("includes config file paths", () => {
    const lines = statusLines(baseInfo);
    expect(lines.some((l) => l.includes("/home/user/.config/quickx/config.json"))).toBe(true);
    expect(lines.some((l) => l.includes("/home/user/.codex/config.toml"))).toBe(true);
  });

  it("shows (none) when no active profile", () => {
    const lines = statusLines(baseInfo);
    expect(lines.some((l) => l.includes("(none)"))).toBe(true);
  });

  it("shows (none) for empty profile list", () => {
    const lines = statusLines(baseInfo);
    expect(lines.some((l) => l.trim() === "(none)")).toBe(true);
  });

  it("marks the active profile with *", () => {
    const info: StatusInfo = {
      ...baseInfo,
      activeProfile: "default",
      profiles: [
        {
          name: "default",
          displayName: "Default",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "",
          model: "gpt-4o",
          wireApi: "responses",
          authMethod: "api_key",
          reasoningEffort: "",
          modelVerbosity: "",
        },
        {
          name: "other",
          displayName: "Other",
          baseUrl: "https://other.example.com/v1",
          apiKey: "",
          model: "gpt-3.5",
          wireApi: "chat",
          authMethod: "api_key",
          reasoningEffort: "",
          modelVerbosity: "",
        },
      ],
    };

    const lines = statusLines(info);
    expect(lines.some((l) => l.includes("*") && l.includes("Default"))).toBe(true);
    expect(lines.some((l) => l.includes(" ") && l.includes("Other"))).toBe(true);
  });

  it("shows logged in email when available", () => {
    const info: StatusInfo = { ...baseInfo, loggedInEmail: "user@example.com" };
    const lines = statusLines(info);
    expect(lines.some((l) => l.includes("user@example.com"))).toBe(true);
  });
});
