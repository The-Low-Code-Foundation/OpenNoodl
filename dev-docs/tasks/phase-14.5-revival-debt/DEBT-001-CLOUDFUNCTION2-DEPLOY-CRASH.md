# DEBT-001: Cloud Function Node Crashes in Every Deployed App

## Metadata

| Field | Value |
|-------|-------|
| **ID** | DEBT-001 |
| **Phase** | Phase 14.5 — Revival Debt |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🟢 Easy |
| **Estimated Time** | 0.5–1 day |
| **Prerequisites** | None |
| **Recommended executor** | 🟢 **Sonnet 5** — root cause is precisely documented, the fix is local, and success is mechanically verifiable with a deployed build |

## Objective

Fix `cloudfunction2.doCall` so the Cloud Function node works in deployed apps and fails gracefully (via its `failure` output) when a project has no cloud services configured.

## Background

PLAT-003's slice-7 typing pass surfaced this as finding #1 of its accumulated defects list (§17.7 of [PLAT-003-NOTES.md](../phase-14-editor-platform-health/PLAT-003-NOTES.md)), calling it *"the most serious thing typing has turned up in seven slices"* and saying it *"should not wait for a tidy batch."* It has waited. This task is the batch.

Two defects in the same method:

1. `doCall` reads `this.context.editorConnection.isRunningLocally()` **outside** the editor-connection guard. In a deployed app `editorConnection` is undefined, so **every call of the Cloud Function node throws a `TypeError`** instead of executing.
2. On the code path that has just warned that `cloudServices` is undefined, the method proceeds to read `cloudServices.appId` — so a project with no cloud services configured **throws** instead of signalling the node's `failure` output.

## Key Files

| File | Changes |
|------|---------|
| [cloudfunction2.ts](../../../packages/noodl-viewer-react/src/nodes/std-library/data/cloudfunction2.ts) | Guard the `isRunningLocally()` read; route the missing-`cloudServices` path to the `failure` output instead of falling through to `cloudServices.appId` |

## Implementation Steps

1. Re-read PLAT-003-NOTES §17.7 #1 for the exact line references and the author's suggested shape of the fix.
2. Move the `isRunningLocally()` read inside the existing `editorConnection` guard (or add an optional-chained equivalent that preserves editor-side behaviour exactly).
3. On the no-`cloudServices` path, emit the node's `failure` output with a meaningful error and return — do not fall through.
4. Add a characterisation test that constructs the node with a deploy-shaped context (no `editorConnection`, no `cloudServices`) and asserts: no throw, `failure` signalled.
5. Verify in a real deployed build: `deployToFolder` a project using a Cloud Function node, open it, confirm the call executes (with cloud services) and fails cleanly (without).

## Success Criteria

- [ ] Cloud Function node executes successfully in a deployed app with cloud services configured
- [ ] A project without cloud services signals the node's `failure` output — no uncaught `TypeError` in either case
- [ ] Characterisation test covering the deploy-shaped context passes
- [ ] Editor-side (preview) behaviour unchanged
- [ ] PLAT-003-NOTES findings list updated to mark #1 resolved

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| The typing pass (PLAT-003) is still active in adjacent `data/` files | The file already converted in slice 7; the fix is behavioural, not typing. Note the change in PLAT-003's NOTES so its findings ledger stays accurate |
| Editor-side behaviour regression | Preserve the guarded editor path byte-for-byte; the fix only changes what happens when `editorConnection`/`cloudServices` are absent |

## References

- [PLAT-003-NOTES.md §17.7 #1](../phase-14-editor-platform-health/PLAT-003-NOTES.md) — discovery record and severity call
- Related: DEBT-006 carries the rest of the §17.7 findings list
