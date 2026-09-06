/**
 * STRUCT-006 — Component-Level Save (SUB-001)
 *
 * The single path by which per-component data leaves memory to disk. Writes a
 * component's three v2 files atomically (write-temp-then-rename), updates the
 * registry incrementally, and — critically — tracks the last-known on-disk
 * content of every component so it can answer "what actually changed?".
 *
 * Change detection & collab-safety
 * --------------------------------
 * The editor's autosave fires on *any* model change and has no idea which
 * component changed. Rather than intercept every mutation source (fragile,
 * easy to under-cover → silent data loss), the saver keeps a content hash per
 * component in `diskHashes`. On save it rewrites only components whose current
 * content differs from that hash.
 *
 * The hash excludes volatile fields (the `modified` timestamp), so re-saving an
 * unchanged component is a no-op and git diffs stay clean.
 *
 * This same map is the live-collab guard: when a peer's change is applied to a
 * component underneath us, the collab layer calls `noteExternalWrite(path, comp)`
 * so the local hash matches the new on-disk content. The next autosave then
 * neither clobbers the peer's change nor echoes it back in a loop.
 *
 * @module noodl-editor/services/ProjectStructure/ComponentSaver
 */

import type { RegistryV2File, RegistryComponentEntry } from '../../schemas';
import type { LegacyProject, LegacyComponent, LegacyNode } from '../../io/ProjectExporter';
import { buildComponentV2Files, legacyNameToPath, inferComponentType, countNodes } from '../../io/ProjectExporter';
import { ProjectStructureFilesystem, V2_FILES } from './types';

/** A component the saver has determined needs (re)writing. */
export interface ChangedComponent {
  /** Registry path (e.g. "Pages/Home"). */
  path: string;
  component: LegacyComponent;
}

/** The diff between in-memory project state and what the saver last saw on disk. */
export interface ComponentChangeSet {
  changed: ChangedComponent[];
  /** Registry paths present on disk (per diskHashes) but no longer in the project. */
  removed: string[];
}

export interface ComponentSaverOptions {
  writeDebounce?: number;
  now?: () => number;
}

// ─── Pure helpers ───────────────────────────────────────────────────────────

/** Deterministic JSON string with recursively sorted object keys. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  );
}

/** Fast, low-collision content hash (FNV-1a 32-bit, prefixed with length). */
export function hashString(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return `${str.length.toString(36)}:${h.toString(36)}`;
}

/**
 * Strips child x/y positions from a legacy component's node tree, mirroring the
 * legacy save path's `stripNodeChildPositions`. Child positions are recomputed
 * from root positions during layout, so persisting them only bloats diffs.
 * Returns a deep clone — the caller's object is not mutated.
 */
export function normalizeComponentForV2(component: LegacyComponent): LegacyComponent {
  const clone: LegacyComponent = JSON.parse(JSON.stringify(component));
  const recurse = (node: LegacyNode): void => {
    if (!node.children) return;
    for (const child of node.children) {
      delete child.x;
      delete child.y;
      recurse(child);
    }
  };
  clone.graph?.roots?.forEach(recurse);
  return clone;
}

/**
 * Content hash of a component, independent of key ordering and the volatile
 * `modified` timestamp. Two components with identical semantic content hash
 * equal regardless of how their fields were ordered in memory.
 */
export function hashComponent(component: LegacyComponent): string {
  const files = buildComponentV2Files(normalizeComponentForV2(component), '');
  // `modified` and `$schema` are non-semantic — exclude them from the hash.
  const { modified: _m, $schema: _s, ...componentFile } = files.component;
  const { $schema: _ns, ...nodesFile } = files.nodes;
  const { $schema: _cs, ...connectionsFile } = files.connections;
  return hashString(stableStringify([componentFile, nodesFile, connectionsFile]));
}

// ─── ComponentSaver ───────────────────────────────────────────────────────────

export class ComponentSaver {
  /** Registry path → content hash last known on disk. */
  private readonly diskHashes = new Map<string, string>();
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly writeDebounce: number;
  private readonly now: () => number;

  constructor(
    private readonly fs: ProjectStructureFilesystem,
    options: ComponentSaverOptions = {}
  ) {
    this.writeDebounce = options.writeDebounce ?? 500;
    this.now = options.now ?? (() => Date.now());
  }

