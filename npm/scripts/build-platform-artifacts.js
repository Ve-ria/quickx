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

function capture(cmd, args, cwd) {
  const useShell =
    process.platform === "win32" && /\.(cmd|bat)$/i.test(cmd);
  return execFileSync(cmd, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    shell: useShell,
  }).trim();
}

function sharedLibraryName() {
  if (process.platform === "win32") return "quickcore.dll";
  if (process.platform === "darwin") return "libquickcore.dylib";
  return "libquickcore.so";
}

function windowsImportLibraryName() {
  return "quickcore.lib";
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

function windowsMachineType() {
  if (process.arch === "x64") return "X64";
  if (process.arch === "ia32") return "X86";
  if (process.arch === "arm64") return "ARM64";
  throw new Error(`Unsupported Windows architecture for import library generation: ${process.arch}`);
}

function windowsTargetBinDir() {
  if (process.arch === "x64") return "x64";
  if (process.arch === "ia32") return "x86";
  if (process.arch === "arm64") return "arm64";
  throw new Error(`Unsupported Windows architecture for tool discovery: ${process.arch}`);
}

function firstExistingFile(paths) {
  for (const candidate of paths) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function latestSubdirectory(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return null;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));

  if (entries.length === 0) {
    return null;
  }

  return path.join(dirPath, entries[0]);
}

function isMsvcToolPath(toolPath) {
  if (!toolPath) {
    return false;
  }

  const normalized = toolPath.replace(/\//gu, "\\").toLowerCase();
  return normalized.includes("\\microsoft visual studio\\")
    || normalized.includes("\\vc\\tools\\msvc\\");
}

function toolPathsFromWhere(toolName) {
  try {
    const output = capture("where.exe", [toolName], repoRoot);
    return output.split(/\r?\n/u).filter(Boolean);
  } catch {
    return [];
  }
}

function vsInstallPathFromVswhere() {
  const installerRoot = firstExistingFile([
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Microsoft Visual Studio", "Installer", "vswhere.exe"),
    process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Microsoft Visual Studio", "Installer", "vswhere.exe"),
  ]);

  if (!installerRoot) {
    return null;
  }

  try {
    const output = capture(
      installerRoot,
      [
        "-latest",
        "-products",
        "*",
        "-requires",
        "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
        "-property",
        "installationPath",
      ],
      repoRoot,
    );
    return output || null;
  } catch {
    return null;
  }
}

function msvcToolCandidates(toolName) {
  const targetDir = windowsTargetBinDir();
  const candidates = [];

  if (process.env.VCToolsInstallDir) {
    candidates.push(path.join(process.env.VCToolsInstallDir, "bin", "Hostx64", targetDir, toolName));
  }

  const installRoots = [
    process.env.VSINSTALLDIR,
    vsInstallPathFromVswhere(),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Microsoft Visual Studio", "2022", "Enterprise"),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Microsoft Visual Studio", "2022", "Professional"),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Microsoft Visual Studio", "2022", "Community"),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Microsoft Visual Studio", "2022", "BuildTools"),
    process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Microsoft Visual Studio", "2022", "Enterprise"),
    process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Microsoft Visual Studio", "2022", "Professional"),
    process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Microsoft Visual Studio", "2022", "Community"),
    process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Microsoft Visual Studio", "2022", "BuildTools"),
  ].filter(Boolean);

  for (const installRoot of installRoots) {
    const msvcRoot = latestSubdirectory(
      path.join(installRoot, "VC", "Tools", "MSVC"),
    );
    if (msvcRoot) {
      candidates.push(path.join(msvcRoot, "bin", "Hostx64", targetDir, toolName));
    }
  }

  return candidates;
}

function resolveWindowsImportLibraryTool() {
  const libFromVs = firstExistingFile(msvcToolCandidates("lib.exe"));
  if (libFromVs) {
    return { command: libFromVs, extraArgs: [] };
  }

  const linkFromVs = firstExistingFile(msvcToolCandidates("link.exe"));
  if (linkFromVs) {
    return { command: linkFromVs, extraArgs: ["/lib"] };
  }

  const libFromPath = toolPathsFromWhere("lib.exe").find(isMsvcToolPath);
  if (libFromPath) {
    return { command: libFromPath, extraArgs: [] };
  }

  const linkFromPath = toolPathsFromWhere("link.exe").find(isMsvcToolPath);
  if (linkFromPath) {
    return { command: linkFromPath, extraArgs: ["/lib"] };
  }

  throw new Error(
    "Unable to locate lib.exe or link.exe for Windows import library generation.",
  );
}

function goExportedSymbols() {
  const cabiSource = fs.readFileSync(
    path.join(repoRoot, "bridge", "cabi", "main.go"),
    "utf8",
  );

  return cabiSource
    .split(/\r?\n/u)
    .map((line) => line.match(/^\s*\/\/export\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/u))
    .filter(Boolean)
    .map((match) => match[1]);
}

function buildWindowsImportLibrary() {
  const dllName = sharedLibraryName();
  const defPath = path.join(nativeLibDir, "quickcore.def");
  const libPath = path.join(nativeLibDir, windowsImportLibraryName());
  const exportedSymbols = goExportedSymbols();
  const tool = resolveWindowsImportLibraryTool();

  if (exportedSymbols.length === 0) {
    throw new Error("No //export symbols found in bridge/cabi/main.go");
  }

  const defContents = [
    `LIBRARY ${dllName}`,
    "EXPORTS",
    ...exportedSymbols.map((symbol) => `  ${symbol}`),
    "",
  ].join("\r\n");

  fs.writeFileSync(defPath, defContents);
  run(
    tool.command,
    [
      ...tool.extraArgs,
      `/def:${defPath}`,
      `/out:${libPath}`,
      `/machine:${windowsMachineType()}`,
    ],
    repoRoot,
  );
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

  if (process.platform === "win32") {
    buildWindowsImportLibrary();
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
