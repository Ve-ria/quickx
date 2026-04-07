import React from "react";
import { Box, Text, useApp } from "ink";
import { Command } from "commander";

import type { QuickxApi } from "../../api.js";
import { messageOf } from "../../lib/utils.js";
import { renderOnce } from "../../lib/render-once.js";

function DuplicateOutput({
  run,
}: {
  run: () => { source: string; name: string };
}): React.JSX.Element {
  const { exit } = useApp();
  const [result, setResult] = React.useState<{ source: string; name: string } | null>(null);
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
  if (!result) return <Text color="gray">Duplicating…</Text>;
  return (
    <Box flexDirection="column">
      <Text>
        Profile <Text color="greenBright">"{result.name}"</Text> created from{" "}
        <Text color="cyanBright">"{result.source}"</Text>.
      </Text>
      <Text color="gray">Run `quickx use {result.name}` to activate it.</Text>
    </Box>
  );
}

export function makeDuplicateCommand(api: QuickxApi): Command {
  return new Command("duplicate")
    .alias("dup")
    .argument("<source>", "Name of the profile to copy")
    .argument("<new-name>", "Name for the new profile")
    .description("Copy a profile under a new name")
    .action(async (source: string, newName: string) => {
      await renderOnce(
        <DuplicateOutput
          run={() => {
            api.duplicateProfile(source, newName);
            return { source, name: newName };
          }}
        />,
      ).catch(() => process.exit(1));
    });
}
