# Task 7.5: GitHub Actions CI/CD Pipeline

## Problem Statement

Currently, building Nodegex for distribution requires:
- Manual builds on each platform (macOS, Windows, Linux)
- Access to a macOS machine for Apple Silicon builds
- Manual code signing
- Manual upload to distribution channels
- No automated testing before release

## Goals

1. **Automated Builds**: Push tag → builds start automatically
2. **All Platforms**: macOS (x64 + arm64), Windows (x64), Linux (x64)
3. **Code Signing**: Automatic for all platforms
4. **GitHub Releases**: Automatic creation with all artifacts
5. **Update Manifests**: `latest.yml`, `latest-mac.yml`, `latest-linux.yml` generated

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        GitHub Actions Workflow                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Tag Push (v1.2.0)                                                       │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Build Matrix                                  │    │
│  ├─────────────────┬─────────────────┬─────────────────────────────┤    │
│  │  macOS x64      │  macOS arm64    │  Windows x64  │  Linux x64  │    │
│  │  (macos-13)     │  (macos-14)     │  (windows)    │  (ubuntu)   │    │
│  │                 │                 │               │             │    │
│  │  • Build        │  • Build        │  • Build      │  • Build    │    │
│  │  • Sign         │  • Sign         │  • Sign*      │  • No sign  │    │
│  │  • Notarize     │  • Notarize     │               │             │    │
│  └─────────────────┴─────────────────┴───────────────┴─────────────┘    │
│       │                   │                 │               │            │
│       └───────────────────┴─────────────────┴───────────────┘            │
│                                    │                                      │
│                                    ▼                                      │
│                          GitHub Release                                   │
│                    • DMG (x64, arm64)                                    │
│                    • ZIP (x64, arm64)                                    │
│                    • EXE installer                                        │
│                    • AppImage                                             │
│                    • DEB                                                  │
│                    • latest*.yml manifests                               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Implementation

### Phase 1: Create Workflow File

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

env:
  GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

