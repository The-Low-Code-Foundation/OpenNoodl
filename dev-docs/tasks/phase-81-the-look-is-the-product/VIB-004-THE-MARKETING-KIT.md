# VIB-004 — The Marketing Kit

**Register rows: V6 (zero marketing compositions), V12 (repeated-sibling-subtree), V27 remainder
(the no-gap containers), V29 (the ruled measure).**
Opened and worked 2026-08-31, session 4. Closes per README §3 — screenshot → look → verdict.

---

## §1 What the door said before anything was written

🔴 **V6's premise was materially wrong, and the correction is the shape of the whole task.**
The row reads *"zero marketing compositions of 26"*, which is true of `STYLE_COMPOSITIONS` and was
read by this session's plan as "the kit cannot express a marketing page." Measured at the door
first, over `docs/node-catalog/examples/`:

| arrangement V6 asked for | recipe already shipped? |
|---|---|
| hero | ✅ `ui-split-hero`, `ui-gradient-hero`, `ui-image-scrim-band` |
| featureItem | ✅ `ui-icon-feature-strip` |
| statTile | ✅ `ui-stat-tile-row` |
| footer | ✅ `ui-footer-columns` |
| ctaBand | ❌ nothing |
| testimonial | ❌ nothing |
| badge / pill | ❌ nothing |

**Five of seven already existed as gated, validated recipes.** What did not exist was any of them as
a **named parameter set** — so an agent reading `get_style_vocabulary` saw `card`, `shell`,
`sectionHead` and `field`, and had no evidence that a stat tile or a feature item was a thing this
system has an opinion about. The recipes were reachable only by already knowing to ask for them by
name.

That is register **V8's** shape one level up, and it is the fourth time in this phase that the
answer to *"can the kit do X?"* has been *"yes, and nothing ever taught it"* — after `opacity` /
`zIndex` / `boxShadow*` (V5), the `--display-*` clamps (V13), and the icon value (V20).
**Ask the door before assuming a wall.**

## §2 What was built

**Two recipes**, because two of seven had nothing to source a composition from:

- **`ui-cta-band`** — a closing CTA on `--gradient-brand`: a glass pill badge, display type, a lead,
  a wrapping action row. Its measure is on the **shell**, not the text (§4).
- **`ui-testimonial-row`** — three quote cards from **one component over a `Static Data` array and a
  `For Each`**, deliberately: three testimonials are the most tempting place in a landing page to
  paste a subtree three times. Each card is a card surface plus a composed shadow, a quote glyph in
  `--border` so it reads as ornament, and a ruled author row with a portrait, name and role.

**Seven compositions**, every property lifted from a gated recipe and checked against a real port by
`styleVocabularyPorts.test.ts`:

| id | group | node | from | what it carries |
|---|---|---|---|---|
| `ctaBand` | spine | Group | `ui-cta-band` | gradient ground + the **centred** measure rule (V29) |
| `footerBand` | spine | Group | `ui-footer-columns` | muted ground, hairline, asymmetric padding |
| `statTile` | surface | Group | `ui-stat-tile-row` | the tile whose only large thing is the number |
| `testimonialCard` | surface | Group | `ui-testimonial-row` | **depth** — the card that sits above its band |
| `badge` | surface | Group | `ui-cta-band` | the pill, and a `columnGap` (V27) |
| `featureItem` | arrangement | Group | `ui-icon-feature-strip` | glyph beside words, **with a gap** (V27) |
| `actionRow` | arrangement | Group | `ui-cta-band` | the button pair, wrapping (V27) |

## §3 The page, and the verdict

Built by `demo/build-vib004-marketing.js` from the shipped recipes with **`DEMO_OVERRIDES` empty** —
every parameter in the photograph is one an authoring model is handed. Six bands, six recipes, six
grounds. Rendered through the Judge at all four viewports, `state: 'door'`, nobody signed in.
PNGs + manifest: `verdicts/vib-004/2026-08-31/marketing-door/`.

### 🟡 VERDICT: **PASSABLE**

Written after reading `marketing-desktop-full.png`, `marketing-wide-viewport.png` and
`marketing-preview-viewport.png` as images.

**What is there** — six grounds on one page (white hero, `--surface` feature strip, `bandSurface`
stats, `--gradient-surface` testimonials, `--gradient-brand` CTA, `--muted` footer), which is twice
the rubric's "at least three visually distinct section treatments". Display type at the top with
tight leading on a designed graphic, not a bare heading on white. Real depth in the testimonial
cards and the glass badge. Nine glyphs and five pictures doing work. Copy in a voice. It scrolls,
`unreachablePx` is 0 at every width, and the measure is equal left and right at 1900 — **374/374**,
which is V29 satisfied. It is not the same species of page as the SHITTY baseline.

