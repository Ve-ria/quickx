import { randomUUID } from "node:crypto";

import type {
  BrowserLoginInfo,
  BrowserLoginSession,
  CodexProfile,
  DeviceCode,
  DeviceCodeInfo,
  ListProfilesResult,
  LoginResult,
  ProfileInput,
  StatusInfo,
  StoreData,
  Template,
  TemplateSetup,
} from "./types.js";
import { currentCodexLoginEmail } from "./lib/auth.js";
import { applyCodexProfile } from "./lib/codex.js";
import { authFile, codexConfigFile, configFile } from "./lib/paths.js";
import {
  createProfileFromTemplate as createProfileInputFromTemplate,
  fetchTemplateById,
  getTemplateSetup as getResolvedTemplateSetup,
  listTemplates as listResolvedTemplates,
} from "./lib/templates.js";
import {
  completeDeviceLogin,
  requestDeviceCode,
  startBrowserLogin,
} from "./lib/login.js";
import {
  getProfile,
  loadStore,
  normalizeProfile,
  saveStore,
} from "./lib/store.js";
import { cloneProfiles, findSimilarNames, sanitizeEmail } from "./lib/utils.js";

export class QuickxApi {
  private store: StoreData = loadStore();
  private deviceHandles = new Map<string, DeviceCode>();
  private browserHandles = new Map<string, BrowserLoginSession>();
  private _storeLoadedAt: number = Date.now();

  reload(): void {
    if (Date.now() - this._storeLoadedAt > 50) {
      this.store = loadStore();
      this._storeLoadedAt = Date.now();
    }
  }

  private _save(): void {
    saveStore(this.store);
    this._storeLoadedAt = Date.now();
  }

  status(): StatusInfo {
    this.reload();
    return {
      activeProfile: this.store.activeProfile,
      configFile: configFile(),
      codexConfigFile: codexConfigFile(),
      authFile: authFile(),
      loggedInEmail: currentCodexLoginEmail(),
      profiles: cloneProfiles(this.store.profiles),
    };
  }

  listProfiles(): ListProfilesResult {
    this.reload();
    return {
      activeProfile: this.store.activeProfile,
      profiles: cloneProfiles(this.store.profiles),
    };
  }

  addProfile(input: ProfileInput): CodexProfile {
    this.reload();
    const profile = normalizeProfile(input);
    if (getProfile(this.store, profile.name)) {
      throw new Error(`Profile "${profile.name}" already exists`);
    }

    this.store.profiles.push(profile);
    this._save();
    return { ...profile };
  }

  updateProfile(input: ProfileInput): CodexProfile {
    this.reload();
    const profile = normalizeProfile(input);
    const index = this.store.profiles.findIndex(
      (candidate) => candidate.name === profile.name,
    );

    if (index === -1) {
      throw new Error(`No profile named "${profile.name}"`);
    }

    this.store.profiles[index] = profile;
    this._save();

    if (this.store.activeProfile === profile.name) {
      applyCodexProfile(profile, this.store.profiles);
    }

    return { ...profile };
  }

  removeProfile(name: string): void {
    this.reload();
    const index = this.store.profiles.findIndex((profile) => profile.name === name);
    if (index === -1) {
      throw new Error(this._notFoundError(name));
    }

    this.store.profiles.splice(index, 1);
    if (this.store.activeProfile === name) {
      this.store.activeProfile = "";
    }

    this._save();
  }

  duplicateProfile(sourceName: string, newName: string): CodexProfile {
    this.reload();
    const source = getProfile(this.store, sourceName);
    if (!source) {
      throw new Error(this._notFoundError(sourceName));
    }

    return this.addProfile({ ...source, name: newName });
  }

  renameProfile(oldName: string, newName: string): CodexProfile {
    this.reload();
    const profile = getProfile(this.store, oldName);
    if (!profile) {
      throw new Error(this._notFoundError(oldName));
    }

    const wasActive = this.store.activeProfile === oldName;
    const renamed = this.addProfile({ ...profile, name: newName });
    this.removeProfile(oldName);
    if (wasActive) {
      this.store.activeProfile = newName;
      this._save();
    }

    return renamed;
  }

  exportProfiles(): string {
    this.reload();
    return JSON.stringify(
      { version: this.store.version, activeProfile: this.store.activeProfile, profiles: cloneProfiles(this.store.profiles) },
      null,
      2,
    );
  }

