import { writeFileSync } from "node:fs";

import React from "react";
import { Box, Text, useApp } from "ink";
import { Command } from "commander";

import type { QuickxApi } from "../../api.js";
import { messageOf } from "../../lib/utils.js";
import { renderOnce } from "../../lib/render-once.js";

function ExportOutput({
  run,
}: {
  run: () => { dest: string; count: number };
}): React.JSX.Element {
  const { exit } = useApp();
  const [result, setResult] = React.useState<{ dest: string; count: number } | null>(null);
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
  if (!result) return <Text color="gray">Exporting…</Text>;
  return (
    <Box flexDirection="column">
      <Text>
        Exported <Text color="greenBright">{result.count}</Text> profile
        {result.count !== 1 ? "s" : ""} to{" "}
        <Text color="cyanBright">{result.dest}</Text>.
      </Text>
    </Box>
  );
}

export function makeExportCommand(api: QuickxApi): Command {
  return new Command("export")
    .argument("[file]", "Output file (default: stdout)")
    .description("Export all profiles to JSON")
    .action(async (file: string | undefined) => {
      await renderOnce(
        <ExportOutput
          run={() => {
            const json = api.exportProfiles();
            const profiles = (JSON.parse(json) as { profiles: unknown[] }).profiles;

            if (file) {
              writeFileSync(file, json);
              return { dest: file, count: profiles.length };
            }

            process.stdout.write(`${json}\n`);
            return { dest: "stdout", count: profiles.length };
          }}
        />,
      ).catch(() => process.exit(1));
    });
}
