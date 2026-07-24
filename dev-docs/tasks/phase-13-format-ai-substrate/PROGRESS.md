# Phase 13: Format & AI Substrate — Progress Tracker

**Created:** 2026-07-22 (from [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md), Track A)
**Last Updated:** 2026-07-24
**Overall Status:** 🟢 Complete (SUB-001..SUB-008; Gate G1 passed)

---

## Quick Summary

| Metric       | Value  |
| ------------ | ------ |
| Total Tasks  | 8      |
| Completed    | 8      |
| In Progress  | 0      |
| Not Started  | 0      |
| **Progress** | **100%** |

---

## Foundation (already done, outside this phase)

STRUCT-001..004 from Phase 10A are **complete** (Feb 2026 sprint) and are this phase's
foundation:

| Task | Name | Where it lives |
|------------|--------------------------|-------------------------------------------------------|
| STRUCT-001 | JSON Schema Definition | `packages/noodl-editor/src/editor/src/schemas/` (8 schemas + Ajv validator) |
| STRUCT-002 | Export Engine Core | `src/editor/src/io/ProjectExporter.ts` (pure, no fs) |
| STRUCT-003 | Import Engine Core | `src/editor/src/io/ProjectImporter.ts` (pure, no fs) |
| STRUCT-004 | Editor Format Detection | `src/editor/src/io/ProjectFormatDetector.ts` |

~149 tests in `packages/noodl-editor/tests/io/` (68 Exporter, 55 Importer incl. ~18
round-trip, 26 Detector; none skipped). Caveat: these classes have **zero application
call sites** — they are exercised only from tests. Making them real is SUB-001's job.

---

## Task Status

| Task | Name | Est. | Status |
|---------|--------------------------------|--------|----------------|
| SUB-001 | Editor v2 Integration (STRUCT-005/006) | 3-4 wks | 🟢 Complete |
| SUB-002 | Round-Trip Fidelity | 1-2 wks | 🟢 Complete |
| SUB-003 | Migration Wizard & Real-Project Tests (STRUCT-007/008) | 3-4 wks | 🟢 Complete (engine + STRUCT-008; wizard UI deferred) |
| SUB-004 | Node Catalog Generator | 1-2 wks | 🟢 Complete |
| SUB-005 | Catalog Enrichment | 3-4 wks | 🟢 Complete (comparative LLM acceptance test passed — docs/node-catalog/ACCEPTANCE.md) |
| SUB-006 | Semantic Validator | 2-3 wks | 🟢 Complete |
| SUB-007 | Graph-Native Git | 4-6 wks | 🟢 Complete (2026-07-24 — engine + diff UI + conflict UI + v2 merge driver; `projectmerger.js` deleted with parity proven against recorded goldens. Open: diff UI not yet human-reviewed on a large realistic change; structural conflicts are review-only by design — SUB-007-DESIGN.md §6–§8) |
| SUB-008 | Noodl MCP Server | 3-4 wks | 🟢 Complete (Gate G1 passed — see g1/GATE-G1-DEMONSTRATION.md) |

### Optional spikes (not counted in the 8-task total / percentage above)

| Task | Name | Est. | Status |
|---------|--------------------------------|--------|----------------|
| SUB-009 | Live-Preview Harness | 3-5 days | 🟢 Complete (`packages/noodl-preview`, `npm run preview -- <dir>`) |
| SUB-010 | External Authoring Demo (Claude + MCP → live preview → editor hand-off) | 4-7 days | 🟢 Complete — **verdict: GO** ([demo/ASSESSMENT.md](./demo/ASSESSMENT.md); video take not recorded, run repeatable from demo/SETUP.md) |

---

## Gate G1 (phase exit)

- [x] An external AI agent, via MCP + catalog, authors a valid new page into a real
      project without ingesting the whole project, and the semantic validator + editor
      both accept it. **Passed 2026-07-23** on the 176-component `big-merge-test-mine`
      corpus project: recorded run in [`g1/GATE-G1-DEMONSTRATION.md`](./g1/GATE-G1-DEMONSTRATION.md)
      (+ raw call transcript `g1/transcript.jsonl`).

---

## Change Log

