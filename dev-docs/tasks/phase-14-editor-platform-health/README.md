# Phase 14: Editor Platform Health (Revival Track B)

**Phase:** 14
**Track:** B — Editor Platform Health ("the never-again track")
**Source:** [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) Horizon 1, Track B
**Status:** Not started (created 2026-07-22)

## Why this phase exists

The 2026-07-22 viability assessment set out to test a blunt worry — that this codebase is "a mishmash of decades of different dev styles… beyond saving, a mix of jQuery and TypeScript and who knows what all." It found the opposite of what the worry implied. jQuery survives in **14 files, all in one package**, clustered in two subsystems. Every legacy/React boundary that was inspected turned out to be *contained*: each side owns an exclusive DOM subtree and they coordinate through events, following a pattern the team documented and enforced in `dev-docs/reference/LEARNINGS.md`. No case was found of React and jQuery co-managing the same element.

That is the good news, and it is why this phase is called "health" rather than "rescue." The bad news is that containment is a holding position, not a destination. The remaining debt is real:

- ~192 legacy `.js` files in the editor and **554 `TSFixme` markers** clustered at the TypeScript/JavaScript seams
- `noodl-runtime` (98 `.js` / 6 `.ts`) and `noodl-viewer-react` (131 `.js`) are almost entirely untyped — stable, but hostile to contributors and to AI-assisted modification
- `nodegrapheditor.ts` is a **3,481-line hybrid god object** — a jQuery shell hosting five independent React roots. Contained by design, and still the single scariest file in the repository to change

With an unconstrained budget, the right move is to stop containing and start finishing. Every task here is work that a solo developer would rationally defer forever and that a funded team should simply do — because the cost of *not* doing it is paid continuously, in every later phase, by every contributor including the AI ones.

## Task Table

| ID | Title | Priority | Estimate | Prerequisites | Executor |
|---|---|---|---|---|---|
| [PLAT-001](./PLAT-001-CANVAS-DECOMPOSITION.md) | Canvas decomposition (break up `nodegrapheditor.ts`) | 🟠 High | 6–8 wks | REV-003 (CI as a safety net) | 🔵 Fable 5 |
| [PLAT-002](./PLAT-002-RETIRE-JQUERY-ISLANDS.md) | Retire the jQuery islands (PopupLayer, property editor) | 🟠 High | 6–8 wks | REV-003 | 🟠 Opus 4.8 |
| [PLAT-003](./PLAT-003-TYPE-THE-RUNTIME.md) | Type the runtime and viewer packages | 🟠 High | 8–12 wks | REV-005; align with SUB-004 | 🟠 Opus 4.8 |
| [PLAT-004](./PLAT-004-TSFIXME-BURNDOWN.md) | `TSFixme` burn-down with a CI ratchet | 🟡 Medium | Ongoing | REV-003 | 🟢 Sonnet 5 |
| [PLAT-005](./PLAT-005-EDITOR-POLISH.md) | Editor UX loose ends (incl. wiring the STYLE-005 banner) | 🟡 Medium | 2–3 wks | REV-001 | 🟢 Sonnet 5 |

## Sequencing notes

- **Everything here needs CI first.** These are large mechanical refactors of code with thin test coverage; REV-003's merge gates are what make them safe. Do not start PLAT-001/002/003 before CI is enforcing typecheck, tests, and builds.
- **PLAT-001 and PLAT-002 are independent** and can run in parallel — they touch the canvas and the panels respectively. They do converge at the property editor's canvas interactions, so coordinate if both are in flight.
- **PLAT-003 should be aligned with SUB-004** (the node catalog, Phase 13). Both derive from the same source of truth — node definitions and their port metadata — and doing them in ignorance of each other means writing the same knowledge twice, in two forms, that can then disagree.
- **PLAT-004 is a ratchet, not a project.** Land the CI mechanism early; the count then falls as a side effect of PLAT-002 and PLAT-003 rather than as dedicated work.
- **PLAT-005 is small and independent** — good work for filling gaps between larger efforts.

## Exit criterion

From the revival roadmap: **zero jQuery in the repository, no file over ~800 lines in the canvas subsystem, the runtime fully typed, and `TSFixme` trending to zero.**

Stated more usefully: a new contributor — human or AI — should be able to open any file in the editor or runtime and understand it from its types and structure, without needing the oral history of which parts are legacy islands and which rules apply where.

## What this phase is not

It is not a rewrite. The viability assessment specifically rejected "rewrite the core first" as a strategy, on the grounds that the core is the healthiest part of the codebase and a rewrite would consume the window the product may not have. Every task here is incremental, reversible, and leaves the product working at each step. `PLAT-001` in particular decomposes the canvas **in place** — it is explicitly not a migration to React Flow or any other graph library.

## References

- [Viability report — §4.4 (the mishmash, tested) and Appendix E](../../reviews/NOODL-VIABILITY-REPORT.md)
- [Revival roadmap — Horizon 1, Track B](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- [`dev-docs/future-projects/CANVAS-MODERNISATION-PROJECT.md`](../../future-projects/CANVAS-MODERNISATION-PROJECT.md) — the existing design PLAT-001 implements
- `dev-docs/reference/LEARNINGS.md` — the legacy/React separation rules that made containment work
