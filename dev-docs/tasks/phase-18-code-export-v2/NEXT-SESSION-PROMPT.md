# Next session — EXP-011 Tier 1.2 landed; next is Tier 1.3, the date family

## Where the phase stands

**EXP-011 Tier 1.2 is built, driven and gated (session 37).** `HTTP Request` exports: one function
per node in `src/api/http.ts`, both outcome arms, the `Error` value, the Response Mapping compiled
to accessors. Read [EXP-011 §8](./EXP-011-PICKER-COVERAGE.md) before touching this family — §8.3 is
the one that matters most, because **three of its four near-misses are older than the slice** and
the next slice can walk into all three unchanged.

**59 → 60 of 127 (46.5% → 47.2%).** Floor raised in the same commit.

**Only Tier 1.3 is left of Tier 1.**

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The number

```
npm run export-ledger:picker      # ratcheted in PR CI — holds at 60/127 (47.2%)
npm run export-ledger:check       # also enforces the SHAPE of a deferral (EXP-011 AC4)
```

🔴 The corpus audit is a regression net, never a priority oracle.
🔴 Custom node types are **deliberately** outside the picker number — `$customNodesComment` in
`packages/nodegx-export/coverage-ledger.json` says why. Do not "fix" it by adding them.

## Do this next: EXP-011 Tier 1.3 — the date family

**[EXP-011 §3 Tier 1](./EXP-011-PICKER-COVERAGE.md), item 3.** `Now`, `Date To String`, `Date Add`,
`Date Compare`, `Date Difference`, `Date Parts` — six Utilities nodes, and anything with a
timestamp needs two of them. Read their runtime sources first, the way §8 read `httpnode.ts` and
§7 read `filtercollectionnode.ts`: the export's job is to reproduce what those files do, including
what they get wrong.

⚠️ **`Now` is time-dependent**, which no node in this vocabulary has been. Decide early whether it
is a render read (recomputed every render — wrong: it would re-render forever) or an invoked read,
and let the runtime's own `runOnChange` answer it rather than choosing.

## Then, in the order they are worth doing

1. 🔴 **The `unknown`-typed Variable** — [§8.7](./EXP-011-PICKER-COVERAGE.md). A Variable written
   from an HTTP output (or a Function output, or an event payload) types as `unknown`, and Pass 4
   **drops every read of it**: *fetch → Set Variable → show it*, the first thing anyone builds,
   exports a blank element with a note. The fix is the one `childText` just made for an HTTP read —
   let the variable be `unknown` and coerce at its render sinks — and it needs an audit of the
   other sinks (`contentAttrs` emits `src={expr}` raw). This is the highest-value non-picker work
   in the phase right now: it costs nothing in the ledger and unblocks the shape every slice above
   Tier 1.4 produces.
2. **`updatePorts` in `httpnode.ts` still publishes `success`** — [§8.5](./EXP-011-PICKER-COVERAGE.md).
   The node fires `done` (ERG-001 renamed it); the editor draws **both**, because a node's port set
   is type-ports concat dynamic-ports. So an author can wire a `Success` that runs nothing, in the
   editor and in the deployed app. One line to delete, plus a look at whether `canceled`/`error`
   should stay in that list at all now that the static definition declares them. ⚠️ Deleting a port
   an existing project may have wired is a migration question, not only a fix.
3. **EXP-004** — the honesty UX (a report file into the output). Still owed: EXP-010's emitted
   `TODO(export)` markers and module report both end with "See the export report", and there is no
   report. Tier 1.1's, 1.2's and 1.4's deferral notes now join them.
4. **The collection-state slice** — it unblocks `Set Object Properties` and (with the row-output
   relay) `Remove Object From Array`. Both ledger entries name it.
5. **EXP-009 leftovers**: drive the exported login/admin forms in a browser, and delete the
   drive-residue user `exp009-drive` from the local Puppy backend's `_User`.

## 🔴 What session 37 would tell you if it could only say four things

1. **A walker with a `default` is where a new construct dies quietly.** `collectExprUse` had no
   case for the asynchronous actions, so nothing inside a `done` or `failure` chain earned its
   state row or its import — the emitted page read an identifier it never declared. `compileSink`
   is worse: no `default` at all, just a fall-through to the Set Variable case, so an unhandled
   node type **defers with a plausible reason about a different node**. When you add an action or
   an expression kind, grep for every site that enumerates the union — the compiler only catches
   the exhaustive ones.
