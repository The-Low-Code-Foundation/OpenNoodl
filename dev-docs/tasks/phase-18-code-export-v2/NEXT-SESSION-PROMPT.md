# Next session — the pre-flight is exact, and the last EXP-004 surface has nowhere to live

## Where the phase stands

**Tier 1 closed in session 38. s39–s47 built the Tier 2.5 nodes. s48 built `EXPORT-REPORT.md`,
s49 the in-code markers, s50 the pre-flight — EXP-004 is now three of its four parts.** The fourth,
the in-editor report, is **blocked**, and finding out why was the session's most useful result.

**69 of 127 (54.3%)** — unchanged for three sessions, and the floor is ratcheted. Nothing on the
picker moved, deliberately.

## 🔴 Read this before planning anything

**`@nodegx/export` has no consumer anywhere in the product.** Not an import, not a dependency
entry, not a webpack alias — three repo-wide grep hits and all three are comments. The only way to
run a code export today is `ts-node scripts/emit-app.ts` by hand.

Every list in this phase has described what remains as *"both editor surfaces (pre-flight estimate,
in-editor report)"*, which reads as two panels waiting to be drawn. It is not that. **There is no
post-export moment in the editor to attach a report to, because there is no export command.**
EXP-004 puts the export mechanism explicitly out of scope, so that surface is blocked on a task
that is not EXP-004. It is recorded with its evidence in
[§21.1](./EXP-011-PICKER-COVERAGE.md) and owned by **`NONE`**.

⚠️ **The wiring is not the hard part** — the editor already aliases sibling packages by path, and
`ts-loader`'s `exclude: /node_modules/` does not bite a symlinked workspace package. What is
missing is the command, the directory picker, the failure handling and a drill-down panel.

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

## What session 50 settled, so nobody re-opens it

**The pre-flight is exact, and EXP-004's word "estimate" is what gave way.** `emitApp` is pure —
reads nothing, writes nothing, ~0.1 s per corpus project — so the real answer is available before
the author picks a directory. A margin would be a defect, not a tolerance.

🔴 **The cheap version was measured before any code was written, because it is the one you will
reach for.** Stopping after `planProject` sees **28** refusals across the seven fixtures where the
export records **32**; the four it misses are decided during emission. Building it so that a
"within a reasonable margin" test had something to pass would have been a measurement that could
not fail. The suite now asserts `planLayer < exact`, so a rewrite to the cheap layer reddens a row.

⚠️ **`cleanFlips = 0`** — no fixture has a component whose *only* refusals are emit-layer, so the
cheap layer would still sort every component onto the right side of "clean". **That is a fact about
the corpus, not a property of the layers.**

**One decision, two readers:** `backendMode()` in `report.ts` is read by both the report and the
pre-flight, so the before and after surfaces cannot disagree about the same project.

## Do this next — in the order they are worth doing

### 1. Decide whether the editor gets an export command at all — this is Richard's call

Everything left in EXP-004, and the whole value of EXP-002/009/010/011, is reachable only from a
terminal. **Ask before building it**: it is a feature (command, picker, progress, failure states,
a drill-down panel), not a wiring job, and it may belong in its own task rather than under EXP-004.

### 2. A chain-local for `Error` (§14.6, §17.6, §18.6) — owed by **two** nodes

`External Link` and `Navigate To Path` both refuse a read of `Error` from inside their own outcome
chains, on §8.2's closure rule. One chain-local closes both.

### 3. The collection-state slice — unblocks `Set Object Properties` and `Remove Object From Array`.

### 4. The date family's signals — an `effect()` slice, not a date slice (§9.6).

### 5. EXP-009 leftovers — drive the exported login/admin forms; delete the drive-residue user
`exp009-drive` from the local Puppy backend's `_User`.

## 🔴 Four things session 50 left honestly unfinished

**The pre-flight has an engine and a CLI host, and no host an author reaches.** It is exactly as
reachable as the export itself — which is the consistent position, not a good one. "The user
decides with accurate expectations" is untrue of anyone not running `ts-node`.

**The exported `README.md` and the ordered next-steps list are still unbuilt** — both are EXP-004
scope items, both still unchecked in the task file, and neither is blocked by anything.

**The in-code marker does not carry the original node source**, which EXP-004 asks for. It names
the refused port and the reason. Recorded as a narrowing rather than checked off.

**The tie-break in the pre-flight's sort is an equivalent mutant** — removing it renders
byte-identical output on all seven fixtures, because `puppy-test-3`'s tied pair already emits in
alphabetical order. Kept for a tie that is not, and recorded as unmeasured rather than claimed.

