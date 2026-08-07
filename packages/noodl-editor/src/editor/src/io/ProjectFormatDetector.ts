/**
 * STRUCT-004  Project Format Detection
 *
 * Utility for detecting whether a project directory uses the legacy
 * monolithic format (project.json) or the v2 multi-file format
 * (nodegx.project.json + components/).
 *
 * Design goals:
 * - Pure utility  no side effects, no global state
 * - Testable  accepts a filesystem abstraction, not the platform singleton
 * - Fast  uses file existence checks only, no parsing
 * - Explicit  returns a typed result with confidence and indicators
 *
 * @module noodl-editor/io/ProjectFormatDetector
 * @since 1.2.0
 */

//  Types 

/** The detected project format */
export type ProjectFormat = 'legacy' | 'v2' | 'unknown';

/**
 * Result of a format detection check.
 */
export interface FormatDetectionResult {
  /** The detected format */
  format: ProjectFormat;
  /** Confidence level of the detection */
  confidence: 'high' | 'medium' | 'low';
  /** Human-readable indicators that led to this conclusion */
  indicators: string[];
}

/**
 * Minimal filesystem interface required by ProjectFormatDetector.
 * Allows injection of a test double without depending on the platform.
 */
export interface DetectorFilesystem {
  /** Returns true if the path exists (file or directory) */
  exists(path: string): boolean | Promise<boolean>;
  /** Joins path segments */
  join(...parts: string[]): string;
}

//  Sentinel filenames 

/** Files/dirs that indicate a v2 project */
export const V2_INDICATORS = {
  projectFile: 'nodegx.project.json',
  componentsDir: 'components',
  registryFile: 'components/_registry.json'
} as const;

/** Files that indicate a legacy project */
export const LEGACY_INDICATORS = {
  projectFile: 'project.json'
} as const;

//  ProjectFormatDetector 

/**
 * Detects the format of a project directory.
 *
 * Detection logic (in priority order):
 * 1. If `nodegx.project.json` exists  v2 (high confidence)
 * 2. If `components/_registry.json` exists  v2 (high confidence)
 * 3. If `project.json` exists AND no v2 indicators  legacy (high confidence)
 * 4. If `project.json` exists AND v2 indicators present  v2 (medium confidence, mixed project)
 * 5. If neither exists  unknown (low confidence)
 *
 * @example
 * ```ts
 * // With platform filesystem
 * import { filesystem } from '@noodl/platform';
 * const detector = new ProjectFormatDetector(filesystem);
 * const result = await detector.detect('/path/to/project');
 *
 * // With test double
 * const mockFs = { exists: (p) => p.endsWith('project.json'), join: path.join };
 * const detector = new ProjectFormatDetector(mockFs);
 * ```
 */
export class ProjectFormatDetector {
  constructor(private readonly fs: DetectorFilesystem) {}

  /**
   * Detects the format of the project at the given directory path.
   *
   * @param projectDir - Absolute path to the project directory
   * @returns FormatDetectionResult with format, confidence, and indicators
   */
  async detect(projectDir: string): Promise<FormatDetectionResult> {
    const indicators: string[] = [];

    // Check for v2 indicators
    const hasV2ProjectFile = await this.exists(this.fs.join(projectDir, V2_INDICATORS.projectFile));
    const hasRegistry = await this.exists(this.fs.join(projectDir, V2_INDICATORS.registryFile));
    const hasComponentsDir = await this.exists(this.fs.join(projectDir, V2_INDICATORS.componentsDir));

    // Check for legacy indicator
    const hasLegacyProjectFile = await this.exists(this.fs.join(projectDir, LEGACY_INDICATORS.projectFile));

    // Build indicator list
    if (hasV2ProjectFile) indicators.push(`Found ${V2_INDICATORS.projectFile}`);
    if (hasRegistry) indicators.push(`Found ${V2_INDICATORS.registryFile}`);
    if (hasComponentsDir) indicators.push(`Found ${V2_INDICATORS.componentsDir}/ directory`);
    if (hasLegacyProjectFile) indicators.push(`Found ${LEGACY_INDICATORS.projectFile}`);

    //  Decision logic 

    const v2Score = (hasV2ProjectFile ? 2 : 0) + (hasRegistry ? 2 : 0) + (hasComponentsDir ? 1 : 0);
    const isV2 = v2Score >= 2; // needs at least nodegx.project.json OR registry

    if (isV2) {
      return {
        format: 'v2',
        confidence: hasV2ProjectFile && hasRegistry ? 'high' : 'medium',
        indicators
      };
    }

    if (hasLegacyProjectFile) {
      return {
        format: 'legacy',
        confidence: 'high',
        indicators
      };
    }

    // Nothing found
    return {
      format: 'unknown',
      confidence: 'low',
      indicators: indicators.length > 0 ? indicators : ['No project files found in directory']
    };
  }

