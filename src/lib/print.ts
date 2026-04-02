import type {
  CodexProfile,
  ListProfilesResult,
  StatusInfo,
  Template,
} from "../types.js";
import { maskKey } from "./utils.js";

function orNone(value: string): string {
  return value || "(none)";
}

function printProfile(profile: CodexProfile, activeProfile: string): void {
  const marker = profile.name === activeProfile ? " ✓" : "";
  console.log(`\n${profile.displayName} (${profile.name})${marker}`);
  console.log("─".repeat(40));
  console.log(`  Base URL   : ${orNone(profile.baseUrl)}`);
  console.log(`  Model      : ${orNone(profile.model)}`);
  console.log(`  Wire API   : ${orNone(profile.wireApi)}`);
  console.log(`  Auth       : ${orNone(profile.authMethod)}`);
  console.log(`  API Key    : ${maskKey(profile.apiKey)}`);
}

export function printStatus(info: StatusInfo): void {
  console.log("quickx status");
  console.log("─".repeat(48));
  console.log(`Config file  : ${info.configFile}`);
  console.log(`Codex config : ${info.codexConfigFile}`);
  console.log(`Auth file    : ${info.authFile}`);
  console.log(`Active       : ${orNone(info.activeProfile)}`);
  console.log(`Logged in    : ${orNone(info.loggedInEmail)}`);

  if (info.profiles.length === 0) {
    console.log("\nNo profiles yet. Run `quickx config add` or `quickx config login`.");
    return;
  }

  for (const profile of info.profiles) {
    printProfile(profile, info.activeProfile);
  }
}

export function printProfileList(result: ListProfilesResult): void {
  if (result.profiles.length === 0) {
    console.log("No profiles yet. Run `quickx config add` or `quickx config login`.");
    return;
  }

  console.log(
    `${"NAME".padEnd(24)} ${"AUTH".padEnd(10)} ${"MODEL".padEnd(20)} DISPLAY`,
  );
  console.log("─".repeat(80));

  for (const profile of result.profiles) {
    const marker = profile.name === result.activeProfile ? " ✓" : "";
    console.log(
      `${profile.name.padEnd(24)} ${profile.authMethod.padEnd(10)} ${orNone(profile.model).slice(0, 20).padEnd(20)} ${profile.displayName}${marker}`,
    );
  }
}

export function printTemplateList(templates: Template[]): void {
  if (templates.length === 0) {
    console.log("No templates found in the registry.");
    return;
  }

  console.log(`${"ID".padEnd(20)} ${"NAME".padEnd(30)} SCOPE`);
  console.log("─".repeat(70));
  for (const template of templates) {
    console.log(
      `${template.id.padEnd(20)} ${template.displayName.padEnd(30)} ${template.scope.join(",")}`,
    );
  }
}

export function printTemplatePreview(template: Template): void {
  console.log(`ID          : ${template.id}`);
  console.log(`Name        : ${template.displayName}`);
  console.log(`Scope       : ${template.scope.join(", ") || "-"}`);
  console.log(`Base URL    : ${template.baseUrl || ""}`);
  console.log(`Model       : ${template.model || ""}`);
  console.log(`Wire API    : ${template.wireApi || ""}`);
  console.log(`Auth Method : ${template.authMethod || ""}`);
  if (template.docsUrl) {
    console.log(`Docs        : ${template.docsUrl}`);
  }
  if (template.requiredEnvs.length > 0) {
    console.log(`Required Env: ${template.requiredEnvs.join(", ")}`);
  }
}
