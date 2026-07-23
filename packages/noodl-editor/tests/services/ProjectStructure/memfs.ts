/**
 * In-memory filesystem double for the ProjectStructure service tests.
 * Implements the injectable ProjectStructureFilesystem surface so loader/saver/
 * service can be exercised with no real disk access.
 */
import type { ProjectStructureFilesystem } from '../../../src/editor/src/services/ProjectStructure/types';

export class MemFs implements ProjectStructureFilesystem {
  /** path → serialized file content */
  readonly files = new Map<string, string>();
  /** explicitly created directories */
  readonly dirs = new Set<string>();
  /** optional fault injection: throw on the next write/rename to this path */
  failOn: { op: 'write' | 'rename'; path: string } | null = null;

  private norm(p: string): string {
    return p.replace(/\/+/g, '/');
  }

  join(...parts: string[]): string {
    return this.norm(parts.join('/'));
  }

  dirname(p: string): string {
    const n = this.norm(p);
    const idx = n.lastIndexOf('/');
    return idx <= 0 ? '/' : n.slice(0, idx);
  }

  exists(p: string): boolean {
    const n = this.norm(p);
    if (this.files.has(n) || this.dirs.has(n)) return true;
    // A path with descendant files is an existing directory.
    const prefix = n.endsWith('/') ? n : n + '/';
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) return true;
    }
    return false;
  }

  async readJson<T = unknown>(p: string): Promise<T> {
    const n = this.norm(p);
    if (!this.files.has(n)) throw new Error('ENOENT: ' + n);
    return JSON.parse(this.files.get(n)!) as T;
  }

  async writeFile(p: string, content: string): Promise<void> {
    const n = this.norm(p);
    if (this.failOn && this.failOn.op === 'write' && this.failOn.path === n) {
      this.failOn = null;
      throw new Error('Injected write failure: ' + n);
    }
    this.files.set(n, content);
    this.dirs.add(this.dirname(n));
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    const from = this.norm(oldPath);
    const to = this.norm(newPath);
    if (this.failOn && this.failOn.op === 'rename' && this.failOn.path === to) {
      this.failOn = null;
      throw new Error('Injected rename failure: ' + to);
    }
    if (!this.files.has(from)) throw new Error('ENOENT: ' + from);
    this.files.set(to, this.files.get(from)!);
    this.files.delete(from);
  }

  async removeFile(p: string): Promise<void> {
    this.files.delete(this.norm(p));
  }

  async makeDirectory(p: string): Promise<void> {
    this.dirs.add(this.norm(p));
  }

  removeDirRecursive(p: string): void {
    const n = this.norm(p);
    const prefix = n + '/';
    for (const key of Array.from(this.files.keys())) {
      if (key === n || key.startsWith(prefix)) this.files.delete(key);
    }
    for (const key of Array.from(this.dirs)) {
      if (key === n || key.startsWith(prefix)) this.dirs.delete(key);
    }
  }

  /** Test helper: list every file path currently present. */
  paths(): string[] {
    return Array.from(this.files.keys()).sort();
  }

  /** Test helper: paths under a directory prefix. */
  pathsUnder(dir: string): string[] {
    const prefix = this.norm(dir) + '/';
    return this.paths().filter((p) => p.startsWith(prefix));
  }
}
