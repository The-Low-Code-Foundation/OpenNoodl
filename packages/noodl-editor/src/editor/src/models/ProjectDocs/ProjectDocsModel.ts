/**
 * AIX-009 — Project context documents: the filesystem-backed model.
 *
 * `docs/` is plain markdown at the project root. There is no manifest, no
 * `project.json` involvement and no schema migration — git owns the files and a
 * text editor is a first-class way to work on them. That is the whole point of
 * the format, and it is also the reason this model is written defensively: the
 * user *will* edit `docs/BRIEF.md` in VS Code with the panel open, and a panel
 * holding a stale buffer that overwrites them on the next keystroke would make
 * the format worse than no format.
 *
 * So every write is optimistic-concurrency checked against the exact bytes the
 * caller last read (`baseline`), the same discipline `ProjectStore.assertNoDrift`
 * uses on the MCP side, and every write is temp-file + atomic rename so a failed
 * write leaves the previous content intact rather than a truncated file.
 *
 * External-edit detection is a poll, not a watcher: `IFileSystem` exposes no
 * watch API and no mtime (`FileStat` is `{ size }` only), and adding one to the
 * cross-platform interface for this feature would be a much larger change than
 * the feature. Docs are a handful of small files, so the poll reads them and
 * compares content — which is exact, where an mtime/size heuristic is not.
 *
 * @module ProjectDocs/ProjectDocsModel
 */

import { filesystem } from '@noodl/platform';

import Model from '../../../../shared/model';
// CN-006: `writeTextAtomic` and `toRelative` were private to this file until a
// second model needed both. One implementation, imported — see the module note
// in `projectFileIo`.
import { toProjectRelative as toRelative, writeTextAtomic } from '../ProjectFiles/projectFileIo';
import type { ProjectModel } from '../projectmodel';
import {
  assertInsideDocs,
  describeDoc,
  docBody,
  DOCS_DIR,
  DOC_ARCHITECTURE,
  DOC_BRIEF,
  DOC_CONVENTIONS,
  KNOWN_DOCS,
  type DiscoveredDoc,
  type DocInjection,
  type KnownDocKind,
  type ProjectDocsContent
} from './docsText';
import { DOC_TEMPLATES } from './templates';

/** How often the model re-reads docs from disk while anyone is listening. */
const POLL_INTERVAL_MS = 2_000;

export interface DocEntry {
  /** Project-relative, forward-slashed, e.g. `docs/BRIEF.md`. */
  path: string;
  /** Basename for display. */
  name: string;
  /** One of the three seed files the system ships a template for. */
  kind?: KnownDocKind;
  /** False when the file does not exist yet (seed docs are listed either way). */
  exists: boolean;
  chars: number;
  /** BLD-007 — how this doc reaches the model, declared or defaulted. */
  inject?: DocInjection;
  /** BLD-007 — declared title, else first heading, else the filename. */
  title?: string;
  /** BLD-007 — true when the file carries front matter of its own. */
  declared?: boolean;
  /** BLD-007 — front-matter lines this format could not use. */
  problems?: string[];
}

/** The one event this model emits; the payload names the changed paths. */
export const DOCS_CHANGED = 'docsChanged';

/** Thrown when a write would overwrite an edit the caller never saw. */
export class DocsConflictError extends Error {
  constructor(public readonly path: string, message: string) {
    super(message);
    this.name = 'DocsConflictError';
  }
}

/**
 * The docs of one project directory. Cheap to construct; holds a cache of the
 * last read of every doc so a write can tell an external edit from its own.
 */
export class ProjectDocsModel extends Model {
  readonly projectDir: string;

  /** Last content seen on disk, by project-relative path. */
  private cache = new Map<string, string>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private polling = false;

  constructor(projectDir: string) {
    super();
    this.projectDir = projectDir;
  }