jobs:
  release:
    runs-on: ${{ matrix.os }}
    
    strategy:
      fail-fast: false
      matrix:
        include:
          # macOS Intel
          - os: macos-13
            platform: darwin
            arch: x64
            
          # macOS Apple Silicon
          - os: macos-14
            platform: darwin
            arch: arm64
            
          # Windows
          - os: windows-latest
            platform: win32
            arch: x64
            
          # Linux
          - os: ubuntu-22.04
            platform: linux
            arch: x64

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build packages
        run: npm run build --workspaces --if-present

      # macOS: Import certificate and configure signing
      - name: Import macOS signing certificate
        if: matrix.platform == 'darwin'
        env:
          MACOS_CERTIFICATE: ${{ secrets.MACOS_CERTIFICATE }}
          MACOS_CERTIFICATE_PASSWORD: ${{ secrets.MACOS_CERTIFICATE_PASSWORD }}
        run: |
          # Create temporary keychain
          KEYCHAIN_PATH=$RUNNER_TEMP/build.keychain
          KEYCHAIN_PASSWORD=$(openssl rand -base64 32)
          
          security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
          security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
          
          # Import certificate
          echo "$MACOS_CERTIFICATE" | base64 --decode > $RUNNER_TEMP/certificate.p12
          security import $RUNNER_TEMP/certificate.p12 \
            -k "$KEYCHAIN_PATH" \
            -P "$MACOS_CERTIFICATE_PASSWORD" \
            -T /usr/bin/codesign \
            -T /usr/bin/security
          
          # Allow codesign to access keychain
          security set-key-partition-list -S apple-tool:,apple: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
          security list-keychains -d user -s "$KEYCHAIN_PATH" login.keychain
          
          # Verify certificate
          security find-identity -v -p codesigning "$KEYCHAIN_PATH"

      # Windows: Import certificate (if signing enabled)
      - name: Import Windows signing certificate
        if: matrix.platform == 'win32' && secrets.WINDOWS_CERTIFICATE != ''
        env:
          WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
          WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
        run: |
          echo "$env:WINDOWS_CERTIFICATE" | Out-File -FilePath certificate.b64
          certutil -decode certificate.b64 certificate.pfx
          # Certificate will be used by electron-builder automatically
        shell: pwsh

      # Build Electron app
      - name: Build Electron app
        env:
          # macOS signing
          CSC_LINK: ${{ matrix.platform == 'darwin' && secrets.MACOS_CERTIFICATE || '' }}
          CSC_KEY_PASSWORD: ${{ matrix.platform == 'darwin' && secrets.MACOS_CERTIFICATE_PASSWORD || '' }}
          
          # macOS notarization
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          
          # Windows signing (optional)
          WIN_CSC_LINK: ${{ matrix.platform == 'win32' && secrets.WINDOWS_CERTIFICATE || '' }}
          WIN_CSC_KEY_PASSWORD: ${{ matrix.platform == 'win32' && secrets.WINDOWS_CERTIFICATE_PASSWORD || '' }}
          
        run: |
          cd packages/noodl-editor
          npx electron-builder --${{ matrix.platform == 'darwin' && 'mac' || matrix.platform == 'win32' && 'win' || 'linux' }} --${{ matrix.arch }} --publish always

      # Upload artifacts to GitHub Release
      - name: Upload artifacts
        uses: softprops/action-gh-release@v1
        with:
          files: |
            packages/noodl-editor/dist/*.dmg
            packages/noodl-editor/dist/*.zip
            packages/noodl-editor/dist/*.exe
            packages/noodl-editor/dist/*.AppImage
            packages/noodl-editor/dist/*.deb
            packages/noodl-editor/dist/*.yml
            packages/noodl-editor/dist/*.yaml
          draft: false
          prerelease: ${{ contains(github.ref, 'beta') || contains(github.ref, 'alpha') }}
```

### Phase 2: Configure GitHub Secrets

Navigate to: Repository → Settings → Secrets and variables → Actions

**Required Secrets:**

| Secret | Description | How to Get |
|--------|-------------|------------|
| `MACOS_CERTIFICATE` | Base64-encoded .p12 file | `base64 -i certificate.p12` |
| `MACOS_CERTIFICATE_PASSWORD` | Password for .p12 | Your certificate password |
| `APPLE_ID` | Apple Developer email | Your Apple ID |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password | appleid.apple.com → Security |
| `APPLE_TEAM_ID` | Team ID | Y35J975HXR (from certificate) |

**Optional Secrets (for Windows signing):**

| Secret | Description |
|--------|-------------|
| `WINDOWS_CERTIFICATE` | Base64-encoded .pfx file |
| `WINDOWS_CERTIFICATE_PASSWORD` | Certificate password |

### Phase 3: Export macOS Certificate for CI

```bash
# 1. Export from Keychain Access
#    - Open Keychain Access
#    - Find "Developer ID Application: Osborne Solutions"
#    - Right-click → Export
#    - Save as .p12 with strong password

# 2. Base64 encode
base64 -i "Developer ID Application.p12" | pbcopy
# Paste into MACOS_CERTIFICATE secret

# 3. Generate app-specific password
#    - Go to appleid.apple.com
#    - Sign In & Security → App-Specific Passwords
#    - Generate new password labeled "nodegex-ci"
#    - Copy to APPLE_APP_SPECIFIC_PASSWORD secret
```

### Phase 4: Update package.json for CI

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "the-low-code-foundation",
      "repo": "opennoodl",
      "releaseType": "release"
    },
    
    "mac": {
      "target": [
        { "target": "dmg", "arch": ["x64", "arm64"] },
        { "target": "zip", "arch": ["x64", "arm64"] }
      ]
    },
    
    "win": {
      "target": [
        { "target": "nsis", "arch": ["x64"] }
      ]
    },
    
    "linux": {
      "target": [
        { "target": "AppImage", "arch": ["x64"] },
        { "target": "deb", "arch": ["x64"] }
      ]
    }
  }
}
```

### Phase 5: Release Process

**Step 5.1: Create release**

```bash
# Update version in package.json
npm version patch  # or minor, major

# Push with tags
git push && git push --tags
```

**Step 5.2: Monitor workflow**

Go to: Repository → Actions → Release workflow

Each platform builds in parallel (~15-30 minutes total).

**Step 5.3: Verify release**

1. Check GitHub Releases for all artifacts
2. Download and test on each platform
3. Verify auto-update works from previous version

### Phase 6: Version Management

**Semantic Versioning:**
- `v1.0.0` → Stable release
- `v1.1.0-beta.1` → Beta release
- `v1.1.0-alpha.1` → Alpha release

**Pre-release handling:**

Tags containing `beta` or `alpha` automatically create pre-releases that don't trigger auto-update for stable users.

### Phase 7: Update Manifests

electron-builder automatically generates:

```yaml
# latest-mac.yml
version: 1.2.0
files:
  - url: Nodegex-1.2.0-arm64.dmg
    sha512: abc123...
    size: 150000000
  - url: Nodegex-1.2.0-x64.dmg
    sha512: def456...
    size: 155000000
path: Nodegex-1.2.0-arm64.dmg
sha512: abc123...
releaseDate: '2024-01-15T10:30:00.000Z'
```

These files tell electron-updater which version is latest and where to download.

## Workflow Customizations

### Manual Trigger

Add workflow_dispatch for manual runs:

```yaml
on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to build'
        required: true
```

### Build on PR (Testing)

Create separate workflow for PR testing:

```yaml
# .github/workflows/build-test.yml
name: Build Test

on:
  pull_request:
    paths:
      - 'packages/noodl-editor/**'
      - '.github/workflows/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build --workspaces
      - run: cd packages/noodl-editor && npx electron-builder --linux --dir
```

### Caching

Speed up builds with dependency caching:

```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.npm
      ~/.cache/electron
      ~/.cache/electron-builder
    key: ${{ runner.os }}-build-${{ hashFiles('**/package-lock.json') }}
