# DEBT-002: The Live Verification Pass

## Metadata

| Field | Value |
|-------|-------|
| **ID** | DEBT-002 |
| **Phase** | Phase 14.5 — Revival Debt |
| **Priority** | 🔴 High |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 2–3 days |
| **Prerequisites** | None (all blockers cleared: PLAT-002 landed, nightly workflow exists) |
| **Recommended executor** | 🟠 **Opus 4.8** — driving the real editor with opaque failure modes; each finding needs on-the-spot diagnosis to decide "record it" vs "trivially fix it" |

## Objective

Run, in one structured pass, every live check that phases 12–14 promised and never executed. This task produces **verification evidence and a findings list**, not features — anything broken beyond a trivial fix becomes its own follow-up.

## Background

The 2026-07-24 audit found a pattern across all three phases: shipped surfaces validated by unit tests only, with the live check recorded as "owed" and then never run. Individually each deferral was reasonable (the dev stack was slow to boot, PLAT-002 was churning the DOM, no second project was at hand). Collectively, a large amount of "done" work has never been seen working. PLAT-003's own notes say the live pass *"should go first if anything does."*

## Scope — the checklist

### In the running editor (use the `run-editor` harness)

- [ ] **PLAT-003 live editor pass** — open a real project; exercise converted node groups (visual, logic, `data/`); confirm no regressions from seven slices of runtime conversion. Owed since slice 2 ([PLAT-003-NOTES.md](../phase-14-editor-platform-health/PLAT-003-NOTES.md) §18 item 2).
- [ ] **SUB-006 validator panel smoke** — introduce a validation error; confirm the Problems panel surfaces the diagnostic and navigates to the offending node ([SUB-006](../phase-13-format-ai-substrate/SUB-006-SEMANTIC-VALIDATOR.md) final checklist).
- [ ] **SUB-007 conflict UI** — manufacture a real merge conflict (two branches editing the same component); confirm `GraphConflictList` renders and value-conflict resolution applies without hand-editing JSON. This UI has *never rendered live* ([SUB-007-GRAPH-NATIVE-GIT.md](../phase-13-format-ai-substrate/SUB-007-GRAPH-NATIVE-GIT.md) "Still open").
- [ ] **SUB-007 large-diff legibility** — read the diff panel on a large realistic change (the 176-component corpus project is a candidate base); record whether collapsing/summary/grouping follow-ups are needed and file them against AIX-003.
- [ ] **SUB-001 large-project claims** — with `formatV2.enabled` on and a large real project: measure save latency (<100 ms typical target), kill the process mid-save repeatedly, confirm no corruption on reopen ([SUB-001](../phase-13-format-ai-substrate/SUB-001-EDITOR-V2-INTEGRATION.md) deferred list).
- [ ] **PLAT-002 owed import-popup variants** — drive the **import** and **collisions/overwrite** paths of `importpopup.ts` with a second project ([PLAT-002-NOTES.md §8](../phase-14-editor-platform-health/PLAT-002-NOTES.md), "owed verification, never paid").

### On CI / packaging

- [ ] **Trigger the nightly workflow** — no scheduled run had executed as of REV-003's close ([REV-003](../phase-12-reanimation/REV-003-CI-PIPELINE.md) line ~103); confirm it produces downloadable artifacts for macOS, Windows, and Linux.
- [ ] **Launch the installers** — as far as any doc shows, **no Windows or Linux installer has ever been built or launched** (REV-004 verified macOS `--dir` only). Install and boot each; record results in REV-003/REV-004's checklists.

### Out of Scope

- Fixing anything non-trivial found along the way — file it (into DEBT tasks or new ones) and keep moving
- Signing/notarisation (human-gated, REV-007)
- The migration wizard UI, MCP publish, and other *recorded deliberate deferrals*

## Success Criteria

- [ ] Every checklist item above executed with the result recorded in the *originating task's* doc (tick the box or annotate the deferral)
- [ ] A findings list appended to this task's section in PROGRESS.md — each finding either fixed-trivially (noted) or spawned as a task
- [ ] The three-platform installer claim is finally evidence-backed (or the failure is precisely characterised)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| The pass finds real breakage and balloons | Hard rule: diagnose, record, move on. This task's deliverable is the evidence, not the fixes |
| No large real project at hand for SUB-001/SUB-007 checks | The SUB-009 corpus project (176 components) is in-repo test material; see [SUB-009](../phase-13-format-ai-substrate/SUB-009-LIVE-PREVIEW-HARNESS.md) for its location and known module caveat (DEBT-008) |
| Windows/Linux install checks need hardware/VMs | The nightly artifacts can be smoke-booted in CI runners or VMs; if genuinely blocked, record *exactly* what remains unverified rather than letting the claim stand |

## References

- Audit of 2026-07-24 (this phase's README) — the consolidated "never proven live" list
- `run-editor` harness notes in [SUB-007-GRAPH-NATIVE-GIT.md](../phase-13-format-ai-substrate/SUB-007-GRAPH-NATIVE-GIT.md) (pointer-event dispatch, port-8080 cleanup traps)
