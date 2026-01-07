# Task 7.2: Fix macOS Automatic Code Signing

## Problem Statement

Currently, macOS builds require manual code signing of 30+ individual files using a bash script. This process:
- Takes 15-30 minutes per build
- Is error-prone (easy to miss files or sign in wrong order)
- Must be repeated for both Intel (x64) and Apple Silicon (arm64)
- Blocks automation via CI/CD

**Root Cause**: electron-builder's automatic signing isn't configured, so it skips signing entirely.

## Current Manual Process (What We're Eliminating)

```bash
# Current painful workflow:
1. Run electron-builder (produces unsigned app)
2. Manually run signing script with 30+ codesign commands
3. Sign in specific order (inner files first, .app last)
4. Hope you didn't miss anything
5. Run notarization
6. Wait 5-10 minutes for Apple
7. Staple the notarization ticket
8. Repeat for other architecture
```

## Target Automated Process

```bash
# Target workflow:
export CSC_NAME="Developer ID Application: Osborne Solutions (Y35J975HXR)"
export APPLE_ID="your@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="Y35J975HXR"

npm run build  # Everything happens automatically
```

## Implementation

### Phase 1: Verify Certificate Setup

**Step 1.1: Check Keychain**

```bash
# List all Developer ID certificates
security find-identity -v -p codesigning

# Should show something like:
# 1) ABCD1234... "Developer ID Application: Osborne Solutions (Y35J975HXR)"
```

**Step 1.2: Verify Certificate Chain**

```bash
# Check certificate details
security find-certificate -c "Developer ID Application: Osborne Solutions" -p | \
  openssl x509 -noout -subject -issuer -dates
```

**Step 1.3: Test Manual Signing**

```bash
# Create a simple test binary
echo 'int main() { return 0; }' | clang -x c - -o /tmp/test
codesign --sign "Developer ID Application: Osborne Solutions (Y35J975HXR)" \
         --options runtime /tmp/test
codesign --verify --verbose /tmp/test
```

### Phase 2: Configure electron-builder

**Step 2.1: Update package.json**

```json
{
  "build": {
    "appId": "com.nodegex.app",
    "productName": "Nodegex",
    "afterSign": "./build/macos-notarize.js",
    
    "mac": {
      "category": "public.app-category.developer-tools",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist",
      "target": [
        { "target": "dmg", "arch": ["x64", "arm64"] },
        { "target": "zip", "arch": ["x64", "arm64"] }
      ],
      "signIgnore": [],
      "extendInfo": {
        "LSMultipleInstancesProhibited": true,
        "NSMicrophoneUsageDescription": "Allow Nodegex apps to access the microphone?",
        "NSCameraUsageDescription": "Allow Nodegex apps to access the camera?"
      }
    },
    
    "dmg": {
      "sign": false
    },
    
    "publish": {
      "provider": "github",
      "owner": "the-low-code-foundation",
      "repo": "opennoodl",
      "releaseType": "release"
    }
  }
}
```

**Key Configuration Notes:**

| Setting | Purpose |
|---------|---------|
| `hardenedRuntime: true` | Required for notarization |
| `gatekeeperAssess: false` | Skip Gatekeeper check during build (faster) |
| `entitlementsInherit` | Apply entitlements to all nested executables |
| `dmg.sign: false` | DMG signing is usually unnecessary and can cause issues |

**Step 2.2: Verify entitlements.mac.plist**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Required for Electron -->
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    
    <!-- Required for Node.js child processes (git, etc.) -->
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
    
    <!-- Network access -->
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>
    
    <!-- File access for projects -->
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    
    <!-- Accessibility for some UI features -->
    <key>com.apple.security.automation.apple-events</key>
    <true/>
</dict>
</plist>
```

**Step 2.3: Update notarization script**

```javascript
// build/macos-notarize.js
const { notarize } = require('@electron/notarize');
const path = require('path');

module.exports = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  
  if (electronPlatformName !== 'darwin') {
    console.log('Skipping notarization: not macOS');
    return;
  }

  // Check for required environment variables
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.log('Skipping notarization: missing credentials');
    console.log('Set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`Notarizing ${appPath}...`);

  try {
    await notarize({
      appPath,
      appleId,
      appleIdPassword,
      teamId,
      tool: 'notarytool' // Faster than legacy altool
    });
    console.log('Notarization complete!');
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  }
};
```

### Phase 3: Handle Native Modules in asar.unpacked

The dugite and desktop-trampoline binaries are in `asar.unpacked` which requires special handling.

**Step 3.1: Verify asar configuration**

```json
{
  "build": {
    "asarUnpack": [
      "node_modules/dugite/**/*",
      "node_modules/desktop-trampoline/**/*"
    ],
    "files": [
      "**/*",
      "!node_modules/dugite/git/**/*",
      "node_modules/dugite/git/bin/*",
      "node_modules/dugite/git/libexec/git-core/*"
    ]
  }
}
```

**Step 3.2: electron-builder automatically signs asar.unpacked**

When `CSC_NAME` or `CSC_LINK` is set, electron-builder will:
1. Find all Mach-O binaries in `asar.unpacked`
2. Sign each with hardened runtime and entitlements
3. Sign them in correct dependency order

### Phase 4: Build Environment Setup

**Step 4.1: Create build script**

```bash
#!/bin/bash
# scripts/build-mac.sh

