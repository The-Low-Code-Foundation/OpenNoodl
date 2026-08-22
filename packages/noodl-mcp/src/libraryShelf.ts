/**
 * LBR-008 — "the shelf": cheap discovery of the installable library entries.
 *
 * ✅ **P69 ruling D7 rescoped this task**: CN-003 owns "this project" (the exact
 * overlay of what is installed), and LBR-008 owns discovery of what *could* be
 * installed — the ~60 entries under `library/{prefabs,modules}/` — plus
 * `install_prefab`. The two must not be confused: nothing here touches the
 * catalog, the overlay, or validation. The shelf is an index, and it is read
 * lazily from disk on each call — no cache of any kind, for D3's reason (a
 * stale cache reads exactly like a correct answer). ~60 small JSON files per
 * call is cheap.
 *
 * ## Where the library lives
 *
 * In a checkout, `library/` at the repo root — found by walking up from this
 * module, which works from `src/` under ts-jest and from `dist/noodl-mcp.cjs`
 * alike. `NODEGX_LIBRARY_DIR` overrides it (the suite's door, and the packaged
 * app's until packaging decides where library content ships — a packaged
 * editor has no `library/` on disk; its entries come from the docs-site CDN as
 * versioned zips, which is a *different transport for the same index* and is
 * recorded as LBR-008's follow-up rather than half-built here).
 *
 * @module noodl-mcp/libraryShelf
 */

import * as fs from 'fs';
import * as path from 'path';

export type LibraryEntryType = 'prefab' | 'module';

/** `library.json`, as `scripts/library/schema.json` describes it. */
export interface LibraryJson {
  label: string;
  description: string;
  type: LibraryEntryType;
  tags: string[];
  version: string;
  icon?: string;
  docsPath?: string;
  minEditorVersion?: string;
  runtimeVersion?: string;
  provenance?: { sourceUrl?: string; importedAt?: string };
}

/** One row of the shelf index — deliberately the cheap fields only. */
export interface ShelfRow {
  slug: string;
  type: LibraryEntryType;
  label: string;
  /** First line of the entry's description, capped — the index must cost like an index. */
  description: string;
  tags: string[];
  version: string;
}

/** An entry directory that exists but could not be read as an entry. */
export interface ShelfProblem {
  slug: string;
  type: LibraryEntryType;
  problem: string;
}

export type ResolveResult = { ok: true; root: string } | { ok: false; reason: string };

const TYPE_DIRS: ReadonlyArray<{ dir: string; type: LibraryEntryType }> = [
  { dir: 'prefabs', type: 'prefab' },
  { dir: 'modules', type: 'module' }
];

/**
 * Find the library source root. Env override first, then walk up from this
 * file — `__dirname` is `src/` under ts-jest and `dist/` in the bundle, and
 * both sit under `packages/noodl-mcp`, so the repo root is a short walk.
 */
export function resolveLibraryRoot(): ResolveResult {
  const env = process.env.NODEGX_LIBRARY_DIR;
  if (env) {
    if (looksLikeLibraryRoot(env)) return { ok: true, root: env };
    return {
      ok: false,
      reason: `NODEGX_LIBRARY_DIR points at "${env}", which has no prefabs/ or modules/ directory.`
    };
  }
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'library');
    if (looksLikeLibraryRoot(candidate)) return { ok: true, root: candidate };
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return {
    ok: false,
    reason:
      'No library/ directory found walking up from the server. This server reads library content from a ' +
      'checkout (library/ at the repo root); set NODEGX_LIBRARY_DIR to point at one.'
  };
}

function looksLikeLibraryRoot(dir: string): boolean {
  return TYPE_DIRS.some((t) => {
    try {
      return fs.statSync(path.join(dir, t.dir)).isDirectory();
    } catch {
      return false;
    }
  });
}

