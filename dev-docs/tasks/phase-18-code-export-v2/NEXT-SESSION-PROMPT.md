# Next session — the arm is open, and what it left is a branch and two unproven walkers

## Where the phase stands

**Tier 1 closed in session 38. s39 closed §8.7. s40 built `Page Inputs`. s41 built `External Link`
and found [DEF-016](../phase-80-the-defects-the-templates-found/DEF-016-EXTERNAL-LINK-ALWAYS-REPORTS-FAILURE.md).
s42 closed the store-key gate (§13). s43 built `External Link`'s `Error` (§14). s44 built
`Navigate To Path` (§15). s45 re-tiered the component stack pair behind the container it drives
(§16). s46 built `Open In New Tab` (§17) — and found the sentence §15.4 gave as the reason to
defer it was false, inherited from `External Link`.**

**69 of 127 (54.3%)** — unchanged, and the floor is ratcheted. §17 is an increment on a node the
ledger already counts.

🔴 **Read [§17.1](./EXP-011-PICKER-COVERAGE.md) before trusting any sentence that explains one
node by naming another.** It is the second instance in two sessions ([§16.1](./EXP-011-PICKER-COVERAGE.md)
was the first), and this time the false sentence was the *plan for the work* rather than a note
about work already done.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The number

```
npm run export-ledger:picker      # ratcheted in PR CI — holds at 69/127 (54.3%)
npm run export-ledger:check       # 175 types: 83 deferred, 76 translated, 1 stubbed, 15 backend-only
```

🔴 The corpus audit is a regression net, never a priority oracle.
🔴 Custom node types are **deliberately** outside the picker number — `$customNodesComment` in
`packages/nodegx-export/coverage-ledger.json` says why. Do not "fix" it by adding them.

## What session 46 settled, so nobody re-opens it

**`Navigate To Path`'s new-tab arm reads `window.open`'s return value, and that is correct.** The
node passes **no features string** (`navigate-to-path.ts:205`). `External Link` reads
`navigator.userActivation` only because it passes `noopener`, which makes `window.open` return
null on success as much as on failure — that is DEF-016 and the runtime says so at
`externallink.ts:69`. Measured in Chrome 151, three arms under real gestures; the sabotage arm
that adds `noopener` to the emitted call puts "The browser blocked opening a new tab" **beside a
tab that opened**. Three tests in §15.6's drift-alarm block pin both runtime files against each
other, so this cannot quietly become folklore again.

⚠️ **Do not plan against "Open In New Tab needs the activation read".** It never did.

## Do this next — in the order they are worth doing

### 1. A wired `Open In New Tab` (§17.4) — the top of the list

Now deferred on a reason about **this slice**, not about the node: the runtime reads that port
exactly once, as `!!value`, so the value is answerable. What a wire costs is that both actions
become reachable in one handler — `pushState` and `window.open` under a runtime branch, with two
different outcome sets beneath them (in tab nothing can fail; in a new tab `Failure`, `Error` and
a `Completed` join are all live). §17.2's table is the shape; the branch is the work.

### 2. `updatePorts` in `httpnode.ts` still publishes `success` — [§8.5](./EXP-011-PICKER-COVERAGE.md)

The node fires `done`; the editor draws **both**. One line to delete. ⚠️ Deleting a port an
existing project may have wired is a migration question, not only a fix.

### 3. EXP-004 — the honesty UX (a report file into the output)

Every `TODO(export)` marker ends with "See the export report", and there is no report. §10–§17's
refusals all join them. 🔴 §16.5's requirement still stands: the report should carry the deferral
*reasons*, and those reasons are prose that only a test can verify — see the gate hole below.

### 4. A chain-local for `Error` (§14.4, §17.6) — now owed by **two** nodes

`External Link` and `Navigate To Path` both refuse a read of `Error` from inside their own
outcome chains, on §8.2's closure rule. One chain-local closes both.

### 5. The collection-state slice — unblocks `Set Object Properties` and `Remove Object From Array`.

### 6. The date family's signals — an `effect()` slice, not a date slice (§9.6).

