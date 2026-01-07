# Phase 8: Auto-Update & Distribution - Progress Tracker

**Last Updated:** 2026-01-07  
**Overall Status:** 🔴 Not Started

---

## Quick Summary

| Metric       | Value  |
| ------------ | ------ |
| Total Tasks  | 5      |
| Completed    | 0      |
| In Progress  | 0      |
| Not Started  | 5      |
| **Progress** | **0%** |

**Estimated Effort:** 38-56 hours (excluding optional Windows signing)

---

## Task Status

| Task | Name                             | Status         | Effort | Doc                                          |
| ---- | -------------------------------- | -------------- | ------ | -------------------------------------------- |
| 7.1  | Rebrand to Nodegex               | 🔴 Not Started | 4-6h   | [TASK-7.1](./TASK-7.1-rebrand-nodegex.md)    |
| 7.2  | Fix macOS Code Signing           | 🔴 Not Started | 8-12h  | [TASK-7.2](./TASK-7.2-macos-signing.md)      |
| 7.3  | Configure Auto-Update Publishing | 🔴 Not Started | 4-6h   | [TASK-7.3](./TASK-7.3-auto-update-config.md) |
| 7.4  | Linux Universal Distribution     | 🔴 Not Started | 6-8h   | [TASK-7.4](./TASK-7.4-linux-distribution.md) |
| 7.5  | GitHub Actions CI/CD             | 🔴 Not Started | 12-16h | [TASK-7.5](./TASK-7.5-github-actions.md)     |
| 7.6  | Windows Code Signing             | 🔴 Not Started | 4-8h   | _(optional, no doc yet)_                     |

---

## Task Details

### 7.1 Rebrand to Nodegex

**Status:** 🔴 Not Started

Rename application from OpenNoodl to Nodegex across all user-facing surfaces:

- Package.json productName, appId, protocols
- Window titles and UI strings
- Protocol handlers (`nodegex://`)
- userData paths with migration for existing users

### 7.2 Fix macOS Code Signing

**Status:** 🔴 Not Started

Configure electron-builder for automatic signing (eliminates 30+ manual file signatures):

- Certificate configuration via `CSC_NAME`
- Entitlements for hardened runtime
- Automatic notarization via afterSign hook
- Support for both Intel and Apple Silicon

### 7.3 Configure Auto-Update Publishing

**Status:** 🔴 Not Started

Connect existing electron-updater infrastructure to GitHub Releases:

- Add publish configuration to package.json
- Configure update server URL
- Generate `latest-*.yml` manifests
- Test update detection and installation

### 7.4 Linux Universal Distribution

**Status:** 🔴 Not Started

Add AppImage and .deb targets:

- AppImage for universal distribution (auto-update supported)
- .deb for Debian/Ubuntu native experience
- Handle native module compatibility (dugite, desktop-trampoline)
- Test on Ubuntu 22.04/24.04 LTS

### 7.5 GitHub Actions CI/CD

**Status:** 🔴 Not Started

Create automated build pipeline:

- Matrix build for macOS (x64, arm64), Windows (x64), Linux (x64)
- Secure certificate storage via GitHub Secrets
- Automatic GitHub Release creation on tag push
- Update manifest generation

### 7.6 Windows Code Signing (Optional)

**Status:** 🔴 Not Started

Add Windows code signing to eliminate SmartScreen warnings:

- Obtain code signing certificate (EV or standard)
- Configure in electron-builder
- Add to CI/CD pipeline

---

## Status Legend

- 🔴 **Not Started** - Work has not begun
- 🟡 **In Progress** - Actively being worked on
- 🟢 **Complete** - Finished and verified

---

## Recent Updates

| Date       | Update                                            |
| ---------- | ------------------------------------------------- |
| 2026-01-07 | Updated PROGRESS.md to reflect actual task status |
| 2026-01-07 | Renumbered from Phase 7 to Phase 8                |

---

## Dependencies

**Depends on:** Phase 0-3 (stable editor)

**Task Dependencies:**

```
7.1 Rebrand ──┬──► 7.2 macOS Signing ──┐
              ├──► 7.3 Auto-Update ────┼──► 7.5 GitHub Actions CI/CD
              └──► 7.4 Linux Distro ───┘
                                              │
                                              ▼
                                       7.6 Windows Signing (optional)
```

---

## Success Criteria

1. ✅ User can receive update notification without losing projects
2. ✅ macOS build requires zero manual signing steps
3. ✅ Linux AppImage runs on Ubuntu 22.04+ without dependencies
4. ✅ `git tag v1.2.0 && git push --tags` triggers full release
5. ✅ All UI shows "Nodegex" branding
6. ✅ Existing OpenNoodl users' data migrates automatically

---

## Notes

Previously Phase 7 "auto-update-and-distribution". Covers macOS code signing, Windows signing, auto-update infrastructure, Linux distribution, and GitHub Actions CI/CD.

See [README.md](./README.md) for comprehensive technical analysis and architecture decisions.
