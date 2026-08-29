# Next session — the typecheck rows are placed, and the list that asked for them was mostly wrong

## Where the phase stands

**Session 55 closed §25.4's item.** Three `typecheckEmittedApp` rows were added — to
`untyped-variable`, `untyped-store-key` and `page-inputs` — and **five of the eight files §25.4
named needed no row at all**, because the fixture suite already compiles their shapes. §26 has the
table, file by file, with the reason for each verdict.

**69 of 127 (54.3%)** — unchanged, and correctly: this session added no translation.

## 🔴 Read this before planning anything

1. 🔴 **§25.4's list of eight was built by grepping for parse helpers — a fact about the
   *checkers*, not about the population.** That is the exact mistake §25 was written to warn
   about, made in §25's own closing paragraph. `emitted-syntax` and `in-code-markers` iterate the
   fixture directory itself; `http-request`, `array-vocabulary` and `date-family` are covered by
   `quote-desk`, `reading-shelf` and `deadline-desk`. **Before adding a checker anywhere, read
   what the existing population already reaches.**
2. 🔴 **A green row is not evidence that it grades anything new.** The `http-request` and
   `array-vocabulary` rows were written, went green, and were reverted once the fixtures were
   actually read. Passing said nothing either way.
3. 🔴 **`git diff -- packages/nodegx-export/src` run from *inside* `packages/nodegx-export`
   matches nothing and prints nothing** — pathspecs are relative to cwd, and empty output reads
   exactly like "clean". It was believed once this session. **Run `git` from the repo root, or
   check `git status --short` which is not pathspec-filtered.** The independent check that was
   sound was `diff -r snap/src src`.
4. **Building the app is still the only instrument for the real third-party libraries** — the
   helper *declares* `react-router-dom` rather than resolving it (repo has v5, app wants v7), so
   `page-inputs`' new row is graded against that declaration.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The numbers

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 1070/1070, 43 suites (1067/43 before §26); ~20-28 s
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
- **Whether the preserved source block actually helps** — the code is *there*; whether a developer
  can rewrite `formatList` from it is unmeasured.

### 2. Decide whether the editor gets an export command at all — Richard's call

`@nodegx/export` still has **no consumer anywhere in the product**; the only way to run an export is
`ts-node scripts/emit-app.ts` by hand. The in-editor report is blocked on an editor export
command — a feature, not a wiring job — and is owned by **`NONE`**. §21.1 has the evidence.
**Ask before building it.** It may belong in its own task.

### 3. `NodeIR.sourceText` still has no consumer — decide, do not inherit

The field the IR documents as *"the preserved-as-comment fallback"* is written by the parser and
read by nothing; s52 quoted `JsFunctionPlan.body` instead. **Adopt it or delete it**, rather than
carrying the ambiguity a sixth time.

### 4. `array-vocabulary` emits `mood2?: any;` for a minted `Model2` prop — owner `NONE`

Noticed in passing at §26.4, not investigated. A minted repeater prop typed `any` means the
emitted child grades nothing at that prop, in the compiler or anywhere else. Worth one look before
anybody adds a typecheck row over that graph expecting it to catch something.

### 5. `Navigate To Path`'s `Completed` chain (§24.6)

Still refuses an `Error` read, deliberately. Translating it means hoisting the message above the
branch, which changes the emitted shape for every node of this kind. A slice of its own, and not
obviously worth it — decide before starting.

### 6. The collection-state slice — unblocks `Set Object Properties` and `Remove Object From Array`.

### 7. The date family's signals — an `effect()` slice, not a date slice (§9.6).

### 8. EXP-009 leftovers — drive the exported login/admin forms; delete the drive-residue user
`exp009-drive` from the local Puppy backend's `_User`.

## 🔴 What session 55 would tell you if it could only say three things

1. **Read the population before adding the checker.** Five of eight files on a list written one
   section earlier needed nothing, and reading four fixture `connections.json` files was all it
   took to find out.
2. **A passing new check is not a working new check.** Two rows passed and were still noise.
   Ask what it would catch that something already running does not.
3. **When an instrument reports "clean", check the instrument was pointed at anything.** An empty
   `git diff` from the wrong cwd and a vacuous typecheck over an empty program fail identically:
   silently, and looking exactly like success.

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
you send in parallel.
✅ **Restore a mutated `src` with `cp -a snap/src/. src/` and then `diff -r`** — that pair is what
actually proved `src` was clean this session, not the `git diff` beside it.
⚠️ **`jest -t` takes a REGEX**, and a filtered run that matches nothing still exits 0. **Check the
summary line says something ran** — and grep the output for the row name, because a `tail` can cut
the row you added off the end of the list.

## Mutating the emitter to prove a checker's reach

The pattern that produced §26.3, and it is worth reusing:

1. `cp -a src <scratchpad>/snap/` first.
2. Mutate **by line number after asserting the line's content** — `if (plan.bindings[node.id]?.
   [param.name] !== undefined) continue;` occurs **twice** (kit side 3325, instance side 3395),
   and a `str.replace` assert of `count == 1` correctly refused. A python assert that fails leaves
   the source untouched, which is why the first run measured nothing and said so.
3. Run **both** the new row and the fixture-only suites. The finding is the *disagreement*.
4. `cp -a snap/src/. src/ && diff -r snap/src src`.

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
`Navigate To Path`, an untyped store key, or a wire into a port that already carries an authored
value. Those are the populations only a hand-built graph reaches.

## Instruments

s55 scratchpad `756fcbe6-…/scratchpad/snap/src` (the pre-mutation snapshot).
s54 `61e7da69-…/scratchpad/snap/src`.
s53 `efd50c1e-…` — `mut.py`, `harness/` (a built export with `node_modules` and the `@nodegx/core`
symlink), `proj2/`, `drive.mjs`, `arm.sh`, `EXPECTED.md`. **The harness is still intact.**
s52 `e4b8cbef-…`; s51 `9fcea17d-…`; s50 `e54aeffc-…`; s49 `481a2793-…`; s48 `e6b5ff80-…`;
s47 `99fc4b87-…`; s46 `cf0e64bb-…/openarm/`; s44 `7408cf11-…`; s43 `2011a26f-…`; s40 `1a63a0f6-…`.

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a` / `grep -a`.
