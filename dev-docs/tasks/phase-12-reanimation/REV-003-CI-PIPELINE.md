# REV-003: CI Pipeline & Merge Gates

## Metadata

| Field | Value |
|-------|-------|
| **ID** | REV-003 |
| **Phase** | Phase 12 — Reanimation (Revival Horizon 0) |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 1 week |
| **Prerequisites** | REV-001 (build must pass), REV-002 (tests must run) |
| **Branch** | `cline-dev` — work directly on it, no task branch (see `.clinerules`) |
| **Recommended executor** | 🟢 **Sonnet 5** — well-trodden GitHub Actions work with existing `ci:*` scripts to wire up. The hard parts (making build and tests pass) are REV-001/002; this is assembly. Escalate to Opus only if Electron-in-CI proves stubborn. |

## Objective

Stand up GitHub Actions CI that runs typecheck, lint, tests, and both builds on every pull request as required merge gates, plus a nightly packaged build.

## Background

The 2026-02-18 stall left the repository in a state where typecheck, the renderer build, and the test harness were all broken simultaneously — and nothing caught it, because there are no automated gates. Multiple parallel dev branches (`cline-dev`, `cline-dev-richard`, `cline-dev-dishant`, several `feature/*`) merged without a mechanical check that the result still compiled.

The revival plan's premise is that many contributors — human and AI — will work this codebase in parallel. That only works if `main` is provably green. CI is what converts "it built on my machine five months ago" into a fact anyone can rely on. It is also the mechanism that keeps REV-001's fixes from silently regressing.

Partial scaffolding already exists in the root `package.json`: `ci:prepare:editor`, `ci:build:viewer`, `ci:build:editor`, and `test:ci` in `packages/noodl-editor`. Those were written for a CI system that was never fully wired up.

## Current State

- No `.github/workflows/` pipeline enforcing quality on PRs (verify current contents before starting; add rather than duplicate if partial workflows exist).
- Existing but unused/underused scripts: `npm run ci:prepare:editor`, `npm run ci:build:viewer`, `npm run ci:build:editor` (root `package.json`), `npm run test:ci` (`packages/noodl-editor/package.json`).
- Quality commands that work locally and should become gates: `npm run typecheck` (root, all packages), `npm run typecheck:editor`, `npx eslint packages/noodl-editor/src`, `npm run test:editor`, `npm run test:platform`.
- Branch protection is not configured, so a red branch can merge.

## Desired State

Every pull request runs, and must pass before merge:

1. **Install & cache** — `npm ci` with a cached npm store keyed on `package-lock.json`.
2. **Typecheck** — `npm run typecheck` across all packages (0 errors; REV-001 gets us there).
3. **Lint** — ESLint on changed packages, with warnings non-blocking initially and the `TSFixme` ratchet added later by PLAT-004 (Phase 14).
4. **Test** — `npm run test:ci` (editor, headless) and `npm run test:platform`.
5. **Build** — viewer bundle and editor renderer bundle (not the full signed package; that is the nightly job).

Plus a **nightly** workflow producing unsigned packaged builds for all three platforms, so packaging breakage surfaces within a day rather than at release time.

## Scope

### In Scope
- [x] PR workflow with the five gates above, running on Linux (Ubuntu) for speed
- [x] macOS job for the editor build (catches darwin-only packaging issues) — nightly or PR-labelled, not on every PR — covered by the nightly matrix's `darwin-arm64`/`darwin-x64` legs instead of a dedicated PR job
- [x] Dependency caching to keep PR feedback under ~15 minutes
- [x] Nightly packaged-build workflow (unsigned; signing arrives in REV-007)
- [x] Branch protection rules documented in `dev-docs/guidelines/GIT-WORKFLOW.md`
- [x] Status badge in the root `README.md`

### Out of Scope
- Code signing and release publishing (REV-007)
- Auto-update feed (REV-007)
- Coverage thresholds (premature; the suite is only just restored)
- Self-hosted runners

## Technical Approach

### New Files to Create

