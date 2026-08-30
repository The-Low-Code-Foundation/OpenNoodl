# Next session — the editor does warn, and the prefix that was a claim rather than a fact

## Where the phase stands

Session 61 ran the check §31 asked for before anything else, and it came back **answered**: the
editor *does* report these wires. On the way it found a third family standing in the same place,
and that one was in this phase's own artefact, so it was fixed. §32 has the long form.

- ✅ **The `NONE`-owned product finding is no longer "a silent failure".** Driven in the real
  editor: `con-no-source-port` — *"Source port doesn't exist."*, level **error**, `showGlobally` —
  fires on project open for every one of these wires, **without navigating to the component**, and
  the topbar renders an amber **1**. The phase-sized version of that finding can be struck.
- 🔴 **The control failed, and that was the finding.** All three arms in `cn027-drive` warned,
  because `itemOutputSignal-Selection Changed` is *also* a dead port — its template declares
  `Selection Changed` as type `*`, so the runtime mints `itemOutput-Selection Changed`. The
  "control" was a third instance of the defect, drawn from the population being searched.
- ✅ **The exporter no longer trusts the prefix.** `repeaterRowSignal` tested the string alone, so
  that wire was refused for its *target* — *"the script reads the Noodl API — Tier B"*, which is
  §31.1's own evidence of "real reach" — telling the author to wait for an increment after which
  the wire still would not fire. It now reads the kind off the template's declaration, before the
  action compiles. Graded off disk by a third arm on `relay-desk` and two disjoint mutants.

## 🔴 Read this before planning anything

1. 🔴 **`itemOutput-<name>` is still the single port in front of the rest of this slice** (§30.5).
   Nothing this session changed that. It blocks `Set Object Properties`.
2. 🔴 **A control drawn from the searched population tests the predicate, not the boundary.** Mine
   did, and it read as "the check is noise" for one step. The honest control was `relay-desk`'s
   static `itemsRendered` beside its bare `removed` — one warning in the whole project.
3. 🔴 **A recorded number can be true and still read wrong.** §31.4's *"26 wires in 9 projects"* is
   arithmetically right; `md5` says nine of those are **one authored graph copied nine times**.
   Before a count argues a priority, ask whether its rows are independent.
