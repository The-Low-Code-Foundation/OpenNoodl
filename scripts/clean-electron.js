#!/usr/bin/env node
/**
 * Clean Electron caches while preserving user data
 *
 * This script removes Electron app caches but preserves:
 * - recently_opened_project.json (project list)
 * - project_organization.json (folders & mappings)
 * - project_runtime_cache.json (runtime detection cache)
 *
 * Works cross-platform (macOS, Windows, Linux)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Determine platform-specific paths
function getElectronPaths() {
  const platform = os.platform();
  const homeDir = os.homedir();

  switch (platform) {
    case 'darwin': // macOS
      return {
        electron: path.join(homeDir, 'Library/Application Support/Electron'),
        noodl: path.join(homeDir, 'Library/Application Support/Noodl'),
        openNoodl: path.join(homeDir, 'Library/Application Support/OpenNoodl')
      };

    case 'win32': // Windows
      const appData = process.env.APPDATA || path.join(homeDir, 'AppData/Roaming');
      return {
        electron: path.join(appData, 'Electron'),
        noodl: path.join(appData, 'Noodl'),
        openNoodl: path.join(appData, 'OpenNoodl')
      };

    case 'linux':
      const configHome = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
      return {
        electron: path.join(configHome, 'Electron'),
        noodl: path.join(configHome, 'Noodl'),
        openNoodl: path.join(configHome, 'OpenNoodl')
      };

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

// User data files to preserve
const USER_DATA_FILES = ['recently_opened_project.json', 'project_organization.json', 'project_runtime_cache.json'];

/**
 * Recursively delete a directory
 */
function rmdir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch (error) {
    console.warn(`⚠️  Failed to remove ${dirPath}:`, error.message);
  }
}

/**
 * Backup user data files from a directory
 */
function backupUserData(sourceDir, tempDir) {
  const backedUp = [];

  if (!fs.existsSync(sourceDir)) {
    return backedUp;
  }

  for (const fileName of USER_DATA_FILES) {
    const sourcePath = path.join(sourceDir, fileName);

    if (fs.existsSync(sourcePath)) {
      try {
        const destPath = path.join(tempDir, fileName);
        fs.copyFileSync(sourcePath, destPath);
        backedUp.push(fileName);
      } catch (error) {
        console.warn(`⚠️  Failed to backup ${fileName}:`, error.message);
      }
    }
  }

  return backedUp;
}

/**
 * Restore user data files to a directory
 */
function restoreUserData(tempDir, destDir) {
  const restored = [];

  // Ensure destination directory exists
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  for (const fileName of USER_DATA_FILES) {
    const sourcePath = path.join(tempDir, fileName);

    if (fs.existsSync(sourcePath)) {
      try {
        const destPath = path.join(destDir, fileName);
        fs.copyFileSync(sourcePath, destPath);
        restored.push(fileName);

        // Clean up temp file
        fs.unlinkSync(sourcePath);
      } catch (error) {
        console.warn(`⚠️  Failed to restore ${fileName}:`, error.message);
      }
    }
  }

  return restored;
}

/**
 * Main cleanup function
 */
function cleanElectron() {
  console.log('🧹 Cleaning Electron caches while preserving user data...\n');

  const paths = getElectronPaths();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noodl-backup-'));

  try {
    // Step 1: Backup user data from Noodl directory
    console.log('📦 Backing up user data...');
    const backedUp = backupUserData(paths.noodl, tempDir);
    if (backedUp.length > 0) {
      console.log(`   ✓ Backed up: ${backedUp.join(', ')}`);
    }

    // Step 2: Clean all Electron-related directories
    console.log('\n🗑️  Removing caches...');

    if (fs.existsSync(paths.electron)) {
      rmdir(paths.electron);
      console.log('   ✓ Removed Electron cache');
    }

    if (fs.existsSync(paths.noodl)) {
      rmdir(paths.noodl);
      console.log('   ✓ Removed Noodl cache');
    }

    if (fs.existsSync(paths.openNoodl)) {
      rmdir(paths.openNoodl);
      console.log('   ✓ Removed OpenNoodl cache');
    }

    // Step 3: Restore user data back to Noodl directory
    if (backedUp.length > 0) {
      console.log('\n📥 Restoring user data...');
      const restored = restoreUserData(tempDir, paths.noodl);
      if (restored.length > 0) {
        console.log(`   ✓ Restored: ${restored.join(', ')}`);
      }
    }

    console.log('\n✅ Electron caches cleared successfully!');
    console.log('   Project list and folders have been preserved.');
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error.message);
    process.exit(1);
  } finally {
    // Clean up temp directory
    try {
      if (fs.existsSync(tempDir)) {
        rmdir(tempDir);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// Run the cleanup
cleanElectron();
