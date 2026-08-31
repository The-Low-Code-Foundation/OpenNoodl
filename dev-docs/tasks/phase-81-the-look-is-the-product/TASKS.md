# Phase 81 — task board

**Status legend**: ⬜ not started · 🟡 in progress · 🟢 done (WORTHY verdict recorded + Richard has seen it) · 🔴 blocked

Every task closes ONLY per README §3 (screenshot → look → verdict → WORTHY). Re-derive this board
from the task files at session open; do not trust a handoff's copy of it.

| id | task | status | depends on | verdicts recorded |
|---|---|---|---|---|
| VIB-001 | The Judge | 🟢 | — | **9 SHITTY / 0 PASSABLE / 0 WORTHY** — `VIB-001-BASELINE-VERDICTS.md`. All 5 ACs met; Richard ruled 2026-08-31 and the rubric was amended (README §2) |
| VIB-002 | The Ceiling | 🟡 | VIB-001 | **PASSABLE — Richard ruled 2026-08-31** (`VIB-002-THE-CEILING.md` §9): *"very passable, nearly worthy, definitely night and day with the original"*. **The phase's first reading above SHITTY to survive his look.** Capability closed (V5 + V13), 5 ACs met; the WORTHY gap he did not dispute is icons→VIB-003, sections→VIB-004, measure→VIB-008 |
| VIB-003 | The Pictures | 🟡 | VIB-001 | **PASSABLE — RICHARD RULED IT** 2026-08-31: *"nice, deffo passable and looking like a modern base template, good job"*. 🔴 **The first phase-81 page on which the imagery/iconography tell does NOT fire.** 5 ACs met; the WORTHY gap is content structure → VIB-004. Closed V7, V19, V20, V25; opened V21 (VIB-005), V22/V26/V28 (VIB-007), V27 (VIB-004), **V29 RULED** (VIB-004/008), V30 (VIB-011) |
| VIB-004 | The Marketing Kit | 🟡 | VIB-001, VIB-002 | ⚠️ **Its named blocker is CLOSED by VIB-011** — the hero and the three avatars are real photographs now; re-render lives in `verdicts/vib-011/`, and VIB-004's own committed verdict PNGs are untouched. **PASSABLE 2026-08-31** (`VIB-004-THE-MARKETING-KIT.md` §3), provisional until Richard looks. Six grounds on one page, equal 374/374 measure at 1900. 🔴 **V6's premise was wrong**: five of the seven arrangements already shipped as recipes — what was missing was that none was a NAMED SET. Closed V12 (the rule cannot see a component instance; 3 spec rows + control); built V29 into `ctaBand`; V27 in three compositions. Opened **V31** (the 7 `--shadow-*` tokens are unreachable — no port takes a box-shadow string) and corrected **V22** to 14 examples. WORTHY gap = the pictures → **VIB-011** |
| VIB-005 | The Ambush Defaults | ⬜ | VIB-001 | — |
| VIB-006 | The Worked Page | 🟡 | VIB-002/003/004 | **WORTHY — the phase's first**, provisional until Richard looks (`VIB-006-THE-WORKED-PAGE.md` §9). `docs/node-catalog/examples/ui-landing-page.json` ships: **14 components, 129 nodes, 8 bands, a 9-node page**, 7 distinct grounds, **8 distinct photographs**, three different faces, gated 67/67 strict. 🔴 **V8 re-derived before building and it held harder than the row said**: the most bands on any `Page` in the corpus was **2**, and **zero** examples had 3 bands with a picture and a glyph. 🔴 **`oversized-page` — an INFO that does not fail the run — named the better shape** (90-node page ⇒ eight section components). Four defects found by LOOKING that no gate could see (a nav that lost two links at 390); opened **V38** (`justifyContent` cannot centre a `Columns` child — three configurations, one rendering, so the parameter was DELETED rather than shipped inert) and **V39** (`ui-image-scrim-band`'s description still said its picture was empty). AC6 answers Richard's hero question. ⚠️ `typecheck:backend-tests` OOMs even narrowed to two files |
| VIB-007 | The Brief | ⬜ | VIB-001 | — |
| VIB-008 | The Members' Area, Redeemed | ⬜ | VIB-002/003/004/005 | — |
| VIB-009 | The Site Builder, Redeemed | ⬜ | VIB-002/003/004/005 | — |
| VIB-010 | The Cold Proof | ⬜ | VIB-006, VIB-007 | — |
| VIB-012 | Prune On Deploy | 🟢 | VIB-011 | **ACs 1–4 and 6 met; AC5 met with a stated bound.** V36 closed: the deploy of the real VIB-004 project goes **3.35 MB → 92 KB (97.3%)**. ⚠️ **Not a look task** — it closes on measurement, not a WORTHY screenshot, and says so rather than borrowing §3. ⚠️ **Bound on AC5**: the *planner* was run against the real project and the real library, and the copy-path integration is covered by 12 specs through `copyProjectFilesToFolder` — **a full Electron deploy was not run end-to-end.** Opened and closed **V37** (a module's own prose disables a text-scanning tool) |
| VIB-011 | The Stock Library | 🟡 | VIB-003 | **PASSABLE — RICHARD RULED IT** 2026-08-31: *"It's looking better and better, good job"* (§14). ⚠️ Recorded PASSABLE, not WORTHY — same register as VIB-002's and VIB-003's rulings, and *better* is a direction, not a verdict. **Three questions put to him went unanswered and stay open** (the generic-hero photo, the six faces, the 3.32 MB per project). **44 CC0 photographs, 3.32 MB**, shipped in `STARTER_ASSETS` with `LICENCES.json` beside them; `get_style_vocabulary` gains an `imagery` block; doctrine §5 rewritten; `ui-split-hero` and `ui-testimonial-row` repointed at real pictures and the page re-rendered. 🔴 **The row's own licence table was wrong** — the collection restriction is in the *current* Unsplash Licence, not in the pre-2017 **CC0** grant, and `Category:Images from Unsplash` (31,004 files) is what fixed `people`. Closed V30, V33, V34; opened **V35** (the tool surface has 1 token left). 🔴 **WORTHY gap: the library ships and the page barely uses it** — one band of six carries a photograph and the headline is still on bare white → **VIB-006** |

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

### VIB-004 — The Marketing Kit (V6, V12) — 🟡 PASSABLE, 2026-08-31
Delivered: seven compositions (`ctaBand`, `footerBand`, `statTile`, `testimonialCard`, `badge`,
`featureItem`, `actionRow`), two new recipes (`ui-cta-band`, `ui-testimonial-row`), and a six-band
landing page rendered at all four viewports in the door state.
🔴 **The finding that shaped it: five of V6's seven arrangements already had a gated recipe.** The
gap was never expressiveness — it was that `get_style_vocabulary` named none of them, so an agent
had no evidence a stat tile was a thing this system has an opinion about. Fourth time in this phase
that "can the kit do X" answered "yes, and nothing taught it".
🔴 **V12's row was wrong**: the rule skips any subtree under three nodes, and a component instance is
one node — so the factored form the warning *recommends* is invisible to it. Six specs existed and
none covered that; three do now, one a control.
⚠️ The WORTHY gap is one sentence: **every picture on the page is the same dark generated abstract**,
which decorates without communicating. That is **VIB-011**, and this page is the argument for it.

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
