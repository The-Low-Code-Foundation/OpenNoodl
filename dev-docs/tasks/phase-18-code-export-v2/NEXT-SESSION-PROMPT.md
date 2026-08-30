# Next session — the blocker that was a mis-reading, and the list shape no fixture has

## Where the phase stands

**Session 58 went to the collection-state slice §28.5 pointed at, and never got there.** Reading
its recorded blocker against the runtime it describes found that the blocker was wrong — and that
what it was hiding was a **silent loss** in the most common interaction a list has. §29 has the
long form.

- 🔴 **A delete button in a list row exported as a button that does nothing, and the report said
  nothing needed attention.** A wire out of a `For Each` was planned like any other rendered
  node's — the action compiled, and the sink was dispositioned **`collapsed into <the repeater>`**,
  so the report *affirmatively claimed it translated* — while `renderRepeater` never read
  `plan.handlers` at all. The repeater's own `itemsRendered` pulse was lost the same way.
- ✅ **Fixed and translated.** A relayed `itemOutputSignal-<name>` now becomes the template's own
  callback prop on the row: `<NoteRow … onRemoved={() => notes.clear()} />`, in all four feed
  branches. What still refuses is named in the report instead of vanishing.
- 🔴 **The sentence that hid it — *"which row fired is not statically expressible"* — was wrong
  about both ends**, and had been repeated across ten sessions.

**69 of 127 (54.3%)** — unchanged, and correctly: this fixed a *wire shape* on a node that already
translated, not a node type.

## 🔴 Read this before planning anything

1. 🔴 **`foreach.tsx` names the row.** `itemOutputSignalTriggered` sets
   `itemActionItemId = model.getId()` and snapshots *that row's* outputs **before** pulsing
   `itemOutputSignal-<name>`. Any claim that a repeater loses row identity is false of this
   runtime. And on the emit side the question is never asked — each row is its own element whose
   callback closes over its own `item`.
2. 🔴 **The recorded blocker was not stale and not the wrong runtime's — it was an under-reading
   of *this* one.** No amount of re-reading the task file would have caught it; only opening
   `foreach.tsx` did. When a refusal names a runtime mechanism, **open the runtime file**.
3. 🔴 **A wire can be `consumed` before it is compiled** (`plan.ts:7602`), which puts it beyond
   pass 6's "report every wire nothing translated". That is how the loss stayed silent — the
   safety net cannot see anything the attachment loop has already claimed.
4. 🔴 **A `collapsed` disposition is a *claim*, not evidence.** `clearArr` was
   `{kind:'collapsed', into:'notesList'}` while nothing at all was emitted. When checking whether
   something translated, read the **emitted file**, never the disposition.
5. 🔴 **The absence was only worth believing beside a firing control** — the same `Clear Array`
   driven by an ordinary button emits `notes.clear();`. "The relay is dropped" and "the sink does
   not translate" look identical and have opposite fixes.
