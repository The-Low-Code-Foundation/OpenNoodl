# HLS-002 — what was built

**Session 3, 2026-09-09.** `nodegx export` exists, both front doors produce byte-identical trees
over a real project, and the pack-and-run gate register row C44 asked for is now a spec that runs
every time.

**4 of 4 acceptance criteria closed.** Two defects were fixed on the way because they blocked AC1,
and two more were found by gates that had never been run.

---

## 1. The command

```
nodegx export <project> <output>          write the app
nodegx export --dry-run <project>         print what it would produce, write nothing
nodegx --help | --version
```

`--preflight` is kept as an alias for `--dry-run`, because that is the name in the notes anyone
following `scripts/emit-app.ts` would have written down.

| code | cause |
|---|---|
| 0 | the export ran, or `--dry-run` found nothing left out |
| 1 | the arguments do not name a command |
| 2 | the project could not be read (absent, legacy `project.json`, or it would not parse) |
| 3 | the output folder was refused |
| 4 | `--dry-run`: something will not translate |
| 5 | a write failed part-way |

**Two decisions worth naming, both taken from the phase's standing warning — *decide refusals as
though nobody is watching, because in CI nobody is*:**

- 🔴 **A non-empty output folder is refused, not overwritten.** The editor asks; a pipeline has
  nobody to ask. `--force` is the answer, and the refusal names it. What this prevents is not an
  ugly message: it is a job that writes an export over an unrelated app, produces a folder that is
  half of each, and exits 0.
- 🔴 **`--dry-run` exits 4 when anything will not translate**, and 0 when nothing will. A check
  mode that always exits 0 is not a check. A *real* export with refusals still exits 0 — it
  succeeded, and the refusals are in `EXPORT-REPORT.md` — so a project with a known deferral can
  still ship.

**The trap the task named, answered:** the CLI cannot know whether an editor is holding unsaved
changes. There is no lock file, and opening a project writes no marker that says "held". So it
states what it read and when that was last written, on **stderr, every run, in both modes**:

```
Reading /path/to/project as it is on disk — last saved 2026-09-09 11:23:41.
If the editor has this project open with unsaved changes, save it first: this reads files, not the editor.
```

A warning conditional on something the process cannot observe is a warning that never fires. The
stamp is the newest mtime in the **read set** (the project file and the component tree), not the
time of the run — asserted by back-dating a copy and reading `2024-03-04 05:06:07` out of it.

## 2. One write loop, because that is what "the same export" means

`writeExport` and `checkTarget` moved from `noodl-editor` into `@nodegx/export`
(`src/write/writeExport.ts`), and `scripts/emit-app.ts` was **deleted**. It had its own write loop
— the duplicate that dropped the `copies` channel on the floor for a whole phase (P18 §19.6) with
every gate green.

The editor's command split in two:

- `utils/codeExport/exportSequence.ts` — the sequence (flush, refuse a legacy project, parse, emit,
  pre-flight, choose, check, confirm, write, report), with every editor singleton taken as a
  function. Reachable from the plain-Node runner, which is the point: **this phase's subject is
  that everything which ships an app is behind a click, and a sequence only a mouse can start is
  one only a mouse can grade.**
- `utils/codeExport/exportReactCode.ts` — the wiring that supplies ProjectModel, the popup layer,
  the toast layer and Electron's dialog. Twenty-odd lines, asserted at source level.

## 3. AC1 — and the defect it found

`tests-unit/hls002-two-doors/two-doors.test.ts` runs the `kits` corpus project through both doors:
the editor's own `runExportSequence` (singletons stubbed, sequence untouched — the stubs are also
what AC4 is asserted with), and the `nodegx` binary **spawned as a subprocess**. Then it hashes both
trees.

🔴 **They differed.** Eighteen files, twelve copied assets, one disagreement: `EXPORT-REPORT.md`.

```
< The kit could not be loaded (Unexpected token 'export').
> The kit could not be loaded (SyntaxError: Unexpected token 'export').
```

That is **register row C41**, filed by HLS-001 as an unexplained disagreement between two test
runners and backlogged to HLS-005. It blocks AC1, so it was fixed here (`src/errorMessage.ts`):
`error instanceof Error` is false across a realm boundary, and the fallback `String(error)` is not
`error.message` — it carries the constructor name. The duck test asks the value what it has rather
than which constructor made it, which is the only question with the same answer in every realm.

⚠️ It was not only cosmetic. `kitSource.ts` **pattern-matches** that string to decide whether a kit
is an ES-module build. The current regexes survive the prefix; the next one written might not, and
it would fail by misclassifying a kit rather than by throwing.

**What was counted before the golden was touched:**

| measurement | result |
|---|---|
| `corpus-hashes.ts` under `ts-node` after the fix, vs the pre-fix golden | **3 of 840** differ — `kits/@notes`, `kits/@report`, `kits/EXPORT-REPORT.md` |
| those three | exactly the three HLS-001 recorded, and no others |
| after regenerating the golden under jest | 3 hashes changed |
| jest vs `ts-node` after the fix | **0 of 840** disagree, where 3 did before |

The convergence is the evidence that what was fixed was the realm sensitivity rather than the
wording. Regenerating the golden was the design conversation its own header asks for, not a bumped
literal.

