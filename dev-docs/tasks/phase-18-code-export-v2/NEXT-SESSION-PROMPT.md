# Next session — the sweep came back clean, and the refusal that was sending authors the wrong way

## Where the phase stands

Session 60 did the sweep §30.3 asked for, and it came back **clean** — the exporter holds no
unfound instance of that defect class. The thing it found on the way was a different defect
standing in the same place. §31 has the long form.

- ✅ **The §30.3 sweep is done, from disk, on the whole population.** `ConnectionIR.kind` has
  exactly one consumer and it already carries all three hatches; `catalog.portKind` has exactly one
  caller and it *is* the fallback; and a probe over the 8 fixtures + ~60 real projects listed every
  connection that reaches the `'value'` fallback. Every one is classified in §31.1's table.
- ✅ **§30.3's fix has real reach, measured not inferred.** `itemOutputSignal-Selection Changed` in
  `cn027-drive` now gets past the handler gate and is dropped for a downstream reason instead.
- 🔴 **One refusal branch was serving two populations and its sentence was true of only one.** A
  bare relay name on a repeater (`addToBasket`) is **no port at all**, not a lifecycle pulse — the
  wire is dead in the editor too. **26 wires in 9 real projects** were being told to wait for a
  later exporter increment when the truth was "go and re-draw this". Fixed, split on the catalog,
  graded off disk by a new fixture and two mutants that disagree.

## 🔴 Read this before planning anything

1. 🔴 **`itemOutput-<name>` is still the single port in front of the rest of this slice** (§30.5).
   Nothing this session changed that. It blocks `Set Object Properties`.
