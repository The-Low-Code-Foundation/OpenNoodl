# Phase 12: Reanimation (Revival Horizon 0)

**Phase:** 12
**Status:** 🔴 Not Started
**Effort:** 4–8 weeks (2–3 engineers) / longer solo
**Priority:** CRITICAL — everything else stacks on this

---

## Strategic Context

The repo stalled mid-sprint on 2026-02-18 with the build broken, the test harness unable to boot, no CI gating merges, Electron 12 majors behind, and progress docs that contradict git history. The 2026-07-22 viability assessment ([NOODL-VIABILITY-REPORT.md](../../reviews/NOODL-VIABILITY-REPORT.md)) found every one of these to be a fixable loose end, not rot — and the companion roadmap ([NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md)) makes fixing them **Horizon 0**: the deliberately boring phase that makes the repo **green, current, and shippable** before any strategic work (decomposed format, node catalog, AI authoring) begins.

This phase is the difference between "a stalled repo" and "a working project you're improving." Every later horizon — Format & AI Substrate, Editor Platform Health, AI Collaboration, Noodl Learn, Code Export — assumes a green build, a running test suite, CI that blocks regressions, and a release pipeline. Do this first; do it completely.

## Task Table

| ID | Title | Priority | Estimate | Prerequisites | Executor |
|---|---|---|---|---|---|
| [REV-001](./REV-001-REANIMATION-COMMIT.md) | The Reanimation Commit (fix the three build breakages) | 🔴 Critical | 1–2 days | None | 🟢 Sonnet 5 |
| [REV-002](./REV-002-TEST-HARNESS-FIX.md) | Fix the Electron Test Harness | 🔴 Critical | 2–4 days | None (REV-001 helpful) | 🟠 Opus 4.8 |
| [REV-003](./REV-003-CI-PIPELINE.md) | CI/CD Pipeline on GitHub Actions | 🔴 Critical | 1 week | REV-001, REV-002 | 🟢 Sonnet 5 |
| [REV-004](./REV-004-ELECTRON-UPGRADE.md) | Electron 31 → 43 Upgrade | 🟠 High | 1–3 weeks | REV-001 (REV-003 strongly advised) | 🟠 Opus 4.8 |
| [REV-005](./REV-005-DEPENDENCY-HYGIENE.md) | Dependency Hygiene (audit, TS unification, dedupe) | 🟠 High | 1 week | REV-003 | 🟢 Sonnet 5 |
| [REV-006](./REV-006-DOCS-TRUTH-PASS.md) | Docs Truth Pass (reconcile PROGRESS files with git) | 🟡 Medium | 2–3 days | None | 🟢 Sonnet 5 |
| [REV-007](./REV-007-SHIP-V0.md) | Ship v0: Signed Builds + Auto-Update | 🟠 High | 2 weeks | REV-004, REV-003 | 🟠 Opus 4.8 |

## Sequencing Notes

- **REV-001 and REV-002 come first and unblock REV-003.** CI (REV-003) can only gate on typecheck/build/tests once the build is green (REV-001) and the test harness actually boots headless (REV-002). REV-001 and REV-002 are independent of each other and can run in parallel.
- **REV-003 before the risky work.** Land CI before REV-004/REV-005 so that a 12-major Electron jump and a dependency-tree shake both happen *under* regression gates, not before they exist.
- **REV-004 (Electron upgrade) is the one genuinely risky task** in this phase: native modules (dugite in `@noodl/git`, the better-sqlite3 surface in the local-SQL adapter), 12 majors of main-process API drift, and an electron-builder 24→26 upgrade in lockstep. Budget the full 1–3 weeks and use the staged waypoint strategy in the task doc if a straight jump fails.
- **REV-005 overlaps freely** with REV-004 except where they touch the same packages (electron-builder, lerna); coordinate those bumps.
- **REV-006 is independent** and can be done by anyone at any time — do it early, because inaccurate PROGRESS files actively mislead both humans and AI agents working on the other tasks.
- **REV-007 depends on REV-004**: there is no point signing and auto-updating builds of an Electron 31 app that REV-004 is about to replace. It also relies on REV-003's Actions infrastructure for release builds.

```
REV-001 ──┬──► REV-003 ──┬──► REV-004 ──► REV-007
REV-002 ──┘              └──► REV-005
REV-006 (independent, do early)
```

## Exit Criterion

Quoted from the roadmap (Horizon 0):

> **Exit criterion:** a stranger can download a signed, auto-updating OpenNoodl on current Electron, and CI blocks regressions. *(This was the entire "minimum viable" plan's first move; here it's just the warm-up.)*

Concretely, when this phase is done:

- [ ] `npm run typecheck:editor` — 0 errors
- [ ] `npm run build:editor` — completes and produces a packaged app
- [ ] `npm run test:editor` / `test:ci` — full suite (~149 io tests + rest) passes locally and headless
- [ ] GitHub Actions gates every PR on typecheck + lint + tests + editor/viewer builds; nightly packaged builds run
- [ ] Editor runs on Electron 43.x, electron-builder 26.x
- [ ] `npm audit --omit=dev` critical count: 0 (or documented no-fix exceptions)
- [ ] One TypeScript version (5.9.x) across all packages
- [ ] Every `PROGRESS.md` agrees with git history
- [ ] Signed macOS/Windows/Linux v0 release with working auto-update, downloadable by a stranger

## Key References

- [NOODL-REVIVAL-ROADMAP.md §1 Horizon 0](../../reviews/NOODL-REVIVAL-ROADMAP.md) — task list and estimates this phase implements
- [NOODL-VIABILITY-REPORT.md §3 scorecard, Appendix B/C/D](../../reviews/NOODL-VIABILITY-REPORT.md) — the exact evidence (typecheck/build/test/audit output) behind each fix
- [dev-docs/TASK-TEMPLATE.md](../../TASK-TEMPLATE.md) — structure used by the task files here
- [dev-docs/tasks/phase-8-distribution/](../phase-8-distribution/) — prior scoping that REV-007 pulls forward

---

_Created: 2026-07-22 from NOODL-REVIVAL-ROADMAP.md Horizon 0_

## Executor guidance

Each task file carries a **Recommended executor** row. The criteria used across all revival phases (12–20):

| Tier | Use when | Examples in this phase |
|------|----------|------------------------|
| 🟢 **Sonnet 5** | Root cause is known, the fix is well-specified, and success is mechanically verifiable | REV-001 (three diagnosed fixes), REV-003 (CI assembly), REV-005 (bump/build/test), REV-006 (systematic doc audit) |
| 🟠 **Opus 4.8** | Substantial engineering with a clear target state, but opaque failure modes needing iterative diagnosis | REV-002 (Electron launch debugging), REV-004 (12-major upgrade), REV-007 (signing/notarisation) |
| 🔵 **Fable 5** | Work that *defines* an interface, semantics, or strategy — where the hard part is deciding what to build, not building it | None in this phase; see Phase 13 (SUB-004/005, MCP server) and Phase 18 (AI logic translation) |

Escalate a tier whenever a task stops being "apply the known fix" and starts being "figure out what the right thing is." Nothing here is model-gated: these are efficiency recommendations, not requirements.