**The comparison is armed in both directions.** One row deletes a single copied asset from a copy
of the CLI's tree and requires the differ to name exactly that file; another appends one byte to
`EXPORT-REPORT.md` and requires it to name exactly that. Without them, "the trees agree" is a claim
about the comparator.

## 4. The pack-and-run gate (C44) — and what it caught in its first minute

`tests/hls002-pack-and-run.test.ts` builds, `npm pack`s, installs the tarball into `os.tmpdir()`
(asserted to be outside the repository) and runs the linked `nodegx` binary. ~7 seconds, no opt-in
flag — a gate that runs only when somebody remembers a flag is a gate that ran once.

🔴 **The first build produced a bundle with two shebangs.** esbuild hoists the source's `#!` above
the banner, and the banner carried one too; a `#!` on line 2 is a syntax error. **The build
reported success and every suite stayed green.** `node dist/cli.mjs --version` is what said
otherwise. `build.mjs` now fails the build unless the output begins with exactly one shebang, and
the installed file is asserted the same way.

The gate also holds the mode bit, the packaged catalog (named via `catalogPath()` rather than
written out, so HLS-001 AC4's one-reader count stays at one), and a real export with its assets
from outside the repo.

## 5. Two gates that were never wired to anything

Both found by running things this task needed to run, not by looking for them.

- 🔴 **The exporter's 86 suites and 3,140 assertions have never run in CI.** `@nodegx/export` is
  not in `test:packages`'s scope list and no workflow names it. Every claim this package makes
  about itself was graded only by somebody running `npx jest` by hand — HLS-001's three new gates
  included. Added to `test:packages`. **Measured, not estimated:** the suite was **337s** for 86
  suites / 3,140 tests before this task and is **406s** for 88 / 3,168 after it, and **336s of
  that is `typecheck-emitted.test.ts` alone**. Worth knowing before somebody blames the addition,
  and worth splitting if that job ever becomes the critical path.
- 🔴 **`npm run typecheck` — a PR gate — was red at HEAD.** HLS-001 moved the package's
  `main`/`types` to `dist/` and put its subpaths behind an `exports` map; the root program resolves
  at `moduleResolution: node`, which does not read an `exports` map, so `exportBadge.ts`'s
  `@nodegx/export/ledger` stopped resolving. Fixed with the two `paths` mappings the editor's own
  tsconfig has always had — **the identical incident is recorded three lines above them in that
  file** (CAN-002, `@noodl-versioning`, "18 TS2307s in files nobody had touched").

## 6. Acceptance criteria

| # | criterion | state |
|---|---|---|
| 1 | Both doors, one project, identical trees including copied assets | 🟢 `two-doors.test.ts`, byte-identical over 18 files and 12 assets, armed in both directions. Found and fixed C41 to get there |
| 2 | `--dry-run` writes nothing, asserted by mtime over the output path's parent, `mkdirSync` included | 🟢 `hls002-cli.test.ts`, with a control row proving the same measurement moves when a real export runs into that parent |
| 3 | Each exit code produced by a real cause and asserted distinctly | 🟢 six codes, ten rows, each provoking its own cause; a row asserts no two codes share a value |
| 4 | The editor's command still works, still shows the pre-flight and the toast | 🟢 seven rows against the stubs that observe them, plus the source-level assertion that nothing else in the editor writes an export |

## 7. What this leaves, and what it does not

**Leaves:** a `nodegx` binary that installs and runs outside the repo; one write loop behind both
doors; a realm-safe `errorMessage`; the exporter's suite wired into CI for the first time; a green
`npm run typecheck`.

## 6b. What the new specs cost, and one thing they caused

⚠️ **`hls002-cli.test.ts` is slow under contention and it is worth knowing why.** Alone it runs in
63s; inside the full package suite it takes 405s. It is twenty `ts-node` starts, and `ts-node`
startup is what is being contended for, not the export. The gate is still cheap in wall clock — the
whole suite went 337s → 406s — because it runs beside the 336-second `typecheck-emitted`.

⚠️ **The two-doors spec made a neighbour flake, once.** `tests-unit/rel-009b/projectFileWatcher`
asserts a latency ceiling on a file watcher, and it failed on the first full `test:main` run with
six CLI subprocess spawns in the same suite; it passed alone immediately after. The spec was
restructured to run each door **once** in `beforeAll` and to perturb *copies* of the resulting
trees — three spawns instead of six, 35s down to 26s — and a full `test:main` afterwards was
**440 suites, 7,302 tests, exit 0**. Recorded rather than dropped, because the next spec that
spawns subprocesses into that runner will meet the same neighbour.

**Does not leave:**

- ⚠️ **A drive of the real editor.** AC1's person sentence says "export through the editor's menu
  item". What was driven is `runExportSequence`, the module the menu item runs, with ProjectModel
  and Electron's dialog stubbed. The wiring between them is asserted as source text. A real drive
  would close that last inch and is a reasonable first thing for the next session to do.
- 🔴 **Any assurance that the export matches the canvas.** HLS-003 is untouched and is still the
  phase's distance.
- ⚠️ **A published package.** R1 is still unruled and nothing has been pushed to a registry.
- ⚠️ **A corpus that reaches Logic Builder**, unchanged from HLS-001.
