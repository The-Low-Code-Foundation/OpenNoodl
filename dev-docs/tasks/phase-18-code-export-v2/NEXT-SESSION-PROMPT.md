# Next session — 80/127 (63.0%), three shapes the exporter did not have are built; next by the same rule is Cloud Services, or the controlled-state gap

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Built, gated, **PUBLISHED 2026-09-01 — `@nodegx/core@0.1.0` on npm**. An exported app installs it from the registry and builds (exit 0). ⚠️ "not consumed by the emitted code" was **stale** — `state.ts` and `component.ts` both emit imports. 4 rows left for `0.1.1` |
| EXP-002 deterministic generators | 🟡 in progress, re-aimed at the picker |
| EXP-003 AI logic translation | not started |
| EXP-004 report & honesty UX | 🟡 built and driven; in-editor pre-flight + toast exist (EXP-012); the drill-down panel and the three lines that need Richard remain |
| EXP-005 / 006 / 007 | not started (006/007 blocked on 002 having a generator to inject into) |
| EXP-008 coverage ledger + gate | ✅ Built — ⚠️ `export-ledger:check` had been **red on committed code since `4e5e0fc0`** (a peer's catalog hunk added `noodl.cloud.listusersinrole` with no entry); fixed s68, §39.6 |
| EXP-009 backend connection | 🟢 built + driven; AC4 waits on a Cloud Services node |
| EXP-010 custom nodes & modules | 🟢 Route B built + driven; Route A not owed |
| EXP-011 picker coverage | 🟡 **80/127 (63.0%)** — Tier 1, 2.5, 2.7 complete; **§39 built `Log`, `Delay`, `Value Changed` (s68)**, driven headlessly; next rows in §39.7 |
| EXP-012 the editor export command | 🟢 built + driven s67, rides 0.2.2 |

## 🔴 What session 68 did

Richard: *"continue phase 18 to try to attack the most common nodes to publish the maximum number
we can with 0.2.2, at least to give people a taste."* §38.5 had left three shapes written down and
the session built all three — **each the first of its kind in the exporter**:

- **`Log`** — an action (`log(level, message, data)` into `src/lib/util.ts`, then the Done chain
  as following statements), with `Value` passed straight through in `resolveExpr` *and* Pass 4c.
- **`Delay`** — the first node whose action port is a **set** (Start/Restart/Stop), the first
  **`useRef`**, and a fourth emitted library `src/lib/timer.ts` (two `setTimeout`s transcribing
  `timerscheduler.ts`; verbs answer Done/Unchanged; Started/Finished are the callbacks; an unmount
  cleanup is `addDeleteListener`).
- **`Value Changed`** — the first **effect() slice** (§9.6 named it in session 38): a `useEffect`
  over the Input with the last value in a ref, the node's own `set` line for line.

Graded by `tests/log-delay-value-changed.test.ts` (34 rows: two differentials against the
interpreter's own `log.ts` and `timerscheduler.ts`, the latter driven frame by frame at the same
instants; 17 translation rows; the fixture), **five mutant arms all killed by their own rows**, and
the fixture `tests/fixtures/tick-desk` **built and driven** over CDP through twelve steps written
down first (§39.5). Picker floor 77 → 80. ✅ **All gates green on the final source.**

## 🔴 Read this before planning anything

1. 🔴 **The attach pass was wire-ORDER dependent** (§39.3). A chain wire listed *before* the wire
   that fires its node was reported dropped and then emitted anyway — a false note about working
   code, invisible to every hand-built test because `connect()` appends the trigger wire first.
   Fixed for the three new nodes with the popup's `continue`. ⚠️ **Not measured for `External
   Link`, `Now`, the id pair and `HTTP Request`** — one graph each with the chain wire first
   settles it; the fix is one line per family. **Do this before trusting any fixture-found note.**
2. 🔴 **A verdict sweep that runs before the effect passes names a translated node as "never
   fired".** The Log/Delay sweep now runs after the reactive Condition and Value Changed passes.
   ⚠️ The date/util/id sweep has the same hazard for a `Now`/`Unique Id` fired only from a
   reactive Condition's arm — unmeasured.
3. 🔴 **`toEqual` reads `['x', undefined]` as `['x']`.** A differential about whether a trailing
   argument is passed passed trivially until `toStrictEqual`. Any row about argument lists owes it.
4. ⚠️ **A control's mutation can be a deliberate redundancy.** Removing `clearTimeout` from
   `stopDelay` survives because the finish callback's identity guard makes it a no-op; recorded in
   the test file so nobody retries it. The Start-while-running guard is the control that works.
5. ⚠️ **Drive margins are part of the instrument.** One row read `Finished` with ~50 ms of margin
   against ~40 ms of CDP round-trips and could not tell the old countdown firing from the new one
   finishing on time. Re-driven with `performance.now()` in the page: 405 ms after the restart,
   the old Finished (due at 335 ms) had not fired. Read the clock in the page, not the driver.
6. ⚠️ **A peer published `@nodegx/core@0.1.0` to npm mid-session** (22:29) and edited EXP-001,
   PROGRESS, README and this file's EXP-001 row. Their row is preserved above; their EXP-001 edit
   is theirs to commit. Re-derive from the FILES before believing this table.
7. 🔴 **The exporter is compiled twice** (s67's rule, still true): run
   `tsc -p packages/noodl-editor/tsconfig.json --noEmit` after any exporter edit — exit 0 s68.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The numbers

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 1332/1332, 51 suites, 51 files on disk
cd ../noodl-editor && ../../node_modules/.bin/tsc -p tsconfig.json --noEmit   # exit 0
npm run export-ledger:picker                  # from the repo root — 80/127 (63.0%), floor 80
npm run export-ledger:check                   # OK — 176 types (was red on HEAD before s68)
```

🔴 The corpus audit is a regression net, never a priority oracle — 60 projects. `build-corpus.ts`
was not re-run this session (⚠️ pre-existing red: TPL-001 `MemberRow.tsx` `TS7053`).

## Do this next — in the order they are worth doing

### 0. The order-dependence probe (item 1 above) — one graph per family, before anything else
Cheap, and it decides whether four families' fixture notes can be believed.

### 1. Cloud Services (9) — the biggest unmeasured block, "mostly unblocked by EXP-009" since s35
`Cloud Function` (3 corpus projects, 7 nodes — the commonest of the nine), `Record`, `Set User
Properties`, `Sign In With`, `Request Magic Link`, `Subscribe To Changes`, `Upload File`, `Cloud
File`, `Sign File URL`. Re-measure against the EXP-009 client before planning; several may fall
out for free. Every one is +1 on the picker.

### 2. 🔴 The controlled-state gap §38.3 found — a checkbox or slider writing a Variable
Extend the controlled-state slice from text inputs to `checkbox.checked` and `range.value`;
`mood-desk` is the fixture to re-wire. Beside it: `Set Variable` with a **typed** value is refused
(§38.3 #2, `NONE`) — three fixtures have now routed around it with `String`/`Number` constants.

### 3. `Component Children` — Tier 3.10 on paper, a component library's commonest node in practice

### 4. The animation pair — `States` (10 corpus projects, 27 nodes: the commonest unexported node
in the corpus) and `Animate To Value`. Time-based and stateful; `Delay`'s ref + timer library is
now the precedent for both.

### 5. The row-owned write (§34), EXP-004's drill-down panel, a launcher entry, `Unique Id`'s
`Completed` (§37.4), the 36 the sweep could not reach (§35.6), children inside an instance (§34.5),
the `dynamicports` fixture (§33.3), §31.1's limit #2, the three EXP-004 lines that need Richard —
all carried, unstarted, as in s67's prompt.

## 🔴 What session 68 would tell you if it could only say three things

1. **Count the toll before paying it.** `grep -n "'date-now-read'"` gave sixteen sites a new
   action kind owes; the compiler holds two. The other fourteen were each reached by a test row or a
   mutant arm before the session believed it had paid.
2. **A fixture's wire order is a test the hand-built graphs cannot run.** The connections file
   listed the chains first, and that alone found a false note three sessions of tests had walked
   past. Author fixtures with the trigger wire *last* on purpose.
3. **Write the drive's margins down with its answers.** The one row that could not exclude was the
   one whose timing was tighter than the transport; the re-drive read the page's own clock.

## Instruments

s68 scratchpad `db5d35cd-…/scratchpad`:
- **`mut.py`** — five arms (A–E, §39.4) plus `restore` from `snap-src-post/`; the loop that ran
  them is in the session transcript (tsc → jest --verbose → restore → `diff -rq`).
- **`harness/`** — s66's harness with `tick-desk` emitted, typechecked and built (`dist/`).
- **`drive.mjs`** (the twelve steps), **`drive-restart.mjs`** (the re-drive with page timestamps),
  **`EXPECTED.md`** (written before the app ran), `drive.log`, `drive-restart.log`.
- **`edit-plan.py`**, **`edit-component.py`** — the anchored edit scripts, every anchor asserted unique.
- `snap-src-pre/`, `snap-src-post/`, `jest-full.log`, `editor-tsc2.log`, `arm-*-jest.log`.

s66 `cae86ff3-…` — `mut.py`, `runmut.sh`, `arm.sh`, `harness/`, `corpus-harness/`, `drive.mjs`.
s62 `898de7ef-…` — the five from-disk sweeps and the **`v2only/` / `classiconly/`** symlink farms.

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes** — `grep -a`.

## The thirteen fixtures, and what each one already covers

| Fixture | Covers |
|---|---|
| `cheer` | the base for most hand-built graphs; `GlobalStore.Set/Subscribe`, popups, component IO, `For Each` |
| `note-desk` | a delete button in a list row — the relayed row signal, `Remove Object From Array`, a Done chain (§30) |
| `relay-desk` | three wires an author drew wrong (§31, §32) |
| `deadline-desk` | all six date nodes, plus `Now → Set Variable → Variable2 → Text` |
| `quote-desk` | `net.noodl.HTTP` with response mappings, `error`, `failure`, `canceled` |
| `reading-shelf` | `Collection2 → Filter Collection → Map Collection → For Each`, `Model2` prop minting |
| `puppy-test-3` | the richest export; EXP-004 markers, the README comprehension test, §35's orphan-node graft |
| `variable-dial` | variable typing |
| `kits` | custom nodes / modules |
| `ticket-desk` | the three small utilities — `Substring`, `String Mapper`, `Number Remapper` |
| `badge-desk` | the id pair — both generators, both rows, both Done chains, `UUID`'s `Error` |
| `mood-desk` | `Boolean To String` + `Color Blend` (§38) |
| `tick-desk` | **`Delay` (all three verbs, all four chains), `Log` (with `Value` passed through to a Text), `Value Changed` watching a Variable — and the chain wires listed BEFORE their triggers (§39.3)** |

**No fixture has**: a `PageInputs` node, a braced `urlPath`, an `External Link`, a `Navigate To
Path`, an untyped store key, a wire into a port that already carries an authored value, a refused
script on a node that is not a Function, a `dynamicports` entry on a repeater (§33.3), a child
authored inside a component instance (§34.5), a deferred node with no wires at all (§35.5), **or a
Delay driven from a reactive Condition or a Value Changed** (the §39.3 ordering hazard's other half).

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files. ⚠️ A *new* test
file or fixture is untracked, and `git commit <pathspec>` **errors** rather than skipping it —
`git add` it and commit in the same command so the staging window stays closed. ✅ s64, s65 and s66
all did exactly this.
⚠️ **Delete scratch scripts from `scripts/` and probe specs from `tests/` before committing** — and
**reconcile the suite count against disk** (`ls tests/*.test.ts | wc -l`). 51 files, 51 suites at
the end of s68.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

🔴 **Check for a peer's suite before running yours** — `ps` for `jest`/`vitest`. s68's checkout carried a peer's
uncommitted edits in P18's OWN docs (item 6 above) — `git log -5 -- <path>` before any doc write. ⚠️ **A peer committed P77's and `noodl-mcp`'s dirty files mid-session** — that is
normal, and pathspec commits meant nothing of theirs was swept.
⚠️ **`test:ci` was not run by this session and was not needed** — nothing outside
`packages/nodegx-export` and `dev-docs/` was touched.

⚠️ **The shell's cwd is reset between calls and parallel `cd`s race** — use absolute paths in
anything you send in parallel. 🔴 **A glob stored in a shell variable does not expand in zsh**.
🔴 **`cmd | head; echo $?` reads `head`'s exit code** — redirect to a file and echo `$?` on its own.
⚠️ **`timeout` is not on this machine** (BSD), and **`uniq -w` is not either**.
⚠️ **`sleep N` chained before another command is blocked by the harness** — background the command
and poll, or use an until-loop.

## Mutating to prove a checker's reach

The pattern that produced §26.3, §27.5, §29.4, §30.4, §31.3, §32.5, §35.5, §36.5 and §37.5:

1. `cp -a src <scratchpad>/snap-src/` first — and take a **second** snapshot *after* the fix,
   because the pre-fix one is not a mutant undo (§28's trap).
2. Mutate **by asserting the anchor's uniqueness before replacing it** — a python
   `assert s.count(old) == n` that fails leaves the source untouched.
3. ⚠️ **A mutant that breaks the typecheck reads as `Tests: 0 total`, not as a kill.** Check `tsc`
   on each mutant. ✅ s66's `runmut.sh` does it automatically.
4. Run **both** the new rows and the control rows. The finding is the *disagreement*.
5. ✅ **A survivor is a finding, not a failure.** s66 had two: one was a **real hole** (a clause
   nothing graded — a row was added and it now kills), the other was a **deliberate redundancy**
   proving the alternative site would have been dead code. They read identically in the log and
   mean opposite things.
6. Name the killed rows with `--verbose` — jest prints no per-test lines for a multi-suite run.

## Building and driving an exported app

- **`scripts/emit-app.ts` is the honest runner** — `emit-app.ts <project> <outDir>`, or
  `--preflight <project>`. 🔴 **It only accepts a v2 project** (`nodegx.project.json`).
- ✅ **For a corpus-wide question, call `parseProject` + `planProject`/`emitApp` in-process**
  rather than shelling `emit-app.ts` 60 times.
- 🔴 **The build is still the only instrument for the real third-party libraries.**
- ✅ **`typecheckEmittedApp` (`tests/helpers/typecheckApp.ts`) is the cheap instrument** — it takes
  the **app**, not `app.files` — use it on any row asserting emitted text, because **a `toContain`
  passes on dead code** (§24.3).
- Harness: `cp -a` a prepared harness (so the `@nodegx/core` symlink survives), `rm -rf src dist
  tsconfig.tsbuildinfo`, then emit into it. ⚠️ The emit **does** overwrite `package.json`.
- 🔴 **Author a fixture project by copying an existing one**, and ⚠️ **watch the collateral** — a
  copy carries the source's `componentId`s, `name`, `path` and the router's page list, and every
  one of those has to be rewritten or two fixtures collide.
- ⚠️ **A test-built node needs its parent's `children` array, not just a `parent`.** A node with
  only a `parent` is not in the render tree, so the read lands in nothing and a `not.toContain`
  half of an assertion passes while testing nothing. (Cost s66 one red.)
- Serve with `npx vite preview --port 53xx --strictPort`; stop it by port
  (`lsof -ti :53xx -sTCP:LISTEN | xargs kill`). ⚠️ **`vite preview` binds `localhost`, and
  `curl 127.0.0.1` gets nothing.**
- 🔴 **Poll for readiness, never sleep.**
- 🔴 **The scaffold's router has `<Route path="*" element={<Navigate to="/" replace />} />`.**
- ⚠️ **A React input needs the native value setter plus an `input` event.**
- 🔴 Click with `Input.dispatchMouseEvent`, never `element.click()`. Read `textContent` per element.
- ✅ **Assert a positional readout against a known row** — s66's drive reads all `<p>` in DOM order
  and throws unless row 0 is the headline, so a reordered page fails loudly instead of quietly
  reading the wrong element.
- 🔴 **Write the expected answers down before the app runs**, then **sabotage in separate arms** —
  and pick the case that *excludes*, not the one that merely fits.
- ⚠️ **An error row is never cleared** on `External Link`/`Navigate To Path` — a success row must
  run **before** any failure row. 🔴 **`UUID` is the opposite** and clears on success (§37.2).

## Driving the editor, if the next question needs it

- 🔴 **Check for a peer's suite before launching.** A webpack build beside a peer's suite gives
  both of you flakes.
- 🔴 **Open a COPY, and rename its `name` field.**
- 🔴 **`route({to:'editor', project})` does NOT swap an already-open project.** Reload between
  projects and assert the loaded name in the readout — s61's `probe.js` prints it.
- ✅ **The module cache reaches everything**:
  `webpackChunknoodl_editor.push([[Symbol()],{},r=>{window.__req=r}])`, then
  `__req('./src/editor/src/models/warningsmodel.ts')`. `nodelibrary` is at
  `models/nodelibrary/index.ts`, not `models/nodelibrary.ts`.
