import { Command } from "commander";

import type { QuickxApi } from "../../api.js";
import { makeListCommand } from "./list.js";
import { makeAddCommand } from "./add.js";
import { makeEditCommand } from "./edit.js";
import { makeRemoveCommand } from "./remove.js";
import { makeLoginCommand } from "./login.js";
import { makeDuplicateCommand } from "./duplicate.js";
import { makeRenameCommand } from "./rename.js";
import { makeExportCommand } from "./export.js";
import { makeImportCommand } from "./import.js";

export function makeConfigCommand(api: QuickxApi): Command {
  const profiles = new Command("profiles")
    .alias("config")
    .description("Manage Codex profiles");

  profiles.addCommand(makeListCommand(api));
  profiles.addCommand(makeAddCommand(api));
  profiles.addCommand(makeEditCommand(api));
  profiles.addCommand(makeRemoveCommand(api));
  profiles.addCommand(makeLoginCommand(api));
  profiles.addCommand(makeDuplicateCommand(api));
  profiles.addCommand(makeRenameCommand(api));
  profiles.addCommand(makeExportCommand(api));
  profiles.addCommand(makeImportCommand(api));

  return profiles;
}
