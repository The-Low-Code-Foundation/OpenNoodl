# Next session — Tier 2.5 is down to three Navigation nodes, and one has a question in front of it

## Where the phase stands

**Tier 1 closed in session 38. Session 39 closed §8.7. Session 40 built `Page Inputs`. Session 41
built `External Link` and found [DEF-016](../phase-80-the-defects-the-templates-found/DEF-016-EXTERNAL-LINK-ALWAYS-REPORTS-FAILURE.md)
in the node itself. Session 42 closed the store-key gate (§13). Session 43 built `External Link`'s
`Error` output — and found that the emitted app had been reporting Failure on every tab it opened
since DEF-016's export follow-up landed (§14).**

**68 of 127 (53.5%)** — unchanged by session 43, which was an increment on a node already counted.
Read [EXP-011 §12](./EXP-011-PICKER-COVERAGE.md) and [§14](./EXP-011-PICKER-COVERAGE.md) before
touching navigation, and [§11.1](./EXP-011-PICKER-COVERAGE.md) before trusting any ledger row.

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

## ✅ Both of B is done — nothing is owed on `External Link` but `Completed`

Session 42's prompt recommended **B first** (the `Error` output, "an hour"). It was an hour for the
row and a second hour for what the row exposed. Both are landed. `Completed` is what remains on
this node, and it is unchanged in shape: it fires after every outcome, and the slice emits the
outcome arms rather than a join beneath them.

## Do this next

### A. Finish Tier 2.5 — three Navigation nodes

**`Navigate To Path` (`PageStackNavigateToPath`)** — ⚠️ **settle its question before writing any
code.** It consults the project's `navigationPathType` setting (hash vs path) and the scaffold
emits a `BrowserRouter` unconditionally. That is its *first* question, not an afterthought. Its
`{name}` placeholders become `p-name` input ports and its query list becomes `q-name` — the same
two-namespace shape `Page Inputs` had, so §11.2's reasoning transfers.

**The component stack pair** (`PageStackNavigate`, `PageStackNavigateBack`). ⚠️ §11.8: a component
stack also feeds `Page Inputs` at runtime, and the export does not route one at all.

### B. 🔴 Before building any of them, read §14.4 — the second consumer is silent

**A new readable node has at least two consumers in this package, and only one of them errors.**
`resolveExpr` decides what a read *is*; **Pass 4f's admission predicate** (and Pass 4c's whitelist)
decide whether it is ever *called*. Both are opt-in. Session 43 taught `resolveExpr` a new read,
ran the suite, and got a confident note about a wire that had just been implemented — because the
read resolved perfectly in a function nothing called.

This is the third time (§7.5 named it, Tier 1.2 did not close it, §14 hit it). **If you add a
readable output in `A`, grep for the predicate list before you run anything.**

## Then, in the order they are worth doing

1. **`updatePorts` in `httpnode.ts` still publishes `success`** — [§8.5](./EXP-011-PICKER-COVERAGE.md).
   The node fires `done`; the editor draws **both**. One line to delete. ⚠️ Deleting a port an
   existing project may have wired is a migration question, not only a fix.
2. **EXP-004** — the honesty UX (a report file into the output). EXP-010's `TODO(export)` markers
   and module report both end with "See the export report", and there is no report. Tier 1.1–1.4's
   deferral notes and §10/§11/§12/§14's refusals all join them.
3. **A chain-local for `External Link`'s `Error`** (§14.4) — turns one refusal into a translation.
   `HTTP Request`'s `httpChainScope` is the pattern; this is the small version of it.
4. **The collection-state slice** — unblocks `Set Object Properties` and (with the row-output
   relay) `Remove Object From Array`. Both ledger entries name it.
5. **The date family's signals** — every `Changed` / `Invalid Date` / `On Before` defers on the same
   sentence: a recomputation is a render, not an event. An `effect()` slice, not a date slice (§9.6).
6. **EXP-009 leftovers**: drive the exported login/admin forms in a browser, and delete the
   drive-residue user `exp009-drive` from the local Puppy backend's `_User`.

