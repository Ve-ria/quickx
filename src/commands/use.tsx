import React from "react";
import { Box, Text, useApp } from "ink";
import { Command } from "commander";

import type { QuickxApi } from "../api.js";
import type { CodexProfile } from "../types.js";
import { messageOf } from "../lib/utils.js";
import { renderOnce } from "../lib/render-once.js";

function UseOutput({
  profile,
  error,
}: {
  profile?: CodexProfile;
  error?: string;
}): React.JSX.Element {
  const { exit } = useApp();

  React.useEffect(() => {
    exit(error ? new Error(error) : undefined);
  }, []);

  if (error) return <Text color="redBright">{error}</Text>;
  if (!profile) return <Text color="gray">Applying…</Text>;
  return (
    <Box flexDirection="column">
      <Text>
        Activated <Text color="greenBright">"{profile.displayName || profile.name}"</Text>
        {" "}(<Text color="cyan">{profile.name}</Text>).
      </Text>
      {profile.model ? (
        <Text color="gray">  model  : {profile.model}</Text>
      ) : null}
      {profile.baseUrl ? (
        <Text color="gray">  baseUrl: {profile.baseUrl}</Text>
      ) : null}
      <Text color="gray">  auth   : {profile.authMethod}</Text>
    </Box>
  );
}

export function makeUseCommand(api: QuickxApi): Command {
  return new Command("use")
    .argument("<profile-name>")
    .description("Apply a saved profile to ~/.codex/config.toml")
    .action(async (name: string) => {
      let profile: CodexProfile | undefined;
      let error: string | undefined;
      try {
        api.useProfile(name);
        profile = api.listProfiles().profiles.find((p) => p.name === name);
      } catch (err) {
        error = messageOf(err);
      }
      await renderOnce(<UseOutput profile={profile} error={error} />).catch(() => process.exit(1));
    });
}