### 7. EXP-009 leftovers — drive the exported login/admin forms; delete the drive-residue user
`exp009-drive` from the local Puppy backend's `_User`.

## 🔴 Two things session 46 left honestly unfinished

**`actionExprsOf`'s chain walk is closed in shape and unproven in fact (§17.3).** Every sibling
kind flatMaps its chains because `usesPayload` reads that list and nothing else flattens for it;
`navigate-path` did not, and now does. A **firing** case needs a payload read inside this action's
chain inside an `Event Receiver` — which needs an `Event Sender` declaring the channel payload, or
the receiver's port never resolves. This session could not build one. If you do, check it.

**The gate hole §16.5 found is still open.** `scripts/export-ledger/check.js` enforces that a
deferral names its kind and tier. It cannot check that the *reason* is true — and §17 is the
second slice to find a reason that was not. Three tests now pin §17's runtime claims
(`tests/navigate-to-path.test.ts`, the §15.6 block, each with `externallink.ts` as a control that
must disagree). Whether "an exemption citing a runtime file must have a test naming it" becomes a
**rule** is unowned and now has two instances behind it.

## 🔴 Adding a chain to an existing action kind is as dangerous as adding a kind

§11.6's table is about a new `HandlerAction` **kind** carried by hand to six places. §17 added a
**chain to an existing kind**, where nothing changes shape and so nothing complains at all.
Walking every consumer rather than the ones the slice touched found three already blind:

| walker | file | state before §17 |
|---|---|---|
| `collectActionUse` | `emit/component.ts` | 🔴 **no case — a live defect since §15** |
| `fillMaterialize` | `analyze/plan.ts` | no case; the switch has no `default`, so chains were never descended into |
| `actionExprsOf` | `emit/component.ts` | chains not walked, unlike every sibling |

**Grep every consumer of the action kind before adding a chain to it, and read what each one
decides.** `tsc` finds none of these.

## 🔴 What session 46 would tell you if it could only say four things

1. **A sentence that explains one node by naming another is a claim about two nodes, and the
   second one is usually unchecked.** §15.4's deferral was accurate about `External Link` in every
   clause and false about the node it was written on. It survived a session, three ledger rows and
   two session prompts, and it was the *plan* for this session's work. §16.1 is the same lesson one
   session earlier from a different cause — a grep hitting a comment. **Re-derive an inherited
   claim against its own subject before building on it.**
2. 🔴 **The control that matters is the one that reproduces the mechanism you are dismissing.**
   The arm that measured `noopener` returning null *in this host* is what turned "that does not
   apply here" from an assumption into a measurement. Without it, the bare call returning a Window
   is equally consistent with "this browser never returns null" and the false sentence survives.
   And the negative control — the same call with **no gesture** — is what proves a *blocked* test
   can detect blocking rather than only success.
3. 🔴 **A mutant that kills nothing is a finding about the tests, twice over.** `deepActions`
   blind to the new chain moved no row, because the sweeps walking it ask questions the outer
   action already answers — a **state row** in the chain is what tells the difference.
   `navigatePathIsStatement` moved no row because every fixture fires the node from a button that
   *already has another action*, and two actions take the block form regardless. **§15's
   `date-now-read` note says that same sentence about that same fixture** — the second time the
   habit hid the same class of bug.
