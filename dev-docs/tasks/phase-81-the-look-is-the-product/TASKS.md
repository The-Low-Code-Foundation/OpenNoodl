# Phase 81 — task board

**Status legend**: ⬜ not started · 🟡 in progress · 🟢 done (WORTHY verdict recorded + Richard has seen it) · 🔴 blocked

Every task closes ONLY per README §3 (screenshot → look → verdict → WORTHY). Re-derive this board
from the task files at session open; do not trust a handoff's copy of it.

| id | task | status | depends on | verdicts recorded |
|---|---|---|---|---|
| VIB-001 | The Judge | 🟡 | — | baseline recorded 2026-08-31 — see `VIB-001-BASELINE-VERDICTS.md`; AC1–4 met, AC5 awaits Richard |
| VIB-002 | The Ceiling | ⬜ | VIB-001 | — |
| VIB-003 | The Pictures | ⬜ | VIB-001 | — |
| VIB-004 | The Marketing Kit | ⬜ | VIB-001, VIB-002 | — |
| VIB-005 | The Ambush Defaults | ⬜ | VIB-001 | — |
| VIB-006 | The Worked Page | ⬜ | VIB-002/003/004 | — |
| VIB-007 | The Brief | ⬜ | VIB-001 | — |
| VIB-008 | The Members' Area, Redeemed | ⬜ | VIB-002/003/004/005 | — |
| VIB-009 | The Site Builder, Redeemed | ⬜ | VIB-002/003/004/005 | — |
| VIB-010 | The Cold Proof | ⬜ | VIB-006, VIB-007 | — |

## Task summaries

Full ACs live in per-task files as they open. VIB-001 is written (`VIB-001-THE-JUDGE.md`); open the
others as they start, carrying the README §3 protocol as their close condition.

### VIB-002 — The Ceiling (register V5, V13)
Give the sanctioned vocabulary decorative power: gradient grounds, image grounds with overlay,
depth (shadow already exists — layering/translucency do not). Candidate seams: new port(s) on
`Group` (`backgroundImage`/gradient), or blessed `styleCss` compositions with door coverage so the
escape hatch stops being off-doctrine. Include the display-type story (V13): what does a 72px+
hero headline responsibly look like here? **Close**: a demonstration page using each new
capability renders through the Judge and the capability itself is judged expressible-on-system —
plus the doctrine/vocabulary text that teaches it.

### VIB-003 — The Pictures (V7)
Templates ship assets (the `noodl_modules/` mechanism exists; no template uses it); the curated
delivery path (`readBundleDirectory`) must carry them. Fix the example corpus's `src:""` images.
Decide the honest imagery source story for generated apps (bundled starter assets / a
documented placeholder service / generated SVG). **Close**: a template page renders with a real
image and real icons through the Judge.

### VIB-004 — The Marketing Kit (V6, V12)
Compositions for hero, ctaBand, featureItem, statTile, testimonial, footer, badge/pill — sourced
from designed recipes, not invented in the compositions file. Revisit `repeated-sibling-subtree`
for *content-varied* siblings (V12): three different feature cards are not a repetition defect.
**Close**: one page assembled purely from the new compositions judged ≥PASSABLE with the WORTHY
gap named — this task builds vocabulary; VIB-006/008 prove WORTHY.

### VIB-005 — The Ambush Defaults (V1, V2)
The silent traps that produced the members-area screenshots: un-`sizeMode`d Group in a column
(door diagnostic naming the consequence + doctrine line + composition coverage so authored groups
always carry an explicit sizeMode); a scrolling page-ground composition (`scrollEnabled` on the
sanctioned page spine) so below-the-fold content is reachable by default; `clip:true` gets a
diagnostic when its subtree can exceed its box. **Close**: re-author the naive page (the exact
members-area shape) through the door — the door must SAY something at authoring time, and the
rendered page must scroll. Judged by screenshots of before/after.

### VIB-006 — The Worked Page (V8)
At least one complete designed landing page in the example corpus — every band, real copy in a
voice, real imagery, the new compositions — validated like every other example. This is the thing
a model imitates; it is worth more than any rule. **Close**: the example itself renders WORTHY
through the Judge.

### VIB-007 — The Brief (V9, V10)
Move ambition into what the model reads every turn: server instructions + tool descriptions gain
the design bar (short, imperative — "a landing page with no image, no icon and one background is
not done"); `get_style_vocabulary` leads with what to reach for, not only what to avoid.
Render-measure gains poverty findings (single-column-no-media-no-fill page; one-weight typography
as more than an info; dead-viewport ratio) so gate pressure points both ways. ⚠️ MCP surface
budgets apply (8,200-token gate) — measure before widening. **Close**: an agent given only the
standard surfaces produces measurably richer output than the baseline (A/B through the Judge).

### VIB-008 — The Members' Area, Redeemed (V3, V4 + P78 handoff)
Fix the first-run truth: a designed no-backend/unclaimed state (V4), fail-closed gating (V3 — the
chrome gates on standing, failure navigates away), the layout/scroll repairs (consuming VIB-005),
then redesign the landing and members surfaces with the widened kit. Coordinate with P78 T6
(D22/D23/D24) rather than duplicating. **Close**: landing + one members page WORTHY in both
states at all three widths.

### VIB-009 — The Site Builder, Redeemed
Same bar for the site-builder public site (its admin pages are recorded debt — judge them for
designed clarity, not marketing flash). ⚠️ P77 is active in this template's files — check the
lane before touching. **Close**: public site WORTHY with a real Theme applied.

### VIB-010 — The Cold Proof
A fresh app (a plausible user brief, e.g. "a landing page + waitlist for a local business")
authored through the MCP door by an agent session given nothing but the standard tool surfaces —
no phase-81 coaching, no hand-editing. Screenshot judged. **This is the phase's exit exam and the
only AC that grades the pipeline rather than an artefact.** If it comes out SHITTY, the why-seam
analysis (README §3.6) reopens the tier that failed. **Close**: WORTHY, cold.
