# Next session — the chain-local is closed; the suite's blind spot is not

## Where the phase stands

**Session 53 built EXP-011 §24**: the `Error` read from inside `External Link`'s and
`Navigate To Path`'s own outcome chains. It was the last increment those two nodes were carrying,
owed since §14.4 and repeated unchanged in §17.6, §18.6, §21.7 and §22.8. **It is closed. Take it
off every list.**

**69 of 127 (54.3%)** — unchanged for a sixth session, and correctly: §24 is a fidelity increment
on two nodes the picker already counts, not a new type. Do not expect this number to move for work
of this kind.

## 🔴 Read this before planning anything

1. 🔴 **Every emitted-code assertion in this package is a parse, not a typecheck** — and one whole
   class of defect is invisible to all 1054 rows because of it. §24.3 has the demonstration: with
   the row-earning clauses removed the export emits `lastLinkError.set(helpError)` with **no
   `useState` above it**, and the suite stayed green. `expectParses` parses, and an undeclared
   identifier is valid syntax. **This is the most valuable unowned item in the phase right now**
   and it is cheap: one suite running `ts.createProgram` over the emitted files of every fixture.
   Owner today is **`NONE`**.
2. 🔴 **Build the app. It is the only instrument that found either of this session's two real
   defects.** Both control arms failed with `TS2304`, which no test in this package can produce.
3. 🔴 **A "read from the node's own chain" is not one question.** §24.1 has the table: the Failure
   arm, the Done arm and a `Completed` join get three different answers, and two of the three are
   *not* the chain-local. Assume the same of any node with more than one outcome.
4. **Grep for the thing before building it, and read what a passing assertion means.** s51's README
   already shipped for one project in seven; s52's field had no consumer; s53's refusal was pinned
   by a test that asserted the *reason* and had to be rewritten rather than deleted.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The numbers

```
npm run export-ledger:picker      # ratcheted in PR CI — holds at 69/127 (54.3%)
npm run export-ledger:check       # 175 types: 83 deferred, 76 translated, 1 stubbed, 15 backend-only
```

🔴 The corpus audit is a regression net, never a priority oracle.
🔴 Custom node types are **deliberately** outside the picker number — `$customNodesComment` in
`packages/nodegx-export/coverage-ledger.json` says why. Do not "fix" it by adding them.

## Do this next — in the order they are worth doing

### 1. The typecheck suite (§24.6) — the highest-value unowned item

One suite, `ts.createProgram` over every fixture's emitted files, asserting zero diagnostics. It
retires a class of defect rather than an instance, and this session proved the class is live.
⚠️ It needs the emitted app's dependencies to resolve — the harness in the scratchpad below is a
working `node_modules` with the `@nodegx/core` symlink intact, so start from that rather than
installing anything.

### 2. Three EXP-004 lines still need Richard, not a session

None can be closed by whoever wrote the artefact, and all three are recorded as unrun rather than
quietly ticked:

- **The comprehension test** — *"a developer unfamiliar with the project reads the exported README
  and can state what needs doing without asking questions."* Ask Richard to read one;
  `tests/fixtures/puppy-test-3` exports the richest example.
- **The external review of the verification wording** (implementation step 6).
- **Whether the preserved source block actually helps** — s52 proved the code is *there*; whether
  a developer can rewrite `formatList` from it is unmeasured.

### 3. Decide whether the editor gets an export command at all — Richard's call

`@nodegx/export` still has **no consumer anywhere in the product**; the only way to run an export
is `ts-node scripts/emit-app.ts` by hand. The in-editor report is blocked on an editor export
command — a feature, not a wiring job — and is owned by **`NONE`**. §21.1 has the evidence.
**Ask before building it.** It may belong in its own task.

### 4. `NodeIR.sourceText` still has no consumer — decide, do not inherit

The field the IR documents as *"the preserved-as-comment fallback"* is written by the parser and
read by nothing; s52 quoted `JsFunctionPlan.body` instead. **Adopt it or delete it**, rather than
carrying the ambiguity a fourth time.

### 5. `Navigate To Path`'s `Completed` chain (§24.6)

Still refuses an `Error` read, deliberately. Translating it means hoisting the message above the
branch, which changes the emitted shape for every node of this kind. A slice of its own, and not
obviously worth it — decide before starting.

### 6. The collection-state slice — unblocks `Set Object Properties` and `Remove Object From Array`.

### 7. The date family's signals — an `effect()` slice, not a date slice (§9.6).

### 8. EXP-009 leftovers — drive the exported login/admin forms; delete the drive-residue user
`exp009-drive` from the local Puppy backend's `_User`.

## 🔴 What session 53 would tell you if it could only say three things

1. **Assert that a read RESOLVES, not just that it appears.** The whole suite passed on a component
   that could not compile, because every row asked whether text was present and none asked whether
   the name it used existed.
2. **A control that stops reproducing is a broken instrument until proven otherwise.** A fixed sleep
   after a rebuild raced the preview server; both sabotage arms "worked" and so did the control's
   absence of an effect. **Re-run the control before believing an arm.**
