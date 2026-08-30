# Next session — the two `NONE` rows session 56 left, and what is left needs a person

## Where the phase stands

**Session 57 closed both items §27.6 and §26.4 left owned by `NONE`.** One by building, one by
measuring and finding there was nothing to build. §28 has the long form.

- ✅ **§27.6 closed — a logic-only component no longer loses a `Script` node's code.** The sweep
  runs at all three exits now, and where there is no module the **report** carries the source.
  Which carrier holds a script is decided by whether a file exists, never by a filter.
- 🔴 **The report could have said "Nothing needs your attention" while a script vanished.** A
  script beside the router shell is `scaffolded`, which landed in the *what worked* half and in
  none of `nothingToReport`'s terms. `reading-shelf` unmutated genuinely prints that sentence, so
  this was one node away from live. The gate now counts preserved scripts.
- ✅ **§26.4's `mood2?: any` is not a defect** — it is the smallest instance of a wider honest
  refusal. **20 props across the corpus, 11 `any`**; ten are declared ports whose port type is
  the wildcard `"*"`, one is the minted row prop. Closed with a denominator.

**69 of 127 (54.3%)** — unchanged, and correctly: this session added no translation.

## 🔴 Read this before planning anything

1. 🔴 **Editing a parsed `ExportIR`'s parameter does not move `sourceText`** — the *parser* writes
   it from that same parameter. The first draft of these rows mutated the parameter alone and
   watched the **original** mapping come back in the comment. Rows that need the two to agree must
   **re-parse a patched copy from disk**.
2. 🔴 **`grep sourceText src` returns a hit in `emit/component.ts` that is a comment**, with the
   real code beside it reading `JsFunctionPlan.body`. A mention reads as a call; this one sits in
   the exact file a consumer would live in.
3. 🔴 **A refusal is filed against the dropped wire, whose `fromId` is the *outermost* node of the
   chain.** In `Collection2 → Filter → Map → For Each` a refusing **Filter** files against the
   **Map**'s wire. Anything that wants "which node refused" must be registered where the decision
   is made — deriving it from the wire names the wrong node.
4. **Building the app is still the only instrument for the real third-party libraries** — the
   helper *declares* `react-router-dom` rather than resolving it (repo has v5, app wants v7).
5. 🔴 **A component that emits no file is invisible to every check that reads emitted files.**
   Eight of the corpus's 36 components are in that class. §28's rule reaches them only because it
   is fed from the **plan**; anything asserted over `app.files` alone cannot see them at all.
