/**
 * HLS-006 — every socket this repository opens, enrolled.
 *
 * ## Why a registry and not a rule
 *
 * The trap named in HLS-006 §5 is that the editor and the CLI become two servers with two
 * policies. `serve/access.ts` answers that for the servers that exist **today**: they all call
 * the same function. It does nothing at all about the fourth one, written next month by somebody
 * who reasonably reaches for `server.listen(port)` — which is exactly how the two in #31 came to
 * bind `::`. Nobody decided; the default decided.
 *
 * So this is the shape HLS-005 established for the same class of problem: a **pinned population**
 * with a claim recorded against each member, swept at the end. A new listener does not silently
 * inherit a default — it fails this suite until somebody writes down what it binds and why.
 *
 * 🔴 **This file is a source scan and therefore proves nothing about behaviour.** A binding that
 * is correct in the text and never runs would pass it. That is deliberate and it is why the two
 * suites next to it exist: `hls006-serve.test.ts` and `noodl-editor/tests-main/
 * hls006-preview-binding.test.js` read the address off real listening sockets. This one's job is
 * only to notice a listener that nobody has thought about, which no behavioural test can do
 * because it does not know the new server is there.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = path.resolve(__dirname, '..', '..', '..');
const PACKAGES = path.join(REPO, 'packages');

/**
 * Every listener, with the decision recorded against it. The key is `<path>:<line text fragment>`
 * so that moving a file is a deliberate edit here rather than a silent pass.
 *
 * ⚠️ Adding a row is not a formality. The question each answers is: *when this runs on somebody's
 * laptop with the office wifi on, who can reach it?*
 */
const ENROLLED: Record<string, string> = {
  // ── The two #31 found, and the relay that rides on the first ──────────────────────────────
  'noodl-editor/src/main/src/web-server.js':
    'HLS-006: binds `access.host` from resolveAccess() — loopback until somebody shares, then ' +
    '0.0.0.0 with the launch token required of every non-loopback caller.',
  'noodl-editor/src/main/src/design-tool-import-server.js':
    'HLS-006: LOOPBACK, always, with no way to share it. It accepts messages that write files ' +
    'into the open project, and no case exists for that being reachable from another machine.',
  'noodl-editor/src/main/src/relay-server.js':
    'OBS-004: attaches to the web server`s socket ({ server }) rather than opening one, so it ' +
    'inherits that binding exactly. Its own token gate is graded by tests-main/relay-auth.test.js.',

  // ── The command line ───────────────────────────────────────────────────────────────────────
  'nodegx-export/src/cli/serve.ts':
    'HLS-006: binds `access.host` from the same resolveAccess(). --share/--host are the only ' +
    'two spellings that reach another interface, and both mint a token.',

  // ── The other local servers, all of which already decided ──────────────────────────────────
  'noodl-preview/src/server.ts':
    'HLS-006: was loopback-by-default already but had no credential when --host was passed. Now ' +
    'binds and gates through the same resolveAccess()/authoriseRequest() pair.',
  'nodegx-backend/src/server/HttpServer.ts':
    'Binds `options.host`, whose default is 127.0.0.1 (config.ts) and whose wider values trip ' +
    '`requiresAuth`. This one got it right before HLS-006 and is the model the editor was not.',
  'noodl-git/src/core/trampoline/trampoline-server.ts': 'Literal 127.0.0.1, port 0. Git asks it for credentials.',
  'noodl-mcp/src/backend/provision.ts': 'Literal 127.0.0.1.',

  // ── Not a local listener ───────────────────────────────────────────────────────────────────
  // 🔴 Two rows used to sit here for the SSR deploy template under `noodl-editor/src/external`.
  // That whole directory is GITIGNORED (`.gitignore:206`), so those files exist on a machine that
  // has built the editor and NEVER on a fresh clone — which made this gate red in CI from the day
  // they were added (2026-09-09) and green locally, and nobody saw it because `test:packages` was
  // dying in an earlier package. `external` is in SKIP now, so the scanner does not reach them and
  // there is nothing to enrol. The template still binds every interface; it still runs on the
  // user's host, not this one. See `noodl-viewer-react/static/ssr/index.js` in the note below —
  // the same file, outside SCANNED, which is why it never needed a row either.
};