## 🔴 What session 50 would tell you if it could only say three things

1. **Grep for the consumer before planning the surface.** Two sessions listed "editor surfaces" as
   ordinary remaining work. One `grep -rln` over `packages/` — thirty seconds — showed the package
   has no consumer at all, which is a different problem with a different owner. **Ask what hosts
   this**, not just what it should look like.
2. 🔴 **A test written to pass a spec's phrasing can be a test that cannot fail.** The spec asked
   for an estimate within a margin. Honouring that literally would have meant building a worse
   predictor so the margin existed. **When the spec's premise is obsolete, say so in the task file
   and measure the alternative** — §21.2 has the 28-vs-32 that makes it an argument rather than an
   opinion.
3. **Print the output and read it.** Both real defects this session — a headline count blind to
   components with no file at all, and a sentence describing a different list from the one beneath
   it — were found by rendering three fixtures and reading them. Neither was a type error and
   neither would have failed a test that did not already know to look.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files. ⚠️ A *new* test
file is untracked, and `git commit <pathspec>` **errors** rather than skipping it — `git add` it
and commit in the same command so the staging window stays closed.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 986/986, 41 suites (927/40 before §21)
cd ../nodegx-module-inject && ../../node_modules/.bin/jest --config jest.config.js   # 31/31
cd ../noodl-runtime && ../../node_modules/.bin/jest   # 2564 passed, 13 skipped, 144 suites
npm run export-ledger:picker                  # from the repo root — holds at 69/127
npm run export-ledger:check                   # 175 types
```

⚠️ **`test:ci` was not run by this session, and this session did not need it** — nothing outside
`packages/nodegx-export` was touched, and `noodl-runtime` was not re-run for the same reason. If
you touch `noodl-runtime`, run both yourself rather than inheriting a relayed floor.

✅ **`ts-node` starts `scripts/emit-app.ts` in ~1.5 s — measured, 2026-08-29.** The inherited
warning that it "takes well over two minutes" does **not** reproduce, and it had hardened into
standing advice to background every run. Three rows in `tests/preflight.test.ts` drive the script
directly because of this; each costs ~3 s.
⚠️ **A foreground `sleep` is blocked.** To wait, use `run_in_background: true` with an
`until <check>; do sleep 5; done` loop.
🔴 **`nohup … &` inside a Bash call returns exit 0 immediately with an empty log** — that is the
launcher exiting, not the job. Confirm with `ps -Ao pid,ppid,etime,command` before reading.
⚠️ **`${PIPESTATUS[0]}` is empty in zsh** — run gates **without a pipe** and read `$?`.
Copy a harness with **`cp -a`** so the `@nodegx/core` symlink survives.

## Running the pre-flight

```
cd packages/nodegx-export
../../node_modules/.bin/ts-node -P tsconfig.json scripts/emit-app.ts --preflight tests/fixtures/puppy-test-3
```

Writes nothing, prints the summary to stdout. Without the flag the second argument is the output
directory and the export writes **`files` and `copies`** — §19.6's defect was dropping the second.

## Mutation testing, which is now a four-file habit

`mut.py` in each session's scratchpad is the runner and is worth copying rather than rewriting:

- the verdict comes from jest's **summary line and exit code**, never a `--json` key;
- the tree is restored from a snapshot and **byte-compared** after every mutant;
- a mutant whose search text matches ≠ 1 times is **NOT-APPLIED**, never "survived";
- 🔴 **and when a mutant survives, check whether it is *equivalent* before writing a test for it** —
  s50 dumped the rendered output with and without the tie-break and found them byte-identical.
  A row added to kill an equivalent mutant grades nothing.

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

- **`scripts/emit-app.ts` is the honest runner** — it writes `files` **and `copies`** (§19.6) and
  `EXPORT-REPORT.md`, and now also answers `--preflight`.
- Harness: `cp -a` a prepared harness, `rm -rf src dist tsconfig.tsbuildinfo`, then emit into it.
  **Never overwrite its `package.json`.**
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

s50 scratchpad `e54aeffc-…/scratchpad/`: `mut.py` (nine mutants incl. the two sort mutants),
`snap/` (the pre-mutation snapshot), `ord-baseline.txt` / `ord-mutant.txt` (the equivalence check).
s49 `481a2793-…`; s48 `e6b5ff80-…`; s47 `99fc4b87-…`; s46 `cf0e64bb-…/openarm/`;
s44 `7408cf11-…`; s43 `2011a26f-…`; s40 `1a63a0f6-…`; s38 `e94a3353-…` (the original harness).

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a` / `grep -a`.