**Why it is not WORTHY — the seams, named:**

1. 🔴 **Every picture on the page is the same dark abstract, and three of them are the identical
   portrait.** The imagery tell does not fire — there *is* imagery — but "icons and images doing
   actual communicative work" is only half true: the hero graphic decorates, it does not say
   anything about the product. A generated abstract cannot. Seam: **CORPUS**, owner **VIB-011** —
   this is exactly what V30 was opened for, and it is now the top item on the page's own critique.
2. ⚠️ **The stat tiles are the weakest objects on the page** — flat white, hairline border, no depth
   and no accent, so the band reads as a form beside the testimonial band's cards. Seam:
   **VOCABULARY**, and its cause is **V31** below: only `testimonialCard` has depth, and only
   because its shadow is composed from three separate ports by hand.
3. ⚠️ The feature strip's three items are ragged — the third wraps to two lines while the others do
   not. Content, not kit.

**This is the second phase-81 page above SHITTY and the first with more than three grounds.**
Richard's look supersedes.

## §4 V29, built in rather than written down

Ruled 2026-08-31: *"white space to the left and right **equally** … not just on one side, that's
weird … the structural page divs have a max width and are centred."*

The mechanism that produces the defect is precise and worth keeping: **a `maxWidth` on the text**.
`ui-image-scrim-band`'s heading carries `maxWidth: 760px` inside a centred 1200 shell, so at 1900 it
measures **374 left and 766 right** — the shell is centred and the painted content is not.

So `ctaBand`'s description states the rule as a constraint on where the measure lives: the **shell**
carries `maxWidth: 720` and `alignItems: center`, the type carries `textAlignX: center` and **no
`maxWidth` at all**. Measured on the rendered page: 374/374 at 1900. ⚠️ `ui-image-scrim-band` itself
is **not** repaired — it is VIB-002's recipe and repairing it re-opens VIB-002's verdict; the row
stays open against VIB-008.

## §5 V12, measured instead of argued — and the row was wrong

The row: *"`repeated-sibling-subtree` fires on structure alone at 3 — three DIFFERENT feature cards
trip it; richness costs a component file."*

🔴 **The rule cannot see a component instance at all.** An instance is one node with no children, so
its structural signature has `size: 1`, below `MIN_SUBTREE_NODES`, and it is skipped before any
grouping happens. Three placements of `/Components/FeatureCard` are invisible to it — which matters,
because the rule's own message tells the author to *"make one component and instantiate it N times"*.
A rule that then fired on the result would be teaching a fix it punishes.

Six spec rows existed and **none covered the instance case**. Three now do, including a control that
reddens if the rule stops working entirely
(`tests-unit/phase-54/repeatedSiblingSubtree.test.ts`, 9/9). The true residue is narrower than the
row: the warning fires on hand-duplicated subtrees, which is what it says it does, and every recipe
in this kit factors — so a page built from the kit draws no warning.

## §6 V27 — what moved and what did not

The look file asserts separation on **this page** rather than on the corpus, which is the population
a verdict about this picture is entitled to talk about. Three of the compositions (`badge`,
`featureItem`, `actionRow`) carry the gap in the named set, so it is not re-decided per page.

🔴 **The first version of that check was wrong and accused this task's own recipe.** It asked *"does
the parent set a gap"*, and `ui-testimonial-row`'s shell does not — its separation comes from the
child, because `sectionHead` has carried `paddingBottom: var(--space-10)` since DSG-005. Both are
correct; a check that knows one of them reports a defect on the sanctioned pattern. The five-
distances shape again: **the metric measured *a* property rather than the one the eye reads**, which
is whether there is space between two adjacent boxes.

⚠️ **The 58 no-gap containers in the wider corpus are still not fixed** and this task did not fix
them. Fixing them blind is the proxy this phase refuses; each needs a render. Owner stays open.

## §7 The hero fix, and why only the picture could have found it

`ui-split-hero` pointed its media column at **`ground-ridge.svg`** — a *ground*, which is designed to
be dark and empty so text stays readable on it, used as a *subject* picture in a 560px box. It
rendered as a black rectangle: a hole in the page, at the top, in the most-copied recipe in the
corpus. Repointed at `tile-1.svg`, which has actual graphic content.

Then the hero's right half was still dead below the image, because the media column is top-aligned
and 560px tall beside a taller copy column. Fixed with `justifyContent: center` + an explicit 100%
height on the media group.

🔴 **`contentBottom` was 2840px before that fix and 2840px after it.** The band's height is set by
the copy column either way, so no number in the manifest could have moved — `textChars`,
`unreachablePx`, `canScroll` and the content height were all identical across a change that visibly
rebalances the top of the page. Only the picture said so. That is the third time in this phase the
instrument's numbers have been blind to the thing the task was about (V17, VIB-003's lost band, this).