  /**
   * The docs of the open project, or `undefined` when nothing is open or the
   * project has never been written to disk (an unsaved project has no folder to
   * put a `docs/` in).
   */
  static forProject(project: ProjectModel | undefined): ProjectDocsModel | undefined {
    const dir = project?._retainedProjectDirectory;
    return dir ? new ProjectDocsModel(dir) : undefined;
  }

  // ── Paths ───────────────────────────────────────────────────────────────────

  get docsDir(): string {
    return filesystem.join(this.projectDir, DOCS_DIR);
  }

  /** Absolute path for a project-relative doc path. Throws for paths outside docs/. */
  absolute(relPath: string): string {
    return filesystem.join(this.projectDir, assertInsideDocs(relPath));
  }

  /**
   * The single predicate that decides whether this project "has docs" — the one
   * AIX-010's recommendation banner keys off. CONVENTIONS.md, not the folder:
   * an empty `docs/` left behind by a checkout is not a documented project.
   */
  hasDocs(): boolean {
    return filesystem.exists(filesystem.join(this.projectDir, DOC_CONVENTIONS));
  }

  // ── Reads ───────────────────────────────────────────────────────────────────

  /** One doc, or `undefined` when the file does not exist. */
  async read(relPath: string): Promise<string | undefined> {
    const rel = assertInsideDocs(relPath);
    const abs = filesystem.join(this.projectDir, rel);
    if (!filesystem.exists(abs)) {
      this.cache.delete(rel);
      return undefined;
    }
    const text = await filesystem.readFile(abs);
    this.cache.set(rel, text);
    return text;
  }

  /**
   * Every markdown file under `docs/`, plus the known files that are missing —
   * a docs folder without a CONVENTIONS.md should say so, not omit the row.
   */
  async list(): Promise<DocEntry[]> {
    const known = new Map(KNOWN_DOCS.map((d) => [d.path, d.kind]));
    const entries = new Map<string, DocEntry>();

    for (const doc of KNOWN_DOCS) {
      entries.set(doc.path, { path: doc.path, name: baseName(doc.path), kind: doc.kind, exists: false, chars: 0 });
    }

    if (filesystem.exists(this.docsDir)) {
      const files = await filesystem.listDirectoryFiles(this.docsDir);
      for (const file of files) {
        if (file.isDirectory || !file.name.toLowerCase().endsWith('.md')) continue;
        const rel = toRelative(this.projectDir, file.fullPath);
        if (!rel) continue;
        let chars = 0;
        try {
          chars = filesystem.file(file.fullPath).size;
        } catch {
          /* raced with a delete — reported as an empty file, not a crash */
        }
        // BLD-007: the row carries the doc's own declaration, so the panel can
        // show how it reaches the model without a second read per row. Reading
        // it costs one file read each; `docs/` is a handful of small files, and
        // a listing that cannot say "this one is ignored" is the listing that
        // let D9 hide for a whole phase.
        let declaration: Partial<DocEntry> = {};
        try {
          const source = await filesystem.readFile(file.fullPath);
          const described = describeDoc(rel, source);
          declaration = {
            inject: described.inject,
            title: described.title,
            declared: described.declared,
            ...(described.problems.length > 0 ? { problems: described.problems } : {})
          };
        } catch {
          /* raced with a delete, or unreadable — the row still lists */
        }
        entries.set(rel, { path: rel, name: file.name, kind: known.get(rel), exists: true, chars, ...declaration });
      }
    }

    return [...entries.values()].sort(compareEntries);
  }

