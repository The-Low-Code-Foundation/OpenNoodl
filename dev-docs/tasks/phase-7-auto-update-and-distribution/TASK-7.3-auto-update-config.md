# Task 7.3: Configure Auto-Update Publishing

## Overview

Connect the existing auto-update infrastructure to GitHub Releases so users receive update notifications without manual downloads.

## What Already Exists

The codebase already has:
1. **electron-updater** - Installed and configured in `autoupdater.js`
2. **Update UI** - TitleBar shows "Update Available" state
3. **Confirmation Dialog** - Asks user to restart
4. **IPC Handlers** - Communication between main and renderer

What's missing: **The publish URL configuration**.

## How Auto-Update Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Auto-Update Flow                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. App Starts                                                      │
│       │                                                             │
│       ▼                                                             │
│  2. Check GitHub Releases for latest-{platform}.yml                 │
│       │                                                             │
│       ▼                                                             │
│  3. Compare versions (semver)                                       │
│       │                                                             │
│       ├─── Same version ──► Do nothing, check again in 60s         │
│       │                                                             │
│       └─── New version ──► Download in background                  │
│                              │                                      │
│                              ▼                                      │
│  4. Download complete ──► Show "Update Available" in TitleBar      │
│                              │                                      │
│                              ▼                                      │
│  5. User clicks ──► Show confirmation dialog                       │
│                              │                                      │
│                              ├─── "Later" ──► Dismiss               │
│                              │                                      │
│                              └─── "Restart" ──► quitAndInstall()   │
│                                                 │                   │
│                                                 ▼                   │
│  6. App restarts with new version                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementation

### Step 1: Add Publish Configuration

**`packages/noodl-editor/package.json`**

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "the-low-code-foundation",
      "repo": "opennoodl",
      "releaseType": "release"
    }
  }
}
```

**Configuration Options:**

| Setting | Value | Description |
|---------|-------|-------------|
| `provider` | `"github"` | Use GitHub Releases |
| `owner` | `"the-low-code-foundation"` | GitHub org/user |
| `repo` | `"opennoodl"` | Repository name |
| `releaseType` | `"release"` | Only stable releases (not drafts/prereleases) |

### Step 2: Update autoupdater.js

**`packages/noodl-editor/src/main/src/autoupdater.js`**

```javascript
const { app, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Configure logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Disable auto-download so user can choose
autoUpdater.autoDownload = false;

function setupAutoUpdate(window) {
  // Skip in dev mode
  if (process.env.devMode === 'true' || process.env.autoUpdate === 'no') {
    log.info('Auto-update disabled in dev mode');
    return;
  }

  // Linux: Only AppImage supports auto-update
  if (process.platform === 'linux' && !process.env.APPIMAGE) {
    log.info('Auto-update only available for AppImage on Linux');
    return;
  }

  // Check for updates on startup
  checkForUpdates();

  // Check periodically (every 60 seconds)
  setInterval(checkForUpdates, 60 * 1000);

  function checkForUpdates() {
    log.info('Checking for updates...');
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('Update check failed:', err);
    });
  }

  // Update available - ask user if they want to download
  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version);
    
    // Start download automatically (runs in background)
    autoUpdater.downloadUpdate().catch((err) => {
      log.error('Download failed:', err);
    });
  });

  // No update available
  autoUpdater.on('update-not-available', (info) => {
    log.info('No update available. Current version:', app.getVersion());
  });

  // Download progress
  autoUpdater.on('download-progress', (progress) => {
    log.info(`Download progress: ${progress.percent.toFixed(1)}%`);
    
    // Optionally send to renderer for progress UI
    if (window && !window.isDestroyed()) {
      window.webContents.send('updateDownloadProgress', progress);
    }
  });

  // Download complete - notify user
  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version);
    
    if (window && !window.isDestroyed()) {
      window.webContents.send('showAutoUpdatePopup', {
        version: info.version,
        releaseNotes: info.releaseNotes
      });
    }
  });

  // Handle user response
  ipcMain.on('autoUpdatePopupClosed', (event, restartNow) => {
    if (restartNow) {
      log.info('User requested restart for update');
      autoUpdater.quitAndInstall(false, true);
    } else {
      log.info('User deferred update');
    }
  });

  // Error handling
  autoUpdater.on('error', (error) => {
    log.error('Auto-updater error:', error);
    
    // Don't spam logs - wait before retrying
    setTimeout(checkForUpdates, 5 * 60 * 1000); // Retry in 5 minutes
  });
}