2. 🔴 **A hand-built row was again the thing hiding the defect.** `component-outputs` §4 asserted
   the wrong sentence *and its comment reasoned its way there* ("a bare name can only be one of its
   own pulses" — the step that does not follow). Two sessions running. When a row asserts a
   *reason*, ask what population that reason is true of.
3. ⚠️ **The sweep's limits, stated so nobody re-reads it as broader than it was**: it reads
   **source** ports on projects **that exist on disk**. A catalog that disagreed with the runtime
   about a port it *does* declare would not appear in it, and neither would the target-port side.
   Both are open questions, and neither is examined by anything.
4. ⚠️ **The probe is worth keeping** — it is ~60 lines of Python and it re-found §30.3's defect
   unprompted, which is how it was calibrated before being believed. It is in the s60 scratchpad
   as `fallback_probe.py`; it is not in the repo.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The numbers

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 1153/1153, 46 suites (1131/45 before §31); ~20 s
npm run export-ledger:picker                  # from the repo root — 70/127 (55.1%), unchanged
npm run export-ledger:check                   # 175 types
```

🔴 The corpus audit is a regression net, never a priority oracle.
🔴 Custom node types are **deliberately** outside the picker number — `$customNodesComment` in
`packages/nodegx-export/coverage-ledger.json` says why.

## Do this next — in the order they are worth doing

### 1. 🔴 The product finding §31 could not close — owned by `NONE`, and it needs one cheap check first

Two families of wire in real projects point at ports **the runtime never registers**: a `For
Each`'s bare relay names (26 wires, 9 projects) and `SetModelProperties`'s `stored` (8 wires, 5
projects — renamed to the shared `done` by ERG-001 §4, which migrated `library/prefabs`' seven
connections but could not migrate anybody's project). In both, the author's graph looks wired and
does nothing.

🔴 **What was measured is that the port is unregistered. What was *not* measured is whether the
editor warns about it.** Do that check before anything else — it decides whether this is a silent
failure worth a phase or a reported one already handled. `packages/noodl-mcp/src/graph.ts` has no
port-existence validation on connections, which is a hint and not an answer; the editor is a
different surface and is the one that matters.

### 2. 🔴 Decide whether a relayed row *value* has a carve-out — the last port in this slice

`itemOutput-<name>` reaches the page as "whichever row fired last". Inside the row's own callback,
though, the value is knowable **whenever the template's output port is a pass-through of a prop**
— a static fact about the template, readable from `templatePlan`. If that carve-out is real,
`Set Object Properties` from the page unblocks with it. If it is not, say so with the measurement.
Owned by **`NONE`**; §30.2 and §30.5 have the derivation.

### 3. The fixtures nothing reaches

`relay-desk` (§31) closes "a project containing a wire the author drew wrong" — the first coverage
the five whole-corpus sweeps have of that. §26.1's list still holds for: a `PageInputs` node, a
braced `urlPath`, an `External Link`, a `Navigate To Path`, an untyped store key, a wire into a
port that already carries an authored value, and a refused script on a node that is not a
Function. Each is a hand-built graph away.

### 4. Three EXP-004 lines still need Richard, not a session

None can be closed by whoever wrote the artefact; all three are recorded as unrun, not ticked:

- **The comprehension test** — *"a developer unfamiliar with the project reads the exported README
  and can state what needs doing without asking questions."* `tests/fixtures/puppy-test-3` exports
  the richest example.
- **The external review of the verification wording** (implementation step 6).
- **Whether the preserved source block actually helps** — the code is *there*; whether a developer
  can rewrite `formatList` from it is still unmeasured.

### 5. Decide whether the editor gets an export command at all — Richard's call

`@nodegx/export` still has **no consumer anywhere in the product**; the only way to run an export
is `ts-node scripts/emit-app.ts` by hand. The in-editor report is blocked on an editor export
command — a feature, not a wiring job — and is owned by **`NONE`**. §21.1 has the evidence.
**Ask before building it.**

### 6. Smaller, and each decidable on its own

- The two sweep limits in §31.1 — a catalog/runtime disagreement over a declared port, and the
  target-port side. Neither is examined by anything. Cheap to scope, unknown to close.
- `Navigate To Path`'s `Completed` chain (§24.6) — still refuses an `Error` read, deliberately.
  **Decide before starting; not obviously worth it.**
- The date family's signals, and the repeater's lifecycle pulses (`itemsRendered`, `done`,
  `completed`, `failure`) — one `effect()` slice, not two (§9.6, §29.5). ⚠️ §31's census found
  **zero** such wires anywhere in the corpus, which is a real argument about its priority.
- EXP-009 leftovers — drive the exported login/admin forms; delete the drive-residue user
  `exp009-drive` from the local Puppy backend's `_User`.

## 🔴 What session 60 would tell you if it could only say three things

1. **A clean sweep is a result, and it is only worth what its population is worth.** "No other
   instance of the §30.3 class" means something because it was measured over ~68 projects on disk
   and calibrated on a known-firing case first — not because the code was read and looked fine.
2. **A refusal is a recommendation to a person.** The disposition was right in all 26 cases and the
   *reason* sent the author the opposite way from the truth. A branch can be correct about what it
   does and wrong about what it says, and only the second one bites a human.
3. **When one predicate serves two populations, make the two disagree.** The mutant that answers
   "registered" everywhere and the one that answers "not registered" everywhere kill disjoint rows.
   Either alone would have looked like a passing suite.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files. ⚠️ A *new* test
file or fixture is untracked, and `git commit <pathspec>` **errors** rather than skipping it —
`git add` it and commit in the same command so the staging window stays closed.
🔴 **A peer was editing `packages/nodegx-export/src/emit/style.ts` and `tests/visual.test.ts`
during session 60**, interleaved by mtime with this session's edits in the *same package*. Both
were left untouched and uncommitted here. Check `git status` against your own mtimes before
assuming a dirty file in this package is yours.
⚠️ **Delete scratch scripts from `scripts/` and probe specs from `tests/` before committing** —
and **reconcile the suite count against disk** (`ls tests/*.test.ts | wc -l`), which is what
catches a probe left behind. (46 files, 46 suites at the end of s60.)
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

⚠️ **`test:ci` was not run by this session and was not needed** — nothing outside
`packages/nodegx-export` was touched. If you touch `noodl-runtime`, run it yourself rather than
inheriting a relayed floor.

⚠️ **The shell's cwd is shared and parallel `cd` calls race** — use absolute paths in any command
you send in parallel. 🔴 A `cd` inside a compound command persists into later tool calls, and s60
lost two calls to exactly that. 🔴 **`cmd | head; echo $?` reads `head`'s exit code, not `cmd`'s** —
redirect to a file and echo `$?` on its own. ⚠️ **`timeout` is not on this machine** (BSD).
✅ **Restore a mutated `src` with `cp -a snap/src/. src/` and then `diff -r`.**

## Mutating to prove a checker's reach

The pattern that produced §26.3, §27.5, §29.4, §30.4 and §31.3, and it is worth reusing:

1. `cp -a src <scratchpad>/snap/` first — and take a **second** snapshot *after* the fix, because
   the pre-fix one is not a mutant undo (§28's trap).
2. Mutate **by asserting the anchor's uniqueness before replacing it** — a python
   `assert s.count(old) == 1` that fails leaves the source untouched.
3. ⚠️ **A mutant that breaks the typecheck reads as `Tests: 0 total`, not as a kill.** Check `tsc`
   on the mutant before believing its result. (§30 hit this; §31 checked both mutants and both
   were clean.) A boolean mutant like `String(x).length >= 0` keeps narrowing intact where a bare
   `true` may not.
4. Run **both** the new rows and the control rows. The finding is the *disagreement*.
5. Name the killed rows with `--verbose` — jest prints no per-test lines for a multi-suite run.

## Building and driving an exported app

- **`scripts/emit-app.ts` is the honest runner** — `emit-app.ts <project> <outDir>`, or
  `--preflight <project>` for the read-standing-up summary (writes nothing). ✅ It runs happily
  against a project **outside** `tests/fixtures`, which is how §31 graded real projects.
- 🔴 **The build is still the only instrument for the real third-party libraries.**
- ✅ **`typecheckEmittedApp` (`tests/helpers/typecheckApp.ts`) is the cheap instrument** — use it on
  any row asserting emitted text, because **a `toContain` passes on dead code** (§24.3).
- Harness: `cp -a` a prepared harness (so the `@nodegx/core` symlink survives), `rm -rf src dist
  tsconfig.tsbuildinfo`, then emit into it. ⚠️ The emit **does** overwrite `package.json` (renaming
  the app); `node_modules` survives, so the build still works — but do not expect it to be intact.
- 🔴 **Author a fixture project by copying an existing one** — §31 built `relay-desk` from
  `note-desk` in minutes. ⚠️ **Watch the collateral**: feeding the new component from an existing
  `Collection2` broke `note-desk`'s removal (two consumers fail `Remove`'s gate 3) and quietly
  changed what the fixture was grading. Re-read the *whole* report after touching a fixture, not
  just the lines you came for.
- Serve with `npx vite preview --port 53xx --strictPort`; stop it by port
  (`lsof -ti :53xx -sTCP:LISTEN | xargs kill`). ⚠️ **`vite preview` binds `localhost`, and
  `curl 127.0.0.1` gets nothing.**
- 🔴 **Poll for readiness, never sleep.**
- 🔴 **The scaffold's router has `<Route path="*" element={<Navigate to="/" replace />} />`.**
- ⚠️ **A React input needs the native value setter plus an `input` event.**
- 🔴 Click with `Input.dispatchMouseEvent`, never `element.click()`. Read `textContent` per element.
- 🔴 **Write the expected answers down before the app runs**, then **sabotage in separate arms** —
  and pick the case that *excludes*, not the one that merely fits (§30.4: the **middle** row).
- ⚠️ **An error row is never cleared** — a success row must run **before** any failure row.

## The nine fixtures, and what each one already covers

| Fixture | Covers |
|---|---|
| `cheer` | the base for most hand-built graphs; `GlobalStore.Set/Subscribe`, popups, component IO, `For Each` |
| `note-desk` | **a delete button in a list row** — the relayed row signal, `Remove Object From Array`, a Done chain (§30) |
| `relay-desk` | **a wire the author drew wrong** — a repeater port that names no output, beside a real lifecycle pulse (§31) |
| `deadline-desk` | **all six date nodes**, plus `Now → Set Variable → Variable2 → Text` |
| `quote-desk` | `net.noodl.HTTP` with response mappings, `error`, `failure`, `canceled` |
| `reading-shelf` | `Collection2 → Filter Collection → Map Collection → For Each`, `Model2` prop minting |
| `puppy-test-3` | the richest export; EXP-004 markers and the README comprehension test |
| `variable-dial` | variable typing |
| `kits` | custom nodes / modules |

**No fixture has**: a `PageInputs` node, a braced `urlPath`, an `External Link`, a
`Navigate To Path`, an untyped store key, a wire into a port that already carries an authored
value, or a refused script on a node that is not a Function.

## Instruments

s60 scratchpad `3685c239-…/scratchpad` — **`fallback_probe.py` (the §31 sweep, reusable)**,
`snap-src` (pre-§31), **`fixed-src` (post-§31, the correct mutant undo)**, `mut.py`, `mutA.log`,
`mutB.log`, `jest-final2.log`, `cn027-out`/`cn027-out2` (a real project before and after the fix),
`relay-out2`, `tut003-out`.
s59 `1d23bd1f-…` — `snap-src`, `fixed-src` (pre-/post-§30), `drive.mjs`, `app/` (a built, driven
export of `note-desk`), `EXPECTED.md`.
s58 `85b9297a-…` — `snap-src`, `fixed-src` (pre-/post-§29).
s57 `2fc5fa30-…` — `snap/src` (pre-§28). ⚠️ pre-fix: not a mutant undo.
s56 `0258c50b-…` — `snap/src`, `refused-map.ts`, `contract.ts`, `control.ts`, `probe.ts`.
s55 `756fcbe6-…`. s54 `61e7da69-…`.
s53 `efd50c1e-…` — `harness/` (a built export with `node_modules` and the `@nodegx/core` symlink),
`drive.mjs`, `arm.sh`, `EXPECTED.md`. **The harness is intact and s59 used it.**
s52 `e4b8cbef-…`; s51 `9fcea17d-…`; s50 `e54aeffc-…`; s49 `481a2793-…`; s48 `e6b5ff80-…`;
s47 `99fc4b87-…`; s46 `cf0e64bb-…/openarm/`; s44 `7408cf11-…`; s43 `2011a26f-…`; s40 `1a63a0f6-…`.

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a` / `grep -a`.
