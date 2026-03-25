#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const npmRoot = path.resolve(__dirname, "..");
const nativeDir = path.join(npmRoot, "native");
const nativeLibDir = path.join(nativeDir, "lib");
const binDir = path.join(npmRoot, "bin");

function run(cmd, args, cwd) {
  const useShell =
    process.platform === "win32" && /\.(cmd|bat)$/i.test(cmd);
  execFileSync(cmd, args, { cwd, stdio: "inherit", shell: useShell });
}

function sharedLibraryName() {
  if (process.platform === "win32") return "quickcore.dll";
  if (process.platform === "darwin") return "libquickcore.dylib";
  return "libquickcore.so";
}

function tuiBinaryName() {
  return process.platform === "win32" ? "quick-tui.exe" : "quick-tui";
}

function nodeGypBin() {
  return path.join(
    npmRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "node-gyp.cmd" : "node-gyp",
  );
}

function macSharedLibPath() {
  return path.join(nativeLibDir, "libquickcore.dylib");
}

function buildGoArtifacts() {
  fs.mkdirSync(nativeLibDir, { recursive: true });
  fs.mkdirSync(binDir, { recursive: true });

  run(
    "go",
    [
      "build",
      "-buildmode=c-shared",
      "-o",
      path.join(nativeLibDir, sharedLibraryName()),
      "./bridge/cabi",
    ],
    repoRoot,
  );
  run("go", ["build", "-o", path.join(binDir, tuiBinaryName()), "./cmd/quick-tui"], repoRoot);

  if (process.platform === "darwin") {
    run("install_name_tool", ["-id", "@rpath/libquickcore.dylib", macSharedLibPath()], repoRoot);
  }
}

function buildAddon() {
  run(nodeGypBin(), ["rebuild"], nativeDir);

  if (process.platform === "darwin") {
    run(
      "install_name_tool",
      [
        "-change",
        "libquickcore.dylib",
        "@rpath/libquickcore.dylib",
        path.join(nativeDir, "build", "Release", "quickaddon.node"),
      ],
      repoRoot,
    );
  }

  if (process.platform === "win32") {
    fs.copyFileSync(
      path.join(nativeLibDir, sharedLibraryName()),
      path.join(nativeDir, "build", "Release", sharedLibraryName()),
    );
  }
}

buildGoArtifacts();
buildAddon();
