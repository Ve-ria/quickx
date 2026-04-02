import { Command } from "commander";

import { QuickxApi } from "./api.js";
import { askProfileInputs, askTemplateAnswers } from "./lib/prompts.js";
import {
  printProfileList,
  printStatus,
  printTemplateList,
  printTemplatePreview,
} from "./lib/print.js";
import { openBrowser } from "./lib/utils.js";
import { runInkTui } from "./tui.js";

type LoginOptions = {
  device?: boolean;
};

type AddOptions = {
  fromTemplate?: string;
  displayName?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  wireApi?: string;
  authMethod?: string;
  reasoningEffort?: string;
  modelVerbosity?: string;
};

type EditOptions = AddOptions;

async function runAdd(
  api: QuickxApi,
  name: string | undefined,
  options: AddOptions,
): Promise<void> {
  if (options.fromTemplate) {
    const setup = await api.getTemplateSetup(options.fromTemplate);
    const answers = await askTemplateAnswers(setup.placeholders);
    const created = await api.createProfileFromTemplate(
      name || "",
      options.fromTemplate,
      answers,
    );
    console.log(
      `Profile "${created.name}" added from template "${options.fromTemplate}".`,
    );
    console.log(`Run \`quickx use ${created.name}\` to activate it.`);
    return;
  }

  const inputs = await askProfileInputs(name, options);
  const created = api.addProfile(inputs);
  console.log(`Profile "${created.name}" added.`);
  console.log(`Run \`quickx use ${created.name}\` to activate it.`);
}

async function runEdit(
  api: QuickxApi,
  name: string,
  options: EditOptions,
): Promise<void> {
  const existing = api
    .listProfiles()
    .profiles.find((profile) => profile.name === name);
  if (!existing) {
    throw new Error(`No profile named "${name}"`);
  }

  const updated = api.updateProfile({
    name,
    displayName: options.displayName ?? existing.displayName,
    baseUrl: options.baseUrl ?? existing.baseUrl,
    apiKey: options.apiKey ?? existing.apiKey,
    model: options.model ?? existing.model,
    wireApi: options.wireApi ?? existing.wireApi,
    authMethod: options.authMethod ?? existing.authMethod,
    reasoningEffort: options.reasoningEffort ?? existing.reasoningEffort,
    modelVerbosity: options.modelVerbosity ?? existing.modelVerbosity,
  });

  if (api.listProfiles().activeProfile === updated.name) {
    api.useProfile(updated.name);
    console.log(`Profile "${updated.name}" updated and reapplied.`);
    return;
  }

  console.log(`Profile "${updated.name}" updated.`);
}

async function runLogin(
  api: QuickxApi,
  name: string | undefined,
  options: LoginOptions,
): Promise<void> {
  if (options.device) {
    const pending = await api.loginCodexRequestDevice();
    console.log("Requesting device code...");
    console.log(
      `\n1. Open this URL in your browser:\n   ${pending.verificationUrl}`,
    );
    console.log(`\n2. Enter this one-time code:\n   ${pending.userCode}\n`);
    console.log("Waiting for authentication to complete...");
    const created = await api.loginCodexCompleteDevice(
      pending.handleId,
      name || "",
    );
    console.log(`✓ Profile "${created.name}" created.`);
    console.log(`  Run \`quickx use ${created.name}\` to activate it.`);
    return;
  }

  const pending = await api.loginCodexBrowserStart();
  console.log("Starting browser login...");
  console.log(`\nOpen this URL in your browser:\n  ${pending.authUrl}\n`);
  if (openBrowser(pending.authUrl)) {
    console.log("Opened your default browser.");
  }
  console.log("Waiting for you to complete login in your browser...");
  const created = await api.loginCodexBrowserWait(pending.handleId, name || "");
  console.log(`✓ Profile "${created.name}" created.`);
  console.log(`  Run \`quickx use ${created.name}\` to activate it.`);
}

async function main(): Promise<void> {
  const api = new QuickxApi();
  const program = new Command();

  program
    .name("quickx")
    .description("Manage Codex profiles with a Node.js CLI and Ink TUI")
    .showHelpAfterError();

  program
    .command("status")
    .description("Show current quickx and Codex state")
    .action(() => {
      printStatus(api.status());
    });

  program
    .command("use")
    .argument("<profile-name>")
    .description("Apply a saved profile to ~/.codex/config.toml")
    .action((name: string) => {
      api.useProfile(name);
      console.log(`Applied profile "${name}" to ~/.codex/config.toml.`);
    });

  const config = program.command("config").description("Manage Codex profiles");

  config
    .command("list")
    .description("List saved profiles")
    .action(() => {
      printProfileList(api.listProfiles());
    });

  config
    .command("add")
    .argument("[name]")
    .description("Add a profile, prompting for any missing fields")
    .option("--from-template <id>", "Template ID or raw template URL")
    .option("--display-name <displayName>", "Display label")
    .option("--base-url <url>", "Provider API base URL")
    .option("--api-key <key>", "API key")
    .option("--model <model>", "Default model")
    .option("--wire-api <wireApi>", "Wire API")
    .option("--auth-method <authMethod>", "Auth method")
    .option("--reasoning-effort <level>", "Codex reasoning effort")
    .option("--model-verbosity <level>", "Codex model verbosity")
    .action(async (name: string | undefined, options: AddOptions) => {
      await runAdd(api, name, options);
    });

  config
    .command("edit")
    .argument("<name>")
    .description("Edit an existing profile")
    .option("--display-name <displayName>", "Display label")
    .option("--base-url <url>", "Provider API base URL")
    .option("--api-key <key>", "API key")
    .option("--model <model>", "Default model")
    .option("--wire-api <wireApi>", "Wire API")
    .option("--auth-method <authMethod>", "Auth method")
    .option("--reasoning-effort <level>", "Codex reasoning effort")
    .option("--model-verbosity <level>", "Codex model verbosity")
    .action(async (name: string, options: EditOptions) => {
      await runEdit(api, name, options);
    });

  config
    .command("remove")
    .argument("<name>")
    .description("Remove a saved profile")
    .action((name: string) => {
      api.removeProfile(name);
      console.log(`Profile "${name}" removed.`);
    });

  config
    .command("login")
    .argument("[name]")
    .description("Log in with ChatGPT/Codex and create a profile")
    .option("--device", "Use device-code flow instead of browser login")
    .action(async (name: string | undefined, options: LoginOptions) => {
      await runLogin(api, name, options);
    });

  const templates = program
    .command("templates")
    .alias("template")
    .description("Browse provider templates copied from QuickCLI");

  templates
    .command("list")
    .description("List available templates")
    .action(async () => {
      printTemplateList(await api.listTemplates());
    });

  templates
    .command("preview")
    .argument("<id-or-url>")
    .description("Preview a template")
    .action(async (idOrUrl: string) => {
      const template = await api.previewTemplate(idOrUrl);
      const setup = await api.getTemplateSetup(idOrUrl);
      printTemplatePreview(template);
      if (setup.placeholders.length > 0) {
        console.log("\nDynamic fields:");
        for (const placeholder of setup.placeholders) {
          const fallback = placeholder.defaultValue || "(required)";
          console.log(`  - ${placeholder.question} [default: ${fallback}]`);
        }
      }
    });

  if (process.argv.length <= 2) {
    await runInkTui(api);
    return;
  }

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
