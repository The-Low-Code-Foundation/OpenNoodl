# Phase 7: Auto-Update & Cross-Platform Deployment Infrastructure

## Executive Summary

Phase 7 transforms Nodegex from a manually-distributed application requiring full reinstalls into a professionally deployed desktop application with seamless auto-updates across Windows, macOS (Intel & Apple Silicon), and Linux.

**Current Pain Points:**
- Manual code signing of 30+ files for each macOS build
- Users must download and reinstall for every update, losing local preferences
- No Linux universal distribution
- No automated CI/CD pipeline
- Rebranding from OpenNoodl to Nodegex not complete

**End State:**
- Push a git tag → GitHub Actions builds all platforms → Users see "Update Available" → One-click update
- User data (projects, preferences) persists across updates
- Professional code signing handled automatically
- Linux support via AppImage (universal) and .deb (Debian/Ubuntu)

## Why This Matters

1. **User Experience**: Currently users must re-add all projects after every update. This is a deal-breaker for adoption.
2. **Development Velocity**: Manual signing and packaging takes hours per release. Automated CI/CD enables rapid iteration.
3. **Community Growth**: Linux users are a significant portion of the open-source developer community.
4. **Professional Credibility**: Auto-updates are expected in modern desktop applications.

## Technical Analysis

### Existing Infrastructure (What We Have)

| Component | Status | Location |
|-----------|--------|----------|
| electron-updater | ✅ Installed | `autoupdater.js` |
| Update UI | ✅ Complete | `BaseWindow.tsx`, `TitleBar` |
| Notarization script | ✅ Exists | `build/macos-notarize.js` |
| electron-builder config | ⚠️ Incomplete | `package.json` build section |
| Publish config | ❌ Missing | Needs GitHub Releases setup |
| CI/CD | ❌ Missing | Needs GitHub Actions |

### The Mac Signing Problem Diagnosed

The 30+ manual signatures happen because **electron-builder's automatic signing isn't configured correctly**.

When properly configured, electron-builder signs in this order (automatically):
1. All binaries in `asar.unpacked` (dugite, desktop-trampoline)
2. Helper apps (GPU, Plugin, Renderer)
3. Frameworks (Electron, Squirrel, Mantle, ReactiveObjC)
4. Main executable
5. The .app bundle itself

**Root Cause**: Missing `CSC_LINK` or `CSC_NAME` environment variable. Without this, electron-builder skips signing entirely, then notarization fails.

**The Fix**: 
```bash
# Option 1: Certificate file (for CI)
export CSC_LINK="path/to/certificate.p12"
export CSC_KEY_PASSWORD="certificate-password"

# Option 2: Keychain certificate (for local builds)
export CSC_NAME="Developer ID Application: Osborne Solutions (Y35J975HXR)"
```

### User Data Persistence

This is already solved by Electron's architecture:

| Platform | userData Location | Survives Updates? |
|----------|------------------|-------------------|
| Windows | `%APPDATA%/Nodegex` | ✅ Yes |
| macOS | `~/Library/Application Support/Nodegex` | ✅ Yes |
| Linux | `~/.config/Nodegex` | ✅ Yes |

The project list uses `localStorage` which is stored in `userData`. The reason Richard is losing data is because users are doing **fresh installs** (delete app, download new, install) rather than using the auto-update mechanism.

Once auto-update works, this problem disappears.

## Task Breakdown

### Task 7.1: Rebrand to Nodegex
**Effort**: 4-6 hours | **Complexity**: Low

Update all user-facing references from OpenNoodl/Noodl to Nodegex:
- `package.json` productName, appId, description
- Window titles and UI strings
- Protocol handlers (`nodegex://`)
- userData paths (with migration for existing users)
- Documentation and comments

### Task 7.2: Fix macOS Code Signing
**Effort**: 8-12 hours | **Complexity**: High

