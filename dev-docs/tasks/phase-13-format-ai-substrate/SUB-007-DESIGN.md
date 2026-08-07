# SUB-007 Design: Node Identity, Graph Diff & Three-Way Merge

**Status:** Implemented — `packages/noodl-editor/src/editor/src/versioning/`
**Date:** 2026-07-23, extended 2026-07-24 (§6–§8: project merge, conflict UI, v2 driver, parity)

This document is the design artifact required by SUB-007 step 1: the node identity
model, the diff model, and the merge semantics, including their stated limits. Read
this before touching the engine; the tests in `tests/versioning/` encode these rules.

---

## 1. What the engine operates on

The engine is format-agnostic via a normalized `GraphSnapshot` built by adapters:

- `fromV2Files(component.json, nodes.json, connections.json)` — the decomposed v2
  format (SUB-001/002). This is the shape git sees on disk and the shape Phase 15's
  AI review will diff.
- `fromLegacyComponent(componentJson)` — the in-memory legacy component shape
  (`{ name, graph: { roots, connections, comments }, ports, metadata }`) that
  `ComponentModel.toJSON()` produces. This lets the editor diff live models without
  round-tripping through disk.

A snapshot holds nodes in a flat `Map<id, SnapshotNode>` (hierarchy as `parent` +
`childIndex`, mirroring `NodeV2`), a connection list, comments, the component's
port definitions, and metadata. Both adapters normalize the legacy `stateParamaters`
typo and drop transient fields (`dynamicports`, `conflicts`, `annotation`,
`diffData`) so the engine never diffs derived or UI-only state.

## 2. Node identity model

Diff and merge quality both reduce to one question: *is this the same node?*

### 2.1 Primary rule: the node id is the identity

Node ids are generated once at creation, never rewritten by editing, and preserved
byte-for-byte by the v2 round trip (SUB-002). **Two nodes are the same node iff
they have the same id.** This is the only identity signal the merge engine uses.

Consequences, stated explicitly:

- **Copy/paste** assigns fresh ids to the pasted nodes. They are *new* nodes. This
  is correct: the user duplicated structure, they did not move the original.
- **Delete-then-recreate** produces a new id. To the merge engine this is a
  removal plus an addition. Both operations are preserved; nothing is lost — but
  the merge will not treat the recreated node as "the same node edited", so a
  concurrent edit to the deleted original surfaces as a delete-vs-edit conflict
  rather than being grafted onto the recreation. This is the conservative choice.
- **Same id appearing on both sides with divergent content** can only happen when
  both branches derive from a common source (the id existed at the merge base, or
  both sides copied from the same origin). Handled by the three-way rules in §4;
  a base-absent id added on both sides with different content is an add/add
  conflict, never a silent pick.

### 2.2 Secondary signal: structural matching — diff display only

For *human-readable diffs* (not merge), a removal+addition pair may really be one
logical action ("I recreated the button"). After id matching, the diff engine runs
a structural matcher over the unmatched removed set × added set:

- **Hard gate:** identical `type`. A Group is never "the same node" as a Button.
- **Score** (0..1): same parent identity (0.30), label equality (0.25), parameter
  similarity by shallow key/value overlap (0.30), canvas proximity within 150px
  (0.15). Pairs are matched greedily, highest score first, threshold **0.65**.
- A structural match downgrades `node-added` + `node-removed` into a single
  `node-recreated` change carrying `identity: 'structural'` and the field deltas,
  so the reviewer reads "Button recreated with new text" instead of two entries.

**The merge engine never uses structural matching.** A heuristic that guesses
wrong in diff produces a slightly odd changelog; the same guess in merge grafts
edits onto the wrong node — the silent-corruption failure mode this task exists
to eliminate. This asymmetry is deliberate and load-bearing.

### 2.3 Known limits (documented, not hidden)

1. Recreated nodes lose edit-continuity across a merge (§2.1). The conflict UI is
   the mitigation, not id archaeology.
2. Structural matching can pair a deleted node with a coincidentally similar new
   node of the same type/parent. Bounded to display; threshold errs high; the
   change record carries `identity: 'structural'` so UIs can badge it as inferred.
3. Components imported from another project keep their internal node ids. Within a
   component file this is safe (ids are scoped per component); the engine never
   compares ids across components.
4. Connection identity is the 4-tuple `(fromId, fromProperty, toId, toProperty)` —
   connections have no ids of their own. A "rewire" is therefore *derived*
   (remove + add sharing an endpoint), not primitive. See §3.

## 3. Diff model

