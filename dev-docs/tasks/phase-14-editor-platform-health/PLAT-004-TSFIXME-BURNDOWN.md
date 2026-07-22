# PLAT-004: TSFixme Burn-Down with a CI Ratchet

## Metadata

| Field | Value |
|-------|-------|
| **ID** | PLAT-004 |
| **Phase** | Phase 14 — Editor Platform Health (Revival Track B) |
| **Priority** | 🟡 Medium |
| **Difficulty** | 🟢 Easy (ratchet) / 🟡 Medium (individual removals) |
| **Estimated Time** | ~1 week for the mechanism, then ongoing |
| **Prerequisites** | REV-003 (CI) |
| **Branch** | `task/plat-004-tsfixme-burndown` |
| **Recommended executor** | 🟢 **Sonnet 5** — the ratchet is a small, well-defined CI script, and individual `TSFixme` removals are local, verifiable, and repetitive. Escalate only for markers hiding genuinely ambiguous types, which the ratchet will surface as the stubborn residue. |

## Objective

Stop the growth of `TSFixme` (the project's `any` alias) with a CI ratchet, and reduce the count from 554 towards under 100 as a side effect of the other platform work.

## Background

`TSFixme` is declared in the project's global types as an escape hatch, with a comment marking it for removal. There are 554 occurrences. They are not randomly distributed: they cluster at the seams where typed editor code calls into untyped runtime, viewer, or legacy view code — which is to say, `TSFixme` is a symptom of the boundaries that PLAT-002 and PLAT-003 exist to remove.

That relationship shapes this task. Attacking the 554 directly would be mostly wasted effort, because a marker at a runtime call site cannot be replaced with a real type until the runtime *has* real types. The productive move is the opposite order: install a mechanism that prevents the count from rising, then let PLAT-002 and PLAT-003 drive it down as they land, and clean up the residue at the end.

The ratchet is the durable part. Without it, every future contributor — and every AI agent working under time pressure — will reach for `TSFixme` to make an error go away, and the count will drift back up regardless of how much cleanup work is done.

## Current State

- 554 `TSFixme` occurrences across `.ts`/`.tsx` files, roughly 131 files in `noodl-editor` plus a handful in `noodl-viewer-react`, `noodl-core-ui`, and `noodl-types`.
- Around 125 additional explicit `: any` annotations.
- `TSFixme` is defined in the editor's global type declarations as an alias for `any`, documented as "TO BE REMOVED".
- No mechanism prevents adding more; nothing in CI counts them.
- ESLint is configured but does not enforce anything about these markers.

## Desired State

- CI fails a pull request that increases the `TSFixme` count above the committed baseline.
- The baseline is a checked-in number that only ever decreases, updated as part of normal work.
- The count falls to under 100, with the remainder documented as genuinely ambiguous rather than merely unconverted.
- New code cannot introduce `TSFixme` without an explicit, reviewed baseline change.

## Scope

### In Scope
- [ ] A counting script producing a deterministic count and per-file breakdown
- [ ] A committed baseline file
- [ ] CI check failing on any increase
- [ ] Documentation of the policy in the coding standards
- [ ] Opportunistic removal of markers whose real type is already knowable
- [ ] A reporting view of where markers cluster, so later tasks can target them
- [ ] Same treatment for bare `: any` in new code (policy, not retroactive cleanup)

### Out of Scope
- Bulk removal of markers blocked on untyped runtime code (PLAT-003 unblocks those)
- Removal of markers in legacy views being replaced anyway (PLAT-002 deletes those files)
- Enabling `strict: true` across the repository (a larger decision, follows PLAT-003)

## Technical Approach

The ratchet needs to be **boring and hard to game**. A simple grep-based count over `.ts`/`.tsx` files, excluding `node_modules` and build output, written to a baseline file, compared in CI. If the count rises, the check fails with a message naming the files that increased.

Deliberately allow the baseline to be raised, but only as an explicit committed change that a reviewer sees. There are legitimate cases — a large third-party integration landing in one PR — and a ratchet with no escape valve gets disabled entirely, which is worse.

Report per-file counts alongside the total, so the data is useful to PLAT-002 and PLAT-003 rather than being just a gate.

### New Files to Create

| File | Purpose |
|------|---------|
| `scripts/count-tsfixme.ts` | Deterministic counter + per-file report |
| `.tsfixme-baseline.json` | Committed baseline (total + per-file) |

### Key Files to Modify

| File | Changes |
|------|---------|
| `.github/workflows/pr.yml` | Add the ratchet check |
| `dev-docs/guidelines/CODING-STANDARDS.md` | Document the policy and the escape valve |

## Implementation Steps

1. **Write the counter** and verify it is deterministic and matches a manual grep.
2. **Commit the baseline** at the current count (554 at phase start; re-measure at implementation time, since PLAT-002/003 may already have moved it).
3. **Add the CI check** with a clear failure message and instructions for the legitimate escape valve.
4. **Document the policy** — what `TSFixme` means, when raising the baseline is acceptable, and that removal is expected as adjacent code is typed.
5. **Harvest the easy wins**: markers where the real type is already available. Do this as a few focused PRs rather than one large one.
6. **Publish the clustering report** so PLAT-002/003 can see which files carry the most markers.
7. **Periodically lower the baseline** as the other tasks land — ideally automatically, as part of their PRs.

## Testing Plan

- Counter determinism: repeated runs on an unchanged tree produce identical output.
- Ratchet correctness: a PR adding a `TSFixme` fails; a PR removing one passes and prompts a baseline update.
- Verify the count matches manual inspection on a sample of files.

## Success Criteria

- [ ] Counter script deterministic and matching manual counts
- [ ] Baseline committed; CI fails on increases
- [ ] Policy documented in coding standards, including the escape valve
- [ ] Clustering report available to other tasks
- [ ] Easy-win markers removed
- [ ] Count trending down; target under 100 by the end of PLAT-002 and PLAT-003, with the remainder documented

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Contributors circumvent the ratchet with bare `any` or `@ts-ignore` | Count those too, in the same baseline |
| The ratchet becomes an obstacle and gets disabled | Provide the explicit baseline-raise escape valve; keep failure messages actionable |
| Markers are removed by weakening types elsewhere rather than fixing them | Code review; removal should accompany a real type, not a cast |
| Effort is spent on markers that PLAT-002 will delete outright | Use the clustering report to avoid files scheduled for replacement |

## References

- [Viability report — §4.4, Appendix E (554 markers, clustered at seams)](../../reviews/NOODL-VIABILITY-REPORT.md)
- `dev-docs/reference/CODEBASE-MAP.md` — `TSFixme` declaration and intent
- Related: PLAT-002, PLAT-003 (both drive the count down), REV-003 (CI)

## Checklist

- [ ] Branch `task/plat-004-tsfixme-burndown`
- [ ] Write and verify the counter script
- [ ] Commit the baseline; add the CI check
- [ ] Document the policy and escape valve
- [ ] Harvest easy wins; publish the clustering report
- [ ] Wire baseline updates into other tasks' definition of done
- [ ] CHANGELOG; open PR
