# DEBT-007: Release & Dependency Hygiene

## Metadata

| Field | Value |
|-------|-------|
| **ID** | DEBT-007 |
| **Phase** | Phase 14.5 — Revival Debt |
| **Priority** | 🔴 High — **must land before the first signed release** |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 2–4 days |
| **Prerequisites** | None (REV-007's human-gated signing steps are *not* a prerequisite — this prepares for them) |
| **Recommended executor** | 🟢 **Sonnet 5** for the dependency and workflow items; the universal-build item escalates to 🟠 **Opus 4.8** if electron-builder fights back |

## Objective

Close the release-blocking and security items that phases 12's docs flagged as "must fix before v0.1.1" or "deferred as its own task" — before REV-007's human-gated signing steps make them live problems.

## Scope

### 1. `latest-mac.yml` per-arch overwrite → universal build

[REV-007-SHIP-V0.md](../phase-12-reanimation/REV-007-SHIP-V0.md) (lines 39–41) and phase-12 PROGRESS both record: the per-arch macOS release jobs each overwrite `latest-mac.yml`, so the auto-update feed points at whichever arch uploaded last. *"Must be fixed (universal build) before v0.1.1."* Harmless while unsigned; **wrong on the first signed release** — auto-update is one of REV-007's unmet exit criteria, and it will misbehave for half of macOS users the moment it goes live.

- [ ] Implement the universal macOS build (electron-builder `universal` target), or — if universal is genuinely blocked — merge the per-arch feed files correctly in the release workflow. Universal was "evaluated and deferred," so read RELEASE-PROCESS.md §6 first for what the evaluation found.
- [ ] Verify: one release run produces a `latest-mac.yml` that serves both architectures; auto-update dry-run against it (unsigned is fine for the mechanics).

### 2. `passport` 0.5.3 → 0.7 (session fixation, CVSS 4.8)

[REV-005-NOTES.md](../phase-12-reanimation/REV-005-NOTES.md) (lines 198–207): reachable in the bundled Parse dashboard auth path; *"accepted risk, documented, deferred as its own task"* — the task was never created. Pinned at `passport: 0.5.3` in [noodl-parse-dashboard/package.json](../../../packages/noodl-parse-dashboard/package.json).

- [ ] Upgrade to 0.7.x. The 0.6+ breaking change is session regeneration on login/logout — exercise the dashboard login flow afterwards, since that is exactly the surface the change touches.
- [ ] Record the closure in DEPENDENCY-POLICY.md (which currently carries the accepted-risk note).

### 3. Dead node-16 workflows

[REV-005-NOTES.md](../phase-12-reanimation/REV-005-NOTES.md) (lines 44–51, 124–129) flagged three obsolete workflows *"left as a note for whoever next touches `.github/workflows/`"* — still present and still `node-version: 16`: `build-noodl-editor.yml`, `publish-cloud-runtime.yml`, `test-noodl-editor.yml`.

- [ ] Confirm nothing references them (they predate REV-003's pr/nightly/release set), then delete. If one turns out to be load-bearing, that's a finding — record it.

### 4. `dugite`/`got`/`tar` advisories — re-check, don't necessarily fix

REV-005 accepted these as install-time-only risk, *"worth a dedicated task if/when dugite ships a minor that resolves it without the major jump."*

- [ ] Check whether that dugite minor now exists. If yes, take it; if no, re-date the accepted-risk note and stop. This item is a check, not a mandate.

## Success Criteria

- [ ] A single release-workflow run yields a correct dual-arch (or universal) auto-update feed
- [ ] `passport` ≥ 0.7 with the dashboard login flow verified working
- [ ] `.github/workflows/` contains only live workflows
- [ ] DEPENDENCY-POLICY.md updated (passport closed; dugite decision re-dated)
- [ ] `npm run build:editor` and the packaged-app launch check still green (the packaging traps note: a green build proves nothing — launch it)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Universal build doubles bundle size or breaks native modules | The prior evaluation deferred it for a reason — read it first; the workflow-side feed merge is the fallback that still fixes the actual defect |
| passport 0.6+ session-regeneration breaks dashboard auth silently | Manual login/logout verification is in scope, not optional |
| Deleting a workflow something external triggers | Search org/repo settings and workflow `on:` triggers before deleting; deletion is a revertable commit on cline-dev |

## References

- [REV-007-SHIP-V0.md](../phase-12-reanimation/REV-007-SHIP-V0.md), RELEASE-PROCESS.md §6, [REV-005-NOTES.md](../phase-12-reanimation/REV-005-NOTES.md), DEPENDENCY-POLICY.md
- Related: DEBT-002 verifies the three-platform nightly artifacts this task's workflows feed
