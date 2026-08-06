/**
 * File-based access to a v2 project directory.
 *
 * Concurrency model (see docs/DESIGN.md): optimistic. Every read snapshots
 * file stats and computes a content `revision`; writes re-check both before
 * touching disk and refuse on drift (an open editor autosaving, git checkout,
 * a second agent). All writes are temp-file + atomic rename; validation
 * happens before any file is created, so a rejected write leaves no trace.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import type {
  ComponentV2File,
  ConnectionsV2File,
  NodesV2File,
  NormProject,
  ProjectV2File,
  RegistryComponentEntry,
  RegistryV2File,
  RoutesV2File,
  StylesV2File
} from '../editor-deps';
import { buildComponentRefs, isComponentRef, normalizeV2Component, refToPath } from '../editor-deps';
import { ToolError } from '../errors';
import type { ComponentFiles } from '../graph';
import { toPathForm } from '../paths';

const COMPONENT_FILES = ['component.json', 'nodes.json', 'connections.json'] as const;

interface FileStat {
  mtimeMs: number;
  size: number;
}

interface Snapshot {
  stats: Record<string, FileStat | null>; // abs path → stat (null = absent at read time)
  revision: string;
}

export interface StoredComponent {
  /** Registry key (canonical path form). */
  key: string;
  entry: RegistryComponentEntry;
  legacyName: string;
  files: ComponentFiles;
  revision: string;
}

export interface ComponentListRow {
  path: string;
  legacyName: string;
  type: string;
  nodeCount: number;
  connectionCount: number;
  description?: string;
}

export interface Usage {
  component: string; // path form
  legacyName: string;
  nodeId: string;
}

function readJson<T>(file: string): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch (err) {
    throw new ToolError('io-error', `Failed to read ${file}: ${(err as Error).message}`);
  }
}

function statOrNull(file: string): FileStat | null {
  try {
    const s = fs.statSync(file);
    return { mtimeMs: s.mtimeMs, size: s.size };
  } catch {
    return null;
  }
}

function sameStat(a: FileStat | null, b: FileStat | null): boolean {
  if (a === null || b === null) return a === b;
  return a.mtimeMs === b.mtimeMs && a.size === b.size;
}

