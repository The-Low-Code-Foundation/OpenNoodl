# Phase 21: Library & Import Overhaul

**Phase:** 21
**Created:** 2026-07-25, from a code-level investigation of the prefab/module library and the import pipeline
**Status:** 🟡 In progress — 6 tasks (LIB-006 added 2026-07-30). See [`PROGRESS.md`](./PROGRESS.md), which is authoritative; this line is not.
**Shape:** Two sprints, ~2–3 weeks each

## What this phase is

The prefab and module libraries are genuinely useful and genuinely embarrassing: the prefabs are buggy and visually dated, the modules are thin, and the pipeline that delivers both — plus "import from project" — is a 2019-era engine with real defects. This phase makes the library trustworthy and makes importing things a designed experience instead of a checkbox lottery.

This is **not** the marketplace (ECO-002, gated on Gate G3 and community critical mass). It is the prerequisite hygiene: ECO-002's honest sequencing test is "are people already sharing components informally?" — nobody shares from a library they're embarrassed by, through an import flow they don't trust. It also supersedes the phase-3 TASK-003 planning docs (COMP-001…006), which were never implemented; their multi-source/bundled-prefab ideas are folded into LIB-001 where still relevant.

## What the investigation found (2026-07-25)

**Where the content actually lives.** The library is *not* in this monorepo. `ModuleLibraryModel` ([modulelibrarymodel.ts](../../../packages/noodl-editor/src/editor/src/models/modulelibrarymodel.ts):36–66) fetches `<docsEndpoint>/library/{prefabs,modules}/index.json` from the docs GitHub Pages site (`https://the-low-code-foundation.github.io/opennoodl-docs`, per [getDocsEndpoint.ts](../../../packages/noodl-editor/src/editor/src/utils/getDocsEndpoint.ts)). Each entry's `project` field is a **zip of a full Noodl project** hosted on that site. Fetch failure silently yields empty tabs.

**One pipeline for everything.** Prefab install, module install, import-from-project, import-from-URL, and component export (Cmd+Shift+E) all run through `projectimporter.js` (503 lines, untyped, [projectimporter.js](../../../packages/noodl-editor/src/editor/src/utils/projectimporter.js)) and the shared `ImportPopup` checkbox tree ([importpopup.ts](../../../packages/noodl-editor/src/editor/src/views/importpopup.ts)). Overhauling the engine (LIB-004) therefore improves all five flows at once.

**Named defects** (full list in the task files):

- **Stale-cache trap:** downloaded library zips are cached in `<userData>/library/<sanitized-url>` and reused forever if non-empty (`getModuleTemplateRoot`, modulelibrarymodel.ts:190–234). A re-published prefab at the same URL never re-downloads.
- **Collision popup no-op (import-from-URL):** [EditorPage.tsx](../../../packages/noodl-editor/src/editor/src/pages/EditorPage/EditorPage.tsx):353–363 never applies `getUnselectedImports()` — unticking items in the overwrite dialog does not prevent the overwrite.
- **Runtime loader bug:** [projectmodules.js](../../../packages/noodl-editor/src/shared/utils/projectmodules.js):47 — `d.startsWith['http']` (property access, not a call), so http-URL module dependencies get path-prefixed.
- **Overwrite-or-skip only:** no rename, no merge, no preview of what an overwrite changes; collision detection is name-string matching.
- **Heuristic dependencies:** a "dependency" is any string parameter that happens to equal a file path or style name.
- **Two parallel `noodl_modules` scanners** (`projectmodel.modules.ts` vs `shared/utils/projectmodules.js`) — the code itself asks for the merge (`projectmodel.modules.ts:5`).

**What already exists to build on.** SUB-007's graph diff/merge engine (`src/editor/src/versioning/`) computes per-node diffs of exactly the component shapes import moves around — zero shared code today. AIX-003 shipped dependency-closure granular accept (invalid partial selections unrepresentable) on a diff canvas. SUB-006's semantic validator and SUB-004's catalog can gate library content quality. SUB-009's `noodl-preview` can render components headlessly for thumbnails.

