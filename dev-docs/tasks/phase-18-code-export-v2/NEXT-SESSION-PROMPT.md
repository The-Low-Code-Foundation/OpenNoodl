# Next session — detail pages work; the cheapest nodes left are four doors down the same corridor

## Where the phase stands

**Tier 1 closed in session 38. Session 39 closed §8.7 (the untyped Variable). Session 40 built
Tier 2.5 — `Page Inputs`.** A detail page now works end to end: a Navigate that fills `{id}` in, a
route that carries it, and a `Page Inputs` that reads it back out.

**67 of 127 (52.8%).** Read [EXP-011 §11](./EXP-011-PICKER-COVERAGE.md) before touching navigation.
🔴 **§11.1 is the one that matters** — the ledger recorded `Page` and `RouterNavigate` as
`translated` while both emitted urls react-router could never match. One node moved the number;
three had to be built.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The number

```
npm run export-ledger:picker      # ratcheted in PR CI — holds at 67/127 (52.8%)
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
**750/751 is the clean floor until then.**

## Do this next

### A. Finish Tier 2.5 — four nodes, and one of them is the cheapest left anywhere

**`External Link` (`net.noodl.externallink`)** is `window.open(link, target, params)` with an
`openInNewTab` default of `true`. It is an action sink with a `do` trigger, a literal-or-wired
`link`, and no design question in front of it. Genuinely an afternoon.

**`Navigate To Path` (`PageStackNavigateToPath`)** has a wrinkle the others do not, and it is its
*first* question rather than an afterthought: it consults the project's `navigationPathType`
setting (hash vs path) and the scaffold emits a `BrowserRouter` unconditionally. Settle that before
writing any code for it. Its `{name}` placeholders become `p-name` input ports and its query list
becomes `q-name` — the same two-namespace shape `Page Inputs` had, so §11.2's reasoning transfers.

**The component stack pair** (`PageStackNavigate`, `PageStackNavigateBack`). ⚠️ Note §11.8: a
component stack also feeds `Page Inputs` at runtime, and the export does not route one at all.

### B. The store-key gate — the same defect, one shape over — [§10.5](./EXP-011-PICKER-COVERAGE.md)

Unchanged and still shut. `storeKeyReadOf` refuses a Global Store key whose type is not
`string`/`number`, so a key written from an HTTP body drops its read exactly as a Variable used to.
It was not widened in §10 for a named reason: that gate is **shared with `resolveExpr`**, so
lifting it lets `unknown` into arbitrary expression positions. A slice of its own, and small.

**Recommendation: A first**, and `External Link` first within it — it moves the number for less
work than anything else on the board, and Tier 2.5 half-finished is the kind of state that reads as
done to the next reader.

## Then, in the order they are worth doing

1. **`updatePorts` in `httpnode.ts` still publishes `success`** — [§8.5](./EXP-011-PICKER-COVERAGE.md).
   The node fires `done`; the editor draws **both**, so an author can wire a `Success` that runs
   nothing, in the editor and in the deployed app. One line to delete. ⚠️ Deleting a port an
   existing project may have wired is a migration question, not only a fix.
2. **EXP-004** — the honesty UX (a report file into the output). EXP-010's `TODO(export)` markers
   and module report both end with "See the export report", and there is no report. Tier 1.1–1.4's
   deferral notes, §10's refusals and now §11's three refusals all join them.
3. **The collection-state slice** — unblocks `Set Object Properties` and (with the row-output
   relay) `Remove Object From Array`. Both ledger entries name it.
4. **The date family's signals** — every `Changed` / `Invalid Date` / `On Before` defers on the same
   sentence: a recomputation is a render, not an event. An `effect()` slice, not a date slice (§9.6).
5. **EXP-009 leftovers**: drive the exported login/admin forms in a browser, and delete the
   drive-residue user `exp009-drive` from the local Puppy backend's `_User`.

## 🔴 What session 40 would tell you if it could only say four things

1. **A ledger row says a node is emitted. It never says the emission works.** `Page` and
   `RouterNavigate` were both `translated` and were together producing `/note/{id}` at one end and
   `navigate('/note/{id}')` at the other — two nodes agreeing with each other about a url that
   matched nothing. The gate cannot see that, and neither can a percentage. **When you translate a
   node, ask what else has to be true for it to do anything.**
2. **Adding a field to a `HandlerAction` must be carried to every switch by hand, and `tsc` will
   not tell you which.** Giving `navigate` its parameters left two switches silently wrong —
   `actionsValidIn` (`return true`) and `actionExprsOf` (`return []`). Both were *correct* before
   the field existed. Neither errored: the `every` callback has no return annotation, so a missing
   case comes back `unknown` and is swallowed. The file warns about this at `date-now-read`; this
   is the second and third time it has bitten. **Grep `case '<kind>'` across both packages.**
3. **Gate a translation on the runtime's scope, not on the host framework's.** `useParams()` works
   in a nested component; the Router's `_setPageParams` does not reach one. Without that gate the
   export would have worked **better than the app it came from** — and that is the one class of
   divergence a drive cannot catch, because every row goes green.
4. **A conservative answer beats a true one when the consumer is a different question.** A url
   parameter really is a string, but `exprTsType` feeds the format-collapse decision, and claiming
   `string` there collapses a single-placeholder String Format onto a value that is undefined
   whenever the url lacks it — printing the word "undefined" where the runtime prints `''`. Same
   trap as `dateToString` in §9, one slice later.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 750/751 — see the DEF-001 note above
cd ../nodegx-module-inject && ../../node_modules/.bin/jest --config jest.config.js   # 31/31
npm run export-ledger:picker                  # from the repo root — holds at 67/127
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
   nested objects. `get_node_type` takes **`type_names`** (an array); `get_example` takes **`id`**.
4. ⚠️ **Create a page before any page that navigates to it.** `unresolved-navigation` is a *warning*
   and it still rejects the whole write — Home naming `/Pages/Note` fails until Note exists.
5. ⚠️ **Writing a page can steal `startPage`.** Auto-registration made the newly created detail page
   the start page; check `components/App/nodes.json` after authoring and fix it with
   `update_component` on `App`.
6. ⚠️ `mcp-client.mjs` truncates each result to 6000 chars, so a big `render_report` comes back as
   **unparseable JSON**. Grep the raw text for what you need rather than `JSON.parse`-ing it.

## Building and driving an exported app

- Harness: `cp -a` the prepared `corpus-harness/` (a Vite app with `node_modules` and the
  `@nodegx/core` symlink), `rm -rf src dist public`, then emit into it. **Never overwrite its
  `package.json`.**
- `npm run build` runs `tsc -b && vite build`. **This is the step that finds what tests cannot** —
  it found both of session 40's defects, with 748 unit tests green either side of them.
- Serve with `npx vite preview --port 52xx --strictPort`; stop it by port
  (`lsof -ti :52xx -sTCP:LISTEN | xargs kill`). Launch Chrome **separately** on a non-default debug
  port and connect over the global `WebSocket` — driving it from inside the driver script raced the
  target list and reported "no CDP target".
- 🔴 **Read `textContent` per element, never `body.innerText`.**
- 🔴 **Gate a "must not appear" panel on `mounted`, never `visible`.**
- 🔴 **Write the expected answers down before the app runs**, then **sabotage in separate arms** —
  one rule per arm, or a broad sabotage hides the narrow one behind it. Session 40's arm B moved
  exactly the one row predicted; arm A moved ten.
- ⚠️ **An absence row can pass under sabotage for the wrong reason.** D4 ("the badge is absent")
  survived a sabotage that redirected every route home, because there is no badge on the home page
  either. It is only sound paired with its positive twin. A favicon 404 appears in every arm and is
  not a finding.

## Instruments

s40 scratchpad `1a63a0f6-…`: `EXPECTED.md` (written before the run), `note-desk/` (the MCP-authored
project), `mcp-client.mjs`, `emit-to-app.ts`, `drive-notes.mjs`, `harness/` (clean, 13/13),
`harness-sabA/` (braces kept) and `harness-sabB/` (merge order reversed).
s39's `481a2793-…` has `emit-drive-app.ts`, `quote-api.mjs`, `drive-untyped.mjs`.
s38's `e94a3353-…` has the original `corpus-harness/`.
s36's `9001618b-…` has `coverage-audit.ts`, `projects-42.txt`.

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes** (a map-key
separator written literally into template strings). `grep` and `rg` treat the whole file as
**binary and print nothing** — use `rg -a`.
