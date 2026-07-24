# DEBT-003: Expressions Cannot See Variables

## Metadata

| Field | Value |
|-------|-------|
| **ID** | DEBT-003 |
| **Phase** | Phase 14.5 — Revival Debt |
| **Priority** | 🔴 High |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 2–4 days |
| **Prerequisites** | None |
| **Recommended executor** | 🟠 **Opus 4.8** — the failure is characterised but the cause is not; this is iterative diagnosis in an old evaluator, with a stale-tests-vs-real-regression judgment call at the end |

## Objective

Determine why 15 runtime tests fail with expressions unable to read `Variables` (`Variables.x * 2` evaluates to `0`, expected `20`), then either fix the engine or correct the tests — with the decision recorded either way.

## Background

PLAT-003's slice work runs the runtime jest suite green-to-red as its regression gate; the baseline has been stable at **225 passing / 20 failing** through every slice. §4 of [PLAT-003-NOTES.md](../phase-14-editor-platform-health/PLAT-003-NOTES.md) characterises the largest failure cluster — 15 tests — as the expression evaluator not resolving `Variables`, and explicitly routes it out: *"deserves its own investigation… It is not, however, a typing problem."* No task ever picked it up.

This matters disproportionately: **expressions are exactly what AI agents author.** The whole substrate thesis (catalog → validator → MCP → authoring loop, Gate G2) assumes an agent can wire `Variables.total > 0` into a condition and have it work. If the engine is actually broken — not just the tests stale — every authored expression over Variables silently evaluates wrong, and neither the semantic validator (SUB-006) nor catalog enrichment (SUB-005) would catch it, since both operate on graph structure, not runtime evaluation.

## Key Files

| File | Role |
|------|------|
| [expression-evaluator.test.js](../../../packages/noodl-runtime/test/expression-evaluator.test.js) | Failing cluster |
| [node-expression-evaluation.test.js](../../../packages/noodl-runtime/test/node-expression-evaluation.test.js) | Failing cluster |
| `packages/noodl-runtime/src/` expression evaluator + Variables model | Suspects — locate the `Variables` binding path into evaluator scope |

## Implementation Steps

1. **Reproduce outside jest**: build the smallest live case — a project with a Variable and an expression node reading it — in the running editor and in a deployed export. This immediately splits the world: if live behaviour is *correct*, the tests are wiring the harness wrong (likely a fixture/registration gap); if live behaviour is *wrong*, this is a shipped engine defect.
2. Bisect where `Variables` should enter the evaluator's scope chain and find where the lookup returns `undefined`→`0`.
3. Fix the engine **or** fix the tests; if tests, record in this doc *why* the harness diverged and what the correct registration is.
4. Also close the adjacent §4 stragglers if cheap: `validateConfigValue` (1 failing, object-type rejection). The `QueryBuilder` cluster stays with DEBT-006.
5. Update PLAT-003's regression baseline (225/20) to the new green count so future slices gate on the improved number.

## Success Criteria

- [ ] Root cause identified and written down (engine defect vs stale harness — with evidence from the live reproduction)
- [ ] The 15 expression/Variables tests pass, or are corrected with recorded rationale
- [ ] Live check: an expression reading a Variable evaluates correctly in editor preview *and* deployed export
- [ ] PLAT-003's documented jest baseline updated from 225/20
- [ ] If it was a real engine defect: a note added to the AIX-002 authoring-loop docs, since authored expressions were affected

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| The evaluator is old and under-typed; a fix regresses other expression forms | The 225 passing tests are the guard; add cases for the specific scope-chain path touched |
| Turns out to be a deep design issue (scoping model), not a bug | Time-box the investigation; if it is architectural, write the finding up and escalate the *decision* rather than forcing a fix |

## References

- [PLAT-003-NOTES.md §4](../phase-14-editor-platform-health/PLAT-003-NOTES.md) — failure characterisation and routing recommendation
- Related: DEBT-006 (QueryBuilder cluster), AIX-002 (consumer of correct expression semantics)
