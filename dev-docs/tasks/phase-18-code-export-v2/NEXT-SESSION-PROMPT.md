# Next session — the typecheck hole is closed for the corpus, and open for everything else

## Where the phase stands

**Session 54 built the typecheck suite §24.6 asked for.** `ts.createProgram` over the emitted
files, all seven fixtures at zero diagnostics, with a permanent control pair. **§24.6's typecheck
item is done and off every list.**

**It also found that §24.6's description of that suite was wrong**, and the correction is the most
useful thing to carry forward — see below. **§25 has the measurement.**

**69 of 127 (54.3%)** — unchanged, and correctly: this session added no translation.

## 🔴 Read this before planning anything

1. 🔴 **A fixture-only checker is green on the defect that motivated it.** §24.6 recommended "one
   suite over the emitted files closes it for the whole package" *and* recorded, three lines later,
   that **no fixture contains an `External Link` or a `Navigate To Path`** — the nodes §24.3's
   defect lived in. The two facts were never put together. Measured with §24.3's mutant restored:
   the fixture suite stays **11/11 green**; the rows beside the hand-built graphs go **red**. When
   a checker is proposed, **ask what population it runs over before believing its reach.**
2. 🔴 **Both of this session's first two findings were about the checker, not the code** — 107
   phantom diagnostics from stubbing imports as `any`, and a `TS2307 Cannot find module './client'`
   for a file that had just been emitted, caused by a `directoryExists` that only read from disk.
   Both read exactly like real defects. **Requiring the known-good arm to reach zero is what caught
   them**; reading the diagnostics as findings would not have.
3. 🔴 **Build the app for anything about the real `react-router-dom`.** The new suite declares that
   package rather than resolving it — the repo has v5 and the app wants v7 — so router prop misuse
   is graded against the helper's declarations, not the library. That blind spot is deliberate and
   documented in `tests/helpers/typecheckApp.ts`.
