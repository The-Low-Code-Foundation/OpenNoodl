/**
 * DEF-007 AC4 — every path that loads a project, and whether it runs the upgrade step.
 *
 * ## Why this is a test and not a document
 *
 * The seam is one call: `applyPatches(content)` immediately before `ProjectModel.fromJSON`.
 * `fromJSON` does not apply patches, so **any path reaching it without `applyPatches` first sees
 * the file as written** — while the editor sees a graph the migration has rewritten. On the
 * shipped site-builder template those two readings differ in **56 stored parameters**.
 *
 * The table answering AC4 already existed. It lived in a phase-80 task file, which is a record of
 * a phase: when the phase closes nobody maintains it. 🔴 **Richard ruled on 2026-08-31 that it move
 * into the codebase *and* gain this test, and that the test is the point** — because a
 * hand-maintained list of "which callers need the special treatment" is exactly the shape that
 * decayed until `Checkbox` was missed while its identically-declared sibling `Radio Button` was
 * fixed (DEF-037). Without a test it is a snapshot that looks authoritative and goes quietly wrong
 * the first time someone adds a seventh load path.
 *
 * ## What this file can and cannot see
 *
 * ✅ It scans shipped source for real `ProjectModel.fromJSON` calls and fails on one that is not
 * registered in {@link PROJECT_LOAD_SITES}, and on a registered one that has disappeared.
 *
 * ⚠️ **It cannot see a reader that never constructs a `ProjectModel`** — code export, the MCP
 * server and template generation all read the project files directly. Those are listed in
 * `NON_FROMJSON_READERS` as prose, and nothing enforces them. A scan cannot be written for "reads
 * a project somehow"; that boundary is stated rather than hidden.
 *
 * ⚠️ It is a **text** scan. A call reached through an alias (`const f = ProjectModel.fromJSON`) or
 * built by string would not be found. No such call exists today; the point is that absence here is
 * evidence about this spelling, not proof about every possible one.
 */

/* eslint-env jest */

import * as fs from 'fs';
import * as path from 'path';

import { GRAPH_READER_SITES, PROJECT_LOAD_SITES } from '../src/editor/src/models/ProjectPatches/projectLoadSeam';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

/** Packages whose `src` ships to a user. */
const SCANNED_PACKAGES = ['noodl-editor', 'noodl-preview', 'noodl-viewer-react', 'noodl-viewer-cloud'];

/**
 * Directories that are build output rather than source.
 *
 * 🔴 `src/external` holds prebuilt viewer/deploy bundles that contain a copy of everything —
 * scanning them reports call sites that no one can edit, in files that are regenerated.
 */
const EXCLUDED = ['node_modules', 'src/external', 'dist', 'build', '.webpack-cache'];

