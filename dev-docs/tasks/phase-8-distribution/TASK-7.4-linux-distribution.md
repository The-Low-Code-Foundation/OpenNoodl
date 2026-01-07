# Task 7.4: Linux Universal Distribution

## Problem Statement

Linux support is currently incomplete:
- Only `.deb` target configured
- Someone added Arch Linux support (AUR?) but status unclear
- No AppImage for universal distribution
- No auto-update support for Linux
- Native modules (dugite, desktop-trampoline) may have compatibility issues

## Goals

1. **AppImage**: Universal format that works on any Linux distribution
2. **.deb**: Native experience for Debian/Ubuntu users (largest desktop Linux market)
3. **Auto-update**: AppImage supports electron-updater
4. **Tested**: Verified on Ubuntu 22.04 LTS and 24.04 LTS

## Linux Desktop Market Context

| Distribution Family | Market Share | Target Format |
|---------------------|--------------|---------------|
| Ubuntu/Debian | ~60% | .deb + AppImage |
| Fedora/RHEL | ~15% | AppImage (RPM optional) |
| Arch | ~10% | AppImage + AUR |
| Other | ~15% | AppImage |

**Decision**: AppImage as primary (works everywhere), .deb as secondary (native experience for majority).

## Implementation

### Phase 1: Configure electron-builder for Linux

**Step 1.1: Update package.json**

```json
{
  "build": {
    "linux": {
      "target": [
        {
          "target": "AppImage",
          "arch": ["x64"]
        },
        {
          "target": "deb",
          "arch": ["x64"]
        }
      ],
      "category": "Development",
      "icon": "build/icons",
      "synopsis": "Visual low-code React development platform",
      "description": "Nodegex is a full-stack low-code platform for building React applications visually.",
      "desktop": {
        "Name": "Nodegex",
        "Comment": "Visual React Development",
        "Categories": "Development;IDE;",
        "Keywords": "react;low-code;visual;programming;node;"
      },
      "mimeTypes": [
        "x-scheme-handler/nodegex"
      ]
    },
    
    "appImage": {
      "artifactName": "${productName}-${version}-${arch}.AppImage",
      "license": "LICENSE"
    },
    
    "deb": {
      "artifactName": "${productName}-${version}-${arch}.deb",
      "depends": [
        "libgtk-3-0",
        "libnotify4",
        "libnss3",
        "libxss1",
        "libxtst6",
        "xdg-utils",
        "libatspi2.0-0",
        "libuuid1",
        "libsecret-1-0"
      ],
      "category": "Development"
    }
  }
}
```

### Phase 2: Handle Native Modules

The trickiest part is ensuring dugite's embedded git and desktop-trampoline work on Linux.

**Step 2.1: Verify dugite Linux binaries**

dugite downloads platform-specific git binaries. Verify they're included:

```bash
# After build, check the AppImage contents
./Nodegex-1.2.0-x64.AppImage --appimage-extract
ls -la squashfs-root/resources/app.asar.unpacked/node_modules/dugite/git/
```

**Step 2.2: Check desktop-trampoline**

```bash
ls -la squashfs-root/resources/app.asar.unpacked/node_modules/desktop-trampoline/build/Release/
file squashfs-root/resources/app.asar.unpacked/node_modules/desktop-trampoline/build/Release/desktop-trampoline
```

**Step 2.3: Verify library dependencies**

```bash
# Check for missing shared libraries
ldd squashfs-root/resources/app.asar.unpacked/node_modules/dugite/git/bin/git
ldd squashfs-root/nodegex
```

### Phase 3: AppImage Auto-Update Support

AppImage is the only Linux format that supports electron-updater.

**Step 3.1: How it works**

1. electron-updater checks GitHub Releases for `latest-linux.yml`
2. Downloads new `.AppImage` to temp location
3. User confirms restart
4. New AppImage replaces old one
5. App restarts

**Step 3.2: Required publish config**

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "the-low-code-foundation",
      "repo": "opennoodl"
    }
  }
}
```

**Step 3.3: Auto-update behavior**

The existing `autoupdater.js` already handles Linux correctly:

```javascript
if (process.platform === 'linux') {
  return; // Currently disabled
}
```

We need to **enable** it for AppImage:

```javascript
function setupAutoUpdate(window) {
  if (process.env.autoUpdate === 'no') return;

  // AppImage auto-update works, .deb does not
  if (process.platform === 'linux' && !process.env.APPIMAGE) {
    console.log('Auto-update only available for AppImage');
    return;
  }

  // ... rest of auto-update logic
}
```

### Phase 4: Icon Generation

Linux needs multiple icon sizes in PNG format.

**Step 4.1: Create icon set**

```bash
# From a 1024x1024 source icon
mkdir -p build/icons

