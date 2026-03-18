# Installation

## npm (recommended)

The easiest way to install QuickCLI on any platform with Node.js ≥ 16:

```bash
npm install -g @starryskyworld/quickcli
```

The npm package automatically downloads the correct pre-built binary for your OS and architecture on first run.

## Pre-built binaries

Download the latest release for your platform from the [GitHub Releases](https://github.com/AmethystDev-Labs/QuickCLI/releases) page:

| Platform | File |
|---|---|
| Linux (amd64) | `quick_linux_amd64.tar.gz` |
| Linux (arm64) | `quick_linux_arm64.tar.gz` |
| macOS (amd64) | `quick_darwin_amd64.tar.gz` |
| macOS (arm64 / M-series) | `quick_darwin_arm64.tar.gz` |
| Windows (amd64) | `quick_windows_amd64.zip` |

Extract the archive and move the `quick` (or `quick.exe`) binary to a directory on your `PATH`:

```bash
# Linux / macOS example
tar -xzf quick_linux_amd64.tar.gz
sudo mv quick /usr/local/bin/
```

## Build from source

Requires **Go 1.21+**.

```bash
git clone https://github.com/AmethystDev-Labs/QuickCLI.git
cd QuickCLI
go build -o quick .
# Move binary to PATH
sudo mv quick /usr/local/bin/
```

## Verify installation

```bash
quick --version
```

## Shell completion (optional)

QuickCLI uses [Cobra](https://github.com/spf13/cobra) and supports shell completion for Bash, Zsh, Fish, and PowerShell:

```bash
# Zsh
quick completion zsh > "${fpath[1]}/_quick"

# Bash
quick completion bash > /etc/bash_completion.d/quick

# Fish
quick completion fish | source

# PowerShell
quick completion powershell | Out-String | Invoke-Expression
```