4. **Check the tree after any harness that edits source.** The first mutation run hit the
   120-second tool timeout and was killed mid-mutation, leaving `plan.ts` mutated with `tsc`
   green — a mutant compiles, that is the point of it. Re-running with `nohup … &` then reported
   *completed* for the wrapper while Python was still working, and the empty log read exactly like
   a finished run. **`diff` against a snapshot, not the exit code and not the log.**

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files. ⚠️ A *new* test
file is untracked, and `git commit <pathspec>` **errors** rather than skipping it — `git add` it
and commit in the same command so the staging window stays closed.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 864/864, 38 suites (845 before §17 added 19)
cd ../nodegx-module-inject && ../../node_modules/.bin/jest --config jest.config.js   # 31/31
npm run export-ledger:picker                  # from the repo root — holds at 69/127
npm run export-ledger:check                   # 175 types: 83 deferred, 76 translated, 1 stubbed, 15 backend-only
```

⚠️ `ts-node` needs an **absolute** path and `--compiler-options '{"module":"commonjs"}'`, run from
`packages/nodegx-export`. Copy the harness with **`cp -a`** so the `@nodegx/core` symlink survives.
⚠️ **`${PIPESTATUS[0]}` is empty in zsh** — run gates **without a pipe** and read `$?`.
⚠️ **A foreground `sleep` is blocked by this harness.** To wait, use `run_in_background: true`
with an `until <check>; do sleep 5; done` loop — that is also how to wait out a long mutation run
without the 120-second timeout killing it mid-edit.

## Authoring a project without an MCP server bound to it (unchanged, and it works)

⚠️ **The session's own `nodegx` MCP server binds ONCE.** It was already bound to s40's `note-desk`
copy, and `open_project` on a different directory reports `bound: false` and changes nothing. Use
the stdio client instead — that is what it is for.

1. Drive a **second server over stdio from a script**: `mcp-client.mjs`, ~50 lines over `spawn` +
   newline-delimited JSON-RPC, running the server from **`src` via ts-node**, never `dist/`.
   ⚠️ Its calls file is a list of `{ "name", "arguments" }` — not `{ "tool", "args" }`.
2. `update_component` takes `operations` (`add_node` / `add_connection` / …) as well as `set` —
   for **appending** to an existing page, `operations` is the one to use and it is idempotent
   enough that a second run does not duplicate nodes.
3. ⚠️ `p-`/`q-` parameters report `dynamic-port-skipped` at **info** severity and the write lands.
   That is "unverified", not "verified correct" — the emitted code is the check.
4. ⚠️ **Create a page before any page that navigates to it**, and **writing a page can steal
   `startPage`** — check `components/App/nodes.json` afterwards.
5. ⚠️ An `HTTP Request` fixture needs **`url`**, not `resource` — with the wrong name every wire
   into it drops with *"it has no URL, so every Fetch answers Failure"* and the node vanishes
   from the emitted file, which reads exactly like the translation refusing.

## Building and driving an exported app

- Harness: `cp -a` the prepared `corpus-harness/`, `rm -rf src dist public tsconfig.tsbuildinfo`,
  then emit into it. **Never overwrite its `package.json`.**
- `npm run build` runs `tsc -b && vite build`. **This is the step that finds what tests cannot.**
- Serve with `npx vite preview --port 52xx --strictPort`; stop it by port
  (`lsof -ti :52xx -sTCP:LISTEN | xargs kill`). ⚠️ **`vite preview` binds `localhost`, and
  `curl 127.0.0.1` gets nothing.**
- Launch Chrome **separately** on a non-default debug port with a fresh `--user-data-dir`.
  🔴 **Do not pass `--disable-popup-blocking`** if a `window.open` is under test — the blocked
  arm is a control and that flag silently deletes it.
- 🔴 **Read `textContent` per element, never `body.innerText`.**
- 🔴 **Click with `Input.dispatchMouseEvent`**, never `element.click()` — a scripted click is not
  a user activation, and `window.open` is refused outside one. That difference is a *row* when
  the node under test opens a tab: gesture and no-gesture are the two arms.
- 🔴 **Write the expected answers down before the app runs**, then **sabotage in separate arms** —
  one rule per arm. 🔴 **And check each arm's prediction says something can MOVE.**
- ⚠️ **An error row is never cleared**, so a success row must run **before** any failure row.

## Instruments

s46 scratchpad `cf0e64bb-…/openarm/`: `EXPECTED.md` (the three-arm window.open control),
`EXPECTED-drive.md`, `index.html` + `target.html` + `drive.mjs` (the CDP harness), `mut/run.py`
and `mut/run2.py` (the mutation runner, with `plan.orig.ts`/`component.orig.ts` snapshots),
`note-desk/`, `app/`, `calls-s46.json`, `mcp-client.mjs`, `emit-to-app.ts`.
s44 `7408cf11-…`; s43 `2011a26f-…`; s40 `1a63a0f6-…`; s38 `e94a3353-…` (the original harness).

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a`.