for size in 16 24 32 48 64 128 256 512 1024; do
  convert icon-source.png -resize ${size}x${size} build/icons/${size}x${size}.png
done
```

**Step 4.2: Directory structure**

```
build/
  icons/
    16x16.png
    24x24.png
    32x32.png
    48x48.png
    64x64.png
    128x128.png
    256x256.png
    512x512.png
    1024x1024.png
```

### Phase 5: Protocol Handler Registration

For `nodegex://` URLs to work:

**Step 5.1: Desktop file configuration**

The `mimeTypes` config in package.json creates the association. Additionally, update the `protocols` config:

```json
{
  "build": {
    "protocols": {
      "name": "nodegex",
      "schemes": ["nodegex"]
    }
  }
}
```

**Step 5.2: Manual registration (if needed)**

```bash
# For AppImage users who need manual registration
xdg-mime default nodegex.desktop x-scheme-handler/nodegex
```

### Phase 6: Build Script

**Step 6.1: Create Linux build script**

```bash
#!/bin/bash
# scripts/build-linux.sh

set -e

# Build for x64 (most common)
# ARM64 support would require additional setup for native modules

echo "Building Linux targets..."

# AppImage
npx electron-builder --linux AppImage --x64

# Debian package
npx electron-builder --linux deb --x64

echo "Build complete!"
echo ""
echo "Outputs:"
ls -la dist/*.AppImage dist/*.deb 2>/dev/null || echo "No artifacts found"
```

**Step 6.2: Add to package.json**

```json
{
  "scripts": {
    "build:linux": "./scripts/build-linux.sh",
    "build:linux:appimage": "electron-builder --linux AppImage --x64",
    "build:linux:deb": "electron-builder --linux deb --x64"
  }
}
```

### Phase 7: Testing

**Step 7.1: Test on fresh Ubuntu VM**

```bash
# Ubuntu 22.04 LTS
sudo apt update
sudo apt install -y libfuse2  # Required for AppImage

chmod +x Nodegex-1.2.0-x64.AppImage
./Nodegex-1.2.0-x64.AppImage
```

**Step 7.2: Test .deb installation**

```bash
sudo dpkg -i Nodegex-1.2.0-x64.deb
# If dependencies missing:
sudo apt-get install -f

# Launch
nodegex
```

**Step 7.3: Test protocol handler**

```bash
xdg-open "nodegex://test"
```

**Step 7.4: Verify auto-update (AppImage only)**

1. Install older version
2. Create GitHub Release with newer version
3. Wait for update notification
4. Click "Restart"
5. Verify new version launches

## Known Issues & Workarounds

### AppImage FUSE dependency

Ubuntu 22.04+ doesn't include FUSE by default:

```bash
# Users need to install:
sudo apt install libfuse2
```

Document this in release notes.

### Wayland compatibility

Some Electron features behave differently on Wayland vs X11:

```bash
# Force X11 if issues occur
GDK_BACKEND=x11 ./Nodegex.AppImage
```

### Sandbox issues on some distributions

If sandbox errors occur:

```bash
# Disable sandbox (less secure but works)
./Nodegex.AppImage --no-sandbox
```

Or fix system-wide:
```bash
sudo sysctl -w kernel.unprivileged_userns_clone=1
```

## Files to Modify

| File | Changes |
|------|---------|
| `packages/noodl-editor/package.json` | Add Linux targets, icons, desktop config |
| `packages/noodl-editor/src/main/src/autoupdater.js` | Enable for AppImage |
| `packages/noodl-editor/build/icons/` | Add PNG icon set |
| `scripts/build-linux.sh` | Create build script |

## Success Criteria

1. ✅ AppImage runs on fresh Ubuntu 22.04 LTS
2. ✅ AppImage runs on fresh Ubuntu 24.04 LTS
3. ✅ .deb installs without manual dependency resolution
4. ✅ Auto-update works for AppImage distribution
5. ✅ `nodegex://` protocol handler works
6. ✅ Desktop integration (icon, menu entry) works

## Distribution Channels

### GitHub Releases

Both AppImage and .deb uploaded to releases.

### Optional: Snapcraft

```yaml
# snap/snapcraft.yaml (future enhancement)
name: nodegex
base: core22
version: '1.2.0'
summary: Visual low-code React development platform
confinement: classic
```

### Optional: Flathub

Flatpak provides another universal format but requires more setup and maintenance.

## ARM64 Consideration

ARM64 Linux (Raspberry Pi, etc.) would require:
- Cross-compilation setup
- ARM64 dugite binaries
- ARM64 desktop-trampoline build

This is out of scope for initial release but could be added later.
