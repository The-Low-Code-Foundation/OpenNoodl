/**
 * SUB-003 — Project migration engine (v1 monolithic → v2 decomposed).
 *
 * This is the point of maximum risk in the whole format programme: it rewrites a
 * user's existing project on disk. A bad migration destroys their work. Every
 * design choice here is subordinate to one guarantee:
 *
 *   **The original project is never damaged.** If anything goes wrong — a bad
 *   write, a power loss, a fidelity mismatch — the project either stays exactly
 *   as it was, or is restored to exactly as it was from a backup taken *before*
 *   the first write.
 *
 * How that guarantee is upheld (order matters):
 *
 *   1. **Backup first.** The entire project directory is copied to a sibling
 *      backup before a single v2 file is written. If the backup can't be made,
 *      nothing else runs.
 *   2. **Write v2 alongside, never over.** The decomposed files
 *      (`nodegx.project.json`, `components/…`, registry, routes, styles) are all
 *      *new* paths. The legacy `project.json` is left untouched through the whole
 *      write+verify phase, so at every instant before the final commit the
 *      project still opens as a valid legacy project.
 *   3. **Verify in memory.** The freshly-written v2 files are read back and
 *      imported, then deep-compared against the pre-migration in-memory project
 *      (SUB-002's round-trip machinery, applied at runtime). A mismatch aborts.
 *   4. **Commit last.** Only after verification passes is the legacy
 *      `project.json` removed — the single, atomic, final step that flips the
 *      directory from legacy to v2. It lives in the backup, so this is reversible.
 *
 * Because the legacy file is removed only at step 4, a process kill at any earlier
 * point leaves a fully-intact legacy project on disk (plus a backup). The
 * orchestrated failure path additionally rolls the directory back to the backup
 * so the user sees no half-migrated state at all.
 *
 * The class takes injectable filesystem / exporter / importer so the full
 * safety machinery is unit-testable against an in-memory double, and so the
 * validation suite can inject a deliberately-lossy exporter to prove that
 * verification catches fidelity faults and aborts.
 *
 * @module noodl-editor/services/ProjectStructure/ProjectMigrator
 */

import {
  ProjectExporter,
  countNodes,
  type LegacyProject,
  type LegacyNode,
  type ExportResult
} from '../../io/ProjectExporter';
import { ProjectImporter, type ImportInput } from '../../io/ProjectImporter';
import { ProjectFormatDetector, type ProjectFormat } from '../../io/ProjectFormatDetector';
import type {
  ProjectV2File,
  RegistryV2File,
  RoutesV2File,
  StylesV2File,
  ComponentV2File,
  NodesV2File,
  ConnectionsV2File
} from '../../schemas';

import { ProjectStructureFilesystem, V2_FILES } from './types';
import { stableStringify } from './ComponentSaver';

/** Number of components at or above which a project is flagged as large-scale. */
const LARGE_SCALE_THRESHOLD = 200;

/** Legacy monolithic project file name. */
const LEGACY_PROJECT_FILE = 'project.json';

/**
 * Filesystem surface the migrator needs. A superset of
 * {@link ProjectStructureFilesystem}: it also copies whole folders (backup),
 * and derives sibling backup paths. The platform `filesystem` implements all of
 * these.
 */
export interface MigratorFilesystem extends ProjectStructureFilesystem {
  basename(path: string): string;
  copyFolder(from: string, to: string): Promise<void>;
  /** Returns a non-colliding variant of `path` (appends a suffix if taken). */
  makeUniquePath(path: string): string;
}

/** Pre-flight analysis of a legacy project — computed without writing anything. */
export interface PreflightReport {
  format: ProjectFormat;
  /** True only when the project is a legacy project that can be migrated. */
  canMigrate: boolean;
  projectName: string;
  componentCount: number;
  nodeCount: number;
  connectionCount: number;
  flags: {
    /** Nodes carrying `dynamicports` — delicate to round-trip; SUB-002 covered. */
    dynamicPortNodeCount: number;
    /** `metadata.routes` present but not array-shaped (a historically lossy case). */
    hasNonArrayRoutes: boolean;
    /** Lesson projects carry an extra top-level field. */
    hasLesson: boolean;
    /** At or above {@link LARGE_SCALE_THRESHOLD} components. */
    isLargeScale: boolean;
  };
  /** Human-readable notes to surface before the user commits. */
  warnings: string[];
}

export interface VerificationResult {
  verified: boolean;
  /** Path of the first field that diverged (for diagnostics), when verify fails. */
  mismatchPath?: string;
}

