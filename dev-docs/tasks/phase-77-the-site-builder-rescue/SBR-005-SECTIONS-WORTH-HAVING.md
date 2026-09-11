# SBR-005 — Sections worth having

**Fixes finding 5.** Five section kinds in the model, one rendering in the graph: today
`Site/SectionView` is 1 Image + 1 Text and a script whose outputs are `showImage`, `showBody`,
`weight`, `size`. A gallery is one image; a CTA is bold text with nothing to click.

## 1. The person sentence

**A gallery looks like a gallery, a hero looks like a poster, and the call-to-action button
goes somewhere when clicked.**

## 2. Scope

- **hero** — image with an overlaid heading and sub-heading (overlay gradient for contrast).
- **gallery** — more than one image in a grid. ⚠️ Today a section stores a single image ref;
  the data model needs a multi-image shape for galleries (ordered refs), the section editor
  (SBR-007) needs to author it, and the ACL treatment must match the existing image path.
- **cta** — heading, body, and a real link/button with a target field (external URL or a page
  slug). A slug target navigates in-site; an anonymous visitor clicking it lands on the page.
- **richText** — the current behaviour, kept, restyled under tokens.
- **contact** — labelled fields in a card, and a **success state**: "Message sent — thanks."
  driven by the stored path's `{"received": true}` (fixed s19; the failure path answers the
  same shape with `false` — surface it as an error line, not silence).
- Section kind dispatch: five kinds, five visibly different renderings — however dispatched
  (conditional mounts per kind beats one node morphing).

## 3. Acceptance criteria

1. **(person)** A page carrying all five kinds reads as five different things — driven in the
   viewer, one screenshot per kind, and a DOM-level assertion each (e.g. gallery has ≥2 images
   in a grid; hero heading overlays its image).
2. **(person)** Clicking the CTA navigates (consequence: the destination page's content is on
   screen), anonymous.
3. **(person)** Submitting the contact form shows the success sentence; a failed submit shows
   the failure line — negative control: the success sentence is NOT shown on failure.
4. Conditional section UI goes through `mounted`, not `visible` (the conditional-UI rule), and
   hidden kinds are absent from the DOM, not stacked invisibly.
