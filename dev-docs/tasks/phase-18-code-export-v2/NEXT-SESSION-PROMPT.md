# Next session — Tier 2.5 has three nodes left, and one of them has a question in front of it

## Where the phase stands

**Tier 1 closed in session 38. Session 39 closed §8.7. Session 40 built `Page Inputs` and the two
nodes beside it that were already lying. Session 41 built `External Link` — and its drive found a
defect in the node itself, which is now [DEF-016](../phase-80-the-defects-the-templates-found/DEF-016-EXTERNAL-LINK-ALWAYS-REPORTS-FAILURE.md).
Session 42 closed the store-key gate — the last of §10's leftovers (§13).**

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

## ✅ That DEF-001 red is fixed — the floor is now clean, and it moved

🔴 **The export floor is no longer `772/773`. It is a full pass — do not quote the old number.**

`tests/stores-events.test.ts › a project with no overrides gets the shipped defaults` pinned
`--primary: #3b82f6` and went red when DEF-001's AA-contrast ruling landed (`30eb92b2`), reaching
this package because
[parseProject.ts:16](../../../packages/nodegx-export/src/parse/parseProject.ts#L16) imports
`DEFAULT_TOKENS` straight from the editor. The expectation now tracks the ruled `#2563eb`
(`881f7632`, phase 80 s3).

⚠️ **This note's own instruction is what nearly lost it.** *"Whoever lands DEF-001 owns updating
that expectation"* was the correct diagnosis, but DEF-001 **closed without doing it** — and a
closed task cannot own anything. The red then read as expected, which is the state a
carried-forward floor is worst at: a red everyone has agreed to ignore is indistinguishable from
a regression.

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

### B2. ✅ DEF-016 landed, and the export follow-up landed with it — nothing owed

`0c011b6b` fixed the runtime (the blocked-tab test now reads `navigator.userActivation` **before**
the call, instead of `window.open`'s `noopener`-poisoned return value) **and** carried
`case 'external-link'` in `src/emit/component.ts` with it. AC7 is met; the emitted test is
`(window.open(…), navigator.userActivation?.isActive !== false)`.

⚠️ §12.6 still ends *"it stops being wrong the moment DEF-016 is fixed"* — that sentence is now
**history, not a pending item**. §12.7 says so.

🔴 **B above is therefore unblocked and unchanged in shape**: both `Error` messages are still
static, and — worth checking against the source rather than against §12.4 — the value the `Error`
output actually carries is `_internal.lastError`, the **short** `'The browser blocked opening a new
tab'`, not the longer sentence `reportOutcome` sends to the outcome channel. Two strings, one port,
and only one of them is the port's.

### C. ✅ The store-key gate — closed in session 42 — [§13](./EXP-011-PICKER-COVERAGE.md)

`storeKeyReadOf` now takes a mode: pass 4b's render binding takes `'binding'` and marks the source
`untyped`, `resolveExpr` keeps `'expr'`. §10.5's named reason for not lifting it is why it was
**split** rather than widened. A `boolean` key — refused by the same one-line test and never
untypable at all — binds now too.

🔴 **If you ever "simplify" `storeKeyReadOf` by deleting the mode parameter, one test row exists
solely to stop you**: *an expression position still defers on the untyped key*. It is the only row
that mutant 3 kills.

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

## 🔴 What session 42 would tell you if it could only say five things

*(Session 41's five — the spread helper that is not a port list, the `noopener` control pair, the
user gesture as instrument, the tab-count row, and the 14 sites a new `HandlerAction` kind belongs
to — are in `588bce72` and EXP-011 §12. Read §12 before touching `External Link`.)*

1. **The file changed under me between two reads, and the second read was the true one.** Reading
   `externallink.ts:40-90` gave a `window.open` return-value test; reading `:90-160` moments later
   gave a `userActivation` test. Not two copies — a peer was committing DEF-016 **as I read**. The
   tell was that the two readings could not both be true, and `stat` settled it in one command.
   🔴 **On a shared checkout, a surprising reading is a question about *when* you read, not only
   about what is there.** It also changed the plan: session 41's recommended next task (B) was
   building on a shape that was being replaced, so this session took C instead.
2. **A mutant that does not compile kills nothing and reads like a clean run.** Mutant 2's first
   form was a type error, and jest reported **`Tests: 0 total`** — not a failure, not a kill.
   🔴 **Every mutant arm owes a row count, and `0 total` means it never ran.** ts-jest typechecks
   the tests here, so a mutation must be type-valid to be a mutation at all.
3. **A green build proves a coercion is *valid*, never that it is *needed*.** The emitted app built
   with `String(x ?? '')` in place — which says nothing on its own. The arm that says something is
   the **necessity control**: emit the value bare, rebuild, and watch `tsc` fail with **TS2322 ×2**.
   Do not report "the build passed" as evidence for a change the build would have passed without.
4. 🔴 **And that same build is blind to one of the four rows — say so rather than let it read as
   covered.** Bare `{loud}` where `loud: boolean` **compiles**, because `boolean` is a valid
   `ReactNode`. But React renders a bare boolean as *nothing* where the runtime's Text node renders
   `String(value)` → `"true"`. The coercion there fixes a divergence `tsc` cannot see, so the
   necessity control covers the `unknown` sinks **only**, and §13.4 says which.
5. **Two arms in this session were built wrong in the same way: the thing I varied was not the only
   thing that differed.** The gate-still-shut row first wired into the fixture's `themeFormat`,
   whose port **already had a wire** — so it measured a duplicate. And the boolean arm built its
   store with a `literal` ParamValue where `initialState` parses as **`json`**, which is silently
   ignored, emitting `store<MoodState>('mood', {})` and every key optional. 🔴 **Both failed
   looking exactly like a pass would if you only checked the wire survived. Probe the real IR.**

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files silently.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 788/788 — clean; the old 772/773 note is spent
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

s42 scratchpad `641dc708-…`: `harness/` (the emitted untyped-store-key app, builds clean) and
`snap/` (the pre-mutation copies of `plan.ts`/`component.ts` — mutants were restored by `cp -a` and
md5-verified, never `git checkout --`).
s41 scratchpad `44761146-…`: `EXPECTED-s41.md` (written before the run), `note-desk/` (the
MCP-authored project, now carrying three External Links), `calls-link.json`, `drive-links.mjs`,
`probe-noopener.mjs` (the DEF-016 control pair), `harness/` (clean, 9/9), `harness-sabA/`
(guard removed) and `harness-sabB/` (`_blank` forced).
s40's `1a63a0f6-…` has `mcp-client.mjs`, `emit-to-app.ts`, `drive-notes.mjs`.
s38's `e94a3353-…` has the original `corpus-harness/`.

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a`.
