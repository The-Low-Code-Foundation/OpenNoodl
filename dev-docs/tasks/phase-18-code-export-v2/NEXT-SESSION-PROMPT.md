# Next session — the report exists, and it is honest about being half of one

## Where the phase stands

**Tier 1 closed in session 38. s39–s47 built the Tier 2.5 nodes one at a time; s47 finished the
wired `Open In New Tab` (§18). s48 did the two things at the top of §18's list, and neither was a
node: the dead `Success` port in `httpnode.ts` (§8.5), and `EXPORT-REPORT.md` — EXP-004's first
half, the report two generated `TODO(export)` markers had pointed at by name since EXP-002.**

**69 of 127 (54.3%)** — unchanged, and the floor is ratcheted. Nothing on the picker moved,
deliberately.

🔴 **Read [§19.5](./EXP-011-PICKER-COVERAGE.md) before adding a sentence to anything an author
reads.** The report's own closing paragraph implied that every refusal it lists also leaves a
`TODO(export)` marker in the code. It does not — `puppy-test-3`'s emitted code carries **no**
marker at all while its report lists nine refusals — and a reader who greps, finds nothing and
reads that as an all-clear has been misled by the one file whose entire job is not to mislead them.

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

## What session 48 settled, so nobody re-opens it

**`EXPORT-REPORT.md` ships in every exported app**, built from `EmittedApp.report` — a structured
channel filled *beside* `notes` at the same push sites, never parsed back out of it. `notes` is
unchanged and all three dozen suites that assert on its wording still do.

**Grouping is by what the caller already knew.** Scope is a fact where `plan` is in hand.
`skipKind` (two assignments in `plan.ts`) is what tells the router shell — which the scaffold
*emits* — from a logic-only component, which nothing emits. They are one sentence each and would
otherwise have to be told apart by matching their words.

**The report carries no clock, no random id and no absolute path**, because the generators are
byte-stable and a date line would break every golden in the package.

**`usesBackend` is returned from `apiModules`, not re-derived.** "Were any api files emitted" and
"does this project ask anything of a backend" are two predicates, and `src/api/http.ts` is where
they part — see §19.3.

⚠️ **Do not add the word "verified" about generated code.** EXP-003 does not exist; nothing has
been run, replayed or compared. The test counts the uses of the word rather than asserting its
absence, because the page must carry one sentence denying it.

## Do this next — in the order they are worth doing

### 1. EXP-004's in-code markers — the half §19.5 measured and did not build

A deferred wire on an element that still renders leaves **nothing** in the file: the element sits
there looking right and doing nothing. This is where EXP-004's *"original node source preserved in
a comment"* belongs, and it is what would make the report's grep line more than a shortcut.
🔴 The report currently says so plainly; a marker pass must update that paragraph **and** the row
that pins it (`it does not present the in-code markers as the complete list`), which asserts the
absence and the wording together on purpose.

### 2. A chain-local for `Error` (§14.6, §17.6, §18.6) — owed by **two** nodes

`External Link` and `Navigate To Path` both refuse a read of `Error` from inside their own outcome
chains, on §8.2's closure rule. One chain-local closes both.

### 3. The collection-state slice — unblocks `Set Object Properties` and `Remove Object From Array`.

### 4. The date family's signals — an `effect()` slice, not a date slice (§9.6).

### 5. EXP-009 leftovers — drive the exported login/admin forms; delete the drive-residue user
`exp009-drive` from the local Puppy backend's `_User`.

## 🔴 Four things session 48 left honestly unfinished

**EXP-004's editor half is untouched, and it is the larger half.** The pre-flight estimate (before
exporting, so a user decides with accurate expectations) and the in-editor post-export report with
drill-down are both editor surfaces. Nothing here builds either. What is done is the copy that
travels with the code.

**A second copy of the HTTP node's `error` port has drifted, and is unowned.** `updatePorts`
republishes `error` with `group: 'Events'` while the node's static declaration says
`group: 'Error'`, and `replaceOrAppendPorts` makes the dynamic one win — so the editor files that
port under a group the node did not ask for. Measured, **not fixed**: moving a port between groups
in the property panel is a ruling, not a cleanup.

**The cycle refusal §18.3 measured is still unowned.** A `Navigate To Path` inside a `Now`'s Done
chain whose wired `Open In New Tab` reads that same `Now` is refused as *"its trigger chain is
cyclic"*, while the identical shape with a `Set Variable` translates. A fact about that node, not
about the graph, with the control written into `component.ts`'s `reads()` sweep.

**`exprValidIn` and `actionExprsOf` on `Navigate To Path`** — closed in shape, unproven in fact,
three sessions running. A firing case needs a payload read inside an `Event Receiver`, which needs
an `Event Sender` declaring the channel payload. If you build one, check both.

## 🔴 What session 48 would tell you if it could only say four things

1. **Two predicates can wear one name, and the wrong one re-derives quietly beside the right one.**
   `apiModules` had already computed "does this project use a backend"; the report asked "are there
   api files" and printed the first question's sentence. It rendered, it was grammatical, and on
   five of seven fixtures it was even right — so it *fit*, and fitting is not excluding. **Ask what
   this number would be if the defect were present**, and prefer returning a predicate its owner
   already computed over deriving a near-miss.
