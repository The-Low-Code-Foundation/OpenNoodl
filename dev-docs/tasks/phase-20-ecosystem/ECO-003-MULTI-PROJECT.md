# ECO-003: Multi-Project Workspaces

## Metadata

| Field | Value |
|-------|-------|
| **ID** | ECO-003 |
| **Phase** | Phase 20 — Ecosystem (Revival Horizon 3) |
| **Status** | 🔒 **Gated — do not start before Gate G3** |
| **Scale** | 1–2 months (multi-window option); substantially more for true in-app multi-project |
| **Prerequisites** | Gate G3, professional wedge |
| **Recommended executor** | 🟠 **Opus 4.8** — the multi-window path is contained engineering; the in-app path means unpicking a pervasive singleton, which is larger and riskier. |

*This is a specification, not an implementation plan. See the [phase PROGRESS notes](./PROGRESS.md) for why.*

## What this is

Working with more than one Noodl project at a time — either as multiple editor windows, or as multiple projects open within one editor.

## Why it might matter

This is a professional-workflow feature. A developer maintaining several applications, copying a component between projects, or referencing one project while building another currently has to close and reopen. It is friction rather than blockage, which is why it sits low in the Horizon 3 priority order — but it is persistent friction for exactly the users who would pay for the tool.

It matters much less for the education wedge, where students work on one project at a time. That asymmetry makes it a good example of why Gate G3 exists: this is worth doing if the professional wedge wins and close to pointless if it does not.

## The existing design guidance

`dev-docs/future-projects/MULTI-PROJECT.md` already analysed this and reached a conclusion worth respecting: the blocker is a pervasive singleton pattern (`ProjectModel.instance` and similar) threaded throughout the editor, and the recommendation was **Option B — multiple Electron windows, each with its own project** — in preference to Option A, in-app multi-project.

That recommendation still looks right. Multi-window sidesteps the singleton problem entirely by giving each project its own process and memory space, delivers most of the practical value, and costs a fraction of the alternative. Unpicking singletons across the editor would be a large, invasive refactor with substantial regression risk and little user-visible benefit over the simpler option.

Note that PLAT-001 and PLAT-002 (Phase 14) will have improved the editor's structure considerably by the time this is considered, which may make Option A cheaper than it looks today — worth re-assessing rather than assuming, but not worth choosing on optimism.

## Open questions to resolve first

- **Has PLAT-001/002 changed the calculus** enough to reconsider in-app multi-project? Re-read `MULTI-PROJECT.md` against the post-refactor codebase.
- **Cross-project operations.** Copying a component between projects is the main motivating use case — how does that work across windows? The v2 format and the marketplace's package format (ECO-002) may make this straightforward.
- **Resource cost** of multiple Electron windows, particularly on the modest hardware common in education settings.
- **Shared state** — preferences, recent projects, AI configuration — across windows.
- **Window management UX**: does the launcher become a window manager?

## Rough shape of the work

Multi-window lifecycle; per-window project isolation; shared preferences and settings; cross-window component copy; launcher integration; resource management.

## Dependencies

- `dev-docs/future-projects/MULTI-PROJECT.md` (existing analysis)
- Benefits from PLAT-001/002 (Phase 14), SUB-001 (portable components), ECO-002 (package format for cross-project copy)
- Gate G3 — this is professional-wedge work

## Scale

1–2 months for the multi-window option. Substantially more, with real regression risk, for true in-app multi-project — do not choose that path without a specific reason the simpler option cannot serve.
