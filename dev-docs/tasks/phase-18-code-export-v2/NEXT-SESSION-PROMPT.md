# Next session — Tier 1 is closed; the next question is whether to keep counting the picker

## Where the phase stands

**EXP-011 Tier 1.3 is built, driven and gated (session 38), and that closes Tier 1.** All six date
nodes translate: five are pure functions that became one composable expression kind, and `Now`
became one action with a lazily-seeded state row. Read [EXP-011 §9](./EXP-011-PICKER-COVERAGE.md)
before touching this family — **§9.4 is the one that matters most**, because four of its five
near-misses are older than the slice and two of them are the *same rule failing for the third and
fourth time*.

**60 → 66 of 127 (52.0%).** Floor raised in the same commit. Past half, for the first time.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The number

```
npm run export-ledger:picker      # ratcheted in PR CI — holds at 66/127 (52.0%)
npm run export-ledger:check       # also enforces the SHAPE of a deferral (EXP-011 AC4)
```

🔴 The corpus audit is a regression net, never a priority oracle.
🔴 Custom node types are **deliberately** outside the picker number — `$customNodesComment` in
`packages/nodegx-export/coverage-ledger.json` says why. Do not "fix" it by adding them.

## Do this next — and the first decision is which of these two it is

Tier 1 was ranked by *"can you build a normal app without it"*. That question is answered, and the
honest next step is **not** automatically Tier 2. Two candidates, and they are not the same kind
of work:

### A. 🔴 The `unknown`-typed Variable — [§8.7](./EXP-011-PICKER-COVERAGE.md), still open

A Variable written from a **Function output or an event payload** types as `unknown`, and Pass 4
**drops every read of it**. Session 38 closed the four cases it could name one at a time —
`String`, HTTP's `Error`, `Now`'s `ISO String`, `Date To String`'s `Date String` — and each one
was found the same way: by building an app and seeing a placeholder where a value should be.

⚠️ **That per-node whack-a-mole is the finding, not the fix.** Four sessions have now each added a
line to `typeOfSource` after being bitten. The real fix is §8.7's: let a variable be `unknown` and
**coerce at its render sinks**, the way `childText` already coerces an HTTP read — then no future
node needs a line there at all. It costs nothing in the ledger and unblocks the shape every slice
above Tier 1.4 produces. **This is the highest-value non-picker work in the phase.**

### B. Tier 2, and `Page Inputs` is the whole of it

**Navigation (5).** `Page Inputs` is the one that matters — no path parameters means no detail
pages, which is the shape of most real apps. Then `Navigate To Path`, `External Link`, the
component stack pair. **Cloud Services (9)** should be *re-measured* after EXP-009 rather than
planned against the old list; several may fall out for free.

**Recommendation: A first, then B.** A is one slice, it deletes a recurring failure mode rather
than adding a node, and B's detail pages will write variables from page inputs — which is A's
problem again.

## Then, in the order they are worth doing

1. **`updatePorts` in `httpnode.ts` still publishes `success`** — [§8.5](./EXP-011-PICKER-COVERAGE.md).
   The node fires `done`; the editor draws **both**, so an author can wire a `Success` that runs
   nothing, in the editor and in the deployed app. One line to delete. ⚠️ Deleting a port an
   existing project may have wired is a migration question, not only a fix.
2. **EXP-004** — the honesty UX (a report file into the output). EXP-010's `TODO(export)` markers
   and module report both end with "See the export report", and there is no report. Tier 1.1–1.4's
   deferral notes now join them.
3. **The collection-state slice** — unblocks `Set Object Properties` and (with the row-output
   relay) `Remove Object From Array`. Both ledger entries name it.
4. **The date family's signals** — every `Changed` / `Invalid Date` / `On Before` defers, and they
   all defer on the same sentence: a recomputation is a render, not an event. Closing them is an
   `effect()` slice, not a date slice (§9.6).
5. **EXP-009 leftovers**: drive the exported login/admin forms in a browser, and delete the
   drive-residue user `exp009-drive` from the local Puppy backend's `_User`.

## 🔴 What session 38 would tell you if it could only say four things

1. **A new readable node has at least two consumers, and only the first one errors.** This is the
   third and fourth time this rule has been written down after being violated. `resolveExpr` is
   the loud one. The silent ones are **Pass 4c's whitelist**, **Pass 4f's predicate** and
   **`typeOfSource`** — a type missing from any of them renders nothing, reports nothing, and
   passes the whole suite. Pass 4f's predicate is now *derived* from the tables `resolveExpr`
   dispatches on; do that everywhere you can, because a hand-copied list of eighteen ports across
   six nodes is a list that will drift.
