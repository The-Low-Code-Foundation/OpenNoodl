/**
 * HLS-009 AC3 — the launcher's recent-projects store has **one** writer.
 *
 * ## Why this is a gate and not a sentence in a task file
 *
 * `recently_opened_project.json` is an `electron-store` file that
 * `LocalProjectsModel.store()` rewrites **wholesale** — the whole `recentProjects` array, from
 * its in-memory model, on every change. That makes a second writer worse than useless: a row
 * appended by another process is not merged, it is deleted by the editor's next `store()`, and
 * it is deleted silently. [#38]'s reporter hit exactly this, wrote the file by hand, and then had
 * to drive the UI over a debug port to make the editor notice.
 *
 * HLS-009 adds a tool whose entire job is to get a project into that list, so the pressure to add
 * the obvious second writer is now real and permanent. The property that keeps it correct is a
 * **count**, and a count is the one thing prose in a task file cannot hold: it stays true only
 * until somebody adds a line to a file this note does not name.
 *
 * ⚠️ **A source scan, not a behavioural test, and that bound is stated rather than implied.** It
 * cannot see a write through a variable, a dynamic `Store({name})` or a raw `fs.writeFile` to a
 * path it assembled. What it does see is the shape anybody actually reaching for this would type,
 * and it fails on the first one.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..', '..', '..');
const PACKAGES = path.join(REPO, 'packages');

/** The store's `electron-store` name, and the file it produces. */
const STORE_KEY = 'recentProjects';
const STORE_FILE = 'recently_opened_project';

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.webpack-cache']);

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* sourceFiles(full);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
    // Webpack output is a copy of source that would double every count in it.
    if (entry.name.endsWith('.bundle.js')) continue;
    yield full;
  }
}

/**
 * A line that *writes* the store, as opposed to reading it or naming it in prose.
 *
 * `store.set('recentProjects', …)` is the write `electron-store` offers; a direct
 * `writeFile`/`writeFileSync` naming the file is the other way in. Comments are excluded because
 * this module and two others discuss the file at length, and a gate that counted paragraphs would
 * fire on its own documentation — the trap of putting real prose inside a scanned directory.
 */
function writesTheStore(line: string): boolean {
  const code = line.trim();
  if (code.startsWith('*') || code.startsWith('//') || code.startsWith('/*')) return false;
  if (new RegExp(`\\.set\\(\\s*['"\`]${STORE_KEY}['"\`]`).test(code)) return true;
  return /writeFile(Sync)?\s*\(/.test(code) && code.includes(STORE_FILE);
}

describe('HLS-009 AC3 — one writer of the recent-projects store', () => {
  it('finds exactly one, and it is the editor', () => {
    const writers: string[] = [];

    for (const file of sourceFiles(PACKAGES)) {
      // Two exclusions, both decisions rather than oversights.
      //
      // `scripts/` is devtools, not shipped code; two of those read the store to find a project to
      // drive. And a suite writing `recently_opened_project.json` into a temp directory is building
      // a fixture, not competing for the user's file — `noodl-mcp/tests/listProjects.test.ts` does
      // exactly that to grade the reader, and it also carries its own `never writes to the store
      // file` assertion, which is this property from the MCP side.
      //
      // ⚠️ Both were found *by this gate failing*, not by reading the tree first. That is the gate
      // working: a hand grep with the same exclusions baked in would have agreed with itself.
      if (file.includes(`${path.sep}scripts${path.sep}`)) continue;
      if (/[\\/]tests?(-unit|-main)?[\\/]/.test(file)) continue;
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (writesTheStore(line)) writers.push(`${path.relative(REPO, file)}:${i + 1}`);
      });
    }

    // 🔴 Two-sided. A gate that only asserted "at most one" would pass forever the day the write
    // is renamed and this scan stops seeing anything — the failure mode `nodeDocBudget` calls a
    // budget that passes by measuring nothing.
    expect(writers).toEqual(['packages/noodl-editor/src/editor/src/utils/LocalProjectsModel.ts:88']);
  });

  /**
   * The other half of the same property, from the side that would break it. `open_in_editor` is
   * the tool with a motive: its whole purpose is to get a row into that list. It does it by asking
   * the editor, and this pins the *absence* of the shortcut — beside the presence control above,
   * so a scan that had silently stopped matching anything could not pass this pair.
   */
  it('and the MCP server is not it', () => {
    const mcpSrc = path.join(PACKAGES, 'noodl-mcp', 'src');
    const offenders: string[] = [];
    for (const file of sourceFiles(mcpSrc)) {
      fs.readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (writesTheStore(line)) offenders.push(`${path.relative(REPO, file)}:${i + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
