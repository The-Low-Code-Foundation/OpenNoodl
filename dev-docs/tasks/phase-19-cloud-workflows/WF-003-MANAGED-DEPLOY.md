# WF-003: One Managed Deploy Target, Done Well

## Metadata

| Field | Value |
|-------|-------|
| **ID** | WF-003 |
| **Phase** | Phase 19 — Cloud & Workflows (Revival Track G) |
| **Priority** | 🟡 Medium |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 2–3 weeks |
| **Prerequisites** | REV-007 (packaging/release infrastructure); WF-001 if workflows are included |
| **Branch** | `task/wf-003-managed-deploy` |
| **Recommended executor** | 🟠 **Opus 4.8** — deployment tooling fails in environment-specific, opaque ways (credentials, networking, build contexts). Moderate complexity, high frustration surface. |

## Objective

Make deploying a Noodl application to one managed hosting target a documented, repeatable, single-path operation — and deliberately not build the multi-provider matrix.

## Background

The original roadmap wanted deployment everywhere: Docker, Fly.io, Railway, plus PWA, Capacitor, Electron, and browser-extension targets across phases 5 and 11. Three of eleven phase-5 tasks landed and the rest did not, which is the predictable outcome of spreading a small team across a matrix.

The revival plan takes the opposite position, for two reasons. First, arithmetic: every additional target multiplies documentation, testing, and support surface, and a partially-supported deploy path generates more user frustration than no path at all, because it implies a promise. Second, and more interesting: **Phase 18's code export is the real answer to "I want to host this my way."** A user who exports gets a standard React application they can deploy anywhere by conventional means. That serves the general case far better than five bespoke wrappers ever could, which frees this task to serve the specific case — the user who wants to click deploy and have it work — with a single well-supported path.

So the discipline here is to pick one target, make it genuinely good, and document the alternative (export and deploy conventionally) for everyone else.

## Current State

- Phase 5 delivered a BYOB backend panel, data nodes, and an integrated local SQLite backend (with the known reliability problem RUN-004 addresses). The five alternate deployment targets were never started.
- Phase 11 proposed container-based cloud deploy across multiple providers; not started.
- REV-007 provides signed application builds and release infrastructure — a different concern (distributing the editor) but the same tooling neighbourhood.
- `packages/noodl-viewer-cloud` provides a cloud runtime that a deployed application would use.
- No documented, supported path exists today for deploying a Noodl application to managed hosting.

## Desired State

- One managed target chosen on evidence, supported properly.
- A user can deploy from the editor, or by following a short documented procedure, and get a working application.
- Deployment is repeatable — the same project deploys the same way tomorrow.
- Configuration (environment variables, backend connection, secrets) is handled clearly and safely.
- Documentation covers the happy path, the common failures, and how to roll back.
- Everyone else is pointed at code export as the general-purpose answer.

## Scope

### In Scope
- [ ] Choose the target on evidence (see below) and record the reasoning
- [ ] Build/packaging pipeline for a deployable application artifact
- [ ] Deployment mechanism (from the editor or via a documented CLI procedure)
- [ ] Configuration and secret handling
- [ ] Workflow/cloud-function deployment if WF-001/002 have landed
- [ ] Rollback procedure
- [ ] Documentation: happy path, troubleshooting, rollback
- [ ] An explicit pointer to code export as the alternative for other hosting

### Out of Scope
- Additional providers (that is the matrix this task exists to avoid)
- A first-party hosting product (ECO-004, Phase 20)
- PWA, Capacitor, Electron-app, and extension targets (parked with phase 5)
- Custom domains, TLS management, and CDN configuration beyond what the chosen provider handles

## Technical Approach

### Choosing the target

Do not choose by preference. Decide against these criteria, and record the decision:

- **Where do actual users want to deploy?** If pilot users or the community have a clear preference, that outranks every technical consideration.
- **Self-host versus managed.** Docker Compose self-hosting serves users with existing infrastructure and privacy requirements — notably relevant to the education wedge, where school data may not be allowed off-premises. A managed platform serves users who want no infrastructure at all. These are different users; pick the one the product is actually serving.
- **Cost and friction for a beginner.** If the target requires a credit card and a cloud account before anything works, it is the wrong target for a learning-oriented product.

A defensible default, given the education emphasis in Phase 17 and the export escape hatch in Phase 18, is **Docker Compose self-hosting**: no vendor account, no per-user cost, deployable on a school server or a small VPS, and honest about what it is. But make the decision on evidence, not on this note.

### Repeatability

The single most valuable property here is that deployment is boring. Same project, same command, same result. That means a deterministic build artifact, explicit configuration rather than machine-dependent state, and a documented rollback that has actually been tested rather than merely described.

## Implementation Steps

1. **Choose the target** against the criteria above; record the decision and reasoning in the task's NOTES.
2. **Deployable artifact**: build a Noodl application into whatever the target consumes.
3. **Configuration and secrets** handling, safely — never bake credentials into artifacts.
4. **Deployment path** — editor-integrated if practical, otherwise a documented procedure with a script.
5. **Workflow deployment** if WF-001/002 landed.
6. **Rollback**, implemented and tested rather than merely documented.
7. **Documentation** including troubleshooting for realistic failures.
8. **Full test**: deploy a real project from scratch, following only the documentation.

## Testing Plan

- Deploy a real project end to end following only the written documentation, on a clean machine.
- Redeploy: same project deploys again cleanly, with updates applied.
- Rollback: revert to the previous version successfully.
- Configuration: environment variables and backend connections work as documented; secrets are not present in artifacts.
- Failure modes: bad credentials, network failure, and build failure all produce comprehensible errors.

## Success Criteria

- [ ] Target chosen with recorded reasoning against the stated criteria
- [ ] A real project deploys successfully following the documentation alone
- [ ] Redeploys are repeatable and update cleanly
- [ ] Rollback tested and working
- [ ] Configuration and secrets handled safely; no credentials in artifacts
- [ ] Workflows deploy if WF-001/002 landed
- [ ] Documentation covers happy path, troubleshooting, and rollback
- [ ] Code export documented as the alternative for other hosting

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Pressure to support "just one more" provider | The single-target discipline is the point of this task; export (Phase 18) is the documented general answer |
| Chosen target does not match what users want | Choose on evidence including pilot feedback, not preference; record the reasoning so the decision can be revisited coherently |
| Deployment works for the author and nobody else | Test from a clean machine following only the documentation — the author's environment always masks setup steps |
| Secrets leak into build artifacts or logs | Explicit scope item; verify artifacts contain no credentials |
| Scope drifts toward hosting as a product | ECO-004 owns that question; this task documents deployment, it does not run infrastructure |

## References

- [Revival roadmap — Track G, and "What stays dead"](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- [Viability report — §5 (phase 5 triage: park the target matrix)](../../reviews/NOODL-VIABILITY-REPORT.md)
- Related: Phase 18 (export as the general answer), RUN-003 (external backends), ECO-004 (hosted platform)

## Checklist

- [ ] Branch `task/wf-003-managed-deploy`
- [ ] Choose the target against the criteria; record the reasoning
- [ ] Deployable artifact; configuration and secret handling
- [ ] Deployment path; workflow deployment if applicable
- [ ] Implement and test rollback
- [ ] Documentation incl. troubleshooting
- [ ] Clean-machine deploy following docs only; CHANGELOG; open PR
