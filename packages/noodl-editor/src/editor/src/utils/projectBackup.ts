/**
 * Project Backup Utility
 * 
 * Provides automatic backup functionality before project upgrades or migrations.
 * Creates timestamped backups of project.json files to prevent data loss.
 * 
 * @module noodl-editor
 * @since 2.0.0 (OpenNoodl)
 */

import { filesystem } from '@noodl/platform';
import path from 'path';

export interface BackupResult {
  success: boolean;
  backupPath?: string;
  error?: string;
  timestamp?: string;
}

export interface BackupOptions {
  /** Maximum number of backups to keep per project (default: 5) */
  maxBackups?: number;
  /** Custom prefix for backup file names */
  prefix?: string;
}

const DEFAULT_MAX_BACKUPS = 5;
const BACKUP_FOLDER_NAME = '.noodl-backups';

/**
 * Creates a backup of the project.json file before migration/upgrade.
 * 
 * @param projectDir - The directory containing the project
 * @param options - Backup configuration options
 * @returns BackupResult with success status and backup path
 * 
 * @example
 * ```typescript
 * const result = await createProjectBackup('/path/to/project');
 * if (result.success) {
 *   console.log('Backup created at:', result.backupPath);
 * }
 * ```
 */
export async function createProjectBackup(
  projectDir: string,
  options: BackupOptions = {}
): Promise<BackupResult> {
  const { maxBackups = DEFAULT_MAX_BACKUPS, prefix = 'backup' } = options;
  
  try {
    const projectJsonPath = path.join(projectDir, 'project.json');
    const backupDir = path.join(projectDir, BACKUP_FOLDER_NAME);
    
    // Check if project.json exists
    const exists = await filesystem.exists(projectJsonPath);
    if (!exists) {
      return {
        success: false,
        error: 'project.json not found in project directory'
      };
    }
    
    // Create backup directory if it doesn't exist
    await filesystem.makeDirectory(backupDir);
    
    // Generate timestamp for backup filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${prefix}-${timestamp}.json`;
    const backupPath = path.join(backupDir, backupFileName);
    
    // Read original project.json
    const projectContent = await filesystem.readFile(projectJsonPath);
    
    // Write backup file
    await filesystem.writeFile(backupPath, projectContent);
    
    // Clean up old backups if we exceed maxBackups
    await cleanupOldBackups(backupDir, prefix, maxBackups);
    
    return {
      success: true,
      backupPath,
      timestamp
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Lists all available backups for a project.
 * 
 * @param projectDir - The directory containing the project
 * @returns Array of backup file paths sorted by date (newest first)
 */
export async function listProjectBackups(projectDir: string): Promise<string[]> {
  try {
    const backupDir = path.join(projectDir, BACKUP_FOLDER_NAME);
    
    const exists = await filesystem.exists(backupDir);
    if (!exists) {
      return [];
    }
    
    const files = await filesystem.listDirectory(backupDir);
    const backupFiles = files
      .filter(f => !f.isDirectory && f.name.endsWith('.json'))
      .map(f => f.name)
      .sort()
      .reverse(); // Newest first
    
    return backupFiles.map(f => path.join(backupDir, f));
  } catch {
    return [];
  }
}

/**
 * Restores a project from a backup file.
 * 
 * @param projectDir - The directory containing the project
 * @param backupPath - Path to the backup file to restore
 * @returns BackupResult with success status
 */
export async function restoreProjectBackup(
  projectDir: string,
  backupPath: string
): Promise<BackupResult> {
  try {
    const projectJsonPath = path.join(projectDir, 'project.json');
    
    // Verify backup exists
    const backupExists = await filesystem.exists(backupPath);
    if (!backupExists) {
      return {
        success: false,
        error: 'Backup file not found'
      };
    }
    
    // Create a backup of the current state before restoring
    // (so user can undo the restore if needed)
    const preRestoreBackup = await createProjectBackup(projectDir, {
      prefix: 'pre-restore'
    });
    
    if (!preRestoreBackup.success) {
      console.warn('Could not create pre-restore backup:', preRestoreBackup.error);
    }
    
    // Read backup content
    const backupContent = await filesystem.readFile(backupPath);
    
    // Write to project.json
    await filesystem.writeFile(projectJsonPath, backupContent);
    
    return {
      success: true,
      backupPath
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Cleans up old backups, keeping only the most recent ones.
 * 
 * @param backupDir - Directory containing backups
 * @param prefix - Prefix to filter backups by
 * @param maxBackups - Maximum number of backups to keep
 */
async function cleanupOldBackups(
  backupDir: string,
  prefix: string,
  maxBackups: number
): Promise<void> {
  try {
    const files = await filesystem.listDirectory(backupDir);
    
    // Filter to only backups with our prefix and sort by name (which includes timestamp)
    const backupFileNames = files
      .filter(f => !f.isDirectory && f.name.startsWith(prefix) && f.name.endsWith('.json'))
      .map(f => f.name)
      .sort()
      .reverse(); // Newest first
    
    // Remove old backups
    if (backupFileNames.length > maxBackups) {
      const filesToDelete = backupFileNames.slice(maxBackups);
      for (const fileName of filesToDelete) {
        const filePath = path.join(backupDir, fileName);
        await filesystem.removeFile(filePath);
      }
    }
  } catch (error) {
    console.warn('Failed to cleanup old backups:', error);
  }
}

/**
 * Gets the most recent backup for a project.
 * 
 * @param projectDir - The directory containing the project
 * @returns Path to the most recent backup, or null if none exist
 */
export async function getLatestBackup(projectDir: string): Promise<string | null> {
  const backups = await listProjectBackups(projectDir);
  return backups.length > 0 ? backups[0] : null;
}

/**
 * Validates a backup file by attempting to parse it as JSON.
 * 
 * @param backupPath - Path to the backup file
 * @returns true if backup is valid JSON, false otherwise
 */
export async function validateBackup(backupPath: string): Promise<boolean> {
  try {
    const content = await filesystem.readFile(backupPath);
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}
