# Next session — the markers exist, and the report is honest about which half they are

## Where the phase stands

**Tier 1 closed in session 38. s39–s47 built the Tier 2.5 nodes one at a time. s48 built
`EXPORT-REPORT.md` — EXP-004's first half — and measured §19.5: the report's own recommended grep
returned nothing. s49 built EXP-004's in-code-marker half, so it no longer does.**

**69 of 127 (54.3%)** — unchanged for two sessions, and the floor is ratcheted. Nothing on the
picker moved, deliberately.

🔴 **Read [§20.1](./EXP-011-PICKER-COVERAGE.md) before instrumenting anything.** s49's first
implementation was correct, typechecked, kept 911/911 green — and fired on **nothing the corpus
contains**, because it was built at the layer where the note-pushing *code* was rather than the
layer where the corpus's *refusals* are decided. A green suite was the warning, not the reassurance.

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

## What session 49 settled, so nobody re-opens it

**A dropped wire marks the end of it that renders — sink first, else source.** The source case is
the more visible failure and has no marker at its sink at all: `deleteBtn:onClick` feeds a Record
verb naming no class, so the button renders, looks live and does nothing when clicked. A wire
between two logic nodes has no element to mark, and that is why **the report is still the complete
list** and the honesty paragraph could not simply be deleted.

**Markers are placed by `renderChildBlocks`, never by `renderCore`.** `renderCore` also returns the
body of `{cond && ( … )}` and the whole of `return ( … )`, and both hold exactly one JSX
expression — a comment prepended there is a second one and does not parse. The root takes `//`
lines above the `return` for the same reason.

**The plan files refusals structurally through `wireNote`**, which writes the `droppedWires` row and
returns the sentence. One call, two channels: that is what stops a reworded refusal from silently
emptying the markers. `notes` wording is unchanged and every suite asserting on it still holds.

⚠️ **Do not add the word "verified" about generated code.** EXP-003 does not exist; nothing has
been run, replayed or compared.

## Do this next — in the order they are worth doing

### 1. EXP-004's editor half — now the only half left, and the larger one

The pre-flight estimate (*before* exporting, so a user decides with accurate expectations) and the
in-editor post-export report with drill-down are both editor surfaces. Nothing in s48 or s49 builds
either. The copy that travels with the code is done; the copy the author sees in NodeGX is not.

### 2. A chain-local for `Error` (§14.6, §17.6, §18.6) — owed by **two** nodes

`External Link` and `Navigate To Path` both refuse a read of `Error` from inside their own outcome
chains, on §8.2's closure rule. One chain-local closes both.

### 3. The collection-state slice — unblocks `Set Object Properties` and `Remove Object From Array`.

### 4. The date family's signals — an `effect()` slice, not a date slice (§9.6).

### 5. EXP-009 leftovers — drive the exported login/admin forms; delete the drive-residue user
`exp009-drive` from the local Puppy backend's `_User`.

## 🔴 Four things session 49 left honestly unfinished

**A marker line is not wrapped.** A long reason prints as one long comment line in the exported
app — up to ~200 characters. Cosmetic, measured, **not fixed**, and it is in a feature whose whole
point is how it reads to a developer.

**Popup slot refusals cannot be marked.** `popupJsx` builds the popup target's element inline and
it has no node id in the render tree to key a marker on, so those stay report-only. The honesty
paragraph covers them; the mechanism does not.

**The leftover sweep's distinctive population is empty**, and it is recorded as empty rather than
claimed shut. Removing it survives the suite today, because every node now carrying a marker is
either the root or in the render tree. It stays load-bearing for a roled node no parent places, or
a future render path like `popupJsx` — and the `it.each` invariant is what would redden.

**Three of the 61 plan sites were deliberately not converted** — two are `wire X:` boot-value reads
(not defects, and marking one would tell an author to fix working code) and one lives in
`planProject` rather than `planComponent`. If a marker ever looks missing, check those first.

## 🔴 What session 49 would tell you if it could only say four things

1. **A green suite after an instrumentation change is a measurement you have not made yet.** The
   row asserting `puppy-test-3` carries no marker *had* to redden if markers were landing. It did
   not, and the reason was that sixteen correct `defer` calls sat in a file the corpus's refusals
   never reach. **Ask what this number would be if the change had done nothing** — and when a
   suite's answer is the same either way, it measured nothing.
2. 🔴 **A checker's population is chosen when you choose where to grep.** `grep notes.push` in the
   emitter answers "where does the emitter report a drop". The question was "where does *this
   project's* drop get decided", and the answer was a different 9,635-line file. Grep for the
   **behaviour in the corpus**, not for the code that would report it.
