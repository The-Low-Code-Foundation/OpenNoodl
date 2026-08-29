# Next session — the arm is closed, and a correction that outlived its own session

## Where the phase stands

**Tier 1 closed in session 38. s39 closed §8.7. s40 built `Page Inputs`. s41 built `External Link`
and found [DEF-016](../phase-80-the-defects-the-templates-found/DEF-016-EXTERNAL-LINK-ALWAYS-REPORTS-FAILURE.md).
s42 closed the store-key gate (§13). s43 built `External Link`'s `Error` (§14). s44 built
`Navigate To Path` (§15). s45 re-tiered the component stack pair (§16). s46 built
`Open In New Tab` (§17). s47 built the **wired** `Open In New Tab` (§18) — the last thing §17
left at the top of the list.**

**69 of 127 (54.3%)** — unchanged, and the floor is ratcheted. §18 is the third increment on a
node the ledger already counts. `Open In New Tab` now translates in **all three** of its states:
off, on, and wired.

🔴 **Read [§18.1](./EXP-011-PICKER-COVERAGE.md) before trusting that any correction in this
document is finished.** The sentence §17.1 exists to kill was still in `compileNavigateToPath`'s
own header comment, twenty lines above the block refuting it, one session later. §17 corrected
everything that *returned* the wrong answer and nothing that merely *said* it.

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

## What session 47 settled, so nobody re-opens it

