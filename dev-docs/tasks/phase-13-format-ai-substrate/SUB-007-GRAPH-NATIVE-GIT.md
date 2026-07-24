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

- [x] ~~Branch `task/sub-007-graph-native-git`~~ (work goes straight to `cline-dev` per current workflow)
- [x] Design, document, and test the node identity model first — [SUB-007-DESIGN.md](SUB-007-DESIGN.md); id-primary, structural matching diff-only
- [x] Diff engine + validation against real commit pairs — `src/editor/src/versioning/GraphDiff.ts`; validated against the captured merge fixtures in `tests/testfs/merge-tests/` (real project histories)
- [x] Diff UI — `views/panels/GraphDiffPanel/`, wired into local changes, commit
      diffs, merge previews and stash diffs. Reviewed against a running editor
      on a real project (§ Live verification); **not yet reviewed on a *large*
      diff** — see Status
- [x] Three-way merge with conservative conflict policy — `GraphMerge.ts`; no-silent-loss property tested over 150 seeded three-way merges in CI (plus a 1,500-seed offline sweep) and the real fixtures
- [x] Conflict resolution UI — `GraphConflictList` + `MergeConflicts`, replacing
      the banner that pushed users at the warnings list. Value conflicts apply to
      the live project; structural ones are review-only (see design §6)
- [x] Git merge driver — `%P` routing, `.gitattributes` claims the v2 files,
      `mergeV2ComponentFiles` merges a component's three files as one graph
- [x] Parity proven, `projectmerger.js` removed — goldens recorded from the
      legacy merger before deletion (`tests/testfs/merge-tests/legacy-golden/`);
      its behavioural specs now run against the graph merger
- [x] CHANGELOG (below). No PR — work goes straight to `cline-dev`

### Status 2026-07-24 — complete

All seven implementation steps are done and the legacy merger is deleted.
989 specs, 0 failures; typecheck clean.

| Step | Where it landed |
|---|---|
| 1. Node identity model | [SUB-007-DESIGN.md](SUB-007-DESIGN.md) §2 |
| 2. Diff engine | `versioning/GraphDiff.ts` |
| 3. Diff UI | `views/panels/GraphDiffPanel/` |
| 4. Three-way merge | `versioning/GraphMerge.ts` |
| 5. Conflict model + UI | `GraphConflictList`, `VersionControlPanel/components/MergeConflicts.tsx` |
| 6. Git merge driver | `main/src/merge-driver.js`, `noodl-git/src/{core/init,merge-strategy}.ts` |
| 7. Parity + removal | `tests/versioning/parity.test.ts`, `projectmerger.js` deleted |

### Live verification (2026-07-24)

Driven in a running editor against a real project, not a fixture: version
control panel → Local Changes → select the changed component. The panel
rendered, catalog display names resolved, and grouping worked:

```
What changed in /#__page__/Home
VALUES
  Renamed Text to 'Hello World!'
  Changed Text 'Hello World!' (color: (unset) → '#FF8800')
```

The run paid for itself twice. It found **editor bookkeeping leaking into the
change list** (`Changed legacyGraph:visualRoots: [] → [...]` — derived state, in
an internal namespace, that moves whenever anything is edited), now excluded in
`GraphDiff.ts`; and it prompted the check that found the **conflict panel could
not open for structural-only conflicts**, since its gate read the warnings model
alone. Both fixed and covered by specs.

**Still open:** the diff has only been read on a *small* project (three nodes,
two changes). The success criterion asks for a large realistic change, where the
open questions are volume — whether a hundred-change component needs collapsing
or a summary line — and whether grouping still helps at that size. Nothing about
correctness; entirely about legibility at scale.

**Known rough edge:** connection sentences read
`Connected Text 'Continue'.onClick → Text.visible`. The label-qualified node name
followed by a port is clumsy, and an unlabelled target is ambiguous when several
nodes share a type. Left as-is deliberately — changing the formatter means
changing pinned expectations, and it wants the large-diff review first.

**Bounded, by design:** conflict resolution applies *value* conflicts
(parameters, state values and transitions, labels, variants) to the live
project. Structural conflicts — delete-vs-edit, cross-side reparents, wiring to
a deleted node — are shown for review rather than re-derived after the fact.
Rationale in [SUB-007-DESIGN.md](SUB-007-DESIGN.md) §6.

## CHANGELOG

**Added**
- Structural conflicts now open the conflict panel: `useHasConflictsInProject`
  consults `metadata.mergeConflicts`, not just the warnings model (which only
  ever knew the seven legacy kinds).
- `MergeConflicts` falls back to the pre-SUB-007 banner for projects merged by
  an older build, which have stamps but no structured list.
- `versioning/ProjectMerge.ts` — whole-project three-way merge (components,
  variants, project-level scalars) on the graph engine; the drop-in that
  replaced `projectmerger.js`.
- `mergeV2ComponentFiles` — merges a decomposed component's three files as one
  graph, catching cross-file cases like a connection to a deleted node.
- `views/panels/GraphDiffPanel/` — semantic change lists and conflict
  resolution, reusable by Phase 15's AIX-003.
- `metadata.mergeConflicts` — the structured conflict channel the
  out-of-process merge driver writes and the editor reads.
- `tests/versioning/parity.test.ts` + `tests/testfs/merge-tests/legacy-golden/`.

**Changed**
- All seven merge call sites (git merge driver, Git client, VersionControlPanel,
  GitHubPanel, GitStats) now use the graph engine.
- Main-process webpack gained a TypeScript loader
  (`webpackconfigs/shared/webpack.main.core.js`) — the reason the legacy merger
  had to be JavaScript.
- `.gitattributes` claims the v2 component files; the driver takes `%P`.

**Removed**
- `utils/projectmerger.js` (666 lines).

**Behaviour changes vs the legacy merger** (each pinned by a test, justified in
the design doc §7): delete-vs-edit conflicts instead of silently resurrecting
the edit; project-level both-changed keys conflict instead of silently keeping
ours; source-code conflicts no longer write markers into parameter values;
untouched components are no longer re-serialized; inputs are no longer mutated.