3. **Two clauses that each survive removal are not two pieces of dead code.** They were redundant
   with *each other*, and the pair was load-bearing. Removing them one at a time measures nothing —
   and the first attempt to remove "both" left a third one standing.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files. ⚠️ A *new* test
file is untracked, and `git commit <pathspec>` **errors** rather than skipping it — `git add` it
and commit in the same command so the staging window stays closed.
⚠️ **Delete scratch scripts from `scripts/` and probe specs from `tests/` before committing.**
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 1054/1054, 42 suites (1044/42 before §24)
cd ../nodegx-module-inject && ../../node_modules/.bin/jest --config jest.config.js   # 31/31
cd ../noodl-runtime && ../../node_modules/.bin/jest   # 2564 passed, 13 skipped, 144 suites
npm run export-ledger:picker                  # from the repo root — holds at 69/127
npm run export-ledger:check                   # 175 types
```

⚠️ **`test:ci` was not run by this session and was not needed** — nothing outside
`packages/nodegx-export` was touched. If you touch `noodl-runtime`, run it yourself rather than
inheriting a relayed floor.

✅ **The full jest suite takes ~10–18 s, not minutes.** A 15-mutant run against the *whole* suite
finished in about four minutes. The inherited warning that a mutation run needs
`run_in_background` is still worth honouring for anything over ~10 mutants, but a handful is fine
in the foreground.
✅ **`ts-node` starts `scripts/emit-app.ts` in ~1.5 s** — measured again this session.
⚠️ **A foreground `sleep` is blocked.** To wait, use `run_in_background: true` with an
`until <check>; do sleep 5; done` loop.
⚠️ **A backgrounded command resets the shell cwd** — an absolute path after one, always. A `cp`
with a relative destination after a `cd` inside a compound silently failed to restore a mutated
source file this session; it was caught by `diff -r src snap/src`.
⚠️ **`jest -t` takes a REGEX**, and a filtered run that matches nothing still exits 0. **Check the
summary line says something ran.**
Copy a harness with **`cp -a`** so the `@nodegx/core` symlink survives.

## Building and driving an exported app

- **`scripts/emit-app.ts` is the honest runner** — `emit-app.ts <project> <outDir>`, or
  `--preflight <project>` for the read-standing-up summary (writes nothing).
- Harness: `cp -a` a prepared harness, `rm -rf src dist tsconfig.tsbuildinfo`, then emit into it.
  **Never overwrite its `package.json`.**
- `npm run build` runs `tsc -b && vite build`. 🔴 **This is the step that finds what the tests
  structurally cannot** — an undeclared name, an out-of-scope local, a type the parser is happy
  with. Both of session 53's control arms failed here and nowhere else.
- 🔴 **Author a fixture project by copying `tests/fixtures/cheer` and editing its
  `components/Pages/Notes/{nodes,connections}.json`.** That is far cheaper than driving MCP, and
  the fixtures are real projects on disk.
- Serve with `npx vite preview --port 53xx --strictPort`; stop it by port
  (`lsof -ti :53xx -sTCP:LISTEN | xargs kill`). ⚠️ **`vite preview` binds `localhost`, and
  `curl 127.0.0.1` gets nothing.**
- 🔴 **Poll for readiness, never sleep.** Wait for HTTP 200 *and* for the page to hydrate, and poll
  for the effect of a click rather than sleeping after it. A fixed sleep is what made the control
  stop reproducing this session.
- 🔴 **The scaffold's router has `<Route path="*" element={<Navigate to="/" replace />} />`.** A
  navigation to an unrouted path is **erased** before you can read the url. Navigate somewhere that
  exists — a query parameter on a real route carries a message just as well.
- ⚠️ **A React input needs the native value setter plus an `input` event, even when uncontrolled** —
  a plain `i.value = …` is swallowed by React's value tracker and the store never sees it.
- 🔴 Click with `Input.dispatchMouseEvent`, never `element.click()`. Read `textContent` per element,
  never `body.innerText`. Launch Chrome on its own debug port with a fresh `--user-data-dir`, and
  **close leftover tabs** before attaching — a popup from a previous row can be the target you get.
- 🔴 **Write the expected answers down before the app runs**, then **sabotage in separate arms**.
- ⚠️ **An error row is never cleared**, so a success row must run **before** any failure row, and a
  row that navigates away runs **last**.

## Instruments

s53 scratchpad `efd50c1e-…/scratchpad/`: `mut.py` (the guarded runner), `snap/`, `harness/` (a
built export with `node_modules` and the `@nodegx/core` symlink), `proj/` + `proj2/` (the authored
`cheer` variants — `proj2` is the drivable one), `drive.mjs` (CDP drive with readiness polls),
`arm.sh` (emit → build → serve → wait → drive, one sabotage arm), `EXPECTED.md`.
s52 `e4b8cbef-…`; s51 `9fcea17d-…`; s50 `e54aeffc-…`; s49 `481a2793-…`; s48 `e6b5ff80-…`;
s47 `99fc4b87-…`; s46 `cf0e64bb-…/openarm/`; s44 `7408cf11-…`; s43 `2011a26f-…`; s40 `1a63a0f6-…`;
s38 `e94a3353-…`.

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a` / `grep -a`.
