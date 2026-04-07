import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";

import type { CodexProfile, ProfileInput, StoreData } from "../types.js";
import { configFile, configHome } from "./paths.js";

export function emptyStore(): StoreData {
  return {
    version: 1,
    activeProfile: "",
    profiles: [],
  };
}

export function normalizeProfile(input: ProfileInput): CodexProfile {
  const name = String(input.name || "").trim();
  if (!name) {
    throw new Error("Profile name is required");
  }
  if (!/^[a-zA-Z0-9_-]+$/u.test(name)) {
    throw new Error(
      "Profile name must contain only letters, numbers, hyphens, and underscores",
    );
  }

  return {
    name,
    displayName: String(input.displayName || "").trim() || name,
    baseUrl: String(input.baseUrl || "").trim(),
    apiKey: String(input.apiKey || ""),
    model: String(input.model || "").trim(),
    wireApi: input.wireApi === "chat" ? "chat" : "responses",
    authMethod: input.authMethod === "chatgpt" ? "chatgpt" : "api_key",
    reasoningEffort: String(input.reasoningEffort || "").trim(),
    modelVerbosity: String(input.modelVerbosity || "").trim(),
  };
}

function migrateStore(data: StoreData): StoreData {
  // v0 → v1: add version field (no structural changes needed)
  if (!data.version) {
    data.version = 1;
  }

  return data;
}

function normalizeStore(raw: unknown): StoreData {
  if (!raw || typeof raw !== "object") {
    return emptyStore();
  }

  const data = raw as { version?: unknown; activeProfile?: unknown; profiles?: unknown[] };
  const profiles = Array.isArray(data.profiles)
    ? data.profiles
        .filter(
          (profile): profile is Record<string, unknown> =>
            Boolean(profile) && typeof profile === "object",
        )
        .flatMap((profile) => {
          try {
            return [
              normalizeProfile({
                name: String(profile.name || ""),
                displayName: String(profile.displayName || ""),
                baseUrl: String(profile.baseUrl || ""),
                apiKey: String(profile.apiKey || ""),
                model: String(profile.model || ""),
                wireApi: String(profile.wireApi || ""),
                authMethod: String(profile.authMethod || ""),
                reasoningEffort: String(profile.reasoningEffort || ""),
                modelVerbosity: String(profile.modelVerbosity || ""),
              }),
            ];
          } catch {
            return [];
          }
        })
    : [];

  return migrateStore({
    version: typeof data.version === "number" ? data.version : 0,
    activeProfile: String(data.activeProfile || ""),
    profiles,
  });
}

export function loadStore(): StoreData {
  try {
    const text = readFileSync(configFile(), "utf8");
    return normalizeStore(JSON.parse(text));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return emptyStore();
    }

    throw error;
  }
}

export function saveStore(store: StoreData): void {
  const dir = configHome();
  const file = configFile();
  const tmp = `${file}.tmp`;
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(tmp, `${JSON.stringify(normalizeStore(store), null, 2)}\n`, {
    mode: 0o600,
  });
  renameSync(tmp, file);
}

export function getProfile(
  store: StoreData,
  name: string,
): CodexProfile | undefined {
  return store.profiles.find((profile) => profile.name === name);
}