## 🔴 What session 43 would tell you if it could only say five things

1. **The design question was a defect, and asking it first is the only reason it was found.**
   The `Error` slice needed to know where the blocked-tab test was read, because the two failures
   finally had to be told apart. Reading the runtime and the emitter side by side showed they
   disagreed about *when*: runtime before the call, export after it. That is not a style
   difference — **`window.open` consumes the transient activation**, so the export's read was of a
   gesture the call had just spent. Measured before a line was written; the fix followed from the
   measurement rather than the other way round.
2. **A lone `false` fits three explanations, and one control arm excluded two of them.** "The call
   consumed it", "the activation expired", "the getter is false in this host" all predict the same
   reading. The arm that decides is the **same two reads with the call removed** — both `true`. Add
   the tab count and the pair says the open *succeeded* while the test said blocked, which is the
   defect stated in one row rather than inferred.
3. 🔴 **Two of my probe runs were instrument failures that looked exactly like data.** Setting
   `.onclick` **added** a handler beside the page's existing `addEventListener` one, so every click
   ran the old arm first and its `window.open` spent the activation before the arm under test read
   it. Then editing the probe page on disk did not change the document already loaded in the tab.
   Both produced plausible tables. The tell each time was a row that could not be true — a control
   reading `before: false` right after a real click.
4. **`Tests: 0 total` is not a kill, twice more.** Two mutants written `if (false && …)` are type
   errors under ts-jest and never ran. **Every mutant arm owes a row count**, and the two that
   reported zero were rewritten as outright deletions before they meant anything.
5. **An acceptance criterion can name the expression and miss the sequencing.** DEF-016's AC7 —
   *"reads the activation, not the return value"* — was satisfied exactly by code that read the
   activation at the wrong moment. It was graded met, and it was met, and the emitted app was still
   wrong. Recorded in DEF-016 §9.1a so the row is not read as evidence the export was checked end
   to end; it was checked against the sentence.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files silently.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 797/797 — clean (788 before §14 added 9)
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
  (`lsof -ti :52xx -sTCP:LISTEN | xargs kill`). ⚠️ **`vite preview` binds `localhost`, and
  `curl 127.0.0.1` gets nothing** — session 43 read that as a dead server for a minute.
- Launch Chrome **separately** on a non-default debug port, with a **fresh `--user-data-dir` per
  arm**, and connect over the global `WebSocket`. A tab left open by the previous arm is counted by
  the next one otherwise.
- 🔴 **Read `textContent` per element, never `body.innerText`.**
- 🔴 **Click with `Input.dispatchMouseEvent`**, never `element.click()`, whenever a user activation
  matters — and after `Page.bringToFront`, because a background tab reads no activation at all.
- 🔴 **Write the expected answers down before the app runs**, then **sabotage in separate arms** —
  one rule per arm.
- 🔴 **Order the rows around state the runtime never clears.** `External Link`'s `Error` is never
  cleared, so the success row has to run *first*; after any failure the text is occupied and a
  later success proves nothing. ⚠️ And a row downstream of an uncleared write is **not an
  independent row** — session 43 predicted "D3 only" and D4 mirrored it by construction.

## Instruments

s43 scratchpad `2011a26f-…`: `EXPECTED-s43.md` (written before each run), `probe/` (the activation
control pair — `index.html`, `pair.mjs`), `note-desk/` (now carrying the watched link),
`calls-error.json`, `drive-error.mjs`, `harness/` (clean, 8/8), `harness-sabA/` (activation read
after the call) and `harness-sabB/` (message always blocked), `snap/` (pre-mutation copies,
restored by `cp -a` and md5-verified, never `git checkout --`).
s41 `44761146-…`: `note-desk/` original, `probe-noopener.mjs`, `harness*/`.
s40 `1a63a0f6-…`: `mcp-client.mjs`, `emit-to-app.ts`, `drive-notes.mjs`.
s38 `e94a3353-…`: the original `corpus-harness/`.

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a`.