## §8 Gates run

| gate | reading |
|---|---|
| `npm run catalog:examples` | **66/66 clean**, strict, warnings-as-errors (was 64 — the two new recipes) |
| `npx jest --config packages/noodl-mcp/jest.config.js` | **79 suites / 1043 tests pass**, 93s — owed by any token/composition change (V24) |
| `styleVocabularyPorts.test.ts` | **13/13** — every new property is a real port, every token exists, no raw hex, every `recipe` id names a file |
| `repeatedSiblingSubtree.test.ts` | **9/9** (6 existing + 3 new, one a control) |
| `npm run typecheck:editor` | clean |
| `vib004-marketing.look.ts` | **4/4**, four viewports shot, starter assets installed, `failed: []` |

🔴 **The wire budget was measured before AND after, which is V24's lesson applied.** Baseline on
`main`: prompt **3,201**/3,500, full **11,749**/12,500. After the kit: prompt **3,762**, full
**13,323** — **+561** and **+1,574**, about 80 and 225 tokens per composition. Ceilings raised to
4,000 / 14,000 with the numbers and the reasoning written into the spec.
⚠️ The cost is **structural, not prose**: `full` pretty-prints every parameter and a dimension is a
three-line `{value, unit}` object, so shortening the teaching would pay almost nothing. If it ever
has to come down the lever is the payload's *shape*, not its sentences.

## §9 Acceptance criteria

1. ✅ Compositions for the marketing arrangements exist, sourced from gated recipes — seven, with
   the two missing recipes written and validated.
2. ✅ V12 revisited: measured, the row corrected, three spec rows and a control added.
3. ✅ One page assembled from the kit rendered through the Judge at all four viewports in the door
   state, PNGs kept with a manifest.
4. ✅ Judged **≥PASSABLE** with the WORTHY gap named and each seam filed with an owner.
5. ⬜ **Richard's look.** Provisional until then (README §3.5).

## §10 What this task hands on

- **VIB-011** owns the top item on the page's own critique: real pictures. V30 is no longer a nice-
  to-have — it is the named reason this page is PASSABLE rather than WORTHY.
- **VIB-006** (The Worked Page) can now be assembled from a kit that exists; this demo is most of it.
- **VIB-007** owns **V31** (the shadow tokens nothing can read) and **V22** (whose population is 14,
  not one — §11).
- **VIB-008** still owns `ui-image-scrim-band`'s one-sided measure.

## §11 Two findings for other tasks, measured here

🔴 **V22's population is fourteen examples, not one.** The row named `vis-columns-media-cards` and
was read as the whole finding. Re-derived from the predicate — *a `Component Inputs` node with no
`ports` array that has connections out of it* — across all 66 examples: **14 hits**, every one a
repeater/`For Each` item component (`/Log Row`, `/Task Detail`, `/Note Row` ×2, `/Order Row`,
`/Remote Row`, `/Task Row`, `/Todo Row`, `/Product Row`, `/Task Card`, `/Import Task`,
`/Project Membership`, `/Task Line`, `/Media Frame`). `catalog:examples` runs 66/66 strict over all
of them. ⚠️ Not ruled here: whether a `For Each` feeds item properties into ports that were never
declared is a runtime question this task did not measure, and the answer decides whether these are
14 broken examples or 14 that work by another route. **That measurement is VIB-007's first job on
V22**, and it must be a render, not a reading.

🔴 **V31 (new): the `--shadow-*` tokens are unreachable through the sanctioned door.** Seven shadow
tokens ship (`--shadow-sm` … `--shadow-2xl`, `--shadow-inner`) and every one is a complete CSS
`box-shadow` string. `Group` exposes `boxShadowOffsetX/Y`, `boxShadowBlurRadius`,
`boxShadowSpreadRadius`, `boxShadowColor`, `boxShadowInset` and `boxShadowEnabled` as **separate**
ports, and **no port in the whole catalog takes a whole box-shadow string** (measured across all 176
node types). So the only way to get depth on-system is to compose it from parts and colour it with a
non-shadow token — `testimonialCard` uses `var(--border)`. This is V5's exact shape a third time: a
capability present in the token set and unreachable from the ports. Seam: **VOCABULARY/GATE**, owner
**VIB-007**.

⚠️ And a hole worth naming: **`catalog:examples` does not run `raw-color-literal`.** A
`"boxShadowColor": "rgb(15 23 42 / 0.08)"` written into a new recipe passed 66/66 strict. It was
caught by reading the gate's own header, not by the gate. The header says so deliberately (the F14
blast-radius argument) — but "the gate is green" and "the corpus has no raw colours" are different
claims, and only the first is true.
