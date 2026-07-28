# CAN-005: Export Carries Authoring Intent

## Metadata

| Field | Value |
|-------|-------|
| **ID** | CAN-005 |
| **Phase** | Phase 28 — Canvas Legibility & Authoring Intent (Track M) — **specced here, executed in Phase 18** |
| **Tier** | 3 |
| **Priority** | 🟠 High as *scope protection* (F57: an existing spec is about to be orphaned); Medium as implementation |
| **Difficulty** | 🟡 Medium — no hard problems, four sources and a placement policy |
| **Estimated Time** | 1–1.5 weeks on top of a working generator |
| **Prerequisites** | CAN-002 (the `label` field); a working EXP-002 generator to inject into |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** for the placement policy (§2), then 🟢 **Sonnet 5** for the injection |

## Objective

Make exported code carry the reasoning the graph carried. Every author-written wire label, node comment,
custom node title and comment-box region becomes a comment or an identifier in the generated output, so a
human or an LLM picking up an export starts with intent, not just structure.

## Placement — this is a Phase 18 task

The work is generator work and cannot exist before generators do. It is specced in Phase 28 because
that is where the *sources* are being created and where the intent argument lives, and because of F57:

> [`CODE-008-node-comments-export.md`](../phase-7-code-export/CODE-008-node-comments-export.md) already
> specs node-comment export in detail — and [Phase 18](../phase-18-code-export-v2/PROGRESS.md), which
> supersedes phase 7, does not mention comments or labels anywhere in EXP-002's scope line. Phase 18's
> own instruction is to mark phase 7 superseded when EXP-001 begins. At that moment CODE-008 is
> orphaned: a complete design in a folder stamped dead, referenced by nothing live.

**So the first deliverable of this task is bookkeeping, not code:** fold this scope into EXP-002
explicitly, or re-issue it as `EXP-006`, before phase 7 is stamped. CODE-008's formatting helpers
(`formatAsJSDoc`, `formatAsInline`, `formatAsBlock`, `wrapComment`) and its placement heuristic are sound
and should be adopted, not rewritten.

## Background — four sources, three destinations

The mistake to avoid is treating all four as comments. They are not the same kind of information.

| Source | Where it lives | Becomes |
|---|---|---|
| Custom node title | `NodeGraphNode.label` | an **identifier** |
| Node comment | `metadata.comment` | JSDoc / inline comment |
| Wire label (CAN-002) | `Connection.label` | inline comment at the data-flow site |
| Comment box | `CommentsModel`, component-level | a **section banner** |

### Custom titles are identifiers, not comments

