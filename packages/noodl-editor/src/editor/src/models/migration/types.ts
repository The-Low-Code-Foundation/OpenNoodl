/**
 * Migration System Types
 * 
 * Type definitions for the React 19 migration system that allows users
 * to upgrade legacy Noodl projects (React 17) to the new OpenNoodl runtime (React 19).
 * 
 * @module noodl-editor/models/migration
 * @since 1.2.0
 */

// =============================================================================
// Runtime Version Types
// =============================================================================

export type RuntimeVersion = 'react17' | 'react19' | 'unknown';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Result of detecting the runtime version of a project
 */
export interface RuntimeVersionInfo {
  version: RuntimeVersion;
  confidence: ConfidenceLevel;
  indicators: string[];
}

// =============================================================================
// Migration Issue Types
// =============================================================================

export type MigrationIssueType =
  | 'componentWillMount'
  | 'componentWillReceiveProps'
  | 'componentWillUpdate'
  | 'unsafeLifecycle'
  | 'stringRef'
  | 'legacyContext'
  | 'createFactory'
  | 'findDOMNode'
  | 'reactDomRender'
  | 'other';

/**
 * A specific migration issue found in a component
 */
export interface MigrationIssue {
  id: string;
  type: MigrationIssueType;
  description: string;
  location: {
    file: string;
    line: number;
    column?: number;
  };
  autoFixable: boolean;
  fix?: {
    type: 'automatic' | 'ai-required';
    description: string;
  };
}

/**
 * Information about a component that needs migration
 */
export interface ComponentMigrationInfo {
  id: string;
  name: string;
  path: string;
  issues: MigrationIssue[];
  estimatedCost?: number;
}

// =============================================================================
// Migration Session Types
// =============================================================================

export type MigrationStep =
  | 'confirm'
  | 'scanning'
  | 'report'
  | 'configureAi'
  | 'migrating'
  | 'complete'
  | 'failed';

export type MigrationPhase = 'copying' | 'automatic' | 'ai-assisted' | 'finalizing';

/**
 * Results of scanning a project for migration needs
 */
export interface MigrationScan {
  completedAt: string;
  totalComponents: number;
  totalNodes: number;
  customJsFiles: number;
  categories: {
    /** Components that migrate automatically (no code changes) */
    automatic: ComponentMigrationInfo[];
    /** Components with simple, auto-fixable issues */
    simpleFixes: ComponentMigrationInfo[];
    /** Components that need manual review or AI assistance */
    needsReview: ComponentMigrationInfo[];
  };
}

/**
 * A single entry in the migration log
 */
export interface MigrationLogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  component?: string;
  message: string;
  details?: string;
  cost?: number;
}

/**
 * Progress information during migration
 */
export interface MigrationProgress {
  phase: MigrationPhase;
  current: number;
  total: number;
  currentComponent?: string;
  log: MigrationLogEntry[];
}

/**
 * Final result of a migration
 */
export interface MigrationResult {
  success: boolean;
  migrated: number;
  needsReview: number;
  failed: number;
  totalCost: number;
  duration: number;
}

/**
 * Complete migration session state
 */
export interface MigrationSession {
  id: string;
  step: MigrationStep;

  /** Source project (React 17) */
  source: {
    path: string;
    name: string;
    runtimeVersion: 'react17';
  };

  /** Target (copy) project */
  target: {
    path: string;
    copied: boolean;
  };

  /** Scan results */
  scan?: MigrationScan;

  /** AI configuration */
  ai?: AIConfig;

  /** Migration progress */
  progress?: MigrationProgress;

  /** Final result */
  result?: MigrationResult;
}

// =============================================================================
// AI Migration Types
// =============================================================================

/**
 * Budget configuration for AI-assisted migration
 */
export interface AIBudget {
  /** Maximum spend per migration session in dollars */
  maxPerSession: number;
  /** Amount spent so far */
  spent: number;
  /** Pause and ask after each increment */
  pauseIncrement: number;
  /** Whether to show cost estimates */
  showEstimates: boolean;
}

/**
 * User preferences for AI migration
 */
export interface AIPreferences {
  /** Prefer converting to functional components with hooks */
  preferFunctional: boolean;
  /** Keep existing code comments */
  preserveComments: boolean;
  /** Add explanatory comments to changes */
  verboseOutput: boolean;
}

/**
 * Complete AI configuration
 */
export interface AIConfig {
  enabled: boolean;
  /** API key - only stored in memory during session */
  apiKey?: string;
  budget: AIBudget;
  preferences: AIPreferences;
}

/**
 * Response from Claude when migrating a component
 */
export interface AIMigrationResponse {
  success: boolean;
  code: string | null;
  changes: string[];
  warnings: string[];
  confidence: number;
  reason?: string;
  suggestion?: string;
  tokensUsed: {
    input: number;
    output: number;
  };
  cost: number;
}

/**
 * Request for user decision when AI migration fails
 */
export interface AIDecisionRequest {
  componentId: string;
  componentName: string;
  attempts: number;
  attemptHistory: Array<{
    code: string | null;
    error: string;
    cost: number;
  }>;
  costSpent: number;
  retryCost: number;
}

/**
 * User's decision on how to proceed with a failed AI migration
 */
export interface AIDecision {
  componentId: string;
  action: 'retry' | 'skip' | 'manual' | 'getHelp';
}

// =============================================================================
// Project Manifest Extensions
// =============================================================================

/**
 * Status of a component after migration
 */
export type ComponentMigrationStatus = 'auto' | 'ai-migrated' | 'needs-review' | 'manually-fixed';

/**
 * Migration note for a component stored in project.json
 */
export interface ComponentMigrationNote {
  status: ComponentMigrationStatus;
  issues?: string[];
  aiSuggestion?: string;
  dismissedAt?: string;
}

/**
 * Information about the original project before migration
 */
export interface MigratedFromInfo {
  version: 'react17';
  date: string;
  originalPath: string;
  aiAssisted: boolean;
}

/**
 * Extensions to the project.json manifest for migration tracking
 */
export interface ProjectMigrationMetadata {
  /** Current runtime version */
  runtimeVersion?: RuntimeVersion;
  /** Information about the source project if this was migrated */
  migratedFrom?: MigratedFromInfo;
  /** Migration notes per component */
  migrationNotes?: Record<string, ComponentMigrationNote>;
}

// =============================================================================
// Legacy Pattern Definitions
// =============================================================================

/**
 * Pattern definition for detecting legacy React code
 */
export interface LegacyPattern {
  regex: RegExp;
  name: string;
  type: MigrationIssueType;
  description: string;
  autoFixable: boolean;
}

/**
 * Result of scanning for legacy patterns in a project
 */
export interface LegacyPatternScan {
  found: boolean;
  patterns: string[];
  files: Array<{
    path: string;
    line: number;
    pattern: string;
    content?: string;
  }>;
}

// =============================================================================
// Event Types
// =============================================================================

export type MigrationEventType =
  | 'scan-started'
  | 'scan-progress'
  | 'scan-complete'
  | 'migration-started'
  | 'migration-progress'
  | 'migration-complete'
  | 'migration-failed'
  | 'ai-decision-required'
  | 'budget-pause-required';

export interface MigrationEvent {
  type: MigrationEventType;
  sessionId: string;
  data?: unknown;
}