set -e

# Certificate identity (must match keychain exactly)
export CSC_NAME="Developer ID Application: Osborne Solutions (Y35J975HXR)"

# Apple notarization credentials
export APPLE_ID="${APPLE_ID:?Set APPLE_ID environment variable}"
export APPLE_APP_SPECIFIC_PASSWORD="${APPLE_APP_SPECIFIC_PASSWORD:?Set APPLE_APP_SPECIFIC_PASSWORD}"
export APPLE_TEAM_ID="Y35J975HXR"

# Build for specified architecture or both
ARCH="${1:-universal}"

case "$ARCH" in
  x64)
    npx electron-builder --mac --x64
    ;;
  arm64)
    npx electron-builder --mac --arm64
    ;;
  universal|both)
    npx electron-builder --mac --x64 --arm64
    ;;
  *)
    echo "Usage: $0 [x64|arm64|universal]"
    exit 1
    ;;
esac

echo "Build complete! Check dist/ for output."
```

**Step 4.2: Add to package.json scripts**

```json
{
  "scripts": {
    "build:mac": "./scripts/build-mac.sh",
    "build:mac:x64": "./scripts/build-mac.sh x64",
    "build:mac:arm64": "./scripts/build-mac.sh arm64"
  }
}
```

### Phase 5: Verification

**Step 5.1: Verify all signatures**

```bash
# Check the .app bundle
codesign --verify --deep --strict --verbose=2 "dist/mac-arm64/Nodegex.app"

# Check specific problematic files
codesign -dv "dist/mac-arm64/Nodegex.app/Contents/Resources/app.asar.unpacked/node_modules/dugite/git/bin/git"

# Verify notarization
spctl --assess --type execute --verbose "dist/mac-arm64/Nodegex.app"
```

**Step 5.2: Test Gatekeeper**

```bash
# This simulates what happens when a user downloads and opens the app
xattr -d com.apple.quarantine "dist/mac-arm64/Nodegex.app"
xattr -w com.apple.quarantine "0081;5f8a1234;Safari;12345678-1234-1234-1234-123456789ABC" "dist/mac-arm64/Nodegex.app"
open "dist/mac-arm64/Nodegex.app"
```

**Step 5.3: Verify notarization stapling**

```bash
stapler validate "dist/Nodegex-1.2.0-arm64.dmg"
```

## Troubleshooting

### "The signature is invalid" or signing fails

```bash
# Reset code signing
codesign --remove-signature "path/to/file"

# Check certificate validity
security find-certificate -c "Developer ID" -p | openssl x509 -checkend 0
```

### "errSecInternalComponent" error

The certificate private key isn't accessible:
```bash
# Unlock keychain
security unlock-keychain -p "password" ~/Library/Keychains/login.keychain-db

# Or in CI, create a temporary keychain
security create-keychain -p "" build.keychain
security import certificate.p12 -k build.keychain -P "$CERT_PASSWORD" -T /usr/bin/codesign
security set-key-partition-list -S apple-tool:,apple: -s -k "" build.keychain
```

### Notarization timeout or failure

```bash
# Check notarization history
xcrun notarytool history --apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID"

# Get details on specific submission
xcrun notarytool log <submission-id> --apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID"
```

### dugite binaries not signed

Verify they're correctly unpacked:
```bash
ls -la "dist/mac-arm64/Nodegex.app/Contents/Resources/app.asar.unpacked/node_modules/dugite/git/bin/"
```

If missing, check `asarUnpack` patterns in build config.

## Files to Modify

| File | Changes |
|------|---------|
| `packages/noodl-editor/package.json` | Update build config, add mac targets |
| `packages/noodl-editor/build/entitlements.mac.plist` | Verify all required entitlements |
| `packages/noodl-editor/build/macos-notarize.js` | Update to use notarytool |
| `scripts/noodl-editor/build-editor.ts` | Add CSC_NAME handling |

## Success Criteria

1. ✅ `npm run build:mac:arm64` produces signed app with zero manual steps
2. ✅ `codesign --verify --deep --strict` passes
3. ✅ `spctl --assess --type execute` returns "accepted"
4. ✅ All 30+ files from manual script are signed automatically
5. ✅ App opens on fresh macOS install without Gatekeeper warning

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `CSC_NAME` | Yes* | Certificate name in keychain |
| `CSC_LINK` | Yes* | Path to .p12 certificate file (CI) |
| `CSC_KEY_PASSWORD` | With CSC_LINK | Certificate password |
| `APPLE_ID` | For notarization | Apple Developer account email |
| `APPLE_APP_SPECIFIC_PASSWORD` | For notarization | App-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | For notarization | Team ID (e.g., Y35J975HXR) |

*One of `CSC_NAME` or `CSC_LINK` is required for signing.