function walk(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(REPO_ROOT, full);
    if (EXCLUDED.some((x) => rel.includes(x))) continue;
    if (entry.isDirectory()) walk(full, out);
    // 🔴 `*.bundle.js` is webpack output that happens to sit under `src/` —
    // `src/editor/index.bundle.js` and `src/main/main.bundle.js` are both gitignored build
    // artefacts (`npm run check:artefacts` fails if either is ever committed). They contain a
    // copy of everything, so scanning them reports call sites nobody can edit. The first run of
    // this test found exactly these and nothing else, which is how they came to be named here.
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && !/\.bundle\.js$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Strip comments before matching.
 *
 * 🔴 Not cosmetic. `loader.ts` names `ProjectModel.fromJSON` in a docstring twelve lines above the
 * real call, and `EmbeddedTemplateProvider.ts` and `tpl001Template.ts` name it in prose while
 * calling nothing. Matching raw text reports three files that do not load a project — a
 * documentation mention reading as a call site is the same failure that disabled a pruner for
 * every project in VIB-012.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const CALL = /\bProjectModel\.fromJSON\s*\(/;

function findCallSites(): string[] {
  const found: string[] = [];
  for (const pkg of SCANNED_PACKAGES) {
    for (const file of walk(path.join(REPO_ROOT, 'packages', pkg, 'src'))) {
      if (CALL.test(stripComments(fs.readFileSync(file, 'utf8')))) {
        found.push(path.relative(REPO_ROOT, file).split(path.sep).join('/'));
      }
    }
  }
  return found.sort();
}

describe('DEF-007 AC4 — the project-load seam is registered, not remembered', () => {
  /**
   * 🔴 **Validate the extractor against an answer already known, before trusting its absences.**
   * These two are known by hand: the editor's own open path (which applies patches) and the
   * headless render path (which does not). A scan that found neither would report "no unregistered
   * call sites" and look exactly like a pass.
   */
  test('the scan finds the two call sites known by hand', () => {
    const found = findCallSites();

    expect(found).toContain('packages/noodl-editor/src/editor/src/models/projectmodel.editor.ts');
    expect(found).toContain('packages/noodl-preview/src/loader.ts');
    expect(found.length).toBeGreaterThanOrEqual(2);
  });

  test('comment-only mentions are not call sites', () => {
    // The control for `stripComments`. This file mentions `ProjectModel.fromJSON` in prose and
    // calls nothing, so it must not appear — if it does, every docstring is a false load path.
    const found = findCallSites();

    expect(found).not.toContain(
      'packages/noodl-editor/src/editor/src/models/template/EmbeddedTemplateProvider.ts'
    );
  });

  /**
   * The gate. A new load path makes this red, and the fix is to decide which side of the seam it
   * is on — not to append a row to make it green.
   */
  test('every ProjectModel.fromJSON call site is registered', () => {
    const found = findCallSites();
    const registered = new Set(PROJECT_LOAD_SITES.map((s) => s.file));
    const unregistered = found.filter((f) => !registered.has(f));

    expect(unregistered).toEqual([]);
  });

  /** The other direction: a row for a call site that no longer exists is a decayed list. */
  test('every registered site still calls it', () => {
    const found = new Set(findCallSites());
    const stale = PROJECT_LOAD_SITES.filter((s) => !found.has(s.file)).map((s) => s.file);

    expect(stale).toEqual([]);
  });

  /**
   * 🔴 The registry exists to record a *decision*, so a row that records none is worthless. This
   * catches the "append a row to go green" failure the gate above invites.
   */
  test('every registered site states a disposition and a reason', () => {
    for (const site of PROJECT_LOAD_SITES) {
      expect(['applies', 'does-not-apply', 'inherits']).toContain(site.disposition);
      expect(site.entryPoint.length).toBeGreaterThan(0);
      expect(site.note.length).toBeGreaterThan(20);
    }
  });

  /**
   * The measurement AC4 actually asks for, asserted so it cannot quietly drift: **most load paths
   * do not run the upgrade.** If someone fixes that, this row goes red and the number in the
   * task file and the docs should move with it.
   */
  test('the seam is still open — more paths skip the upgrade than apply it', () => {
    const applies = PROJECT_LOAD_SITES.filter((s) => s.disposition === 'applies');
    const skips = PROJECT_LOAD_SITES.filter((s) => s.disposition !== 'applies');

    expect(applies.map((s) => s.file)).toEqual([
      'packages/noodl-editor/src/editor/src/models/projectmodel.editor.ts'
    ]);
    expect(skips.length).toBeGreaterThan(applies.length);
  });
});

/**
 * HLS-003 — the second scan, and the hole it closes.
 *
 * 🔴 The block above says of itself: *"It cannot see a reader that never constructs a
 * `ProjectModel`"*. That was not a small gap. The three readers most likely to be wrong — the
 * exporter, the MCP server and template generation — are all in exactly that blind spot, and were
 * carried as prose in `NON_FROMJSON_READERS` where nothing could fail on them. The exporter sat on
 * the wrong side of the seam for as long as the row describing it was a sentence, and HLS-003
 * measured what that cost: on a project the editor had not opened-and-saved, two `Condition` nodes
 * and four cascade nodes were refused over a parameter the author never chose.
 *
 * A scan cannot be written for "reads a project somehow". It **can** be written for the thing that
 * puts a reader on the seam at all: opening a component's graph file. That is this scan.
 */
const GRAPH_SCANNED_PACKAGES = [
  'noodl-editor',
  'noodl-preview',
  'noodl-mcp',
  'noodl-git',
  'nodegx-export',
  'noodl-viewer-react',
  'noodl-viewer-cloud'
];

/** A read of a component's graph file, as every v2 reader spells it. */
const GRAPH_FILE = /['"`]nodes\.json['"`]/;

function findGraphReaders(): string[] {
  const found: string[] = [];
  for (const pkg of GRAPH_SCANNED_PACKAGES) {
    for (const file of walk(path.join(REPO_ROOT, 'packages', pkg, 'src'))) {
      if (GRAPH_FILE.test(stripComments(fs.readFileSync(file, 'utf8')))) {
        found.push(path.relative(REPO_ROOT, file).split(path.sep).join('/'));
      }
    }
  }
  return found.sort();
}

describe('HLS-003 — every reader of a project graph has a disposition', () => {
  /**
   * 🔴 The same rule the block above follows: validate the extractor against an answer known by
   * hand before trusting a single absence it reports. These two are known — the exporter, which
   * settles, and the headless preview, which does not.
   */
  test('the scan finds the readers known by hand', () => {
    const found = findGraphReaders();

    expect(found).toContain('packages/nodegx-export/src/parse/parseProject.ts');
    expect(found).toContain('packages/noodl-mcp/src/project/ProjectStore.ts');
    expect(found.length).toBeGreaterThanOrEqual(10);
  });

  /**
   * The gate, and the whole point of the exercise. A fourth headless reader appearing on the wrong
   * side of the seam makes this red.
   *
   * ⚠️ **If you are here because this failed, you are being asked to make a decision.** Which of
   * the four dispositions is true of the reader you added? `does-not-apply` is an admission that
   * it reads a graph the editor would have rewritten — not a default to reach for because the
   * other three need justifying.
   */
  test('every graph reader is registered with a disposition', () => {
    const found = findGraphReaders();
    const registered = new Set(GRAPH_READER_SITES.map((site) => site.file));
    const unregistered = found.filter((f) => !registered.has(f));

    expect(unregistered).toEqual([]);
  });

  /** The other direction: a row for a reader that no longer exists is a list already decaying. */
  test('every registered graph reader still exists', () => {
    const found = new Set(findGraphReaders());
    const vanished = GRAPH_READER_SITES.map((site) => site.file).filter((f) => !found.has(f));

    expect(vanished).toEqual([]);
  });

  /**
   * 🔴 The count that has to shrink. It is asserted rather than merely reported so that a reader
   * *added* on the wrong side cannot hide behind one being fixed — the two would cancel and the
   * gate above would still pass, because both files are registered.
   */
  test('the readers still on the wrong side of the seam are the ones we know about', () => {
    const open = GRAPH_READER_SITES.filter((s) => s.disposition === 'does-not-apply').map((s) => s.file);

    expect(open).toEqual([
      'packages/noodl-preview/src/loader.ts',
      'packages/noodl-mcp/src/project/ProjectStore.ts'
    ]);
  });
});