4. **Grep for the thing before building it, and read what a passing assertion means.**

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The numbers

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 1067/1067, 43 suites (1054/42 before §25); ~20 s
npm run export-ledger:picker                  # from the repo root — holds at 69/127 (54.3%)
npm run export-ledger:check                   # 175 types
```

🔴 The corpus audit is a regression net, never a priority oracle.
🔴 Custom node types are **deliberately** outside the picker number — `$customNodesComment` in
`packages/nodegx-export/coverage-ledger.json` says why. Do not "fix" it by adding them.

## Do this next — in the order they are worth doing

### 1. Typecheck rows for the eight remaining `expectParses` files — cheapest real work, owner `NONE`

`typecheckEmittedApp` is exported from `tests/helpers/typecheckApp.ts` precisely so a slice can
grade its own hand-built graph. Two files use it. **Eight still carry a private parse-only helper**
and are graded by nothing stronger:

`array-vocabulary`, `emitted-syntax`, `in-code-markers`, `page-inputs`, `date-family`,
`untyped-store-key`, `http-request`, `untyped-variable`.

⚠️ **Do not convert all 32 call sites wholesale** — one program is ~750 ms and that roughly triples
the suite. Add one row per file over the **richest** graph, as §25 did.

### 2. Three EXP-004 lines still need Richard, not a session

None can be closed by whoever wrote the artefact; all three are recorded as unrun, not ticked:

- **The comprehension test** — *"a developer unfamiliar with the project reads the exported README
  and can state what needs doing without asking questions."* `tests/fixtures/puppy-test-3` exports
  the richest example.
- **The external review of the verification wording** (implementation step 6).
- **Whether the preserved source block actually helps** — the code is *there*; whether a developer
  can rewrite `formatList` from it is unmeasured.

### 3. Decide whether the editor gets an export command at all — Richard's call

`@nodegx/export` still has **no consumer anywhere in the product**; the only way to run an export is
`ts-node scripts/emit-app.ts` by hand. The in-editor report is blocked on an editor export
command — a feature, not a wiring job — and is owned by **`NONE`**. §21.1 has the evidence.
**Ask before building it.** It may belong in its own task.

### 4. `NodeIR.sourceText` still has no consumer — decide, do not inherit

The field the IR documents as *"the preserved-as-comment fallback"* is written by the parser and
read by nothing; s52 quoted `JsFunctionPlan.body` instead. **Adopt it or delete it**, rather than
carrying the ambiguity a fifth time.

### 5. `Navigate To Path`'s `Completed` chain (§24.6)

Still refuses an `Error` read, deliberately. Translating it means hoisting the message above the
branch, which changes the emitted shape for every node of this kind. A slice of its own, and not
obviously worth it — decide before starting.

### 6. The collection-state slice — unblocks `Set Object Properties` and `Remove Object From Array`.

### 7. The date family's signals — an `effect()` slice, not a date slice (§9.6).

### 8. EXP-009 leftovers — drive the exported login/admin forms; delete the drive-residue user
`exp009-drive` from the local Puppy backend's `_User`.

## 🔴 What session 54 would tell you if it could only say three things

1. **Ask what population a checker runs over, not just what it checks.** The mechanism was right
   and the reach was wrong, and the two facts that showed it were already written three lines apart
   in the same document.
2. **A new checker's first findings are about the checker.** Two of two, this session. The
   discipline that caught both was refusing to read any diagnostic as a defect until the
   known-good arm reached **exactly zero**.
3. **Put the control pair in the suite, not in the scratchpad.** A checker that cannot go red
   grades nothing, and the proof that it can should not expire with the session that built it.

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

⚠️ **The shell's cwd is shared and parallel `cd` calls race** — two `cd packages/nodegx-export`
calls issued in one turn left the second in the wrong directory this session. **Use absolute paths
in any command you send in parallel.**
✅ **Restore a mutated `src` with `cp -a snap/src/. src/` and then `diff -r`** — a relative `cp`
after a `cd` has silently failed here before.
⚠️ **`jest -t` takes a REGEX**, and a filtered run that matches nothing still exits 0. **Check the
summary line says something ran.**

## Building and driving an exported app

- **`scripts/emit-app.ts` is the honest runner** — `emit-app.ts <project> <outDir>`, or
  `--preflight <project>` for the read-standing-up summary (writes nothing). ~1.5 s to start.
- 🔴 **The build is still the only instrument for the real third-party libraries** — the new
  typecheck suite grades `react-router-dom` against declarations, not against v7.
- Harness: `cp -a` a prepared harness (so the `@nodegx/core` symlink survives), `rm -rf src dist
  tsconfig.tsbuildinfo`, then emit into it. **Never overwrite its `package.json`.**
- 🔴 **Author a fixture project by copying `tests/fixtures/cheer`** and editing its
  `components/Pages/Notes/{nodes,connections}.json` — far cheaper than driving MCP.
- Serve with `npx vite preview --port 53xx --strictPort`; stop it by port
  (`lsof -ti :53xx -sTCP:LISTEN | xargs kill`). ⚠️ **`vite preview` binds `localhost`, and
  `curl 127.0.0.1` gets nothing.**
- 🔴 **Poll for readiness, never sleep.** A fixed sleep is what made s53's control stop reproducing.
- 🔴 **The scaffold's router has `<Route path="*" element={<Navigate to="/" replace />} />`** — a
  navigation to an unrouted path is **erased** before you can read the url.
- ⚠️ **A React input needs the native value setter plus an `input` event**, even when uncontrolled.
- 🔴 Click with `Input.dispatchMouseEvent`, never `element.click()`. Read `textContent` per element.
- 🔴 **Write the expected answers down before the app runs**, then **sabotage in separate arms**.
- ⚠️ **An error row is never cleared** — a success row must run **before** any failure row, and a
  row that navigates away runs **last**.

## Instruments

s54 scratchpad `61e7da69-…/scratchpad/`: `snap/src` (the pre-mutation snapshot).
s53 `efd50c1e-…` — `mut.py` (the guarded mutation runner), `harness/` (a built export with
`node_modules` and the `@nodegx/core` symlink), `proj2/` (a drivable authored `cheer` variant),
`drive.mjs`, `arm.sh`, `EXPECTED.md`. **The harness is still intact** and is what proved the
typecheck design reaches zero against the real `react-router-dom@7`.
s52 `e4b8cbef-…`; s51 `9fcea17d-…`; s50 `e54aeffc-…`; s49 `481a2793-…`; s48 `e6b5ff80-…`;
s47 `99fc4b87-…`; s46 `cf0e64bb-…/openarm/`; s44 `7408cf11-…`; s43 `2011a26f-…`; s40 `1a63a0f6-…`.

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a` / `grep -a`.
