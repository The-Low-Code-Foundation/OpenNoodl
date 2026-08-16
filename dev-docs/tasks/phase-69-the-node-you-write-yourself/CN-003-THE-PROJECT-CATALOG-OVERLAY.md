# CN-003 — The project catalog overlay ⭐⭐ the keystone

| Field | Value |
|---|---|
| **Tier** | 1 |
| **Effort** | L |
| **Surface** | `catalog`, `mcp`, `editor` |
| **Rulings** | ✅ **D3** (where extraction runs, no disk cache) · ✅ **D7** (this phase owns the spine) · ✅ **D1** (does not gate this task) |
| **Depends on** | CN-001 (or you cannot see what you built), CN-002 (or you have no baseline) |
| **Blocks** | CN-004, CN-008, CN-009, CN-010, and P65's rescoped LBR-008 |

## The problem, stated once

`node-catalog.json` is generated from the **live register of built-ins only**.
`scripts/node-catalog/extractor-entry.js` loads `noodl-runtime` + `noodl-viewer-react` +
`noodl-viewer-cloud`, lets them register, and serialises what the register holds. A project's own
module nodes are not in it and **cannot** be: the catalog is built at repo-build time; kits exist per
project, per machine.

That one fact is why custom nodes are second-class everywhere at once — validation skips them
(CN-002), `--strict` fails them, `visualRoots.ts` guesses at them, and every MCP node tool and AI
prompt is blind to them. **Fix the catalog and the rest become ordinary work.**

## The shape, as ruled

✅ **D3, and it makes this task much smaller than it looks.**

**The editor extracts nothing.** It already holds the definitions. Measured 2026-08-15:
`NodeLibrary.instance` carried all five kit types with complete port counts (Lane 9/11, Pill 23/14,
Strip 16/10, Axis 12/8, Banner 19/9), category `Visual`, delivered by the running viewer over
`sendNodeLibrary` (`ViewerConnection.ts:286`). The editor-side overlay is a **read of state it
already has**, not an execution.

**The MCP server extracts**, because it is headless and has no viewer. It executes the kit's
`index.js` and reads the live register — the same technique as `extractor-entry.js`, using the
existing `scripts/node-catalog/dom-shim.js`. Precedent, not invention.

🔴 **No on-disk cache.** A stale cache reads exactly like a correct answer, which is this repo's most
expensive recurring failure (`a-stale-mcp-dist-hides-a-merged-vocabulary-field`,
`test-results-json-is-the-readout-not-the-log`). If extraction proves too slow in practice, the
sanctioned escalation is an **in-memory, per-server-session cache keyed on module mtime** — never a
file.

## The obligation that comes with two sources

Because the editor and the MCP server now derive the same facts by **different routes**, they can
disagree — and a user will find the disagreement before we do.

✅ **This task must ship a check that they agree.** Concretely: a test that takes one fixture project,
gets the type set + port sets by the MCP route and by a recorded `sendNodeLibrary` payload, and
asserts they match. When they diverge, the failure must name the divergence, not just fail.

⚠️ This is not optional polish. It is the specific risk D3 accepted in exchange for a smaller
surface, and it is written into the ruling.

## ✅ Slice 1 landed 2026-08-16 (`f1663600`) — and it corrects the build plan below

**`@nodegx/kit-catalog`**, the pure half: payload → catalog-shaped overlay entries, `mergeOverlay`,
and `compareOverlays`/`describeComparison` (the D3 agreement check, which names divergences rather
than only failing). 26/26 green, added to `test:packages` — that gate scopes **by name**, so a
package left out of it runs no tests at all. `catalog:check` re-run: committed catalog up to date,
175 node types, so **acceptance criterion 4 holds**.

🔴 **The two-mapping shape in items 1–3 below was wrong, and the correction is the point of the
slice.** The spec had the MCP server shape kit nodes through `buildCatalog` while the editor mapped
from what the viewer sent — **two mappings for one set of facts**, which is the duplication this
phase exists to end, and a permanent generator of the very divergence D3 accepted as a risk.

Both routes can produce the **same input** instead. `generateNodeLibrary`
(`@noodl/runtime/src/nodelibraryexport`) is what the viewer sends over `sendNodeLibrary`, and a
headless extractor that registers a kit against a live register calls the identical function. So the
editor reads the payload it already holds, the MCP server produces one headlessly, and **both hand it
to the same mapping**. The agreement obligation then narrows to the question that actually carries
risk — *do the two registers agree*, not *do two hand-written mappings agree*. `buildCatalog` is
never touched, which is how criterion 4 is met by construction rather than by care.

⚠️ **What a green `compareOverlays` therefore does and does not say**, written down because the
weaker reading is the tempting one: it says the two registers agree. It does **not** independently
verify the mapping — the fixture tests do that. Do not quote a passing agreement check as evidence
the overlay is correct.

### Measured, not assumed

A throwaway extractor executed the cashflow kit headlessly against a live register (dom-shim,
`window.React`, `Noodl.defineModule` collecting, `createNodeFromReactComponent`, `registerModule`).
All five types came out with the port counts the editor's own `NodeLibrary.instance` reported:

| type | this run (headless, 08-16) | editor `NodeLibrary` (recorded 08-15) |
|---|---|---|
| `nodegx.cashflow.Lane` | 9 in / 11 out | 9 / 11 |
| `nodegx.cashflow.Pill` | 23 in / 14 out | 23 / 14 |
| `nodegx.cashflow.BalanceStrip` | 16 in / 10 out | 16 / 10 |
| `nodegx.cashflow.DayAxis` | 12 in / 8 out | 12 / 8 |
| `nodegx.cashflow.DangerBanner` | 19 in / 9 out | 19 / 9 |

⚠️ **Two different instruments, two different days** — the right-hand column is a *recorded* reading
from another session, not a re-measurement taken today. It is corroboration, not a control.

**Timing: esbuild bundle 74ms, extraction run 104ms.** That is why D3's no-on-disk-cache rule costs
nothing, and it removes the escalation-to-an-in-memory-cache clause as a live concern.

The test fixture is that **captured** payload (`tests/fixtures/cashflow-kit-nodelibrary.json`), not a
hand-written one — this phase has already lost time to two specs naming controls that had never been
run.

### Knowingly absent, with owners

Two catalog fields cannot be recovered from the payload. Both are recorded as knowingly-absent rather
than guessed, the same reasoning as `DynamicPortSkipped` and CN-002's `unknown-type-check-skipped`:

- **`parameterEncoding`** — derived by *driving* the node's dynamic-port hook (`derive-encoding.js`),
  which needs the raw definition. Overlay entries carry `{ known: false, reason }`. → **CN-010**.
- **`ssr`** — `createNodeFromReactComponent` puts an `ssr` key in the register metadata but
  `generateNodeLibrary` does not export it. Left **absent**, which for an overlay node means *not
  assessed*, never *safe*. → **CN-013**.

## ✅ Slice 2b landed 2026-08-16 — the MCP caller, and the number

`src/kitExtract/extract.ts` spawns the extractor, maps with `@nodegx/kit-catalog` and returns an
overlay; `src/kitOverlay.ts` installs it into `catalog.ts` when a project binds. `catalogIndex()`,
and therefore validation, `visualRoots`, `get_node_type`, `list_node_types` and the write gate, now
know the bound project's own node types. 21 tests, mutation-proven (commenting out the one
`setCatalogOverlay` call fails 7 of them).

### 🔴 Acceptance criterion 3, measured — and the instrument the spec's number belongs to

`npm run validate:project` on `NodeGX test projects/cashflow-command-centre`:

| | errors | warnings | infos | nodes | **endpoints checked** |
|---|---|---|---|---|---|
| before (and `--no-kits` today, as a control) | 0 | 5 | **8** | 19 | **18** |
| after | 0 | **0** | **0** | 19 | **28** |

The infos going to zero is the weak half. **The endpoints went 18 → 28**, which is exactly the "10 of
28 connection endpoints never reached" CN-002 measured on this project before it could be fixed — an
independent corroboration of that reading, from the other side. On
`packages/noodl-mcp/tests/fixtures/kit-app` the replacement is visible as a diagnostic: a connection
to `progres` on a kit node, invisible to everything until today, is now
`error [nonexistent-port] … did you mean 'progress'?` with the node's twelve real inputs listed.

🔴 **The cashflow number can only ever be read by the CLI.** `cashflow-command-centre` is a **legacy
monolithic project** and the MCP server refuses those at startup, so the acceptance number and the
MCP route were never joinable — the handover that quoted one as the test of the other had not noticed.
`scripts/validate-project.ts` therefore builds the overlay too, from the same extractor and the same
mapping, differing only in which catalog document it merges into (`defaultCatalog()`, not the
enriched one). That is why `kitExtract/extract.ts` knows about no catalog at all. `--no-kits` turns it
off and is the control in the table above.

### Verified against the bundle, not the checkout

The suite overrides the extractor path, so it never exercises `dist/`. Driven separately: the built
`dist/noodl-mcp.cjs` over real stdio against `cn001-kit-drive` resolved `dist/kit-extract.cjs` from
`__dirname`, and `get_project_info` reported the Cashflow Kit with all five type names,
`get_node_type` returned `nodegx.cashflow.Pill`'s full port list, and `list_node_types query=cashflow`
listed all five beside the built-ins.

### 🔴 A defect slice 2a shipped, found by building the caller

`entry.js` passed `process.argv[2]` to `path.join` untouched, and `require()` reads a
relative-looking path as a **module id**. A relative project directory therefore made every kit report
`Cannot find module …` while extraction itself reported success — the failure shape this phase keeps
meeting. Fixed with `path.resolve`, and the suite runs the extractor from a shell with a relative
path so it stays fixed.

### What is knowingly not done here

- **No cache of any kind.** The overlay is built once per server session, at bind. A kit edited
  mid-session is not re-read — recorded, and handed to **CN-014**, which owns the dev loop and where
  the preview watcher and the editor's node library go stale in the same way.