- **2026-07-23** — **SUB-010 complete (optional spike) — verdict: GO on SUB-008 hardening + AIX-002.**
  The full external-authoring loop ran end to end against a **real production app**
  ("Shine Phase 2", `git-repo-utf8`: 44 components / 688 nodes, exported to v2):
  a genuinely external agent (headless Claude Code, empty cwd, **no filesystem
  tools**, only the `nodegx` MCP server) added a Home page and rewired the app
  router — **both writes accepted first try, 15 turns, 102 s, $1.98** — while the
  SUB-009 preview flipped live from the app's 404 to the new page (rebuilds
  measured 200–250 ms), and the same directory then opened in the editor with the
  agent's page as an ordinary editable graph; two manual edits saved cleanly and
  re-validated at baseline. **Context budget proven, not asserted:** 14 tool
  calls, **63 KB of tool results total**, 6 of 44 components read; full per-call
  log kept. Record: [`demo/ASSESSMENT.md`](./demo/ASSESSMENT.md) (go/no-go +
  frictions), [`demo/SETUP.md`](./demo/SETUP.md) (reproducible recipe),
  `demo/shots/`, `demo/context-log.jsonl`, `demo/agent-final-report.md`.
  **Product bug found & fixed same-day:** v2's optional `parameters` crashed the
  editor's v2 open path (`applyPatches` dereferences it before `NodeGraphNode`
  defaults it) → "Could not load project" for *every* MCP-authored component;
  fixed in `ProjectImporter.unflattenNodes` (restore the legacy `parameters: {}`
  invariant; exporter already omits empty on write so round-trip stays stable),
  regression-tested, editor suite **896 specs, 0 failures**. **Second finding,
  characterized:** the editor's *first* save of an externally-exported project is
  a one-time ~all-files normalization (v3→v4 upgrade + save-path enrichments:
  `visualRoots`, materialized dynamicports, merge metadata); subsequent saves are
  surgical (verified: second edit touched 1 component + registry). Frictions
  routed to SUB-008: `get_node_type` (7 types) returned ~126 KB and blew the MCP
  host's tool-result cap — needs a compact/ports-only mode; also noted: v2 open
  is still behind the default-off `nodegx.formatV2` flag, and the editor viewer
  vs deploy runtime render the "Button Primary" variant differently. Video take
  not recorded (headless run); the demo is scripted and repeatable from SETUP.md.
