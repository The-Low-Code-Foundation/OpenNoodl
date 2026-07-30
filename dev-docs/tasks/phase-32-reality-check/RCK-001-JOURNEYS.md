# RCK-001: User Journeys as First-Class Objects

## Metadata

| Field | Value |
|-------|-------|
| **ID** | RCK-001 |
| **Phase** | Phase 32 — Reality Check (Track Q) |
| **Tier** | 1 — the model |
| **Priority** | 🔴 Critical — everything in both tiers above it is a consumer |
| **Difficulty** | 🟠 Medium–High |
| **Estimated Time** | 1.5–2 wks |
| **Prerequisites** | none |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** — this defines a document type. Seven downstream tasks, the canvas, the AI loop and the gate all read it |

## Objective

A user journey is a real object in a NodeGX project: a goal, an ordered set of steps, each step
anchored to a component, visible on the canvas, and computable against the graph.

## Background

This is the task that survives even if every other task in the phase were cut, and it came from
Richard's own framing:

> "We need the user and AI collaboratively designing user journeys, putting the existing comment system
> as points on the canvas that show what user journey each component deals with, have the user journeys
> written down somewhere mapped to components and workflows, string them together into a real user
> experience you expect someone to have."

Three separate capabilities fall out of one object:

1. **A brief.** A persona (RCK-004) is given the journey's *goal* and must find its own way. The steps
   are what reality gets diffed against.
2. **A regression suite.** RCK-002 replays the steps deterministically on every graph change.
3. **A coverage map, before anything runs.** Components touched by zero journeys are visible at design
   time — either dead weight or a feature nobody drew a path to. That is the *"20 users glossed over
   90% of the features"* number, available before a single tester exists.

The nearest prior art is the control-panel chapter's `USER_JOURNEYS.json` — *"defines step-by-step test
flows […] rendered as interactive pass/fail checklists"*, with an AI rule to append one after every
feature. That is the same idea implemented as a convention file a human must maintain. NodeGX has the
components; the journey should *point at them*, and know when they move.

WFA-004 established the precedent for the document-type question: a workflow is its own document type
with its own canvas, and that turned out to be right. A journey is lighter than that — it is an overlay
on existing component graphs, not a graph of its own.

## Current State

| Piece | State |
|---|---|
| Components | `ComponentsPanelNew`, the component tree, warning dots (F62) |
| Comments on canvas | comment nodes + comment-box regions exist (`NodeGraphNode`, `EditorClipboard`, `NodeContextMenu`); CAN-002 makes node comments findable without hovering |
| Routes / navigation | Page Router, Page Stack (NDA-008), navigation nodes |
| Canvas overlays | `views/CanvasOverlays/` — the WFA-002 execution overlay is the working example |
| Anything journey-shaped | nothing |

## Desired State

### 1. The object

```ts
interface Journey {
  id: string;
  name: string;                     // 'Book a first session'
  goal: string;                     // what the user is trying to achieve, in their words
  persona?: string;                 // optional archetype hint for RCK-004
  entry: { componentId: string; route?: string };
  steps: JourneyStep[];
  createdBy: 'user' | 'ai';
  status: 'draft' | 'active' | 'retired';
}

interface JourneyStep {
  id: string;
  intent: string;                   // 'choose a coach'  — an outcome, never 'click the blue button'
  componentId: string;              // the anchor
  nodeId?: string;                  // the specific affordance, when there is one
  optional?: boolean;               // a step a user may legitimately skip
  successWhen?: StepAssertion;      // what makes this step done — RCK-002 needs it
}
```

**`intent` is phrased as an outcome, never as an instruction.** This is enforced in the authoring UI and
in the AI generator, and it is not a style preference: *"click Continue"* given to a blind persona
(RCK-003) is a leaked selector, and given to a human tester it is a leading question. Both failure modes
have the same fix.

### 2. Anchored on the canvas

A step's anchor is visible where the work happens. Richard's instinct to reuse the comment system is
right — the canvas already has a vocabulary for "a note attached to this place" and adding a second one
would be worse.

- A component participating in journeys shows which, on its card and in the component tree.
- On an open graph, the anchored node carries a journey marker; clicking it lists the journeys and
  jumps between steps.
- **Journey markers are not comments.** They render in the same idiom, but they are structured and
  derived from the journey object — an author must not be able to break a journey by editing a comment.

### 3. Coverage, computed statically

The headline view, available with zero test runs:

- components reached by ≥1 journey vs. components reached by none
- interactive affordances (per the node catalog) covered vs. uncovered
- journeys whose steps no longer resolve

Rendered as a heatmap over the component tree. *"14 of your 34 components are on no journey"* is the
sentence this task exists to produce, and it should be reachable from the Components panel on day one.

### 4. It survives the graph changing

The differentiator, and the thing QA Wolf structurally cannot do. Because the editor owns both sides:

- Deleting or renaming a component or node that a journey step anchors to raises a **journey orphan**
  at edit time, in the same session, naming the journeys affected.
- The author is offered a re-anchor rather than a broken test discovered later by a runner.
- An orphaned step never silently passes. It is `unresolved`, which is distinct from failing.

This is CAN-001/002's neighbourhood (labels and comments surviving edits) and NDA-015's
explicit-binding reasoning applies: a reference to a node needs a visible record of what it found.

### 5. Authored collaboratively

- **By hand**, from a component: *"start a journey here."*
- **By AI**, from the graph: propose journeys by reading routes, entry points and the affordances
  between them, then let the user correct. This is the *"I don't know what to test"* half of the excuse
  problem, and it is a `planTools.ts`-shaped addition to the MCP server.
- Either way the user owns the result — an AI-proposed journey lands as `draft` and never as `active`.

### 6. MCP surface

`journeys_list`, `journeys_get`, `journeys_propose`, `journeys_upsert`, `journeys_coverage`. RCK-004's
persona harness and Phase 31's OPS-007 (filter content by unreached components) are both consumers.

## Implementation Steps

1. **Decide the document-type question first** and record it: journeys as an overlay on component
   graphs, not a graph of their own. WFA-004's assessment is the template for how to write that down.
2. The object, its storage in the project, and the orphan detection at edit time.
3. Canvas markers + component-tree participation, in the comment idiom but structurally separate.
4. Static coverage + the heatmap.
5. Hand authoring, then AI proposal.
6. MCP tools.
7. **Live pass**: author three journeys on the QA fixture, then delete a component one of them anchors
   to and confirm the orphan is raised *in that session* with a re-anchor offered. Screenshot the
   coverage heatmap.

## Success Criteria

- [ ] A journey is authorable by hand and proposable by AI; AI proposals arrive as `draft`.
- [ ] Steps are anchored, and anchors are visible on the canvas and in the component tree.
- [ ] Deleting an anchored component raises the orphan **in the same editing session**, naming the
      journeys, and offers a re-anchor.
- [ ] An orphaned step reads as `unresolved`, never as passing.
- [ ] Static coverage reports components and affordances on no journey, over the QA fixture.
- [ ] `intent` phrasing is enforced as outcomes in both the authoring UI and the generator.
- [ ] Journey markers cannot be broken by editing a comment.
- [ ] All six MCP tools work.

## Out of Scope

- **Running anything.** RCK-002 replays; this task defines.
- **A journey canvas.** Journeys overlay existing graphs. If a dedicated canvas turns out to be needed,
  that is a follow-up with evidence, not an assumption.
- **Branching journeys.** Linear with optional steps, first. A DAG of user intent is a research project
  and the linear case covers what people actually test.
- **Backend-only journeys.** A cloud function has no user. WFA-004's workflow canvas owns that.

## Traps

- **`intent` will drift into instructions.** *"Click Continue"* is what everyone writes. It leaks
  selectors to a blind persona and leads a human tester. Enforce it in the UI, in the generator prompt,
  and in a lint that flags imperative verbs plus UI nouns.
- **Do not overload the comment model.** Richard's instinct is about the *idiom*, not the storage. A
  journey stored as a comment is a journey a text edit can corrupt, and CAN-002 is concurrently
  changing how comments render.
- **Anchors must survive a rename, not just a delete.** Rename is the more common and quieter case.
  Anchor by id, display by name.
- **A repeater instantiates one node many times.** A step anchored inside a repeater must anchor to the
  definition and record which instance was involved — the same distinction OPS-003 hit.
- **The coverage number is a weapon and it will be wrong at first.** A component reachable only by an
  admin route, or only after payment, is not dead weight. Ship an explicit "not on a journey by design"
  marking in the same release, or the first honest user gets told to delete their admin panel.
- **`forEachRecursive` returns truthy to abort** (parallel-batch 2026-07-26) — relevant the moment
  anything walks the component tree to compute coverage.
</content>
