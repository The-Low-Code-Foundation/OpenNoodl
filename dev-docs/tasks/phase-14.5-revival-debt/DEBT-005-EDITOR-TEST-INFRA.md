# DEBT-005: Editor Test-Infrastructure Debt

## Metadata

| Field | Value |
|-------|-------|
| **ID** | DEBT-005 |
| **Phase** | Phase 14.5 — Revival Debt |
| **Priority** | 🟡 Medium |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 3–5 days |
| **Prerequisites** | None |
| **Recommended executor** | 🟠 **Opus 4.8** — global-state isolation across an old Electron/jasmine suite is exactly the "opaque failure modes needing iterative diagnosis" case |

## Objective

Give the editor package a test infrastructure with no dead zones: every committed spec executes in *some* runner, the suite tolerates randomized order again, and the one known suite-breaking hazard is defused.

## Background

Three separate phases each found a piece of this and each declared it someone else's job. Nobody was the someone.

1. **~500 lines of coverage that has never executed.** `GitHubClient.test.ts` and [StyleAnalyzer.test.ts](../../../packages/noodl-editor/tests/services/StyleAnalyzer.test.ts) are Jest specs in a package with **no Jest runner** ([PLAT-004-NOTES.md](../phase-14-editor-platform-health/PLAT-004-NOTES.md) §10/§12: *"it belongs to whoever owns the editor's test infrastructure, not to this task"*). REV-008's stream D4 converted the cheap ones and explicitly left StyleAnalyzer as *"needs real work"* ([REV-008](../phase-12-reanimation/REV-008-DEV-LOOP-HARDENING.md) line ~314).
2. **A live suite-breaking hazard.** [tests/models/index.ts](../../../packages/noodl-editor/tests/models/index.ts) line 11 exports `./StyleAnalyzer.test`, and the spec imports `@jest/globals` — the exact pattern REV-008 warns *"throws at module load and takes down the entire Electron suite."* Whether the export currently resolves to a converted models-path copy or the unconverted services-path file needs one test run to settle — the audit flagged it as ambiguous. **Resolve this first**; if it's live, it may be silently masking suite results today.
3. **Order-dependence, pinned rather than fixed.** [REV-002-NOTES.md](../phase-12-reanimation/REV-002-NOTES.md) lines 64–69: export-bundle assertions are order-dependent and inter-spec global state leaks, so the suite runs with randomization off as a workaround. The follow-ups — *"make the export bundler assertions order-independent"* and *"isolate global state between specs so randomized order can be turned back on"* — were never picked up.

Note the stakes for item 1: `StyleAnalyzer` is the engine PLAT-005 is about to wire into the property panel, on the strength of "17 passing tests" — tests that have never run.

## Implementation Steps

1. **Settle the hazard (item 2)**: run `npm run test:ci`, trace what `tests/models/index.ts:11` actually loads, and either fix the export or convert the target — whichever makes the suite honest. Record what was actually happening.
2. **Decide the runner strategy for the orphaned Jest specs**: convert `GitHubClient.test.ts` and `StyleAnalyzer.test.ts` to the Electron/jasmine suite (REV-008's D4 recipe), or stand up a real Jest lane for the editor package. Converting is the path of least infrastructure; a Jest lane only pays if more Jest specs are coming. Recommend: convert.
3. **Run the newly-executing specs** — expect failures; 500 lines of never-run assertions will have drifted. Fix spec or code as evidence dictates, and tell PLAT-005 what the StyleAnalyzer's *actual* test status is.
4. **De-order the export-bundle assertions** and isolate the leaked global state (REV-002-NOTES names the specs); then flip randomization back on and run the suite repeatedly to shake out stragglers.
5. While in the area: REV-002's other loose thread, the dugite fallback-path log noise (REV-002-NOTES lines 98–104), is a 30-minute silencing fix if it's still present — take it or explicitly leave it to DEBT-010.

## Success Criteria

- [ ] Zero committed spec files that no runner executes (verified by an inventory, not assumption)
- [ ] The `@jest/globals`-export hazard resolved and the finding recorded
- [ ] StyleAnalyzer's real test status known and communicated to PLAT-005 before banner wiring starts
- [ ] Suite passes with randomized order enabled in CI
- [ ] Spec count in CI ≥ current 705, with the delta explained

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Randomized order exposes a long tail of couplings | Fix them in batches with the seed pinned per run; if the tail is genuinely long, land order-independence incrementally but *keep the tracking honest* — no silent re-pin |
| Never-run specs fail against current code in non-trivial ways | That's the point — each failure is either dead code or a real regression; triage rather than mass-skip |

## References

- [PLAT-004-NOTES.md §10/§12](../phase-14-editor-platform-health/PLAT-004-NOTES.md), [REV-008 D4](../phase-12-reanimation/REV-008-DEV-LOOP-HARDENING.md), [REV-002-NOTES.md](../phase-12-reanimation/REV-002-NOTES.md)
- Related: PLAT-005 (StyleAnalyzer consumer), DEBT-004 (adds specs to this suite)
