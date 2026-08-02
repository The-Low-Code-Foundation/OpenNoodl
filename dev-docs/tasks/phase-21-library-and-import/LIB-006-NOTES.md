# LIB-006 — build notes

**Built:** 2026-08-02, on branch `wt-lib-006` from `32e3a946`.
**Spec:** [LIB-006-LEGACY-IMPORT-ASSIST.md](./LIB-006-LEGACY-IMPORT-ASSIST.md) (2026-07-30)
**Scope boundary:** [LIB-006-LEGACY-CONSTRUCT-INVENTORY.md](./LIB-006-LEGACY-CONSTRUCT-INVENTORY.md), committed first

---

## The finding that should have changed the spec

**The legacy node surface almost entirely survives, and the spec was written as if it did not.**

- PLAT-003 kept every deprecated node *registered* rather than deleting it: 30 of the catalog's 153
  types are `isDeprecated`, all 30 still run.
- Git history over the node directories shows **no legacy Noodl node type was ever deleted** during
  the revival. Every `--diff-filter=D` hit is a `.js`→`.ts` rename of the same node.
- The only types that resolve nowhere are the five `noodl.byob.*` nodes — and those are *pre-BCN-004
  NodeGX*, not Noodl 2.x.
- Corpus check: across the 60 complete legacy projects in this repo, 136 distinct type strings
  resolve except three, and all three are module-provided.

So a Noodl 2.x graph imports as `converted` almost in full. The real unconvertible surface is
**modules, backend configuration and user JavaScript**, which is where the inventory now points. The
machinery the spec asked for is still right; what it fires on is not what the spec expected.

This has a consequence worth carrying forward: **LIB-006's placeholder path will fire more often on
projects made in early NodeGX than on projects made in Noodl.** If the deprecated-node removal that
`COMPATIBILITY-POLICY.md` reopened ever happens, this task's table gains 30 rows overnight and the
placeholder path becomes the common case.

---

## Deviations from the spec

### 1. There is no placeholder *node type*. The placeholder is the node itself.

The spec asks for "a runtime node type that renders as a visible unconverted marker, carries
`originalType` + original parameters". I did not build one. An unconverted node is left **exactly as
authored** — original type, parameters, wiring — and gains a `metadata.legacyImport` marker.

Four reasons, and the second is decisive:

1. Rewriting the node destroys the fact a repair needs most: what it was.
2. **It breaks the module case.** An unresolved type whose module arrives later resolves on its own;
   a node rewritten into a placeholder never does. 47 `Avatar` nodes in this repo's own corpus are
   exactly this case.
3. Phase 21's README excludes new runtime node types outright ("No new node types in the runtime").
4. **Half of it already existed.** The editor already substitutes `UnknownNodeType`
   (`models/nodelibrary/UnknownNodeType.ts`) and raises a `node-missing-type` warning at **error**
   level via `NodeGraphNode.evaluateHealth`. "Visible on the canvas, carrying its original type and
   parameters" was already true before this task. The missing half was the validator, which is what
   I built.

### 2. A new validator rule, rather than promoting `unknown-node-type`.

`unknown-node-type` is a `warning` by default and should stay one — a module-provided node
legitimately fails to resolve, and erroring cries wolf. But `legacy-import-placeholder` makes a
different, stronger claim: *the importer looked at this and could not convert it*, recorded at import
time with a report entry saying why. That earns `error`, unconditionally, with no `strict` escape.
Keeping them separate lets each keep the severity it deserves. `unknown-node-type` now defers on
marked nodes so one node never draws both.

This needed `NormNode.metadata`, carried by both `normalize.ts` paths. It is the only change to the
validator's model.

### 3. Deprecated types are reported, never rewritten.

The spec's step 5 says "take the mechanical conversions the inventory says are cheap". The inventory
says exactly one is: `REST2` → `net.noodl.HTTP`, gated on the request/response scripts being empty.
The other 29 deprecated→replacement pairs are **not** taken, because the source node still runs and
the replacement's ports differ in most pairs — rewriting a working node is a behaviour change nobody
asked for. The report recommends; the assistant, with a human at the diff, rewrites.

### 4. The REST conversion retypes the node and moves no parameters.

`resource` is not `url`. Carrying the value across would put it on a port that means something
similar but not identical, silently. The node arrives with its URL unset and the report says the port
was renamed. An empty port announces itself; a wrong one does not.

### 5. `nodeIdMap` is declared in the schema and never populated.

`applyModelChanges` re-keys every node id it grafts, so a finding's `location.nodeId` addresses the
*source* project and nothing in the target. The field is there for a future that captures the map;
today the node→report direction works through the marker's `findingId`, and the report→node direction
through component name + node label, which survives re-keying. Documented on the type.

### 6. A sixth finding field, `benign`, that the spec did not ask for.

`thumbnailURI` is genuinely `dropped` by the taxonomy's test and must stay in the report — hiding it
would be the silent drop this task removes. But the launcher regenerates it, so listing it to an
assistant under "these are rebuilds, not repairs" is false. `benign` keeps such findings in the
report and the counts, and out of the hand-off's action lists. Found by reading the generated fixture
report, not by reasoning.

---

## What was built

| Commit | What |
|---|---|
| `6396505a` | The legacy construct inventory — the scope boundary, committed before any code |
| `0356ba30` | The outcome taxonomy, the import report, the rebuild verdict (pure cores) |
| `7287541f` | The placeholder marker and the `legacy-import-placeholder` validator rule |
| `2d88749c` | The assessment wired into `apply()`, and surfaced on the result screen |
| `3341e322` | The assistant hand-off: `ContextBuilder.importReport()` + MCP `get_import_report` |
| `3f6db77e` | The acceptance fixtures and their committed reports |
| `ab2401c4` | Prettier pass |