**A wired `Open In New Tab` emits both of the node's actions under one runtime branch**, which is
`navigate-to-path.ts:204` line for line with the outcomes hoisted out from under it. One success
flag (`let … = true`, and that initialiser **is** the same-tab arm's outcome), one url build above
the branch, one `Done`/`Failure` branch beneath the arms, one `Completed` after it.

**`newTab` in the IR means "the new-tab arm is reachable", not "the port is on".** Making it mean
the other thing costs 14 test rows — the largest mutant in the file. Every consumer already asked
it the first question.

**The port is a truthiness sink**, so a logic truth value lands there where a `p-`/`q-` value
still defers. The runtime coerces it once with `!!` and the emitted read is the `if` test itself.

⚠️ **Do not plan against "a wired Open In New Tab defers".** It does not, in any state.

## Do this next — in the order they are worth doing

### 1. `updatePorts` in `httpnode.ts` still publishes `success` — [§8.5](./EXP-011-PICKER-COVERAGE.md)

The node fires `done`; the editor draws **both**. One line to delete. ⚠️ Deleting a port an
existing project may have wired is a migration question, not only a fix.

### 2. EXP-004 — the honesty UX (a report file into the output)

Every `TODO(export)` marker ends with "See the export report", and there is no report. §10–§18's
refusals all join them. 🔴 §16.5's requirement still stands: the report should carry the deferral
*reasons*, and those reasons are prose only a test can verify — see the gate hole below.

### 3. A chain-local for `Error` (§14.6, §17.6, §18.6) — owed by **two** nodes

`External Link` and `Navigate To Path` both refuse a read of `Error` from inside their own outcome
chains, on §8.2's closure rule. One chain-local closes both.

### 4. The collection-state slice — unblocks `Set Object Properties` and `Remove Object From Array`.

### 5. The date family's signals — an `effect()` slice, not a date slice (§9.6).

### 6. EXP-009 leftovers — drive the exported login/admin forms; delete the drive-residue user
`exp009-drive` from the local Puppy backend's `_User`.

## 🔴 Three things session 47 left honestly unfinished

**The cycle refusal §18.3 measured is unowned and is a real asymmetry.** A `Navigate To Path`
inside a `Now`'s Done chain, whose wired `Open In New Tab` reads that same `Now`, is refused as
**"its trigger chain is cyclic"** — while the *identical* shape with a `Set Variable` in place of
this node translates and emits `const clockRead = new Date();`. So the refusal is about this node,
not about the graph. The control is written into the code comment at `component.ts`'s `reads()`
sweep, beside the line it defends.

**`exprValidIn` and `actionExprsOf` on this action are closed in shape and unproven in fact**, for
the reason §17.3 gave: a firing case needs a payload read inside this action inside an
`Event Receiver`, which needs an `Event Sender` declaring the channel payload. Two sessions have
now recorded this rather than claiming it. If you build one, check both.

**§16.5's gate hole is still open, and §18.1 is a third instance of a different shape.**
`scripts/export-ledger/check.js` enforces that a deferral names its kind and tier. It cannot check
that the reason is *true*, and it cannot check that a reason which stopped being true was removed
from everywhere it was written. Whether either becomes a rule is unowned.

## 🔴 What session 47 would tell you if it could only say four things

1. **A correction has to be grepped for by its claim, not by the code that returned it.** §17
   fixed the deferral string, the ledger note and added three tests — and left the prose that had
   taught the false sentence sitting in the same function. One
   `grep -rna "transient user activation"` found it in seconds; the grep was never run, because
   the fix felt complete when the behaviour was right. ⚠️ **A stale list is also a claim** — the
   header said "Four refusals" and there were three.
2. 🔴 **A mutant killing nothing is a finding about the tests until you have shown otherwise —
   and the way to show otherwise is a control.** Three survived here. One was a genuine hole and
   was closed (an unconsumed wire emits a *false note* and nothing looked at notes for a
   translated wire). One had a firing case that this exporter refuses — and only the sibling
   control (`Set Variable` in the same shape, which translates) turned "cyclic, so unprovable"
   into "cyclic **about this node**, which is a defect somebody owns".
3. 🔴 **Check the harness before believing thirteen zeros.** The first mutation pass reported
   `killed=None` for every mutant, because the runner looked for a jest `--json` key that is not
   first in the object. A parse failure and a surviving mutant are the same number on the way out.
   **A run that agrees with your worst fear is the one to instrument.** The tree was verified by
   `diff` against a snapshot after every pass, never by the log or the exit code.
4. **The pair that proves a wired port is two rows that differ only in the wire's value.** D2
   (box has text ⇒ a tab opens) and D4 (box empty ⇒ the page navigates) are the same button and
   the same node doing two different things. A suite that only ever measured the new-tab arm
   passes on an emitter that ignores the wire entirely.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files. ⚠️ A *new* test
file is untracked, and `git commit <pathspec>` **errors** rather than skipping it — `git add` it
and commit in the same command so the staging window stays closed.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 881/881, 38 suites (864 before §18 added 17)
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

- Harness: `cp -a` the prepared `corpus-harness/` (or a previous session's `app/`),
  `rm -rf src dist tsconfig.tsbuildinfo`, then emit into it. **Never overwrite its `package.json`.**
- `npm run build` runs `tsc -b && vite build`. **This is the step that finds what tests cannot.**
- Serve with `npx vite preview --port 53xx --strictPort`; stop it by port
  (`lsof -ti :53xx -sTCP:LISTEN | xargs kill`). ⚠️ **`vite preview` binds `localhost`, and
  `curl 127.0.0.1` gets nothing.**
- Launch Chrome **separately** on a non-default debug port with a fresh `--user-data-dir`.
  🔴 **Do not pass `--disable-popup-blocking`** if a `window.open` is under test — the blocked
  arm is a control and that flag silently deletes it.
- 🔴 **Read `textContent` per element, never `body.innerText`** — and anchor the read to the node
  under test (§18 read the button's own `nextElementSibling`, because there are now three error
  paragraphs on that page and two belong to other nodes).
- 🔴 **Click with `Input.dispatchMouseEvent`**, never `element.click()` — a scripted click is not
  a user activation, and `window.open` is refused outside one. That difference is a *row*.
- ⚠️ **A React controlled input needs the native value setter plus an `input` event** — assigning
  `.value` alone changes the DOM and not the state the handler reads.
- 🔴 **Write the expected answers down before the app runs**, then **sabotage in separate arms** —
  one rule per arm, and **predict the rows that must NOT move as well as the ones that must**.
- ⚠️ **An error row is never cleared**, so a success row must run **before** any failure row, and
  a row that navigates away runs **last**.

## Instruments

s47 scratchpad `99fc4b87-…/`: `wirearm/` (a `cp -a` of s46's harness) with `EXPECTED-s47.md`,
`calls-s47.json`, `drive-s47.mjs`, `note-desk/`, `app/`, `mcp-client.mjs`, `emit-to-app.ts`;
`mut/run2.py` + `run3.py` (the mutation runner, with `plan.pre.ts`/`component.pre.ts` snapshots);
`probe.ts` and `probe2.ts` (the emitted-shape and cycle-control probes); `snap/` (the pre-session
snapshots). s46 `cf0e64bb-…/openarm/`; s44 `7408cf11-…`; s43 `2011a26f-…`; s40 `1a63a0f6-…`;
s38 `e94a3353-…` (the original harness).

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a` / `grep -a`.
