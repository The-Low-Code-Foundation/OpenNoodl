# REV-005: Dependency Hygiene

## Metadata

| Field | Value |
|-------|-------|
| **ID** | REV-005 |
| **Phase** | Phase 12 — Reanimation (Revival Horizon 0) |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 1 week |
| **Prerequisites** | REV-001; best done alongside or just after REV-004 |
| **Branch** | `cline-dev` — work directly on it, no task branch (see `.clinerules`) |
| **Recommended executor** | 🟢 **Sonnet 5** — mechanical and verifiable: bump, build, test, repeat. The one judgement call (which vulnerabilities are genuinely reachable) is documented below. Hand any single dependency that turns into a migration project to Opus as its own task. |

## Objective

Remediate the security-audit backlog, unify TypeScript across all packages at 5.9.3, and remove duplicate/conflicting toolchain versions — without changing product behaviour.

## Background

The repository carries a large but mostly shallow dependency backlog. The important framing from the 2026-07-22 assessment is that **most of it is build tooling, not shipped code**: of 96 total audit findings, 36 remain when dev dependencies are excluded, and the critical ones cluster in publishing/packaging paths (lerna, electron-builder, storybook, the s3/aws-sdk upload path) rather than in anything an end user's app executes. The genuinely user-facing security item is Electron itself, which REV-004 handles separately.

The more corrosive problem is not vulnerabilities but **version incoherence**: three packages still pin TypeScript 4.9.5 while the editor and root use 5.9.3, and webpack-cli exists at both 4.x and 5.x in different packages. Split toolchains produce errors that reproduce in one package and not another, which is exactly the kind of friction that makes a codebase feel unsalvageable when it is not.

## Current State

Measured 2026-07-22:

- `npm audit`: **96 vulnerabilities** (7 critical, 46 high, 30 moderate, 13 low). `npm audit --omit=dev`: **36** (4 critical, 14 high).
  - Critical: `handlebars`, `lodash` (no fix available), `minimist`, `mkdirp`, `shell-quote`, `tar`, `websocket-driver`.
  - High includes: `electron`, `electron-builder`, `storybook`, `lerna`/`nx` toolchain, `aws-sdk` (no fix), `underscore`, `axios`, `path-to-regexp`.
- **TypeScript split-brain**: `noodl-editor` and root are on `5.9.3`; `noodl-viewer-react`, `noodl-core-ui`, and `noodl-viewer-cloud` pin `4.9.5`.
- **webpack-cli duplication**: 4.10.0 in `noodl-editor` and `noodl-viewer-react`; 5.1.4 at root and in `noodl-viewer-cloud`.
- Babel packages at 7.28.x with 7.29.x available (8.x exists but is a major — out of scope here).
- `npm outdated` reports ~129 rows overall; the large majority are minor/patch.
- Root `package.json` `engines` says `node >=16` / `npm >=6`, which no longer reflects reality (development is on Node 22).

## Desired State

- Zero **critical** and zero **high** findings in `npm audit --omit=dev`, or each remaining one explicitly documented as unreachable with a reason.
- TypeScript 5.9.3 everywhere, with each package typechecking cleanly.
- One webpack-cli major across the monorepo; no duplicated build-toolchain majors.
- `engines` reflects the actual supported Node/npm.
- No product behaviour change; all tests green.

## Scope

### In Scope
- [ ] `npm audit fix` for non-breaking remediations; case-by-case assessment of the rest
- [ ] Unify TypeScript at 5.9.3 across all packages and fix resulting type errors
- [ ] Deduplicate webpack-cli and other split-major build tooling
- [ ] Patch/minor bumps that are safe and reduce audit noise
- [ ] Update `engines` in root `package.json`
- [ ] Write `dev-docs/reference/DEPENDENCY-POLICY.md`: what we upgrade automatically, what needs a task, how we document accepted risk

### Out of Scope
- Electron and electron-builder (REV-004)
- Storybook 8 → 10 (a major migration; separate task if wanted)
- Babel 7 → 8, TypeScript → 7.x (majors; not now)
- `@anthropic-ai/sdk` modernisation (AIX-001 in Phase 15 rewrites that client anyway)
- Replacing `aws-sdk`/`s3` (no-fix advisories) — assess reachability and document; replacement is its own task if it is actually used