6. ⚠️ **`reading-shelf` unmutated reports "Nothing" needs attention** — which makes it the right
   fixture for any row about the report's empty state, and a trap for any row that assumes a
   refusal is already there.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The numbers

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 1081/1081, 43 suites (1076/43 before §28); ~19-26 s
npm run export-ledger:picker                  # from the repo root — holds at 69/127 (54.3%)
npm run export-ledger:check                   # 175 types
```

🔴 The corpus audit is a regression net, never a priority oracle.
🔴 Custom node types are **deliberately** outside the picker number — `$customNodesComment` in
`packages/nodegx-export/coverage-ledger.json` says why. Do not "fix" it by adding them.

## Do this next — in the order they are worth doing

### 1. Three EXP-004 lines still need Richard, not a session

None can be closed by whoever wrote the artefact; all three are recorded as unrun, not ticked:

- **The comprehension test** — *"a developer unfamiliar with the project reads the exported README
  and can state what needs doing without asking questions."* `tests/fixtures/puppy-test-3` exports
  the richest example.
- **The external review of the verification wording** (implementation step 6).
- **Whether the preserved source block actually helps** — the code is *there*, and as of §27 it is
  there for Map Collection, For Each and Script nodes too; whether a developer can rewrite
  `formatList` from it is still unmeasured.

### 2. Decide whether the editor gets an export command at all — Richard's call

`@nodegx/export` still has **no consumer anywhere in the product**; the only way to run an export is
`ts-node scripts/emit-app.ts` by hand. The in-editor report is blocked on an editor export
command — a feature, not a wiring job — and is owned by **`NONE`**. §21.1 has the evidence.
**Ask before building it.** It may belong in its own task.

### 3. The collection-state slice — the first buildable item, and it is a big one

⚠️ **Sized before starting, and it is not a remainder-of-a-session job.** It unblocks
`Set Object Properties` and `Remove Object From Array`, but §7.3 shows why neither is one row:
`Remove Object From Array` is blocked *one level up* on a repeater row's outputs, which still
defer on *"which row fired is not statically expressible"*. Closing that is a design decision
about how a row identifies itself to the enclosing list, and `Set Object Properties` needs
list-owned state on top of it. Comparable in size to §10 or §11 — start it at the top of a
session, not the end of one.

### 4. `Navigate To Path`'s `Completed` chain (§24.6)

Still refuses an `Error` read, deliberately. Translating it means hoisting the message above the
branch, which changes the emitted shape for every node of this kind. A slice of its own, and not
obviously worth it — decide before starting.

### 5. The date family's signals — an `effect()` slice, not a date slice (§9.6).

### 6. EXP-009 leftovers — drive the exported login/admin forms; delete the drive-residue user
`exp009-drive` from the local Puppy backend's `_User`.

## 🔴 What session 57 would tell you if it could only say three things

1. **Measure the population before writing the checker, and say so when it is empty.** The corpus
   has 36 components, 8 emitting no file, 4 carrying `sourceText`, and **0** of those 4 in a
   skipped component. Knowing that *first* is what made the corpus this rule's zero control and
   sent the real rows to a hand-built graph, instead of five green rows over nothing.
2. **A snapshot taken before a fix is not an undo for a mutant applied after it.** Restoring
   `plan.ts` from `snap/` after mutant 1 silently reverted the fix as well, and the suite went
   green reporting a state that was not the one being measured. Re-apply and re-measure.
3. **Reconcile the suite count against disk, not against the tests you meant to add.** The run
   said 44 suites where 43 were expected — a scratch probe left in `tests/`. `1082 − 1076 = 6`
   against 5 rows written is what caught it.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files. ⚠️ A *new* test
file is untracked, and `git commit <pathspec>` **errors** rather than skipping it — `git add` it
and commit in the same command so the staging window stays closed.
⚠️ **Delete scratch scripts from `scripts/` and probe specs from `tests/` before committing.**
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

⚠️ **`test:ci` was not run by this session and was not needed** — nothing outside
`packages/nodegx-export` was touched. If you touch `noodl-runtime`, run it yourself rather than
inheriting a relayed floor.

⚠️ **The shell's cwd is shared and parallel `cd` calls race** — use absolute paths in any command
you send in parallel. 🔴 A `cd` inside a compound command persists into later tool calls, and a
relative `../../node_modules/.bin/…` then fails from the wrong directory — it bit once this
session.
✅ **Restore a mutated `src` with `cp -a snap/src/. src/` and then `diff -r`.**
⚠️ **`jest -t` takes a REGEX**, and a filtered run that matches nothing still exits 0. **Check the
summary line says something ran** — and `--verbose` plus a grep for the row name is what proves it.
🔴 **`${PIPESTATUS[0]}` is empty in zsh** — `cmd > file 2>&1; echo $?` is what reads an exit code.

## Mutating the emitter to prove a checker's reach

The pattern that produced §26.3 and §27.5, and it is worth reusing:

1. `cp -a src <scratchpad>/snap/` first.
2. Mutate **by asserting the anchor's uniqueness before replacing it** — a python `assert
   s.count(old) == 1` that fails leaves the source untouched, which is why a run that measured
   nothing said so instead of lying.
3. Run **both** the new rows and the control rows. The finding is the *disagreement*.
4. `cp -a snap/src/. src/ && diff -r snap/src src` between mutants, not just at the end.

## Building and driving an exported app

- **`scripts/emit-app.ts` is the honest runner** — `emit-app.ts <project> <outDir>`, or
  `--preflight <project>` for the read-standing-up summary (writes nothing). ~1.5 s to start.
- 🔴 **The build is still the only instrument for the real third-party libraries.**
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
value, or — as of §27 — **a refused script on a node that is not a Function**. Those are the
populations only a hand-built graph reaches.

## Instruments

s57 scratchpad `2fc5fa30-…/scratchpad` — `snap/src` (pre-§28), `jest-baseline.log`. ⚠️ that
snapshot is **pre-fix**: restoring from it reverts §28, it is not a mutant undo.
s56 scratchpad `0258c50b-…/scratchpad` — `snap/src` (pre-mutation), `refused-map.ts` (the probe
that found §27.2), `contract.ts` (§27.3), `control.ts` (the corpus control), `probe.ts` (the
`Javascript2`/`For Each` reach measurement).
s55 `756fcbe6-…/scratchpad/snap/src`. s54 `61e7da69-…`.
s53 `efd50c1e-…` — `mut.py`, `harness/` (a built export with `node_modules` and the `@nodegx/core`
symlink), `proj2/`, `drive.mjs`, `arm.sh`, `EXPECTED.md`. **The harness is still intact.**
s52 `e4b8cbef-…`; s51 `9fcea17d-…`; s50 `e54aeffc-…`; s49 `481a2793-…`; s48 `e6b5ff80-…`;
s47 `99fc4b87-…`; s46 `cf0e64bb-…/openarm/`; s44 `7408cf11-…`; s43 `2011a26f-…`; s40 `1a63a0f6-…`.

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a` / `grep -a`.