[`NodeGraphNode.label`](../../../packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNode.ts#L114-L123)
is a getter that falls back to `this.type.labelForNode(this)`, and `_label` is only populated when the
author set one. So a **serialized `label` key present means the author named this node** — a clean,
already-existing signal for distinguishing an authored name from a type default. `fromJSON` reads it at
[`:141`](../../../packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNode.ts#L141).

This matters more than any comment: it is the difference between `validateCard()` and `function_123()`.
CODE-008 already assumes `node.label` feeds the generated name
([its `nodeName` extraction](../phase-7-code-export/CODE-008-node-comments-export.md)) — this task makes
the authored/default distinction explicit rather than incidental, so a default title never becomes a
meaningless identifier or a redundant comment.

Note the painter's own test for this is `node.typeDisplayName() && node.model.label !== node.typeDisplayName()`
([`NodeGraphEditorNodePainter.ts:236`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNodePainter.ts#L236)) —
a value comparison, not a presence check. The exporter should prefer **presence of the serialized key**,
which is unambiguous, and treat the painter's comparison as the fallback for legacy files.

### Wire labels are the only irrecoverable source

A wire *disappears* in generated code — it becomes an assignment, a prop, a hook dependency. Its label is
therefore the one piece of intent a reader cannot reconstruct by looking at the output, however carefully
they read it. Node comments and titles have somewhere obvious to attach; a wire's meaning has to be
placed deliberately or it is lost.

### Comment boxes carry structure, and CODE-008 was wrong to deprioritise them

CODE-008 says: *"For code export, we focus on node-level comments since they're directly associated with
specific code constructs."* For its goal that was reasonable. For *this* goal — a coder or LLM picking up
the file — it is backwards. A box labelled "This section handles authentication" is the only source that
says how the graph was *organised*, and organisation is what a reader needs first.

Comment boxes are component-level with `{id, text, x, y, width, height}`
([`CommentsModel`](../../../packages/noodl-editor/src/editor/src/models/commentsmodel.ts)), so membership
is spatial: a node belongs to a box when its position falls inside the box's rect. That is a containment
test, not a graph relationship — cheap, and slightly fuzzy, which §2 accounts for.

## Desired State

### 1. Extraction

One pass producing an `AuthoringIntent` bundle per component, consumed by the generators rather than
scattered through them:

```ts
interface AuthoringIntent {
  /** nodeId -> comment text */
  nodeComments: Map<string, string>;
  /** nodeId -> author-given title (absent when the title is the type default) */
  authoredTitles: Map<string, string>;
  /** connectionKey -> author-written wire label */
  wireLabels: Map<string, string>;
  /** ordered regions, outermost first, with their member node ids */
  regions: Array<{ text: string; nodeIds: string[] }>;
  /** component-level description, when one exists */
  componentDescription?: string;
}
```

Keyed by `connectionKey` for wires — the same four-part key
[`GraphSnapshot.connectionKey`](../../../packages/noodl-editor/src/editor/src/versioning/GraphSnapshot.ts#L427)
uses, so the exporter and the diff engine agree on what identifies a connection.

### 2. Placement policy

The Fable-tier decision, because it is what determines whether the output reads as documentation or as
clutter. Starting position:

- **Authored title → the identifier**, sanitised to the target language's conventions. If sanitising
  loses information (spaces, punctuation, non-ASCII), emit the original as a comment *as well* — never
  silently discard what the author typed.
- **Node comment → JSDoc** on functions, components, and exported state; **inline** above the expression
  otherwise. CODE-008's `determineCommentPlacement` heuristic is adopted as-is.
- **Wire label → inline comment on the line the wire became.** When several wires collapse onto one line,
  join their labels rather than emitting several comments for one statement.
- **Region → a banner comment** above the first member's generated code, with a closing marker only when
  the region spans more than a handful of statements. Nested boxes nest, outermost first.
- **A node in no region, with no comment and a default title, emits nothing.** Silence is the default;
  every comment in the output traces to something a human typed.

The one rule that outranks the rest: **never invent.** No generated prose, no "this node does X"
descriptions derived from the type. Everything emitted is author text, verbatim except for formatting and
wrapping.

### 3. Honesty in the export report

EXP-004 owns the export report. It gains a line for intent carried and intent dropped: how many comments,
labels, titles and regions were emitted, and — importantly — **which were dropped and why** (a wire
label whose statement got optimised away, a title that could not be made an identifier). A silent drop of
author text is the failure this task exists to prevent, so it must be visible in the same place the rest
of the export's honesty lives.

## Implementation Steps

1. **First:** resolve F57 — fold this scope into EXP-002's task file or open EXP-006, and add the pointer
   from [phase-18/PROGRESS.md](../phase-18-code-export-v2/PROGRESS.md) so it cannot be lost when phase 7
   is stamped superseded.
2. Build the extraction pass with the authored-vs-default title rule, against real projects rather than
   fixtures.
3. Spatial containment for regions, including nesting and the boundary cases in the traps below.
4. Settle §2's placement policy, written down as prose before code.
5. Inject into generators; adopt CODE-008's formatters unchanged.
6. Add the intent lines to the EXP-004 report.
7. Verify on a real project with all four sources present: read the output and judge whether it helps.

## Success Criteria

1. Every author-written node comment, wire label, custom title and comment box in the source project is
   either present in the output or listed as dropped-with-reason in the report. Nothing vanishes silently.
2. A node the author never renamed produces no title comment and no meaningless identifier.
3. A wire label appears on the statement its wire became, and multiple labels on one statement are joined
   rather than stacked.
4. A comment box produces a banner over its members, and nested boxes nest correctly.
5. No emitted comment contains text no human wrote.
6. Generated files pass the target's formatter/linter with comments in place.
7. Judgment gate: hand an export with intent and the same export without it to a reader unfamiliar with
   the project. The first should be materially easier to pick up. If it is not, the placement policy in §2
   is wrong and should be revised before shipping.

## Out of Scope

- Any new authoring surface. This task only reads.
- AI-generated documentation, summaries or inferred descriptions — explicitly excluded by §2's last rule.
- Round-tripping comments back from edited code into the graph.
- Component-level `metadata.description`, which CODE-008 lists as future and which does not exist yet;
  the field is in the bundle so it costs nothing when it arrives, and nothing is built for it now.

## Traps

- **`label` is a getter with a fallback.** Reading `node.label` on a live model *always* returns
  something — the type's default when the author set nothing. Only the serialized JSON distinguishes them.
  An exporter reading live models will emit an authored title for every node in the project.
- **Comment-box containment is fuzzy at the edges.** A node overlapping a box boundary, a box overlapping
  two clusters, a box containing zero nodes, two boxes with identical rects. Decide each explicitly;
  centre-point containment with outermost-first ordering is the suggested rule, and a box with no members
  emits nothing.
- **Comment-box coordinates are in graph space and boxes are moved independently of nodes.** Membership is
  whatever the geometry says at export time, which may not be what the author intended six months ago.
  This is acceptable and should be *said* in the report rather than guessed at.
- **CODE-008's `updateCommentReferences`** rewrites node names mentioned inside comment text. It is a
  regex over author prose and will mangle sentences that happen to contain a node name. Adopt the rest of
  CODE-008; treat that function as opt-in at most.
- **The connection key must match the diff engine's.** If the exporter builds its own connection identity,
  wire labels will fail to match on exactly the graphs where a connection was rewired — use
  `connectionKey`.
- **Do not read `Connection.annotation`.** It is transient diff-presentation state (AIX-003) that can be
  populated while a diff view is open, and it sits on the same object as `label`.