  /**
   * Synchronous version of detect() for contexts where async is not available.
   * Only works if the injected filesystem.exists() is synchronous.
   *
   * @param projectDir - Absolute path to the project directory
   * @returns FormatDetectionResult (synchronous)
   */
  detectSync(projectDir: string): FormatDetectionResult {
    const indicators: string[] = [];

    const existsSync = (p: string): boolean => {
      const result = this.fs.exists(p);
      if (typeof result === 'boolean') return result;
      throw new Error('detectSync() requires a synchronous filesystem.exists() implementation');
    };

    const hasV2ProjectFile = existsSync(this.fs.join(projectDir, V2_INDICATORS.projectFile));
    const hasRegistry = existsSync(this.fs.join(projectDir, V2_INDICATORS.registryFile));
    const hasComponentsDir = existsSync(this.fs.join(projectDir, V2_INDICATORS.componentsDir));
    const hasLegacyProjectFile = existsSync(this.fs.join(projectDir, LEGACY_INDICATORS.projectFile));

    if (hasV2ProjectFile) indicators.push(`Found ${V2_INDICATORS.projectFile}`);
    if (hasRegistry) indicators.push(`Found ${V2_INDICATORS.registryFile}`);
    if (hasComponentsDir) indicators.push(`Found ${V2_INDICATORS.componentsDir}/ directory`);
    if (hasLegacyProjectFile) indicators.push(`Found ${LEGACY_INDICATORS.projectFile}`);

    const v2Score = (hasV2ProjectFile ? 2 : 0) + (hasRegistry ? 2 : 0) + (hasComponentsDir ? 1 : 0);
    const isV2 = v2Score >= 2;

    if (isV2) {
      return {
        format: 'v2',
        confidence: hasV2ProjectFile && hasRegistry ? 'high' : 'medium',
        indicators
      };
    }

    if (hasLegacyProjectFile) {
      return { format: 'legacy', confidence: 'high', indicators };
    }

    return {
      format: 'unknown',
      confidence: 'low',
      indicators: indicators.length > 0 ? indicators : ['No project files found in directory']
    };
  }

  /**
   * Quick check  returns just the format string without full result object.
   * Useful for simple if/else branching.
   *
   * @param projectDir - Absolute path to the project directory
   */
  async getFormat(projectDir: string): Promise<ProjectFormat> {
    const result = await this.detect(projectDir);
    return result.format;
  }

  /**
   * Returns true if the project at the given path is in v2 format.
   */
  async isV2(projectDir: string): Promise<boolean> {
    return (await this.getFormat(projectDir)) === 'v2';
  }

  /**
   * Returns true if the project at the given path is in legacy format.
   */
  async isLegacy(projectDir: string): Promise<boolean> {
    return (await this.getFormat(projectDir)) === 'legacy';
  }

  //  Private helpers 

  private async exists(path: string): Promise<boolean> {
    try {
      const result = this.fs.exists(path);
      return result instanceof Promise ? await result : result;
    } catch {
      return false;
    }
  }
}

//  Factory helpers 

/**
 * Creates a ProjectFormatDetector using Node.js fs module.
 * Use this in tests or Node.js scripts.
 */
export function createNodeDetector(): ProjectFormatDetector {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodePath = require('path') as typeof import('path');

  return new ProjectFormatDetector({
    exists: (p: string) => fs.existsSync(p),
    join: (...parts: string[]) => nodePath.join(...parts)
  });
}