export interface MigrationResult {
  result: 'success' | 'failure' | 'skipped';
  message?: string;
  /** Where the pre-migration backup was written (present whenever a backup was taken). */
  backupPath?: string;
  /** Count of v2 files written (diagnostics). */
  filesWritten?: number;
  verification?: VerificationResult;
  report?: PreflightReport;
}

export interface MigrateOptions {
  /**
   * Base path for the backup. Defaults to a unique sibling of the project
   * directory (`<project>.nodegx-backup`). Injectable for tests.
   */
  backupPath?: string;
}

/** Injectable collaborators — real implementations by default, doubles in tests. */
export interface MigratorDeps {
  exporter?: Pick<ProjectExporter, 'export'>;
  importer?: Pick<ProjectImporter, 'import'>;
}

export class ProjectMigrator {
  private readonly detector: ProjectFormatDetector;
  private readonly exporter: Pick<ProjectExporter, 'export'>;
  private readonly importer: Pick<ProjectImporter, 'import'>;

  constructor(
    private readonly fs: MigratorFilesystem,
    deps: MigratorDeps = {}
  ) {
    this.detector = new ProjectFormatDetector({
      exists: (p: string) => fs.exists(p),
      join: (...parts: string[]) => fs.join(...parts)
    });
    this.exporter = deps.exporter ?? new ProjectExporter();
    this.importer = deps.importer ?? new ProjectImporter();
  }

  // ── Pre-flight analysis ────────────────────────────────────────────────────────

  /**
   * Reads a project directory and reports what migration would do, flagging the
   * delicate cases the fidelity audit (SUB-002) identified. Writes nothing.
   *
   * Throws only if the project file cannot be read or parsed — the caller should
   * present that as "this project can't be analysed" rather than migrating blind.
   */
  async analyze(projectDir: string): Promise<PreflightReport> {
    const format = await this.detector.getFormat(projectDir);
    if (format !== 'legacy') {
      return {
        format,
        canMigrate: false,
        projectName: '',
        componentCount: 0,
        nodeCount: 0,
        connectionCount: 0,
        flags: {
          dynamicPortNodeCount: 0,
          hasNonArrayRoutes: false,
          hasLesson: false,
          isLargeScale: false
        },
        warnings:
          format === 'v2'
            ? ['This project is already in the v2 decomposed format; no migration needed.']
            : ['No legacy project.json found; nothing to migrate.']
      };
    }

    const project = await this.readLegacyProject(projectDir);
    return this.analyzeProject(project, format);
  }

  /** Pure analysis over an already-parsed legacy project (exposed for tests). */
  analyzeProject(project: LegacyProject, format: ProjectFormat = 'legacy'): PreflightReport {
    const components = project.components ?? [];
    let nodeCount = 0;
    let connectionCount = 0;
    let dynamicPortNodeCount = 0;

    for (const component of components) {
      const roots = component.graph?.roots ?? [];
      nodeCount += countNodes(roots);
      connectionCount += (component.graph?.connections ?? []).length;
      dynamicPortNodeCount += countDynamicPortNodes(roots);
    }

    const routes = (project.metadata as { routes?: unknown } | undefined)?.routes;
    const hasNonArrayRoutes = routes !== undefined && !Array.isArray(routes);
    const hasLesson = project.lesson !== undefined;
    const isLargeScale = components.length >= LARGE_SCALE_THRESHOLD;

    const warnings: string[] = [];
    if (isLargeScale) {
      warnings.push(
        `Large project (${components.length} components): migration and verification may take a little longer.`
      );
    }
    if (dynamicPortNodeCount > 0) {
      warnings.push(
        `${dynamicPortNodeCount} node(s) use dynamic ports; these are carried and verified, but are the most format-sensitive nodes.`
      );
    }
    if (hasNonArrayRoutes) {
      warnings.push('Project has non-standard route metadata; it will be preserved as-is and verified.');
    }
    if (hasLesson) {
      warnings.push('This is a lesson project; the lesson data is carried through migration.');
    }

    return {
      format,
      canMigrate: format === 'legacy',
      projectName: project.name ?? '',
      componentCount: components.length,
      nodeCount,
      connectionCount,
      flags: { dynamicPortNodeCount, hasNonArrayRoutes, hasLesson, isLargeScale },
      warnings
    };
  }

  // ── Migration ──────────────────────────────────────────────────────────────────

