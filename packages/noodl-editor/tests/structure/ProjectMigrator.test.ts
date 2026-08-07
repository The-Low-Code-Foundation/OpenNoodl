/**
 * SUB-003 / STRUCT-008 — Migration engine validation suite.
 *
 * Migration is the point of maximum risk in the format programme: it rewrites a
 * user's existing project on disk. This suite exists to prove one thing above all
 * others — **the original project is never damaged** — across the full range of
 * inputs the wizard will meet in the wild:
 *
 *   - real projects, including one at 176 components (scale)
 *   - cloud-function components (the `__cloud__/` path mapping)
 *   - deliberately corrupted / truncated project files
 *   - a migration interrupted mid-write (simulated process kill)
 *   - a deliberately-lossy converter (proves verification aborts on a fidelity fault)
 *
 * The migrator takes an injectable filesystem, so the whole backup / write /
 * verify / rollback machinery runs against an in-memory double here — no disk,
 * fully deterministic, and able to simulate a crash at an exact write.
 *
 * Uses Jasmine matchers (the editor's Electron test runner).
 *
 * @see packages/noodl-editor/src/editor/src/services/ProjectStructure/ProjectMigrator.ts
 * @see dev-docs/tasks/phase-13-format-ai-substrate/SUB-003-MIGRATION-AND-REAL-TESTS.md
 */

import {
  ProjectMigrator,
  stripEmpty,
  canonicalEqual,
  firstDifference,
  type MigratorFilesystem
} from '../../src/editor/src/services/ProjectStructure/ProjectMigrator';
import { ProjectExporter, type LegacyProject } from '../../src/editor/src/io/ProjectExporter';
import { ProjectFormatDetector } from '../../src/editor/src/io/ProjectFormatDetector';

/* eslint-disable @typescript-eslint/no-var-requires */
const trivial = require('../testfs/import_proj2/project.json') as LegacyProject; // {id,name,components,version}
const rootNode = require('../testfs/import_proj1/project.json') as LegacyProject; // rootNodeId + variants
const thumbnail = require('../testfs/watchproject/project.json') as LegacyProject; // thumbnailURI
const variantsStyles = require('../testfs/import_proj5/project.json') as LegacyProject; // variants + styles
const commentsLarge = require('../testfs/git-repo-utf8/project.json') as LegacyProject; // 44 comps, comments
const xlarge = require('../testfs/big-merge-test-mine/project.json') as LegacyProject; // 176 comps
const syntheticAwkward = require('../io/fixtures/synthetic-awkward.project.json') as LegacyProject;
/* eslint-enable @typescript-eslint/no-var-requires */

// ── In-memory filesystem double ────────────────────────────────────────────────

/**
 * A minimal in-memory filesystem implementing the surface the migrator needs.
 * Files and directories live in maps keyed by POSIX-style absolute paths. It can
 * simulate a crash by throwing on the Nth `writeFile`, and it records every
 * `removeFile` so a test can assert the legacy project file was (or was not)
 * removed.
 */
class MemFs implements MigratorFilesystem {
  files = new Map<string, string>();
  dirs = new Set<string>();
  writeCount = 0;
  /** When set, the (failAfterWrites+1)-th writeFile throws — simulates a kill. */
  failAfterWrites: number | null = null;
  removedFiles: string[] = [];

