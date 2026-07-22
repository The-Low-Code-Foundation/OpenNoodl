# REV-006: Documentation Truth Pass

## Metadata

| Field | Value |
|-------|-------|
| **ID** | REV-006 |
| **Phase** | Phase 12 — Reanimation (Revival Horizon 0) |
| **Priority** | 🟠 High |
| **Difficulty** | 🟢 Easy (research-heavy, low technical risk) |
| **Estimated Time** | 2–3 days |
| **Prerequisites** | None |
| **Branch** | `cline-dev` — work directly on it, no task branch (see `.clinerules`) |
| **Recommended executor** | 🟢 **Sonnet 5** — systematic cross-referencing of docs against git history and code. High volume, low ambiguity. The judgement calls (what "done" means for a partially-wired feature) are enumerated below. |

## Objective

Reconcile every phase `PROGRESS.md` in `dev-docs/tasks/` with what the code and git history actually show, so the documentation stops misleading both human contributors and AI assistants.

## Background

This repository is explicitly designed for AI-assisted development: `dev-docs/README.md` describes a workflow where contributors (human or AI) orient themselves by reading task documentation before touching code. That makes documentation accuracy a *functional* property, not a tidiness concern. An AI assistant that reads "Phase 6: 0% complete, not started" will happily re-implement a subsystem that already exists and is tested.

The 2026-07-22 viability assessment found exactly this: several top-level `PROGRESS.md` files were last updated 2026-01-07 and report zero progress on work that the per-developer progress files and git history show was completed during the 2026-02-18/19 sprint. The stall happened mid-sprint, so the summary docs never caught up with the branch commits.

This is cheap to fix and disproportionately valuable, because every subsequent phase in the revival plan begins with someone reading these files.

## Current State

Known discrepancies (verify each and search for more):

| Doc | Claims | Reality |
|-----|--------|---------|
| `phase-6-uba-system/PROGRESS.md` | Not started / 0% | UBA-001 through UBA-009 complete — types, SchemaParser, 8 field renderers, ConfigPanel, UBAClient (HTTP+SSE), UBAPanel, sidebar registration, health indicator, with tests. See `PROGRESS-richard.md` and git commits from the 2026-02-18 sprint |
| `phase-10-ai-powered-development/PROGRESS.md` | 0 of 42 tasks | STRUCT-001…004 complete: 8 JSON schemas + validator, export engine, import engine, format detector, ~149 tests. See `PROGRESS-dishant.md` |
| `phase-11-cloud-functions/PROGRESS.md` | ~10%, CF11-004/005 done | Also CF11-006 (Execution History Panel) and CF11-007 (Canvas Execution Overlay) complete per `PROGRESS-dishant.md` and commits `7d373e0`, `83278b4` |
| `phase-9-styles-overhaul/PROGRESS.md` | ~35%, STYLE-005 not started | `PROGRESS-richard.md` reports STYLE-001…005 done including the StyleAnalyzer — **but** the STYLE-005 banner is not wired into the property panel and two API calls are unverified. Neither "done" nor "not started" is accurate |
| `dev-docs/README.md` | "Current Priorities" lists Phase 1–3 TASK-001…007 | Superseded by the phase-0…11 structure; the task IDs listed no longer match the folders on disk |

Root cause: per-developer progress files (`PROGRESS-richard.md`, `PROGRESS-dishant.md`) were maintained during the sprint; the shared `PROGRESS.md` files were not.

## Desired State

- Every phase folder has a `PROGRESS.md` that matches code and git reality as of the reanimation date.
- Partially-complete work is labelled precisely — "built but not wired" is a distinct state from "done" and from "not started", and the difference is exactly what a contributor needs to know.
- A stated convention for keeping these current, so the same drift does not recur.
- `dev-docs/README.md` points at the real current phase structure, including the new revival phases 12–20.

## Scope