  private nowIso(): string {
    return new Date(this.now()).toISOString();
  }

  // ── Baseline / collab hooks ─────────────────────────────────────────────────

  /**
   * Records the current project as the on-disk baseline. Call after a load (or a
   * full save) so subsequent diffs are relative to what is actually on disk.
   */
  seedFromProject(project: LegacyProject): void {
    this.diskHashes.clear();
    for (const component of project.components) {
      this.diskHashes.set(legacyNameToPath(component.name), hashComponent(component));
    }
  }

  /**
   * Marks a component's on-disk hash as matching the given content, without
   * writing. The collab / file-watch layer calls this after applying an external
   * change so the local autosave neither clobbers nor echoes it.
   */
  noteExternalWrite(componentPath: string, component: LegacyComponent): void {
    this.diskHashes.set(componentPath, hashComponent(component));
  }

  /** Test/observability: the baseline hash for a component path, if any. */
  getDiskHash(componentPath: string): string | undefined {
    return this.diskHashes.get(componentPath);
  }

  /**
   * Forgets every baseline, so the next save treats all components as unseen.
   *
   * ⚠️ **This is NOT `seedFromProject(emptyProject)` and the difference matters.**
   * Seeding says "disk looks like this"; forgetting says "I do not know what disk
   * looks like", and `findExternallyChanged` is built to treat the second as the
   * safe state — an absent baseline means nothing is clobbered, so the save
   * proceeds. Called when the baselines describe a different project than the one
   * being saved; see `ProjectStructureService.seededProjectDir`.
   */
  forgetBaselines(): void {
    this.diskHashes.clear();
  }

  /**
   * Snapshots the current baselines so a caller can roll back after a failed
   * multi-file save. Without this, a save that writes some component files then
   * fails on the registry would leave those components' baselines advanced — a
   * retry would see "no change" and never repair the stale registry.
   */
  snapshotBaselines(): Map<string, string> {
    return new Map(this.diskHashes);
  }

  /** Restores baselines captured by {@link snapshotBaselines}. */
  restoreBaselines(snapshot: Map<string, string>): void {
    this.diskHashes.clear();
    for (const [k, v] of snapshot) this.diskHashes.set(k, v);
  }

  // ── Change detection ─────────────────────────────────────────────────────────

  /** Diffs the in-memory project against the on-disk baseline. */
  getChangedComponents(project: LegacyProject): ComponentChangeSet {
    const changed: ChangedComponent[] = [];
    const seen = new Set<string>();

    for (const component of project.components) {
      const path = legacyNameToPath(component.name);
      seen.add(path);
      const hash = hashComponent(component);
      if (this.diskHashes.get(path) !== hash) {
        changed.push({ path, component });
      }
    }

    const removed: string[] = [];
    for (const path of this.diskHashes.keys()) {
      if (!seen.has(path)) removed.push(path);
    }

    return { changed, removed };
  }

  // ── Writing ────────────────────────────────────────────────────────────────

  /**
   * Writes a single component's three files atomically and updates its baseline
   * hash. Does NOT touch the registry — batch that via {@link updateRegistry}.
   */
  async saveComponent(projectPath: string, componentPath: string, component: LegacyComponent): Promise<void> {
    const normalized = normalizeComponentForV2(component);
    const files = buildComponentV2Files(normalized, this.nowIso());
    const componentDir = this.fs.join(projectPath, V2_FILES.componentsDir, componentPath);

    if (!this.fs.exists(componentDir)) {
      await this.fs.makeDirectory(componentDir);
    }

    // Two-phase write for per-component crash-safety: stage ALL three temp files
    // first, then rename them into place. If any staging write fails, nothing has
    // been renamed, so the component's existing files are untouched. Each rename
    // is atomic and each file stays independently valid JSON throughout.
    const staged = ([
      [V2_FILES.component, files.component],
      [V2_FILES.nodes, files.nodes],
      [V2_FILES.connections, files.connections]
    ] as Array<[string, unknown]>).map(([file, content]) => {
      const target = this.fs.join(componentDir, file);
      return { tmp: `${target}.tmp`, target, content };
    });

    try {
      for (const s of staged) {
        await this.fs.writeFile(s.tmp, JSON.stringify(s.content, null, 2));
      }
      for (const s of staged) {
        await this.fs.renameFile(s.tmp, s.target);
      }
    } catch (err) {
      // Best-effort cleanup of any temp files left behind.
      for (const s of staged) {
        try {
          await this.fs.removeFile(s.tmp);
        } catch {
          /* ignore */
        }
      }
      throw err;
    }

    // Baseline is the *normalized* content — that is what getChangedComponents hashes.
    this.diskHashes.set(componentPath, hashComponent(normalized));
  }

