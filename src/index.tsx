import { Command } from "commander";

import { QuickxApi } from "./api.js";
import { runInkTui } from "./tui.js";
import { makeStatusCommand } from "./commands/status.js";
import { makeUseCommand } from "./commands/use.js";
import { makeConfigCommand as makeProfilesCommand } from "./commands/config/index.js";
import { makeTemplatesCommand } from "./commands/templates/index.js";

const api = new QuickxApi();

const program = new Command("quickx")
  .description("QuickX — Codex profile manager")
  .version("2.1.0")
  .allowExcessArguments(false)
  .action(async () => {
    await runInkTui(api);
  });

program.addCommand(makeStatusCommand(api));
program.addCommand(makeUseCommand(api));
program.addCommand(makeProfilesCommand(api));
program.addCommand(makeTemplatesCommand(api));

program.parseAsync(process.argv).catch(() => process.exit(1));
