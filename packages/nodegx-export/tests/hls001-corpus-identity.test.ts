/**
 * HLS-001 AC3 — a packaging change does not change a single emitted byte.
 *
 * HLS-001 moved two modules into `@nodegx/project-contract`, added a build, and made the manifest
 * publishable. None of that is allowed to alter what the exporter emits. The golden beside this
 * file was generated **at `11b2d3a9`, before the first of those edits**, over the 42 projects that
 * were already in `tests/fixtures/` — artefacts other tasks put there, never a fixture minted for
 * this one, because a budget measured on a fixture only ever bounds the fixture.
 *
 * ## What this gate can and cannot see
 *
 * 🔴 **It is blind to `detectIO`.** Not one of the 42 corpus projects contains a Logic Builder
 * node — measured, and the reason it is written here rather than assumed: an identity gate that
 * never reaches the module you moved reads green for the wrong reason. What grades that half is
 * `@noodl/runtime`'s own eight `logic-builder-*` suites and the editor's `lgc-*`/`vfn-*` specs,
 * which run against the moved code through the re-export.
 *
 * ✅ It is **not** blind to the token vocabulary: changing one value in
 * `@nodegx/project-contract/tokens` moves 42 of these hashes (every project's `tokens.css`). That
 * control was run in both directions — against the editor's old copy before the move and against
 * the contract package's copy after it — so the corpus is known to reach the module, not merely
 * known to agree with itself.
 *
 * 🔴 **If this goes red, the honest first question is what changed in the export, not whether the
 * golden is stale.** Regenerating it (`HLS001_REGENERATE=1 npx jest hls001-corpus`) is a design
 * conversation, exactly like the hand-written goldens elsewhere in this suite — a red count gate is
 * answered by counting the artefact, never by bumping the literal.
 *
 * ## Two instruments, and which one proves which thing
 *
 * ⚠️ **This golden is generated under jest, from the tree after the move, so on its own it cannot
 * prove the move changed nothing.** What proves that is a separate pair of runs recorded in the
 * task file: `scripts/corpus-hashes.ts` under `ts-node` at `11b2d3a9` and again after the last
 * edit — 42 projects, 840 hashes, zero differing, with the token mutant moving 42 of them in both
 * directions. This file is the *forward* net: it keeps the corpus honest from here on.
 *
 * 🔴 The two runners disagree about exactly three hashes, all in the `kits` project, and the
 * disagreement is a **product defect rather than a test artefact**: `kitSource.ts:188` and
 * `parseModules.ts:98` both narrow with `error instanceof Error ? error.message : String(error)`,
 * which is **false for an error that crossed a realm boundary** — jest's context, and in the
 * product the `vm` context a kit's own source is executed in. So a kit that throws is reported as
 * `(SyntaxError: Unexpected token 'export')` and one that fails to be read as
 * `(Unexpected token 'export')`, and which wording a user gets depends on where the error came
 * from. Filed as C41 against HLS-005, whose subject is what the report says. Not fixed here: this
 * task is a packaging change and a fix would move these hashes.
 */
import * as fs from 'fs';
import * as path from 'path';

import { corpusHashes, corpusProjects } from '../scripts/corpus-hashes';

const GOLDEN = path.join(__dirname, 'goldens', 'hls001-corpus.sha256.json');

// `HLS001_REGENERATE=1` rewrites the golden from this runner. Deliberately an explicit opt-in and
// not an auto-heal: a gate that repairs itself on red grades nothing.
if (process.env.HLS001_REGENERATE === '1') {
  fs.writeFileSync(GOLDEN, JSON.stringify(corpusHashes(), null, 2) + '\n');
}

describe('HLS-001 AC3 — emitApp over the corpus is byte-identical', () => {
  const golden: Record<string, Record<string, string>> = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));

  it('the corpus is the one the golden was taken over', () => {
    // Arming the instrument: a corpus that shrank to nothing would make the comparison vacuous.
    expect(corpusProjects().length).toBe(42);
    expect(Object.keys(golden).sort()).toEqual(corpusProjects());
  });

  it('the golden covers a non-trivial number of emitted files', () => {
    const entries = Object.values(golden).reduce((n, files) => n + Object.keys(files).length, 0);
    expect(entries).toBeGreaterThanOrEqual(800);
  });

  it('no project emits a different byte than it did before HLS-001', () => {
    const now = corpusHashes();
    const differing: string[] = [];
    for (const [project, files] of Object.entries(golden)) {
      for (const [file, sha] of Object.entries(files)) {
        if (now[project]?.[file] !== sha) differing.push(`${project}/${file}`);
      }
    }
    expect(differing).toEqual([]);
  });

  it('no project emits a file the golden does not know about', () => {
    const now = corpusHashes();
    const added: string[] = [];
    for (const [project, files] of Object.entries(now)) {
      for (const file of Object.keys(files)) {
        if (!(file in (golden[project] ?? {}))) added.push(`${project}/${file}`);
      }
    }
    expect(added).toEqual([]);
  });
});
