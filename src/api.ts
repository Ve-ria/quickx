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
import { cloneProfiles, sanitizeEmail } from "./lib/utils.js";

export class QuickxApi {
  private store: StoreData = loadStore();
  private deviceHandles = new Map<string, DeviceCode>();
  private browserHandles = new Map<string, BrowserLoginSession>();

  reload(): void {
    this.store = loadStore();
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
    saveStore(this.store);
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
    saveStore(this.store);

    if (this.store.activeProfile === profile.name) {
      applyCodexProfile(profile, this.store.profiles);
    }

    return { ...profile };
  }

  removeProfile(name: string): void {
    this.reload();
    const index = this.store.profiles.findIndex((profile) => profile.name === name);
    if (index === -1) {
      throw new Error(`No profile named "${name}"`);
    }

    this.store.profiles.splice(index, 1);
    if (this.store.activeProfile === name) {
      this.store.activeProfile = "";
    }

    saveStore(this.store);
  }

  useProfile(name: string): void {
    this.reload();
    const profile = getProfile(this.store, name);
    if (!profile) {
      throw new Error(`No profile named "${name}"`);
    }

    applyCodexProfile(profile, this.store.profiles);
    this.store.activeProfile = name;
    saveStore(this.store);
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
      saveStore(this.store);
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
    saveStore(this.store);

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