  join(...parts: string[]): string {
    return parts.filter((p) => p !== undefined && p !== null && p !== '').join('/').replace(/\/+/g, '/');
  }
  dirname(path: string): string {
    const i = path.lastIndexOf('/');
    return i <= 0 ? '/' : path.slice(0, i);
  }
  basename(path: string): string {
    const i = path.lastIndexOf('/');
    return path.slice(i + 1);
  }
  exists(path: string): boolean {
    if (this.files.has(path) || this.dirs.has(path)) return true;
    const prefix = path.endsWith('/') ? path : path + '/';
    for (const k of this.files.keys()) if (k.startsWith(prefix)) return true;
    for (const k of this.dirs) if (k.startsWith(prefix)) return true;
    return false;
  }
  async readJson<T = unknown>(path: string): Promise<T> {
    if (!this.files.has(path)) throw new Error(`ENOENT: ${path}`);
    return JSON.parse(this.files.get(path)!) as T; // throws on truncated/invalid JSON
  }
  async writeFile(path: string, content: string): Promise<void> {
    this.writeCount++;
    if (this.failAfterWrites !== null && this.writeCount > this.failAfterWrites) {
      throw new Error(`simulated interruption at write #${this.writeCount} (${path})`);
    }
    this.ensureDir(this.dirname(path));
    this.files.set(path, content);
  }
  async renameFile(oldPath: string, newPath: string): Promise<void> {
    if (!this.files.has(oldPath)) throw new Error(`ENOENT: ${oldPath}`);
    this.files.set(newPath, this.files.get(oldPath)!);
    this.files.delete(oldPath);
  }
  async removeFile(path: string): Promise<void> {
    this.removedFiles.push(path);
    this.files.delete(path);
  }
  async makeDirectory(path: string): Promise<void> {
    this.ensureDir(path);
  }
  removeDirRecursive(path: string): void {
    const prefix = path + '/';
    for (const k of [...this.files.keys()]) if (k === path || k.startsWith(prefix)) this.files.delete(k);
    for (const k of [...this.dirs]) if (k === path || k.startsWith(prefix)) this.dirs.delete(k);
  }
  async copyFolder(from: string, to: string): Promise<void> {
    this.ensureDir(to);
    const prefix = from + '/';
    for (const [k, v] of this.files) {
      if (k === from || k.startsWith(prefix)) {
        const dest = to + k.slice(from.length);
        this.ensureDir(this.dirname(dest));
        this.files.set(dest, v);
      }
    }
    for (const d of [...this.dirs]) {
      if (d.startsWith(prefix)) this.ensureDir(to + d.slice(from.length));
    }
  }
  makeUniquePath(path: string): string {
    if (!this.exists(path)) return path;
    let n = 1;
    while (this.exists(`${path}-${n}`)) n++;
    return `${path}-${n}`;
  }

