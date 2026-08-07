# DEBT-004: Component Port Rename Silently Breaks Wirings

## Metadata

| Field | Value |
|-------|-------|
| **ID** | DEBT-004 |
| **Phase** | Phase 14.5 — Revival Debt |
| **Priority** | 🔴 High |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 2–4 days |
| **Prerequisites** | None |
| **Recommended executor** | 🟠 **Opus 4.8** — a real defect in old model code (rename propagation across component instances); the failing spec exists but the fix needs diagnosis |

## Objective

Fix the editor defect where renaming a component input/output does not propagate to existing instances — *"renaming a component input in the property panel silently breaks every existing wiring to it"* — and triage the two other quarantined specs in the same file that no phase-12 doc accounts for.

## Background

REV-002's test-harness revival found this while un-rotting the suite. [REV-002-NOTES.md](../phase-12-reanimation/REV-002-NOTES.md) (lines 27–49) is unambiguous: *"a real editor bug, not test rot… Needs its own task."* The spec was quarantined with `xit` and the task was never created. This is silent user-facing data corruption — the graph keeps stale connection references and nothing warns.

The 2026-07-24 audit additionally found that [componentinstances.js](../../../packages/noodl-editor/tests/components/componentinstances.js) holds **three** `xit` quarantines, of which REV-002 documented only the first:

| Line | Spec | Status |
|---|---|---|
| 36 | `can rename component inputs and outputs` | The documented bug |
| 47 | `can detect unhealthy connections` | Undocumented — pre-existing disabled coverage |
| 152 | `component renamed are propageted to component references` | Undocumented — possibly the same root cause at component (not port) level |

## Implementation Steps

1. Re-enable the line-36 spec locally and characterise the failure: where does the rename land (`bindTypeModel`/port models) and which propagation step never runs?
2. Fix the propagation so existing instance wirings follow the rename. Watch for: undo/redo integrity, v2-format serialization of the renamed port (SUB-001/SUB-002 own that path — a rename that propagates in memory but not on disk is the same bug one layer down), and multi-instance components.
3. Investigate the line-152 spec (component-rename propagation to references) — likely a sibling of the same mechanism. Fix if the root cause is shared; otherwise characterise and record.
4. Triage line 47 (`can detect unhealthy connections`) — determine whether the feature exists and rotted or never worked; fix cheaply or record a dated deferral *in the spec file itself* so the quarantine is no longer silent.
5. Re-enable every spec fixed; run the full Electron suite (`npm run test:ci`) — REV-002's notes warn the suite is order-sensitive (see DEBT-005), so confirm no new inter-spec leakage.
6. Live check: rename a component input in the property panel of a running editor with two instances wired; confirm both wirings survive, undo works, and the saved project reopens intact.

## Success Criteria

- [ ] Port renames propagate to all existing instance wirings, in memory and on disk (both format versions)
- [ ] `xit` at line 36 restored to `it` and passing
- [ ] Lines 47 and 152 each: fixed and re-enabled, **or** carrying a dated in-file comment explaining exactly why they stay quarantined
- [ ] Rename is undoable; no regression in the 540-spec suite
- [ ] Live editor verification performed

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Rename propagation touches connection identity, which SUB-007's merge engine also relies on (node id is the only merge identity) | Port names are parameter-level, not node identity — but run the `tests/versioning/` suite after the fix to be sure |
| The unhealthy-connections spec (47) turns out to be a missing feature, not a bug | That's a scope decision — record it and stop; don't build features under a debt task |

## References

- [REV-002-NOTES.md](../phase-12-reanimation/REV-002-NOTES.md) lines 27–49 — the discovery record
- [componentinstances.js](../../../packages/noodl-editor/tests/components/componentinstances.js) — all three quarantines
- Related: DEBT-005 (suite order-sensitivity), SUB-002 (round-trip fidelity of the renamed port)