3. **A mechanical edit over a file containing its own output shape will match its own definition.**
   The converter rewrote `wireNote`'s return statement into a call to itself; 229 tests failed on a
   stack overflow. It was caught in one run **because three dozen suites assert on note wording** —
   the control existed before the edit did, which is the only reason the edit was safe to make.
4. **Two survivors can be one fact.** Removing the explicit root call survived; removing the
   leftover sweep survived; removing **both** reddened. They are two entry points to one mechanism,
   not two holes — and saying which of the two it is, is the point.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files. ⚠️ A *new* test
file is untracked, and `git commit <pathspec>` **errors** rather than skipping it — `git add` it
and commit in the same command so the staging window stays closed.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 927/927, 40 suites (911/39 before §20)
cd ../nodegx-module-inject && ../../node_modules/.bin/jest --config jest.config.js   # 31/31
cd ../noodl-runtime && ../../node_modules/.bin/jest   # 2564 passed, 13 skipped, 144 suites
npm run export-ledger:picker                  # from the repo root — holds at 69/127
npm run export-ledger:check                   # 175 types
```

⚠️ **`test:ci` was not run by this session, and this session did not need it** — nothing outside
`packages/nodegx-export` was touched, and `noodl-runtime` was not re-run for the same reason. If
you touch `noodl-runtime`, run both yourself rather than inheriting s48's relayed floor.

⚠️ `ts-node` needs an **absolute** path and `--compiler-options '{"module":"commonjs"}'`, run from
`packages/nodegx-export` — and it takes **well over two minutes** to start, so run it with
`run_in_background: true` rather than watching a foreground call get killed at 120 s.
Copy a harness with **`cp -a`** so the `@nodegx/core` symlink survives.
⚠️ **`${PIPESTATUS[0]}` is empty in zsh** — run gates **without a pipe** and read `$?`.
⚠️ **A foreground `sleep` is blocked.** To wait, use `run_in_background: true` with an
`until <check>; do sleep 5; done` loop.
🔴 **`nohup … &` inside a Bash call returns exit 0 immediately with an empty log** — that is the
launcher exiting, not the job. Confirm with `ps -Ao pid,ppid,etime,command` before reading.

## Mutation testing, which is now a three-file habit

`mut.py` in the s48 scratchpad is the runner and is worth copying rather than rewriting; s49's
`mut.py`/`mut2.py` are the same three rules applied to a smaller mutant set:

- the verdict comes from jest's **summary line and exit code**, never a `--json` key (§18.5's
  thirteen meaningless zeros);
- the tree is restored from a snapshot and **byte-compared** after every mutant;
- a mutant whose search text matches ≠ 1 times is **NOT-APPLIED**, never "survived".

🔴 **And when two mutants both survive, try removing both** — s49's two zeros were one redundancy,
and only the combined mutant showed the row had teeth.

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
  `EXPORT-REPORT.md`.
- Harness: `cp -a` a prepared harness (s49 used `481a2793-…/scratchpad/harness`),
  `rm -rf src dist tsconfig.tsbuildinfo`, then emit into it. **Never overwrite its `package.json`.**
- `npm run build` runs `tsc -b && vite build`. **This is the step that finds what tests cannot** —
  s49 ran it on `puppy-test-3` with markers in the tree: clean, 57 modules, five markers.
- Serve with `npx vite preview --port 53xx --strictPort`; stop it by port
  (`lsof -ti :53xx -sTCP:LISTEN | xargs kill`). ⚠️ **`vite preview` binds `localhost`, and
  `curl 127.0.0.1` gets nothing.**
- Launch Chrome **separately** on a non-default debug port with a fresh `--user-data-dir`.
  🔴 **Do not pass `--disable-popup-blocking`** if a `window.open` is under test — the blocked
  arm is a control and that flag silently deletes it.
- 🔴 **Read `textContent` per element, never `body.innerText`**.
- 🔴 **Click with `Input.dispatchMouseEvent`**, never `element.click()` — a scripted click is not
  a user activation, and `window.open` is refused outside one.
- ⚠️ **A React controlled input needs the native value setter plus an `input` event.**
- 🔴 **Write the expected answers down before the app runs**, then **sabotage in separate arms**.
- ⚠️ **An error row is never cleared**, so a success row must run **before** any failure row, and
  a row that navigates away runs **last**.

## Instruments

s49 scratchpad `481a2793-…/scratchpad/`: `patch1–9.py` (the exact-count source patches),
`mut.py`/`mut2.py` (six mutants + the combined root mutant), `snap/src` (the pre-mutation
snapshot), `harness/` and `buildcheck/` (the built `puppy-test-3` export).
s48 `e6b5ff80-…/`; s47 `99fc4b87-…/`; s46 `cf0e64bb-…/openarm/`; s44 `7408cf11-…`;
s43 `2011a26f-…`; s40 `1a63a0f6-…`; s38 `e94a3353-…` (the original harness).

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a` / `grep -a`.
