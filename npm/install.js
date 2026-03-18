#!/usr/bin/env node
/**
 * postinstall script — downloads the correct `quick` binary for the current
 * platform from the GitHub Releases page and places it in ./bin/quick(.exe).
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { version } = require("./package.json");

const GITHUB_OWNER = "AmethystDev-Labs";
const GITHUB_REPO = "QuickCLI";

function getPlatformAsset() {
  const { platform, arch } = process;

  const os =
    platform === "darwin"
      ? "macOS"
      : platform === "win32"
      ? "Windows"
      : "Linux";

  const cpu = arch === "arm64" ? "arm64" : "x86_64";
  const ext = platform === "win32" ? ".zip" : ".tar.gz";

  return `quick_${version}_${os}_${cpu}${ext}`;
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = (url) => {
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return request(res.headers.location);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode} — ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      }).on("error", reject);
    };
    request(url);
  });
}

async function install() {
  const assetName = getPlatformAsset();
  const downloadURL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${version}/${assetName}`;

  const binDir = path.join(__dirname, "bin");
  fs.mkdirSync(binDir, { recursive: true });

  const tmpPath = path.join(binDir, assetName);
  // The JS shim at bin/quick handles dispatch; the real binary uses a different name
  // to avoid colliding with the shim file.
  const binaryName = process.platform === "win32" ? "quick.exe" : "quick-bin";
  const binaryDest = path.join(binDir, binaryName);

  console.log(`Downloading ${assetName} from GitHub Releases…`);
  await downloadFile(downloadURL, tmpPath);

  // Extract the binary from the archive.
  if (assetName.endsWith(".zip")) {
    // Windows — use PowerShell's Expand-Archive
    execSync(
      `powershell -Command "Expand-Archive -Force '${tmpPath}' '${binDir}'"`,
      { stdio: "inherit" }
    );
  } else {
    // macOS/Linux: extract as "quick" then rename to "quick-bin"
    execSync(`tar -xzf "${tmpPath}" -C "${binDir}" quick`, {
      stdio: "inherit",
    });
    fs.renameSync(path.join(binDir, "quick"), binaryDest);
  }

  fs.unlinkSync(tmpPath);

  // Ensure the binary is executable on Unix.
  if (process.platform !== "win32") {
    fs.chmodSync(binaryDest, 0o755);
  }

  console.log(`quick ${version} installed successfully!`);
}

install().catch((err) => {
  console.error("Failed to install quick:", err.message);
  process.exit(1);
});