  /**
   * Debounced per-component save (STRUCT-006). Coalesces rapid edits to the same
   * component into a single write after `writeDebounce` ms of quiet.
   */
  saveComponentDebounced(projectPath: string, componentPath: string, component: LegacyComponent): void {
    const key = `${projectPath}:${componentPath}`;
    const existing = this.debounceTimers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      void this.saveComponent(projectPath, componentPath, component);
    }, this.writeDebounce);
    this.debounceTimers.set(key, timer);
  }

  /**
   * Applies a change set to the registry in a single atomic write: updates
   * entries for changed components, drops removed ones, recomputes stats.
   */
  async updateRegistry(projectPath: string, changeSet: ComponentChangeSet): Promise<void> {
    const registryPath = this.fs.join(projectPath, V2_FILES.registry);

    let registry: RegistryV2File;
    try {
      registry = await this.fs.readJson<RegistryV2File>(registryPath);
    } catch {
      registry = {
        $schema: 'https://opennoodl.dev/schemas/registry-v2.json',
        version: 1,
        components: {}
      };
    }
    if (!registry.components) registry.components = {};

    const iso = this.nowIso();

    for (const { path, component } of changeSet.changed) {
      const prev = registry.components[path];
      const entry: RegistryComponentEntry = {
        ...prev,
        path,
        type: prev?.type ?? inferComponentType(component.name),
        nodeCount: countNodes(component.graph?.roots ?? []),
        connectionCount: (component.graph?.connections ?? []).length,
        modified: iso
      };
      registry.components[path] = entry;
    }

    for (const path of changeSet.removed) {
      delete registry.components[path];
    }

    // Recompute stats across the whole (post-change) registry.
    const entries = Object.values(registry.components);
    registry.stats = {
      totalComponents: entries.length,
      totalNodes: entries.reduce((sum, e) => sum + (e.nodeCount ?? 0), 0),
      totalConnections: entries.reduce((sum, e) => sum + (e.connectionCount ?? 0), 0)
    };
    registry.lastUpdated = iso;

    await this.atomicWrite(registryPath, registry);
  }

  /**
   * Atomic JSON write of an arbitrary project-level file (nodegx.project.json,
   * routes, styles). Exposed so the orchestration service can reuse the same
   * write-temp-then-rename guarantee for non-component files.
   */
  async writeFileAtomic(path: string, content: unknown): Promise<void> {
    return this.atomicWrite(path, content);
  }

  /** Removes a component's on-disk directory and forgets its baseline hash. */
  async removeComponent(projectPath: string, componentPath: string): Promise<void> {
    const componentDir = this.fs.join(projectPath, V2_FILES.componentsDir, componentPath);
    if (this.fs.exists(componentDir)) {
      this.fs.removeDirRecursive(componentDir);
    }
    this.diskHashes.delete(componentPath);
  }

  /**
   * Atomic JSON write: serialise, write to a temp sibling, then rename over the
   * target. An interrupted write leaves either the old file or nothing — never a
   * half-written file. Rename is atomic on the same filesystem.
   */
  private async atomicWrite(targetPath: string, content: unknown): Promise<void> {
    const serialized = JSON.stringify(content, null, 2);
    const tmpPath = `${targetPath}.tmp`;
    await this.fs.writeFile(tmpPath, serialized);
    try {
      await this.fs.renameFile(tmpPath, targetPath);
    } catch (err) {
      // Best-effort cleanup of the temp file on rename failure.
      try {
        await this.fs.removeFile(tmpPath);
      } catch {
        /* ignore */
      }
      throw err;
    }
  }
}
