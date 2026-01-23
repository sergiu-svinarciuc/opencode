# OpenCode Desktop

Native OpenCode desktop app, built with Tauri v2.

## Development

From the repo root:

```bash
bun install
bun run --cwd packages/desktop tauri dev
```

This starts the Vite dev server on http://localhost:1420 and opens the native window.

If you only want the web dev server (no native shell):

```bash
bun run --cwd packages/desktop dev
```

## Build

To create a production `dist/` and build the native app bundle:

```bash
bun run --cwd packages/desktop tauri build
```

## Prerequisites

Running the desktop app requires additional Tauri dependencies (Rust toolchain, platform-specific libraries). See the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for setup instructions.

## Cross-Compilation: Building Windows from Mac

Building the Windows desktop app from macOS requires `cargo-xwin` which provides the Windows SDK headers needed for cross-compilation.

### Setup (one-time)

1. Install Rust if not already installed:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. Add the Windows target:
   ```bash
   rustup target add x86_64-pc-windows-msvc
   ```

3. Install cargo-xwin:
   ```bash
   cargo install cargo-xwin
   ```

4. Install LLVM (required for linking):
   ```bash
   brew install llvm
   ```

### Building

1. Create a wrapper script for cargo-xwin (Tauri CLI needs a single command as runner):
   ```bash
   cat > /tmp/cargo-xwin-wrapper << 'EOF'
   #!/bin/bash
   export XWIN_CACHE_DIR="$HOME/.cache/cargo-xwin"
   export PATH="/opt/homebrew/opt/llvm/bin:$PATH"
   exec cargo xwin "$@"
   EOF
   chmod +x /tmp/cargo-xwin-wrapper
   ```

2. Copy the Windows CLI binary to sidecars (build separately or download from releases):
   ```bash
   mkdir -p packages/desktop/src-tauri/sidecars
   cp path/to/opencode-cli.exe packages/desktop/src-tauri/sidecars/opencode-cli-x86_64-pc-windows-msvc.exe
   ```

3. Build with Tauri CLI using the wrapper:
   ```bash
   cd packages/desktop
   bunx @tauri-apps/cli build --target x86_64-pc-windows-msvc --no-bundle --ci --runner "/tmp/cargo-xwin-wrapper"
   ```

4. The output will be at:
   ```
   packages/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/OpenCode.exe
   ```

### Packaging

Create a distribution package:
```bash
cd packages/desktop/src-tauri/target/x86_64-pc-windows-msvc/release
mkdir -p opencode-windows
cp OpenCode.exe opencode-windows/
cp opencode-cli.exe opencode-windows/
zip -r opencode-desktop-windows-x64.zip opencode-windows/
```

### Important Notes

- **Do NOT use `cargo build` directly** - it won't embed the frontend assets. Always use `tauri build` which runs `beforeBuildCommand` and embeds the `dist/` folder.
- The first build downloads the Windows SDK (~1GB) to `~/.cache/cargo-xwin/`
- Build time is approximately 3-4 minutes after initial setup
- The `--no-bundle` flag skips creating installers (NSIS) which require Windows-specific tools
