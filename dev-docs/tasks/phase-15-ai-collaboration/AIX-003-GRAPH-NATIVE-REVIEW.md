# AIX-003: Graph-Native Review of AI Changes

## Metadata

| Field | Value |
|-------|-------|
| **ID** | AIX-003 |
| **Phase** | Phase 15 — AI Collaboration Experience (Revival Track C) |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 3–4 weeks |
| **Prerequisites** | AIX-002; SUB-007 (graph diff, Phase 13); benefits from PLAT-001 |
| **Branch** | `task/aix-003-graph-native-review` |
| **Recommended executor** | 🟠 **Opus 4.8** — the diff engine comes from SUB-007; this is visual and interaction design over it. Substantial UI work with a clear target, needing judgement about how to make large changes readable at a glance. |

## Objective

Show the user exactly what an AI changed — nodes added, removed, rewired, reparameterised — rendered on the canvas before they accept it.

## Background

This is the task that makes the product's central claim literal. "You can see what the AI did" is the difference between the legibility thesis being a slogan and being a feature. When an AI writes code, review means reading a diff of text and mentally reconstructing the behaviour. When an AI writes a node graph, review can mean *looking at the architecture* — this node appeared, that connection moved, this parameter changed — which is a fundamentally lower-effort form of comprehension and the one genuine advantage a visual medium has in the AI era.

AIX-002 ships a coarse version: accept the whole thing or reject it. That is enough to test whether people want AI authoring at all, but not enough for the trust the strategy depends on. Users will not accept AI changes to real projects they care about on an all-or-nothing basis, and they should not.

The engine for this already exists by the time this task starts: SUB-007 built semantic graph diff for version control. This task is largely the application of that engine to a different source of change — an AI proposal rather than a Git branch — which is a good sign the substrate was designed correctly.

## Current State

- AIX-002 delivers authoring with binary accept/reject against a staging area.
- SUB-007 delivers a semantic diff engine producing typed change lists (nodes added/removed/moved/reparameterised, connections created/deleted/rewired) plus a diff review UI for version control.
- The canvas hosts React overlay roots; PLAT-001 unifies that mechanism, which makes an additional overlay cheaper to add cleanly.
- Nothing currently visualises a proposed-but-unapplied change.

## Desired State

When an AI proposes changes, the user sees them on the canvas:

- **Added** nodes and connections rendered distinctly (a clear additive treatment)
- **Removed** elements shown in place, marked as going away
- **Modified** nodes marked, with changed parameters inspectable
- **Rewired** connections showing both old and new routing
- A change list beside the canvas, navigable — click an entry, the canvas focuses it
- Granular acceptance where practical: accept everything, or reject specific changes
- A clear, always-available way to see the before state

## Scope

### In Scope
- [ ] Canvas overlay rendering the diff (added / removed / modified / rewired treatments)
- [ ] Change list panel with navigation to each change
- [ ] Parameter-level detail for modified nodes
- [ ] Before/after toggle
- [ ] Granular accept/reject where the change set permits it
- [ ] Reuse of SUB-007's diff types (no second diff implementation)
- [ ] Readable presentation of large change sets (grouping, summarisation)
- [ ] Accessibility: never rely on colour alone to convey change type

### Out of Scope
- The diff engine itself (SUB-007)
- Merge-conflict resolution (SUB-007's version-control UI)
- Reviewing changes to non-graph assets (styles, settings) beyond a simple listing
- Real-time collaborative review (Phase 20)

## Technical Approach

### New Files to Create

| File | Purpose |
|------|---------|
| `.../views/CanvasOverlays/DiffOverlay/` | Canvas rendering of a change set |
| `.../views/panels/ChangeReviewPanel/` | Change list, navigation, granular accept/reject |
| `.../models/AiAssistant/authoring/ChangeSet.ts` | Adapter from AI proposals to SUB-007's diff types |

### Design notes

Follow the established overlay pattern — a React root over the canvas with `pointer-events` managed so the canvas still receives input, per the rules in `dev-docs/reference/LEARNINGS.md`. If PLAT-001 has landed, use its unified overlay host rather than adding a sixth ad-hoc mount.

**Large change sets are the real design problem.** A five-node change is trivially readable; a forty-node page is not, and an unreadable review is functionally the same as no review — users will click accept without looking, which is precisely the failure mode this feature exists to prevent. Group changes by intent, summarise at the top ("added 12 nodes, rewired 3 connections"), and let the user drill in. Consider a guided walkthrough for large sets.

Do not rely on colour alone. Use shape, badges, or line treatment as well — both for accessibility and because the canvas already encodes meaning in colour (node categories).

## Implementation Steps

1. **Adapter first**: express an AI proposal as a SUB-007 change set. If that mapping is awkward, fix it here rather than duplicating diff logic.
2. **Static rendering** of a change set on the canvas — added, removed, modified, rewired — with a fixed example.
3. **Change list panel** with canvas navigation.
4. **Parameter-level detail** for modified nodes.
5. **Before/after toggle.**
6. **Granular accept/reject**, where dependencies allow (a connection cannot be accepted if the node it targets is rejected — model and enforce these dependencies).
7. **Large-change-set treatment**: grouping, summary, walkthrough.
8. **Test with real proposals** from AIX-002, at several sizes.

## Testing Plan

- Rendering correctness for each change type against fixture change sets.
- Dependency enforcement: rejecting a node correctly rejects connections that require it.
- Large change set (40+ nodes) reviewed by a human who has not seen the change — can they say what happened?
- Accessibility check: change types distinguishable without colour.
- Round trip with AIX-002: propose, review, partially accept, verify the resulting project matches the accepted subset exactly.

## Success Criteria

- [ ] All change types render distinctly and correctly on canvas
- [ ] Change list navigates to changes; parameter detail available
- [ ] Before/after toggle works
- [ ] Granular accept/reject with dependency enforcement
- [ ] A human can describe what changed in a 40+ node proposal without reading JSON
- [ ] Change types distinguishable without colour
- [ ] No duplicate diff implementation — SUB-007's types reused

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Large change sets are unreadable, so users blind-accept | Grouping, summary, and walkthrough are in scope, not optional; test explicitly with a 40+ node set and a fresh reviewer |
| Partial acceptance produces an invalid graph | Model change dependencies explicitly; validate the accepted subset with SUB-006 before applying; refuse invalid combinations with an explanation |
| Overlay conflicts with other canvas overlays | Use the unified overlay host (PLAT-001); coordinate if PLAT-001 has not landed |
| Diff logic duplicated because the adapter is awkward | Step 1 exists to force this question early; fix SUB-007's types rather than forking them |

## References

- [Viability report — §2.1 (legibility as the surviving advantage)](../../reviews/NOODL-VIABILITY-REPORT.md)
- [Revival roadmap — Track C](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- `dev-docs/reference/LEARNINGS.md` — React-over-canvas overlay rules
- Depends on: AIX-002, SUB-007. Related: PLAT-001 (overlay host)

## Checklist

- [ ] Branch `task/aix-003-graph-native-review`
- [ ] Build the AI-proposal → SUB-007 change-set adapter
- [ ] Static canvas rendering of all change types
- [ ] Change list panel + navigation + parameter detail
- [ ] Before/after toggle; granular accept/reject with dependency rules
- [ ] Large-change-set grouping and walkthrough; fresh-reviewer test
- [ ] Accessibility verification; CHANGELOG; open PR