`diffGraphs(base, target)` produces a `ComponentDiff`: a flat, typed list of
`GraphChange` records, each carrying enough data to render a sentence and to
replay the change. Change kinds:

| Kind | Meaning | Category |
|------|---------|----------|
| `node-added` / `node-removed` | id present on one side only (after §2.2) | semantic |
| `node-recreated` | structural match of removed+added (diff only) | semantic |
| `node-renamed` | `label` changed | semantic |
| `node-type-changed` | same id, different `type` (rare; upgrades) | semantic |
| `node-parameters-changed` | per-parameter deltas, grouped per node | semantic |
| `node-state-changed` | stateParameters / stateTransitions / defaults deltas | semantic |
| `node-variant-changed` | `variant` changed | semantic |
| `node-reparented` | `parent` changed (visual tree edit) | semantic |
| `node-reordered` | same parent, `childIndex` changed | semantic |
| `node-moved` | only `x`/`y` changed | **cosmetic** |
| `node-ports-changed` | instance port list changed | semantic |
| `connection-added` / `connection-removed` | 4-tuple present on one side only | semantic |
| `connection-rewired` | derived: removed+added sharing `(toId,toProperty)` or `(fromId,fromProperty)` | semantic |
| `comment-added` / `comment-removed` / `comment-changed` | comment text/size; pure x/y move is cosmetic | mixed |
| `component-renamed` / `component-ports-changed` / `component-metadata-changed` | component-level | semantic |

The cosmetic/semantic category exists so (a) the UI can fold position noise by
default, and (b) the merge engine can let deletions win over cosmetic-only edits
(the legacy `nodesSoftEqual` behavior, kept deliberately — a node someone only
nudged 3px should not survive its own deletion as a conflict).

`diffProject(base, target)` wraps per-component diffs plus `component-added` /
`component-removed` entries and styles/settings deltas. Rendering uses catalog
display names (SUB-004) with fallback to the raw type string.

## 4. Three-way merge semantics

`mergeGraphs(base, ours, theirs)` computes `diff(base, ours)` and
`diff(base, theirs)` and merges change-by-change over identity keys
(node id / connection 4-tuple / comment id / parameter name). Governing rule:

> **Every base→side change either appears in the merged output or appears in a
> conflict. No rule may drop a change silently.** (The no-loss property; tested
> exhaustively in `tests/versioning/GraphMerge.noloss.test.ts`.)

**Cosmetic exemption:** canvas position (x/y), node metadata (editor
bookkeeping such as `merge.soureCodePorts` lists), unknown passthrough fields,
and the v2 `modified` timestamp are exempt from the no-loss property — a
both-changed case keeps ours silently. These carry no user semantics; every
other field conflicts.

### 4.1 Automatic resolutions

- Change on one side only → applied.
- Identical change on both sides → applied once.
- Both edited the *same node* but **disjoint fields** (one renamed, other changed
  a parameter) → both applied. Parameters merge per-key; state bundles merge
  per-state-per-key.
- Deletion vs **cosmetic-only** edit (x/y move) → deletion wins (soft-equal rule).
- Both added *different* nodes/connections → both kept (ids/4-tuples differ).
- Both deleted the same thing → deleted.
- Child-order: one side reordered a parent's children → applied; deletions and
  insertions positioned by surviving-neighbor order. Sibling order is compared
  by *relative rank among shared siblings*, not absolute index, so deleting a
  sibling on one side does not read as "everything after it moved".
- Cross-side reparents that jointly form a parent cycle (ours moved A under B,
  theirs moved B under A) are detected; theirs' reparent is reverted with a
  `reparent` conflict so the subtree cannot silently vanish on serialization.
  Resolution paths re-check for cycles and root the node if honoring a choice
  would recreate one.

### 4.2 Conflicts (never guessed)

| Conflict kind | Trigger |
|---------------|---------|
| `parameter` | both changed the same parameter of the same node to different values |
| `state-parameter` / `state-transition` / `default-state-transition` | same, within a state bundle |
| `label` / `variant` / `typename` | both changed the same scalar field differently |
| `delete-vs-edit` | one side deleted a node the other side **semantically** edited |
| `add-add` | both sides added the same id with different `type` (same type merges per-field with base = empty, conflicting per field like the legacy merger) |
| `reparent` | both moved the same node under different parents, or one side reparented under / into a node the other deleted |
| `child-order` | both reordered the same parent's children differently |
| `connection-rewire` | both sides replaced the connection at the same endpoint with different wiring |
| `connection-to-deleted` | one side added/kept a connection whose endpoint node the other side deleted |
| `component-rename` | both renamed the component differently |
| `component-ports` | both changed the same component port differently |
| `source-code` | both edited a source-code port (per `metadata.merge.soureCodePorts` [sic — legacy key kept]) and diff3 could not merge the text cleanly |