/** One line, capped, for the index. The full text is `get_library_entry`'s job. */
function oneLine(description: string): string {
  const line = description.split('\n')[0].trim();
  return line.length > 160 ? `${line.slice(0, 157)}...` : line;
}

export function readLibraryJson(entryDir: string): LibraryJson {
  const raw = fs.readFileSync(path.join(entryDir, 'library.json'), 'utf8');
  const parsed = JSON.parse(raw) as LibraryJson;
  if (!parsed || typeof parsed.label !== 'string' || (parsed.type !== 'prefab' && parsed.type !== 'module')) {
    throw new Error('library.json is missing label/type');
  }
  return parsed;
}

/**
 * The shelf index. Reads every entry's `library.json`, nothing else — no
 * project loads, no zips, no validation. A malformed entry (a peer mid-edit, a
 * half-written directory) is reported in `problems` rather than either failing
 * the whole list or silently vanishing from it.
 */
export function listShelf(
  root: string,
  filter: { type?: LibraryEntryType; tag?: string } = {}
): { rows: ShelfRow[]; problems: ShelfProblem[] } {
  const rows: ShelfRow[] = [];
  const problems: ShelfProblem[] = [];
  for (const { dir, type } of TYPE_DIRS) {
    if (filter.type && filter.type !== type) continue;
    const base = path.join(root, dir);
    let slugs: string[] = [];
    try {
      slugs = fs
        .readdirSync(base, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      continue; // a root may legitimately hold only one of the two dirs
    }
    for (const slug of slugs.sort()) {
      const entryDir = path.join(base, slug);
      if (!fs.existsSync(path.join(entryDir, 'library.json'))) continue; // not an entry (scratch dir, etc.)
      try {
        const meta = readLibraryJson(entryDir);
        const row: ShelfRow = {
          slug,
          type,
          label: meta.label,
          description: oneLine(meta.description ?? ''),
          tags: Array.isArray(meta.tags) ? meta.tags : [],
          version: meta.version ?? '0.0.0'
        };
        if (filter.tag && !row.tags.some((t) => t.toLowerCase() === filter.tag!.toLowerCase())) continue;
        rows.push(row);
      } catch (err) {
        problems.push({ slug, type, problem: (err as Error).message });
      }
    }
  }
  return { rows, problems };
}

export interface ResolvedEntry {
  slug: string;
  type: LibraryEntryType;
  entryDir: string;
  meta: LibraryJson;
}

/**
 * Resolve one entry by slug. A slug is unique within prefabs and within
 * modules but nothing guarantees it across the two, so an ambiguous slug with
 * no `type` is an error naming both — never a silent pick.
 */
export function resolveEntry(
  root: string,
  slug: string,
  type?: LibraryEntryType
): { ok: true; entry: ResolvedEntry } | { ok: false; reason: string } {
  const hits: ResolvedEntry[] = [];
  for (const t of TYPE_DIRS) {
    if (type && type !== t.type) continue;
    const entryDir = path.join(root, t.dir, slug);
    if (!fs.existsSync(path.join(entryDir, 'library.json'))) continue;
    try {
      hits.push({ slug, type: t.type, entryDir, meta: readLibraryJson(entryDir) });
    } catch (err) {
      return { ok: false, reason: `Entry "${slug}" exists but its library.json could not be read: ${(err as Error).message}` };
    }
  }
  if (hits.length === 0) {
    return { ok: false, reason: `No library entry "${slug}"${type ? ` of type "${type}"` : ''}. Call list_library for the index.` };
  }
  if (hits.length > 1) {
    return { ok: false, reason: `"${slug}" exists as both a prefab and a module — pass type to say which.` };
  }
  return { ok: true, entry: hits[0] };
}

/** The names of the code modules an entry ships (its `project/noodl_modules/*` directories). */
export function entryModuleDirs(entry: ResolvedEntry): string[] {
  const dir = path.join(entry.entryDir, 'project', 'noodl_modules');
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}