**Layering** mirrors LIB-004's, deliberately:

```
assess()               pure    ProjectData + catalog        → findings
applyLegacyTransforms() pure   report + live source         → markers + the REST retype
buildReport()          pure    findings                     → the one report object
renderReportMarkdown() pure    that object                  → the human rendering
renderReportForAssistant() pure  that object                → the agent rendering
computeVerdict()       pure    counts + size                → proceed / repair / rebuild
assessImport()         shell   catalog + React pattern set
writeImportReport()    shell   the filesystem
```

Everything pure is in `tests-unit/`, which runs under plain jest with no Electron.

**Two design points worth keeping:**

- *"Nothing was silently dropped" is arithmetic.* `coverage.constructsAssessed` equals the sum of the
  four counts, by construction, with aggregated findings weighted by `occurrences`. A test asserts
  the identity. The alternative — a promise in prose — is not checkable.
- *One schema, three renderings, no second source.* The Markdown, the agent briefing and the
  one-line UI summary are all projections of the same `ImportReport`. That was the task's third risk
  and the mitigation had to be structural.

---

## Ran and passed

- `npx jest tests-unit/lib-006` in `packages/noodl-editor` — **86 tests, 5 suites, green.**
  Covers the assessment, the report, the verdict, the transforms, the validator rule, and both
  fixtures end to end against the real bundled catalog.
- `npx tsc -p packages/noodl-editor --noEmit` — **clean** (`npm run typecheck:editor`).
- `npx tsc -p packages/noodl-editor/tsconfig.tests.json --noEmit` — **clean**
  (`npm run typecheck:editor-tests`).
- `npx tsc -p packages/noodl-mcp --noEmit` — back to its **single pre-existing** error
  (`validation/rules/duplicateNodeId.ts:86`), measured against `HEAD` by reverting my two files.

## Could not verify — did not run

Stated separately from the above on purpose.

- **The editor's jasmine suite** (`npm run test:ci` in `packages/noodl-editor`). Needs Electron, and
  a concurrent session holds the single-instance lock and port 9222. **I wrote no jasmine specs** —
  everything testable was written for `tests-unit/` instead, which is why the count above is real.
  There are existing jasmine specs the orchestrator should watch at merge:
  `tests/import-engine/*`, `tests/project/projectimport*.js`, `tests/ai/project-docs.test.ts` and
  `tests/ai/project-scoping.test.ts` (the last two construct `AuthoringContextBuilder` positionally,
  and I appended a 7th parameter — additive, so they should be unaffected, but they are the specs
  most likely to notice).
- **The editor itself.** Never launched. The result-screen banner, the Problems-panel entry for a
  placeholder, and the canvas rendering of a marked node are **unseen**. The rendering path is the
  pre-existing `UnknownNodeType` one, so it is not new code — but "not new code" is not the same as
  "observed".
- **A live agent repairing a construct.** Success criterion 4 asks for a demonstration, not an
  assertion, and I cannot honestly claim one. The hand-off is *wired* — `ContextBuilder.importReport()`
  charges a rendering into the opening turn, the MCP `get_import_report` tool returns it, both are
  unit tested — but no model was called. Note also that a previous session recorded the Anthropic key
  as out of credit. **This is the one success criterion left open.**
- **`npm run test:packages`** (which includes `@noodl/mcp`). Not run; it builds several packages and
  the MCP tool is new. Worth running at merge.
- **An actual import through `apply()`.** Every unit is tested with fakes; the composed
  `apply()` path — assess, transform, graft, write — has never executed against a real
  `ProjectModel`. This is the largest untested seam in the task.

## Pre-existing problems found, not fixed

- **`packages/noodl-editor/tsconfig.tests-main.json` reports 364 errors** and is in no
  `typecheck:*` script, so nothing gates it. Verified identical at `HEAD` — I added zero. ts-jest
  transpiles happily regardless, which is why nobody has noticed.
- **`tsc --noEmit` at the repo root reports 56 `Cannot find module '@noodl-versioning'` errors.**
  Pre-existing path-alias gap; none of them are in files this task touched.
- **`deviceSettings` and `thumbnailURI` are silently dropped on every load/save today.** Both the
  read (`projectmodel.ts:151,155`) and the write (`:1350,1356`) are commented out. Found by reading
  `toJSON()` against the constructor. LIB-006 now *reports* the loss; nothing restores it, and
  nothing should until someone wants the field.

## Belongs to another task

- **The 30 deprecated nodes are still registered.** `COMPATIBILITY-POLICY.md` reopened this
  ("PLAT-003 … Deletion is on the table") and NDA-011 is named as the owner. LIB-006 deliberately
  does not act on it — but if it happens, this task's inventory needs 30 new `placeholder` rows and
  the `REMOVED_TYPES` table needs 30 new entries. **Whoever does it should update
  `LIB-006-LEGACY-CONSTRUCT-INVENTORY.md` in the same commit.**
- **`validation/rules/duplicateNodeId.ts:86`** — a real `Object is possibly 'undefined'` that only
  the MCP package's stricter tsconfig sees. One-line fix, not mine to make here.
- **`ImportFlow` has no "open the import report" affordance.** The result screen names the files;
  clicking through to them would be an LIB-005 UX addition.
