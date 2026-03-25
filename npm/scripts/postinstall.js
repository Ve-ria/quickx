#!/usr/bin/env node
"use strict";

const { execFileSync } = require("child_process");
const path = require("path");

const {
  currentKey,
  currentPackageName,
  loadPlatformPackage,
} = require("../lib/platform");
const packageJson = require("../package.json");

function hasPlatformPackage() {
  try {
    loadPlatformPackage();
    return true;
  } catch {
    return false;
  }
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function installRoot() {
  return (
    process.env.npm_config_local_prefix ||
    process.env.INIT_CWD ||
    path.resolve(__dirname, "..", "..", "..")
  );
}

function main() {
  let packageName;
  try {
    packageName = currentPackageName();
  } catch (err) {
    console.warn(`[quickcli] ${err.message}`);
    return;
  }

  if (hasPlatformPackage()) {
    return;
  }

  const version =
    packageJson.optionalDependencies &&
    packageJson.optionalDependencies[packageName];

  if (!version) {
    throw new Error(
      `No optional dependency version configured for ${packageName} on ${currentKey()}.`,
    );
  }

  console.log(
    `[quickcli] Installing missing platform package ${packageName}@${version}...`,
  );

  execFileSync(
    npmCommand(),
    [
      "install",
      "--no-save",
      "--no-package-lock",
      "--ignore-scripts",
      `${packageName}@${version}`,
    ],
    {
      cwd: installRoot(),
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    },
  );
}

try {
  main();
} catch (err) {
  console.error(`[quickcli] postinstall failed: ${err.message}`);
  process.exit(1);
}
