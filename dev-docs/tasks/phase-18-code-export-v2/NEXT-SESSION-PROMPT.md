# Next session — the fix that could not fire, and the one port left in front of the slice

## Where the phase stands

Session 59 went where §29.5 pointed — re-derive the collection-state slice **from the code, not
from the recorded reason** — and did three things. §30 has the long form.

- ✅ **`Remove Object From Array` translates.** A delete button in a list row now exports as
  `onRemoved={() => notes.remove(item)}`. The Object Id is a `For Each`'s Item Id, which the
  runtime sets to the firing row before pulsing — so the id *names the row the callback is already
  standing in*, and the emitted form spells no id at all. **69 → 70 of 127 (55.1%).**
- 🔴 **A fixture built to protect §29 found that §29 could not fire on a real project.** A relayed
  row signal is a dynamic port, so it is in no catalog and no project file; `resolveSourcePortKind`
  answered `'value'` and the wire was dropped. Every row of §29's suite passed over it, because the
  test helper *declares* the wire a signal. Fixed, and pinned by from-disk rows.
- ✅ **`Set Object Properties` re-derived and still deferred — for a different reason.** The id
  resolves now; the **value** does not.

## 🔴 Read this before planning anything

1. 🔴 **An in-memory IR test can be blind to the defect it is grading.** §29 was correct, complete
   and ungraded on the only population that mattered. **Any slice that depends on a dynamic port
   needs at least one row that parses a fixture off disk.**
2. 🔴 **`itemOutput-<name>` is the single port in front of the rest of this slice** (§30.5). It
   blocks `Set Object Properties`, and it is what `itemActionItemId`-as-a-value still refuses.
3. 🔴 **`Collection.remove` is `indexOf` — reference equality.** That is why §30's gate 3 requires
   the repeater to repeat *the very array being written*: a mapped feed hands back fresh objects
   and would emit a call that removes nothing. A filtered feed would happen to work and is refused
   anyway.
4. ⚠️ **`Collection.updateWhere` replaces the row object**, so `item` goes stale for anything later
   in the same handler. Whoever builds the write side owns that question.