  // — test helpers —
  ensureDir(path: string): void {
    let p = path;
    while (p && p !== '/' && !this.dirs.has(p)) {
      this.dirs.add(p);
      p = this.dirname(p);
    }
  }
  seedLegacyProject(dir: string, project: unknown): void {
    this.ensureDir(dir);
    this.files.set(this.join(dir, 'project.json'), JSON.stringify(project, null, 2));
  }
  listUnder(dir: string): string[] {
    const prefix = dir + '/';
    return [...this.files.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
}

function detectorFor(fs: MemFs) {
  return new ProjectFormatDetector({ exists: (p: string) => fs.exists(p), join: (...a: string[]) => fs.join(...a) });
}

const PROJ = '/workspace/project';

// ── Verification helpers (unit) ─────────────────────────────────────────────────

describe('SUB-003 — verification helpers', () => {
  it('stripEmpty removes empty collections but keeps falsy primitives', () => {
    const input = { a: {}, b: [], c: 0, d: false, e: '', f: null, g: { h: 1, i: {} } };
    expect(stripEmpty(input)).toEqual({ c: 0, d: false, e: '', f: null, g: { h: 1 } } as any);
  });

  it('canonicalEqual is order-insensitive', () => {
    expect(canonicalEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(canonicalEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('firstDifference points at the diverging path (or null when equal)', () => {
    expect(firstDifference({ a: { b: [1, 2, 3] } }, { a: { b: [1, 2, 3] } })).toBeNull();
    expect(firstDifference({ a: { b: [1, 2, 3] } }, { a: { b: [1, 9, 3] } })).toBe('a.b[1]');
    expect(firstDifference({ a: 1 }, { a: 1, b: 2 })).toBe('b (missing on left)');
  });
});

// ── Step 1: backup & rollback (proven first, before anything else runs) ──────────

describe('SUB-003 — backup & rollback', () => {
  it('takes a full backup containing the original project before migrating', async () => {
    const fs = new MemFs();
    fs.seedLegacyProject(PROJ, trivial);
    const migrator = new ProjectMigrator(fs);

    const res = await migrator.migrate(PROJ);

    expect(res.result).toBe('success');
    expect(res.backupPath).toBeDefined();
    expect(fs.exists(fs.join(res.backupPath!, 'project.json'))).toBe(true);
    // The backup is a faithful copy of the pre-migration project.
    const backedUp = await fs.readJson(fs.join(res.backupPath!, 'project.json'));
    expect(canonicalEqual(backedUp, trivial)).toBe(true);
  });

  it('rollback restores the directory to exactly the backup', async () => {
    const fs = new MemFs();
    fs.seedLegacyProject(PROJ, rootNode);
    const migrator = new ProjectMigrator(fs);

    // Migrate (success), then roll back to the backup we were handed.
    const res = await migrator.migrate(PROJ);
    expect(res.result).toBe('success');
    expect(fs.exists(fs.join(PROJ, 'nodegx.project.json'))).toBe(true);
    expect(fs.exists(fs.join(PROJ, 'project.json'))).toBe(false);

    await migrator.rollback(PROJ, res.backupPath!);

    // Back to legacy: project.json present, no v2 artifacts.
    expect(fs.exists(fs.join(PROJ, 'project.json'))).toBe(true);
    expect(fs.exists(fs.join(PROJ, 'nodegx.project.json'))).toBe(false);
    const restored = await fs.readJson(fs.join(PROJ, 'project.json'));
    expect(canonicalEqual(restored, rootNode)).toBe(true);
  });

  it('aborts before any write if the backup cannot be made', async () => {
    const fs = new MemFs();
    fs.seedLegacyProject(PROJ, trivial);
    fs.copyFolder = async () => {
      throw new Error('disk full');
    };
    const migrator = new ProjectMigrator(fs);

    const res = await migrator.migrate(PROJ);

    expect(res.result).toBe('failure');
    expect(res.message).toContain('Backup failed');
    // Nothing was written; the original is untouched.
    expect(fs.exists(fs.join(PROJ, 'nodegx.project.json'))).toBe(false);
    expect(canonicalEqual(await fs.readJson(fs.join(PROJ, 'project.json')), trivial)).toBe(true);
  });
});

// ── Happy path across the real corpus (incl. scale) ──────────────────────────────

const CORPUS: Array<{ name: string; project: LegacyProject }> = [
  { name: 'trivial (import_proj2)', project: trivial },
  { name: 'rootNodeId + variants (import_proj1)', project: rootNode },
  { name: 'thumbnailURI (watchproject)', project: thumbnail },
  { name: 'variants + styles (import_proj5)', project: variantsStyles },
  { name: 'comments, 44 comps (git-repo-utf8)', project: commentsLarge },
  { name: 'xlarge, 176 comps (big-merge-test-mine)', project: xlarge },
  { name: 'synthetic awkward (all edge fields)', project: syntheticAwkward }
];

describe('SUB-003 — migrates real projects and self-verifies', () => {
  for (const { name, project } of CORPUS) {
    it(`migrates and verifies: ${name}`, async () => {
      const fs = new MemFs();
      fs.seedLegacyProject(PROJ, project);
      const migrator = new ProjectMigrator(fs);

      const res = await migrator.migrate(PROJ);

      expect(res.result).toBe('success');
      expect(res.verification?.verified).toBe(true);
      // Directory is now unambiguously v2, legacy file gone.
      expect(fs.exists(fs.join(PROJ, 'nodegx.project.json'))).toBe(true);
      expect(fs.exists(fs.join(PROJ, 'components/_registry.json'))).toBe(true);
      expect(fs.exists(fs.join(PROJ, 'project.json'))).toBe(false);
      const format = await detectorFor(fs).getFormat(PROJ);
      expect(format).toBe('v2');
    });
  }

  it('writes one component directory per component (176-component scale)', async () => {
    const fs = new MemFs();
    fs.seedLegacyProject(PROJ, xlarge);
    const migrator = new ProjectMigrator(fs);

    const res = await migrator.migrate(PROJ);
    expect(res.result).toBe('success');

    const componentJsons = fs.listUnder(fs.join(PROJ, 'components')).filter((p) => p.endsWith('/component.json'));
    expect(componentJsons.length).toBe(xlarge.components.length);
  });
});

// ── Cloud components (the __cloud__/ path mapping) ───────────────────────────────

describe('SUB-003 — cloud components', () => {
  const cloudProject: LegacyProject = {
    name: 'CloudProj',
    id: 'cloud-1',
    version: '4',
    components: [
      { name: '/Home', graph: { roots: [{ id: 'n1', type: 'Group' }], connections: [] } },
      { name: '/#__cloud__/SendGrid/Send', graph: { roots: [{ id: 'c1', type: 'REST' }], connections: [] } }
    ]
  };

  it('migrates a cloud-function component to its __cloud__ path and verifies', async () => {
    const fs = new MemFs();
    fs.seedLegacyProject(PROJ, cloudProject);
    const migrator = new ProjectMigrator(fs);

    const res = await migrator.migrate(PROJ);

    expect(res.result).toBe('success');
    expect(res.verification?.verified).toBe(true);
    expect(fs.exists(fs.join(PROJ, 'components/__cloud__/SendGrid/Send/component.json'))).toBe(true);
    const registry = (await fs.readJson(fs.join(PROJ, 'components/_registry.json'))) as any;
    expect(registry.components['__cloud__/SendGrid/Send'].type).toBe('cloud');
  });
});

// ── Pre-flight analysis ─────────────────────────────────────────────────────────

describe('SUB-003 — pre-flight analysis', () => {
  it('reports counts and flags large scale (176 components)', async () => {
    const fs = new MemFs();
    fs.seedLegacyProject(PROJ, xlarge);
    const report = await new ProjectMigrator(fs).analyze(PROJ);

    expect(report.canMigrate).toBe(true);
    expect(report.format).toBe('legacy');
    expect(report.componentCount).toBe(xlarge.components.length);
    expect(report.flags.isLargeScale).toBe(true);
    expect(report.warnings.some((w) => w.includes('Large project'))).toBe(true);
  });

  it('flags dynamic-port nodes and lesson data on the awkward fixture', async () => {
    const fs = new MemFs();
    fs.seedLegacyProject(PROJ, syntheticAwkward);
    const report = await new ProjectMigrator(fs).analyze(PROJ);

    expect(report.flags.dynamicPortNodeCount).toBeGreaterThan(0);
    expect(report.flags.hasLesson).toBe(true);
  });

  it('reports a v2 project as not migratable', async () => {
    const fs = new MemFs();
    fs.seedLegacyProject(PROJ, trivial);
    const migrator = new ProjectMigrator(fs);
    await migrator.migrate(PROJ); // now v2

    const report = await migrator.analyze(PROJ);
    expect(report.canMigrate).toBe(false);
    expect(report.format).toBe('v2');
  });
});

// ── Verification catches a fidelity fault (injected lossy converter) ─────────────

describe('SUB-003 — verification catches fidelity faults', () => {
  it('aborts and rolls back when the converter drops a field', async () => {
    const fs = new MemFs();
    fs.seedLegacyProject(PROJ, commentsLarge); // has real comments
    const original = JSON.parse(fs.files.get(fs.join(PROJ, 'project.json'))!);

    // A deliberately-lossy exporter: strips node comments so the round-trip differs.
    const lossyExporter = {
      export(project: LegacyProject) {
        const result = new ProjectExporter().export(project);
        for (const f of result.files) {
          if (f.relativePath.endsWith('nodes.json')) delete (f.content as any).comments;
        }
        return result;
      }
    };
    const migrator = new ProjectMigrator(fs, { exporter: lossyExporter });

    const res = await migrator.migrate(PROJ);

    expect(res.result).toBe('failure');
    expect(res.verification?.verified).toBe(false);
    expect(res.message).toContain('verification failed');
    // Rolled back: legacy project intact and byte-faithful, no v2 leftovers.
    expect(fs.exists(fs.join(PROJ, 'nodegx.project.json'))).toBe(false);
    expect(canonicalEqual(await fs.readJson(fs.join(PROJ, 'project.json')), original)).toBe(true);
  });
});

// ── Corrupted / partial inputs fail cleanly ──────────────────────────────────────

describe('SUB-003 — corrupted inputs fail cleanly without damage', () => {
  it('truncated project.json → clean failure, file untouched', async () => {
    const fs = new MemFs();
    fs.ensureDir(PROJ);
    const truncated = '{ "name": "Broken", "components": [ { "name": "/Ho';
    fs.files.set(fs.join(PROJ, 'project.json'), truncated);
    const migrator = new ProjectMigrator(fs);

    const res = await migrator.migrate(PROJ);

    expect(res.result).toBe('failure');
    expect(res.message).toContain('Could not read project');
    // No backup, no v2 files; the (broken) original is exactly as it was.
    expect(fs.exists(fs.join(PROJ, 'nodegx.project.json'))).toBe(false);
    expect(fs.files.get(fs.join(PROJ, 'project.json'))).toBe(truncated);
  });

  it('malformed project (no components array) → clean failure, original restored', async () => {
    const fs = new MemFs();
    fs.seedLegacyProject(PROJ, { name: 'NoComps', version: '4' });
    const migrator = new ProjectMigrator(fs);

    const res = await migrator.migrate(PROJ);

    expect(res.result).toBe('failure');
    expect(fs.exists(fs.join(PROJ, 'nodegx.project.json'))).toBe(false);
    expect(canonicalEqual(await fs.readJson(fs.join(PROJ, 'project.json')), { name: 'NoComps', version: '4' })).toBe(
      true
    );
  });
});

// ── Interrupted migration never damages the original ─────────────────────────────

describe('SUB-003 — interrupted migration', () => {
  it('auto-rolls-back when a write fails mid-migration', async () => {
    const fs = new MemFs();
    fs.seedLegacyProject(PROJ, commentsLarge);
    const original = JSON.parse(fs.files.get(fs.join(PROJ, 'project.json'))!);
    fs.failAfterWrites = 3; // die a few files into the conversion
    const migrator = new ProjectMigrator(fs);

    const res = await migrator.migrate(PROJ);

    expect(res.result).toBe('failure');
    // Automatic rollback restored the legacy project exactly; no half-migration.
    expect(fs.exists(fs.join(PROJ, 'nodegx.project.json'))).toBe(false);
    expect(canonicalEqual(await fs.readJson(fs.join(PROJ, 'project.json')), original)).toBe(true);
    // The legacy file was never the target of a removeFile — the commit never ran.
    expect(fs.removedFiles).not.toContain(fs.join(PROJ, 'project.json'));
  });

  it('a hard kill (no rollback) still leaves the legacy project intact on disk', async () => {
    const fs = new MemFs();
    fs.seedLegacyProject(PROJ, commentsLarge);
    const original = JSON.parse(fs.files.get(fs.join(PROJ, 'project.json'))!);
    fs.failAfterWrites = 3;
    const migrator = new ProjectMigrator(fs);
    // Simulate a process kill: no chance to run the rollback handler.
    migrator.rollback = async () => {
      /* killed before recovery */
    };

    const res = await migrator.migrate(PROJ);
    expect(res.result).toBe('failure');

    // Structural guarantee: the legacy file was never touched before the commit,
    // so even with no rollback the original opens as a valid legacy project.
    expect(fs.exists(fs.join(PROJ, 'project.json'))).toBe(true);
    expect(canonicalEqual(await fs.readJson(fs.join(PROJ, 'project.json')), original)).toBe(true);
    expect(fs.removedFiles).not.toContain(fs.join(PROJ, 'project.json'));
  });
});

// ── Idempotency ──────────────────────────────────────────────────────────────────

describe('SUB-003 — idempotency', () => {
  it('migrating an already-v2 project is a safe no-op (skipped)', async () => {
    const fs = new MemFs();
    fs.seedLegacyProject(PROJ, trivial);
    const migrator = new ProjectMigrator(fs);

    const first = await migrator.migrate(PROJ);
    expect(first.result).toBe('success');

    const second = await migrator.migrate(PROJ);
    expect(second.result).toBe('skipped');
    expect(second.message).toContain('already');
  });
});