  /**
   * Everything the authoring loop may see, read fresh. Absent files are absent
   * fields — never empty strings, so "no BRIEF.md" and "an empty BRIEF.md" stay
   * distinguishable to the context builder.
   *
   * BLD-007 — the three seed docs keep their named fields (that is the route
   * whose bytes are already in every project's cached prefix), and everything
   * else under `docs/` arrives in `extra` carrying the injection it declared. A
   * seed doc that *overrides* its default travels through `extra` too, which is
   * how `KNOWN_DOCS` stops gating injection without any pre-BLD-007 project
   * changing by a byte.
   *
   * Front matter is stripped here and only here: `read()` returns the file as it
   * is on disk, because the panel and the doc-authoring turn edit the real file.
   */
  async content(): Promise<ProjectDocsContent> {
    const [conventions, brief, architecture] = await Promise.all([
      this.read(DOC_CONVENTIONS),
      this.read(DOC_BRIEF),
      this.read(DOC_ARCHITECTURE)
    ]);

    const seeds: Array<[string, string | undefined, 'conventions' | 'brief' | 'architecture']> = [
      [DOC_CONVENTIONS, conventions, 'conventions'],
      [DOC_BRIEF, brief, 'brief'],
      [DOC_ARCHITECTURE, architecture, 'architecture']
    ];

    const content: ProjectDocsContent = {};
    const extra: DiscoveredDoc[] = [];

    for (const [path, source, field] of seeds) {
      if (source === undefined) continue;
      const described = describeDoc(path, source);
      const defaultInjection = KNOWN_DOCS.find((d) => d.path === path)!.injection;
      if (described.inject === defaultInjection) {
        content[field] = docBody(source);
      } else {
        extra.push({ path, title: described.title, inject: described.inject, when: described.when, body: docBody(source) });
      }
    }

    extra.push(...(await this.discover()));
    if (extra.length > 0) content.extra = extra;
    return content;
  }

