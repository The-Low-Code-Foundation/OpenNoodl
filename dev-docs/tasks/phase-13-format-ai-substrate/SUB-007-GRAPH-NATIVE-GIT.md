# SUB-007: Graph-Native Diff & Merge

## Metadata

| Field | Value |
|-------|-------|
| **ID** | SUB-007 |
| **Phase** | Phase 13 — Format & AI Substrate (Revival Track A) |
| **Priority** | 🟠 High |
| **Difficulty** | 🔴 Hard |
| **Estimated Time** | 4–6 weeks |
| **Prerequisites** | SUB-001 (v2 in day-to-day use), SUB-004 (catalog for readable labels) |
| **Branch** | `task/sub-007-graph-native-git` |
| **Recommended executor** | 🔵 **Fable 5** — three-way merge of a graph is a genuinely hard semantic problem (node identity, moved-vs-edited, conflicting rewires), and getting merge semantics wrong silently corrupts user work. Design-heavy; implementation can be delegated to Opus once the merge model is settled. |

## Objective

Replace the legacy monolithic project merger with v2-aware diff and merge: human-readable graph diffs, per-component merge granularity, and comprehensible conflict resolution.

## Background

Version control has always been the weakest part of visual development, and Noodl inherited the worst version of the problem: with the entire application in one JSON file, every change touched the same file, Git's line-based merge produced meaningless conflicts, and the project shipped a bespoke 666-line merger (`utils/projectmerger.js`) to compensate.

Decomposition changes the economics. Once each component owns its own files, most changes touch disjoint paths and Git merges them correctly without help. What remains is the genuinely graph-shaped part: understanding that a diff means "this node was rewired" rather than "these 40 lines changed," and resolving conflicts where two people edited the same component.

This task is also load-bearing for the AI strategy in a way that is easy to miss. Phase 15's graph-native review — showing a user exactly what an AI changed before they accept it — is built directly on this diff engine. "You can see what the AI did" is one of the central claims of the repositioned product, and this is where that capability actually comes from.

## Current State

- `packages/noodl-editor/src/editor/src/utils/projectmerger.js` — roughly 666 lines of legacy merge logic operating on the monolithic format. Untyped, hard to reason about, and structurally obsolete once components live in separate files.
- Git integration lives in `packages/noodl-git` (dugite-based) with UI in the editor's VersionControlPanel (which is, usefully, already fully React).
- No graph-aware diff exists — users see raw JSON diffs, which for a monolithic project are unreadable.
- After SUB-001, projects on disk are per-component files, so file-level conflicts are already dramatically reduced before any work in this task.

## Desired State

- **Diff**: given two versions of a component (or project), produce a semantic change list — nodes added, removed, moved, renamed, reparameterised; connections created, deleted, rewired; components added or removed. Rendered readably in the editor, using catalog display names rather than internal type strings.
- **Merge**: three-way merge at component granularity. Non-overlapping changes merge automatically; genuine conflicts are presented in graph terms with a clear choice.
- **Conflict UI**: "both edited the Login page" resolved by comparing the two graphs side by side, not by editing JSON.
- The legacy merger is deleted, not merely bypassed.

## Scope

