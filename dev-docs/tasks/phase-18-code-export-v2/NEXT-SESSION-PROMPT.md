# Next session — EXP-004 is done to its blocked edge, and what is left needs a person or a host

## Where the phase stands

**Session 51 built EXP-004's last two unblocked scope items**: the exported `README.md` and the
ordered next steps. Everything in EXP-004 that an author can reach without an editor export command
is now built and graded. What remains in that task is **one thing blocked on a host** (§21.1) and
**two things that need a human being** — see below, and do not try to satisfy them by writing a test.

**69 of 127 (54.3%)** — unchanged for a fourth session, and the floor is ratcheted. Nothing on the
picker moved, deliberately.

## 🔴 Read this before planning anything

Both still true and both still the most useful facts in the file:

1. **`@nodegx/export` has no consumer anywhere in the product.** Three repo-wide grep hits, all
   comments. The only way to run a code export today is `ts-node scripts/emit-app.ts` by hand.
   The in-editor report is blocked on an **editor export command**, which is a feature and not a
   wiring job, and it is owned by **`NONE`**. §21.1 has the evidence.
2. 🔴 **The word "still unbuilt" in a task file is not the same as "not there".** Session 51's
   finding was that EXP-004's `README.md` had *existed since EXP-009* and was emitted for **one
   corpus project in seven**, because it was pushed from inside `apiModules` under
   `backend !== undefined && hasApi`. **A test was pinning the absence** — `expect(...README...)
   .toBeUndefined()`, sitting under a `describe` titled *"a project with no backend still exports
   and builds, **and says so**"*. Before building a scope item, **check whether a broken version of
   it already ships**. §22.1.

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

### 1. Two EXP-004 lines now need Richard, not a session

Neither can be closed by the person who wrote the prose, and both are recorded as unrun rather than
quietly checked off:

- **The comprehension test.** *"A developer unfamiliar with the project reads the exported README
  and can state what needs doing without asking questions."* Session 51 wrote that README. The
  author of a document is the one reader guaranteed to find it clear. **Ask Richard to read one**
  — `tests/fixtures/puppy-test-3` exports the richest example — and to say what he could not work
  out from it.
- **The external review of the verification wording** (implementation step 6). Same reason.

### 2. Decide whether the editor gets an export command at all — Richard's call

Unchanged from session 50 and now the only thing standing between this phase and its whole value
being reachable outside a terminal. **Ask before building it.** It may belong in its own task.

### 3. The in-code marker's missing node source — EXP-004, unblocked, unbuilt

EXP-004 asks for *"the original node source preserved in comments so a developer can see what the
code is meant to do."* The marker today names the refused port and the reason. This is the last
EXP-004 scope line that is neither blocked nor waiting on a person.

### 4. A chain-local for `Error` (§14.6, §17.6, §18.6) — owed by **two** nodes

`External Link` and `Navigate To Path` both refuse a read of `Error` from inside their own outcome
chains, on §8.2's closure rule. One chain-local closes both.

### 5. The collection-state slice — unblocks `Set Object Properties` and `Remove Object From Array`.

### 6. The date family's signals — an `effect()` slice, not a date slice (§9.6).

### 7. EXP-009 leftovers — drive the exported login/admin forms; delete the drive-residue user
`exp009-drive` from the local Puppy backend's `_User`.

## 🔴 What session 51 left honestly unfinished

**The stubbed-backend step is exercised only by hand-built data.** No corpus project both queries a
backend and declares none, so the `src/api/http.ts` exclusion in that step's file list is driven
directly through `nextSteps`. That is a fact about the corpus, not a property of the code — the same
shape as §21.2's `cleanFlips = 0`, and it is recorded rather than glossed.

**Nobody has read either generated document except the session that wrote them.** Every claim about
the README and the report being *clear* is unmeasured. What is measured is that they are complete,
consistent with each other, and never say "verified".

**`nextSteps`' rank 1-over-2 is a judgement.** A component with no file is ranked above a stubbed
backend. A missing component takes out one screen; stubbed data access takes out every data path in
the app. Both lines state their cost so the reading does not rest on the rank — but the rank itself
was chosen, not measured, and §22.2 says so.