5. Data-model change (gallery refs) covered end to end: authored in the panel, stored, rendered,
   ACL-checked (anonymous reads only published pages' images).

## 4. Traps

- 🔴 A signal into a value port writes `true` THEN `false` in one drain — the s19 contact-flag
  lesson; keep state flags rising on `done` signals inside the owning chain.
- 🔴 `setDynamicPorts` replaces; a parameter is not a connection (export drops wires, copies
  parameters) — anything the deployed site needs must survive the export's health filter.
- 🔴 Regenerate the artefact; label-based wire assertions; standing values on all Text nodes.

---

## 5. What s36 built, and what it measured

**Status at handoff: the graph half is BUILT and green; the drive is RUNNING and its verdicts are
recorded below as they land.** Read §5.4 before believing any AC is met.

### 5.1 The shape, and why it is five components rather than five branches

`Site/SectionView` was **one `Image` + one `Text`** and a script whose whole vocabulary was
`showImage` / `showBody` / `weight` / `size` / `family`. Phase 81 photographed exactly that and filed
it as its register row **V16** — *the four section kinds are ONE layout; dispatch changes only
fontWeight, fontSize, fontFamily and image visibility; `cta` emits no button* — owner **VIB-009**,
which has never been written. **This task is that row's fix, from the other side.** Cross-linked, not
duplicated: P81 keeps the row, P77 owns the template.

`Site/SectionView` is now a **switch and five wrappers** that draws nothing itself:

| kind | the object on the page | the node that makes it one |
|---|---|---|
| `hero` | a photograph under a scrim with display type on it | `backgroundImage` + `backgroundGradient` on one `Group`, gradient first |
| `gallery` | a wrapping grid of crops, two per row | a `For Each` over `data.images` → `/Site/GalleryTile` |
| `cta` | a `--gradient-brand` band ending in a button that navigates | a `RouterNavigate` at the catch-all with `pm-slug` |
| `richText` | body copy with a heading | authored type ramp — a kind that no longer impersonates a hero has no ramp to compute |
| `contact` | an intro and the form card, with its two answers | `/Site/ContactForm`, fed the slug from `SITE_CURRENT_SLUG_VAR` |

🔴 **`mounted` cannot go on a component instance** — an instance has only the ports its
`Component Inputs` declares (`instance-unknown-parameter`, blocking) — so each kind sits inside a
one-child `Group` that carries the switch. That is AC4's mechanism and it is why there are five
wrappers.

### 5.2 The data model (AC5's first half)

`Section.data` gains four optional fields, all read defensively so a record written before SBR-005
still renders as the `richText` it has always been:

`heading` · `images: [{ url }]` · `linkLabel` · `linkTarget`

🔴 **The gallery's pictures live on the same record, in the same `data` column, under the same row
ACL as the single `image`** — not in a `SectionImage` class. AC5 asks that the ACL treatment *match
the existing image path*, and the way to guarantee that is to put the new pictures **where the old
one already is**. A second class is a second policy to keep in step and a fourth entry in SB-004 §4
that only a gallery ever reads.

**The panel authors all four** (`Admin/SectionRow`): a `Heading` field, two `cta`-only link fields
mounted on the kind, a picture count and a "Remove last picture" button mounted on the gallery. The
upload path is **unchanged** — the same picker, the same `Upload File`, the same record — which is
what makes "matches the existing image path" a fact about the graph rather than a claim.

### 5.3 The six defects, four of them found by looking

| row | what | how it was found |
|---|---|---|
| [D36](DEFECTS-THE-SITE-BUILDER-FOUND.md#d36) 🟢 | three new `merge` inputs shipped without their D31 keys — the 115,755-writes cycle, three new ways in | `sb007Template.test.ts`'s write-back arm, on the first regeneration |
| [D37](DEFECTS-THE-SITE-BUILDER-FOUND.md#d37) 🟢 | **every** contact section drew the form twice | the browser: 7 `<section>` on a five-section page |
| [D39](DEFECTS-THE-SITE-BUILDER-FOUND.md#d39) 🟢 | the contact form showed **both** its answers before anybody pressed Send — pre-existing, every gate green | the drive's reset control |
| [D38](DEFECTS-THE-SITE-BUILDER-FOUND.md#d38) 🔴 | the hero's scrim is a fixed black wash and its text colour is a theme field an owner can set dark | read from the token, **not yet measured** |
| [D40](DEFECTS-THE-SITE-BUILDER-FOUND.md#d40) 🔴 | a published page does not scroll — everything below the first screen is unclickable. Pre-existing | `clickButton` refused; the probe said `outside-viewport`, empty chain |
| [D41](DEFECTS-THE-SITE-BUILDER-FOUND.md#d41) 🟢 | the contact form **sent itself** when the last field stopped being empty, and again on every keystroke. Pre-existing | three fields filled, nothing clicked, `sent: true` |

🔴 **D37's first register row was WRONG about its own premise, and it is the lesson of the session.**
It was filed as *"two switches, an author who turns on both gets two forms"* — a hazard with a
workaround, owner SBR-007. There is no second switch: `/Pages/Site`'s form was mounted from
`rows.some(r => r.kind === 'contact')`, **the identical predicate** the section dispatches on. Every
contact section drew two forms, always. The row was written from the graph; the answer was in the
browser.

⚠️ **And `sb006PublicSite.test.ts` had been reporting it since the first green run** — its
cross-component walk listed `Site/ContactForm`'s four nodes twice, and this session updated the
expected list and wrote a paragraph explaining why that was fine. **An expected-value update is a
claim. A session updating a census it did not cause is the moment to ask what changed.**

### 5.4 Gates, and the bound on every claim here

- `@noodl/mcp` full suite — see the handoff for the run of record.
- `sb006PublicSite.test.ts` 57/57; `sb005AdminPanel.test.ts` 34/34; `sb007Template.test.ts` 62/62
  (byte-identity against the regenerated `site-builder.content.json`, 24 → **30** components);
  `sbr012RawColourGate.test.ts` green — no raw colour, no unresolved token, no unexempted dimension.
- `typecheck:mcp` exit 0.
- ⚠️ **`sbr005-sections.look.ts` is a harness, not a gate** — outside `testMatch`, so it cannot redden
  CI, and it must be run deliberately.
- 🔴 **AC1's verdict is a PICTURE, and a picture has not been ruled.** Phase 81's whole premise is
  that a template can be structurally perfect and still read as a WordPress starter. The DOM
  assertions below say the five kinds are five different *objects*; **whether they are five things
  worth looking at is Richard's, and nobody has looked.**

### 5.5 AC verdicts

`packages/nodegx-backend/tests/sbr005-sections.look.ts` — three arms, real Chrome, **anonymous**
throughout except for the owner writing the records over HTTP.

| AC | verdict | what the browser said |
|---|---|---|
| **1** structural | 🟢 **MET** | see the table below |
| **1** the look | 🔴 **UNRULED** | pictures taken; nobody has looked |
| **2** the CTA navigates | 🟢 **MET** | the destination's own sentence on screen, `location.pathname` `/about`, and the CTA gone |
| **3** contact answers | 🟢 **MET**, after fixing two pre-existing defects | see below |
| **4** `mounted`, absent from the DOM | 🟢 **MET** | absence beside a known-firing positive control |
| **5** gallery model end to end | 🟢 **MET** | draft arm silent, published arm loud, both fields |

**AC1, measured on one page carrying all five kinds:**

- **6 `<section>` elements** — five dispatch roots plus the contact form's own. It read **7** before
  [D37](DEFECTS-THE-SITE-BUILDER-FOUND.md#d37) was fixed, and that number is what found it.
- **hero**: exactly **1** element painting a gradient over a `url(`, composed `gradient-over-url`,
  with its `h2`'s box **contained by** the ground's box — the heading is on the picture.
- **gallery**: **3** images, and `[...images].sort()` equals the three seeded URLs — so each tile
  carries its **own** picture. **2 rows, widest row 2** — a grid, not a stack. 🔴 The identity check
  is the point: three tiles all showing the hero's photograph is V22's defect and a count of tiles
  cannot see it.
- **cta**: **1** gradient band with no picture, holding a `<button>` labelled from the record.
- **richText**: its heading and its body on the page ground.
- **contact**: `Your name` / `Your email` / `Your message` labels, and a `Send`.

**AC4** is asserted *beside a known-firing signal*, never alone: the same probe reads **1** hero on
`/hero-only` and **0** on `/text-only`; **3** gallery images on `/gallery-only` and **0** on
`/text-only`; and `/text-only`'s `outerHTML` contains **neither** the hero picture's marker **nor**
the CTA's label — absent from the document, not merely invisible. The one-kind page still drew **1**
section, so "absent" is not "the page failed to render".

**AC5** is a control pair on one site. The draft page carries a `data.images` gallery **and** a
`data.image` hero pointing at the same never-published picture: anonymously, **0** images, **0**
heroes, neither heading in the text, and the picture's marker nowhere in the document — while the
**same probe on the same site** reads **3** images on the published gallery. Both fields fail the
same way, which is what *"the ACL treatment must match the existing image path"* means.

🔴 **AC3 cost two pre-existing defects, and neither is SBR-005's** — both are in
`Site/ContactForm`, a component this task did not open. Both were fixed here rather than filed,
because the standing rule makes a defect the job **when it blocks an acceptance criterion**, and
these blocked this one:

- [D39](DEFECTS-THE-SITE-BUILDER-FOUND.md#d39) — the form showed **both** answers on load, to every
  visitor, before typing. Two `Condition` gates with no `runOnChange-condition` key.
- [D41](DEFECTS-THE-SITE-BUILDER-FOUND.md#d41) — the form **sent itself** the instant the third field
  stopped being empty, and again on every keystroke after. Measured: three fields filled, nothing
  clicked, `sent: true`.

**The arm as it now reads.** Fresh load → neither sentence (the reset control). Fill, press Send →
the success sentence, and **not** the refusal. Fresh load again → neither sentence, filled, and
`answered before the press — sent: false, refused: false` (D41's probe, kept as a standing
assertion). Stop the backend, press Send → the refusal, and **not** the success sentence.

🔴 Each arm carries the negative control for the other, because a form that showed both answers
satisfies *"shows the success sentence"* and is useless — which is exactly what D39 made it do.

⚠️ **Bound on all of the above**: `withRenderedPage` at a **stated 1280×900**, and AC2/AC3 resize to
1280×2400 before clicking because of [D40](DEFECTS-THE-SITE-BUILDER-FOUND.md#d40) — **nothing on a
published page scrolls**. These arms are not a test that it does.