  /**
   * Migrates a legacy project directory to the v2 decomposed format, safely and
   * reversibly. Never throws for expected failures — returns a
   * {@link MigrationResult} describing what happened, having restored the
   * original from backup on any failure.
   */
  async migrate(projectDir: string, options: MigrateOptions = {}): Promise<MigrationResult> {
    // 0. Refuse anything that isn't a clean legacy project.
    let report: PreflightReport;
    let original: LegacyProject;
    try {
      const format = await this.detector.getFormat(projectDir);
      if (format !== 'legacy') {
        return {
          result: 'skipped',
          message:
            format === 'v2'
              ? 'Project is already in the v2 format.'
              : 'No legacy project found to migrate.'
        };
      }
      original = await this.readLegacyProject(projectDir);
      report = this.analyzeProject(original, format);
    } catch (err) {
      // Could not even read/parse the project — do not touch anything.
      return {
        result: 'failure',
        message: `Could not read project for migration: ${errMsg(err)}`
      };
    }

    // 1. Backup first, always. If this fails, nothing else runs.
    const backupPath =
      options.backupPath ??
      this.fs.makeUniquePath(this.fs.join(this.fs.dirname(projectDir), `${this.fs.basename(projectDir)}.nodegx-backup`));
    try {
      await this.fs.copyFolder(projectDir, backupPath);
      if (!this.fs.exists(this.fs.join(backupPath, LEGACY_PROJECT_FILE))) {
        throw new Error('backup verification failed (project.json missing from backup)');
      }
    } catch (err) {
      return {
        result: 'failure',
        message: `Backup failed; migration aborted before any change: ${errMsg(err)}`,
        report
      };
    }

    // 2–4. Convert, verify, commit — with rollback-to-backup on any failure.
    try {
      const filesWritten = await this.writeV2Files(projectDir, original);

      const verification = await this.verify(projectDir, original);
      if (!verification.verified) {
        await this.rollback(projectDir, backupPath);
        return {
          result: 'failure',
          message: `Post-migration verification failed${
            verification.mismatchPath ? ` at "${verification.mismatchPath}"` : ''
          }; the original project was restored from backup.`,
          backupPath,
          filesWritten,
          verification,
          report
        };
      }

      // Commit: the legacy file is removed last. Up to this line the project has
      // been a valid legacy project on disk the entire time.
      await this.fs.removeFile(this.fs.join(projectDir, LEGACY_PROJECT_FILE));

      return {
        result: 'success',
        backupPath,
        filesWritten,
        verification,
        report
      };
    } catch (err) {
      await this.rollback(projectDir, backupPath);
      return {
        result: 'failure',
        message: `Migration failed and the original project was restored from backup: ${errMsg(err)}`,
        backupPath,
        report
      };
    }
  }