## Task Table

| Sprint | ID | Title | Scale | Executor |
|---|---|---|---|---|
| A | [LIB-001](./LIB-001-LIBRARY-PIPELINE.md) | Library source of truth & delivery pipeline | 4–6 days | 🟢 Sonnet 5 |
| A | [LIB-002](./LIB-002-PREFAB-OVERHAUL.md) | Prefab audit, repair & restyle | 1.5–2 wks | 🟠 Opus 4.8 |
| A | [LIB-003](./LIB-003-MODULE-OVERHAUL.md) | Module audit, hygiene & expansion | 1–1.5 wks | 🟠 Opus 4.8 |
| B | [LIB-004](./LIB-004-IMPORT-ENGINE.md) | Import engine v2 | 1–1.5 wks | 🟠 Opus 4.8 |
| B | [LIB-005](./LIB-005-IMPORT-UX.md) | Import experience overhaul | 1.5–2 wks | 🔵 Fable 5 |
| B | [LIB-006](./LIB-006-LEGACY-IMPORT-ASSIST.md) | Legacy project import — best effort, honest report, AI repair | 1–1.5 wks | 🔵 Fable 5 |

**Anytime fixes** (independent, land immediately, don't wait for their parent task): the import-from-URL untick bug (LIB-004 step 0), the `startsWith` loader bug (LIB-003 step 0), loud fetch failure in the library tabs (LIB-001 step 0).

## Sprint shape

**Sprint A — make the library worth having.** LIB-001 first (the pipeline the content work publishes through), then LIB-002 and LIB-003 in parallel — they touch disjoint content and share only the LIB-001 pipeline.

**Sprint B — make bringing things in trustworthy.** LIB-004 (engine) before LIB-005 (experience). LIB-005 consumes the engine's dry-run/diff API; building the UI first would mean building it twice.

Order across sprints matters less than it looks: Sprint B touches only this monorepo and can start while Sprint A's content work is still in review. The only hard edge is LIB-002/003 → LIB-001 (publishing) and LIB-005 → LIB-004 (dry-run API).

## Legacy projects: best effort, and that is the whole promise

Standing decision, 2026-07-30 — [`COMPATIBILITY-POLICY.md`](../../reference/COMPATIBILITY-POLICY.md):
**NodeGX is a fresh start and existing Noodl projects will not reliably import.** This phase owns
the import machinery, so it owns the honest half of that promise — hence **LIB-006**, added the same
day.

What it means here:

- Import fidelity for *legacy* projects is a best-effort target, never a gate. No NodeGX improvement
  is blocked, and no legacy code path is maintained, to raise it.
- The five in-app flows (prefab, module, project, URL, export) move NodeGX-shaped content and are
  unaffected by this — they still have to be correct.
- What the importer cannot convert becomes a **visible placeholder plus a report entry**, addressed
  to the user's AI assistant. Not a shim, and never a silent drop.
- "Delete and rebuild it in NodeGX" is a legitimate recommendation for the importer to make.

## What this phase deliberately does not do

- **No marketplace mechanics** — no accounts, publishing flows, ratings, or third-party submissions. That's ECO-002, still gated.
- **No integration-library modules** — phase 19's "no integration library, permanently" holds. Module expansion is UI/utility surface (charts, markdown, animation, icons), not backend connectors.
- **No new node types in the runtime** — modules package existing extension points; runtime changes belong to RUN-xxx tasks.
- **No CRDT/collaboration ambitions in import** — import is one-shot merge into a live project, not sync.

## References

- [ECO-002-MARKETPLACE.md](../phase-20-ecosystem/ECO-002-MARKETPLACE.md) — the gated successor; this phase is its precondition
- [Phase-3 TASK-003 planning docs](../phase-3-editor-ux-overhaul/TASK-003-shared-component-system/) — superseded by this phase
- SUB-007 design: [SUB-007-DESIGN.md](../phase-13-format-ai-substrate/SUB-007-DESIGN.md)
- AIX-003 (dependency-closure accept): [phase-15](../phase-15-ai-collaboration/)
