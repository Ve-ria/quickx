import { describe, expect, it } from "vitest";

import {
  createProfileFromTemplate,
  findPlaceholders,
  getTemplateSetup,
  substituteTemplateValue,
} from "./templates.js";
import type { Template } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: "test",
    displayName: "Test",
    scope: ["codex"],
    baseUrl: "",
    apiKey: "",
    model: "",
    wireApi: "responses",
    authMethod: "api_key",
    docsUrl: "",
    requiredEnvs: [],
    reasoningEffort: "",
    modelVerbosity: "",
    codexTomlFile: "",
    codexTomlContent: "",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// findPlaceholders
// ---------------------------------------------------------------------------

describe("findPlaceholders", () => {
  it("returns empty array when there are no placeholders", () => {
    expect(findPlaceholders("https://api.openai.com/v1")).toEqual([]);
  });

  it("parses a placeholder with a default value", () => {
    const placeholders = findPlaceholders('${--:"Base URL":"https://api.example.com"}');
    expect(placeholders).toHaveLength(1);
    expect(placeholders[0]).toMatchObject({
      question: "Base URL",
      defaultValue: "https://api.example.com",
      secret: false,
    });
  });

  it("parses a placeholder without a default value", () => {
    const placeholders = findPlaceholders('${--:"Base URL"}');
    expect(placeholders).toHaveLength(1);
    expect(placeholders[0]?.defaultValue).toBe("");
  });

  it("detects secret placeholders by keyword", () => {
    const apiKey = findPlaceholders('${--:"OpenAI API Key":""}');
    expect(apiKey[0]?.secret).toBe(true);

    const token = findPlaceholders('${--:"Access Token":""}');
    expect(token[0]?.secret).toBe(true);

    const secret = findPlaceholders('${--:"Client Secret":""}');
    expect(secret[0]?.secret).toBe(true);

    const password = findPlaceholders('${--:"Password":""}');
    expect(password[0]?.secret).toBe(true);

    const baseUrl = findPlaceholders('${--:"Base URL":"https://example.com"}');
    expect(baseUrl[0]?.secret).toBe(false);
  });

  it("deduplicates repeated placeholders", () => {
    const value = '${--:"Model":"gpt-4o"} and ${--:"Model":"gpt-4o"}';
    expect(findPlaceholders(value)).toHaveLength(1);
  });

  it("returns multiple distinct placeholders", () => {
    const value = '${--:"Base URL":""} ${--:"API Key":""}';
    const placeholders = findPlaceholders(value);
    expect(placeholders).toHaveLength(2);
    expect(placeholders.map((p) => p.question)).toEqual(["Base URL", "API Key"]);
  });

  it("includes the full match string for later substitution", () => {
    const placeholder = findPlaceholders('${--:"Model":"gpt-4o"}')[0];
    expect(placeholder?.full).toBe('${--:"Model":"gpt-4o"}');
  });
});

// ---------------------------------------------------------------------------
// substituteTemplateValue
// ---------------------------------------------------------------------------

describe("substituteTemplateValue", () => {
  it("substitutes an answered placeholder", () => {
    const result = substituteTemplateValue(
      '${--:"Base URL":"https://example.com"}',
      { "Base URL": "https://custom.example.com" },
    );
    expect(result).toBe("https://custom.example.com");
  });

  it("uses the fallback when question is not in answers", () => {
    const result = substituteTemplateValue(
      '${--:"Base URL":"https://example.com"}',
      {},
    );
    expect(result).toBe("https://example.com");
  });

  it("returns empty string when answer is empty and there is no fallback", () => {
    const result = substituteTemplateValue('${--:"API Key":""}', { "API Key": "" });
    expect(result).toBe("");
  });

  it("leaves non-placeholder text unchanged", () => {
    const result = substituteTemplateValue("plain-value", { anything: "x" });
    expect(result).toBe("plain-value");
  });

  it("substitutes multiple placeholders in one string", () => {
    const result = substituteTemplateValue(
      '${--:"Host":""}/v1/${--:"Version":"1"}',
      { Host: "api.example.com", Version: "2" },
    );
    expect(result).toBe("api.example.com/v1/2");
  });
});

// ---------------------------------------------------------------------------
// getTemplateSetup
// ---------------------------------------------------------------------------

describe("getTemplateSetup", () => {
  it("collects placeholders from all relevant template fields", () => {
    const template = makeTemplate({
      baseUrl: '${--:"Base URL":""}',
      apiKey: '${--:"API Key":""}',
      model: '${--:"Model":"gpt-4o"}',
      reasoningEffort: '${--:"Reasoning effort":"high"}',
      modelVerbosity: '${--:"Verbosity":""}',
    });

    const setup = getTemplateSetup(template);
    const questions = setup.placeholders.map((p) => p.question);
    expect(questions).toContain("Base URL");
    expect(questions).toContain("API Key");
    expect(questions).toContain("Model");
    expect(questions).toContain("Reasoning effort");
    expect(questions).toContain("Verbosity");
  });

  it("deduplicates placeholders that appear in multiple fields", () => {
    const sharedPlaceholder = '${--:"API Key":""}';
    const template = makeTemplate({
      baseUrl: sharedPlaceholder,
      apiKey: sharedPlaceholder,
    });

    const setup = getTemplateSetup(template);
    expect(setup.placeholders.filter((p) => p.question === "API Key")).toHaveLength(1);
  });

  it("returns empty placeholders for a template with no magic syntax", () => {
    const template = makeTemplate({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "hardcoded-key",
    });
    expect(getTemplateSetup(template).placeholders).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// createProfileFromTemplate
// ---------------------------------------------------------------------------

describe("createProfileFromTemplate", () => {
  it("creates a ProfileInput with substituted values", () => {
    const template = makeTemplate({
      displayName: "My Provider",
      baseUrl: '${--:"Base URL":"https://api.example.com"}',
      apiKey: '${--:"API Key":""}',
      model: '${--:"Model":"gpt-4o"}',
      wireApi: "responses",
      authMethod: "api_key",
    });

    const profile = createProfileFromTemplate("my-profile", template, {
      "Base URL": "https://custom.example.com",
      "API Key": "sk-test",
      Model: "gpt-4.5",
    });

    expect(profile.name).toBe("my-profile");
    expect(profile.displayName).toBe("My Provider");
    expect(profile.baseUrl).toBe("https://custom.example.com");
    expect(profile.apiKey).toBe("sk-test");
    expect(profile.model).toBe("gpt-4.5");
    expect(profile.wireApi).toBe("responses");
    expect(profile.authMethod).toBe("api_key");
  });

  it("uses template defaults when answers are empty", () => {
    const template = makeTemplate({
      baseUrl: '${--:"Base URL":"https://default.example.com"}',
      model: '${--:"Model":"gpt-4o"}',
    });

    const profile = createProfileFromTemplate("p", template, {});
    expect(profile.baseUrl).toBe("https://default.example.com");
    expect(profile.model).toBe("gpt-4o");
  });
});