Where the legacy merger silently preferred "ours" — connections, comments,
ports, `mergeJSON` on settings/metadata — the new engine either merges 3-way
per-key with conflicts, or (comments both-edited) raises `comment` conflicts.
The legacy behavior of letting `ProjectValidator.fix()` silently delete dangling
connections is replaced by the explicit `connection-to-deleted` conflict.

Source-code ports keep their diff3 line-merge (it is genuinely better than
whole-value conflict for code), but a diff3 conflict becomes a typed
`source-code` conflict carrying both full texts — never inline
`------- Ours -------` markers written into the parameter value.

### 4.3 Merge output and resolution

`MergeResult = { merged: GraphSnapshot, conflicts: GraphConflict[], applied: GraphChange[] }`.

Every conflict has a stable `id`, the node/connection it anchors to, and
`ours`/`theirs`/`base` values. The merged snapshot is **ours-flavored where
conflicted** (matching legacy behavior so an unresolved merge is still a loadable
project), but unlike legacy the conflict list is *outside* the graph data —
conflicts are not written into node JSON. `applyResolution(result, conflictId,
'ours' | 'theirs')` rewrites the merged snapshot accordingly; `resolveAll(side)`
is the take-one-side-wholesale escape hatch. Resolutions compose safely:
restoring a node reattaches it (root if its parent is gone), keeping wiring to a
deleted node restores the missing endpoint(s), cascade-deletes drop dependent
connections and reattach children, and every parent mutation is cycle-guarded.

Component granularity: `mergeProjectV2` merges each component independently;
components added/removed/renamed follow the same 3-way rules at the project map
level. There is no cross-component automatic rewiring.

## 5. Consumers