```

## Troubleshooting

### macOS: "No identity found"

Certificate not imported correctly:
```yaml
# Debug step
- name: Debug certificates
  if: matrix.platform == 'darwin'
  run: |
    security list-keychains
    security find-identity -v -p codesigning
```

### macOS: Notarization timeout

Apple's servers can be slow. Increase timeout or retry:
```javascript
// macos-notarize.js
await notarize({
  // ...
  timeout: 1800000 // 30 minutes
});
```

### Windows: SmartScreen warning

Without EV certificate, SmartScreen shows warning for first ~1000 downloads. Solutions:
1. Purchase EV code signing certificate (~$400/year)
2. Accept warnings initially (reputation builds over time)

### Linux: AppImage won't run

Missing FUSE. Document in release notes:
```markdown
## Linux Users
AppImage requires FUSE:
\`\`\`bash
sudo apt install libfuse2
\`\`\`
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `.github/workflows/release.yml` | Create |
| `.github/workflows/build-test.yml` | Create (optional) |
| `packages/noodl-editor/package.json` | Add publish config |
| `packages/noodl-editor/build/macos-notarize.js` | Update for CI |

## Success Criteria

1. ✅ `git tag v1.2.0 && git push --tags` triggers workflow
2. ✅ All 4 build targets complete successfully
3. ✅ GitHub Release created with all artifacts
4. ✅ Update manifests (latest*.yml) present
5. ✅ Existing users see "Update Available" within 1 minute
6. ✅ Build time < 30 minutes total

## Cost Considerations

GitHub Actions is free for public repositories.

For private repos:
- 2,000 minutes/month free
- Each release uses ~60-90 minutes (all platforms combined)
- ~20-30 releases/month possible on free tier

## Security Considerations

1. **Secrets Protection**: Never log secrets or expose in artifacts
2. **Certificate Security**: Rotate certificates before expiration
3. **Tag Protection**: Consider requiring reviews for tags
4. **Artifact Integrity**: SHA512 checksums in update manifests

## Future Enhancements

1. **Changelog Generation**: Auto-generate from merged PRs
2. **Slack/Discord Notifications**: Post release announcements
3. **Download Statistics**: Track per-platform adoption
4. **Rollback Mechanism**: Quick revert to previous version
