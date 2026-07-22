# EXP-004: Export Report & Honesty UX

## Metadata

| Field | Value |
|-------|-------|
| **ID** | EXP-004 |
| **Phase** | Phase 18 — Code Export v2 (Revival Track F) |
| **Priority** | 🟠 High |
| **Difficulty** | 🟢 Easy |
| **Estimated Time** | 1 week |
| **Prerequisites** | EXP-002, EXP-003 |
| **Branch** | `task/exp-004-export-report-ux` |
| **Recommended executor** | 🟠 **Opus 4.8** — small and technically simple, but the framing is delicate: it must communicate partial confidence without either overselling the export or making a genuinely good result sound broken. |

## Objective

Tell the user exactly what their export produced — what is clean, what is best-effort, what is unverified, and what needs human work — before and after they export.

## Background

Code export is the feature most likely to generate disappointment, because expectations are set by the phrase rather than by the reality. "Export as React" sounds binary. The actual result is a spectrum: UI-heavy projects come out clean and idiomatic; projects built largely from Function nodes and expressions come out with translations that were verified against recorded traces, translations that were not verified because no trace covered them, and stubs where database operations need reimplementation.

The existing `CODE-EXPORT-STUDY.md` got this exactly right, and its instinct should be preserved even though its technical conclusions have been superseded: *"clear documentation beats magic that sometimes fails."* A user who is told in advance that seven Function nodes will need review, and then finds seven clearly-marked Function nodes needing review, has had a good experience. A user promised a working export who discovers the gaps themselves has been misled, and will not trust the feature again.

There is a specific new risk this task must handle. EXP-003 uses AI translation with trace verification, and users may reasonably assume that "AI translated it and tests passed" means "it is correct." It does not: trace verification proves behaviour matched on the inputs that were recorded. Communicating that distinction honestly, without drowning the user in caveats, is the real work here.

## Current State

- EXP-002 produces coverage data: which node types were generated statically, which were deferred, which were stubbed.
- EXP-003 produces per-translation verdicts (verified / mismatched / unverified) and trace-coverage measurements.
- Nothing surfaces any of this to the user.
- The original Phase 7 design (CODE-008) sketched an export report; this task implements it, informed by what EXP-003 now makes reportable.

## Desired State

**Before export**, a pre-flight estimate: given this project, here is roughly what will export cleanly, what will need review, and what will be stubbed. The user decides whether to proceed with accurate expectations.

**After export**, a report covering:

- What was generated: components, styles, routes, stores
- What was translated and verified, with trace coverage stated
- What was translated but unverified, and why (no trace coverage, non-deterministic, verification failed)
- What was stubbed and needs implementation (database and cloud operations)
- Clear next steps, with file locations
- An honest overall confidence statement

**In the code itself**: clear markers at every point needing attention, with the original node source preserved in comments so a developer can see what the code is meant to do.

## Scope

### In Scope
- [ ] Pre-flight export estimate from project analysis
- [ ] Post-export report (in-editor and as a file in the exported project)
- [ ] Per-item detail: node, location in generated code, status, reason
- [ ] Trace-coverage communication in plain language
- [ ] In-code markers with original source preserved
- [ ] A `README.md` in the exported project explaining what it is, what needs work, and how to proceed
- [ ] Honest framing of what verification does and does not prove
- [ ] Actionable next steps ordered by priority

### Out of Scope
- Fixing anything the report identifies (that is the user's work, or a future task)
- The export mechanism itself (EXP-002/003)
- Ongoing sync between the Noodl project and exported code (explicitly not supported)

## Technical Approach

### Framing principles

**Lead with what worked.** A report opening with a list of problems reads as failure even when 90% exported cleanly. Report the successful majority first, then the specific items needing attention.

**Be specific, not statistical.** "7 Function nodes need review" with names and file locations is useful. "83% confidence" is not — it sounds precise and tells the user nothing actionable.

**Explain verification honestly and briefly.** Something like: *"These translations were checked by replaying recorded usage from your preview session. They behaved identically on everything that was exercised. Behaviour on inputs you did not test has not been checked."* One sentence, accurate, no false precision, and it tells the user how to increase confidence (exercise more of the app before exporting).

**Never let unverified code look verified.** Distinct in-code markers, distinct report sections, distinct language.

## Implementation Steps

1. **Pre-flight analysis** using the catalog and project contents; estimate the outcome before exporting.
2. **Report data model** aggregating EXP-002's coverage and EXP-003's verdicts.
3. **In-editor post-export report** with drill-down per item.
4. **Exported `README.md`** — the report the user reads outside Noodl, in the codebase they now own.
5. **In-code markers**: consistent, greppable, with original source preserved for unverified items.
6. **Plain-language verification explanation**, reviewed by someone outside the team for clarity.
7. **User test**: someone unfamiliar exports a mixed project and explains, from the report alone, what they need to do next.

## Testing Plan

- Report accuracy: every stub, unverified translation, and generated component appears with the correct status.
- Pre-flight estimate matches the actual outcome within a reasonable margin on the test corpus.
- In-code markers are consistently formatted and greppable.
- **Comprehension test**: a developer unfamiliar with the project reads the exported README and can state what needs doing without asking questions.
- No unverified item is presented in language that implies verification.

## Success Criteria

- [ ] Pre-flight estimate available before export and reasonably accurate
- [ ] Post-export report accurate and complete, in-editor and in the exported project
- [ ] Trace-coverage caveat stated in plain language, without false precision
- [ ] In-code markers consistent, greppable, with original source preserved
- [ ] Exported README enables an unfamiliar developer to proceed unaided
- [ ] Unverified work is never framed as verified
- [ ] Report leads with what succeeded

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Users read "verified" as "guaranteed correct" | Explicit, plain-language explanation of what trace verification proves; distinct vocabulary for verified vs. unverified |
| The report is so cautious that a good export looks bad | Lead with successes; reserve caveats for the items they apply to |
| Report drifts out of sync with what the generators actually do | Generate the report from EXP-002/003 data structures, never from a hand-maintained list |
| Users expect ongoing sync with their Noodl project | State explicitly in the exported README that export is one-way |

## References

- [`dev-docs/future-projects/CODE-EXPORT-STUDY.md`](../../future-projects/CODE-EXPORT-STUDY.md) — the honesty framing this preserves
- [`dev-docs/tasks/phase-7-code-export/`](../phase-7-code-export/) — CODE-008
- Depends on: EXP-002, EXP-003

## Checklist

- [ ] Branch `task/exp-004-export-report-ux`
- [ ] Pre-flight estimate; report data model from generator/verifier output
- [ ] In-editor report and exported README
- [ ] Consistent in-code markers with original source preserved
- [ ] Plain-language verification explanation, externally reviewed
- [ ] Comprehension test with an unfamiliar developer
- [ ] CHANGELOG; open PR
