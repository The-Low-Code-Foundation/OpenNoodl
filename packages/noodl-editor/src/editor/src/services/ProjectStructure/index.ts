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
import { ComponentSaver, stableStringify, hashString, hashComponent } from './ComponentSaver';
import type { ComponentChangeSet } from './ComponentSaver';
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
  /**
   * Registry paths that were in the change set but NOT written, because their
   * files on disk no longer match the baseline this editor recorded — someone
   * else wrote them while we held the project. See {@link findExternallyChanged}.
   */
  refused?: string[];
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

  /**
   * The project directory the current baselines describe, or undefined if none.
   *
   * 🔴 **THIS EXISTS BECAUSE BASELINES USED TO OUTLIVE THEIR PROJECT, AND THE
   * COST WAS A NEW PROJECT THAT COULD NOT SAVE AT ALL.** `diskHashes` is keyed by
   * component path, and `App` / `Pages/Home` are paths that every project has. On
   * the module singleton the map is cleared only by `seedFromProject`, so after
   * opening project A the entries for those paths survived into project B —
   * describing A's content, under B's names.
   *
   * A newly created project is exactly the case that never re-seeds:
   * `LocalProjectsModel.newProject` builds it from a legacy template, saves it
   * legacy, then converts it in place with `ProjectMigrator.migrate()`, which
   * writes the v2 files straight to disk and tells the saver nothing. So B's
   * first save was diffed against A's baselines, `findExternallyChanged` saw a
   * file that matched neither the baseline nor the pending write, and refused —
   * every save, on a project nothing external had ever touched. The user got
   * *"Not saved: App, Pages/Home changed on disk outside the editor"* on every
   * edit and lost the lot on reopen (Richard, 2026-09-06, on 0.2.2).
   *
   * ⚠️ **The guard is the DIRECTORY, not a flag someone must remember to set.**
   * A `clearBaselines()` call added to the create path would fix that path and
   * leave the next one to rediscover this; a baseline that knows which project it
   * describes cannot be stale for a different one.
   */
  private seededProjectDir: string | undefined;

  /**
   * Drops baselines that describe a different project, so a save is never diffed
   * against another project's files.
   *
   * ⚠️ **Absent is the safe state and that is what makes this correct rather than
   * merely convenient.** `findExternallyChanged` skips a path with no baseline —
   * *"the saver has never seen this path on disk, nothing to clobber"* — so
   * forgetting means the first save writes, which is what an editor that has just
   * created a project should do. It does NOT weaken REL-009a for the project
   * actually open: within one directory every baseline is still exact, and a real
   * external write is still caught.
   */
  private forgetBaselinesForOtherProject(projectDir: string): void {
    if (this.seededProjectDir === projectDir) return;
    this.saver.forgetBaselines();
    this.projectLevelHashes.clear();
    this.seededProjectDir = projectDir;
  }

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

    // Seed baselines so the first save only writes genuine edits, and record
    // WHICH project they describe — see `seededProjectDir`.
    this.saver.seedFromProject(project);
    this.seedProjectLevelHashes(project);
    this.seededProjectDir = projectDir;
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
    const { component } = await this.readComponentFromDisk(projectDir, componentPath);
    this.markComponentBaseline(componentPath, component);
    return component;
  }

  /**
   * Reads one component off disk, bypassing any stale cache, and reports it
   * alongside the two hashes a caller needs to decide what the change means —
   * **without advancing the save baseline.**
   *
   * REL-009b split this out of {@link reloadComponent} for one reason. The
   * watcher has to decide whether to apply a change *before* the baseline moves:
   * a reload refused because the human has unsaved edits must leave the baseline
   * describing the version the editor loaded, or REL-009a's `findExternallyChanged`
   * stops seeing the conflict and the very next autosave clobbers the file the
   * reload just declined to apply. Advancing the baseline and then refusing would
   * disarm the guard that makes the refusal worth anything.
   *
   * It also means the decision and the application share ONE read. Reading twice
   * — once to decide, once to apply — leaves a window in which the two reads
   * disagree, and the thing applied is not the thing that was judged.
   */
  async readComponentFromDisk(
    projectDir: string,
    componentPath: string
  ): Promise<{ component: LegacyComponent; diskHash: string; baselineHash: string | undefined }> {
    this.loader.invalidate(componentPath);
    const component = await this.loader.loadComponent(projectDir, componentPath);
    return {
      component,
      diskHash: hashComponent(component),
      baselineHash: this.saver.getDiskHash(componentPath)
    };
  }

  /**
   * Marks a component's on-disk baseline as matching `component`, so the local
   * autosave neither clobbers nor echoes an external change we have applied.
   * The apply half of {@link readComponentFromDisk}.
   */
  markComponentBaseline(componentPath: string, component: LegacyComponent): void {
    this.saver.noteExternalWrite(componentPath, component);
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  /**
   * Writes only the components (and project-level files) that changed since the
   * last load/save, atomically, with an incremental registry update.
   */
  async saveProject(projectDir: string, project: LegacyProject): Promise<SaveResult> {
    // Before anything is diffed: baselines describing some other project are not
    // evidence about this one. See `seededProjectDir`.
    this.forgetBaselinesForOtherProject(projectDir);

    const fullChangeSet = this.saver.getChangedComponents(project);

    // REL-009a arm C. `getChangedComponents` diffs memory against `diskHashes`,
    // which is a memory of what THIS editor last read or wrote — not a statement
    // about the file. When an agent writes a component underneath us, that
    // baseline is stale, and writing our copy over it is a silent last-writer-wins
    // with no conflict, no prompt and no diagnostic (measured 2026-09-03).
    // So: re-read the ones we are about to write and leave alone any whose file
    // has moved. Their baselines are untouched, so the next save retries.
    const refused = await this.findExternallyChanged(projectDir, fullChangeSet);
    const changeSet: ComponentChangeSet = {
      changed: fullChangeSet.changed.filter((c) => !refused.has(c.path)),
      removed: fullChangeSet.removed
    };

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
        removed: changeSet.removed,
        refused: refused.size > 0 ? [...refused].sort() : undefined
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

  /**
   * Of the components this save is about to write, which ones have moved on disk
   * since we last read or wrote them?
   *
   * The check is deliberately narrow. It re-reads **only** the components already
   * in the change set — usually one — so a save costs three extra file reads, not
   * a pass over the project. It compares the freshly-loaded content against the
   * saver's own baseline hash, which is the same quantity `getChangedComponents`
   * compares against, so a match means "the file is exactly what we last put
   * there" and a mismatch means someone else wrote it.
   *
   * A component that cannot be read is NOT reported: it is either new in this
   * editor (nothing on disk to overwrite) or unreadable, and in both cases
   * refusing the write would lose the user's edit to protect nothing.
   */
  private async findExternallyChanged(
    projectDir: string,
    changeSet: ComponentChangeSet
  ): Promise<Set<string>> {
    const moved = new Set<string>();

    for (const { path, component } of changeSet.changed) {
      const baseline = this.saver.getDiskHash(path);
      // No baseline means the saver has never seen this path on disk — a
      // component created in this editor since the load. Nothing to clobber.
      if (baseline === undefined) continue;

      try {
        this.loader.invalidate(path);
        const onDisk = hashComponent(await this.loader.loadComponent(projectDir, path));

        // Still exactly what we last put there: nobody else has written it.
        if (onDisk === baseline) continue;

        // 🔴 Or it is already exactly what this save would write. That is not an
        // external writer — it is US, one save ago, whose registry commit failed
        // and whose baselines were deliberately rewound so the retry would redo
        // the write (see `saveProject`'s rollback). Refusing here would strand
        // that retry forever and leave the registry stale, which the mid-save
        // rollback spec catches. Either way there is nothing to lose: the bytes
        // on disk and the bytes we would write are the same.
        if (onDisk === hashComponent(component)) continue;

        moved.add(path);
      } catch {
        // Unreadable or absent — see the note above.
      } finally {
        // Leave the cache as we found it. This read is a probe, and a save that
        // proceeds is about to make whatever it cached wrong.
        this.loader.invalidate(path);
      }
    }

    return moved;
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
