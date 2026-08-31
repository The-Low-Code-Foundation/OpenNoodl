# Phase 81 — task board

**Status legend**: ⬜ not started · 🟡 in progress · 🟢 done (WORTHY verdict recorded + Richard has seen it) · 🔴 blocked

Every task closes ONLY per README §3 (screenshot → look → verdict → WORTHY). Re-derive this board
from the task files at session open; do not trust a handoff's copy of it.

| id | task | status | depends on | verdicts recorded |
|---|---|---|---|---|
| VIB-001 | The Judge | 🟢 | — | **9 SHITTY / 0 PASSABLE / 0 WORTHY** — `VIB-001-BASELINE-VERDICTS.md`. All 5 ACs met; Richard ruled 2026-08-31 and the rubric was amended (README §2) |
| VIB-002 | The Ceiling | 🟡 | VIB-001 | **PASSABLE — Richard ruled 2026-08-31** (`VIB-002-THE-CEILING.md` §9): *"very passable, nearly worthy, definitely night and day with the original"*. **The phase's first reading above SHITTY to survive his look.** Capability closed (V5 + V13), 5 ACs met; the WORTHY gap he did not dispute is icons→VIB-003, sections→VIB-004, measure→VIB-008 |
| VIB-003 | The Pictures | 🟡 | VIB-001 | **PASSABLE — RICHARD RULED IT** 2026-08-31: *"nice, deffo passable and looking like a modern base template, good job"*. 🔴 **The first phase-81 page on which the imagery/iconography tell does NOT fire.** 5 ACs met; the WORTHY gap is content structure → VIB-004. Closed V7, V19, V20, V25; opened V21 (VIB-005), V22/V26/V28 (VIB-007), V27 (VIB-004), **V29 RULED** (VIB-004/008), V30 (VIB-011) |
| VIB-004 | The Marketing Kit | ⬜ | VIB-001, VIB-002 | — |
| VIB-005 | The Ambush Defaults | ⬜ | VIB-001 | — |
| VIB-006 | The Worked Page | ⬜ | VIB-002/003/004 | — |
| VIB-007 | The Brief | ⬜ | VIB-001 | — |
| VIB-008 | The Members' Area, Redeemed | ⬜ | VIB-002/003/004/005 | — |
| VIB-009 | The Site Builder, Redeemed | ⬜ | VIB-002/003/004/005 | — |
| VIB-010 | The Cold Proof | ⬜ | VIB-006, VIB-007 | — |
| VIB-011 | The Stock Library | 🟡 | VIB-003 | Opened 2026-08-31 by Richard's instruction (V30). Pipeline proven and source found (`Category:Images from Pixabay`, CC0 per file); **library unbuilt**. 🔴 Free-to-use is not free-to-bundle — Unsplash and Pexels both restrict redistributing photos as a collection, which is what bundling is |

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

### VIB-003 — The Pictures (V7) — 🟡 PASSABLE, 2026-08-31
Delivered: `noodl_modules/starter-imagery/` (6 generated SVGs, ~6 KB, in `STARTER_ASSETS`, so every
project has pictures offline); `get_style_vocabulary` gains an `icons` block naming the installed
sets and a complete copyable value; the authoring gate stops recommending the value that renders the
glyph's *name*; `judge()` installs the starter assets it had never had, so a photograph can contain
an icon at all. 🔴 **The imagery source story was decided as generated-and-abstract** — a shipped
photograph is a licence claim this repo cannot check, and an `<img src>` SVG cannot read the page's
tokens, so a *branded* picture would clash on the first preset change. The brand goes on top as
`backgroundGradient`, which is a token and does re-theme.
⚠️ **Bound on the close**: the page photographed is the recipe corpus, not a shipped template —
`templates/members-area/` has zero `Image`/`Icon` nodes, and putting pictures in it is VIB-008's
redesign, not this task's. Five defects were found by looking; four were in the shipped corpus.

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
