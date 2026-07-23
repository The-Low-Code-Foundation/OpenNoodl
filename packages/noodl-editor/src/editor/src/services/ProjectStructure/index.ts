/**
 * SUB-001 — v2 project-structure service surface.
 *
 * Orchestrates the loader, saver, and format detector into the two operations
 * the project model needs:
 *
 *   - `loadProject(dir)`  read the decomposed v2 files → reconstruct the legacy
 *     in-memory project shape (the same object `ProjectModel.fromJSON` consumes),
 *     and seed the save baseline.
 *   - `saveProject(dir, project)`  write only the components (and project-level
 *     files) that actually changed, atomically, plus an incremental registry
 *     update.
 *
 * The whole project stays materialised in memory (every current consumer assumes
 * that). What is per-component here is *load, save, and invalidation* — which is
 * exactly what per-component git diffs and future live-collab need.
 *
 * The class takes an injectable filesystem so it is unit-testable without the
 * Electron platform singleton. `projectStructureService` is the app-wide instance
 * bound to the platform filesystem.
 *
 * @module noodl-editor/services/ProjectStructure
 */

import { filesystem } from '@noodl/platform';

import type { LegacyProject, LegacyComponent } from '../../io/ProjectExporter';
import { buildProjectV2File, buildRoutesV2File, buildStylesV2File } from '../../io/ProjectExporter';
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
import { ComponentLoader } from './ComponentLoader';
import { ComponentSaver, stableStringify, hashString } from './ComponentSaver';
import { ProjectMigrator, type MigratorFilesystem } from './ProjectMigrator';

export interface LoadResult {
  project: LegacyProject;
  warnings: string[];
}

export interface SaveResult {
  result: 'success' | 'failure';
  message?: string;
  /** Registry paths written this save (diagnostics). */
  changed?: string[];
  removed?: string[];
}

/** Project-level file identities tracked for change detection. */
type ProjectLevelKey = 'project' | 'routes' | 'styles';

export class ProjectStructureService {
  readonly loader: ComponentLoader;
  readonly saver: ComponentSaver;
  private readonly detector: ProjectFormatDetector;
  private readonly importer = new ProjectImporter();

  /** Content hash (minus volatile fields) of each project-level file on disk. */
  private readonly projectLevelHashes = new Map<ProjectLevelKey, string>();

  constructor(private readonly fs: ProjectStructureFilesystem) {
    this.loader = new ComponentLoader(fs);
    this.saver = new ComponentSaver(fs);
    this.detector = new ProjectFormatDetector({
      exists: (p: string) => fs.exists(p),
      join: (...parts: string[]) => fs.join(...parts)
    });
  }

  async detectFormat(projectDir: string): Promise<ProjectFormat> {
    return this.detector.getFormat(projectDir);
  }

  // ── Load ─────────────────────────────────────────────────────────────────────

  /**
   * Reads a v2 project directory and reconstructs the legacy in-memory project.
   * Seeds the save baseline so the next save writes only what the user changes.
   */
  async loadProject(projectDir: string): Promise<LoadResult> {
    const projectFile = await this.fs.readJson<ProjectV2File>(
      this.fs.join(projectDir, V2_FILES.project)
    );
    const registry = await this.fs.readJson<RegistryV2File>(
      this.fs.join(projectDir, V2_FILES.registry)
    );

    const routes = this.fs.exists(this.fs.join(projectDir, V2_FILES.routes))
      ? await this.fs.readJson<RoutesV2File>(this.fs.join(projectDir, V2_FILES.routes))
      : undefined;
    const styles = this.fs.exists(this.fs.join(projectDir, V2_FILES.styles))
      ? await this.fs.readJson<StylesV2File>(this.fs.join(projectDir, V2_FILES.styles))
      : undefined;

    const registryPaths = Object.keys(registry.components ?? {});

    const componentEntries = await Promise.all(
      registryPaths.map(async (path) => {
        const dir = this.fs.join(projectDir, V2_FILES.componentsDir, path);
        const [component, nodes, connections] = await Promise.all([
          this.fs.readJson<ComponentV2File>(this.fs.join(dir, V2_FILES.component)),
          this.fs.readJson<NodesV2File>(this.fs.join(dir, V2_FILES.nodes)),
          this.fs.readJson<ConnectionsV2File>(this.fs.join(dir, V2_FILES.connections))
        ]);
        return [path, { component, nodes, connections }] as const;
      })
    );

    const components: ImportInput['components'] = {};
    for (const [path, files] of componentEntries) {
      components[path] = files;
    }

    const { project, warnings } = this.importer.import({
      project: projectFile,
      registry,
      routes,
      styles,
      components
    });

    // Seed baselines so the first save only writes genuine edits.
    this.saver.seedFromProject(project);
    this.seedProjectLevelHashes(project);
    this.loader.invalidate();

    return { project, warnings };
  }