  /**
   * BLD-007 — every markdown doc under `docs/` that is not one of the three
   * seeds, with the injection it declared.
   *
   * Top level only, matching `list()`: `docs/decisions/` is a log of decisions
   * already taken, and injecting a folder that grows without bound is how a
   * project's every turn quietly gets more expensive.
   */
  private async discover(): Promise<DiscoveredDoc[]> {
    if (!filesystem.exists(this.docsDir)) return [];
    const seedPaths = new Set(KNOWN_DOCS.map((d) => d.path));
    const out: DiscoveredDoc[] = [];

    const files = await filesystem.listDirectoryFiles(this.docsDir);
    for (const file of files) {
      if (file.isDirectory || !file.name.toLowerCase().endsWith('.md')) continue;
      const rel = toRelative(this.projectDir, file.fullPath);
      if (!rel || seedPaths.has(rel)) continue;
      let source: string;
      try {
        source = await filesystem.readFile(file.fullPath);
      } catch {
        continue; // raced with a delete; the next refresh sees the result
      }
      this.cache.set(rel, source);
      const described = describeDoc(rel, source);
      out.push({
        path: rel,
        title: described.title,
        inject: described.inject,
        when: described.when,
        body: docBody(source)
      });
    }

    // Stable order: the tool definition built from this list lives in the cached
    // prefix, and a filesystem that returns files in a different order between
    // two sessions would invalidate it for no reason at all.
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  /** The last content read for a doc, without touching disk. */
  cached(relPath: string): string | undefined {
    return this.cache.get(assertInsideDocs(relPath));
  }

  // ── Writes ──────────────────────────────────────────────────────────────────

  /**
   * Replace a doc, whole-file. `baseline` is the content the caller last saw;
   * when disk no longer matches it the write is refused with a
   * `DocsConflictError` and nothing is touched, so an external edit is never
   * silently lost. Pass `baseline: undefined` only when the caller genuinely has
   * no prior read (seeding, or a deliberate force).
   */
  async write(relPath: string, content: string, options: { baseline?: string | null } = {}): Promise<void> {
    const rel = assertInsideDocs(relPath);
    const abs = filesystem.join(this.projectDir, rel);

    if (options.baseline !== undefined) {
      const current = filesystem.exists(abs) ? await filesystem.readFile(abs) : null;
      if (current !== options.baseline) {
        throw new DocsConflictError(
          rel,
          `${rel} changed on disk since it was read (an external editor, or another agent). ` +
            'Reload it and re-apply the change.'
        );
      }
    }

    await filesystem.makeDirectory(filesystem.dirname(abs));
    await writeTextAtomic(abs, content);
    this.cache.set(rel, content);
    this.notifyListeners(DOCS_CHANGED, { paths: [rel] });
  }

  /** Delete a doc. Used by undo of a create, never offered as a bare UI action. */
  async remove(relPath: string): Promise<void> {
    const rel = assertInsideDocs(relPath);
    const abs = filesystem.join(this.projectDir, rel);
    if (filesystem.exists(abs)) await filesystem.removeFile(abs);
    this.cache.delete(rel);
    this.notifyListeners(DOCS_CHANGED, { paths: [rel] });
  }

  /**
   * Create `docs/` and the three top-level files from templates. Never
   * overwrites: seeding a project that already has a BRIEF.md must be safe to
   * click twice. Returns the paths actually created.
   */
  async seed(): Promise<string[]> {
    await filesystem.makeDirectory(this.docsDir);
    const created: string[] = [];
    for (const doc of KNOWN_DOCS) {
      const abs = filesystem.join(this.projectDir, doc.path);
      if (filesystem.exists(abs)) continue;
      await writeTextAtomic(abs, DOC_TEMPLATES[doc.kind]);
      this.cache.set(doc.path, DOC_TEMPLATES[doc.kind]);
      created.push(doc.path);
    }
    if (created.length > 0) this.notifyListeners(DOCS_CHANGED, { paths: created });
    return created;
  }

  // ── External-edit watching ──────────────────────────────────────────────────

  /**
   * Start polling for external edits. Idempotent; pair with `stopWatching`.
   * The panel starts this on mount so an edit made in VS Code shows up without
   * the user having to do anything to provoke it.
   */
  startWatching(intervalMs = POLL_INTERVAL_MS): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.refresh(), intervalMs);
  }

  stopWatching(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /**
   * Re-read everything the cache knows about plus the three known docs, and
   * notify when any content differs. Safe to call directly (window focus, panel
   * mount) as well as from the poll.
   */
  async refresh(): Promise<string[]> {
    if (this.polling) return [];
    this.polling = true;
    try {
      const watched = new Set<string>([...this.cache.keys(), ...KNOWN_DOCS.map((d) => d.path)]);
      // BLD-007: a doc the user has just created has never been read, so it is
      // in neither set — and before this, writing `docs/uk-vat.md` in VS Code
      // produced no change event and the next build never saw it. Listing is one
      // directory read per poll against a handful of files.
      if (filesystem.exists(this.docsDir)) {
        try {
          for (const file of await filesystem.listDirectoryFiles(this.docsDir)) {
            if (file.isDirectory || !file.name.toLowerCase().endsWith('.md')) continue;
            const rel = toRelative(this.projectDir, file.fullPath);
            if (rel) watched.add(rel);
          }
        } catch {
          /* the per-file reads below still report what they can */
        }
      }
      const changed: string[] = [];
      for (const rel of watched) {
        const abs = filesystem.join(this.projectDir, rel);
        const before = this.cache.get(rel);
        let after: string | undefined;
        try {
          after = filesystem.exists(abs) ? await filesystem.readFile(abs) : undefined;
        } catch {
          continue; // mid-write by another process; the next tick sees the result
        }
        if (after === before) continue;
        if (after === undefined) this.cache.delete(rel);
        else this.cache.set(rel, after);
        changed.push(rel);
      }
      if (changed.length > 0) this.notifyListeners(DOCS_CHANGED, { paths: changed });
      return changed;
    } finally {
      this.polling = false;
    }
  }

  dispose(): void {
    this.stopWatching();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function baseName(relPath: string): string {
  return relPath.slice(relPath.lastIndexOf('/') + 1);
}

/** Known docs first, in their declared order; everything else alphabetically. */
function compareEntries(a: DocEntry, b: DocEntry): number {
  const order = (e: DocEntry) => {
    const index = KNOWN_DOCS.findIndex((d) => d.path === e.path);
    return index === -1 ? KNOWN_DOCS.length : index;
  };
  const delta = order(a) - order(b);
  return delta !== 0 ? delta : a.path.localeCompare(b.path);
}