- **Editor diff review** (this task's UI step): `ComponentDiff` + `DiffFormatter`
  (catalog names → sentences).
- **Phase 15 AI review (AIX-003)**: same `ComponentDiff` type over
  before/after v2 files — the types in `versioning/types.ts` are the contract.
- **Git merge driver**: v2 files merge per-file (`nodes.json`, `connections.json`
  merge via this engine; `component.json` via keyed 3-way). Legacy monolithic
  `project.json` keeps `projectmerger.js` until the parity suite proves
  replacement (SUB-007 step 7).

---

## 6. Project-level merge, conflict transport, and resolution scope

*Added 2026-07-24 with `ProjectMerge.ts`, which replaced `utils/projectmerger.js`.*

The engine merges one component. A project adds three things it deliberately
knows nothing about, and `ProjectMerge.ts` supplies exactly those:

- **Components** — keyed by `id || name`, as the legacy merger did, so a rename
  stays tracked by id rather than reading as delete + add.
- **Variants** — keyed `typename/name`, merged per parameter and per state
  bundle with the same conflict rules as nodes.
- **Project-level scalars** — settings, styles, metadata, `rootNodeId`. Merged
  recursively per key. Arrays compare whole rather than merging index-by-index
  (the legacy behaviour, which produces nonsense the moment an element is
  inserted), and a genuine both-changed key raises a `project-setting` conflict
  instead of silently keeping ours.

**Components only one side touched pass through verbatim.** Serializing an
untouched component through the snapshot normalizes it — drops absent keys, adds
empty arrays — and churns the diff of a file nobody edited. The legacy merger
did exactly that to every component it walked.

### 6.1 How conflicts reach the UI

The git merge driver runs in the **main process, in its own Electron
invocation**. The merged file is the only channel back to the editor. Two
things travel in it:

- `node.conflicts` — the legacy stamps, kept so the pre-existing warnings UI
  does not regress. They express seven of the eighteen conflict kinds.
- `metadata.mergeConflicts` — the full structured list (`MERGE_CONFLICTS_KEY`),
  including the structural kinds the stamps cannot express. Written only when
  conflicts are unresolved, and removed as they are resolved.

v2 component merges use the same mechanism, writing to the component's own
`component.json` metadata.

### 6.2 What puts the panel into conflict mode

Two signals, because neither is sufficient alone:

- **Warnings** (`node.conflicts` stamps) — what the editor used before
  SUB-007. Covers only the seven value-conflict kinds, because the other
  eleven have no node to hang a warning on.
- **`metadata.mergeConflicts`** — every kind, including structural ones.

The panel gates on either. Consulting only the warnings model, as the code did
before, meant a merge producing nothing but structural conflicts left the user
with no indication at all. Consulting only the metadata channel would strand
projects merged by an older build, which have stamps and no channel — those get
the pre-SUB-007 banner instead of an empty panel.

### 6.3 What the conflict UI can and cannot apply

`GraphConflictList` renders every conflict; `MergeConflicts` applies the chosen
side. Applying is bounded on purpose:

- **Value conflicts** — parameters, source code, state parameters, state
  transitions, default state transitions, labels, variants — are applied to the
  live project through the models, so undo, save and the canvas see them as
  ordinary edits.
- **Structural conflicts** — delete-vs-edit, add-add, reparent, child-order,
  connection rewires, connection-to-deleted, component-level — are shown for
  review and dismissed, not applied. The merged project is already ours-flavored;
  re-deriving the other side's structure after the fact, outside the three-way
  context that produced it, is precisely the silent-corruption failure mode this
  task exists to eliminate. Taking the other side means re-running the merge.

## 7. Divergences from the legacy merger

Parity was established by A/B over all six captured real merge fixtures, and
those outputs are frozen as goldens in `tests/testfs/merge-tests/legacy-golden/`
so the evidence outlived the deleted code. Every divergence below is pinned by a
test in `tests/versioning/parity.test.ts`; none of them is accidental.

| Divergence | Why |
|---|---|
| Delete-vs-edit conflicts instead of resurrecting the edit (nodes, comments, components) | Legacy silently picked a side. The merge stays ours-flavored and reports the loss. |
| A component deletion wins over a cosmetic-only edit | Legacy kept a component whose only "change" was gaining an empty array. |
| Project-level both-changed keys conflict | Legacy's `mergeJSON` silently preferred ours. |
| Source-code conflicts carry both texts; no `------- Ours -------` markers in the value | The value on disk stays loadable code; the UI shows the two sides. |
| No ancestor for a source-code port is a conflict, not a silent ours-wins | Legacy logged a warning and dropped their edit. |
| Untouched components are not re-serialized | Avoids diff churn in files nobody edited. |
| No empty `ports`/`comments` arrays, no explicit-`undefined` keys | `JSON.stringify` drops both identically; the round-trip invariant (SUB-002) requires preserving input shape. |
| Inputs are not mutated | Legacy mutated its arguments; callers defended with `JSON.parse(JSON.stringify(...))`. |

## 8. The git merge driver

`.gitattributes` claims `project.json` and the three files of every decomposed
v2 component. The driver command takes `%P` (the path being merged) so it can
tell them apart; repositories configured before this are upgraded automatically,
because `_setupRepository` rewrites the config on every `Git` instance.

Two paths, with different amounts of context:

- **In-editor** (`MergeStrategy`) — groups conflicted entries by component
  directory and merges the whole trio at once, reading unconflicted siblings
  from the working tree. Full semantics, including cross-file cases.
- **CLI** (`git merge` outside the editor) — git hands the driver one file at a
  time, so a `nodes.json` merge cannot see `connections.json`. The engine accepts
  a partial trio and merges what it has. Better than a line-based merge; it just
  cannot detect the cross-file cases.

This is why the main-process webpack config gained a TypeScript loader: the old
merger's header note ("this file has to be javascript and require until the main
process uses webpack+typescript") described a real constraint, and removing it
was a prerequisite for deleting the file.

## 9. What `extras` may and may not surface in a diff

`GraphSnapshot.extras` carries two unlike things under one field: real
component-level content (ports, component type) and bookkeeping that the editor
derives or the file format requires (`visualRoots`, file versions, ids, the
`modified` timestamp, the `hasCommentsArray` marker).

Only the first belongs in a change list a human reads. `GraphDiff` excludes the
derived and identity keys (`DERIVED_EXTRAS`) and strips the adapter namespace
from the rest, so `v2:ports` reads as `ports`.

This distinction was invisible in tests — every fixture exercised the merge, and
the merge is right to carry all of it. It only showed up when the diff panel was
read against a real project, where an ordinary edit produced:

```
Changed legacyGraph:visualRoots: [] → ["ae0dede5-b9e4-4981-af23-355dcb22ec7e"]
```

next to the two changes the user had actually made. Suppression is display-only:
the round trip still preserves every one of these keys verbatim, and the merge
still merges them.

The general rule for anything added to `extras` later: if the editor computes it
rather than the user authoring it, add it to `DERIVED_EXTRAS`.