Configure electron-builder to sign automatically:
- Verify certificate is in keychain correctly
- Add `CSC_NAME` to build environment
- Test that all 30+ files are signed automatically
- Verify notarization succeeds
- Test on both Intel and Apple Silicon

### Task 7.3: Configure Auto-Update Publishing
**Effort**: 4-6 hours | **Complexity**: Medium

Add GitHub Releases as update source:
- Add `publish` config to package.json
- Configure update server URL
- Test update detection and download
- Test quit-and-install flow

### Task 7.4: Linux Universal Distribution
**Effort**: 6-8 hours | **Complexity**: Medium

Add AppImage and .deb targets:
- Configure AppImage with auto-update support
- Configure .deb for Debian/Ubuntu
- Handle native module compatibility
- Test on Ubuntu 22.04/24.04

### Task 7.5: GitHub Actions CI/CD
**Effort**: 12-16 hours | **Complexity**: High

Create automated build pipeline:
- Matrix build for all platforms/architectures
- Secure certificate storage via GitHub Secrets
- Automatic GitHub Release creation
- Version tagging workflow

### Task 7.6: Windows Code Signing (Optional Enhancement)
**Effort**: 4-8 hours | **Complexity**: Medium

Add Windows code signing to eliminate SmartScreen warnings:
- Obtain code signing certificate (EV or standard)
- Configure in electron-builder
- Add to CI/CD pipeline

## Architecture Decisions

### Update Distribution: GitHub Releases

**Why GitHub Releases over other options:**

| Option | Pros | Cons |
|--------|------|------|
| GitHub Releases | Free, integrated with repo, electron-updater native support | Public releases only |
| S3/CloudFront | Private releases, full control | Cost, complexity |
| Nuts/Hazel | More control | Self-hosted, maintenance |
| Electron Forge | Modern tooling | Migration effort |

**Decision**: GitHub Releases - simplest path, zero cost, electron-builder native support.

### Linux Format: AppImage + .deb

**Why AppImage:**
- Single file, no installation required
- Works on any Linux distribution
- electron-updater supports AppImage auto-updates
- No root required

**Why .deb:**
- Native experience for Debian/Ubuntu users (60%+ of Linux desktop)
- Integrates with system package manager
- Desktop integration (menus, file associations)

### Signing Certificate Storage

**Local Development**: Keychain (macOS) / Certificate Store (Windows)
**CI/CD**: GitHub Secrets with base64-encoded certificates

## Success Criteria

1. ✅ User can receive update notification without losing projects
2. ✅ macOS build requires zero manual signing steps
3. ✅ Linux AppImage runs on Ubuntu 22.04+ without dependencies
4. ✅ `git tag v1.2.0 && git push --tags` triggers full release
5. ✅ All UI shows "Nodegex" branding
6. ✅ Existing OpenNoodl users' data migrates automatically

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Apple certificate issues | Medium | High | Document exact certificate setup steps |
| Native module compatibility | Medium | Medium | Test dugite/desktop-trampoline on all platforms |
| Auto-update breaks for some users | Low | High | Include manual download fallback |
| Linux dependency issues | Medium | Medium | Test on fresh VM installations |

## Timeline Estimate

| Task | Effort | Dependencies |
|------|--------|--------------|
| 7.1 Rebrand | 4-6h | None |
| 7.2 macOS Signing | 8-12h | 7.1 |
| 7.3 Auto-Update Config | 4-6h | 7.1 |
| 7.4 Linux Distribution | 6-8h | 7.1 |
| 7.5 GitHub Actions | 12-16h | 7.2, 7.3, 7.4 |
| 7.6 Windows Signing | 4-8h | 7.5 (optional) |

**Total**: 38-56 hours (excluding Windows signing)

## References

- [electron-builder Code Signing](https://www.electron.build/code-signing)
- [electron-updater Documentation](https://www.electron.build/auto-update)
- [Apple Notarization](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [GitHub Actions for Electron](https://www.electron.build/multi-platform-build#github-actions)