### Notes on unfixable advisories
`lodash`, `aws-sdk`, `s3`, and `mime` have advisories with no fix available. Do not churn on them. For each, determine whether the vulnerable code path is reachable in our usage (most are in publishing/build paths that run on maintainer machines, not user machines) and record the finding in `DEPENDENCY-POLICY.md`. Accepted, documented risk is a legitimate outcome; silent risk is not.

## Technical Approach

### Key Files to Modify

| File | Changes |
|------|---------|
| `packages/noodl-viewer-react/package.json` | TypeScript 4.9.5 → 5.9.3; webpack-cli alignment |
| `packages/noodl-core-ui/package.json` | TypeScript 4.9.5 → 5.9.3; `@types/node` 16 → 18/22 |
| `packages/noodl-viewer-cloud/package.json` | TypeScript 4.9.5 → 5.9.3 |
| `package.json` (root) | `engines`; toolchain dedupe |
| `package-lock.json` | Regenerated |

### New Files to Create

| File | Purpose |
|------|---------|
| `dev-docs/reference/DEPENDENCY-POLICY.md` | Upgrade cadence, accepted-risk register, rules for majors |

## Implementation Steps

1. **Snapshot the baseline.** Save `npm audit`, `npm audit --omit=dev`, and `npm outdated` output into the task's NOTES.md so the delta is provable.
2. **Safe automated pass.** `npm audit fix` (no `--force`). Run typecheck, tests, and both builds. Commit as an isolated changeset.
3. **TypeScript unification.** Bump the three lagging packages to 5.9.3 one at a time, fixing type errors per package. TS 4.9 → 5.9 is usually mild, but `noodl-viewer-react` has 131 untyped `.js` files, so expect churn where JS meets TS.
4. **Toolchain dedupe.** Align webpack-cli on 5.x; re-run builds for every package.
5. **Case-by-case review** of remaining critical/high findings. For each: is it dev-only? Is the path reachable? Fixable without a major? Record the decision.
6. **Update `engines`** to the Node/npm actually in use, and make CI (REV-003) enforce that version.
7. **Write `DEPENDENCY-POLICY.md`** — including the accepted-risk register from step 5.

## Testing Plan

- After each step: `npm run typecheck`, `npm run test:editor`, `npm run test:platform`, viewer + editor renderer builds.
- Clean-clone verification: `rm -rf node_modules && npm ci` then full build, to catch hoisting-dependent breakage (the exact failure mode behind REV-001's Ajv problem).
- Storybook still starts (`npm run start:storybook`) — it is a common casualty of TypeScript bumps.

## Success Criteria

- [ ] `npm audit --omit=dev` reports zero critical/high, or each is documented as accepted with reasoning
- [ ] TypeScript 5.9.3 in every package; all typecheck cleanly
- [ ] Single webpack-cli major across the repo
- [ ] `npm ci` from a clean clone builds and tests successfully
- [ ] `engines` accurate; CI pins the same version
- [ ] `DEPENDENCY-POLICY.md` exists with the accepted-risk register

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `npm audit fix` silently introduces breaking transitive changes | Never use `--force`; run the full verification suite after each pass; keep changesets isolated so bisecting works |
| TS 5.9 surfaces a wave of errors in `noodl-viewer-react` | Package-at-a-time; if one package explodes, land the others and split it into its own task (it overlaps PLAT-003's typing work in Phase 14) |
| Chasing zero audit findings burns a week for no security gain | Explicit policy: fix reachable and shipped; document the rest. Zero-count is not the goal |
| Lockfile churn conflicts with parallel branches | Land promptly; coordinate with whoever holds REV-004 |

## References

- [Viability report — Appendix B (dependency probes)](../../reviews/NOODL-VIABILITY-REPORT.md)
- [Revival roadmap — Horizon 0](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- Related: REV-004 (Electron), PLAT-003 (typing the runtime, Phase 14)

## Checklist

- [ ] Branch `task/rev-005-dependency-hygiene`; snapshot baseline audit output
- [ ] Safe `npm audit fix` pass + full verification
- [ ] TypeScript unified to 5.9.3 package by package
- [ ] Toolchain dedupe; builds verified
- [ ] Case-by-case review of remaining findings; record decisions
- [ ] Update `engines`; write `DEPENDENCY-POLICY.md`
- [ ] Clean-clone `npm ci` verification; CHANGELOG; commit to cline-dev and push