6. ⚠️ **The port names are prefixed.** `itemOutputSignal-<name>` (signals) and `itemOutput-<name>`
   (values), registered in `_managePortsForNode`. A test wiring a bare `waved` off a repeater is
   testing a port the runtime never creates — one in `component-outputs.test.ts` was, and still is,
   now correctly framed as "not a relayed row signal".

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The numbers

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 1095/1095, 44 suites (1081/43 before §29); ~19-23 s
npm run export-ledger:picker                  # from the repo root — holds at 69/127 (54.3%)
npm run export-ledger:check                   # 175 types
```

🔴 The corpus audit is a regression net, never a priority oracle.
🔴 Custom node types are **deliberately** outside the picker number — `$customNodesComment` in
`packages/nodegx-export/coverage-ledger.json` says why. Do not "fix" it by adding them.

## Do this next — in the order they are worth doing

### 1. 🔴 Re-derive the collection-state slice from the code, not from §7.3

**This is the top buildable item and its sizing is now unknown.** §7.3 blocked
`Remove Object From Array` on *"a row's outputs cannot reach the page"*. **They can now** — a row's
signal reaches the page in a callback that closes over `item`. So:

- Read `dispositionForLogic`'s `CollectionRemove` and `SetModelProperties` branches
  (`plan.ts` ~9700) **against the code as it now is**, exactly the way §29 had to.
- `Remove Object From Array` needs an **Object Id**. Inside the callback, `item` is in scope — so
  ask what is actually missing rather than inheriting the recorded answer.
- ⚠️ **`Set Object Properties` may still be genuinely blocked** — a row written from inside the
  row is state the enclosing list owns (§4 draws that line). Do not assume §29 unblocked both.

### 2. A fixture with a button in a list row — worth an hour, and it protects §29

🔴 **No fixture carries this shape.** The suite builds it by hand onto `cheer`'s `NoteRow`. A
fixture that has one puts it under the **corpus audit** and the **emitted-typecheck sweep**
permanently. Author it by copying `tests/fixtures/cheer` and editing
`components/Pages/Notes/{nodes,connections}.json` — far cheaper than driving MCP.

### 3. ⚠️ Drive a list with a working delete button

§29 is graded by **compile + mutants**, not by a browser. The callback-prop end (`NoteRow` calling
`onRemoved`) is the Component Outputs slice's, which §10 drove — but the composition is undriven.
The s53 harness is still intact (see Instruments).

### 4. Three EXP-004 lines still need Richard, not a session

None can be closed by whoever wrote the artefact; all three are recorded as unrun, not ticked:

- **The comprehension test** — *"a developer unfamiliar with the project reads the exported README
  and can state what needs doing without asking questions."* `tests/fixtures/puppy-test-3` exports
  the richest example.
- **The external review of the verification wording** (implementation step 6).
- **Whether the preserved source block actually helps** — the code is *there*; whether a developer
  can rewrite `formatList` from it is still unmeasured.

### 5. Decide whether the editor gets an export command at all — Richard's call

`@nodegx/export` still has **no consumer anywhere in the product**; the only way to run an export is
`ts-node scripts/emit-app.ts` by hand. The in-editor report is blocked on an editor export
command — a feature, not a wiring job — and is owned by **`NONE`**. §21.1 has the evidence.
**Ask before building it.**

### 6. Smaller, and each decidable on its own

- `Navigate To Path`'s `Completed` chain (§24.6) — still refuses an `Error` read, deliberately.
  Hoisting the message above the branch changes the emitted shape for every node of this kind.
  **Decide before starting; not obviously worth it.**
- The date family's signals — an `effect()` slice, not a date slice (§9.6).
- The repeater's lifecycle pulses (`itemsRendered`, `done`, `completed`, `failure`) are the same
  `effect()` shape, now *reported* rather than lost. Same slice as the date signals.
- EXP-009 leftovers — drive the exported login/admin forms; delete the drive-residue user
  `exp009-drive` from the local Puppy backend's `_User`.

## 🔴 What session 58 would tell you if it could only say three things

1. **When a refusal names a runtime mechanism, open the runtime file.** The blocker had been
   relayed through ten sessions and was wrong. The task file could not have told you; forty lines
   of `foreach.tsx` did, in about ten minutes.
2. **A disposition is a claim about the code, not the code.** `collapsed into notesList` was
   recorded for a node whose behaviour was emitted nowhere. Any check that reads dispositions to
   decide "did this translate?" would have been green on the whole defect.
3. **Sabotage the fix three ways, not once.** Removing it killed 9/12; removing the prefix guard
   killed exactly the 4 lifecycle rows; emitting unconditionally killed exactly the negative
   control. Three mutants is what says *which* row grades *what* — one mutant only says the suite
   is alive.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files. ⚠️ A *new* test
file is untracked, and `git commit <pathspec>` **errors** rather than skipping it — `git add` it
and commit in the same command so the staging window stays closed.
⚠️ **Delete scratch scripts from `scripts/` and probe specs from `tests/` before committing** —
and **reconcile the suite count against disk** (`ls tests/*.test.ts | wc -l`), which is what
catches a probe left behind.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

⚠️ **`test:ci` was not run by this session and was not needed** — nothing outside
`packages/nodegx-export` was touched. If you touch `noodl-runtime`, run it yourself rather than
inheriting a relayed floor.

⚠️ **Peers are active in this checkout.** At the end of s58 there were uncommitted edits in
`nodegx-backend/tests`, `noodl-mcp/tests`, `noodl-core-ui`, `noodl-editor` and several
`dev-docs/tasks/phase-7x` trees. **None are yours** — commit by pathspec and they stay untouched.

⚠️ **The shell's cwd is shared and parallel `cd` calls race** — use absolute paths in any command
you send in parallel. 🔴 A `cd` inside a compound command persists into later tool calls; it bit
once this session too (a `sed` against a relative path from the wrong directory).
🔴 **`cmd | head; echo $?` reads `head`'s exit code, not `cmd`'s** — redirect to a file and echo
`$?` on its own. It nearly reported a typecheck as passing on this session's first attempt.
✅ **Restore a mutated `src` with `cp -a snap/src/. src/` and then `diff -r`.**

## Mutating the emitter to prove a checker's reach

The pattern that produced §26.3, §27.5 and §29.4, and it is worth reusing:

1. `cp -a src <scratchpad>/snap/` first — and take a **second** snapshot *after* the fix, because
   the pre-fix one is not a mutant undo (§28's trap).
2. Mutate **by asserting the anchor's uniqueness before replacing it** — a python
   `assert s.count(old) == 1` that fails leaves the source untouched, which is why a run that
   measured nothing said so instead of lying.
3. Run **both** the new rows and the control rows. The finding is the *disagreement*.
4. `cp -a snap/src/. src/ && diff -r snap/src src` between mutants, not just at the end.

## Building and driving an exported app

- **`scripts/emit-app.ts` is the honest runner** — `emit-app.ts <project> <outDir>`, or
  `--preflight <project>` for the read-standing-up summary (writes nothing). ~1.5 s to start.
- 🔴 **The build is still the only instrument for the real third-party libraries** — the helper
  *declares* `react-router-dom` rather than resolving it (repo has v5, app wants v7).
- ✅ **`typecheckEmittedApp` (`tests/helpers/typecheckApp.ts`) is the cheap instrument** — it
  compiles an emitted app in-process with the scaffold's own `compilerOptions`. Use it on any row
  asserting emitted text, because **a `toContain` passes on dead code** (§24.3).
- Harness: `cp -a` a prepared harness (so the `@nodegx/core` symlink survives), `rm -rf src dist
  tsconfig.tsbuildinfo`, then emit into it. **Never overwrite its `package.json`.**
- 🔴 **Author a fixture project by copying `tests/fixtures/cheer`** and editing its
  `components/Pages/Notes/{nodes,connections}.json` — far cheaper than driving MCP.
- Serve with `npx vite preview --port 53xx --strictPort`; stop it by port
  (`lsof -ti :53xx -sTCP:LISTEN | xargs kill`). ⚠️ **`vite preview` binds `localhost`, and
  `curl 127.0.0.1` gets nothing.**
- 🔴 **Poll for readiness, never sleep.**
- 🔴 **The scaffold's router has `<Route path="*" element={<Navigate to="/" replace />} />`** — a
  navigation to an unrouted path is **erased** before you can read the url.
- ⚠️ **A React input needs the native value setter plus an `input` event**, even when uncontrolled.
- 🔴 Click with `Input.dispatchMouseEvent`, never `element.click()`. Read `textContent` per element.
- 🔴 **Write the expected answers down before the app runs**, then **sabotage in separate arms**.
- ⚠️ **An error row is never cleared** — a success row must run **before** any failure row, and a
  row that navigates away runs **last**.

## The seven fixtures, and what each one already covers

Worth reading before claiming any shape is untested (§26.1 is the long form):

| Fixture | Covers |
|---|---|
| `cheer` | the base for most hand-built graphs; `GlobalStore.Set/Subscribe`, popups, component IO, `For Each` |
| `deadline-desk` | **all six date nodes**, plus `Now → Set Variable → Variable2 → Text` |
| `quote-desk` | `net.noodl.HTTP` with response mappings, `error`, `failure`, `canceled` |
| `reading-shelf` | `Collection2 → Filter Collection → Map Collection → For Each`, `Model2` prop minting |
| `puppy-test-3` | the richest export; EXP-004 markers and the README comprehension test |
| `variable-dial` | variable typing |
| `kits` | custom nodes / modules |

**No fixture has**: a `PageInputs` node, a braced `urlPath`, an `External Link`, a
`Navigate To Path`, an untyped store key, a wire into a port that already carries an authored
value, a refused script on a node that is not a Function, or — as of §29 — **a row with a button
in it**. Those are the populations only a hand-built graph reaches.

## Instruments

s58 scratchpad `85b9297a-…/scratchpad` — `snap-src` (pre-§29), **`fixed-src` (post-§29, the
correct mutant undo)**, `jest-baseline.log`, `jest-final.log`.
s57 `2fc5fa30-…` — `snap/src` (pre-§28), `jest-baseline.log`. ⚠️ pre-fix: not a mutant undo.
s56 `0258c50b-…` — `snap/src`, `refused-map.ts` (§27.2), `contract.ts` (§27.3), `control.ts` (the
corpus control), `probe.ts` (the `Javascript2`/`For Each` reach measurement).
s55 `756fcbe6-…/scratchpad/snap/src`. s54 `61e7da69-…`.
s53 `efd50c1e-…` — `mut.py`, `harness/` (a built export with `node_modules` and the `@nodegx/core`
symlink), `proj2/`, `drive.mjs`, `arm.sh`, `EXPECTED.md`. **The harness is still intact.**
s52 `e4b8cbef-…`; s51 `9fcea17d-…`; s50 `e54aeffc-…`; s49 `481a2793-…`; s48 `e6b5ff80-…`;
s47 `99fc4b87-…`; s46 `cf0e64bb-…/openarm/`; s44 `7408cf11-…`; s43 `2011a26f-…`; s40 `1a63a0f6-…`.

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a` / `grep -a`.
