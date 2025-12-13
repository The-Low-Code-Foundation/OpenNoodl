/**
 * Migration Module
 *
 * Provides tools for migrating legacy Noodl projects (React 17)
 * to the new OpenNoodl runtime (React 19).
 *
 * @module noodl-editor/models/migration
 * @since 1.2.0
 */

// Types
export * from './types';

// Project Scanner
export {
  detectRuntimeVersion,
  scanForLegacyPatterns,
  scanProjectForMigration,
  LEGACY_PATTERNS,
  REACT19_MIN_VERSION,
  OPENNOODL_FORK_DATE,
  readProjectJson,
  compareVersions
} from './ProjectScanner';
export type { ProjectJson } from './ProjectScanner';

// Migration Session Manager
export {
  MigrationSessionManager,
  migrationSessionManager,
  checkProjectNeedsMigration,
  getStepLabel,
  getStepNumber,
  getTotalSteps
} from './MigrationSession';
