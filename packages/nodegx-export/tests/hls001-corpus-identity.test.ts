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
 * ✅ **C41 is fixed, and this golden was regenerated once, deliberately, because of it.**
 *
 * HLS-001 left the two runners disagreeing about exactly three hashes, all in the `kits` project,
 * and filed the disagreement as a product defect rather than a test artefact: `kitSource.ts` and
 * `parseModules.ts` both narrowed with `error instanceof Error ? error.message : String(error)`,
 * which is **false for an error that crossed a realm boundary** — jest's context, and in the
 * product the `vm` context a kit's own source is executed in. The same failure was reported as
 * `(SyntaxError: Unexpected token 'export')` or `(Unexpected token 'export')` depending on where
 * the error was constructed.
 *
 * HLS-002 hit it from the other end and could not proceed past it: its AC1 compares the editor's
 * export against `nodegx export` byte for byte, and the two trees agreed on all eighteen files
 * **except `EXPORT-REPORT.md`**, differing by exactly that prefix. A defect that blocks an
 * acceptance criterion is the task that finds it. Both sites now call `src/errorMessage.ts`,
 * which asks the value what it has rather than which constructor made it.
 *
 * 🔴 **What was counted before the golden was touched**, because a red count gate is answered by
 * counting the artefact and never by bumping the literal:
 *
 *  - `scripts/corpus-hashes.ts` under `ts-node`, after the fix, against the pre-fix golden:
 *    **3 of 840** hashes differ — `kits/@notes`, `kits/@report`, `kits/EXPORT-REPORT.md`. The
 *    same three HLS-001 recorded, and no others: the fix moved what it was supposed to move.
 *  - after regenerating under jest: **3** hashes changed, and jest and `ts-node` now agree on
 *    **all 840**, where they disagreed about 3 before. The convergence is the evidence that what
 *    was fixed was the realm sensitivity rather than the wording.
 *
 * ✅ **Regenerated a second time by HLS-004, and here is what was counted first.**
 *
 * HLS-004 changed the re-hosted JS wrapper's input contract (`jsWrapperLines` in
 * `src/emit/component.ts`), so unlike HLS-001 it *is* allowed to move bytes — which makes the
 * count the whole of the evidence, not a formality. Against the pre-HLS-004 golden:
 *
 *  - **2 of 840** hashes differ: `batch-desk/src/pages/Home.tsx` and `cheer/src/pages/Home.tsx`.
 *    They are the only two corpus projects with a re-hosted `Function` or `Expression`, and the
 *    diff in each is confined to the wrapper's signature line and the scope binding beneath it.
 *  - **0** files appeared or vanished in any project that already existed.
 *  - **1** project was added — `budget-desk`, minted by HLS-004 because the corpus had no
 *    fixture doing arithmetic on a component input, which is why a green gate had never once
 *    compiled issue #24's shape. 🔴 It is a fixture minted for a task, which §1 above warns
 *    about: it bounds nothing on its own, and the 42 projects around it are what keep this gate
 *    honest. Its own claims are graded in `hls004-an-export-that-builds.test.ts`.
 *
 * ⚠️ The `42` above is left as written: it is the count HLS-001 took, and the row below now
 * asserts 43 because a project was deliberately added. The two numbers disagreeing is the record.
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
    //
    // 43 → 44 on 2026-09-09 (HLS-005), counted off `ls tests/fixtures/`, not inferred from the
    // failure: `status-rail` is issue #23's own table reconstructed as a project, added because
    // the golden's 43 already carried the defect but none of them carried it in the shape the
    // issue describes — one input reaching three sinks of which two survive.
    expect(corpusProjects().length).toBe(44);
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