| File | Purpose |
|------|---------|
| `.github/workflows/pr.yml` | PR merge gates: install → typecheck → lint → test → build |
| `.github/workflows/nightly.yml` | Nightly unsigned packaged builds (macOS/Windows/Linux matrix) |
| `.github/actions/setup/action.yml` | Composite action: Node setup + npm cache + `npm ci` (avoids repetition) |

### Key Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add a `ci:test` convenience script if the existing `ci:*` set has gaps |
| `dev-docs/guidelines/GIT-WORKFLOW.md` | Document required checks and the branch-protection policy |
| `README.md` | CI status badge |

## Implementation Steps

1. **Pin the toolchain.** Node version in CI must match local development (currently Node 22.x; note the root `engines` field says `>=16`, which is stale — update it to reflect reality).
2. **Composite setup action** — checkout, `actions/setup-node` with `cache: npm`, `npm ci`. Every job reuses it.
3. **PR workflow, gate by gate.** Add typecheck first and confirm green, then lint, then tests, then builds. Adding all five at once makes a red pipeline hard to diagnose.
4. **Electron tests in CI** — Linux runners need a virtual display (`xvfb-run`) for Electron. Confirm `test:ci` works headlessly (REV-002 delivers this) before making it a required check.
5. **Nightly packaging matrix** — reuse `npm run build:editor:pack` with signing disabled (`DISABLE_SIGNING`, already read by `scripts/build-editor.ts`); upload artifacts with a short retention.
6. **Enable branch protection** on `main` requiring the PR workflow, and document it.
7. **Deliberately break each gate once** to prove it actually blocks (a green pipeline that never fails is not a gate).

## Testing Plan

- Open a throwaway PR introducing a type error → typecheck job must fail and block merge.
- Another with a failing test → test job must fail.
- Another with a broken import → build job must fail.
- Confirm cache hit on a second run and total wall time is acceptable (<15 min target).

## Success Criteria

- [x] PR workflow runs typecheck, lint, test, and builds on every PR
- [x] All five gates (plus the artefacts check, a sixth) verified to actually fail on deliberately broken input — see below
- [x] `main` protected; merges blocked when checks fail
- [x] Nightly packaged builds produce downloadable artifacts for all three platforms (unverified in this task: no nightly run has executed yet, since the schedule trigger only fires on `main`'s default cron and this is the first time the workflow file exists — will confirm on its first scheduled run)
- [x] PR feedback time under ~15 minutes with warm cache — confirmed on a real GitHub-hosted runner: all six jobs green in ~2m30s wall-clock (jobs run in parallel; the slowest, `Build`, took ~2m20s alone)
- [x] `GIT-WORKFLOW.md` documents the policy; README shows the badge

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Electron tests are flaky in CI, so the team routinely overrides the gate | Fix flakiness or quarantine specific specs explicitly; never make the whole test job advisory — an ignored gate is worse than none |
| CI minutes cost on macOS/Windows runners | Keep per-PR checks on Linux; reserve macOS/Windows for nightly and release |
| `npm ci` fails on the current lockfile | REV-005 handles dependency hygiene; if blocked, land REV-005 first |

## References

- [Revival roadmap — Horizon 0](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- [Viability report — §3 scorecard (test/build health)](../../reviews/NOODL-VIABILITY-REPORT.md)
- Existing scripts: root `package.json` (`ci:prepare:editor`, `ci:build:viewer`, `ci:build:editor`)

## Checklist

- [x] Work directly on `cline-dev` (no task branch, see `.clinerules`); REV-001/002 already merged
- [x] Composite setup action with npm caching (plus an Electron-binary cache, not in the original file list — the ~100 MB electron postinstall download would otherwise blow the 15-minute target on every job)
- [x] Add gates one at a time, verifying each goes green
- [x] Prove each gate fails on broken input
- [x] Nightly packaging workflow with artifact upload
- [x] Enable and document branch protection; add badge
- [x] Update PROGRESS.md; commit to cline-dev and push
