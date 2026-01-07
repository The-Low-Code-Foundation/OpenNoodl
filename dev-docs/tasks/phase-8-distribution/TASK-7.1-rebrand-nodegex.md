# Task 7.1: Rebrand to Nodegex

## Overview

Rename the application from "OpenNoodl" to "Nodegex" (Node Graph Expression) across all user-facing surfaces while maintaining backward compatibility for existing users.

## Scope

### In Scope
- Application name and branding
- Window titles
- Protocol handlers
- Package identifiers
- userData path (with migration)
- Documentation references

### Out of Scope (Keep as "noodl")
- Internal package names (noodl-editor, noodl-runtime, etc.)
- Code variables and function names
- Git history
- NPM package names (if published)

## Changes Required

### 1. Package Configuration

**`packages/noodl-editor/package.json`**

```json
{
  "name": "noodl-editor",                    // Keep internal
  "productName": "Nodegex",                  // Change from OpenNoodl
  "description": "Full stack low-code React app builder - Nodegex",
  "author": "The Low Code Foundation",
  "homepage": "https://nodegex.dev",         // Update when domain ready
  "build": {
    "appId": "com.nodegex.app",              // Change from com.opennoodl.app
    "protocols": {
      "name": "nodegex",                      // Change from opennoodl
      "schemes": ["nodegex"]                  // Change from opennoodl
    }
  }
}
```

### 2. Main Process

**`packages/noodl-editor/src/main/main.js`**

Update any hardcoded "OpenNoodl" or "Noodl" strings in:
- Window titles
- Dialog messages
- Menu items

```javascript
// Example changes
const mainWindow = new BrowserWindow({
  title: 'Nodegex',  // Was: OpenNoodl
  // ...
});
```

### 3. Window Titles

**`packages/noodl-editor/src/editor/src/views/windows/BaseWindow/BaseWindow.tsx`**

```typescript
export function BaseWindow({
  title = ProjectModel.instance.name,  // Default project name as title
  // ...
}) {
  // The TitleBar component may show app name
}
```

**`packages/noodl-core-ui/src/components/app/TitleBar/TitleBar.tsx`**

Check for any hardcoded "Noodl" references.

### 4. Platform Identification

**`packages/noodl-platform-electron/src/platform-electron.ts`**

The userData path is determined by Electron using productName. After changing productName, the path becomes:
- Windows: `%APPDATA%/Nodegex`
- macOS: `~/Library/Application Support/Nodegex`
- Linux: `~/.config/Nodegex`

### 5. User Data Migration

**Critical**: Existing users have data in the old location. We need migration.

**Create: `packages/noodl-editor/src/main/src/migration.js`**

```javascript
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const OLD_NAMES = ['OpenNoodl', 'Noodl'];  // Possible old names
const NEW_NAME = 'Nodegex';

function migrateUserData() {
  const userDataPath = app.getPath('userData');
  
  // Check if we're already in the new location
  if (userDataPath.includes(NEW_NAME)) {
    // Look for old data to migrate
    for (const oldName of OLD_NAMES) {
      const oldPath = userDataPath.replace(NEW_NAME, oldName);
      
      if (fs.existsSync(oldPath) && !fs.existsSync(path.join(userDataPath, '.migrated'))) {
        console.log(`Migrating user data from ${oldPath} to ${userDataPath}`);
        
        // Copy contents (not move, safer)
        copyDirectory(oldPath, userDataPath);
        
        // Mark as migrated
        fs.writeFileSync(path.join(userDataPath, '.migrated'), oldPath);
        
        console.log('Migration complete');
        break;
      }
    }
  }
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      // Don't overwrite existing files in new location
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

module.exports = { migrateUserData };
```

**Update: `packages/noodl-editor/src/main/main.js`**

```javascript
const { migrateUserData } = require('./src/migration');

app.on('ready', () => {
  // Migrate before anything else
  migrateUserData();
  
  // ... rest of app initialization
});
```

### 6. Protocol Handler

Update deep links from `opennoodl://` to `nodegex://`

**`packages/noodl-editor/src/main/main.js`**

```javascript
// Register protocol handler
app.setAsDefaultProtocolClient('nodegex');

// Handle incoming URLs
app.on('open-url', (event, url) => {
  if (url.startsWith('nodegex://')) {
    // Handle URL
  }
});
```

### 7. macOS Info.plist

**`packages/noodl-editor/build/Info.plist`** (if exists) or via electron-builder:

```json
{
  "build": {
    "mac": {
      "extendInfo": {
        "CFBundleDisplayName": "Nodegex",
        "CFBundleName": "Nodegex",
        "LSMultipleInstancesProhibited": true
      }
    }
  }
}
```

### 8. UI Strings

Search for and replace user-facing strings:

```bash
# Find all references
grep -r "OpenNoodl\|Noodl" packages/ --include="*.tsx" --include="*.ts" --include="*.js"
```

Common locations:
- About dialogs
- Error messages
- Welcome screens
- Help text
- Tooltips

### 9. Launcher

**`packages/noodl-core-ui/src/preview/launcher/Launcher/`**

- Update any branding in launcher UI
- Logo/icon references
- Welcome messages

### 10. Build Assets

**`packages/noodl-editor/build/`**

- Icon files: Keep filenames, update icon content if needed
- Installer background images
- DMG background

### 11. Code Comments (Low Priority)

Internal comments can remain as "Noodl" for historical context. Only update user-visible strings.

## File Change Summary

| File | Change Type |
|------|-------------|
| `packages/noodl-editor/package.json` | productName, appId, protocols |
| `packages/noodl-editor/src/main/main.js` | Add migration, protocol handler |
| `packages/noodl-editor/src/main/src/migration.js` | Create new |
| `packages/noodl-core-ui/**/TitleBar*` | Check for hardcoded strings |
| `packages/noodl-core-ui/**/Launcher*` | Branding updates |
| Various `.tsx`, `.ts` files | User-facing string changes |

## Testing Checklist

### Fresh Install
- [ ] App installs as "Nodegex"
- [ ] userData created in correct location
- [ ] Protocol handler `nodegex://` works
- [ ] App icon shows correctly
- [ ] Window title shows "Nodegex"
- [ ] About dialog shows "Nodegex"

### Upgrade from OpenNoodl
- [ ] User data migrates automatically
- [ ] Projects list preserved
- [ ] Settings preserved
- [ ] No duplicate data created

### Platform Specific
- [ ] Windows: Start menu shows "Nodegex"
- [ ] macOS: Menu bar shows "Nodegex"
- [ ] macOS: Dock shows "Nodegex"
- [ ] Linux: Desktop entry shows "Nodegex"

## Rollback Plan

If issues arise, the migration is non-destructive:
1. Old userData folder is preserved
2. Migration marker file indicates completion
3. Can revert productName and migrate back

## Search Patterns

Use these to find remaining references:

```bash
# Case-insensitive search for noodl
grep -ri "noodl" packages/ --include="*.tsx" --include="*.ts" --include="*.js" \
  | grep -v "node_modules" \
  | grep -v ".bundle." \
  | grep -v "// " \
  | grep -v "* "

# Specific product names
grep -r "OpenNoodl\|opennoodl\|com\.opennoodl" packages/
```

## Notes on Internal Names

These should **NOT** change:
- `noodl-editor` package name
- `noodl-runtime` package name
- `noodl-core-ui` package name
- `@noodl/` npm scope (if any)
- Internal imports like `from '@noodl-models/...'`

Changing these would require massive refactoring with no user benefit.
