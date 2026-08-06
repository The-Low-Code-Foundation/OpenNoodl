# Phase 51 — Collaboration (Track C: more than one builder)

**Created:** 2026-08-06
**Status:** 📋 Specced, not started — 6 tasks. Post-alpha.
**Origin:** [the counter-review](../../reviews/NODEGX-VS-CODE-THE-COUNTER-REVIEW.md) §B.2 — an
omission neither comparison document contained, and which an outside reviewer named within an hour.

## The constraint, in the platform's own words

[`MergeConflicts.tsx:10-17`](../../../packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/components/MergeConflicts.tsx):

> *"Resolution scope, stated rather than hidden: value conflicts (parameters, state values and
> transitions, labels, variants) are applied to the live project. **Structural conflicts** — a node
> one side deleted and the other edited, cross-side reparents, rewiring against a deleted node —
> **are shown for review and dismissed, not auto-applied**… Take the other side wholesale by
> re-running the merge if that is what you want."*

Parse it against a real Tuesday. Alice adds a node to `/Pages/Dashboard`; Bob reparents a sibling in
the same component. **There is no merge.** You take one side of the whole component and redo the
other by hand. In git that is a three-line conflict resolved in forty seconds.

The comment is admirably honest — this is not a hidden defect, it is a stated boundary. The phase
exists because the boundary is in the wrong place.

## What this costs, stated plainly

**The team size this tool currently supports is approximately one.** That single fact excludes:

- agencies (2–4 people on a client build — [the highest-value commercial category](../../reviews/NODEGX-WHAT-IT-IS-FOR.md#32-agencies-and-consultancies--the-prototype-that-is-not-a-throwaway))
- any internal tool that outlives its author and gets a second maintainer
- any project where a human and an agent work in the same session

And it compounds with the AI story rather than being rescued by it. **An agent's characteristic
output is a large structural change to one component.** The built-world document celebrated that
plans are *"atomic and discard byte-identically"* — true within one apply, and irrelevant to two
humans and an agent on one branch. **The property that makes agent authoring safe in isolation is
the property that makes it unmergeable in a team.**

## The honest framing of the problem

Three-way merge of a tree with moves is a genuinely hard problem — it is not an oversight that this
was deferred. But "hard in general" is being used to justify "dismissed in every case", and the
common cases are not hard:

| Case | Frequency | Tractable? |
|---|---|---|
| add / add on different parents | very common | ✅ trivially |
| edit / edit on different nodes | very common | ✅ trivially |
| add / edit in one component | very common | ✅ |
| reparent / edit elsewhere | common | ✅ with a move-aware diff |
| reparent / reparent, same node, different targets | rare | ❌ genuinely ambiguous — ask |
| delete / edit, same node | rare | ❌ genuinely ambiguous — ask |

**So the goal is not "solve tree merge."** It is: *shrink the dismissed set from **every** structural
conflict to the genuinely ambiguous ones, and make that residue resolvable **per node** instead of
per component.* That is a large, achievable improvement and it is what COL-001 and COL-002 are.

## Tasks

| ID | Title | Est. | Notes |
|---|---|---|---|
| **COL-001** | A move-aware structural diff | 2 wks | Today's diff sees a reparent as delete+add, which is why it cannot merge one. Match nodes by id across the three sides and classify: added, removed, moved, rewired, edited. Everything else here depends on it, and it also makes [LEG-003](../phase-50-legibility/README.md)'s diff far better — the two phases meet here. |
| **COL-002** | Merge the tractable cases | 2 wks | The ✅ rows above, applied rather than dismissed. Property-tested: merging A into B and B into A must produce the same graph, and a merge with no conflicts must be a no-op when the sides are identical. |
| **COL-003** | Resolve the residue per node | 1.5 wks | The ❌ rows get a real resolution UI — mine/theirs **per conflicting node**, with the graph visible behind it. Never "take the other side wholesale by re-running the merge", which is the current answer and is why an afternoon disappears. |
| **COL-004** | Component claiming | 3 d | ⚠️ **Ship this first, alone, before COL-001.** A soft advisory lock — "Bob has had `/Pages/Dashboard` open for 20 minutes" — surfaced in the components panel and on open. It does not prevent anything and needs no merge work. It is three days and it prevents most of the collisions that COL-001…003 exist to resolve. |
| **COL-005** | The agent declares its blast radius | 3 d | An MCP plan already names every component it will touch. Surface that as a claim for the duration of the apply, and refuse (cleanly, with the reason) if a human has one open. Turns "the agent and I collided" from a merge problem into a scheduling one. |
| **COL-006** | A merge corpus | 1 wk | Fixture pairs for every row of the table above, run as a gate. Merge correctness is exactly the kind of thing that regresses silently, and this repo's recorded history is full of gates that went green wrongly. |

**Total: ~7 weeks**, of which **COL-004 is 3 days and delivers a disproportionate share of the
practical benefit.** Do not let it wait for the merge work.

## Deliberately out of scope

- **Real-time collaborative editing** (CRDT, multiplayer cursors). A different product, an order of
  magnitude more work, and it does not solve the git case anyone actually has.
- **A browser editor.** Named repeatedly as a constraint elsewhere; genuinely large; not this phase.
- **Hard locks.** A lock you cannot break is a lock that strands work when someone goes on holiday.
  COL-004 is advisory on purpose.

## Exit criteria

1. Alice adds a node to a component while Bob reparents a sibling in the same component; **both
   changes survive the merge**, with no manual redo. This is the exact case that fails today.
2. A genuinely ambiguous conflict presents per-node mine/theirs, and resolving it does not discard
   the non-conflicting work in the same component.
3. Merge is order-independent: A→B and B→A agree, property-tested.
4. Opening a component someone else has open says so, within three days of phase start.
5. An agent plan that would touch a component a human has open is refused with a nameable reason
   rather than colliding.