  /**
   * Reloads a single component from disk, bypassing any stale cache, and marks
   * its on-disk baseline as current. Returns the reconstructed component for the
   * caller to swap into the in-memory project.
   *
   * This is the surgical-reload seam for file-watch and future live-collab: a
   * peer's change to one component is applied without disturbing other
   * components' unsaved state, and without the local autosave echoing it back.
   */
  async reloadComponent(projectDir: string, componentPath: string): Promise<LegacyComponent> {
    this.loader.invalidate(componentPath);
    const component = await this.loader.loadComponent(projectDir, componentPath);
    this.saver.noteExternalWrite(componentPath, component);
    return component;
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  /**
   * Writes only the components (and project-level files) that changed since the
   * last load/save, atomically, with an incremental registry update.
   */
  async saveProject(projectDir: string, project: LegacyProject): Promise<SaveResult> {
    const changeSet = this.saver.getChangedComponents(project);

    // Snapshot baselines so a mid-save failure rolls everything back — a retry
    // then recomputes the identical change set and redoes every write (including
    // the registry), rather than leaving a component orphaned from a stale index.
    const baselineSnapshot = this.saver.snapshotBaselines();
    const projectLevelSnapshot = new Map(this.projectLevelHashes);

    try {
      await this.saveProjectLevelFiles(projectDir, project);

      for (const { path, component } of changeSet.changed) {
        await this.saver.saveComponent(projectDir, path, component);
      }
      for (const path of changeSet.removed) {
        await this.saver.removeComponent(projectDir, path);
      }
      if (changeSet.changed.length > 0 || changeSet.removed.length > 0) {
        await this.saver.updateRegistry(projectDir, changeSet);
      }

      return {
        result: 'success',
        changed: changeSet.changed.map((c) => c.path),
        removed: changeSet.removed
      };
    } catch (err) {
      this.saver.restoreBaselines(baselineSnapshot);
      this.projectLevelHashes.clear();
      for (const [k, v] of projectLevelSnapshot) this.projectLevelHashes.set(k, v);
      return {
        result: 'failure',
        message: err instanceof Error ? err.message : String(err)
      };
    }
  }

  // ── Project-level files ────────────────────────────────────────────────────────

  private projectLevelContent(project: LegacyProject): Record<ProjectLevelKey, unknown | null> {
    return {
      project: buildProjectV2File(project, ''), // '' timestamp — stripped before hashing
      routes: buildRoutesV2File(project),
      styles: buildStylesV2File(project)
    };
  }

  private hashProjectLevel(content: unknown): string {
    if (content === null) return 'absent';
    // Exclude the volatile `modified` field on the project file.
    const { modified: _m, ...rest } = content as Record<string, unknown>;
    return hashString(stableStringify(rest));
  }

  private seedProjectLevelHashes(project: LegacyProject): void {
    const content = this.projectLevelContent(project);
    (Object.keys(content) as ProjectLevelKey[]).forEach((key) => {
      this.projectLevelHashes.set(key, this.hashProjectLevel(content[key]));
    });
  }

  private async saveProjectLevelFiles(projectDir: string, project: LegacyProject): Promise<void> {
    const now = new Date().toISOString();
    const fileNames: Record<ProjectLevelKey, string> = {
      project: V2_FILES.project,
      routes: V2_FILES.routes,
      styles: V2_FILES.styles
    };

    // Build with a real timestamp only where we actually write.
    const built: Record<ProjectLevelKey, unknown | null> = {
      project: buildProjectV2File(project, now),
      routes: buildRoutesV2File(project),
      styles: buildStylesV2File(project)
    };

    for (const key of Object.keys(built) as ProjectLevelKey[]) {
      const content = built[key];
      const hash = this.hashProjectLevel(content);
      if (hash === this.projectLevelHashes.get(key)) continue; // unchanged
      if (content === null) {
        // Went from present → absent: leave the stale file rather than deleting.
        // (Rare; safe. Explicit removal can come with the migration wizard.)
        this.projectLevelHashes.set(key, hash);
        continue;
      }
      await this.saver.writeFileAtomic(this.fs.join(projectDir, fileNames[key]), content);
      this.projectLevelHashes.set(key, hash);
    }
  }
}

/** App-wide instance bound to the platform filesystem. */
export const projectStructureService = new ProjectStructureService(
  filesystem as unknown as ProjectStructureFilesystem
);

/**
 * App-wide migration engine (SUB-003) bound to the platform filesystem. The
 * platform `filesystem` implements the whole-folder copy and unique-path helpers
 * the migrator needs on top of the base ProjectStructure surface.
 */
export const projectMigrator = new ProjectMigrator(filesystem as unknown as MigratorFilesystem);

export { ComponentLoader } from './ComponentLoader';
export { ComponentSaver } from './ComponentSaver';
export { ProjectMigrator } from './ProjectMigrator';
export type { MigratorFilesystem, PreflightReport, MigrationResult, VerificationResult } from './ProjectMigrator';
export * from './types';