2. **A collision you can see is not necessarily the collision that can fire.** The emitted page had
   `const error = useValue(postError)` beside `catch (error)`, and the fix went into the render
   locals, where it was **inert** — a handler reads a variable through `.get()`, never through the
   render local. The reachable case was a *state row* named `error`, which prints bare in both
   modes. Measure which one can actually be reached before fixing either.
3. **Allocation order decides whether a row exists.** The answer row is allocated by the read that
   needs it, and render reads resolve two passes after the action compiles — so asking "does
   anything read this?" at compile time answered *no* for every render read there is. §6.2 moved a
   push *later* to stop emitting a row nothing read; §8.3 moved one *later* to stop dropping a row
   something does. Both live in the verdict sweep now, and that is where this kind of question
   belongs.
4. **Make the server tell you what it received.** The drive's strongest row is the echo line: a
   quote appearing on screen is consistent with the query parameter and the header never leaving
   the app. A local server that reports what actually arrived turns "it looks right" into a reading
   that can exclude.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 658/658
cd ../nodegx-module-inject && ../../node_modules/.bin/jest --config jest.config.js   # 31/31
npm run export-ledger:picker                  # from the repo root — holds at 60/127
```

⚠️ `ts-node` needs an **absolute** path and `--compiler-options '{"module":"commonjs"}'`, run from
`packages/nodegx-export`. Copy the harness with **`cp -a`** so the `@nodegx/core` symlink survives.
Sum the corpus audit's `^=== ` lines with a **regex**, not awk fields — project names contain
spaces, which silently shifts `$3/$4`.

## Authoring a project without an MCP server bound to it (unchanged, and it works)

`create_project` **does not repoint the bound server** — it says so in its own result. So:

1. `mcp__nodegx__create_project` to scope and skeleton the project.
2. Drive a **second server over stdio from a script**: `mcp-client.mjs`, ~50 lines over `spawn` +
   newline-delimited JSON-RPC. It runs the server from **`src` via ts-node**, never from `dist/`.
3. `update_component` takes `{ path, set: { nodes, connections, visualRoots } }` — a whole
   component in one call, which is the simplest way in. The `operations` discriminators are
   **snake_case** (`add_node`, `add_connection`, …); `addNode` returns *"Invalid discriminator
   value"*. ⚠️ `get_node_type` takes **`type_names`** (an array), not `typeName`.
4. ⚠️ `mcp-client.mjs` truncates each result to 6000 chars, so a big `render_report` comes back as
   **unparseable JSON**. Grep the raw text for what you need rather than `JSON.parse`-ing it.
5. `render_report` confirms the **interpreter** runs it, before you ask whether the export does.

## Building and driving an exported app (what session 37 reused)

- Harness: `cp -a` the prepared `corpus-harness/` (a Vite app with `node_modules` and the
  `@nodegx/core` symlink), `rm -rf src dist public`, then emit into it. **Never overwrite its
  `package.json`.**
- `npm run build` runs `tsc -b && vite build`, so the generated wrappers are typechecked. **This is
  the step that finds what tests cannot.**
- Serve with `npx vite preview --port 5199 --strictPort`; stop it by port
  (`lsof -ti :5199 -sTCP:LISTEN | xargs kill`). Chrome on a **non-default** debug port (9333).
- 🔴 **Typing into a React-controlled input needs the native value setter**, not `el.value = x`.
- 🔴 **Read `textContent` per element, never `body.innerText`** — `innerText` collapses empty
  elements away, and an empty readout is exactly what an honest deferral leaves behind.
- 🔴 **Give the drive something that must NOT happen**, and **sabotage the project** afterwards to
  prove the drive can fail at all.

## Instruments

s37 scratchpad `796c6d71-…`: `mcp-client.mjs`, `emit-to-app.ts`, `quotes-api.mjs` (the local server
the drive points at), `drive-quote.mjs`, `corpus-harness/`, the built `quoteapp/`, and
`quote-desk/` (also landed as `tests/fixtures/quote-desk`).
s36's `9001618b-…` has `coverage-audit.ts`, `projects-42.txt`, `drive-shelf.mjs`, `shelfapp/`.
s35's `91a5e120-…` has `harness/`, `dialapp/`, `drive.mjs`, `projects.txt` (41).

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes** (a map-key
separator written literally into template strings). `grep` and `rg` treat the whole file as
**binary and print nothing** — use `rg -a`. Replacing them with `\0` escapes would be
behaviour-identical.
