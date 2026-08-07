# EXP-006: Export Carries Authoring Intent

## Metadata

| Field | Value |
|-------|-------|
| **ID** | EXP-006 |
| **Phase** | Phase 18 — Code Export v2 (Track F) |
| **Status** | Not started — blocked on EXP-002 having a generator to inject into |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium — no hard problems; four sources and a placement policy |
| **Estimated Time** | 1–1.5 weeks on top of a working generator |
| **Prerequisites** | EXP-002 (generators). The graph-side sources all exist: shipped in phase 28 |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** for the placement policy, then 🟢 **Sonnet 5** for the injection |

## Why this file exists

This is the resolution of phase 28's **F57**, and it is the whole of CAN-005's first deliverable.

[`phase-7-code-export/CODE-008-node-comments-export.md`](../phase-7-code-export/CODE-008-node-comments-export.md)
specs node-comment export in full detail. Phase 18 supersedes phase 7, and nothing in EXP-001…005'
scope mentions comments, labels or titles — so the moment phase 7 is stamped superseded, a complete
design ends up in a folder marked dead with nothing live pointing at it. Opening the scope as a task
here is what stops that, and it had to happen **before** the stamp, not after.

## Scope

Full design: [CAN-005](../phase-28-canvas-legibility/CAN-005-EXPORT-AUTHORING-INTENT.md). It is the
spec for this task and is not duplicated here. In summary — four sources, three destinations:

| Source | Where it lives | Becomes |
|---|---|---|
| Custom node title | `NodeGraphNode.label` (serialized key present = the author named it) | an **identifier** |
| Node comment | `metadata.comment` | JSDoc / inline comment |
| Wire label | `Connection.label` — **shipped by CAN-002** | inline comment at the data-flow site |
| Comment box | `CommentsModel`, component-level, spatial membership | a **section banner** |

Two rules outrank everything else in CAN-005 §2: **never invent** (every emitted comment traces to text
a human typed), and **never silently drop** (anything not emitted is listed in EXP-004's report with a
reason).

## What phase 28 already did for this task

- `Connection.label` exists, is authored through the canvas, and is a first-class serialized key.
- It survives version control: `CONNECTION_KNOWN_KEYS`, a `connection-relabelled` diff kind, and
  field-level merge with conflicts. So a label a reader relies on cannot quietly disappear upstream of
  the exporter.
- `connectionKey` is the shared connection identity — the exporter must use it rather than minting its
  own, or wire labels will fail to match on exactly the graphs where a connection was rewired.

## Adopted, not rewritten

CODE-008's formatting helpers (`formatAsJSDoc`, `formatAsInline`, `formatAsBlock`, `wrapComment`) and its
`determineCommentPlacement` heuristic are sound; take them as they are. Its
`updateCommentReferences` is a regex over author prose and will mangle sentences containing a node name —
opt-in at most. CAN-005 disagrees with CODE-008 on exactly one point, deliberately: comment boxes **do**
reach the export, because how a graph was organised is what a new reader needs first.

## Success criteria

CAN-005 §Success Criteria, unchanged — including its judgment gate: hand a reader unfamiliar with the
project an export with intent and one without, and the first should be materially easier to pick up.