- **2026-07-23** — **SUB-009 complete (optional spike).** New package
  **`packages/noodl-preview`** (`@noodl/preview`): `npm run preview -- <dir>`
  renders a project in a plain browser with **no editor process** and reloads it
  when the files on disk change — the "see it" half of the AI-authoring loop that
  SUB-008 opened. Fills the gap the spec named: there is no file watcher anywhere
  in the codebase, and the editor's live preview is driven by its in-memory model
  over a WebSocket, so nothing an external writer puts on disk was ever visible.
  **The spec's assumed pipeline does not compose** — `loadV2Project.loadProject`
  returns the validator's *normalized* model (no parameters, unrenderable), and
  `Exporter.exportToJSON` needs a full `ProjectModel` + populated `NodeLibrary`.
  That risk row ("export/runtime coupling needs editor-only bits") was settled
  first with a throwaway esbuild probe, which proved `ProjectModel` +
  `NodeLibrary` + `utils/exporter` + `HtmlProcessor` all run in plain Node behind
  four shims: `@noodl/platform-node` bound before any editor import (module-scope
  `getUserDataPath()` reads), a `bugtracker` stub (it hijacks `console.log` and
  writes a logfile at import), the node-catalog generator's `dom-shim.js`, and
  `NodeLibrary` fed from `NoodlRuntime.getNodeLibrary()` — the same node-library
  JSON the editor receives over the WebSocket, produced in-process. Real pipeline:
  **v2 dir → `ProjectImporter` → legacy object → SUB-006 gate → `ProjectModel` →
  `Exporter` → serve.** "Zero new runtime code" holds and then some: the served
  page is the real deploy template calling `renderDeployed`, exported with
  `useBundles`/`useBundleHashes` on, so `/noodl_bundles/<id>.json` matches what
  `deployToFolder` writes; project assets are served from the project folder.
  **The validation gate is the design point** — errors keep the *last good build*
  installed and push diagnostics to an injected SSE client that overlays them on
  the still-rendered page, so an agent's mid-edit state reads as "not finished"
  rather than "broken"; warnings never block. Chokidar watch + debounce (one
  rebuild per burst), `.git`/temp/backup paths ignored, read-only throughout
  (safe alongside an open editor; port 8575 vs the viewer's 8574). **Two finds:**
  projects authored from outside frequently carry no `rootNodeId` (the MCP
  fixture does not) and `exportToJSON` silently returns nothing without a root —
  now falls back to the editor's own `allowAsExportRoot` predicate and reports the
  guess; and a bogus *parameter* is not a SUB-006 diagnostic (its port rules key
  on connections), so the gate is exercised with a dangling connection.
  **Verified in headless Chrome with the editor closed:** standalone render,
  live edit visible inside 1s (rebuilds 3–10 ms), dangling connection → overlay
  over the previous render, recovery on fix. The real 176-component corpus
  project loads/validates/exports in 733 ms but does not paint — its own bundled
  module `se-topp-fovea` does `Noodl.Collection.apply(this, arguments)` against
  today's `class Collection extends Array`; a pre-existing module/runtime
  incompatibility a real `deployToFolder` deploy hits identically, surfaced here
  because the whole path (module injection → asset serving → runtime setup) ran.
  **14/14 specs**, driving the *built*
  CLI over HTTP rather than the TS sources — the risk here is the bundle, which
  source-level tests would not touch. Option B (incremental hot-update via the
  8574 protocol) deliberately not built; noted as the upgrade path for SUB-010 to
  judge. Prerequisite: `packages/noodl-editor/src/external/deploy/` is a
  gitignored build artifact — absent, the CLI fails with `npm run build:editor:_viewer`.
- **2026-07-23** — **SUB-008 complete; Gate G1 passed.** New standalone package
  **`packages/noodl-mcp`** (`@noodl/mcp`): an MCP server over v2 project
  directories with a 14-tool surface — read (`get_project_info`,
  `list_components`, `get_component` w/ revision tokens, `search_project`,
  `explain_component`), catalog slices of the enriched catalog
  (`list_node_types` compact rows, `get_node_type` full port semantics +
  example ids, `list_examples`/`get_example`), validation
  (`validate_component`/`validate_project`), and **opt-in** authoring
  (`create_component`, `update_component` with full-`set` or batched
  `operations` deltas, `delete_component` with usage refusal). Surface was
  designed against a hand-written agent transcript first
  (`packages/noodl-mcp/docs/DESIGN.md`). **Write policy:** Ajv structural check
  → SUB-006 semantic validation (unknown types promoted to error;
  `allow_unknown_types` escape hatch) → *baseline diff* so pre-existing errors
  never block edits ("don't make it worse"); rejections return diagnostics with
  suggestions/alternatives and write nothing. **Concurrency:** optimistic —
  content-hash revisions + `if_revision`, on-disk drift re-stat before write,
  temp-file + atomic rename; deletes never touch nested component dirs.
  **Code sharing:** io/schemas/validation engines imported from noodl-editor's
  pure modules and esbuild-bundled into a self-contained `dist/noodl-mcp.cjs`
  (Node ≥18 only) — zero duplication; only editor change is exporting
  `normalizeV2Component`. 31 Jest tests (incl. end-to-end over a real MCP
  client/server pair and an editor-import round-trip proxy), stdio smoke test,
  README with tool reference + example session, example client
  (`examples/call-tool.mjs`). **Gate G1:** an external agent, MCP-only, added a
  convention-faithful About page (accepted first try, 0 diagnostics) to the
  real 176-component corpus app and navigation wiring to it, reading only 1
  page + 5 explains + 4 catalog entries — recorded in
  `g1/GATE-G1-DEMONSTRATION.md`. The run surfaced one real bug (updates to
  id-less legacy-exported components rejected with internal schema errors) —
  fixed same day (`backfillIds` + regression test) and the agent's exact
  blocked payload replayed successfully. Deferred: project-settings/styles
  writes, asset/model tools, live editor bridge (Phase 15 / SUB-009 territory).
- **2026-07-23** — **Added two optional de-risking spikes: SUB-009 (Live-Preview
  Harness) and SUB-010 (External Authoring Demo).** Not part of the 8-task substrate
  spine; not counted in the percentage. They test the "Noodl as an extension of your
  existing agent — Claude Desktop / Code writes via MCP, you watch it live, then hand
  off to the visual editor" experience cheaply, before committing to full SUB-008
  (3-4 wks) + Phase-15 AIX-002 (4-6 wks). SUB-009 fills the real "no file watcher"
  gap (live preview is editor-only, driven by in-memory `ProjectModel` over WS — the
  runtime's `renderDeployed` entry makes a standalone watched preview a composition,
  not new runtime code). SUB-010 is G1 plus the two dimensions G1 omits: live-visual
  and lossless editor hand-off; its output is a recorded demo + an honest go/no-go
  `ASSESSMENT.md` feeding SUB-008's tool surface.
- **2026-07-23 (later)** — **SUB-005 acceptance test run and passed.** Two blind
  agents authored the same feature (task list + create + empty state), one from
  the structural catalog alone, one from the enriched catalog + patterns. Both
  validate clean — but the structural arm shipped a **silently dead wire**
  (`created → fetch`; the real Query Records input is `storageFetch`, invisible
  to the validator on a dynamic node) plus a redundant re-fetch, and used
  non-canonical item binding; the enriched arm matched the corpus patterns on
  every checklist point and cited the enrichment's anti-pattern note as the
  reason it omitted the re-fetch. Full scoring table + raw outputs:
  `docs/node-catalog/ACCEPTANCE.md`, `docs/node-catalog/acceptance/`. SUB-005 is
  now fully complete.
- **2026-07-23** — **SUB-005 complete** (one open item at the time, closed the
  same day — see entry above). The structural catalog is now a semantic
  one. **Authored corpus** under `docs/node-catalog/`: `enrichment/` — one JSON
  per node type, **135/135 covered** (summary, description, whenToUse, port
  semantics, runtimeBehavior required exactly when the node has dynamic ports;
  deprecated/hidden types get minimal do-not-use entries naming the successor);
  `examples/` — **40 real v2 graph fragments**, every one validated **error- and
  warning-free in strict mode** by SUB-006's validator via the new
  `npm run catalog:examples` gate (`scripts/validate-examples.ts`, `--dir` flag
  for scoring arbitrary candidate graphs); `compatibility.json` — the connection
  rules as the editor actually enforces them (`canCastPortTypes`: same-type ∨
  `*` ∨ runtime-exported typecast table) with the *meaning* of all 23 casts,
  signal edge semantics read from `Node.prototype.sendSignalOnOutput`
  (true-then-false pulse, per-update suppression), and 25 permitted/rejected
  pairs asserted against the rule implementation on every merge; `patterns.md` —
  mined from the 17-project corpus with occurrence counts (nested-Group layout
  713×, String Format→Text 43×, conditional UI via `mounted` not `visible` 20×+,
  Expression-chain anti-pattern 13×). **Merge tooling**: `scripts/node-catalog/`
  `merge.js` combines generated + authored into
  `packages/noodl-types/src/node-catalog-enriched.json` (+`.d.ts`),
  deterministically; `npm run catalog:merge:check` (wired into the CI
  `node-catalog` job) fails on staleness AND on any undocumented node
  (`--require-coverage`), so new nodes cannot ship without semantics. Regenerating
  the structural catalog never touches the authored corpus — separate files,
  merged at build time. Entry-level validation is strict: unknown typeName,
  bad port note on a static node, runtimeBehavior on the wrong side of the
  dynamic split, unknown example/relatedNodes refs are all merge errors.
  Authoring notes: the 10-node pilot (Condition, Group, Text, Button control,
  Query Records, Send Event, Navigate, Function, Expression, Repeater) fixed the
  voice before scaling; source-reading surfaced real corrections (text input's
  string output is `onTextChanged`, not `text`; Variable2's `fetch` connection
  *disables* auto-propagation; Set Variable force-fires `changed` on identical
  values; "Screen Resolution" reports the viewport).
- **2026-07-23** — **SUB-006 complete.** The semantic validator exists: a
  framework-agnostic rule engine in
  **`packages/noodl-editor/src/editor/src/validation/`** that checks a project
  against the SUB-004 catalog and emits actionable diagnostics. Six independently
  toggleable rules (`unknown-node-type`, `nonexistent-port`,
  `dangling-connection`, `unresolved-component-ref`, `orphaned-node`,
  `type-incompatible-connection`), each in its own file, over a normalized model
  fed by two adapters (`fromLegacyProject` for the editor's in-memory model,
  `loadV2Directory` for a v2 decomposed dir on disk — both produce identical
  results). Diagnostics are **data** (`diagnostics.ts`): severity + code +
  precise location (component/node/port) + message + `suggestion` + `alternatives`,
  formatted at the edge (human / JSON). **The dynamic-port problem is handled as
  the crux:** any node carrying `dynamicPorts` skips unknown-port erroring
  (runtime/numbered/component/adapter ports are unknowable), while fully-static
  nodes still error — the exact behaviour the SUB-004 corpus preview proved
  clean. Design calls that matter: **unknown node type is a `warning`, not an
  error** (real projects legitimately use module/other-version nodes the catalog
  can't enumerate; `--strict` promotes to error for greenfield/CI), so the whole
  real-project corpus validates with **zero errors**. Edit-distance suggestions
  are length-scaled (`Butonn`→`Button`, `REST`→`REST2`; correctly *no* suggestion
  for `On Item Action`/`module.inlineHtml`). Ships as: a **library** (editor +
  MCP), a **CLI** (`scripts/validate-project.ts`, `npm run validate:project`,
  human + `--json`, correct exit codes, `--strict`/`--only`/`--disable`), and an
  **editor Problems panel** (`views/panels/ProblemsPanel/`) driven by
  `ProjectValidationService` (re-validates on graph/project changes) with
  click-to-navigate to the offending node. **56 tests** in
  `tests/validation/` — dynamic-port false-positive guards (written first), per-rule
  units, a diagnostics/AI-fixability contract, the v2-dir loader, and the
  **false-positive corpus suite** (git-repo-utf8, big-merge 2933 nodes, all
  testfs projects, synthetic-awkward → zero errors). Uses the catalog's existing
  `typecasts` for the type rule; SUB-005 (enrichment) can sharpen it later.

- **2026-07-23** — **SUB-004 complete.** The node catalog exists: a generator
  (`scripts/node-catalog/`, `npm run catalog:generate`) loads the real node
  registries headlessly — `noodl-runtime` + `noodl-viewer-react` as the browser
  runtime and `noodl-runtime` + `noodl-viewer-cloud` as the cloud runtime, via
  an esbuild bundle with a small DOM/`Noodl`-global shim — and serialises them
  into **`packages/noodl-types/src/node-catalog.json`** (135 node types, every
  port/type/default/enum) plus generated **`node-catalog.d.ts`** (NodeTypeName /
  PortTypeName unions and catalog interfaces; in root typecheck scope). Design
  choices that matter downstream: extraction is from the **live register**
  (never source parsing); output is **byte-deterministic** (double-run assert,
  sorted nodes/ports, no timestamps); **dynamic ports are modelled as a
  first-class concept** — 89 of 135 types carry a `dynamicPorts` object with
  mechanisms (`declared-port-groups` incl. serialized conditional groups and a
  condition-grammar note, `numbered-inputs`, `component-ports`,
  `runtime-discovered`, `editor-adapter`) and curated per-node descriptions, so
  a validator knows exactly when an unknown port name is legal; `availableIn`
  browser/cloud split; `isVisual`; `inNodePicker` distinguishes the 26
  registered-but-superseded/specialised types (legacy `Button` vs
  `net.noodl.controls.button` etc.); typecasts table lifted from the runtime's
  own `nodelibraryexport`. **Gates:** `npm run catalog:check` regenerates and
  diffs in CI (new `node-catalog` job in pr.yml). **Validation:** round-trip
  sanity over the real-project corpus resolves ~5,000 connection endpoints with
  zero false errors (only genuinely-removed legacy types like `Rectangle`,
  `Markdown`, `REST` fail, correctly); the **LLM acceptance test passed** — an
  agent given only the catalog + `docs/node-catalog/SCHEMA.md` + v2 schemas +
  one example component authored a working ClickCounter component with every
  node type, port name and typecast justified from the catalog (verified
  independently against Ajv + the catalog); its reported friction points were
  folded back into the schema (`inNodePicker`, precedence rules, condition
  grammar). `esbuild` added as an explicit root devDependency (was only
  transitive via Storybook). Field-by-field docs: `docs/node-catalog/SCHEMA.md`.
  Diagnostic: `npm run catalog:validate <project>` previews SUB-006.
- **2026-07-23** — **SUB-003 complete (engine + validation suite; wizard UI deferred).**
  Shipped the safety-critical half of SUB-003: a **`ProjectMigrator`** engine
  (`services/ProjectStructure/ProjectMigrator.ts`) that converts a legacy
  monolithic project to v2 **safely and reversibly**, plus the STRUCT-008
  validation suite. The engine's single invariant — *the original project is never
  damaged* — is upheld by strict ordering: **(1) backup first** (whole-dir copy to
  a sibling `*.nodegx-backup`, aborts if it can't be made), **(2) write v2 to all
  new paths** leaving legacy `project.json` untouched, **(3) verify** by reading
  the written files back, importing, and deep-comparing against the pre-migration
  in-memory project (SUB-002's round-trip machinery promoted to production —
  `stripEmpty`/`canonicalEqual`/`firstDifference` now live in the migrator module),
  **(4) commit last** by removing `project.json` only after verify passes. Because
  the legacy file dies only at step 4, a process kill at any earlier point leaves a
  fully-intact legacy project on disk; the orchestrated failure path additionally
  rolls the directory back to the backup. Injectable fs/exporter/importer make the
  whole machinery unit-testable and let the suite inject a lossy converter to prove
  verification aborts. **Pre-flight `analyze()`** reports component/node/connection
  counts and flags the delicate cases (dynamic ports, non-array routes, lessons,
  ≥200-component scale) without writing. Wired as an app-wide `projectMigrator` and
  a `ProjectModel.canOfferMigration()/analyzeMigration()/migrateToV2()` seam (the
  hooks the future wizard UI drives). **New suite: `tests/structure/` (24 specs)** —
  migrates & self-verifies all 7 SUB-002 corpus projects (incl. big-merge 176-comp
  scale), a synthetic cloud-component (`__cloud__/` path mapping), injected-fault
  abort+rollback, truncated/malformed inputs failing cleanly, interrupted-mid-write
  auto-rollback, hard-kill leaving the legacy file intact, and idempotent skip on
  already-v2. Full editor typecheck clean (0 errors). **Deferred (own scope):** the
  React `MigrationWizard` panel — the engine exposes everything it needs. User docs
  at `docs/format/MIGRATING-TO-V2.md`.
- **2026-07-23** — **SUB-001 complete.** The v2 decomposed format is now wired into
  the editor's real save/load path (previously zero application call sites). New
  `services/ProjectStructure/`: **`ComponentLoader`** (STRUCT-005 — per-component
  lazy load, TTL/LRU cache, `preloadComponents`, `invalidate`), **`ComponentSaver`**
  (STRUCT-006 — two-phase atomic per-component write, incremental+atomic registry,
  content-hash change detection), and a **`ProjectStructureService`** orchestrating
  `loadProject`/`saveProject`. Wired behind the format detector + a feature flag
  (`formatV2.enabled`, default OFF; env/localStorage kill-switches) at the two seams:
  `projectFromDirectory` (read) and `ProjectModel.toDirectory` (write); legacy path
  byte-for-byte unchanged when the flag is off or the project is v1.
  **Design decision (collab-forward):** rather than STRUCT-005's literal "load only the
  active component" — which fights every whole-project consumer and is the wrong target
  for live collaboration — the whole project stays materialised, but the *component* is
  the atomic unit of load/save/**invalidate**. A save rewrites only components whose
  content actually changed (hash diff, excluding volatile timestamps), so one edit = that
  component's 3 files + registry. The saver's `diskHashes` map doubles as the collab
  echo-guard, and `ProjectModel.reloadComponentFromDisk` / `service.reloadComponent`
  ship as the surgical single-component reload seam for future file-watch / SSE sync.
  Crash-safety: staged temp writes then rename; a mid-save failure rolls back baselines so
  a retry redoes the whole change set (no orphaned-from-registry component). io engines
  refactored to expose pure per-component build/reconstruct helpers (behaviour-preserving).
  New suite: **25 ProjectStructure specs** (loader cache/TTL/eviction, saver atomicity/
  interrupted-write/rollback, round-trip, deletion, reload); combined io+schemas+new run
  **270 specs, 0 failures**. Follow-ups: true on-demand loading (needs consumer audit),
  and wiring `reloadComponentFromDisk` to a file watcher (SUB-007 / collab).
- **2026-07-23** — **SUB-002 complete.** Field audit ([NOTES.md](./NOTES.md)) found the
  four named gaps (`rootNodeId`, `lesson`, graph `comments`, `visualRoots`) **plus four
  more** the synthetic-only fixtures hid: project `id` and `thumbnailURI` dropped, legacy
  `metadata.styles.text` silently dropped (exporter read a non-existent `textStyles` key),
  variant `conflicts` dropped, and non-array `routes` lost. All carried now, with schema +
  type additions. New whole-object round-trip suite runs over six real projects
  (import_proj1/2/5, watchproject, git-repo-utf8 44-comp, big-merge 176-comp) + one
  synthetic-awkward fixture; a data-driven schema-drift guard fails if a real-project field
  has no schema home. Full editor harness: **741 specs, 0 failures.** SUB-001 gate is clear.
- **2026-07-22** — Phase created from the revival roadmap (Track A, tasks A-01..A-08
  mapped to SUB-001..008). All tasks Not Started.
