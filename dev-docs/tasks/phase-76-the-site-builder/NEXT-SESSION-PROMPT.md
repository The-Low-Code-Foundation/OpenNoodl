# Phase 76 — next session

Read `TASKS.md` here first. **SB-004 is closed** — its §7 run is the one thing in this phase that
has ever produced evidence rather than a green graph, and what it found should change how you work
on SB-005/006. Before authoring any cloud component, read
`dev-docs/reference/BACKEND-AUTHORING-MODEL.md` §**"Four things a deployed graph does not do the way
the canvas does"** — those four rules are the difference between a component that runs and one that
504s, and none of them is visible to any authoring check.

## Where s4 left it (2026-08-26)

**SB-004 §7 is built and green.** `nodegx-backend/tests/sb004-publication-invariant.test.ts`, 29
specs, three backends (the site, an unprovisioned one, a two-arm pointer probe). It authors the
seven components through the real MCP server, converts what the door wrote into a workflow bundle
and drives it against SQLite with **`devOpen: false`** — every access claim read from the *outside*,
by an anonymous or non-admin caller over HTTP. Acceptance 1–9 all met. Backend **103 / 1123**,
noodl-mcp **60 / 696**, both typechecks clean.

**The four defects it found are the session's real output**, and each one was green through both
authoring doors first (SB-004 §6, F10–F13):

- **F10** — a `JavaScriptFunction`'s custom signal outputs are **dead** once deployed unless the
  graph declares them as ports. `Outputs.ok()` threw `is not a function`, no Response was reached,
  and the call **504'd after thirty seconds**. The derivation exists and is behind
  `context.editorConnection.isRunningLocally()` — an authored graph is by definition not watched by
  an editor. Filed as **SB-010**, because every cloud component any agent authors has it.
- **F11** — **a signal is not a promise that the values beside it arrived.** Values drain one input
  name per update pass, so a node triggered by one producer can run before another producer's value
  lands. Measured: a four-input code node saw its inputs appear over *three* runs. It refused a
  **correct** setup token (in the message deliberately indistinguishable from a wrong one) and
  copied one of a page's two sections. Fix: guard on `undefined` and return — `runOnValueChange` is
  ticked by default, so a late value re-runs the node for free.
- **F12** — 🔴 **a `Query Records` node fetches once, unfiltered, when the graph is built**, and
  that result is what the graph acts on. Publishing one page **opened every Section on the site**,
  with the correct filter sitting on disk the whole time. This is F5's defect arriving by a road no
  assertion on the authored graph can see.
- **F13** — `points to` **cannot narrow from a cloud function and widens instead of failing**: no
  schema in the cloud runtime, and the translator's refusal is reported through the absent editor
  connection. §2's one unhedged bet lost; the String fallback §2 itself named is taken
  (`Section.pageId`). F12 and F13 are filed together as **SB-011**.

Four mutants graded, one per fix. ⚠️ One correction left visible in the record: F12's fix
(`runOnChange-*: false`, no `Do` wire) is correct **only on a query that has a filter parameter** —
applying it to an unfiltered one made `claimSite` read an already-claimed site as unclaimed, i.e. it
opened the door that mints the first admin. §7's `refuses a second claim` arm caught it in minutes.

## Next work, in order

1. **Put the four rules into `BACKEND_DOCTRINE_MD`** (`noodl-editor/src/editor/src/models/
   AiAssistant/authoring/prompts/backend.ts`, re-exported by `noodl-mcp/src/editor-deps.ts:374`).
   The reference doc has the text; lift it. This is deliberately left undone rather than forgotten:
   it is the first place an agent authoring a cloud function actually reads, and without it every
   one they write is broken in at least one of the four ways.
   🔴 **It is editor source, so it puts `test:ci` back in scope** — run it solo, and read the
   **summary line**, never `$?`. Also re-run `noodl-mcp/tests/sb002BackendDoctrine.test.ts`, which
   does a verbatim-bytes and claim-census check over that constant, and `toolDisclosure`, which
   guards the MCP surface budget (a *result* field rides free, but check rather than assume).
2. **SB-005** (admin panel) and **SB-006** (public site). SB-005 owns `claimSite`'s front: a
   first-run screen that takes the setup token, signs the owner up and calls it.
   🧭 **F8 is Richard's and blocks SB-006's contact section**: `SiteSettings` is world-readable (§4
   gives it `find`/`get: public`, because the public site reads `siteName`), so `contactRecipient`
   cannot live in that row. The fix is to make `site/ContactRecipient` take the address from the
   `Secret` alone, which changes §2's field list.
   ⚠️ **§7 acceptance 2 currently writes rows through the REST API as the owner**, because the panel
   does not exist. When SB-005 lands, drive *its* path — a panel that forgets the ACL produces a
   world-readable draft and every spec in §7 still passes.
3. **SB-007** (ship embedded, category `site`), then **SB-008** — whose *backend* half §7 already
   did. What is left is the browser half: the public site rendering a published page. Scope it as a
   UI drive, not a permissions drive.
4. **SB-009 / SB-010 / SB-011** whenever they fit. All three are measured-not-fixed and all three
   need a corpus sweep rather than an argument before anything blocks.

## Traps that will bite here specifically

- 🔴 **The four rules above.** Rule 1 (declare signal ports) and rule 3 (a query fetches itself once,
  unfiltered) will bite on the very first cloud component SB-005/006 author.
- 🔴 **A green authoring run means well-formed and nothing else.** Three sessions in a row produced
  one and shipped something broken. If a claim is about behaviour, only a run with `devOpen: false`
  can hold it.
- **Both suites author from `noodl-mcp/tests/sb004Components.ts`.** Edit the graphs there, not in
  either spec — a second copy agrees with the artefact only until the first edit that reaches one.
- ⚠️ **`nodegx-backend`'s tests are NOT typechecked**: its tsconfig includes `src/**/*` and excludes
  `**/*.test.ts`, and ts-jest runs `isolatedModules`. `noodl-mcp`'s tsconfig *does* include
  `tests/**/*.ts`, which is why the shared fixture lives there.
- 🔴 **An authored node id is a request, not a handle (F9).** Ids are made unique across the
  *project*, so `settings` became `settings-2`. Read a written graph by node **type** or label.
- **`GET /classes/:name?where=` refuses a tagged Pointer** — *"filter operator it cannot translate:
  `__type`"*. The wire filter vocabulary and the graph's are not the same vocabulary; SB-005 will
  meet this the moment the panel filters on a relation.
- A cloud FUNCTION's interface is the Request node's `params`, and a `stringlist` is **one
  comma-separated string, not an array**. Helpers (no Request node) use Component Inputs/Outputs.
- `Run Tasks` pushes an item's **keys** onto matching Component Inputs. **Nothing constant across
  tasks can be passed**, so the per-item payload is built in a `JavaScriptFunction`. It matches
  `Do`/`Success`/`Failure` on its template **by string** — a worker whose output is named `Done`
  hangs for ever with no warning.
- `Update Record`'s `collectionName` is **edit-only**, so one helper cannot serve two collections.
- 🔴 **The MCP dist on this machine is stale** and the bound servers run it. Author through
  `noodl-mcp/tests/helpers.ts` → `createServer` from `src`; rebuild the dist before trusting any
  live MCP call.
- Shared checkout: commit by pathspec, never stage-then-commit; announce before any editor
  launch/teardown; `test:ci` alone, and completion is the **summary line**, never `$?`.
