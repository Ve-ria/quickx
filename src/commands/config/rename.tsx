import React from "react";
import { Box, Text, useApp } from "ink";
import { Command } from "commander";

import type { QuickxApi } from "../../api.js";
import { messageOf } from "../../lib/utils.js";
import { renderOnce } from "../../lib/render-once.js";

function RenameOutput({
  run,
}: {
  run: () => { oldName: string; newName: string };
}): React.JSX.Element {
  const { exit } = useApp();
  const [result, setResult] = React.useState<{ oldName: string; newName: string } | null>(null);
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
  if (!result) return <Text color="gray">Renaming…</Text>;
  return (
    <Box flexDirection="column">
      <Text>
        Profile <Text color="cyanBright">"{result.oldName}"</Text> renamed to{" "}
        <Text color="greenBright">"{result.newName}"</Text>.
      </Text>
    </Box>
  );
}

export function makeRenameCommand(api: QuickxApi): Command {
  return new Command("rename")
    .argument("<old-name>", "Current profile name")
    .argument("<new-name>", "New profile name")
    .description("Rename a profile")
    .action(async (oldName: string, newName: string) => {
      await renderOnce(
        <RenameOutput
          run={() => {
            api.renameProfile(oldName, newName);
            return { oldName, newName };
          }}
        />,
      ).catch(() => process.exit(1));
    });
}
