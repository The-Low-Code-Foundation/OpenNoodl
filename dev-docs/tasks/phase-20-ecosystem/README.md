# Phase 20: Ecosystem (Revival Horizon 3)

**Phase:** 20
**Horizon:** 3 — Year 1–2, post-validation
**Source:** [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) Horizon 3
**Status:** 🔒 **Not started — and deliberately not startable before Gate G3**

## Read this before starting anything here

Every task in this phase is gated. The revival roadmap places three decision gates in the plan, and this phase sits entirely after the last of them:

- **Gate G1** (~month 3) — can an external agent author a valid page through the catalog and MCP server? If not, the substrate thesis is wrong and Tracks C and F halt.
- **Gate G2** (~month 9) — after the AI authoring demo has shipped for a quarter and two education pilots have run, do people **return unprompted**? If not, the recommended action is to wind down: ship export so nobody is trapped, open-source everything, and stop.
- **Gate G3** (~month 15) — which wedge pulled harder, education or the AI-collaborative builder? Concentrate Horizon 3 investment there.

That last gate is what governs this phase. These tasks are large — collaborative editing alone is a four-to-six-month project — and starting them before knowing which audience is real is precisely the mistake the viability assessment identified in the original twelve-phase roadmap: parallel ambition outrunning validated demand.

**The documents here are therefore specifications, not implementation plans.** They are deliberately lighter than the task files in phases 12–19: enough to scope the work, understand its dependencies, and cost it roughly, without pretending to a level of design certainty nobody can have this far out.

## Task Table

| ID | Title | Scale | Gated on | Executor |
|---|---|---|---|---|
| [ECO-001](./ECO-001-COLLABORATIVE-EDITING.md) | Real-time collaborative editing (CRDT) | 4–6 months | G3, education wedge especially | 🔵 Fable 5 |
| [ECO-002](./ECO-002-MARKETPLACE.md) | Component & adapter marketplace | 2–3 months | G3 + community critical mass | 🟠 Opus 4.8 |
| [ECO-003](./ECO-003-MULTI-PROJECT.md) | Multi-project workspaces | 1–2 months | G3, professional wedge | 🟠 Opus 4.8 |
| [ECO-004](./ECO-004-HOSTED-PLATFORM.md) | Hosted platform | 6+ months | G3 + a commercial decision | 🔵 Fable 5 |
| [ECO-005](./ECO-005-REBRAND-DECISION.md) | Rebrand decision ("Nodegex") | Decision + 2–4 wks | Traction, deliberately late | 🔵 Fable 5 |

## Priority order (from the roadmap)

1. **ECO-001 collaborative editing** — the classroom killer feature (a teacher watching 25 graphs live) and the team feature. v2's per-component files are the right granularity for CRDTs.
2. **ECO-002 marketplace** — components, UBA adapters, and lesson packs become shareable units once the catalog and v2 format make them genuinely portable.
3. **ECO-003 multi-project** — start with the multi-window option, as the existing design document recommends.
4. **ECO-004 hosted platform** — the commercial engine, if there is one.
5. **ECO-005 rebrand** — last, on purpose. Rename after there is traction to rename.

## What stays dead (do not resurrect here)

The roadmap names four things explicitly cut, and this phase is where they would most plausibly creep back in. They stay cut:

- **Advanced GitHub integration** (the old GIT-005…011, scoped at 501–662 hours) — SUB-007's graph-native diff and merge serves the actual need; deep GitHub workflow plumbing serves a persona that vibe coding already owns.
- **The five-target deployment matrix** — Phase 18's export is the universal escape hatch.
- **Native multi-framework compilers** — EXP-005's verified AI porting replaces them.
- **Anything whose pitch is "faster than prompting"** — the product does not compete on speed. It competes on comprehension, ownership, and learning.

## References

- [Revival roadmap — Horizon 3 and Gates G1–G3](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- [Viability report — §6 "What would have to be true"](../../reviews/NOODL-VIABILITY-REPORT.md)
- [`dev-docs/future-projects/MULTI-PROJECT.md`](../../future-projects/MULTI-PROJECT.md)