  importProfiles(json: string, overwrite = false): { added: number; skipped: number } {
    this.reload();
    const data = JSON.parse(json) as { profiles?: unknown[] };
    if (!Array.isArray(data.profiles)) {
      throw new Error("Invalid export file: missing profiles array");
    }

    let added = 0;
    let skipped = 0;

    for (const raw of data.profiles) {
      if (!raw || typeof raw !== "object") { skipped++; continue; }
      const r = raw as Record<string, unknown>;
      try {
        const profile = normalizeProfile({
          name: String(r.name || ""),
          displayName: String(r.displayName || ""),
          baseUrl: String(r.baseUrl || ""),
          apiKey: String(r.apiKey || ""),
          model: String(r.model || ""),
          wireApi: String(r.wireApi || ""),
          authMethod: String(r.authMethod || ""),
          reasoningEffort: String(r.reasoningEffort || ""),
          modelVerbosity: String(r.modelVerbosity || ""),
        });

        const existing = getProfile(this.store, profile.name);
        if (existing && !overwrite) { skipped++; continue; }
        if (existing) {
          const idx = this.store.profiles.indexOf(existing);
          this.store.profiles[idx] = profile;
        } else {
          this.store.profiles.push(profile);
        }
        added++;
      } catch {
        skipped++;
      }
    }

    this._save();
    return { added, skipped };
  }

  useProfile(name: string): void {
    this.reload();
    const profile = getProfile(this.store, name);
    if (!profile) {
      throw new Error(this._notFoundError(name));
    }

    applyCodexProfile(profile, this.store.profiles);
    this.store.activeProfile = name;
    this._save();
  }

  private _notFoundError(name: string): string {
    const names = this.store.profiles.map((p) => p.name);
    const similar = findSimilarNames(name, names);
    const hint = similar.length > 0 ? ` Did you mean: ${similar.join(", ")}?` : "";
    return `No profile named "${name}".${hint}`;
  }

  async loginCodexRequestDevice(): Promise<DeviceCodeInfo> {
    const deviceCode = await requestDeviceCode();
    const handleId = randomUUID();
    this.deviceHandles.set(handleId, deviceCode);

    return {
      handleId,
      userCode: deviceCode.userCode,
      verificationUrl: deviceCode.verificationUrl,
    };
  }

  async loginCodexCompleteDevice(
    handleId: string,
    configName = "",
  ): Promise<LoginResult> {
    const deviceCode = this.deviceHandles.get(handleId);
    if (!deviceCode) {
      throw new Error("Device login handle not found");
    }

    this.deviceHandles.delete(handleId);
    await completeDeviceLogin(deviceCode);
    return this.createCodexLoginProfile(configName);
  }

  async loginCodexBrowserStart(): Promise<BrowserLoginInfo> {
    const session = await startBrowserLogin();
    const handleId = randomUUID();
    this.browserHandles.set(handleId, session);

    return {
      handleId,
      authUrl: session.authUrl,
    };
  }

  async loginCodexBrowserWait(
    handleId: string,
    configName = "",
  ): Promise<LoginResult> {
    const session = this.browserHandles.get(handleId);
    if (!session) {
      throw new Error("Browser login handle not found");
    }

    this.browserHandles.delete(handleId);
    await session.wait();
    return this.createCodexLoginProfile(configName);
  }

  createCodexLoginProfile(configName = ""): LoginResult {
    this.reload();

    const email = currentCodexLoginEmail();
    const resolvedName =
      configName.trim() || (email ? `codex-${sanitizeEmail(email)}` : "codex-chatgpt");
    const displayName = email
      ? `OpenAI Codex (${email})`
      : "OpenAI Codex (ChatGPT)";

    const existing = this.store.profiles.find(
      (profile) => profile.name === resolvedName,
    );

    if (existing) {
      existing.displayName = displayName;
      existing.authMethod = "chatgpt";
      existing.apiKey = "";
      this._save();
      return {
        name: existing.name,
        displayName: existing.displayName,
      };
    }

    const created = normalizeProfile({
      name: resolvedName,
      displayName,
      authMethod: "chatgpt",
    });

    this.store.profiles.push(created);
    this._save();

    return {
      name: created.name,
      displayName: created.displayName,
    };
  }

  async listTemplates(): Promise<Template[]> {
    return await listResolvedTemplates();
  }

  async previewTemplate(idOrUrl: string): Promise<Template> {
    return await fetchTemplateById(idOrUrl);
  }

  async getTemplateSetup(idOrUrl: string): Promise<TemplateSetup> {
    return getResolvedTemplateSetup(await fetchTemplateById(idOrUrl));
  }

  async createProfileFromTemplate(
    name: string,
    idOrUrl: string,
    answers: Record<string, string>,
  ): Promise<CodexProfile> {
    const template = await fetchTemplateById(idOrUrl);
    const resolvedName = name.trim() || template.id;
    return this.addProfile(
      createProfileInputFromTemplate(resolvedName, template, answers),
    );
  }
}
