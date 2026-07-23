/**
 * STRUCT-005 — Lazy Component Loading (SUB-001)
 *
 * The single path by which per-component data enters memory from disk. Reads a
 * component's three v2 files (component.json / nodes.json / connections.json)
 * and reconstructs the legacy in-memory component shape via the shared
 * ProjectImporter reconstruction helper.
 *
 * Design notes
 * ------------
 * - Per-path cache keyed by `<projectPath>:<componentPath>`, with a TTL and an
 *   LRU size cap (STRUCT-005: ~5 min TTL, ~50 components).
 * - `invalidate(path)` drops a cached component so the next load re-reads disk.
 *   This is the seam a future live-collab / file-watch layer calls when a peer
 *   changes a component underneath us — the component is the atomic unit of
 *   load *and* invalidation.
 * - Pure w.r.t. reconstruction (delegates to reconstructLegacyComponent); the
 *   only side effect is reading files through the injected filesystem.
 *
 * @module noodl-editor/services/ProjectStructure/ComponentLoader
 */

import type {
  ComponentV2File,
  NodesV2File,
  ConnectionsV2File
} from '../../schemas';
import type { LegacyComponent } from '../../io/ProjectExporter';
import { reconstructLegacyComponent } from '../../io/ProjectImporter';
import { ProjectStructureFilesystem, V2_FILES } from './types';

interface CacheEntry {
  component: LegacyComponent;
  loadedAt: number;
}

export interface ComponentLoaderOptions {
  /** Max age of a cache entry before it is considered stale (ms). */
  maxCacheAge?: number;
  /** Max number of components held in the cache. */
  maxCacheSize?: number;
  /** Injectable clock, for deterministic tests. Defaults to Date.now. */
  now?: () => number;
}

export class ComponentLoader {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxCacheAge: number;
  private readonly maxCacheSize: number;
  private readonly now: () => number;

  constructor(
    private readonly fs: ProjectStructureFilesystem,
    options: ComponentLoaderOptions = {}
  ) {
    this.maxCacheAge = options.maxCacheAge ?? 5 * 60 * 1000; // 5 minutes
    this.maxCacheSize = options.maxCacheSize ?? 50;
    this.now = options.now ?? (() => Date.now());
  }

  private cacheKey(projectPath: string, componentPath: string): string {
    return `${projectPath}:${componentPath}`;
  }

  /**
   * Loads a single component from disk (or returns a fresh cache hit).
   *
   * @param projectPath  Absolute path to the project root.
   * @param componentPath Registry path of the component (e.g. "Pages/Home").
   */
  async loadComponent(projectPath: string, componentPath: string): Promise<LegacyComponent> {
    const key = this.cacheKey(projectPath, componentPath);

    const cached = this.cache.get(key);
    if (cached && this.now() - cached.loadedAt < this.maxCacheAge) {
      return cached.component;
    }

    const componentDir = this.fs.join(projectPath, V2_FILES.componentsDir, componentPath);

    const [componentFile, nodesFile, connectionsFile] = await Promise.all([
      this.fs.readJson<ComponentV2File>(this.fs.join(componentDir, V2_FILES.component)),
      this.fs.readJson<NodesV2File>(this.fs.join(componentDir, V2_FILES.nodes)),
      this.fs.readJson<ConnectionsV2File>(this.fs.join(componentDir, V2_FILES.connections))
    ]);

    const component = reconstructLegacyComponent(
      componentPath,
      componentFile,
      nodesFile,
      connectionsFile
    );

    this.cache.set(key, { component, loadedAt: this.now() });
    this.pruneCache();

    return component;
  }

  /**
   * Warms the cache for a set of components in parallel. Used at project open to
   * materialise the whole project (the "load-all" path), and by future collab to
   * pre-fetch components a peer is about to touch.
   */
  async preloadComponents(projectPath: string, componentPaths: string[]): Promise<LegacyComponent[]> {
    return Promise.all(componentPaths.map((p) => this.loadComponent(projectPath, p)));
  }

  /**
   * Drops cache entries. With a componentPath, drops just that component (across
   * any project); with no argument, clears everything.
   *
   * The single-component form is the live-collab / file-watch invalidation seam.
   */
  invalidate(componentPath?: string): void {
    if (componentPath === undefined) {
      this.cache.clear();
      return;
    }
    const suffix = `:${componentPath}`;
    for (const key of Array.from(this.cache.keys())) {
      if (key.endsWith(suffix)) {
        this.cache.delete(key);
      }
    }
  }

  /** Number of components currently cached (test/observability helper). */
  get cacheSize(): number {
    return this.cache.size;
  }

  private pruneCache(): void {
    if (this.cache.size <= this.maxCacheSize) return;

    // Evict oldest (by loadedAt) until within the cap. Map iteration order is
    // insertion order; sort by loadedAt to evict the least-recently-loaded.
    const entries = Array.from(this.cache.entries()).sort((a, b) => a[1].loadedAt - b[1].loadedAt);
    const removeCount = this.cache.size - this.maxCacheSize;
    for (let i = 0; i < removeCount; i++) {
      this.cache.delete(entries[i][0]);
    }
  }
}