function writeJsonAtomic(file: string, data: unknown): void {
  const tmp = `${file}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

export function computeRevision(files: ComponentFiles): string {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify([files.component, files.nodes, files.connections]))
    .digest('hex')
    .slice(0, 12);
}

export class ProjectStore {
  readonly projectDir: string;
  private snapshots = new Map<string, Snapshot>();

  /**
   * ⚠️ **The two refusal messages below are mirrored in the editor**, in
   * `packages/noodl-editor/src/main/src/mcp/mcpFrontDoor.js` (MCP-001). That is what lets the
   * "Connect an AI agent" settings section withhold the copy button for exactly the projects this
   * constructor would reject, saying the same thing — rather than emitting a command that dies at
   * spawn time. The editor cannot import this module (`@noodl/mcp` is not one of its
   * dependencies), so if you change the wording here, change it there too.
   */
  constructor(projectDir: string) {
    this.projectDir = path.resolve(projectDir);
    if (!fs.existsSync(this.projectDir) || !fs.statSync(this.projectDir).isDirectory()) {
      throw new ToolError('not-found', `Project directory does not exist: ${this.projectDir}`);
    }
    const isV2 =
      fs.existsSync(path.join(this.projectDir, 'components', '_registry.json')) ||
      fs.existsSync(path.join(this.projectDir, 'nodegx.project.json'));
    if (!isV2) {
      const legacy = fs.existsSync(path.join(this.projectDir, 'project.json'));
      throw new ToolError(
        'not-a-v2-project',
        legacy
          ? `${this.projectDir} holds a legacy monolithic project.json. Migrate it to the v2 format ` +
            `(NodeGX editor: project settings → migrate) before using the MCP server.`
          : `${this.projectDir} is not a NodeGX v2 project (no nodegx.project.json or components/_registry.json).`
      );
    }
  }

  // ─── Project-level files ────────────────────────────────────────────────────

  readProjectFile(): ProjectV2File | undefined {
    const p = path.join(this.projectDir, 'nodegx.project.json');
    return fs.existsSync(p) ? readJson<ProjectV2File>(p) : undefined;
  }

  private get projectFilePath(): string {
    return path.join(this.projectDir, 'nodegx.project.json');
  }

  /**
   * AIX-006: the project's design-token metadata (`{ getMetaData }` shim for the
   * editor's ProjectTokenCss helpers). Tokens live under
   * `nodegx.project.json → metadata.designTokens`; the importer restores that
   * block into `ProjectModel` metadata, so what the editor reads back is exactly
   * what is written here.
   */
  designTokenMetaSource(): { getMetaData(key: string): unknown } {
    const project = this.readProjectFile() as (ProjectV2File & { metadata?: Record<string, unknown> }) | undefined;
    const metadata = project?.metadata ?? {};
    return { getMetaData: (key: string) => metadata[key] };
  }

  /**
   * Persist the design-token override block under
   * `nodegx.project.json → metadata.designTokens`. Atomic; creates the project
   * file's metadata bag if absent. Passing `null` clears the overrides.
   */
  writeDesignTokens(key: string, data: unknown): void {
    const p = this.projectFilePath;
    if (!fs.existsSync(p)) {
      throw new ToolError('not-found', `Missing nodegx.project.json in ${this.projectDir}; cannot store tokens.`);
    }
    const project = readJson<ProjectV2File & { metadata?: Record<string, unknown> }>(p);
    const metadata = { ...(project.metadata ?? {}) };
    if (data === null || data === undefined) {
      delete metadata[key];
    } else {
      metadata[key] = data;
    }
    writeJsonAtomic(p, { ...project, metadata });
  }

  /**
   * AAQ-005 — write project settings, **never overwriting one already set**.
   *
   * Returns the names actually written. The non-overwriting rule is the editor's
   * (`planStaging.applySettings`) and carries its reasoning: a plan states what a
   * *new* app needs, not what an existing one should have chosen. `bodyScroll`
   * defaults to unset-and-falsy, so "the project has not decided" and "the
   * project chose `app`" are the same state on disk — which means the only safe
   * reading of an absent value is that nobody chose, and the only safe treatment
   * of a present one is to leave it alone.
   */
  writeProjectSettings(settings: Record<string, unknown>): string[] {
    const p = this.projectFilePath;
    if (!fs.existsSync(p)) {
      throw new ToolError('not-found', `Missing nodegx.project.json in ${this.projectDir}; cannot store settings.`);
    }
    const project = readJson<ProjectV2File>(p);
    const current: Record<string, unknown> = { ...(project.settings ?? {}) };
    const written: string[] = [];
    for (const [name, value] of Object.entries(settings)) {
      if (value === undefined) continue;
      if (current[name] !== undefined) continue;
      current[name] = value;
      written.push(name);
    }
    if (written.length === 0) return [];
    writeJsonAtomic(p, { ...project, settings: current, modified: new Date().toISOString() });
    return written;
  }

  readRoutes(): RoutesV2File | undefined {
    const p = path.join(this.projectDir, 'nodegx.routes.json');
    return fs.existsSync(p) ? readJson<RoutesV2File>(p) : undefined;
  }

  readStyles(): StylesV2File | undefined {
    const p = path.join(this.projectDir, 'nodegx.styles.json');
    return fs.existsSync(p) ? readJson<StylesV2File>(p) : undefined;
  }

  private get componentsDir(): string {
    return path.join(this.projectDir, 'components');
  }

  private get registryFile(): string {
    return path.join(this.componentsDir, '_registry.json');
  }

  readRegistry(): RegistryV2File {
    if (!fs.existsSync(this.registryFile)) {
      throw new ToolError('io-error', `Missing components/_registry.json in ${this.projectDir}.`);
    }
    return readJson<RegistryV2File>(this.registryFile);
  }

  // ─── Resolution ─────────────────────────────────────────────────────────────

  /** Resolve any accepted identifier ("Pages/Home", "/Pages/Home", "/#Card") to a registry entry. */
  resolve(input: string): { key: string; entry: RegistryComponentEntry } | undefined {
    const registry = this.readRegistry();
    const p = toPathForm(input);
    if (registry.components[p]) return { key: p, entry: registry.components[p] };
    for (const [key, entry] of Object.entries(registry.components)) {
      if (entry.path === p || key === input || entry.path === input) return { key, entry };
    }
    return undefined;
  }

  private mustResolve(input: string): { key: string; entry: RegistryComponentEntry } {
    const hit = this.resolve(input);
    if (!hit) {
      const known = Object.keys(this.readRegistry().components).sort();
      throw new ToolError('not-found', `No component "${input}" in this project.`, { knownComponents: known });
    }
    return hit;
  }

  componentDir(entry: RegistryComponentEntry): string {
    return path.join(this.componentsDir, entry.path);
  }

  // ─── Reads ──────────────────────────────────────────────────────────────────

  private readComponentFiles(dir: string, key: string): ComponentFiles {
    const componentPath = path.join(dir, 'component.json');
    const component = fs.existsSync(componentPath)
      ? readJson<ComponentV2File>(componentPath)
      : ({ id: key, name: key.split('/').pop() ?? key, type: 'visual' } as ComponentV2File);
    const nodesPath = path.join(dir, 'nodes.json');
    const nodes = fs.existsSync(nodesPath)
      ? readJson<NodesV2File>(nodesPath)
      : ({ componentId: component.id, nodes: [] } as NodesV2File);
    const connectionsPath = path.join(dir, 'connections.json');
    const connections = fs.existsSync(connectionsPath)
      ? readJson<ConnectionsV2File>(connectionsPath)
      : ({ componentId: component.id, connections: [] } as ConnectionsV2File);
    return { component, nodes, connections };
  }

  private takeSnapshot(key: string, dir: string, files: ComponentFiles): string {
    const stats: Record<string, FileStat | null> = {};
    for (const f of COMPONENT_FILES) {
      const abs = path.join(dir, f);
      stats[abs] = statOrNull(abs);
    }
    const revision = computeRevision(files);
    this.snapshots.set(key, { stats, revision });
    return revision;
  }

  readComponent(input: string): StoredComponent {
    const { key, entry } = this.mustResolve(input);
    const dir = this.componentDir(entry);
    const files = this.readComponentFiles(dir, key);
    const revision = this.takeSnapshot(key, dir, files);
    return {
      key,
      entry,
      legacyName: files.component.path ?? '/' + key,
      files,
      revision
    };
  }

  listComponents(): ComponentListRow[] {
    const registry = this.readRegistry();
    const rows: ComponentListRow[] = [];
    for (const [key, entry] of Object.entries(registry.components)) {
      const dir = this.componentDir(entry);
      const componentJson = path.join(dir, 'component.json');
      let legacyName = '/' + key;
      let description: string | undefined;
      let type: string = entry.type;
      if (fs.existsSync(componentJson)) {
        const c = readJson<ComponentV2File>(componentJson);
        if (c.path) legacyName = c.path;
        if (c.description) description = c.description;
        if (c.type) type = c.type;
      }
      let nodeCount = entry.nodeCount;
      let connectionCount = entry.connectionCount;
      if (nodeCount === undefined || connectionCount === undefined) {
        const files = this.readComponentFiles(dir, key);
        nodeCount = files.nodes.nodes.length;
        connectionCount = files.connections.connections.length;
      }
      rows.push({
        path: key,
        legacyName,
        type,
        nodeCount,
        connectionCount,
        ...(description ? { description } : {})
      });
    }
    rows.sort((a, b) => (a.path < b.path ? -1 : 1));
    return rows;
  }

  // ─── Normalized model for validation ────────────────────────────────────────

  /**
   * Build the validator's NormProject from disk, optionally substituting a
   * candidate component (create/update) or omitting one (delete). Mirrors
   * loadV2Directory but works on in-memory candidates before anything is
   * written.
   */
  buildNormProject(options: { replace?: { key: string; files: ComponentFiles }; remove?: string } = {}): NormProject {
    const registry = this.readRegistry();
    const components: NormProject['components'] = [];
    const refNames = new Set<string>();

    for (const [key, entry] of Object.entries(registry.components)) {
      if (options.remove !== undefined && key === options.remove) continue;
      let files: ComponentFiles;
      if (options.replace && options.replace.key === key) {
        files = options.replace.files;
      } else {
        files = this.readComponentFiles(this.componentDir(entry), key);
      }
      const name = files.component.path ?? key;
      components.push(normalizeV2Component(name, files.nodes, files.connections));
      refNames.add(name);
      refNames.add(key);
      refNames.add(entry.path);
    }

    // A brand-new component (not yet in the registry).
    if (options.replace && !registry.components[options.replace.key]) {
      const files = options.replace.files;
      const name = files.component.path ?? options.replace.key;
      components.push(normalizeV2Component(name, files.nodes, files.connections));
      refNames.add(name);
      refNames.add(options.replace.key);
    }

    return { components, componentRefs: buildComponentRefs([...refNames]) };
  }

  /** All places where a component is instantiated as a node. */
  findUsages(target: string): Usage[] {
    const targetPath = toPathForm(target);
    const usages: Usage[] = [];
    const registry = this.readRegistry();
    for (const [key, entry] of Object.entries(registry.components)) {
      const files = this.readComponentFiles(this.componentDir(entry), key);
      for (const node of files.nodes.nodes) {
        if (typeof node.type === 'string' && isComponentRef(node.type) && refToPath(node.type) === targetPath) {
          usages.push({ component: key, legacyName: files.component.path ?? '/' + key, nodeId: node.id });
        }
      }
    }
    return usages;
  }

  // ─── Writes ─────────────────────────────────────────────────────────────────

  private assertNoDrift(key: string, dir: string, ifRevision?: string): void {
    const snapshot = this.snapshots.get(key);
    if (snapshot) {
      for (const [abs, oldStat] of Object.entries(snapshot.stats)) {
        if (!sameStat(oldStat, statOrNull(abs))) {
          throw new ToolError(
            'conflict',
            `${path.relative(this.projectDir, abs)} changed on disk since this server last read it ` +
              `(open editor? another process?). Re-read the component (get_component) and retry.`,
            { component: key }
          );
        }
      }
    }
    if (ifRevision !== undefined) {
      const current = computeRevision(this.readComponentFiles(dir, key));
      if (current !== ifRevision) {
        throw new ToolError(
          'conflict',
          `Revision mismatch for "${key}": expected ${ifRevision}, disk has ${current}. ` +
            `Re-read the component (get_component) and retry with the fresh revision.`,
          { component: key, expected: ifRevision, actual: current }
        );
      }
    }
  }

  /** Write a component (create or update) and maintain the registry. Assumes validation already passed. */
  writeComponent(
    key: string,
    files: ComponentFiles,
    options: { expectNew?: boolean; ifRevision?: string } = {}
  ): { revision: string; dir: string } {
    const registry = this.readRegistry();
    const existing = registry.components[key];

    if (options.expectNew && existing) {
      throw new ToolError('already-exists', `Component "${key}" already exists. Use update_component instead.`);
    }
    if (!options.expectNew && !existing) {
      throw new ToolError('not-found', `Component "${key}" does not exist. Use create_component instead.`);
    }

    const entryPath = existing?.path ?? key;
    const dir = path.join(this.componentsDir, entryPath);

    if (existing) {
      this.assertNoDrift(key, dir, options.ifRevision);
    } else if (COMPONENT_FILES.some((f) => fs.existsSync(path.join(dir, f)))) {
      throw new ToolError(
        'conflict',
        `Directory components/${entryPath} already holds component files but is not in the registry. Refusing to overwrite.`
      );
    }

    fs.mkdirSync(dir, { recursive: true });
    writeJsonAtomic(path.join(dir, 'component.json'), files.component);
    writeJsonAtomic(path.join(dir, 'nodes.json'), files.nodes);
    writeJsonAtomic(path.join(dir, 'connections.json'), files.connections);

    // Registry maintenance.
    const now = new Date().toISOString();
    const entry: RegistryComponentEntry = {
      path: entryPath,
      type: files.component.type,
      nodeCount: files.nodes.nodes.length,
      connectionCount: files.connections.connections.length,
      modified: now,
      ...(existing?.created ? { created: existing.created } : { created: now }),
      ...(existing?.route ? { route: existing.route } : {})
    };
    registry.components[key] = entry;
    this.updateRegistry(registry, now);

    const revision = this.takeSnapshot(key, dir, files);
    return { revision, dir };
  }

  deleteComponent(input: string): { removed: string[] } {
    const { key, entry } = this.mustResolve(input);
    const dir = this.componentDir(entry);
    this.assertNoDrift(key, dir);

    const removed: string[] = [];
    for (const f of COMPONENT_FILES) {
      const abs = path.join(dir, f);
      if (fs.existsSync(abs)) {
        fs.unlinkSync(abs);
        removed.push(path.relative(this.projectDir, abs));
      }
    }
    // Remove the directory only when empty — nested component directories may
    // live beneath it (e.g. deleting "Pages" must not touch "Pages/Home").
    try {
      if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
    } catch {
      /* directory already gone or not empty — fine */
    }

    const registry = this.readRegistry();
    delete registry.components[key];
    this.updateRegistry(registry, new Date().toISOString());
    this.snapshots.delete(key);
    return { removed };
  }

  private updateRegistry(registry: RegistryV2File, now: string): void {
    let totalNodes = 0;
    let totalConnections = 0;
    const entries = Object.values(registry.components);
    for (const e of entries) {
      totalNodes += e.nodeCount ?? 0;
      totalConnections += e.connectionCount ?? 0;
    }
    registry.lastUpdated = now;
    registry.stats = {
      totalComponents: entries.length,
      totalNodes,
      totalConnections
    };
    writeJsonAtomic(this.registryFile, registry);
  }
}