module.exports = {
  setupAutoUpdate
};
```

### Step 3: Enhance Update Dialog (Optional)

**`packages/noodl-editor/src/editor/src/views/windows/BaseWindow/BaseWindow.tsx`**

```typescript
const [AutoUpdateDialog, autoUpdateConfirmation] = useConfirmationDialog({
  title: 'Update Available',
  message: `Version ${updateInfo?.version || 'new'} is ready to install. 
    
Release notes:
${updateInfo?.releaseNotes || 'Bug fixes and improvements.'}

Restart now to update?`,
  confirmButtonLabel: 'Restart Now',
  cancelButtonLabel: 'Later'
});
```

### Step 4: Update Manifests

When you build with `--publish always`, electron-builder creates:

**`latest.yml`** (Windows)
```yaml
version: 1.2.0
files:
  - url: Nodegex-Setup-1.2.0.exe
    sha512: abc123...
    size: 85000000
path: Nodegex-Setup-1.2.0.exe
sha512: abc123...
releaseDate: '2024-01-15T10:30:00.000Z'
```

**`latest-mac.yml`** (macOS)
```yaml
version: 1.2.0
files:
  - url: Nodegex-1.2.0-arm64.dmg
    sha512: def456...
    size: 150000000
  - url: Nodegex-1.2.0-x64.dmg
    sha512: ghi789...
    size: 155000000
path: Nodegex-1.2.0-arm64.dmg
sha512: def456...
releaseDate: '2024-01-15T10:30:00.000Z'
```

**`latest-linux.yml`** (Linux)
```yaml
version: 1.2.0
files:
  - url: Nodegex-1.2.0-x64.AppImage
    sha512: jkl012...
    size: 120000000
path: Nodegex-1.2.0-x64.AppImage
sha512: jkl012...
releaseDate: '2024-01-15T10:30:00.000Z'
```

### Step 5: Test Locally

**Create a test release:**

```bash
# Build with publish (but don't actually publish)
cd packages/noodl-editor
npx electron-builder --mac --publish never

# Check generated files
ls dist/
# Should include: latest-mac.yml
```

**Test update detection:**

```bash
# 1. Install an older version
# 2. Create a GitHub Release with newer version
# 3. Launch old version
# 4. Watch logs for update detection:
tail -f ~/Library/Logs/Nodegex/main.log
```

### Step 6: Configure Release Channels (Optional)

For beta/alpha testing:

```javascript
// In autoupdater.js
autoUpdater.channel = 'latest'; // Default

// Or allow user to opt into beta:
autoUpdater.channel = userPreferences.updateChannel || 'latest';
// Channels: 'latest' (stable), 'beta', 'alpha'
```

electron-builder creates separate manifests:
- `latest.yml` - Stable releases
- `beta.yml` - Beta releases  
- `alpha.yml` - Alpha releases

## Files to Modify

| File | Changes |
|------|---------|
| `packages/noodl-editor/package.json` | Add publish configuration |
| `packages/noodl-editor/src/main/src/autoupdater.js` | Enhance with logging, progress |
| `packages/noodl-editor/src/editor/src/views/windows/BaseWindow/BaseWindow.tsx` | Optional: Better update dialog |

## Testing Checklist

### Local Testing
- [ ] Build produces `latest-*.yml` files
- [ ] App connects to GitHub Releases API
- [ ] Update detection works (with test release)
- [ ] Download progress shown (optional)
- [ ] "Restart" installs update
- [ ] "Later" dismisses dialog
- [ ] App restarts with new version

### Platform Testing
- [ ] macOS Intel: Download correct arch
- [ ] macOS ARM: Download correct arch
- [ ] Windows: NSIS installer works
- [ ] Linux AppImage: Update replaces file

### Edge Cases
- [ ] Offline: Graceful failure, retry later
- [ ] Partial download: Resume or restart
- [ ] Corrupted download: SHA512 check fails, retry
- [ ] Downgrade prevention: Don't install older version

## Troubleshooting

### Update not detected

Check logs:
```bash
# macOS
cat ~/Library/Logs/Nodegex/main.log

# Windows
type %USERPROFILE%\AppData\Roaming\Nodegex\logs\main.log

# Linux
cat ~/.config/Nodegex/logs/main.log
```

### Wrong architecture downloaded

Verify `latest-mac.yml` has both arch entries and correct `sha512` values.

### "Cannot find latest.yml"

Either:
1. Build wasn't published to GitHub Releases
2. Release is still in draft mode
3. Network/proxy issues

### Update downloads but doesn't install

Check:
1. SHA512 mismatch (corrupted download)
2. Disk space
3. Permissions (can write to app directory)

## Success Criteria

1. ✅ App checks for updates on startup
2. ✅ Update notification appears for new releases
3. ✅ Background download doesn't interrupt work
4. ✅ Restart installs update seamlessly
5. ✅ User data preserved after update
6. ✅ Works on all three platforms
