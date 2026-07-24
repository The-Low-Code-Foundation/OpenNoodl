# Phase 14.5 — Revival Debt

**Created:** 2026-07-24
**Source:** Cross-phase audit of phases 12–14 (reanimation, format & AI substrate, editor platform health) run on 2026-07-24. Every item here was *found and honestly recorded* by those phases' NOTES/PROGRESS files but was left without an owning task. This phase gives each an owner so the items stop living only in NOTES sections.

The audit's overall verdict was positive: the phases' load-bearing "done" claims all held up under repo spot-checks. What accumulated instead is three kinds of debt:

1. **Defects logged but unfixed** — most seriously a crash in every deployed app's Cloud Function node.
2. **Verification promised but never run** — a cluster of "shipped" surfaces that have never been exercised in the running app or on real infrastructure.
3. **Orphaned follow-ups** — cleanups and decisions explicitly deferred "to their own task" where the task was never created.

## Tasks

| Task | Title | Priority | What it closes |
|---|---|---|---|
| [DEBT-001](./DEBT-001-CLOUDFUNCTION2-DEPLOY-CRASH.md) | Cloud Function node crashes in deployed apps | 🔴 Critical | PLAT-003's most serious latent defect |
| [DEBT-002](./DEBT-002-LIVE-VERIFICATION-PASS.md) | The live verification pass | 🔴 High | Every owed-but-never-run live check across phases 12–14 |
| [DEBT-003](./DEBT-003-EXPRESSION-VARIABLES-ENGINE.md) | Expressions cannot see Variables | 🔴 High | 15 failing runtime tests on the AI-authoring critical path |
| [DEBT-004](./DEBT-004-COMPONENT-PORT-RENAME.md) | Component port rename silently breaks wirings | 🔴 High | REV-002's quarantined editor bug + two undocumented quarantines |
| [DEBT-005](./DEBT-005-EDITOR-TEST-INFRA.md) | Editor test-infrastructure debt | 🟡 Medium | Never-executed Jest specs, a suite-breaking export, pinned spec order |
| [DEBT-006](./DEBT-006-RUNTIME-LATENT-DEFECTS.md) | Runtime latent-defect batch | 🟡 Medium | PLAT-003's accumulated findings list (minus DEBT-001) |
| [DEBT-007](./DEBT-007-RELEASE-DEPENDENCY-HYGIENE.md) | Release & dependency hygiene | 🔴 High (pre-v0.1.1) | `latest-mac.yml` overwrite, passport CVE, dead workflows |
| [DEBT-008](./DEBT-008-LEGACY-MODULE-RUNTIME-COMPAT.md) | Legacy ES5 modules vs the class-based runtime | 🟡 Medium | The corpus-project-doesn't-paint incompatibility from SUB-009 |
| [DEBT-009](./DEBT-009-EXTERNAL-AUTHORING-FRICTION.md) | External-authoring friction | 🟡 Medium | SUB-010's routed-but-unactioned findings; the v2 flag default |
| [DEBT-010](./DEBT-010-SMALL-CLEANUPS-AND-RECORDS.md) | Small cleanups & record-keeping | 🟢 Low | PLAT-002 §8 leftovers, doc staleness, phantom phase-2 completion |

## Suggested order

**DEBT-001 first** — it is a crash in shipped output and its own source doc says it "should not wait for a tidy batch." **DEBT-002 second** — it is pure verification, may reveal that other items are worse (or better) than documented, and PLAT-003's notes say the live pass "should go first if anything does." DEBT-007 must land **before the first signed release** (v0.1.1 or the completion of REV-007's human-gated remainder). The rest are independent and can interleave with other phases' work.

## Conventions

Work commits straight to `cline-dev` per repo convention — no task branches, no PRs. Where a task here touches files owned by an in-progress task (PLAT-003 is still converting `navigation/`; AIX-002 is actively building on the validation module), coordinate via the owning task's NOTES file before editing shared surfaces.

## Relationship to other phases

This phase creates no new capability. It exists so that phases 15+ (AI collaboration, runtime health, Learn) build on ground that is as solid as the phase 12–14 docs *claim* it is. Items the audit found that **already have owners elsewhere** are deliberately absent here: STYLE-005 banner wiring (PLAT-005), the CF11 dead data pipeline (WF-001), large-diff review UI (AIX-003), SUB-003's migration wizard UI (its own recorded deferral), and PLAT-003's remaining slices (PLAT-003 itself).
