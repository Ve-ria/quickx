import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearAuthMode,
  currentCodexLoginEmail,
  emailFromIdToken,
  readAuthFile,
  writeApiKey,
} from "./auth.js";

// Redirect HOME so auth.json lands in a temp dir
let tmpHome: string;
const origHome = process.env.HOME;

beforeEach(() => {
  tmpHome = path.join(
    os.tmpdir(),
    `quickx-auth-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

// ---------------------------------------------------------------------------
// emailFromIdToken
// ---------------------------------------------------------------------------

function makeIdToken(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fakesig`;
}

describe("emailFromIdToken", () => {
  it("extracts email from a valid JWT payload", () => {
    const token = makeIdToken({ email: "user@example.com", sub: "abc123" });
    expect(emailFromIdToken(token)).toBe("user@example.com");
  });

  it("returns empty string when email claim is absent", () => {
    const token = makeIdToken({ sub: "abc123" });
    expect(emailFromIdToken(token)).toBe("");
  });

  it("returns empty string for malformed token (wrong segment count)", () => {
    expect(emailFromIdToken("onlyone")).toBe("");
    expect(emailFromIdToken("two.parts")).toBe("");
  });

  it("returns empty string for non-base64 payload", () => {
    expect(emailFromIdToken("header.!!!invalid!!!.sig")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// readAuthFile
// ---------------------------------------------------------------------------

describe("readAuthFile", () => {
  it("returns empty object when auth.json does not exist", () => {
    expect(readAuthFile()).toEqual({});
  });

  it("returns parsed data from auth.json", () => {
    const data = { auth_mode: "apikey", OPENAI_API_KEY: "sk-test" };
    writeFileSync(path.join(tmpHome, ".codex", "auth.json"), JSON.stringify(data));
    expect(readAuthFile()).toMatchObject(data);
  });
});

// ---------------------------------------------------------------------------
// writeApiKey / clearAuthMode
// ---------------------------------------------------------------------------

describe("writeApiKey", () => {
  it("writes api key to auth.json", () => {
    writeApiKey("sk-my-key");
    const auth = readAuthFile();
    expect(auth.auth_mode).toBe("apikey");
    expect(auth.OPENAI_API_KEY).toBe("sk-my-key");
  });

  it("overwrites an existing key", () => {
    writeApiKey("sk-first");
    writeApiKey("sk-second");
    expect(readAuthFile().OPENAI_API_KEY).toBe("sk-second");
  });
});

describe("clearAuthMode", () => {
  it("removes auth_mode from auth.json", () => {
    writeApiKey("sk-test");
    clearAuthMode();
    const auth = readAuthFile();
    expect(auth.auth_mode).toBeUndefined();
    // api key is NOT cleared — clearAuthMode only removes auth_mode
  });
});

// ---------------------------------------------------------------------------
// currentCodexLoginEmail
// ---------------------------------------------------------------------------

describe("currentCodexLoginEmail", () => {
  it("returns empty string when no auth file exists", () => {
    expect(currentCodexLoginEmail()).toBe("");
  });

  it("returns empty string when auth has no tokens", () => {
    writeApiKey("sk-test");
    expect(currentCodexLoginEmail()).toBe("");
  });

  it("returns email from stored id_token", () => {
    const idToken = makeIdToken({ email: "me@example.com" });
    writeFileSync(
      path.join(tmpHome, ".codex", "auth.json"),
      JSON.stringify({ auth_mode: "chatgpt", tokens: { id_token: idToken, access_token: "x", refresh_token: "y" } }),
    );
    expect(currentCodexLoginEmail()).toBe("me@example.com");
  });
});
