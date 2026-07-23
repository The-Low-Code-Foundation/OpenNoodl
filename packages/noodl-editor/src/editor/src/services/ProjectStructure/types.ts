/**
 * SUB-001 — Shared types for the v2 project-structure services.
 *
 * The loader/saver/service all take an injectable filesystem so they can be
 * unit-tested against an in-memory double without the Electron platform
 * singleton (mirroring how ProjectFormatDetector takes a DetectorFilesystem).
 * The platform `filesystem` from `@noodl/platform` satisfies this interface.
 *
 * @module noodl-editor/services/ProjectStructure/types
 */

/**
 * The subset of the platform filesystem the v2 services depend on.
 * `@noodl/platform`'s `filesystem` implements all of these.
 */
export interface ProjectStructureFilesystem {
  join(...parts: string[]): string;
  dirname(path: string): string;
  /** Sync existence check (platform impl is synchronous). */
  exists(path: string): boolean;
  readJson<T = unknown>(path: string): Promise<T>;
  /** Writes a UTF-8 string (or Buffer) to disk. */
  writeFile(path: string, content: string): Promise<void>;
  renameFile(oldPath: string, newPath: string): Promise<void>;
  removeFile(path: string): Promise<void>;
  makeDirectory(path: string): Promise<void>;
  removeDirRecursive(path: string): void;
}

/** Standard v2 filenames, relative to a component directory / project root. */
export const V2_FILES = {
  project: 'nodegx.project.json',
  routes: 'nodegx.routes.json',
  styles: 'nodegx.styles.json',
  componentsDir: 'components',
  registry: 'components/_registry.json',
  component: 'component.json',
  nodes: 'nodes.json',
  connections: 'connections.json'
} as const;