### In Scope
- [ ] Audit all phase folders under `dev-docs/tasks/` (phases 0–11) against git log and the code
- [ ] Rewrite each `PROGRESS.md` to reflect verified reality, with commit hashes as evidence
- [ ] Merge the per-developer progress files' content into the shared file (keep the originals as history)
- [ ] Add a status vocabulary: Not started / In progress / **Built–not wired** / Complete / Superseded
- [ ] Update `dev-docs/README.md` current-priorities and structure sections to include phases 12–20
- [ ] Add a short "keeping progress current" note to `dev-docs/guidelines/GIT-WORKFLOW.md`

### Out of Scope
- Rewriting task specifications themselves (only status is in scope)
- Fixing the code discrepancies discovered (log them; PLAT-005 wires the STYLE-005 banner, SUB-001 wires the v2 format)
- Deleting historical per-developer progress files

## Technical Approach

Evidence sources, in order of authority: **the code** (does the file exist, is it imported anywhere), then **git history** (`git log --oneline --all -- <path>`), then per-developer progress notes, then the shared `PROGRESS.md` (least authoritative — it is the thing being corrected).

The critical distinction to apply throughout: **exists ≠ integrated**. The single most consequential finding of the viability assessment was that the v2 project format is fully built and tested but has zero call sites in the application. A `PROGRESS.md` saying "complete" would be defensible by task-spec standards and deeply misleading in practice. Use the "Built–not wired" status for these, and say what is missing.

## Implementation Steps

1. **Inventory.** List every phase folder and its progress files; note last-modified dates against the last commit touching that phase's code.
2. **Per phase, verify:** for each task ID, does the deliverable exist in the code? Is it imported/used anywhere outside tests? What commit landed it?
3. **Rewrite `PROGRESS.md`** with a task table: ID | title | status (new vocabulary) | evidence (commit/path) | notes on what remains.
4. **Flag integration gaps explicitly** — every "Built–not wired" entry names the task that will wire it (e.g. STRUCT-001…004 → SUB-001 in Phase 13).
5. **Update `dev-docs/README.md`** structure and priorities; link the revival roadmap and phases 12–20.
6. **Document the convention** so future sprints update the shared file, not only per-developer notes.

## Testing Plan

Not code, so verification is by spot-check: pick five task IDs at random across phases, and confirm from a cold start that the documented status matches what the code shows. Ideally have someone who did not do the audit perform this check.

## Success Criteria

- [ ] Every phase 0–11 `PROGRESS.md` verified and rewritten with evidence
- [ ] Status vocabulary applied consistently, including "Built–not wired"
- [ ] Each integration gap names the task that closes it
- [ ] `dev-docs/README.md` reflects the real phase structure incl. 12–20
- [ ] Convention for maintaining progress docs recorded in `GIT-WORKFLOW.md`
- [ ] Spot-check of five random task IDs passes

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| "Done" is judged from the task spec rather than from integration reality | Apply the exists-vs-integrated test to every claim; when in doubt, grep for call sites outside `tests/` |
| The audit itself goes stale as phases 12–20 begin | Land it early in the reanimation, and make progress updates part of each task's definition of done |
| Time sink from re-litigating old scope | Status only. Do not rewrite specs or re-plan phases in this task |

## References

- [Viability report — Appendix H (roadmap & activity)](../../reviews/NOODL-VIABILITY-REPORT.md)
- [Revival roadmap](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- `dev-docs/tasks/phase-6-uba-system/PROGRESS-richard.md`, `phase-10-ai-powered-development/PROGRESS-dishant.md` (authoritative sources to merge in)

## Checklist

- [ ] Branch `task/rev-006-docs-truth-pass`
- [ ] Inventory all phase folders and progress files
- [ ] Verify each task ID against code + git; record evidence
- [ ] Rewrite each `PROGRESS.md` with the new status vocabulary
- [ ] Name the closing task for every integration gap
- [ ] Update `dev-docs/README.md` and `GIT-WORKFLOW.md`
- [ ] Independent spot-check of five task IDs; commit to cline-dev and push
