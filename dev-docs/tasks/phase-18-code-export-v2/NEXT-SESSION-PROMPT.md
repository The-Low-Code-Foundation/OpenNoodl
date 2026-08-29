# Next session — Tier 2.5 is down to the component stack pair, and they are not a url builder

## Where the phase stands

**Tier 1 closed in session 38. Session 39 closed §8.7. Session 40 built `Page Inputs`. Session 41
built `External Link` and found [DEF-016](../phase-80-the-defects-the-templates-found/DEF-016-EXTERNAL-LINK-ALWAYS-REPORTS-FAILURE.md).
Session 42 closed the store-key gate (§13). Session 43 built `External Link`'s `Error` (§14).
Session 44 built `Navigate To Path` (§15) — and the "first question" three prompts had been
carrying turned out to be answerable by reading, while four rules everyone expected to transfer
from `RouterNavigate` did not.**

**69 of 127 (54.3%)** — the floor is ratcheted. Read [EXP-011 §15](./EXP-011-PICKER-COVERAGE.md)
before touching navigation, and [§11.1](./EXP-011-PICKER-COVERAGE.md) before trusting any ledger row.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The number

```
npm run export-ledger:picker      # ratcheted in PR CI — holds at 69/127 (54.3%)
npm run export-ledger:check       # also enforces the SHAPE of a deferral (EXP-011 AC4)
```

🔴 The corpus audit is a regression net, never a priority oracle.
🔴 Custom node types are **deliberately** outside the picker number — `$customNodesComment` in
`packages/nodegx-export/coverage-ledger.json` says why. Do not "fix" it by adding them.

## Do this next

### A. 🔴 Read §15.1 before you plan the component stack pair

Session 44's headline is not the node. It is that **a question three ledger rows, two session
prompts and §11.8 all repeated was answerable in twenty minutes of reading the runtime**, and the
answer was that it could not reach the export at all. `navigationPathType` chooses *where* the
same path string is written; `_getLocationPath` returns the same bare path in both modes and
`_getSearchParams` reads `location.search` in both.

**The pair below carries an inherited sentence of exactly that kind** — §11.8's *"a component
stack also feeds `Page Inputs` at runtime and the export does not route one at all"*. Go and read
`navigation-stack.tsx` and `_setPageParams`'s two callers **before** planning anything against it.
It may be smaller than it sounds, or much larger; nobody in this tier has measured it.

### B. The component stack pair — `PageStackNavigate`, `PageStackNavigateBack`

⚠️ These two are **not** url builders, which is what makes them different from every Navigation
node built so far. A component stack is a runtime stack of mounted components with its own
history; the export has no such construct and its `BrowserRouter` is the only navigation state
there is. **The first question is whether a stack maps onto routes at all**, and if it does not,
the honest slice may be a named deferral with a design note rather than a translation.

### C. 🔴 Before adding any new `HandlerAction` kind, read §11.6 and §15.5

A new kind must be carried **by hand** to six places, and `tsc` finds only two of them:

| consumer | caught by tsc? |
|---|---|
| `actionCode` (`component.ts`) | ✅ explicit return type |
| `actionExprsOf` (`component.ts`) | ✅ explicit return type |
| `deepActions` (`component.ts:416`) | ❌ |
| `usesNavigate` (`component.ts:577`) | ❌ |
| `inAction` (`component.ts`, has `default: false`) | ❌ |
| `isStatement` (`component.ts:~1770`) | ❌ |
| `actionsValidIn` (`plan.ts`, `every` swallows `unknown`) | ❌ |
| the attached-scan (`plan.ts:~7320`) | ❌ |

## Then, in the order they are worth doing

1. **`Navigate To Path`'s `Open In New Tab`** (§15.6) — the `window.open` arm, wanting DEF-016's
   activation read and a blocked-tab `Error` row. `External Link` is the worked example.
2. **`updatePorts` in `httpnode.ts` still publishes `success`** — [§8.5](./EXP-011-PICKER-COVERAGE.md).
   The node fires `done`; the editor draws **both**. One line to delete. ⚠️ Deleting a port an
   existing project may have wired is a migration question, not only a fix.
3. **EXP-004** — the honesty UX (a report file into the output). Every `TODO(export)` marker ends
   with "See the export report", and there is no report. §10–§15's refusals all join them.
4. **A chain-local for `External Link`'s `Error`** (§14.4).
5. **The collection-state slice** — unblocks `Set Object Properties` and `Remove Object From Array`.
6. **The date family's signals** — an `effect()` slice, not a date slice (§9.6).
7. **EXP-009 leftovers**: drive the exported login/admin forms; delete the drive-residue user
   `exp009-drive` from the local Puppy backend's `_User`.

## 🔴 What session 44 would tell you if it could only say five things

1. **The question everyone kept repeating was cheaper to answer than to carry.** Three ledger
   rows quoted the `navigationPathType` sentence verbatim, and none of them had read
   `_getLocationPath`. Reading both branches took twenty minutes and deleted the question. A
   sentence that has been relayed three times without being re-derived is a **candidate**, not a
   constraint — and its cost is that it shapes every plan made around it.
