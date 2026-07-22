# Revival Phases 12–20 — Index

**Created:** 2026-07-22
**Source:** [NOODL-REVIVAL-ROADMAP.md](../reviews/NOODL-REVIVAL-ROADMAP.md), which derives from [NOODL-VIABILITY-REPORT.md](../reviews/NOODL-VIABILITY-REPORT.md)
**Status:** All phases Not started

These nine phases document the unlimited-budget revival plan. They sit alongside the original phases 0–11 rather than replacing them: phases 0–2 are complete, several later phases contributed work that these build on, and a few are explicitly superseded (noted below).

## Phases

| Phase | Track | Tasks | Focus | Start when |
|---|---|---|---|---|
| [12 — Reanimation](./phase-12-reanimation/) | Horizon 0 | REV-001…008 | Green build, working tests, CI, current Electron, shipped v0, trustworthy dev loop | **Now** |
| [13 — Format & AI Substrate](./phase-13-format-ai-substrate/) | A | SUB-001…008 | v2 format in real use, node catalog, semantic validator, graph diff, MCP server | After REV-001/002 |
| [14 — Editor Platform Health](./phase-14-editor-platform-health/) | B | PLAT-001…005 | Canvas decomposition, retire jQuery, type the runtime | After REV-003 |
| [15 — AI Collaboration](./phase-15-ai-collaboration/) | C | AIX-001…005 | Modern AI client, the authoring loop, graph-native review, explain mode | After Phase 13 core |
| [16 — Runtime & Deploy Health](./phase-16-runtime-deploy-health/) | D | RUN-001…004 | Runtime React 19, SSR/SSG, finish UBA, fix local backend | Parallel; RUN-004 after REV-004 |
| [17 — Noodl Learn](./phase-17-noodl-learn/) | E | LEARN-001…006 | Lessons engine, curriculum, web viewer, classroom mode, pilots | Horizon 2 |
| [18 — Code Export v2](./phase-18-code-export-v2/) | F | EXP-001…005 | `@nodegx/core`, generators, AI translation with trace verification | After Phase 13 |
| [19 — Cloud & Workflows](./phase-19-cloud-workflows/) | G | WF-001…003 | Finish workflow runtime, Series 1 nodes, one deploy target | Lower priority |
| [20 — Ecosystem](./phase-20-ecosystem/) | Horizon 3 | ECO-001…005 | Collaboration, marketplace, multi-project, hosting, rebrand | 🔒 **Gated on G3** |

## The critical path

Not everything is equally load-bearing. In dependency order, the spine is:

**REV-001** (build works) → **SUB-002** (no data loss) → **SUB-001** (editor uses v2) → **SUB-004** (node catalog) → **SUB-006** (semantic validator) → **AIX-002** (the authoring loop) → **Gate G2** (does anyone want this?)

Everything else supports, parallels, or follows that line. If capacity is contended, protect it.

## Decision gates

The roadmap places three gates in the plan. They are pre-committed decisions, not review meetings:

| Gate | When | Question | If it fails |
|---|---|---|---|
| **G1** | ~month 3 | Can an external agent author a valid page via catalog + MCP? (SUB-008's exit demo) | The substrate thesis is wrong; halt Tracks C and F, rethink |
| **G2** | ~month 9 | After the authoring demo ships for a quarter and two pilots run — do people **return unprompted**? | Wind down: ship export so nobody is trapped, open-source, stop |
| **G3** | ~month 15 | Which wedge pulled harder — education or the AI-collaborative builder? | Concentrate Horizon 3 there; refusing to choose repeats the original mistake |

## Executor recommendations

Every task file carries a **Recommended executor** row. The criteria, applied consistently across all nine phases:

| Tier | Use when |
|---|---|
| 🟢 **Sonnet 5** | The root cause is known, the fix is specified, and success is mechanically verifiable |
| 🟠 **Opus 4.8** | Substantial engineering against a clear target, with a large surface or opaque failure modes needing iterative diagnosis |
| 🔵 **Fable 5** | The task *defines* semantics, an interface, or a strategy — where the hard part is deciding what to build, and the decision is expensive to reverse |

Two rules of thumb. **Escalate** when a task stops being "apply the known fix" and becomes "work out what the right thing is." **Delegate down** once a design is settled — most Fable-tier tasks contain Opus- or Sonnet-tier implementation work, and the task files say where.

These are efficiency recommendations, not gates. Several tasks (LEARN-002 curriculum, LEARN-006 pilots) additionally require *humans* in roles no model fills — a learning designer, real pilot cohorts — and say so explicitly.

## Relationship to phases 0–11

| Original phase | Disposition |
|---|---|
| 0–2 (foundation, dependencies, React migration) | Complete |
| 3 (editor UX) | Mostly cut. Small items survive in PLAT-005; advanced GitHub integration is explicitly dead |
| 3.5 (realtime agentic UI) | Deferred into AIX-005, gated on the authoring loop proving out |
| 4 (canvas views) | Partially complete; PLAT-001 makes further work tractable |
| 5 (multi-target deployment) | Parked. RUN-004 fixes the local backend; export (Phase 18) replaces the target matrix |
| 6 (UBA) | UBA-001…009 complete; RUN-003 finishes it |
| 7 (code export) | **Superseded by Phase 18**, which implements its design plus trace-verified AI translation |
| 8 (distribution) | **Pulled forward into REV-007** |
| 9 (styles) | Mostly complete; PLAT-005 wires the dangling STYLE-005 banner |
| 10 (AI-powered development) | STRUCT-001…004 complete and are Phase 13's foundation; Phase 13 + 15 supersede the rest |
| 11 (cloud functions) | CF11-004…007 complete; Phase 19 finishes what is blocked and parks the rest |

Note that several phase 0–11 `PROGRESS.md` files understate what was actually delivered — the February 2026 sprint landed work that was never recorded in the shared trackers. **REV-006** corrects that record, and until it does, prefer the per-developer progress files and git history.

## A note on these documents

They were written on 2026-07-22 from the viability assessment, before any of the work began. They will be wrong in places — estimates especially, and any task whose first step is "assess what actually exists" may find something that changes its shape substantially.

Treat them as briefs rather than contracts. Where a task's assessment step contradicts its own plan, the assessment wins; record the deviation in that task's `CHANGELOG.md` and move on.
