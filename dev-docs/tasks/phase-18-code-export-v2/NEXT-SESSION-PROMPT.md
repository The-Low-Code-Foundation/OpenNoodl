# Next session — `sourceText` has a consumer, and the field was not holding what it promised

## Where the phase stands

**Session 56 closed handoff item 3.** `NodeIR.sourceText` was *"adopt it or delete it"*; it is
**adopted**, and deciding it by measurement found two defects rather than settling a preference.
§27 has the long form.

- 🔴 **A refused `Map Collection` script was vanishing from the export entirely** — reported, and
  marked in code by a `TODO` naming the node, with the author's script **nowhere in the repo**.
  That is §20's argument for the Function case, verbatim, one node-family over. Now preserved.
- 🔴 **The field's writer did not match its contract.** It promised *author-written code* and
  selected on *"does this port open a code editor"* — and 29 of the catalog's 36 codeeditor ports
  are `styleCss`. A Text node's authored CSS was landing in `sourceText`. The catalog names the
  language, so the set is now derived from it.

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

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The numbers

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 1076/1076, 43 suites (1070/43 before §27); ~19-26 s
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

### 3. A logic-only component still loses a Script node's code — owner `NONE` (§27.6)

§27's sweep runs only in components that emit a file. The router shell and a **logic-only**
component return before it, because there is no module for a comment to live in — so a
`Javascript2` node in a logic-only component still loses its code to the report alone. Named
deliberately rather than quietly included. Closing it means the **report** carrying the source, or
a component that emits nothing gaining somewhere to put it. Decide which before building.

### 4. `array-vocabulary` emits `mood2?: any;` for a minted `Model2` prop — owner `NONE`

Noticed at §26.4, **still not investigated** — this session went to item 3 instead. A minted
repeater prop typed `any` means the emitted child grades nothing at that prop, in the compiler or
anywhere else. Worth one look before anybody adds a typecheck row over that graph expecting it to
catch something.

### 5. `Navigate To Path`'s `Completed` chain (§24.6)

Still refuses an `Error` read, deliberately. Translating it means hoisting the message above the
branch, which changes the emitted shape for every node of this kind. A slice of its own, and not
obviously worth it — decide before starting.

### 6. The collection-state slice — unblocks `Set Object Properties` and `Remove Object From Array`.

§7.3 draws the line: the read side of `Object` translates, the write side does not, because a row
written from inside the row is state the enclosing list owns rather than a prop the parent passes
down. `Remove Object From Array` is blocked one level up on a repeater row's outputs.

### 7. The date family's signals — an `effect()` slice, not a date slice (§9.6).

### 8. EXP-009 leftovers — drive the exported login/admin forms; delete the drive-residue user
`exp009-drive` from the local Puppy backend's `_User`.

## 🔴 What session 56 would tell you if it could only say three things

1. **"Adopt or delete" is answered by measuring what each would cost, not by taste.** Deleting
   would have closed a hole that was open; adopting as-written would have printed a Text node's
   CSS under a sentence calling it a script. Both were found by running something.
2. **A control that cannot go red proves nothing.** Every row here is paired — the translated Map
   Collection, and all seven fixtures emitting **zero** of these comments. Two mutants then showed
   the refusal rows redden while the controls stay green. The disagreement is the finding.
3. **Ask the catalog rather than listing what you think is in it.** The `codeeditor` field names
   the language, so the seven JavaScript ports are derived. A hand-written list would have been
   wrong on the day someone added a port, and would have looked right forever.

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
