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

## What to build

1. **A shared extractor** — a no-build workspace package on the `@nodegx/render-measure` pattern
   (plain JS, hand-written `.d.ts`, `main` at `src/index.js`, resolved **through the workspace**,
   never a relative path into `packages/`). It takes a project directory and returns catalog-shaped
   node entries for every kit it finds. It reuses CN-001's module scan rather than adding a fourth
   one.
2. **The MCP caller** — runs the extractor under the dom-shim, merges the result into `CatalogIndex`
   as a **project-scoped overlay**. Built-ins keep priority on a name collision; a kit shadowing a
   built-in type name is a diagnostic, not a silent override (see CN-015).
3. **The editor caller** — builds the same overlay from the node library the viewer already sent.
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
