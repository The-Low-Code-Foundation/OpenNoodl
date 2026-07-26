# UIX-009: Long-tail Sweep & Visual QA Harness

## Metadata

| Field | Value |
|-------|-------|
| **ID** | UIX-009 |
| **Phase** | Phase 23 — Visual Refresh (Track I) |
| **Tier** | 3 — expansion |
| **Priority** | 🟡 Medium (the difference between "landed" and "polished") |
| **Difficulty** | 🟡 Medium (breadth, discovery, discipline) |
| **Estimated Time** | 1–2 weeks |
| **Prerequisites** | All prior UIX tasks (it closes the phase) |
| **Branch** | `task/uix-009-longtail-qa` |
| **Recommended executor** | 🟢 **Sonnet 5** (sweep) with escalation for anything that turns out to be redesign |
| **Anytime component** | The screenshot-corpus harness (see below) should be built at **phase start**, not phase end — it captures the "before" set |

## Objective

Sweep every remaining surface the Tier-1/2 tasks didn't explicitly own — popups, secondary panels, settings, version control, deploy, Learn, node picker, context menus, code editors — to the phase standard, and leave behind a screenshot-corpus harness that makes visual regressions visible forever after.

## Background

Tier 2 restyles the hero surfaces; a real product has dozens of secondary ones, and one un-restyled dialog inside a refreshed app reads worse than the old app did — inconsistency signals decay more loudly than age. Most of these surfaces inherit UIX-001/002/003's work automatically; this task is the audit that *proves* it surface-by-surface and fixes the stragglers. It also builds the phase's verification instrument: a scripted screenshot corpus using the existing CDP driving recipes (run-editor skill; the phase-16 corpus harness patterns; PLAT-001's scripted-canvas notes; the live-editor traps recorded in RUN-003's memory file), so "did we regress the UI" becomes a diffable question instead of a vibe.

## Current State (enumerate at task start — this list is the spec)

Known long-tail surfaces to audit (extend during inventory; nothing may be dropped silently):
- Node picker / create-node panel (`createnewnodepanel` lineage) — high-traffic, effectively Tier-2-adjacent
- Search / command surfaces; component browser
- Version control panels (SUB-007's diff/conflict UI chrome around the canvas), history views
- Backend Services panel (WF-007's rebuild — new, should be token-clean; verify), Permissions panel (BAK-003), data browser
- Deploy popouts/flows; cloud services dialogs
- Settings pages (project settings, editor settings, the new theme selector's home)
- Learn tab + lesson layer chrome (LEARN-001) — token inheritance check only, no redesign
- Context menus, tooltips, drag ghosts, notification banners not already migrated
- Code editors: CodeMirror chrome + syntax theme alignment with tokens (dark; light handled in UIX-008 — verify both here)
- Property editors for exotic node types (dynamic ports, arrays, color pickers — the pickers must show the *new* palette names from `styles/colors.js` name maps)
- Inline TSX styles list handed over from UIX-002; node-library icon triage list from UIX-007
- Any surface found by walking every menu item in the app (literally: every menu item)

## Desired State

- Every surface above audited against a short rubric (tokens only; AA contrast; kit controls; no red-as-action; focus visible; both themes) with pass/fixed/deferred status in a tracking table. "Deferred" requires a reason and an owner-note, not silence.
- **Screenshot-corpus harness:** a scripted run (CDP against the real editor, per the established recipes) that opens a fixture project and captures a named set — launcher (populated/empty/error), editor + each rail panel, properties for N node types, node picker, a diff view, key dialogs, both themes — into a dated folder; a trivial before/after gallery (static HTML) for eyeballing. Deterministic enough that diffs mean something (fixed window size, fixed fixture project, animations disabled). Pixel-diff automation is optional; the corpus + gallery is the deliverable.
- **"Before" set exists** from phase start (this task's harness, run first — the phase README orders it).
- Stale-docs note: a list of user-docs images/screenshots that now show the old UI (grep docs for image references; eyeball) filed for the docs repo — not fixed here.
- Phase CHANGELOG summarizing the visual delta with before/after pairs.

## Scope

### In Scope
- [ ] Harness + fixture project + "before" capture (phase start)
- [ ] Surface inventory (menu-walk complete) + rubric audit table
- [ ] Fixes for every stragglers-tier surface (styling only)
- [ ] CodeMirror theme alignment verification (both themes)
- [ ] Color-picker/property-editor palette-name coherence
- [ ] UIX-002's inline-style list + UIX-007's node-icon list triaged (fix cheap, defer documented)
- [ ] "After" corpus, both themes; gallery; stale-docs list; phase CHANGELOG

### Out of Scope
- Redesign of any surface (styling-level fixes only; anything bigger becomes a filed follow-up)
- Docs-repo screenshot replacement (listed, not done)
- Automated pixel-diff CI gating (optional stretch; don't block the phase on it)
- User-app/preview content

## Implementation Steps

1. **Phase start:** build harness, fixture, capture "before". (Do this even though the task formally runs last.)
2. Menu-walk inventory → audit table.
3. Fix stragglers in batches by area, re-capturing as batches land.
4. Handover-list triage (inline styles, node icons).
5. Final both-theme corpus + gallery + stale-docs list + CHANGELOG.

## Success Criteria

- [ ] Audit table covers every menu-reachable surface; zero unexplained "deferred"
- [ ] No surface in the final corpus shows old-palette chrome (spot-check: no `#d21f3c`-era red, no unstyled controls)
- [ ] Harness re-runs from a clean checkout with one command; corpus is deterministic enough to diff
- [ ] Before/after gallery exists and is linked from the phase README
- [ ] Stale-docs list filed; phase CHANGELOG written

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| A "straggler" turns out to be a redesign (e.g. node picker needs UX work) | Styling-only rule: restyle in place, file the redesign; escalate executor if ambiguous |
| Harness flakiness (timing, focus, animation) burns the task | Reuse the proven CDP recipes (RUN-003 driving traps memory: reload/pushState, webview-reload embedder death, one-session choreography); disable animations via a test flag; fixed window size |
| Menu-walk misses dynamically-gated surfaces (error states, empty states) | The rubric includes forced-state captures (corrupt project, empty profile) per UIX-006's patterns |
| Both-themes doubling makes the sweep drag | Capture both themes in one scripted run; audit them together per surface |

## References

- run-editor skill; phase-16 corpus harness; PLAT-001 scripted-canvas notes; RUN-003 live-editor CDP traps (memory)
- [UIX-002](./UIX-002-LEGACY-HEX-MOPUP.md) / [UIX-007](./UIX-007-ICONOGRAPHY.md) — handover lists
- All phase mocks and specs — the standard being enforced

## Checklist

- [ ] Harness + "before" corpus (phase start)
- [ ] Inventory + audit table
- [ ] Straggler fixes + re-captures
- [ ] Handover triage
- [ ] Final corpus + gallery + stale-docs list + phase CHANGELOG