- **The lesson-vocabulary routing** (item 5 below) is slice 4 and untouched.
- `get_project_info` grew a `kits` field — modules, their node types, collisions, failures, and
  `unavailable`. **Omitted entirely** for a project with no `noodl_modules`. No tool was added, so the
  tool-surface budget is untouched.

## What to build

1. ✅ **The shared mapping** — done, `@nodegx/kit-catalog` (see above). Reuses CN-001's
   `scanModuleManifests` for the `runtimes` filter rather than adding a fourth scan.
2. ✅ **The headless extractor + MCP caller** — done, slices 2a and 2b (see above). Original text:
   runs the kit under the dom-shim, calls
   `generateNodeLibrary`, feeds `catalogNodesFromNodeLibrary`, merges into `CatalogIndex` as a
   **project-scoped overlay**. Built-ins keep priority on a name collision; the shadow is reported
   (`Overlay.collisions` already carries it) for CN-015 to surface.

   🔴 **Where this file lives is decided by packaging, not taste.** `scripts/` is outside every
   shipped package's `files`/`build.files` — the open F4 hole P67 recorded — so the extractor entry
   **cannot** live in `scripts/node-catalog/` the way `extractor-entry.js` does, or the packaged MCP
   server cannot reach it. And bundling at runtime is not available either: a packaged app has no
   esbuild and no `packages/noodl-viewer-react/src`. **The move is a second entry point in
   `packages/noodl-mcp/build.mjs`** emitting `dist/kit-extract.cjs`, which `files: ["bin","dist"]`
   already ships; the server then spawns it. Two lines of build config, no new mechanism.
   ⚠️ Verify against the **packaged** app, not the checkout — "driven ≠ shipped" has already bitten
   phase 66.
3. **The editor caller** — builds the same overlay from the node library the viewer already sent
   (`NodeLibrary.instance`), then `compareOverlays` against the MCP route in a test.
4. **`CatalogIndex` learns the difference** between "I know this type because we shipped it" and "I
   know this type because a kit declares it". `hasType()` should be true for both; provenance must
   remain queryable, because ✅ **D1** wants it in the property panel and CN-004 needs it for
   `--strict`.
5. **The lesson vocabulary takes the overlay too** (added 2026-08-15 — see README §4). `lessonverify.ts`
   builds a `LessonVocabulary` over `defaultCatalog()`, and its `unknown-node-type` is an **error**,
   so a lesson naming a kit node is refused at install under every provenance. ✅ **The seam already
   exists and needs no new plumbing**: `VerifyLessonOptions.vocabulary` is an injection point, and
   `LessonVocabulary`'s constructor takes `(catalog, index)` — so a caller with a project in hand
   passes a vocabulary built over the overlaid catalog. What this task owes is **routing the
   project-scoped catalog to the callers that have a project** (`learningfolder.ts`'s install,
   `lessonbundleverify.ts`, `lessongrading.ts`), not a change to the verifier.

## Acceptance criteria

1. `catalogIndex().hasType('nodegx.cashflow.Pill')` is **true** for the cashflow project and
   **false** for a project without the kit. The second half is the one that catches an overlay
   leaking across projects.
2. The port set returned matches what the editor's node library reports — asserted by the agreement
   check above, not by eye.
3. CN-002's `info` diagnostics for that project go to **zero**. This is the phase's cleanest
   before/after number.
4. `catalog:check` still passes. 🔴 That gate compares generated output **byte-for-byte** and the
   order of conditional assignments in `nodelibraryexport.ts` is load-bearing — an overlay must not
   perturb the built-in catalog at all.
5. `visualRoots.ts` stops falling back to `componentIsVisual()` for kit visual nodes.
6. No file is written to disk by extraction. Grep the diff for a cache path if unsure.

## Traps

- 🔴 **Executing project code is a side effect.** A kit's `index.js` can do anything at import time.
  Extraction must tolerate a throwing kit (CN-015 owns the reporting) and must not leave the
  register mutated for the next project. Test with two projects in one server session.
- ⚠️ **`hasType()` passing is not the same as the match succeeding.** The catalog already carries
  `a-display-name-can-be-a-real-but-deprecated-type-name` — 103 divergences where `hasType()` passes
  and the match still fails. Assert on the resolved entry, not on the boolean.
- ⚠️ **The MCP tool surface has a token budget, currently 8,280 with 57 tokens of slack** (P67 /
  UNI-010 spent LEG-001's previous 58 and the bar was renegotiated — CN-009 carries the table). This
  task adds no tools, but CN-009 and CN-006 both do, and they are competing for the same 57 — do not
  spend it here by accident.
- ⚠️ **A lesson bundle is graded before its project exists.** `verifyLessonManifest` runs at *install*,
  against a manifest and no project — that is deliberate (UNI-007 records it as "a boundary not a
  bug"). A lesson teaching a kit node therefore needs the overlay built from **the bundle's own
  project files**, not from the currently-open project, or the check answers about the wrong kit.

## Out of scope

- Turning the checks back on (CN-004).
- Library-content discovery — ✅ **D7** leaves "the shelf" to P65's rescoped LBR-008. This task is
  "this project", exact and complete.