2. **Test a transcription against the thing it transcribes, and then prove the comparison can
   fail.** The date math was checked by loading the *emitted* module and running it against the
   interpreter's own `datemath.ts` over ~900 combinations — and by breaking one copy of it on
   purpose to confirm the grid disagrees. A test against a second copy of the same logic proves
   only that both copies say the same thing.
3. **A green suite that parses every emitted file still shipped code that does not parse.** Every
   fixture that reached the broken construct wired it to a button that *already had another
   action*, and two actions take the block form. The single-action case — the shape a real project
   has — was never built until an app was. **Ask what your fixtures have in common.**
4. **When the app is right and the report is wrong, that is the worse way round.** Pass 4f
   discarded the expression tree's own consumed wires, so the export said working wires had "no
   deterministic translation". An author reading that goes looking for a feature that is already
   there.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 704/704
cd ../nodegx-module-inject && ../../node_modules/.bin/jest --config jest.config.js   # 31/31
npm run export-ledger:picker                  # from the repo root — holds at 66/127
```

⚠️ `ts-node` needs an **absolute** path and `--compiler-options '{"module":"commonjs"}'`, run from
`packages/nodegx-export`. Copy the harness with **`cp -a`** so the `@nodegx/core` symlink survives.
Sum the corpus audit's `^=== ` lines with a **regex**, not awk fields — project names contain
spaces, which silently shifts `$3/$4`.

⚠️ **A runtime file may not typecheck under this package's tsconfig.** `datetostring.ts` does not,
because its `_format` reads a `Date | undefined` as a `Date` — the load-bearing throw its own catch
depends on. `ts.transpileModule` erases types without checking them, which is how a test here runs
the interpreter's real code. Do not "fix" the runtime file to make a test import work.

## Authoring a project without an MCP server bound to it (unchanged, and it works)

`create_project` **does not repoint the bound server** — it says so in its own result. So:

1. `mcp__nodegx__create_project` to scope and skeleton the project.
2. Drive a **second server over stdio from a script**: `mcp-client.mjs`, ~50 lines over `spawn` +
   newline-delimited JSON-RPC. It runs the server from **`src` via ts-node**, never from `dist/`.
3. `update_component` takes `{ path, set: { nodes, connections, visualRoots } }` — a whole
   component in one call. ⚠️ `nodes` is a **flat list** and `children` holds **id strings**, not
   nested objects. `get_node_type` takes **`type_names`** (an array), not `typeName`.
4. ⚠️ `mcp-client.mjs` truncates each result to 6000 chars, so a big `render_report` comes back as
   **unparseable JSON**. Grep the raw text for what you need rather than `JSON.parse`-ing it.
5. `render_report` confirms the **interpreter** runs it, before you ask whether the export does —
   and its `text.onScreen` count is a cheap check that the panels you expect to be hidden are.

## Building and driving an exported app (what session 38 reused)

- Harness: `cp -a` the prepared `corpus-harness/` (a Vite app with `node_modules` and the
  `@nodegx/core` symlink), `rm -rf src dist public`, then emit into it. **Never overwrite its
  `package.json`.**
- `npm run build` runs `tsc -b && vite build`. **This is the step that finds what tests cannot.**
- Serve with `npx vite preview --port 5211 --strictPort`; stop it by port
  (`lsof -ti :5211 -sTCP:LISTEN | xargs kill`). Chrome on a **non-default** debug port (9334) —
  a peer's editor holds 9222.
- 🔴 **Read `textContent` per element, never `body.innerText`.**
- 🔴 **Gate a "must not appear" panel on `mounted`, never `visible`** — `visible` keeps the element
  in the DOM with its text intact, so an absence read off it is not an absence.
- 🔴 **Write the expected answers down before the app runs**, and **sabotage the project**
  afterwards to prove the drive can fail. Session 38's sabotage moved exactly 3 rows of 14.

## Instruments

s38 scratchpad `e94a3353-…`: `mcp-client.mjs`, `emit-to-app.ts`, `drive-dates.mjs`,
`corpus-harness/`, the built `dateapp/`, and `sabotaged/` + `sabapp/` (the three-way mutant).
The project also landed as `tests/fixtures/deadline-desk`, and lives at
`~/vscode_projects/NodeGX test projects/Deadline Desk`.
s37's `796c6d71-…` has `quotes-api.mjs`, `drive-quote.mjs`, `quote-desk/`.
s36's `9001618b-…` has `coverage-audit.ts`, `projects-42.txt`, `drive-shelf.mjs`.

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes** (a map-key
separator written literally into template strings). `grep` and `rg` treat the whole file as
**binary and print nothing** — use `rg -a`. Replacing them with `\0` escapes would be
behaviour-identical.