/**
 * Where a decision can live: the source each package actually ships or runs.
 *
 * ⚠️ **The boundary, stated because it is a boundary and not an oversight.** Build output
 * (`dist/`, the webpack workers at a package root, `nodegx-backend/deploy/artifact/`) is a copy
 * of a decision made elsewhere, and a test that opens a socket is a test. What this does mean is
 * that a listener added *outside* these three directories is invisible here —
 * `noodl-viewer-react/static/ssr/index.js` is one, and like the editor's two copies of the same
 * template it runs on a user's own host, not on the machine the editor is open on.
 */
const SCANNED = ['src', 'scripts', 'bin'];

/**
 * Directories whose contents are build output, vendored code, or tests.
 *
 * 🔴 `external` is here because `packages/noodl-editor/src/external` is GITIGNORED in its entirety.
 * Scanning it makes this gate answer a different question on every machine — a gate that reads
 * untracked files is describing one working tree, not the repository. See the ENROLLED note above.
 */
const SKIP = new Set([
  'external',
  'node_modules',
  'dist',
  'build',
  'deploy',
  'coverage',
  '.git',
  'tests',
  'tests-main',
  'tests-unit',
  'test',
  '__tests__'
]);

/** What opening a socket looks like. Deliberately broad: a false positive costs one row here. */
const LISTENS = /(?:\.listen\s*\(|new\s+WebSocketServer\s*\(|new\s+WebSocket\.Server\s*\()/;

/**
 * ⚠️ Comment lines are excluded, and this file is the reason the exclusion is not cosmetic:
 * `serve/access.ts` explains the defect by quoting `.listen(port)` twice in its module note, and
 * a scanner that counted prose would report the fix as the thing it was fixing.
 */
function isComment(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*');
}

function walk(dir: string, found: Set<string>): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) walk(full, found);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
    if (/\.bundle\.js$|\.min\.js$|\.d\.ts$/.test(entry.name)) continue;

    const relative = path.relative(PACKAGES, full);
    for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
      if (isComment(line) || !LISTENS.test(line)) continue;
      // A `.listen()` with no arguments is a call to a method declared elsewhere — `this.listen()`,
      // `await this.http.listen()`. The declaration is what binds an address, and it is its own hit
      // in whichever file holds it. Matching on the empty argument list rather than on a list of
      // receiver names is what makes that true for a receiver nobody has thought of yet.
      if (/\.listen\s*\(\s*\)/.test(line)) continue;
      if (/^\s*(?:async\s+)?listen\s*\(/.test(line)) continue;
      found.add(relative);
    }
  }
}

describe('every socket this repository opens is one somebody decided about', () => {
  const found = new Set<string>();
  beforeAll(() => {
    for (const pkg of fs.readdirSync(PACKAGES, { withFileTypes: true })) {
      if (!pkg.isDirectory() || pkg.name === 'node_modules') continue;
      for (const dir of SCANNED) walk(path.join(PACKAGES, pkg.name, dir), found);
    }
  });

  it('has no listener that is not enrolled', () => {
    const unenrolled = [...found].filter((file) => !(file in ENROLLED)).sort();
    // The message is the whole point of the gate: whoever trips it is not looking at this file.
    expect({
      unenrolled,
      whatToDo:
        unenrolled.length === 0
          ? 'nothing'
          : 'A new socket was opened. Decide what it binds — loopback unless there is a reason — ' +
            'then add a row to ENROLLED in this file saying what and why. See serve/access.ts.'
    }).toEqual({ unenrolled: [], whatToDo: 'nothing' });
  });

  /**
   * 🔴 The sweep in the other direction. A row for a file that no longer opens a socket is a
   * claim nobody is checking any more, and it is how a registry rots into decoration.
   */
  it('has no enrolled listener that has since gone away', () => {
    const stale = Object.keys(ENROLLED)
      .filter((file) => !found.has(file))
      .sort();
    expect(stale).toEqual([]);
  });

  /** The scanner has to be able to see something, or both assertions above are `all([])`. */
  it('found the listeners it was pointed at', () => {
    expect(found.size).toBeGreaterThanOrEqual(Object.keys(ENROLLED).length);
    expect(found.has('noodl-editor/src/main/src/web-server.js')).toBe(true);
    expect(found.has('nodegx-export/src/cli/serve.ts')).toBe(true);
  });

  /**
   * ⚠️ And the arm that proves the *comment* exclusion has not quietly turned the scanner off:
   * a real `.listen(` in code is seen, the same text in a comment is not.
   */
  it('reads code and not prose', () => {
    expect(isComment('  server.listen(port);')).toBe(false);
    expect(isComment(' * `.listen(port)` with no address binds `::`')).toBe(true);
    expect(LISTENS.test('server.listen(port, host)')).toBe(true);
  });
});