2. **"The reasoning transfers" was true about the ports and false about the function.** The two
   navigation nodes share a `p-`/`q-` port shape and disagree in four places about the url. The
   sharpest: an unset placeholder is *deferred* one node over precisely because that runtime
   function is incoherent about it, and it **translates** here because this one is not. Copying
   the rule across would have deferred a case the runtime is perfectly clear about — and the
   encoding one would have been invisible, because emitting `encodeURIComponent` looks obviously
   correct and no test would have complained.
3. 🔴 **A metric that counted the wrong thing passed a mutant it was written to kill.** The row
   asserting an omittable query value is read exactly once counted **lines** containing the
   source. The mutant put the guard and the push on **one line**, each naming it — the exact
   double read — and the count was still 1. Ask of every count: *what would this number be if the
   defect were present?*
4. 🔴 **A mutant that kills nothing is the finding.** Stopping `deepActions` at the new kind moved
   no row, because both navigation kinds set the same flag and the outer action is in the list
   regardless — a navigation nested in a navigation could never observe the walk. A **state row**
   could. The real row is an `HTTP Request` in the Done chain, whose `errorState` binding the
   declaration filter drops without the walk.
5. **Writing the sabotage prediction down is what exposed a worthless drive row.** Arm A's
   predicted answer came out as "nothing moves" — because the row meant to detect relative-vs-
   absolute clicked from `/`, where the two resolve identically. Fixed by putting the button on a
   **non-root page**; arm A then moved exactly that one row. ⚠️ Arm B's prediction was also
   wrong in its detail — `tone=` versus the real `tone=undefined` — and that difference is
   §11.6's "looks like data" failure arriving on the query side.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files silently.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 835/835 — clean (797 before §15 added 38)
cd ../nodegx-module-inject && ../../node_modules/.bin/jest --config jest.config.js   # 31/31
npm run export-ledger:picker                  # from the repo root — holds at 69/127
```

⚠️ `ts-node` needs an **absolute** path and `--compiler-options '{"module":"commonjs"}'`, run from
`packages/nodegx-export`. Copy the harness with **`cp -a`** so the `@nodegx/core` symlink survives.
⚠️ **`${PIPESTATUS[0]}` is empty in zsh** — run the build without a pipe and read `$?`.

## Authoring a project without an MCP server bound to it (unchanged, and it works)

1. Drive a **second server over stdio from a script**: `mcp-client.mjs`, ~50 lines over `spawn` +
   newline-delimited JSON-RPC, running the server from **`src` via ts-node**, never `dist/`.
   ⚠️ Its calls file is a list of `{ "name", "arguments" }` — not `{ "tool", "args" }`.
2. `update_component` takes `{ path, set: { nodes, connections, visualRoots } }` — a whole
   component in one call. ⚠️ `nodes` is a **flat list**; `children` holds **id strings**.
3. ⚠️ `p-`/`q-` parameters report `dynamic-port-skipped` at **info** severity and the write lands.
   That is "unverified", not "verified correct" — the emitted code is the check.
4. ⚠️ **Create a page before any page that navigates to it**, and **writing a page can steal
   `startPage`** — check `components/App/nodes.json` afterwards.

## Building and driving an exported app

- Harness: `cp -a` the prepared `corpus-harness/`, `rm -rf src dist public tsconfig.tsbuildinfo`,
  then emit into it. **Never overwrite its `package.json`.**
- `npm run build` runs `tsc -b && vite build`. **This is the step that finds what tests cannot.**
- Serve with `npx vite preview --port 52xx --strictPort`; stop it by port
  (`lsof -ti :52xx -sTCP:LISTEN | xargs kill`). ⚠️ **`vite preview` binds `localhost`, and
  `curl 127.0.0.1` gets nothing.**
- Launch Chrome **separately** on a non-default debug port with a fresh `--user-data-dir`.
- 🔴 **Read `textContent` per element, never `body.innerText`.**
- 🔴 **Click with `Input.dispatchMouseEvent`**, never `element.click()`.
- 🔴 **Write the expected answers down before the app runs**, then **sabotage in separate arms** —
  one rule per arm. 🔴 **And check each arm's prediction says something can MOVE**: a row whose
  two arms agree by construction is not a row, and §15.5's D9 was one until it was rebuilt.

## Instruments

s44 scratchpad `7408cf11-…`: `EXPECTED-s44.md` (written before the build), `note-desk/` (now with
six Navigate To Path buttons on Home and a jump button on Note), `calls-s44*.json`,
`drive-nav.mjs`, `app/` (built, 9/9), `mutate.sh` + `m1..m12.py` (the twelve mutants),
`sab.sh` + `sabA.py`/`sabB.py`, `snap/` (pre-mutation copies, restored by `cp -a` and md5-verified,
never `git checkout --`).
s43 `2011a26f-…`: `probe/` (the activation control pair), `harness/`, `drive-error.mjs`.
s40 `1a63a0f6-…`: `mcp-client.mjs`, `emit-to-app.ts`. s38 `e94a3353-…`: the original `corpus-harness/`.

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a`.
