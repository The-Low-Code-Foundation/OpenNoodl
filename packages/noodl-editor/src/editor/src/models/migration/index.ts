/**
 * Migration Module
 *
 * Runtime-pair detection (default React 18.3 vs opt-in React 19) and tools for
 * upgrading a project to the React 19 runtime, including a scan for the APIs
 * React 19 removed relative to 18.
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
  readProjectJson
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
