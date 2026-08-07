# Phase 7: Code Export - Progress Tracker

**Last Updated:** 2026-08-07
**Overall Status:** ⏭️ **Superseded by [phase 18 — Code Export v2](../phase-18-code-export-v2/PROGRESS.md)**

> Phase 18's PROGRESS said to stamp this file when EXP-001 began. It began on 2026-08-07, and
> `@nodegx/core` — this phase's CODE-001 — now exists at `packages/nodegx-core`.
>
> **Nothing here is lost.** The design work is what phase 18 executes: the companion-library
> approach (ADR-001), the per-node-type generators, the ts-morph pipeline. CODE-008's node-comment
> export was rescued into [EXP-006](../phase-18-code-export-v2/EXP-006-EXPORT-AUTHORING-INTENT.md)
> in 2026-07-29 for exactly this reason. Read the CODE-00x documents for design detail; track
> status in phase 18.
>
> The audit below remains the accurate record of this phase's state at the time it was superseded.

---

## Status vocabulary

- **Not started** — no code exists for this task.
- **In progress** — some code exists but the task's deliverables are incomplete.
- **Built–not wired** — the deliverable(s) exist and are tested, but have zero call sites in the application outside of tests.
- **Complete** — deliverable exists, is tested, AND has real call sites in the app (outside tests).
- **Superseded** — the task's goal was later addressed by different work, or the task itself is obsolete.

---

## Audit summary

Unlike several other phases audited under REV-006, this one's old `PROGRESS.md` was **already accurate**: it claimed 0/8 tasks complete, and a full code + git-history search confirms that is still true. There is no `@nodegx/core` package, no code generator, no `ts-morph`-based pipeline, no `nodegx export` / `@nodegx/cli` command, and no export dialog in the editor UI. `git log --all --oneline -- dev-docs/tasks/phase-7-code-export/` shows exactly one commit (`4a1080d`, a docs-folder reorganisation) — no implementation work ever landed against this phase.

One false lead worth recording: a repo-wide grep for "nodegx" turns up `nodegx.project.json` / `nodegx.routes.json` / `nodegx.styles.json` in `packages/noodl-editor/src/editor/src/io/ProjectExporter.ts` and its tests. This is **unrelated** to Phase 7 — it's STRUCT-002 from Phase 10 (AI-Powered Development), a legacy-to-v2 *project file format* converter that happens to use the "nodegx" product-rebrand name in its output filenames. It is not the React "companion library" code-export system this phase describes, and it does not count as progress on any CODE-00x task.

One dependency of CODE-008 does exist independently: the editor's node-comment feature itself (`metadata.comment`, `NodeGraphNode.getComment/setComment/hasComment`, the comment-edit popup in `NodeGraphEditorNode.ts`) is real, wired, and shipped — but that is pre-existing editor functionality that CODE-008 would need to *read from*, not any part of CODE-008's own deliverable (exporting those comments into generated code). No code-generation step exists to carry that comment data anywhere, so CODE-008 remains Not Started.

**Relationship to phase-18-code-export-v2:** `phase-18-code-export-v2/PROGRESS.md` explicitly designates itself as the phase that supersedes this one, and says to mark this file "superseded" once its EXP-001 begins. As of this audit, phase-18 itself is also 0/5 (Not started) — EXP-001 has not begun — so formally superseding phase-7 now would be premature. Statuses below remain "Not started" per the evidence, with the supersession relationship noted for context. Re-check this when phase-18 work starts.

---

## Task Status

| ID | Title | Status | Evidence (commit / path) | Notes |
|----|-------|--------|---------------------------|-------|
| CODE-001 | @nodegx/core Library | Not started | No `packages/nodegx-core` or similar; `git log --all -- dev-docs/tasks/phase-7-code-export/` shows only `4a1080d` (docs reorg, no code) | Design superseded (not yet formally, see note above) by phase-18 EXP-001 |
| CODE-002 | Visual Node Generator | Not started | No generator code found anywhere in `packages/` | Slated for phase-18 EXP-002 |
| CODE-003 | State Store Generator | Not started | No `createVariable`/`createObject`/`createArray` runtime or generator code found | Slated for phase-18 EXP-002 |
| CODE-004 | Logic Node Generator | Not started | No Function/Expression-to-code generator found | Slated for phase-18 EXP-002/EXP-003 |
| CODE-005 | Event System Generator | Not started | No `events.emit`/`useEvent` generator code found | Slated for phase-18 EXP-002 |
| CODE-006 | Project Scaffolding | Not started | No scaffolding/build-config generator found | Slated for phase-18 EXP-002 |
| CODE-007 | CLI & Integration | Not started | No `@nodegx/cli` package, no `export <project-path>` command, no export dialog/menu item in `packages/noodl-editor/src/editor/src` (checked exportProjectComponets.ts and DataBrowser.tsx CSV export — both unrelated pre-existing features) | Slated for phase-18 (not explicitly itemized there yet) |
| CODE-008 | Node Comments Export | Not started | Comment *feature* is real and wired (`packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNode.ts` `getComment`/`setComment`/`hasComment`; edit UI in `views/nodegrapheditor/NodeGraphEditorNode.ts`), but no code-generation step exists to consume it — the task's actual deliverable (comments → code comments) has zero code | Blocked on CODE-002 through CODE-005 existing first, per its own spec |

**Quick summary:** 8 total tasks · 0 complete · 0 in progress · 8 not started · **0% progress** (unchanged from prior doc — verified, not merely carried forward).

---

## Dependencies

Depends on: Phase 2 (React Migration), Phase 10 (Project Structure / v2 format — STRUCT-001…004, itself Built–not wired as of the REV-006 audit of that phase).

---

## Documentation

- [CODE-EXPORT-overview.md](./CODE-EXPORT-overview.md) - Full system overview (design-only, no implementation)
- [CODE-REFERENCE-noodl-nodes.md](./CODE-REFERENCE-noodl-nodes.md) - Node mapping reference (design-only)
- Individual task specs: CODE-001 through CODE-008 (all design-only; no per-developer PROGRESS-*.md files exist in this folder)
- See also: `dev-docs/tasks/phase-18-code-export-v2/` — the revival-era phase that plans to supersede this one

---

## Recent Updates

| Date | Update |
|------|--------|
| 2026-07-23 | REV-006 audit: verified 0/8 accurate against code + git history; corrected false "nodegx.project.json" lead (belongs to Phase 10 STRUCT-002, not this phase); documented phase-18 supersession relationship |
| 2026-01-07 | Updated PROGRESS.md to list all 8 defined tasks |
| 2026-01-07 | Renumbered from Phase 6 to Phase 7 |

---

## Notes

This phase enables exporting Noodl projects as standalone React 19 applications. Uses a companion library approach (@nodegx/core) to preserve Noodl's mental model while generating idiomatic React code.

**Estimated Total Effort:** 12-16 weeks

**Convention going forward:** when work against any CODE-00x task begins, update this file's task table with the commit hash and call-site evidence in the same commit/PR — do not let a per-developer notes file (if one is created) be the only record.
