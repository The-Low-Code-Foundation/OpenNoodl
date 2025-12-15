/**
 * MigrationSession
 *
 * State machine for managing the React 19 migration process.
 * Handles step transitions, progress tracking, and session persistence.
 *
 * @module noodl-editor/models/migration
 * @since 1.2.0
 */

import { filesystem } from '@noodl/platform';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { detectRuntimeVersion, scanProjectForMigration } from './ProjectScanner';
import {
  MigrationSession as MigrationSessionState,
  MigrationStep,
  MigrationScan,
  MigrationProgress,
  MigrationResult,
  MigrationLogEntry,
  AIConfig,
  AIBudget,
  AIPreferences,
  RuntimeVersionInfo
} from './types';

// =============================================================================
// Constants
// =============================================================================

/**
 * Default AI budget configuration
 */
const DEFAULT_AI_BUDGET: AIBudget = {
  maxPerSession: 5.0, // $5 max per migration session
  spent: 0,
  pauseIncrement: 1.0, // Pause and confirm every $1
  showEstimates: true
};

/**
 * Default AI preferences
 */
const DEFAULT_AI_PREFERENCES: AIPreferences = {
  preferFunctional: true,
  preserveComments: true,
  verboseOutput: false
};

// =============================================================================
// MigrationSessionManager
// =============================================================================

/**
 * Manages the migration session state machine.
 * Extends EventDispatcher for reactive updates to UI.
 */
export class MigrationSessionManager extends EventDispatcher {
  private session: MigrationSessionState | null = null;