5. ⚠️ **Probe the instrument before reporting an absence.** The drive read `status ""` on every
   step; the DOM said `Removed a note.` all along, and the reader was wrong (the status `<p>`'s
   parent holds the Add button).

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The numbers

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 1131/1131, 45 suites (1095/44 before §30); ~30 s
npm run export-ledger:picker                  # from the repo root — 70/127 (55.1%)
npm run export-ledger:check                   # 175 types
```

🔴 The corpus audit is a regression net, never a priority oracle.
🔴 Custom node types are **deliberately** outside the picker number — `$customNodesComment` in
`packages/nodegx-export/coverage-ledger.json` says why.

## Do this next — in the order they are worth doing

### 1. ⚠️ Sweep for the §30.3 defect class before building anything new

**A dynamic port is invisible to the parse, and the exporter has more than one.** §30.3 found one
by accident. Ask the question deliberately: which other translations gate on `connection.kind`, an
`instanceSignal`-style hatch, or a catalog port lookup — and which of those ports are minted at
runtime rather than declared? `registerOutputIfNeeded`-style code is the tell. Grade whatever you
find **from disk**, not from a hand-built IR. This is cheap and it is the highest-value hour here.

### 2. 🔴 Decide whether a relayed row *value* has a carve-out — the last port in this slice

`itemOutput-<name>` reaches the page as "whichever row fired last". Inside the row's own callback,
though, the value is knowable **whenever the template's output port is a pass-through of a prop**
— which is a static fact about the template, readable from `templatePlan`. If that carve-out is
real, `Set Object Properties` from the page unblocks with it. If it is not, say so with the
measurement. Owned by **`NONE`**; §30.2 and §30.5 have the derivation.

### 3. The fixtures nothing reaches

`note-desk` closes "a row with a button in it". §26.1's list still holds for: a `PageInputs` node,
a braced `urlPath`, an `External Link`, a `Navigate To Path`, an untyped store key, a wire into a
port that already carries an authored value, and a refused script on a node that is not a
Function. Each is a hand-built graph away, and §30.3 is the argument for building them.

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

- `Navigate To Path`'s `Completed` chain (§24.6) — still refuses an `Error` read, deliberately.
  **Decide before starting; not obviously worth it.**
- The date family's signals, and the repeater's lifecycle pulses (`itemsRendered`, `done`,
  `completed`, `failure`) — one `effect()` slice, not two (§9.6, §29.5).
- EXP-009 leftovers — drive the exported login/admin forms; delete the drive-residue user
  `exp009-drive` from the local Puppy backend's `_User`.

## 🔴 What session 59 would tell you if it could only say three things

1. **A fixture is a population, not a convenience.** The hour §29 asked for bought a defect that
   twenty in-memory assertions could not see, and the mutant proves it: removing the fix kills
   *exactly* the two from-disk rows and **no hand-built row**.
2. **Re-deriving a blocker means reading both ends.** `Remove` unblocked and `Set Properties` did
   not, and the difference is not in either node — it is in whether the *id* or the *value* has to
   cross the boundary. Inheriting §7.3's one sentence for both would have got one of them wrong.
3. **Prove a wire is dead before dropping it.** `Failure` and `Unchanged` on the removal are
   dropped-with-a-note, and each cause is answered by a named gate and a line of runtime source.
   Deferring the whole node over them would have lost a translation to a no-op.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files. ⚠️ A *new* test
file or fixture is untracked, and `git commit <pathspec>` **errors** rather than skipping it —
`git add` it and commit in the same command so the staging window stays closed.
⚠️ **Delete scratch scripts from `scripts/` and probe specs from `tests/` before committing** —
and **reconcile the suite count against disk** (`ls tests/*.test.ts | wc -l`), which is what
catches a probe left behind.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

⚠️ **`test:ci` was not run by this session and was not needed** — nothing outside
`packages/nodegx-export` was touched. If you touch `noodl-runtime`, run it yourself rather than
inheriting a relayed floor.

⚠️ **Peers are active in this checkout.** Commit by pathspec and their trees stay untouched.

⚠️ **The shell's cwd is shared and parallel `cd` calls race** — use absolute paths in any command
you send in parallel. 🔴 A `cd` inside a compound command persists into later tool calls.
🔴 **`cmd | head; echo $?` reads `head`'s exit code, not `cmd`'s** — redirect to a file and echo
`$?` on its own.
✅ **Restore a mutated `src` with `cp -a snap/src/. src/` and then `diff -r`.**

## Mutating to prove a checker's reach

The pattern that produced §26.3, §27.5, §29.4 and §30.4, and it is worth reusing:

1. `cp -a src <scratchpad>/snap/` first — and take a **second** snapshot *after* the fix, because
   the pre-fix one is not a mutant undo (§28's trap).
2. Mutate **by asserting the anchor's uniqueness before replacing it** — a python
   `assert s.count(old) == 1` that fails leaves the source untouched.
3. ⚠️ **A mutant that breaks the typecheck reads as `Tests: 0 total`, not as a kill** — narrowing
   in a `switch`/`else if` is easy to break by accident. Check `tsc` on the mutant before believing
   its result. (§30 hit this once: `else if (false)` broke the narrowing.)
4. Run **both** the new rows and the control rows. The finding is the *disagreement*.
5. Name the killed rows with `--verbose` — jest prints no per-test lines for a multi-suite run.

## Building and driving an exported app

- **`scripts/emit-app.ts` is the honest runner** — `emit-app.ts <project> <outDir>`, or
  `--preflight <project>` for the read-standing-up summary (writes nothing).
- 🔴 **The build is still the only instrument for the real third-party libraries.**
- ✅ **`typecheckEmittedApp` (`tests/helpers/typecheckApp.ts`) is the cheap instrument** — use it on
  any row asserting emitted text, because **a `toContain` passes on dead code** (§24.3).
- Harness: `cp -a` a prepared harness (so the `@nodegx/core` symlink survives), `rm -rf src dist
  tsconfig.tsbuildinfo`, then emit into it. ⚠️ The emit **does** overwrite `package.json` (renaming
  the app); `node_modules` survives, so the build still works — but do not expect it to be intact.
- 🔴 **Author a fixture project by copying an existing one** — `reading-shelf` is the cheapest
  three-component template — far cheaper than driving MCP. A new directory under `tests/fixtures`
  joins the emitted-syntax, typecheck, markers, README and preflight sweeps automatically.
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

## The eight fixtures, and what each one already covers

| Fixture | Covers |
|---|---|
| `cheer` | the base for most hand-built graphs; `GlobalStore.Set/Subscribe`, popups, component IO, `For Each` |
| `note-desk` | **a delete button in a list row** — the relayed row signal, `Remove Object From Array`, a Done chain (§30) |
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

s59 scratchpad `1d23bd1f-…/scratchpad` — `snap-src` (pre-§30), **`fixed-src` (post-§30, the correct
mutant undo)**, `mut.py`, `EXPECTED.md`, `drive.mjs`, `app/` (a built, driven export of
`note-desk`), `app-src-good`, `jest-baseline.log`, `jest-final.log`.
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