## 🔴 What session 51 would tell you if it could only say three things

1. **Grep for the thing before building it.** The scope line said *"a `README.md` in the exported
   project"* and read like a new file. It was a file that already shipped, for one project in seven,
   from a condition that looked correct where it sat. **Thirty seconds of `grep -rn README` changed
   the task from "write a document" to "fix a reach defect and then write the document."**
2. 🔴 **A green test can be pinning the defect, under a heading that contradicts it.** `no client,
   no .env.example, no README` was asserting the absence of the very file its `describe` block said
   the export owed a backendless project. Read what a passing assertion *means*, not just that it
   passes — especially when its name and its parent's name disagree.
3. **Print the generated prose and read it as a reader.** Four defects came out of that and none was
   a type error: a bare `1` in *"Write the 1 component"*, the word *things* where EXP-004 requires
   specifics, three near-identical caveats stacked on a clean export, and a straight apostrophe in a
   file sitting next to one that emits a curly one.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files. ⚠️ A *new* test
file is untracked, and `git commit <pathspec>` **errors** rather than skipping it — `git add` it
and commit in the same command so the staging window stays closed.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 1039/1039, 42 suites (986/41 before §22)
cd ../nodegx-module-inject && ../../node_modules/.bin/jest --config jest.config.js   # 31/31
cd ../noodl-runtime && ../../node_modules/.bin/jest   # 2564 passed, 13 skipped, 144 suites
npm run export-ledger:picker                  # from the repo root — holds at 69/127
npm run export-ledger:check                   # 175 types
```

⚠️ **`test:ci` was not run by this session, and this session did not need it** — nothing outside
`packages/nodegx-export` was touched. If you touch `noodl-runtime`, run it yourself rather than
inheriting a relayed floor.

✅ **`ts-node` starts `scripts/emit-app.ts` in ~1.5 s — measured, 2026-08-29.** The inherited warning
that it "takes well over two minutes" does **not** reproduce.
⚠️ **A foreground `sleep` is blocked.** To wait, use `run_in_background: true` with an
`until <check>; do sleep 5; done` loop.
🔴 **A full-suite mutation run takes ~5 minutes and the tool timeout is 2.** Session 51's first
attempt was **killed mid-mutant at 120 s, leaving the tree mutated** — the runner's `restore()`
never reached. **Launch it with `run_in_background: true`, and if a run is ever interrupted,
restore from `snap/` and assert byte-identity before doing anything else.**
⚠️ **`${PIPESTATUS[0]}` is empty in zsh** — run gates **without a pipe** and read `$?`.
Copy a harness with **`cp -a`** so the `@nodegx/core` symlink survives.

## Running the pre-flight

```
cd packages/nodegx-export
../../node_modules/.bin/ts-node -P tsconfig.json scripts/emit-app.ts --preflight tests/fixtures/puppy-test-3
```

Writes nothing, prints the summary to stdout. Without the flag the second argument is the output
directory and the export writes **`files` and `copies`** — §19.6's defect was dropping the second.

## The three documents the export now writes, and who reads which

- **`EXPORT-REPORT.md`** — the complete itemised record of every refusal, in the exporter's own
  words. **The `TODO(export)` markers in the generated code point at it by name.**
- **`README.md`** — the front door. What the repo is, how to run it, the ordered next steps, the
  backend's environment variables when there is one, and the two things a developer has to know
  before typing (nothing has been run; export is one-way). **Emitted for every project since §22.**
- **The pre-flight** (`--preflight`, stdout only) — read standing up, before any of it exists.
  🔴 **It deliberately does not carry the next steps** — §22.3 says why; do not "fix" that.

🔴 **The ordered steps are one function, `nextSteps()`, with two renderers.** If you change the
list, change it there. `tests/exported-readme.test.ts` crosses the two documents per fixture, so a
hand-rolled second copy reddens rather than drifts.

## Mutation testing, which is now a four-file habit

`mut.py` in each session's scratchpad is the runner and is worth copying rather than rewriting:

- the verdict comes from jest's **summary line and exit code**, never a `--json` key;
- the tree is restored from a snapshot and **byte-compared** after every mutant;
- a mutant whose search text matches ≠ 1 times is **NOT-APPLIED**, never "survived";
- 🔴 **when a mutant survives, check whether it is *equivalent* before writing a test for it** —
  s50 dumped rendered output with and without a tie-break and found them byte-identical;
- 🔴 **snapshot `tests/` as well as `src/` and `scripts/`** — s51's mutants needed the whole suite,
  and a restore that omits `tests/` leaves an edited suite behind if the run is interrupted.

## Authoring a project without an MCP server bound to it (unchanged, and it works)

⚠️ **The session's own `nodegx` MCP server binds ONCE**, and `open_project` on a different
directory reports `bound: false` and changes nothing. Use the stdio client instead.

1. Drive a **second server over stdio from a script**: `mcp-client.mjs`, ~50 lines over `spawn` +
   newline-delimited JSON-RPC, running the server from **`src` via ts-node**, never `dist/`.
   ⚠️ Its calls file is a list of `{ "name", "arguments" }` — not `{ "tool", "args" }`.
2. `update_component` takes `operations` (`add_node` / `add_connection` / …) — for **appending**
   to an existing page it is the one to use, and a second run does not duplicate nodes.
3. ⚠️ `p-`/`q-` parameters report `dynamic-port-skipped` at **info** severity and the write lands.
   That is "unverified", not "verified correct" — the emitted code is the check.
4. ⚠️ **Create a page before any page that navigates to it**, and **writing a page can steal
   `startPage`** — check `components/App/nodes.json` afterwards.
5. ⚠️ An `HTTP Request` fixture needs **`url`**, not `resource`.

## Building and driving an exported app

- **`scripts/emit-app.ts` is the honest runner** — it writes `files` **and `copies`** (§19.6),
  `EXPORT-REPORT.md`, `README.md`, and answers `--preflight`.
- Harness: `cp -a` a prepared harness, `rm -rf src dist tsconfig.tsbuildinfo`, then emit into it.
  **Never overwrite its `package.json`.** ⚠️ The export now writes `README.md` unconditionally, so
  a harness with its own README will have it replaced — that is intended, and worth knowing.
- `npm run build` runs `tsc -b && vite build`. **This is the step that finds what tests cannot.**
- Serve with `npx vite preview --port 53xx --strictPort`; stop it by port
  (`lsof -ti :53xx -sTCP:LISTEN | xargs kill`). ⚠️ **`vite preview` binds `localhost`, and
  `curl 127.0.0.1` gets nothing.**
- Launch Chrome **separately** on a non-default debug port with a fresh `--user-data-dir`.
  🔴 **Do not pass `--disable-popup-blocking`** if a `window.open` is under test.
- 🔴 **Read `textContent` per element, never `body.innerText`**.
- 🔴 **Click with `Input.dispatchMouseEvent`**, never `element.click()`.
- ⚠️ **A React controlled input needs the native value setter plus an `input` event.**
- 🔴 **Write the expected answers down before the app runs**, then **sabotage in separate arms**.
- ⚠️ **An error row is never cleared**, so a success row must run **before** any failure row, and
  a row that navigates away runs **last**.

## Instruments

s51 scratchpad `9fcea17d-…/scratchpad/`: `mut.py` (sixteen mutants over `report.ts`, `readme.ts`
and `emitApp.ts`, run against the whole suite), `snap/` (the pre-mutation snapshot, including
`tests/`), `mut-out.txt` (the verdicts).
s50 `e54aeffc-…`; s49 `481a2793-…`; s48 `e6b5ff80-…`; s47 `99fc4b87-…`; s46 `cf0e64bb-…/openarm/`;
s44 `7408cf11-…`; s43 `2011a26f-…`; s40 `1a63a0f6-…`; s38 `e94a3353-…` (the original harness).

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a` / `grep -a`.
