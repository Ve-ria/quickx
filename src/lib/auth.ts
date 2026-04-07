import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";

import type { AuthFileData, TokenResponse } from "../types.js";
import { authFile, codexHome } from "./paths.js";

export function readAuthFile(): AuthFileData {
  try {
    const text = readFileSync(authFile(), "utf8");
    const parsed = JSON.parse(text) as AuthFileData;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {};
    }

    throw error;
  }
}

function updateAuthFile(mutator: (data: AuthFileData) => void): void {
  const data = readAuthFile();
  mutator(data);

  const dir = codexHome();
  const file = authFile();
  const tmp = `${file}.tmp`;
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, file);
}

export function writeApiKey(apiKey: string): void {
  updateAuthFile((data) => {
    data.auth_mode = "apikey";
    data.OPENAI_API_KEY = apiKey;
  });
}

export function clearAuthMode(): void {
  updateAuthFile((data) => {
    delete data.auth_mode;
  });
}

export function persistTokens(tokens: TokenResponse): void {
  updateAuthFile((data) => {
    data.auth_mode = "chatgpt";
    data.tokens = {
      id_token: tokens.id_token,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    };
    data.last_refresh = new Date().toISOString();
  });
}

export function emailFromIdToken(idToken: string): string {
  const parts = idToken.split(".", 3);
  if (parts.length < 2 || !parts[1]) {
    return "";
  }

  try {
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    const claims = JSON.parse(payload) as { email?: string };
    return claims.email || "";
  } catch {
    return "";
  }
}

export function currentCodexLoginEmail(): string {
  const auth = readAuthFile();
  return auth.tokens?.id_token ? emailFromIdToken(auth.tokens.id_token) : "";
}