4. ⚠️ **This session examined the *source* side only.** §31.1's two limits stand: a catalog/runtime
   disagreement over a *declared* port, and the target-port side. Neither is examined by anything.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The numbers

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 1158/1158, 46 suites (1153/46 before §32); ~53 s
npm run export-ledger:picker                  # from the repo root — 70/127 (55.1%), unchanged
npm run export-ledger:check                   # 175 types
```

🔴 The corpus audit is a regression net, never a priority oracle.
🔴 Custom node types are **deliberately** outside the picker number — `$customNodesComment` in
`packages/nodegx-export/coverage-ledger.json` says why.

## Do this next — in the order they are worth doing

### 1. 🔴 Decide whether a relayed row *value* has a carve-out — the last port in this slice

`itemOutput-<name>` reaches the page as "whichever row fired last". Inside the row's own callback,
though, the value is knowable **whenever the template's output port is a pass-through of a prop** —
a static fact about the template, readable from `templatePlan`. If that carve-out is real,
`Set Object Properties` from the page unblocks with it. If it is not, say so with the measurement.
Owned by **`NONE`**; §30.2 and §30.5 have the derivation.

⚠️ §32 built `templateRelayKind` in `plan.ts`, which already resolves a repeater's template
component from `ir.components` and reads its declared output kinds. That is most of the plumbing
this question needs.

### 2. The product finding, now scoped — still `NONE`, and no longer a phase

Not *"the editor hides it"*. The shape is: the **write path** that authors these wires cannot see
them (`rules/nonexistentPort.ts` abstains because `catalog.isDynamicNode('For Each')` is true, and
correctly — its mechanisms include `runtime-discovered`), while the **surface that reports it** has
no suggestion to offer. Both halves are named in §32.1.

⚠️ **The design question is already answered and should not be re-derived.** FIX-007 §fix-3 named
the layer — *"an eleventh check in `authoredPreconditionDiagnostics`, which has `catalog` and needs
no loaded NodeLibrary"* — and LAS-012's `repeaterTemplate.ts` is a precondition of exactly that
shape, built for the sibling defect, because `NormNode` carries no `parameters`. A For Each's
output ports are **statically derivable**: template parameter → that component's declared outputs →
the two prefixes. **Ask before building it** — it is editor work, not export work.

### 3. The fixtures nothing reaches

§26.1's list still holds for: a `PageInputs` node, a braced `urlPath`, an `External Link`, a
`Navigate To Path`, an untyped store key, a wire into a port that already carries an authored
value, and a refused script on a node that is not a Function. Each is a hand-built graph away.

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

- The two sweep limits in §31.1 / §32.6 — a catalog/runtime disagreement over a declared port, and
  the target-port side. Cheap to scope, unknown to close.
- `Navigate To Path`'s `Completed` chain (§24.6) — still refuses an `Error` read, deliberately.
  **Decide before starting; not obviously worth it.**
- The date family's signals, and the repeater's lifecycle pulses (`itemsRendered`, `done`,
  `completed`, `failure`) — one `effect()` slice, not two (§9.6, §29.5). ⚠️ §31's census found
  **zero** such wires anywhere in the corpus, which is a real argument about its priority.
- EXP-009 leftovers — drive the exported login/admin forms; delete the drive-residue user
  `exp009-drive` from the local Puppy backend's `_User`.

## 🔴 What session 61 would tell you if it could only say three things

1. **Answer the cheap question before building on top of it.** §31 left a finding owned by `NONE`
   and asked one question first. It cost about an hour, it struck a phase-sized item, and it
   changed what the remaining work *is* — from "the editor hides this" to "two surfaces each know
   half of it".
2. **When the control fails, read it before dismissing it.** Three arms warned and the first
   reading available was "the check is noise". The second was "my control is broken in the same
   way" — which was true, and was the session's best finding.
3. **A refusal is a recommendation to a person, and this is the third session running.** §31 fixed
   a sentence that sent authors to redraw; the same wire was still being told "wait for Tier B" one
   layer along. Ask what population a reason is true of, every time it is written down.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files. ⚠️ A *new* test
file or fixture is untracked, and `git commit <pathspec>` **errors** rather than skipping it —
`git add` it and commit in the same command so the staging window stays closed.
⚠️ **Delete scratch scripts from `scripts/` and probe specs from `tests/` before committing** —
and **reconcile the suite count against disk** (`ls tests/*.test.ts | wc -l`). 46 files, 46 suites
at the end of s61.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

⚠️ **`test:ci` was not run by this session and was not needed** — nothing outside
`packages/nodegx-export` was touched. If you touch `noodl-runtime`, run it yourself rather than
inheriting a relayed floor.

⚠️ **The shell's cwd is shared and parallel `cd` calls race** — use absolute paths in any command
you send in parallel. 🔴 A `cd` inside a compound command persists into later tool calls; s61 lost
one call to exactly that, as s60 lost two. 🔴 **`cmd | head; echo $?` reads `head`'s exit code** —
redirect to a file and echo `$?` on its own. ⚠️ **`timeout` is not on this machine** (BSD), and
**`uniq -w` is not either**.

## Driving the editor, if the next question needs it

s61 did, and it was worth it. The playbook that worked, beyond the `run-editor` skill:

- 🔴 **Check for a peer's suite before launching** — `ps` for `jest`/`vitest`. A webpack build
  beside a peer's suite gives both of you flakes. s61 waited ~4 minutes and lost nothing.
- 🔴 **Open a COPY, and rename its `name` field.** `cn027-drive`'s project file reads
  `"name": "cn019-drive"` — the launcher shows that name, so two cards are indistinguishable and
  the card you click is a coin toss you will not know you lost.
- 🔴 **`route({to:'editor', project})` does NOT swap an already-open project.** It returns success
  and the editor stays where it was; s61 measured one project twice before noticing. **Reload
  between projects, and assert the loaded name in the readout** — `probe.js` prints it.
- ✅ **The module cache reaches everything**:
  `webpackChunknoodl_editor.push([[Symbol()],{},r=>{window.__req=r}])`, then
  `__req('./src/editor/src/models/warningsmodel.ts')`. `nodelibrary` is at
  `models/nodelibrary/index.ts`, not `models/nodelibrary.ts`.
- ✅ **`WarningsModel.instance.warnings` is the whole readout** — component → ref → key, and each
  entry keeps its `ref.connection`, so a wire's warnings are readable without touching the DOM.

## Instruments

s61 scratchpad `759e5e4b-…/scratchpad` — **`probe.js` (opens a project over CDP and dumps every
warning, reusable)**, **`foreach_sweep.py` (the §32.3 census, calibrated against the editor)**,
`snap-src` (pre-§32), **`fixed-src` (post-§32, the correct mutant undo)**, `mutA.log`/`mutB.log`/
`mutA2.log`, `jestF.log`, `EXPECTED.md` (written before the drive), `editor-warning.png` (the
topbar badge), `cn027-out`/`out2`/`out3` (a real project before and after), `relay-out`.
s60 `3685c239-…` — `fallback_probe.py`, `snap-src`, `fixed-src`, `mut.py`.
s59 `1d23bd1f-…` — `drive.mjs`, `app/` (a built, driven export of `note-desk`), `EXPECTED.md`.
s58 `85b9297a-…`; s57 `2fc5fa30-…`; s56 `0258c50b-…`; s55 `756fcbe6-…`; s54 `61e7da69-…`.
s53 `efd50c1e-…` — `harness/` (a built export with `node_modules` and the `@nodegx/core` symlink),
`drive.mjs`, `arm.sh`, `EXPECTED.md`. **The harness is intact and s59 used it.**
s52 `e4b8cbef-…`; s51 `9fcea17d-…`; s50 `e54aeffc-…`; s49 `481a2793-…`; s48 `e6b5ff80-…`.

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a` / `grep -a`.

## Mutating to prove a checker's reach

The pattern that produced §26.3, §27.5, §29.4, §30.4, §31.3 and §32.5:

1. `cp -a src <scratchpad>/snap-src/` first — and take a **second** snapshot *after* the fix, because
   the pre-fix one is not a mutant undo (§28's trap).
2. Mutate **by asserting the anchor's uniqueness before replacing it** — a python
   `assert s.count(old) == 1` that fails leaves the source untouched.
3. ⚠️ **A mutant that breaks the typecheck reads as `Tests: 0 total`, not as a kill.** Check `tsc`
   on each mutant. A boolean mutant like `String(x).length >= 0` keeps narrowing intact.
4. Run **both** the new rows and the control rows. The finding is the *disagreement*, and §32's two
   mutants have **disjoint** kill sets.
5. ✅ **Read what the mutant does to your own rows.** §32's mutant A caught a row of mine that was
   three `not.toContain`s and passed on a note that never fired.
6. Name the killed rows with `--verbose` — jest prints no per-test lines for a multi-suite run.

## Building and driving an exported app

- **`scripts/emit-app.ts` is the honest runner** — `emit-app.ts <project> <outDir>`, or
  `--preflight <project>` for the read-standing-up summary (writes nothing). ✅ It runs against a
  project **outside** `tests/fixtures`, which is how §31 and §32 graded real projects.
  ⚠️ `--preflight` prints per-component *counts*, not per-wire reasons — export for those.
- 🔴 **The build is still the only instrument for the real third-party libraries.**
- ✅ **`typecheckEmittedApp` (`tests/helpers/typecheckApp.ts`) is the cheap instrument** — use it on
  any row asserting emitted text, because **a `toContain` passes on dead code** (§24.3).
- Harness: `cp -a` a prepared harness (so the `@nodegx/core` symlink survives), `rm -rf src dist
  tsconfig.tsbuildinfo`, then emit into it. ⚠️ The emit **does** overwrite `package.json`.
- 🔴 **Author a fixture project by copying an existing one**, and ⚠️ **watch the collateral** —
  §32 added one output port to `NoteRow` and re-read the *whole* report to find the one extra line
  it produced.
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
| `relay-desk` | **three wires an author drew wrong** — a bare relay name, a signal prefix over a value output, beside a real lifecycle pulse (§31, §32) |
| `deadline-desk` | **all six date nodes**, plus `Now → Set Variable → Variable2 → Text` |
| `quote-desk` | `net.noodl.HTTP` with response mappings, `error`, `failure`, `canceled` |
| `reading-shelf` | `Collection2 → Filter Collection → Map Collection → For Each`, `Model2` prop minting |
| `puppy-test-3` | the richest export; EXP-004 markers and the README comprehension test |
| `variable-dial` | variable typing |
| `kits` | custom nodes / modules |

**No fixture has**: a `PageInputs` node, a braced `urlPath`, an `External Link`, a
`Navigate To Path`, an untyped store key, a wire into a port that already carries an authored
value, or a refused script on a node that is not a Function.
