# Next session — Tier 2.5 has three nodes left, and one of them has a question in front of it

## Where the phase stands

**Tier 1 closed in session 38. Session 39 closed §8.7. Session 40 built `Page Inputs` and the two
nodes beside it that were already lying. Session 41 built `External Link` — and its drive found a
defect in the node itself, which is now [DEF-016](../phase-80-the-defects-the-templates-found/DEF-016-EXTERNAL-LINK-ALWAYS-REPORTS-FAILURE.md).**

**68 of 127 (53.5%).** Read [EXP-011 §12](./EXP-011-PICKER-COVERAGE.md) before touching navigation,
and [§11.1](./EXP-011-PICKER-COVERAGE.md) before trusting any ledger row.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The number

```
npm run export-ledger:picker      # ratcheted in PR CI — holds at 68/127 (53.5%)
npm run export-ledger:check       # also enforces the SHAPE of a deferral (EXP-011 AC4)
```

🔴 The corpus audit is a regression net, never a priority oracle.
🔴 Custom node types are **deliberately** outside the picker number — `$customNodesComment` in
`packages/nodegx-export/coverage-ledger.json` says why. Do not "fix" it by adding them.

## ⚠️ Before you run anything: one red in the export suite is not yours

`tests/stores-events.test.ts › a project with no overrides gets the shipped defaults` fails on
`--primary: #3b82f6`. That is **P77/DEF-001**, a peer's uncommitted AA-contrast fix to
`packages/noodl-editor/.../StyleTokensModel/DefaultTokens.ts`, reaching this package because
[parseProject.ts:16](../../../packages/nodegx-export/src/parse/parseProject.ts#L16) imports
`DEFAULT_TOKENS` straight from the editor. Whoever lands DEF-001 owns updating that expectation.
**772/773 is the clean floor until then.**

## Do this next

### A. Finish Tier 2.5 — three nodes

**`Navigate To Path` (`PageStackNavigateToPath`)** — ⚠️ **settle its question before writing any
code.** It consults the project's `navigationPathType` setting (hash vs path) and the scaffold
emits a `BrowserRouter` unconditionally. That is its *first* question, not an afterthought. Its
`{name}` placeholders become `p-name` input ports and its query list becomes `q-name` — the same
two-namespace shape `Page Inputs` had, so §11.2's reasoning transfers.

**The component stack pair** (`PageStackNavigate`, `PageStackNavigateBack`). ⚠️ §11.8: a component
stack also feeds `Page Inputs` at runtime, and the export does not route one at all.

### B. The two cheap increments session 41 left on `External Link` — [§12.7](./EXP-011-PICKER-COVERAGE.md)

**`Error` is the cheaper of the two and is a state row and nothing else** — both messages are
static (there are exactly two failures and neither is a service's words), so it is `HTTP Request`'s
`errorState` with the hard part removed. `Completed` needs a join beneath the outcome arms.

### C. The store-key gate — the same defect, one shape over — [§10.5](./EXP-011-PICKER-COVERAGE.md)

Unchanged and still shut. `storeKeyReadOf` refuses a Global Store key whose type is not
`string`/`number`, so a key written from an HTTP body drops its read exactly as a Variable used to.
Not widened in §10 for a named reason: that gate is **shared with `resolveExpr`**, so lifting it
lets `unknown` into arbitrary expression positions. A slice of its own, and small.

**Recommendation: B first** (it is an hour and closes a node), then A.

## Then, in the order they are worth doing

1. **`updatePorts` in `httpnode.ts` still publishes `success`** — [§8.5](./EXP-011-PICKER-COVERAGE.md).
   The node fires `done`; the editor draws **both**. One line to delete. ⚠️ Deleting a port an
   existing project may have wired is a migration question, not only a fix.
2. **EXP-004** — the honesty UX (a report file into the output). EXP-010's `TODO(export)` markers
   and module report both end with "See the export report", and there is no report. Tier 1.1–1.4's
   deferral notes and §10/§11/§12's refusals all join them.
3. **The collection-state slice** — unblocks `Set Object Properties` and (with the row-output
   relay) `Remove Object From Array`. Both ledger entries name it.
4. **The date family's signals** — every `Changed` / `Invalid Date` / `On Before` defers on the same
   sentence: a recomputation is a render, not an event. An `effect()` slice, not a date slice (§9.6).
5. **EXP-009 leftovers**: drive the exported login/admin forms in a browser, and delete the
   drive-residue user `exp009-drive` from the local Puppy backend's `_User`.

## 🔴 What session 41 would tell you if it could only say five things

1. **A definition that spreads a helper is not a port list.** `External Link`'s literal `outputs:`
   object has four ports; the editor draws five, because `...outcomeOutputs({…})` adds `Completed`
   to every node that uses it (`outcome.ts:164`). The first refusal sentence written from that
   reading told an author a port they were looking at **did not exist**. Ask the catalog
   (`get_node_type`), not the source file — re-reading the file returns the same four however
   carefully you read it.
2. **A control pair is what separates "the app is wrong" from "the browser said no".** The drive's
   `Done` arm never fired. Three readings fitted: the typed value never reached the Variable, the
   browser blocked the popup, or the emitter was wrong. The pair that settled it varied **one**
   thing — the window-features string — and flipped the answer: `noopener` makes `window.open`
   return `null` **while the tab opens**. That is DEF-016, and it is in the runtime, not the export.
3. **A user gesture is part of the instrument.** `element.click()` is not a user activation, and
   `window.open` is refused outside one — so a driver using it observes the blocked-tab arm for a
   reason that has nothing to do with the app. Use `Input.dispatchMouseEvent`. Both arms of any
   `window.open` measurement need it, or both return `null` and the pair proves nothing.
4. **The row that catches a missing guard was not the row anyone would have predicted.** Sabotage A
   removed the empty-link guard, and the "did it navigate to the failure page" row **did not move**
   — an empty link still returns `null`, so the failure arm still ran. Only the **browser tab
   count** moved. Write the row that observes the mechanism, not the row that observes the outcome
   you happen to be able to see.
5. **`tsc` held 2 of the 14 sites a new `HandlerAction` kind belongs to.** The other twelve are
   `default:` arms, `else if` chains, ternaries and an `every` callback whose missing case comes
   back `unknown` and is swallowed. §11.6 warned about two of them; the census is in §12's commit.
   **Grep `case 'date-now-read'` across both packages** — it is the most recently added kind and
   therefore the most complete map of where a kind has to go.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files silently.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 772/773 — see the DEF-001 note above
cd ../nodegx-module-inject && ../../node_modules/.bin/jest --config jest.config.js   # 31/31
npm run export-ledger:picker                  # from the repo root — holds at 68/127
```

⚠️ `ts-node` needs an **absolute** path and `--compiler-options '{"module":"commonjs"}'`, run from
`packages/nodegx-export`. Copy the harness with **`cp -a`** so the `@nodegx/core` symlink survives.
⚠️ **`${PIPESTATUS[0]}` is empty in zsh** — run the build without a pipe and read `$?`.

## Authoring a project without an MCP server bound to it (unchanged, and it works)

`create_project` **does not repoint the bound server** — it says so in its own result. So:

1. Drive a **second server over stdio from a script**: `mcp-client.mjs`, ~50 lines over `spawn` +
   newline-delimited JSON-RPC. It runs the server from **`src` via ts-node**, never from `dist/`.
2. `update_component` takes `{ path, set: { nodes, connections, visualRoots } }` — a whole component
   in one call. ⚠️ `nodes` is a **flat list**; `children` holds **id strings**. `get_node_type`
   takes **`type_names`** (an array); `get_example` takes **`id`**.
3. ⚠️ **Create a page before any page that navigates to it.** `unresolved-navigation` is a *warning*
   and it still rejects the whole write.
4. ⚠️ **Writing a page can steal `startPage`.** Check `components/App/nodes.json` afterwards.
5. ⚠️ `mcp-client.mjs` truncates each result to 6000 chars, so a big `render_report` comes back as
   **unparseable JSON**. Grep the raw text rather than `JSON.parse`-ing it.

## Building and driving an exported app

- Harness: `cp -a` the prepared `corpus-harness/`, `rm -rf src dist public tsconfig.tsbuildinfo`,
  then emit into it. **Never overwrite its `package.json`.**
- `npm run build` runs `tsc -b && vite build`. **This is the step that finds what tests cannot.**
- Serve with `npx vite preview --port 52xx --strictPort`; stop it by port
  (`lsof -ti :52xx -sTCP:LISTEN | xargs kill`). Launch Chrome **separately** on a non-default debug
  port and connect over the global `WebSocket`.
- 🔴 **Read `textContent` per element, never `body.innerText`.**
- 🔴 **Gate a "must not appear" panel on `mounted`, never `visible`.**
- 🔴 **Write the expected answers down before the app runs**, then **sabotage in separate arms** —
  one rule per arm. Session 41's arm A moved exactly one row; arm B moved exactly one.
- 🔴 **Click with `Input.dispatchMouseEvent`**, not `element.click()`, whenever the thing under test
  needs a user activation (see lesson 3 above).
- ⚠️ **An absence row can pass under sabotage for the wrong reason** — pair it with its positive
  twin. A favicon 404 appears in every arm and is not a finding.

## Instruments

s41 scratchpad `44761146-…`: `EXPECTED-s41.md` (written before the run), `note-desk/` (the
MCP-authored project, now carrying three External Links), `calls-link.json`, `drive-links.mjs`,
`probe-noopener.mjs` (the DEF-016 control pair), `harness/` (clean, 9/9), `harness-sabA/`
(guard removed) and `harness-sabB/` (`_blank` forced).
s40's `1a63a0f6-…` has `mcp-client.mjs`, `emit-to-app.ts`, `drive-notes.mjs`.
s38's `e94a3353-…` has the original `corpus-harness/`.

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a`.