2. 🔴 **A checker's population grows silently, and the second growth looks like the first.** One
   Markdown file reddened a backtick sweep that already carried `README.md` as a *named* exemption
   — so the population had grown once before and been patched by name. Exclude **by kind** and the
   next one cannot reopen it. The other red was a blast-radius assertion that the report joins
   legitimately: *a new refusal leaving the report unchanged would be the defect.*
3. 🔴 **Prose that overstates is still prose, and no suite catches it.** §19.5 was found by
   grepping the emitted output for the string the report tells the reader to grep for. When you
   write a sentence an author will act on, **run the action and see what they get.** The row that
   pins it asserts the absence *and* the wording, because either alone goes stale.
4. **A mutant that kills nothing is a finding about the tests until a control says otherwise —
   and "which of the two" is worth writing down.** Two survived. One was a real hole (kit load
   failures could vanish from the report while all 910 tests passed, because `renderReport` was
   only ever driven on synthetic module data). One was weak — a renamed heading, with every
   asserted sentence still on the page — and is recorded as weak.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files. ⚠️ A *new* test
file is untracked, and `git commit <pathspec>` **errors** rather than skipping it — `git add` it
and commit in the same command so the staging window stays closed.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 911/911, 39 suites (881/38 before §19)
cd ../nodegx-module-inject && ../../node_modules/.bin/jest --config jest.config.js   # 31/31
cd ../noodl-runtime && ../../node_modules/.bin/jest   # 2564 passed, 13 skipped, 144 suites
npm run export-ledger:picker                  # from the repo root — holds at 69/127
npm run export-ledger:check                   # 175 types
```

⚠️ **`test:ci` was not run by this session**, and the `httpnode.ts` change is the only reason it
would matter. A *relayed* measurement, recorded as one: a peer (P77 s19) ran `test:ci` with that
change already in the tree and reported **2889 specs, 4 failures, all four AIX-006 style-vocabulary
by name, seed 07472** — which is the recorded floor. That is evidence, not a gate this session
passed; re-run it yourself if you touch `noodl-runtime` again.

⚠️ `ts-node` needs an **absolute** path and `--compiler-options '{"module":"commonjs"}'`, run from
`packages/nodegx-export` — and it takes **well over two minutes** to start, so run it with
`run_in_background: true` rather than watching a foreground call get killed at 120 s.
Copy a harness with **`cp -a`** so the `@nodegx/core` symlink survives.
⚠️ **`${PIPESTATUS[0]}` is empty in zsh** — run gates **without a pipe** and read `$?`.
⚠️ **A foreground `sleep` is blocked.** To wait, use `run_in_background: true` with an
`until <check>; do sleep 5; done` loop.
🔴 **`nohup … &` inside a Bash call returns exit 0 immediately with an empty log** — that is the
launcher exiting, not the job. Confirm with `ps -Ao pid,ppid,etime,command` before reading.

## Mutation testing, which is now a two-file habit

`mut.py` in the s48 scratchpad is the runner and is worth copying rather than rewriting. It obeys
three rules, each of which is a session that was lost to breaking it:

- the verdict comes from jest's **summary line and exit code**, never a `--json` key (§18.5's
  thirteen meaningless zeros);
- the tree is restored from a snapshot and **byte-compared** after every mutant;
- a mutant whose search text matches ≠ 1 times is **NOT-APPLIED**, never "survived".

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

- **`scripts/emit-app.ts` is now the honest runner** — it writes `files` **and `copies`** (§19.6);
  it used to drop every `noodl_modules` asset silently. It also writes `EXPORT-REPORT.md`.
- Harness: `cp -a` the prepared `corpus-harness/` (or a previous session's `app/`),
  `rm -rf src dist tsconfig.tsbuildinfo`, then emit into it. **Never overwrite its `package.json`.**
- `npm run build` runs `tsc -b && vite build`. **This is the step that finds what tests cannot.**
- Serve with `npx vite preview --port 53xx --strictPort`; stop it by port
  (`lsof -ti :53xx -sTCP:LISTEN | xargs kill`). ⚠️ **`vite preview` binds `localhost`, and
  `curl 127.0.0.1` gets nothing.**
- Launch Chrome **separately** on a non-default debug port with a fresh `--user-data-dir`.
  🔴 **Do not pass `--disable-popup-blocking`** if a `window.open` is under test — the blocked
  arm is a control and that flag silently deletes it.
- 🔴 **Read `textContent` per element, never `body.innerText`** — anchor the read to the node
  under test.
- 🔴 **Click with `Input.dispatchMouseEvent`**, never `element.click()` — a scripted click is not
  a user activation, and `window.open` is refused outside one. That difference is a *row*.
- ⚠️ **A React controlled input needs the native value setter plus an `input` event.**
- 🔴 **Write the expected answers down before the app runs**, then **sabotage in separate arms** —
  one rule per arm, and **predict the rows that must NOT move as well as the ones that must**.
- ⚠️ **An error row is never cleared**, so a success row must run **before** any failure row, and
  a row that navigates away runs **last**.

## Instruments

s48 scratchpad `e6b5ff80-…/`: `mut.py` (the mutation runner) + `mut.log`/`mut2.log` (twelve
mutants, the two survivors re-run after closing), `snap/` (the pre-mutation snapshots).
s47 `99fc4b87-…/`; s46 `cf0e64bb-…/openarm/`; s44 `7408cf11-…`; s43 `2011a26f-…`;
s40 `1a63a0f6-…`; s38 `e94a3353-…` (the original harness).

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a` / `grep -a`.