  /**
   * Restores a project directory to a backup taken by {@link migrate}. Replaces
   * the directory's contents wholesale with the backup — the strongest possible
   * "put it back exactly as it was" guarantee. Safe to call more than once.
   */
  async rollback(projectDir: string, backupPath: string): Promise<void> {
    if (!this.fs.exists(backupPath)) {
      throw new Error(`Cannot roll back: backup not found at ${backupPath}`);
    }
    this.fs.removeDirRecursive(projectDir);
    await this.fs.copyFolder(backupPath, projectDir);
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  private async readLegacyProject(projectDir: string): Promise<LegacyProject> {
    return this.fs.readJson<LegacyProject>(this.fs.join(projectDir, LEGACY_PROJECT_FILE));
  }

  /** Writes every v2 file (all new paths); returns the number of files written. */
  private async writeV2Files(projectDir: string, project: LegacyProject): Promise<number> {
    const exported: ExportResult = this.exporter.export(project);
    for (const file of exported.files) {
      const target = this.fs.join(projectDir, file.relativePath);
      await this.fs.makeDirectory(this.fs.dirname(target));
      await this.atomicWrite(target, file.content);
    }
    return exported.files.length;
  }

  /**
   * Reads back the freshly-written v2 files, imports them to the legacy shape,
   * and deep-compares against the pre-migration in-memory project. This is the
   * runtime application of SUB-002's round-trip fidelity guarantee.
   */
  private async verify(projectDir: string, original: LegacyProject): Promise<VerificationResult> {
    const projectFile = await this.fs.readJson<ProjectV2File>(this.fs.join(projectDir, V2_FILES.project));
    const registry = await this.fs.readJson<RegistryV2File>(this.fs.join(projectDir, V2_FILES.registry));

    const routes = this.fs.exists(this.fs.join(projectDir, V2_FILES.routes))
      ? await this.fs.readJson<RoutesV2File>(this.fs.join(projectDir, V2_FILES.routes))
      : undefined;
    const styles = this.fs.exists(this.fs.join(projectDir, V2_FILES.styles))
      ? await this.fs.readJson<StylesV2File>(this.fs.join(projectDir, V2_FILES.styles))
      : undefined;

    const components: ImportInput['components'] = {};
    for (const path of Object.keys(registry.components ?? {})) {
      const dir = this.fs.join(projectDir, V2_FILES.componentsDir, path);
      const [component, nodes, connections] = await Promise.all([
        this.fs.readJson<ComponentV2File>(this.fs.join(dir, V2_FILES.component)),
        this.fs.readJson<NodesV2File>(this.fs.join(dir, V2_FILES.nodes)),
        this.fs.readJson<ConnectionsV2File>(this.fs.join(dir, V2_FILES.connections))
      ]);
      components[path] = { component, nodes, connections };
    }

    const { project: reconstructed } = this.importer.import({
      project: projectFile,
      registry,
      routes,
      styles,
      components
    });

    const mismatchPath = firstDifference(stripEmpty(original), stripEmpty(reconstructed));
    return mismatchPath === null ? { verified: true } : { verified: false, mismatchPath };
  }

  /**
   * Atomic JSON write: temp sibling then rename over the target. An interrupted
   * write leaves either nothing or the old file — never a half-written file.
   * (Mirrors ComponentSaver.atomicWrite; inlined so the migrator is self-contained.)
   */
  private async atomicWrite(targetPath: string, content: unknown): Promise<void> {
    const tmpPath = `${targetPath}.tmp`;
    await this.fs.writeFile(tmpPath, JSON.stringify(content, null, 2));
    try {
      await this.fs.renameFile(tmpPath, targetPath);
    } catch (err) {
      try {
        await this.fs.removeFile(tmpPath);
      } catch {
        /* ignore */
      }
      throw err;
    }
  }
}

// ── Verification helpers (SUB-002 machinery, promoted to production) ────────────

/**
 * Recursively removes empty plain objects and empty arrays, preserving every
 * primitive (including 0, false, "", null). The v2 format intentionally omits
 * empty collections (a tested contract — see ProjectExporter.test.ts), so an
 * empty `{}`/`[]` and an absent key are semantically identical. Applied to BOTH
 * sides before comparison, so only that semantically-void noise is collapsed;
 * any genuine difference still shows.
 *
 * @see packages/noodl-editor/tests/io/roundtrip-fidelity.test.ts (origin)
 */
export function stripEmpty<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripEmpty(v)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = stripEmpty(v);
      const isEmptyObj =
        cleaned !== null &&
        typeof cleaned === 'object' &&
        !Array.isArray(cleaned) &&
        Object.keys(cleaned).length === 0;
      const isEmptyArr = Array.isArray(cleaned) && cleaned.length === 0;
      if (isEmptyObj || isEmptyArr) continue;
      out[k] = cleaned;
    }
    return out as T;
  }
  return value;
}

/**
 * Order-insensitive deep equality via canonical stringification. `a` and `b`
 * should already be {@link stripEmpty}-normalised. Returns true iff structurally
 * equal.
 */
export function canonicalEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

/**
 * Returns a dotted path to the first place `a` and `b` diverge, or null if they
 * are structurally equal. Used to make a verification failure legible ("diverged
 * at components.3.graph.comments") rather than just "not equal".
 */
export function firstDifference(a: unknown, b: unknown, path = ''): string | null {
  if (a === b) return null;

  const aIsArr = Array.isArray(a);
  const bIsArr = Array.isArray(b);
  if (aIsArr || bIsArr) {
    if (!aIsArr || !bIsArr) return path || '(root)';
    if (a.length !== b.length) return `${path} (length ${a.length} vs ${b.length})`;
    for (let i = 0; i < a.length; i++) {
      const d = firstDifference(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }

  const aIsObj = a !== null && typeof a === 'object';
  const bIsObj = b !== null && typeof b === 'object';
  if (aIsObj || bIsObj) {
    if (!aIsObj || !bIsObj) return path || '(root)';
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
    for (const k of keys) {
      const child = path ? `${path}.${k}` : k;
      if (!(k in ao)) return `${child} (missing on left)`;
      if (!(k in bo)) return `${child} (missing on right)`;
      const d = firstDifference(ao[k], bo[k], child);
      if (d) return d;
    }
    return null;
  }

  // Two differing primitives.
  return path || '(root)';
}

// ── Local helpers ───────────────────────────────────────────────────────────────

/** Counts nodes (recursively, including children) that declare dynamic ports. */
function countDynamicPortNodes(roots: LegacyNode[]): number {
  let count = 0;
  const walk = (node: LegacyNode) => {
    const dyn = (node as { dynamicports?: unknown[] }).dynamicports;
    if (Array.isArray(dyn) && dyn.length > 0) count++;
    for (const child of node.children ?? []) walk(child);
  };
  for (const root of roots) walk(root);
  return count;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
