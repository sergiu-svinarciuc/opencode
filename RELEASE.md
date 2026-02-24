# Release Process

This guide documents the complete process for creating and publishing a new OpenCode release.

## Automated Release (Recommended)

For official releases to `anomalyco/opencode`, use GitHub Actions:

### Via Workflow Dispatch

1. Go to GitHub Actions → `publish` workflow
2. Click "Run workflow"
3. Select branch and set version:
   - `bump`: major, minor, or patch
   - OR `version`: specify exact version (e.g., `1.2.10.1`)
4. Workflow will:
   - Create GitHub release with auto-generated changelog
   - Build CLI binaries for all platforms
   - Build desktop apps (macOS, Windows, Linux)
   - Publish npm packages
   - Update all version files

### Automatic on Push

The `publish.yml` workflow triggers automatically on push to:

- `ci` branch
- `dev` branch
- `beta` branch
- `snapshot-*` branches

## Manual Release (Fork)

For releasing to personal forks (e.g., `sergiu-svinarciuc/opencode`):

### 1. Update Version

```bash
# Edit packages/opencode/package.json
vim packages/opencode/package.json  # Update "version" field

# Commit version bump
git add packages/opencode/package.json
git commit -m "release: v1.2.10.1"
git push origin fork --no-verify
```

### 2. Merge to dev branch

```bash
# Fetch latest dev
git fetch origin dev

# Switch to dev and merge fork
git checkout dev
git merge fork -m "Merge fork into dev for v1.2.10.1 release"

# Push to dev
git push origin dev --no-verify
```

### 3. Create GitHub Release

```bash
# Set environment variables
export OPENCODE_VERSION=1.2.10.1
export OPENCODE_RELEASE=true
export GH_REPO=sergiu-svinarciuc/opencode

# Create release notes (or use script/changelog.ts for auto-generated notes)
cat > /tmp/release-notes.md << 'EOF'
## Core
- Your changes here

## TUI
- Your changes here

## Desktop
- Your changes here

## SDK
- Your changes here

## Extensions
- Your changes here
EOF

# Create GitHub release (draft)
gh release create v${OPENCODE_VERSION} \
  --repo ${GH_REPO} \
  --draft \
  --title "v${OPENCODE_VERSION}" \
  --notes-file /tmp/release-notes.md
```

### 4. Build CLI Artifacts

```bash
# Build binaries for all platforms
cd packages/opencode
export OPENCODE_VERSION=1.2.10.1
export OPENCODE_RELEASE=true
bun ./script/build.ts --all
```

This creates 10 binaries:

- macOS: `opencode-darwin-arm64.zip`, `opencode-darwin-x64.zip`
- Linux: `opencode-linux-arm64.tar.gz`, `opencode-linux-x64.tar.gz`, `opencode-linux-x64-baseline.tar.gz`, `opencode-linux-arm64-musl.tar.gz`, `opencode-linux-x64-musl.tar.gz`, `opencode-linux-x64-baseline-musl.tar.gz`
- Windows: `opencode-windows-x64.zip`, `opencode-windows-x64-baseline.zip`

### 5. Upload Artifacts

Upload in batches to avoid timeouts:

```bash
# macOS
gh release upload v${OPENCODE_VERSION} \
  ../dist/opencode-darwin-arm64.zip \
  ../dist/opencode-darwin-x64.zip \
  --clobber --repo ${GH_REPO}

# Linux
gh release upload v${OPENCODE_VERSION} \
  ../dist/opencode-linux-*.tar.gz \
  --clobber --repo ${GH_REPO}

# Windows
gh release upload v${OPENCODE_VERSION} \
  ../dist/opencode-windows-*.zip \
  --clobber --repo ${GH_REPO}
```

### 6. Update All Package Versions

```bash
# Return to repo root
cd ../..

# Run publish script to update all versions
export OPENCODE_VERSION=1.2.10.1
export OPENCODE_RELEASE=true
export GH_REPO=sergiu-svinarciuc/opencode
bun ./script/publish.ts
```

This updates:

- All `package.json` files (18+ packages)
- `packages/extensions/zed/extension.toml`
- Commits changes with "release: v${OPENCODE_VERSION}"
- Creates git tag

### 7. Push to Remote

```bash
# Push dev branch and tag
git push origin HEAD --tags --no-verify --force-with-lease
```

### 8. Publish Release

```bash
# Mark release as published (no longer draft)
gh release edit v${OPENCODE_VERSION} \
  --draft=false \
  --repo ${GH_REPO}
```

### 9. (Optional) Build Desktop Apps

Tauri apps require:

- macOS: Xcode and code signing certificates
- Windows: Visual Studio and signing keys
- Linux: WebKitGTK dependencies

```bash
cd packages/desktop

# Prepare version
export OPENCODE_VERSION=1.2.10.1
export GITHUB_TOKEN=<your-token>
bun ./scripts/prepare.ts

# Build for current platform
bun run tauri build

# Or build for all platforms via GitHub Actions
```

## Important Notes

### For Forks

- npm publishing will fail unless you have permissions for the `opencode-ai` package
- For personal releases, GitHub release artifacts are sufficient
- Repository rules may restrict tag creation in some forks

### Auto-Generated Changelog

Use the changelog script for release notes:

```bash
bun ./script/changelog.ts --from 1.2.10 --to HEAD
```

This generates:

- Grouped changes by area (Core, TUI, Desktop, SDK, Extensions)
- Community contributor list
- Format suitable for release notes

### Version Numbering

Follow semantic versioning:

- Major (X.0.0): Breaking changes
- Minor (x.Y.0): New features, backward compatible
- Patch (x.y.Z): Bug fixes, backward compatible

For hotfix releases on branches:

- Use format like `1.2.10.1` (patch release of 1.2.10)

### Release Artifacts

**CLI Binaries**

- Location: `packages/opencode/dist/`
- Formats: `.zip` (Windows/macOS), `.tar.gz` (Linux)
- Size: 35-55MB per binary
- Platforms: 10 total (Linux x64/arm64 + musl/baseline, macOS x64/arm64, Windows x64 + baseline)

**npm Packages** (if publishing)

- `opencode-ai` - Main CLI package
- `@opencode-ai/sdk` - SDK
- `@opencode-ai/plugin` - Plugin package
- All scoped to personal fork if publishing under different name

**Desktop Apps** (if building)

- macOS: `.dmg` files (signed + notarized)
- Windows: `.exe` installer
- Linux: `.deb`, `.rpm`, `.AppImage`

## Troubleshooting

### Tag Push Fails

```bash
# Check repository rule violations
gh api /repos/<user>/opencode/rules/<ref>

# Delete conflicting tags locally
git tag -d <problematic-tag>

# Push specific tag
git push origin refs/tags/v1.2.10.1
```

### Artifact Upload Timeout

Upload in smaller batches (2-3 files at a time) instead of all at once.

### npm Authentication

```bash
npm adduser
# Enter credentials for npmjs.org
```

Note: Only works if you have package ownership rights.

## References

- **Workflow**: `.github/workflows/publish.yml`
- **Version script**: `script/version.ts`
- **Publish script**: `script/publish.ts`
- **Build script**: `packages/opencode/script/build.ts`
- **Changelog script**: `script/changelog.ts`
