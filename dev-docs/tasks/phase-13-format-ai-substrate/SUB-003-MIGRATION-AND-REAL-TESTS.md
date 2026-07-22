# SUB-003: Migration Wizard & Real-Project Validation

## Metadata

| Field | Value |
|-------|-------|
| **ID** | SUB-003 |
| **Phase** | Phase 13 — Format & AI Substrate (Revival Track A) |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 3–4 weeks |
| **Prerequisites** | SUB-001, SUB-002 |
| **Branch** | `task/sub-003-migration-and-real-tests` |
| **Recommended executor** | 🟠 **Opus 4.8** — the migration UI is straightforward, but this is the task that touches *users' existing projects irreversibly*. Backup strategy, pre-flight validation, and failure recovery need careful judgement. |

## Objective

Ship a migration wizard that converts existing monolithic projects to the v2 format safely and reversibly, backed by a validation suite that exercises real projects at realistic scale (STRUCT-007 and STRUCT-008).

## Background

SUB-001 makes the editor able to use v2; SUB-002 makes the conversion lossless. Neither of them moves a single existing project. Every project a user already has is still monolithic, and the benefits of decomposition — readable diffs, lazy loading, AI-authorable components — only arrive once their projects actually convert.

Migration is the point of maximum risk in the entire format programme. A user's project is their work; a bad migration destroys it. That risk is why this task carries a heavier backup and validation burden than its implementation complexity alone would suggest, and why it comes last in the format sequence rather than first.

The Phase 10 specs describe both halves: STRUCT-007 (wizard UI with analysis, pre-flight checks, and progress reporting) and STRUCT-008 (a test suite against real projects of 200+ components, cloud components, and deliberately corrupted inputs).

## Current State

- No migration path exists. `ProjectFormatDetector` can tell v1 from v2, but nothing converts between them in the product.
- The pure engines can perform the transformation in memory; what is missing is the file-level orchestration, user-facing flow, and safety net.
- Test coverage against real projects is nil — all existing io tests use synthetic fixtures (SUB-002 introduces the first real corpus, which this task extends).
- `dev-docs/tasks/phase-10-ai-powered-development/README.md` holds the STRUCT-007/008 specs.

## Desired State

- A user opens a legacy project and is offered migration, with a clear explanation of what changes and what the benefits are.
- Pre-flight analysis reports what will be converted and flags anything unusual **before** any file is written.
- A full backup is taken automatically; rollback is one action and always available.
- Migration of a large project completes in reasonable time with visible progress.
- A validation suite proves the process against real projects at scale, including hostile inputs.

## Scope

### In Scope
- [ ] Migration wizard UI: explain → analyse → pre-flight → confirm → migrate → verify → report
- [ ] Automatic backup of the original project before any write
- [ ] Post-migration verification: re-import the converted project and compare against the original in memory; refuse to finish if it does not match
- [ ] One-action rollback to the backup
- [ ] Batch migration for users with many projects (opt-in, same safety guarantees)
- [ ] STRUCT-008 validation suite: 200+ component projects, cloud components, corrupted/partial inputs, interrupted migrations
- [ ] Documentation for users explaining the format change and its benefits

### Out of Scope
- Automatic migration without consent — always ask, always back up
- Converting v2 back to v1 as a product feature (the backup covers rollback; a downgrade path is a separate decision)
- Editor read/write plumbing (SUB-001)

## Technical Approach

### New Files to Create

| File | Purpose |
|------|---------|
| `.../services/ProjectStructure/ProjectMigrator.ts` | Orchestration: backup, convert, verify, report, roll back |
| `.../views/panels/MigrationWizard/` | Wizard UI (React, core-ui components) |
| `packages/noodl-editor/tests/structure/` | STRUCT-008 validation suite |

### Key Files to Modify

| File | Changes |
|------|---------|
| `.../models/projectmodel.ts` | Offer migration on opening a detected v1 project |
| `.../io/ProjectExporter.ts` / `ProjectImporter.ts` | Only if verification reveals gaps (which belong in SUB-002) |

## Implementation Steps

1. **Backup first, always.** Implement and test the backup/rollback mechanism before writing any conversion orchestration. If the backup is not proven, nothing else should run.
2. **Pre-flight analysis** — component count, unusual node types, dynamic-port usage, anything the fidelity audit flagged as delicate. Present findings before the user commits.
3. **Migration orchestration** with progress reporting, cancellable, resumable or cleanly abortable.
4. **Post-migration verification** — round-trip the result and deep-compare against the pre-migration in-memory project (this is SUB-002's machinery applied at runtime). A mismatch aborts and restores.
5. **Wizard UI** using `noodl-core-ui` components, following existing panel patterns.
6. **Validation suite** (STRUCT-008): real projects at 200+ components, projects with cloud components, deliberately truncated/corrupted files, and interrupted migrations (kill the process mid-run and confirm the original survives).
7. **User documentation** — what the new file layout is, why it is better, how to roll back.

## Testing Plan

- Migrate every golden fixture from SUB-002; verify equality and reversibility.
- Kill the process at several points during migration; confirm the original project is always intact and recoverable.
- Corrupted input: truncated JSON, missing components, invalid references — the wizard must fail cleanly with a useful message rather than producing a half-migrated project.
- Scale: time a 200+ component migration; confirm progress reporting is honest.

## Success Criteria

- [ ] Wizard completes the full flow with pre-flight analysis and progress
- [ ] Backup taken automatically; rollback verified from a real backup
- [ ] Post-migration verification catches an injected fidelity fault and aborts safely
- [ ] Validation suite passes across real, large, cloud-component, and corrupted inputs
- [ ] Interrupted migration never damages the original project
- [ ] User-facing documentation published

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Migration corrupts a real user project | Mandatory backup, post-migration verification with automatic abort, rollback action, and never migrating without explicit consent |
| Users decline migration and the ecosystem splits across two formats | Both formats stay supported (the detector already handles this); make the benefits visible in the wizard rather than forcing conversion |
| Large-project migration appears to hang | Progress reporting with component-level granularity; cancellable |
| Verification is too slow to run by default on huge projects | Sample-based verification with an explicit "full verify" option, and always full verification below a size threshold |

## References

- [Viability report — §4.2 and Appendix G](../../reviews/NOODL-VIABILITY-REPORT.md)
- `dev-docs/tasks/phase-10-ai-powered-development/README.md` — STRUCT-007/008 specs
- Related: SUB-001, SUB-002

## Checklist

- [ ] Branch `task/sub-003-migration-and-real-tests`
- [ ] Backup + rollback implemented and proven first
- [ ] Pre-flight analysis and wizard flow
- [ ] Post-migration verification with automatic abort
- [ ] STRUCT-008 validation suite incl. corruption and interruption cases
- [ ] User documentation
- [ ] CHANGELOG; open PR
