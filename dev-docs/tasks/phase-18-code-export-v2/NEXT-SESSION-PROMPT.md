# Next session — the whack-a-mole is gone; Tier 2 is next, and it is `Page Inputs`

## Where the phase stands

**Tier 1 closed in session 38. Session 39 closed §8.7 — the untyped Variable.** A Variable written
from an HTTP body, a Function output or an event payload no longer drops every read of itself; the
render sinks coerce it. Read [EXP-011 §10](./EXP-011-PICKER-COVERAGE.md) before touching bindings —
**§10.2 is the one that matters**, because the fix was to move the type question from a table of
*writers* to the *sink*, and `bindingExpr` now takes a required sink argument to keep it there.

**66 of 127 (52.0%), unchanged and deliberately so.** §10 added no node. It removed a failure mode
that had cost four sessions one patch each.

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

## Do this next

### A. Tier 2 — and `Page Inputs` is the whole of it

**Navigation (5).** `Page Inputs` is the one that matters: no path parameters means no detail
pages, which is the shape of most real apps. Then `Navigate To Path`, `External Link`, the
component stack pair. **Cloud Services (9)** should be *re-measured* after EXP-009 rather than
planned against the old list; several may fall out for free.

⚠️ Detail pages write variables from page inputs — which was §8.7's shape. That is now handled, so
this is unblocked rather than blocked, but it is worth knowing the coercion is what is carrying it.

### B. 🔴 The store-key gate — the same defect, one shape over — [§10.5](./EXP-011-PICKER-COVERAGE.md)

`storeKeyReadOf` refuses a Global Store key whose type is not `string`/`number`, so a key written
from an HTTP body drops its read exactly as a Variable used to (*"key … has no statically-typed
value"*). §10 did **not** widen it, for a named reason: that gate is **shared with `resolveExpr`**,
so lifting it lets `unknown` into arbitrary expression positions — arithmetic, date arguments —
that §10 did not measure. It is a slice of its own and smaller than §10 was. The sink machinery it
needs already exists.

**Recommendation: A first.** B is real but narrower — a store key is one of several ways to hold
state, and `Page Inputs` is a shape you cannot build around at all.

## Then, in the order they are worth doing

1. **`updatePorts` in `httpnode.ts` still publishes `success`** — [§8.5](./EXP-011-PICKER-COVERAGE.md).
   The node fires `done`; the editor draws **both**, so an author can wire a `Success` that runs
   nothing, in the editor and in the deployed app. One line to delete. ⚠️ Deleting a port an
   existing project may have wired is a migration question, not only a fix.
2. **EXP-004** — the honesty UX (a report file into the output). EXP-010's `TODO(export)` markers
   and module report both end with "See the export report", and there is no report. Tier 1.1–1.4's
   deferral notes and §10's refusals now join them.
3. **The collection-state slice** — unblocks `Set Object Properties` and (with the row-output
   relay) `Remove Object From Array`. Both ledger entries name it.
4. **The date family's signals** — every `Changed` / `Invalid Date` / `On Before` defers, and they
   all defer on the same sentence: a recomputation is a render, not an event. Closing them is an
   `effect()` slice, not a date slice (§9.6).
5. **EXP-009 leftovers**: drive the exported login/admin forms in a browser, and delete the
   drive-residue user `exp009-drive` from the local Puppy backend's `_User`.

## 🔴 What session 39 would tell you if it could only say four things

1. **A gate that has been patched once per session is not a gate that needs another patch.**
   `typeOfSource` gained `String`, then HTTP's `Error`, then `Now`'s `ISO String` and `Date To
   String`'s — four sessions, four one-line fixes, each found by building an app and seeing a
   placeholder. The table was in the wrong place: a table of *writers* has to know every readable
   node in the product, and errors nowhere when it does not. **When the same fix keeps arriving,
   fix where the question is asked.**
2. **A conservative gate is a measurement of some other property — do not reuse it as a type.**
   `exprTsType` returns `unknown` for `date-call` *deliberately*, to stop a single-placeholder
   String Format collapsing. Keying the new coercion off it would have wrapped `String()` around
   the whole of Tier 1.3 and changed shipped output, for a reading that was never about
   renderability. The coercion is keyed on the one field that means exactly what it says: a
   Variable's `'string' | 'unknown'`.
3. **`className={` contains `Name={`.** Two of this session's own new assertions passed and failed
   for the wrong reason until they were anchored. An unanchored `toContain` over generated JSX is
   a test of the attribute *alphabet*, not of the attribute. Anchor them.
4. **The build found what 722 tests could not.** `<GreetingCard Name="Ada" Name={quote} />` —
   an authored parameter and a wire into the same port, both printed, **TS17001**. It had nothing
   to do with untyped values; the old type gate was hiding it at that one sink, and it bit a
   `string`-typed variable exactly as hard. **`npm run build` on an emitted app is not a formality.**

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 722/722
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

## Building and driving an exported app (what session 39 reused)

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
  afterwards to prove the drive can fail. Session 39's sabotage moved exactly the 3 rows of 4 it
  was predicted to move; a favicon 404 appeared in **both** arms and is not a finding.
- ⚠️ A drive needs a control the drive can still *use*: session 39 nearly wired `enabled` from the
  same variable as the fetch button, which would have disabled the only button it had to click.

## Instruments

s39 scratchpad `481a2793-…`: `EXPECTED.md` (written before the run), `emit-drive-app.ts`,
`quote-api.mjs`, `drive-untyped.mjs`, `harness/` (the built app) and `harness-sab/` (the mutant).
s38's `e94a3353-…` has `mcp-client.mjs`, `emit-to-app.ts`, `drive-dates.mjs`, `corpus-harness/`.
s37's `796c6d71-…` has `quotes-api.mjs`, `drive-quote.mjs`, `quote-desk/`.
s36's `9001618b-…` has `coverage-audit.ts`, `projects-42.txt`, `drive-shelf.mjs`.

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes** (a map-key
separator written literally into template strings). `grep` and `rg` treat the whole file as
**binary and print nothing** — use `rg -a`. Replacing them with `\0` escapes would be
behaviour-identical.
