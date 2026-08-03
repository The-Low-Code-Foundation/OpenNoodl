# Phase 39 — Progress

**Status:** specified, nothing built.
**Last updated:** 2026-08-03

## Tasks

| Task | Reported items | Status | Notes |
|---|---|---|---|
| [POL-001](POL-001-SETTINGS-PANEL-CRASH.md) — settings panel crash | 15 | ☐ not started | **Alpha-blocking.** Mechanism confirmed. Slice 2 (where the `settings` key goes) is open. Touches `projectmodel.ts` — dirty in another session. |
| [POL-002](POL-002-LINKS-AND-THE-LEARN-TAB.md) — links + Learn tab | 1, 2, 5 | ☐ not started | Mechanism confirmed. Removes an Algolia dependency — re-check the packaged build. |
| [POL-003](POL-003-THE-LEFT-RAIL.md) — the left rail | 3, 4, 6 | ☐ not started | Contrast measured at 3.8:1. `IconSize` confirmed inert at the CSS level. Needs 5 new Lucide SVGs. |
| [POL-004](POL-004-TOKENS-USED-AS-WHAT-THEY-ARE-NOT.md) — token misuse | 9b, 12a | ☐ not started | 6 undefined tokens across 8 files. Adds a gate check. Prerequisite for POL-010. |
| [POL-005](POL-005-BACKEND-SURFACES-OPEN-DOCKED.md) — backend surfaces | 7 | ☐ not started | One deleted call fixes both halves. Needs a per-surface layout pass at 860px. |
| [POL-006](POL-006-A-FONT-AND-AN-ICON-SET.md) — font + icon set | 8 | ☐ not started | `--font-sans` is dangling repo-wide. Recommends Inter + Lucide sprite, bundled not CDN. Touches `LocalProjectsModel.ts` — dirty in another session. |
| [POL-007](POL-007-THE-BUILD-PANEL-FITS.md) — Build panel layout | 9a | ☐ not started | Mechanism confirmed (row min-width > 400px panel). |
| [POL-008](POL-008-SAMPLE-DATA-AND-A-THIN-BUILD.md) — sample data + thin build | 10 | ☐ not started | **Part A undiagnosed** — three candidates, pick one before fixing. Part B gated on POL-006. |
| [POL-009](POL-009-A-PIN-BELONGS-TO-ONE-CANVAS.md) — pinned run | 11 | ☐ not started | Mechanism confirmed; the source comment already predicted it. |
| [POL-010](POL-010-THE-WALK-DOESNT-WALK.md) — provenance walk | 12b | ☐ not started | **Undiagnosed.** Two candidates. Blocked on POL-003 + POL-004 for readability. |
| [POL-011](POL-011-FX-ON-MULTILINE-STRINGS.md) — `fx` on multiline | 13 | ☐ not started | Mechanism confirmed: `multiline: true` routes to `TextAreaType`, which has no expression support. |
| [POL-012](POL-012-SET-ALL-FOUR-SIDES-AT-ONCE.md) — link padding/margin | 14 | ☐ not started | Includes the four-undo-entries defect, worth fixing independently. |

## What is confirmed vs. what is not

Ten of the twelve tasks have a mechanism established by reading the code, with file and line
references in each spec. **Two do not**, and their first slice is diagnosis, not repair:

- **POL-008 Part A** — why sample data does not reach the preview. Three candidates; the plumbing
  exists end to end, so it is one of "never emitted", "wrong shape for a `User` node", or "the
  sandbox drops it".
- **POL-010** — why the provenance walk stops at one hop. Two candidates; the suspicious signal is a
  node id that equals the node name, which would break edge lookup entirely.

Neither should be estimated or started as a fix.

## Open questions for Richard

1. **Font choice.** POL-006 recommends **Inter** (neutral, OFL, built for UI). Alternatives offered:
   Figtree (warmer) or Geist (more technical). Your call — it is what every project made in NodeGX
   will look like by default.
2. **Icon set size.** Lucide has ~1,500 glyphs. Shipping all of them makes the picker unusable and
   bloats every project. POL-006 proposes a curated 100–200. Do you want to pick the list, or should
   we propose one?
3. **`IconSize`.** Making it real (POL-003 slice 2) changes icon sizes at ~130 call sites at once.
   Do it properly with a screenshot sweep, or scope this phase to the one hide-panel button and file
   the rest? The spec recommends the former and names the fallback.
4. **POL-008 Part B** — the AI's output being visually thin is partly a prompt/conventions question,
   which is a phase, not a task. This phase scopes it to "re-judge after a default font exists, then
   give the agent a styling floor in the CONVENTIONS template". Enough for alpha?

## Not in this phase

- Rebuilding the lessons. POL-002 hides the Learn tab and leaves `LearningCenter` compiling; the
  rebuild is a later learn phase.
- Model output quality beyond POL-008's styling floor.
- Anything in `index.bundle.js` — it is a committed build artifact and is not a source file.
