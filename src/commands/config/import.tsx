import { readFileSync } from "node:fs";

import React from "react";
import { Box, Text, useApp } from "ink";
import { Command } from "commander";

import type { QuickxApi } from "../../api.js";
import { messageOf } from "../../lib/utils.js";
import { renderOnce } from "../../lib/render-once.js";

function ImportOutput({
  run,
}: {
  run: () => { added: number; skipped: number };
}): React.JSX.Element {
  const { exit } = useApp();
  const [result, setResult] = React.useState<{ added: number; skipped: number } | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    try {
      setResult(run());
      exit();
    } catch (err) {
      setError(messageOf(err));
      exit(new Error(messageOf(err)));
    }
  }, []);

  if (error) return <Text color="redBright">{error}</Text>;
  if (!result) return <Text color="gray">Importing…</Text>;
  return (
    <Box flexDirection="column">
      <Text>
        Imported <Text color="greenBright">{result.added}</Text> profile
        {result.added !== 1 ? "s" : ""}.
        {result.skipped > 0 ? (
          <Text color="gray"> ({result.skipped} skipped — already exist, use --overwrite to replace)</Text>
        ) : null}
      </Text>
    </Box>
  );
}

export function makeImportCommand(api: QuickxApi): Command {
  return new Command("import")
    .argument("<file>", "JSON file exported by `quickx profiles export`")
    .option("--overwrite", "Overwrite existing profiles with the same name")
    .description("Import profiles from a JSON export file")
    .action(async (file: string, options: { overwrite?: boolean }) => {
      await renderOnce(
        <ImportOutput
          run={() => {
            const json = readFileSync(file, "utf8");
            return api.importProfiles(json, options.overwrite ?? false);
          }}
        />,
      ).catch(() => process.exit(1));
    });
}