### In Scope
- [ ] Semantic diff engine over v2 component files
- [ ] Node identity strategy (stable ids exist; handle id reuse, copy/paste, and re-creation correctly)
- [ ] Three-way merge at component granularity with automatic resolution of disjoint changes
- [ ] Conflict detection and a graph-level conflict model
- [ ] Editor UI for reviewing diffs (reused by Phase 15's AI review)
- [ ] Conflict-resolution UI
- [ ] Git integration: use as a merge driver where practical
- [ ] Remove `projectmerger.js` once parity is proven

### Out of Scope
- Real-time collaborative editing (ECO-001, Phase 20 — different problem, CRDT-shaped)
- Hosting or Git server features
- Diffing across format versions (v1 vs v2) — migrate first (SUB-003)

## Technical Approach

### New Files to Create

| File | Purpose |
|------|---------|
| `packages/noodl-editor/src/editor/src/versioning/GraphDiff.ts` | Semantic diff between two component graphs |
| `packages/noodl-editor/src/editor/src/versioning/GraphMerge.ts` | Three-way merge + conflict model |
| `packages/noodl-editor/src/editor/src/versioning/types.ts` | Change and conflict types (shared with Phase 15) |
| `.../views/panels/GraphDiffPanel/` | Diff review UI |
| `packages/noodl-editor/tests/versioning/` | Diff/merge test suite |

### Design notes

The central question is **node identity**. Diff quality depends entirely on correctly answering "is this the same node, changed, or a different node?" Node ids exist in the format and are the natural anchor, but they are not sufficient alone: copy/paste may duplicate structure, a delete-then-recreate produces a new id for what the user considers the same node, and imported components may carry ids from elsewhere. Design the identity model deliberately — id-primary with structural heuristics as a secondary signal — and document its limits.

For merge, prefer **conservative correctness over cleverness**: when in doubt, raise a conflict rather than guessing. A merge that silently picks wrong is far worse than one that asks. This is also why the task is scoped at component granularity — attempting node-level automatic merge inside a single component is where silent corruption would come from.

## Implementation Steps

1. **Node identity model** — design first, write it down, test against real project histories from Git before building anything on top.
2. **Diff engine** producing a typed change list; validate against real commit pairs from this repository's own history.
3. **Diff UI** in the editor, using catalog display names. Get this in front of a human early; readability is the whole point and is hard to judge from tests.
4. **Three-way merge** at component granularity, automatic for disjoint changes.
5. **Conflict model and UI** — side-by-side graph comparison with an explicit choice, plus an escape hatch to take one side wholesale.
6. **Git merge driver** integration where the tooling allows, so `git merge` on a Noodl project does the right thing outside the editor too.
7. **Parity and removal** — prove the new path handles everything `projectmerger.js` did, then delete it.

## Testing Plan

- Diff correctness against curated before/after pairs covering: node added, removed, moved, renamed, reparameterised, rewired, and component-level add/remove.
- Merge: disjoint changes merge automatically; overlapping changes produce conflicts; no case silently loses a change (this is the critical property — test it exhaustively).
- Real history: replay merges from this repository's actual branch history and compare outcomes with the legacy merger.
- UI review with a human on a large realistic diff.

## Success Criteria

- [ ] Diff produces readable semantic change lists using catalog names
- [ ] Node identity model documented, tested, and its limits stated
- [ ] Three-way merge resolves disjoint changes automatically
- [ ] No test case silently loses a change
- [ ] Conflict UI resolves same-component edits without hand-editing JSON
- [ ] Parity with `projectmerger.js` demonstrated; legacy file removed
- [ ] Diff types reusable by Phase 15's AI review (confirmed with that task's owner)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Silent change loss during merge | Conservative design: conflict when uncertain; exhaustive no-loss test suite; component-level granularity rather than node-level auto-merge |
| Node identity heuristics misfire on copy/paste or recreate | Design and test the identity model first, in isolation, against real histories; document known limits rather than pretending they do not exist |
| Diff output is technically correct but unreadable | Human review early and often; use catalog display names; group changes by intent rather than listing raw field deltas |
| Legacy merger removed before true parity | Keep both paths behind a flag until the parity suite passes on real histories |

## References

- [Revival roadmap — Track A](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- [Viability report — §4.2](../../reviews/NOODL-VIABILITY-REPORT.md)
- Depends on: SUB-001, SUB-004. Consumers: Phase 15 (AIX-003), Phase 20 (ECO-001)

## Checklist

- [ ] Branch `task/sub-007-graph-native-git`
- [ ] Design, document, and test the node identity model first
- [ ] Diff engine + validation against real commit pairs
- [ ] Diff UI reviewed by a human on a large realistic change
- [ ] Three-way merge with conservative conflict policy
- [ ] Conflict resolution UI; Git merge driver where practical
- [ ] Prove parity; remove `projectmerger.js`
- [ ] CHANGELOG; open PR
