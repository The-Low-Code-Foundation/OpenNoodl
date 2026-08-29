# Next session — Tier 2.5's node list is closed, and what is left of it are increments

## Where the phase stands

**Tier 1 closed in session 38. Session 39 closed §8.7. Session 40 built `Page Inputs`. Session 41
built `External Link` and found [DEF-016](../phase-80-the-defects-the-templates-found/DEF-016-EXTERNAL-LINK-ALWAYS-REPORTS-FAILURE.md).
Session 42 closed the store-key gate (§13). Session 43 built `External Link`'s `Error` (§14).
Session 44 built `Navigate To Path` (§15). Session 45 translated nothing on purpose: it read the
component stack pair, found the sentence five sessions had planned around was false in both
halves, and re-tiered the pair behind the container it drives (§16).**

**69 of 127 (54.3%)** — unchanged, and the floor is ratcheted.

🔴 **Read [§16.1](./EXP-011-PICKER-COVERAGE.md) before you trust any exemption sentence**, and
[§11.1](./EXP-011-PICKER-COVERAGE.md) before trusting any ledger row.

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

## What session 45 settled, so nobody re-opens it

**The component stack pair is answered and is not available to build.** `PageStackNavigate` and
`PageStackNavigateBack` are now **Tier 3**, behind the `Page Stack` they drive, which is Tier 3
item 10 and deferred. A pusher with no stack has nothing to push onto, and `PageStack` appears
nowhere in `packages/nodegx-export/src`. §16.2 has the mechanism table if it is ever picked up —
the decisive fact is that **a push is a call and a pop is its return**, carrying named values
(`backResult-*`) and a named outcome (`backAction-*`) back to the pusher, which a url cannot
express. `tests/component-stack-pair.test.ts` fails the day `Page Stack` is translated, which is
the moment to reconsider — you do not need to remember this.

⚠️ **Do not plan against "the pair feeds `Page Inputs`".** It never did. Both `_setPageParams`
callers are the Router; the string in `navigation-stack.tsx` is a comment.

## Do this next — in the order they are worth doing

### 1. `Navigate To Path`'s `Open In New Tab` (§15.6) — the top of the list

The `window.open` arm, wanting DEF-016's activation read and a blocked-tab `Error` row.
**`External Link` (§14) is the worked example and it is a close one** — §14.1 has the transient
activation finding, §14.3 has why the port is the only thing that tells the node's two failures
apart. This is the last named increment on a `translated` row in Tier 2.5.

### 2. `updatePorts` in `httpnode.ts` still publishes `success` — [§8.5](./EXP-011-PICKER-COVERAGE.md)

The node fires `done`; the editor draws **both**. One line to delete. ⚠️ Deleting a port an
existing project may have wired is a migration question, not only a fix.

### 3. EXP-004 — the honesty UX (a report file into the output)

Every `TODO(export)` marker ends with "See the export report", and there is no report. §10–§16's
refusals all join them. 🔴 **§16.5 adds a requirement to this**: the report should carry the
deferral *reasons*, and those reasons are prose nothing verifies — see the gate hole below.

### 4. A chain-local for `External Link`'s `Error` (§14.4).

### 5. The collection-state slice — unblocks `Set Object Properties` and `Remove Object From Array`.

### 6. The date family's signals — an `effect()` slice, not a date slice (§9.6).

### 7. EXP-009 leftovers — drive the exported login/admin forms; delete the drive-residue user
`exp009-drive` from the local Puppy backend's `_User`.

## 🔴 A gate hole session 45 found and did not close

`scripts/export-ledger/check.js` enforces that a deferral **names its kind and tier**
(`scheduled — …` / `deliberately out of scope — …`). It does **not**, and cannot, check that the
*reason* is true. Two rows asserted a runtime behaviour that did not exist and passed every gate
for five sessions, while the number beside them looked maintained.

**If you write an exemption that makes a factual claim about the runtime, pin it with a test** —
`tests/component-stack-pair.test.ts` is the pattern. Whether that becomes a *rule* (an exemption
citing a runtime file must have a test naming it) is unowned and worth a decision.

## 🔴 Before adding any new `HandlerAction` kind, read §11.6 and §15.5

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

## 🔴 What session 45 would tell you if it could only say four things

1. **A grep cannot tell a mention from a call, and the sentence it produced outlived five
   sessions.** `navigation-stack.tsx` matched `_setPageParams` because it *names* it in a comment
   explaining an analogy. Nobody opened the file. The claim then hardened by being *relayed* —
   into §15.6, into two ledger rows, into two session prompts — until it read as a finding rather
   than a search result. **Re-run the search that produced an inherited claim before planning
   against it.** §15.1 is the same lesson one session earlier; this is its second instance, and
   the second one had travelled further.
2. 🔴 **The load-bearing question was never the one being asked.** Five sessions asked "does a
   component stack map onto routes?" The answer that mattered was structural and took one ledger
   query: **the container is in a later tier**. Two nodes were scheduled a full tier ahead of the
   thing they drive, so no answer to the routing question could have produced a translation.
   **Before designing a node, check that what it drives exists in the target.**
3. 🔴 **An exemption sentence is prose no gate verifies.** `check.js` grades the *shape* of a
   deferral — that it names a kind and a tier — and that made two false rows look reviewed. A
   measurement of form reads as a measurement of substance when nothing separates them.
4. **Prove the instrument before trusting it, on synthetic arms that must disagree.** The counter
   here is fed two snippets differing by one `//` and must return 1 and 0, while a text search
   matches both. Without that pair, a counter returning 0 for everything makes the whole file pass
   while measuring nothing — and the real-file text match is asserted too, as a known-firing
   control, so an AST assertion cannot go vacuously green.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files. ⚠️ A *new* test
file is untracked, and `git commit <pathspec>` **errors** rather than skipping it — `git add` it
and commit in the same command so the staging window stays closed.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 845/845, 38 suites (835/37 before §16 added 10)
cd ../nodegx-module-inject && ../../node_modules/.bin/jest --config jest.config.js   # 31/31
npm run export-ledger:picker                  # from the repo root — holds at 69/127
npm run export-ledger:check                   # 175 types: 83 deferred, 76 translated, 1 stubbed, 15 backend-only
```

⚠️ `ts-node` needs an **absolute** path and `--compiler-options '{"module":"commonjs"}'`, run from
`packages/nodegx-export`. Copy the harness with **`cp -a`** so the `@nodegx/core` symlink survives.
⚠️ **`${PIPESTATUS[0]}` is empty in zsh** — run gates **without a pipe** and read `$?`. Session 45
hit this again: `npm run … | tail` printed `CHECK_EXIT=` and told you nothing.

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

s45 had no drive — the slice was a reading, and `tests/component-stack-pair.test.ts` is its only
artefact. The runtime files it pins: `navigation-stack.tsx`, `router.tsx`, `navigate.ts`,
`navigate-back.ts`, all in `packages/noodl-viewer-react/src/nodes/navigation/`.
s44 scratchpad `7408cf11-…`: `EXPECTED-s44.md`, `note-desk/`, `calls-s44*.json`, `drive-nav.mjs`,
`app/`, `mutate.sh` + `m1..m12.py`, `sab.sh` + `sabA.py`/`sabB.py`, `snap/`.
s43 `2011a26f-…`: `probe/`, `harness/`, `drive-error.mjs`.
s40 `1a63a0f6-…`: `mcp-client.mjs`, `emit-to-app.ts`. s38 `e94a3353-…`: the original `corpus-harness/`.

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a`.