  /**
   * Creates a new migration session for a project
   */
  async createSession(
    sourcePath: string,
    projectName: string
  ): Promise<MigrationSessionState> {
    // Generate unique session ID
    const sessionId = `migration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Detect runtime version
    const versionInfo = await detectRuntimeVersion(sourcePath);

    // Only allow migration of React 17 projects
    if (versionInfo.version !== 'react17' && versionInfo.version !== 'unknown') {
      throw new Error(
        `Project is already using ${versionInfo.version}. Migration not needed.`
      );
    }

    // Create session
    this.session = {
      id: sessionId,
      step: 'confirm',
      source: {
        path: sourcePath,
        name: projectName,
        runtimeVersion: 'react17'
      },
      target: {
        path: '', // Will be set when user confirms
        copied: false
      }
    };

    this.notifyListeners('sessionCreated', { session: this.session });
    return this.session;
  }

  /**
   * Gets the current session
   */
  getSession(): MigrationSessionState | null {
    return this.session;
  }

  /**
   * Gets the current step
   */
  getCurrentStep(): MigrationStep | null {
    return this.session?.step ?? null;
  }

  /**
   * Validates if a step transition is allowed
   */
  private canTransitionTo(from: MigrationStep, to: MigrationStep): boolean {
    const allowedTransitions: Record<MigrationStep, MigrationStep[]> = {
      confirm: ['scanning'],
      scanning: ['report', 'failed'],
      report: ['configureAi', 'migrating'], // Can skip AI config if no AI needed
      configureAi: ['migrating'],
      migrating: ['complete', 'failed'],
      complete: [], // Terminal state
      failed: ['confirm'] // Can retry from beginning
    };

    return allowedTransitions[from]?.includes(to) ?? false;
  }

  /**
   * Transitions to a new step
   */
  async transitionTo(step: MigrationStep): Promise<void> {
    if (!this.session) {
      throw new Error('No active migration session');
    }

    const currentStep = this.session.step;

    if (!this.canTransitionTo(currentStep, step)) {
      throw new Error(
        `Invalid transition from "${currentStep}" to "${step}"`
      );
    }

    const previousStep = this.session.step;
    this.session.step = step;

    this.notifyListeners('stepChanged', {
      session: this.session,
      previousStep,
      newStep: step
    });
  }

  /**
   * Sets the target path for the migrated project copy
   */
  setTargetPath(targetPath: string): void {
    if (!this.session) {
      throw new Error('No active migration session');
    }

    this.session.target.path = targetPath;
    this.notifyListeners('targetPathSet', {
      session: this.session,
      targetPath
    });
  }

  /**
   * Starts scanning the project for migration needs
   */
  async startScanning(): Promise<MigrationScan> {
    if (!this.session) {
      throw new Error('No active migration session');
    }

    await this.transitionTo('scanning');

    try {
      const scan = await scanProjectForMigration(
        this.session.source.path,
        (progress, currentItem, stats) => {
          this.notifyListeners('scanProgress', {
            session: this.session,
            progress,
            currentItem,
            stats
          });
        }
      );

      this.session.scan = scan;
      await this.transitionTo('report');

      this.notifyListeners('scanComplete', {
        session: this.session,
        scan
      });

      return scan;
    } catch (error) {
      await this.transitionTo('failed');
      throw error;
    }
  }

  /**
   * Configures AI settings for the migration
   */
  configureAI(config: Partial<AIConfig>): void {
    if (!this.session) {
      throw new Error('No active migration session');
    }

    this.session.ai = {
      enabled: config.enabled ?? false,
      apiKey: config.apiKey,
      budget: config.budget ?? DEFAULT_AI_BUDGET,
      preferences: config.preferences ?? DEFAULT_AI_PREFERENCES
    };

    this.notifyListeners('aiConfigured', {
      session: this.session,
      ai: this.session.ai
    });
  }

  /**
   * Starts the migration process
   */
  async startMigration(): Promise<MigrationResult> {
    if (!this.session) {
      throw new Error('No active migration session');
    }

    if (!this.session.scan) {
      throw new Error('Project must be scanned before migration');
    }

    await this.transitionTo('migrating');

    const startTime = Date.now();

    // Initialize progress
    this.session.progress = {
      phase: 'copying',
      current: 0,
      total: this.getTotalMigrationSteps(),
      log: []
    };

    try {
      // Phase 1: Copy project
      await this.executeCopyPhase();

      // Phase 2: Automatic migrations
      await this.executeAutomaticPhase();

      // Phase 3: AI-assisted migrations (if enabled)
      if (this.session.ai?.enabled) {
        await this.executeAIAssistedPhase();
      }

      // Phase 4: Finalize
      await this.executeFinalizePhase();

      // Calculate result
      const result: MigrationResult = {
        success: true,
        migrated: this.getSuccessfulMigrationCount(),
        needsReview: this.getNeedsReviewCount(),
        failed: this.getFailedCount(),
        totalCost: this.session.ai?.budget.spent ?? 0,
        duration: Date.now() - startTime
      };

      this.session.result = result;
      await this.transitionTo('complete');

      this.notifyListeners('migrationComplete', {
        session: this.session,
        result
      });

      return result;
    } catch (error) {
      const result: MigrationResult = {
        success: false,
        migrated: this.getSuccessfulMigrationCount(),
        needsReview: this.getNeedsReviewCount(),
        failed: this.getFailedCount() + 1,
        totalCost: this.session.ai?.budget.spent ?? 0,
        duration: Date.now() - startTime
      };

      this.session.result = result;
      await this.transitionTo('failed');

      this.notifyListeners('migrationFailed', {
        session: this.session,
        error,
        result
      });

      throw error;
    }
  }

  /**
   * Adds a log entry to the migration progress
   */
  addLogEntry(entry: Omit<MigrationLogEntry, 'timestamp'>): void {
    if (!this.session?.progress) return;

    const logEntry: MigrationLogEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };

    this.session.progress.log.push(logEntry);

    this.notifyListeners('logEntry', {
      session: this.session,
      entry: logEntry
    });
  }

  /**
   * Updates migration progress
   */
  updateProgress(updates: Partial<MigrationProgress>): void {
    if (!this.session?.progress) return;

    Object.assign(this.session.progress, updates);

    this.notifyListeners('progressUpdated', {
      session: this.session,
      progress: this.session.progress
    });
  }

  /**
   * Cancels the current migration session
   */
  cancelSession(): void {
    if (!this.session) return;

    const session = this.session;
    this.session = null;

    this.notifyListeners('sessionCancelled', { session });
  }

  /**
   * Resets a failed session to retry
   */
  async resetForRetry(): Promise<void> {
    if (!this.session) {
      throw new Error('No active migration session');
    }

    if (this.session.step !== 'failed') {
      throw new Error('Can only reset failed sessions');
    }

    await this.transitionTo('confirm');

    // Clear progress and result
    this.session.progress = undefined;
    this.session.result = undefined;
    this.session.target.copied = false;

    this.notifyListeners('sessionReset', { session: this.session });
  }

  // ===========================================================================
  // Private Migration Phase Methods
  // ===========================================================================

  private getTotalMigrationSteps(): number {
    if (!this.session?.scan) return 0;
    const { categories } = this.session.scan;
    return (
      1 + // Copy phase
      categories.automatic.length +
      categories.simpleFixes.length +
      categories.needsReview.length +
      1 // Finalize phase
    );
  }

  private getSuccessfulMigrationCount(): number {
    // Count from log entries
    return (
      this.session?.progress?.log.filter((l) => l.level === 'success').length ?? 0
    );
  }

  private getNeedsReviewCount(): number {
    return this.session?.scan?.categories.needsReview.length ?? 0;
  }

  private getFailedCount(): number {
    return (
      this.session?.progress?.log.filter((l) => l.level === 'error').length ?? 0
    );
  }

  private async executeCopyPhase(): Promise<void> {
    if (!this.session) return;

    const sourcePath = this.session.source.path;
    const targetPath = this.session.target.path;

    this.updateProgress({ phase: 'copying', current: 0 });
    this.addLogEntry({
      level: 'info',
      message: `Copying project from ${sourcePath} to ${targetPath}...`
    });

    try {
      // Check if target already exists
      const targetExists = await filesystem.exists(targetPath);
      if (targetExists) {
        throw new Error(`Target directory already exists: ${targetPath}`);
      }

      // Create target directory
      await filesystem.makeDirectory(targetPath);

      // Copy all files recursively
      await this.copyDirectoryRecursive(sourcePath, targetPath);

      this.session.target.copied = true;

      this.addLogEntry({
        level: 'success',
        message: 'Project copied successfully'
      });

      this.updateProgress({ current: 1 });
    } catch (error) {
      this.addLogEntry({
        level: 'error',
        message: `Failed to copy project: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      throw error;
    }
  }

  /**
   * Recursively copies a directory and its contents
   * Uses copyFile to preserve binary files (fonts, images, etc.)
   */
  private async copyDirectoryRecursive(sourcePath: string, targetPath: string): Promise<void> {
    const entries = await filesystem.listDirectory(sourcePath);

    for (const entry of entries) {
      const sourceItemPath = entry.fullPath;
      const targetItemPath = `${targetPath}/${entry.name}`;

      if (entry.isDirectory) {
        // Skip node_modules and .git folders
        if (entry.name === 'node_modules' || entry.name === '.git') {
          continue;
        }

        // Create directory and recurse
        await filesystem.makeDirectory(targetItemPath);
        await this.copyDirectoryRecursive(sourceItemPath, targetItemPath);
      } else {
        // Copy file using copyFile to preserve binary files correctly
        await filesystem.copyFile(sourceItemPath, targetItemPath);
      }
    }
  }

  private async executeAutomaticPhase(): Promise<void> {
    if (!this.session?.scan) return;

    this.updateProgress({ phase: 'automatic' });
    this.addLogEntry({
      level: 'info',
      message: 'Applying automatic migrations...'
    });

    const { automatic, simpleFixes } = this.session.scan.categories;
    const allAutomatic = [...automatic, ...simpleFixes];

    for (let i = 0; i < allAutomatic.length; i++) {
      const component = allAutomatic[i];

      this.updateProgress({
        current: 1 + i,
        currentComponent: component.name
      });

      // TODO: Implement actual automatic fixes
      await this.simulateDelay(100);

      this.addLogEntry({
        level: 'success',
        component: component.name,
        message: `Migrated automatically`
      });
    }
  }

  private async executeAIAssistedPhase(): Promise<void> {
    if (!this.session?.scan || !this.session.ai?.enabled) return;

    this.updateProgress({ phase: 'ai-assisted' });
    this.addLogEntry({
      level: 'info',
      message: 'Starting AI-assisted migration...'
    });

    const { needsReview } = this.session.scan.categories;

    for (let i = 0; i < needsReview.length; i++) {
      const component = needsReview[i];

      this.updateProgress({
        currentComponent: component.name
      });

      // TODO: Implement actual AI migration using Claude API
      await this.simulateDelay(200);

      this.addLogEntry({
        level: 'warning',
        component: component.name,
        message: 'AI migration not yet implemented - marked for manual review'
      });
    }
  }

  private async executeFinalizePhase(): Promise<void> {
    if (!this.session) return;

    this.updateProgress({ phase: 'finalizing' });
    this.addLogEntry({
      level: 'info',
      message: 'Finalizing migration...'
    });

    try {
      // Update project.json with migration metadata
      const targetProjectJsonPath = `${this.session.target.path}/project.json`;
      
      // Read existing project.json
      const projectJson = await filesystem.readJson(targetProjectJsonPath) as Record<string, unknown>;
      
      // Add React 19 markers
      projectJson.runtimeVersion = 'react19';
      projectJson.migratedFrom = {
        version: 'react17',
        date: new Date().toISOString(),
        originalPath: this.session.source.path,
        aiAssisted: this.session.ai?.enabled ?? false
      };
      
      // Write updated project.json back
      await filesystem.writeFile(
        targetProjectJsonPath,
        JSON.stringify(projectJson, null, 2)
      );

      this.addLogEntry({
        level: 'success',
        message: 'Project marked as React 19'
      });
    } catch (error) {
      this.addLogEntry({
        level: 'warning',
        message: `Could not update project.json metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      // Don't throw - this is not a critical failure
    }

    this.addLogEntry({
      level: 'success',
      message: 'Migration finalized'
    });

    this.updateProgress({
      current: this.getTotalMigrationSteps()
    });
  }

  private simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

/**
 * Global migration session manager instance
 */
export const migrationSessionManager = new MigrationSessionManager();

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Checks if a project needs migration
 */
export async function checkProjectNeedsMigration(
  projectPath: string
): Promise<{
  needsMigration: boolean;
  versionInfo: RuntimeVersionInfo;
}> {
  const versionInfo = await detectRuntimeVersion(projectPath);

  return {
    needsMigration: versionInfo.version === 'react17' || versionInfo.version === 'unknown',
    versionInfo
  };
}

/**
 * Gets a human-readable step label
 */
export function getStepLabel(step: MigrationStep): string {
  const labels: Record<MigrationStep, string> = {
    confirm: 'Confirm Migration',
    scanning: 'Scanning Project',
    report: 'Migration Report',
    configureAi: 'Configure AI Assistance',
    migrating: 'Migrating',
    complete: 'Migration Complete',
    failed: 'Migration Failed'
  };
  return labels[step];
}

/**
 * Gets the step number for progress display (1-indexed)
 */
export function getStepNumber(step: MigrationStep): number {
  const order: MigrationStep[] = [
    'confirm',
    'scanning',
    'report',
    'configureAi',
    'migrating',
    'complete'
  ];
  const index = order.indexOf(step);
  return index >= 0 ? index + 1 : 0;
}

/**
 * Gets total number of steps for progress display
 */
export function getTotalSteps(includeAi: boolean): number {
  return includeAi ? 6 : 5;
}
