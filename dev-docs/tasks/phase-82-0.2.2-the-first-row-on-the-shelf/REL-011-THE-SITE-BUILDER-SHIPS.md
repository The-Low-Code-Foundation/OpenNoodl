# REL-011 — The site builder ships in 0.2.2

**Opened 2026-09-03 (s14), by Richard's ruling**, reversing the hold he set on 2026-08-31.

| | |
|---|---|
| **2026-08-31** | *"I want to publish the association page template but not the site builder yet."* → [README §3](README.md), the hold list, owners named |
| **2026-09-03** | **Hold lifted. The site builder ships in 0.2.2.** Asked as *"can we scope one or more tasks to bring it all to passable at least for 0.2.2"*, and confirmed against the hold when it was put to him |

🔴 **README §3 and §4 still describe the hold as live.** They were not edited with this file because
`README.md` carried an unrelated uncommitted edit from a peer session (2026-09-01, the RIDE-vs-GATE
paragraph) and a pathspec commit would have swept it. **Whoever lands that paragraph must also strike
the site-builder rows from §3 and add REL-011 to §4's close condition.** Until then, this file and
[`TASKS.md`](TASKS.md) are the record, and the phase's own instruction — *re-derive the board from the
task files* — is what makes that safe.

---

## §1 The bar, and the fact that it is a relaxation

🔴 **Richard ruled the bar is literally the `PASSABLE` grade.** That is a deliberate departure from
the rubric and this file will not pretend otherwise:

> [`phase-81/README.md`](../phase-81-the-look-is-the-product/README.md) §83: *"Only WORTHY closes a
> task. **PASSABLE is recorded progress, never a close.**"*

And "passable" is the exact word he used for the look he **rejected** on 2026-08-31, which is why
[REL-010](REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md) exists at all:

> *"all the other ones … were the ones I said looked like oldschool Wordpress templates, **passable
> but nowhere near this**."*

**Both facts were put to him before this file was written, and he chose PASSABLE anyway.** So:

✅ **For REL-011 only, `PASSABLE` closes.** The members' area keeps the WORTHY bar — REL-002c and
REL-010 are untouched by this, and a session must not read this relaxation across to them.

### What PASSABLE means here, in his own words

The definition is his ruling on the VIB-001 baseline, 2026-08-31:

> *"passable in terms of **you can at least see the elements clearly and interact**, but they still
> look like original Wordpress default templates"*

🔴 **So the bar is LEGIBLE AND OPERABLE, and looking like a default template does not fail it.**
That is what makes this scope small and knowable, and it is what decides which of the six recorded
look findings are in scope and which are not (§3).

⚠️ **The trap in accepting that bar**: `phase-81/README.md` warns that legible-and-operable is *"the
floor, not a grade"*, and that the first baseline awarded two PASSABLEs on exactly that mistake. The
answer here is not to argue with the ruling but to make the floor **measured** rather than asserted —
every AC below names a rendered arm, not an opinion.

---

## §2 What is measured, at HEAD, before any work

### 🔴 The template ships 53 interactive controls and styles 3 of them

Counted on the **artefact a person receives**, `site-builder.content.json`, not on the component
sources:

| control | in the template | carrying any `var(--…)` parameter |
|---|---|---|
| `textinput` | **25** | **0** |
| `button` | 26 | 3 |
| `checkbox` | 1 | 0 |
| `options` | 1 | 0 |
| **total** | **53** | **3** |

**Every text input in the product is unstyled** — public contact form and all eleven admin screens
alike. Rendered, that is a label with nothing beneath it: no box, no border, no rule.
`kind-contact-desktop-viewport.png` in
[`verdicts/sbr-005/2026-09-03/`](../phase-81-the-look-is-the-product/verdicts/sbr-005/2026-09-03/)
is the picture — *"Your name / Your email / Your message"* over blank ground.

🔴 **Under the bar Richard has set, this single row is the whole difference between SHITTY and
PASSABLE**, because *"see the elements clearly and interact"* is precisely what an invisible field
fails. It is also the cheapest thing on this board: the graphs are generated from
`sb005Components.ts` and `sb006Components.ts`, and the fix is parameters on nodes that already exist.

⚠️ **What is NOT measured**: whether the admin screens' inputs are invisible *in the same way*. The
public contact form was photographed; the admin panel was not, this session. The node census says
they share the defect; a picture must confirm it before the fix is called complete.

### The three SHITTY verdicts this row has to move

From [`VIB-001-BASELINE-VERDICTS.md`](../phase-81-the-look-is-the-product/VIB-001-BASELINE-VERDICTS.md),
ruled by Richard 2026-08-31:

1. `/` — the public site, **before anything is written** (the door)
2. `/admin/pages` — the panel, signed in as the owner
3. `/` — the published home page, every section kind, with imagery

### 🔴 Those verdicts were photographed on a page that could not scroll

Established 2026-09-03 and fixed —
[run record](../phase-81-the-look-is-the-product/verdicts/sbr-005/2026-09-03/RUN-RECORD.md). The
Judge's harness never applied the template's own `bodyScroll`, so a full-page capture stretched a
`position: fixed` root and opened a 1,100–1,400px void where three of five sections should be.

✅ **This does not overturn a verdict** — nobody has re-ruled anything. It means **the pictures behind
those three rows show D40 as well as the design**, and REL-011c must re-photograph rather than scope
from them.

---

## §3 The six recorded look findings, sorted by the bar Richard set

Measured 2026-09-03 on the corrected shots. 🔴 **Only the first two are in REL-011's scope.** The
rest are real, are recorded, and are explicitly **out** — they are "looks like a default template",
which the chosen bar tolerates.

| # | finding | in scope? | why |
|---|---|---|---|
| 1 | **The contact form's inputs are invisible** — and by census, all 25 inputs | ✅ **REL-011a** | Fails *"see the elements clearly and interact"* outright |
| 2 | **Two button idioms** — the CTA is a white pill, `Send` is a square-cornered black rectangle, and black is not in the palette | ✅ **REL-011a** | Same root cause, same edit; excluding it would be more work than including it |
| 3 | The nav wraps to two lines **even at 1900px** — seven short items, capped to the content column | 🟡 **REL-011c, judged not fixed** | Legible and operable, so it does not block the bar. But it reads as broken rather than plain, so Richard sees it before he rules |
| 4 | The column never widens past ~700px; nothing is full-bleed | ❌ out | This *is* the default-template look. VIB-013's altitude argument owns it |
| 5 | `--primary` blue fights the warm palette | ❌ out | Taste, above the floor |
| 6 | Uniform vertical rhythm — hero and passage carry the same weight | ❌ out | Taste, above the floor |

⚠️ **Not a finding, and nearly reported as one**: the gallery's flat gradient tiles are the *harness's*
synthetic pictures (`swatch()` at `sbr005-sections.look.ts:88` builds a data-URI SVG gradient so each
picture can be ACL-asserted). **A fixture choice, not the template failing to use `starter-imagery`.**

---

## REL-011a — The fifty-three controls, and the three that were styled

**Owner: this row. Depends on: nothing.** The cheapest row on the board and the one that moves the
verdict.

Give every control in the template the tokens its neighbours already use. The `h2` directly above the
contact fields sets four `var(--…)` values; the fields below it set none. There is no design decision
to take here that the template has not already taken elsewhere — `newButton` is the one styled button
and is the pattern to follow.

**ACs**

1. **The census reads 53 of 53.** A spec counts `net.noodl.controls.*` nodes in
   `site-builder.content.json` and asserts every one carries the style parameters its type needs.
   🔴 **The spec must be written so it FAILS at HEAD** — 3 of 53 — and the failure recorded before
   the fix, or it is a gate with a hole shaped like the defect.
2. **A person can see where to type.** A rendered arm at 1280 on the public contact form: each of the
   three fields has a resolved border or background distinct from the page ground. 🔴 **With the
   before-arm beside it**, from `verdicts/sbr-005/2026-09-03/kind-contact-desktop-viewport.png`,
   which is the same page with the same harness.
3. **The admin panel too, and it is photographed rather than inferred.** The same reading on **two**
   admin screens — `/admin/pages` and `/admin/theme` — because §2 records that their inputs were
   never photographed and the census is not a picture.
4. **`Send` stops being a black rectangle**: it carries the same treatment as the CTA button, in
   tokens, and a render shows both on one page.
5. **The template regenerates byte-identically to its source.** `npm run template:site-builder`, and
   `sb007Template.test.ts` green — the artefact is generated and byte-gated, so a hand edit to the
   JSON reddens rather than ships.

**Close**: the census spec is green having been red, and AC2/AC3's pictures exist.

⚠️ **Neighbourhood owed**: `sb005AdminPanel.test.ts`, `sb006PublicSite.test.ts`,
`sbr009ThemeEditor.test.ts`, `sbr010Messages.test.ts` and `sb007Template.test.ts` all read these
graphs. A parameter added to a node is exactly the shape that silently moves a count in one of them.

---

## REL-011b — Operable on the artefact a person publishes

**Owner: this row. Depends on: REL-011a** (only so the pictures are taken once).

*"…and interact"* is half the bar, and three known defects sit on that half. Each is either fixed with
a control arm, or measured and ruled out of 0.2.2 by Richard — **but not left undescribed**.

**ACs**

1. 🔴 **[D54](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md#d54) — the theme
   presets are dead on the deploy.** `Studio` / `Press` / `Night` each clicked: **0 of 7 fields
   changed, 0 requests**, on enabled buttons with `onclick`, while `Save theme` on the same screen
   fires its `PUT`. It works in the editor's preview and is inert in the deployed bundle.
   **The screen's own first block promises *"Picking one fills every field below"*.** Undiagnosed;
   `droppedByHealthFilter` was 0 and the `--sabotage` control proved that filter alive, so the export
   filter is excluded and nothing else is.
2. **The page keeps its buttons when its backend goes away.** SBR-005's AC3 failure arm reports
   `no button labelled "Send". Buttons on the page: []` — **zero buttons anywhere** after
   `service.stop()`. Measured 2026-09-03 in **both** arms of the `bodyScroll` control pair, so it is
   pre-existing at HEAD and not an artefact of that change. ⚠️ **Undiagnosed**: whether the published
   page unmounts its sections when the backend is lost, or the harness raced the teardown. **Settle
   which before fixing anything.**
3. **The admin screens are photographed at last, now the void is gone.** Every `/admin/*` route at
   1280, on the fixed artefact. 🔴 This is a **discovery** AC: D40 hid whatever is below the first
   screen on eleven admin pages for the whole life of this template, and REL-011c cannot be scoped
   from pictures that do not exist. Anything found is registered with an owner — it does not
   automatically join this row.

**Close**: AC1 and AC2 each end in a fix with a before/after arm **or** a written measurement and
Richard's ruling that it rides; AC3's pictures exist and anything in them is registered.

---

## REL-011c — The three surfaces reach PASSABLE, ruled by Richard

**Owner: Richard's look. Depends on: REL-011a, REL-011b.**

**ACs**

1. The three SHITTY states are **re-photographed on the fixed artefact** at all four widths
   (390 / 988 / 1280 / 1900), through `sbr005-sections.look.ts` and `vib001-site.look.ts`, with the
   artefact md5 and HEAD sha in the manifest.
2. Finding 3 of §3 — the nav wrapping at 1900px — is **in the shot list and named in the hand-off**,
   so his look is not asked to notice it unaided.
3. 🔴 **Richard rules.** A session cannot close this row. `PASSABLE` closes it here, per §1, and a
   session may not award it — the same rule that governs REL-002c.

**Close**: his ruling, recorded with the date and the shots it was given on.

---

## §4 One question this file does NOT decide

⚠️ **Does the site builder also get a row on the template shelf?** [REL-001](TASKS.md) publishes the
members' area as a curated template. Lifting the hold makes the site builder's *look* gate 0.2.2; it
does not by itself say the template is **published** to the shelf, which is a separate,
database-credential act that only Richard performs.

**Nothing in REL-011 assumes either answer**, and the hold list's own note applies unchanged: the
template *"is not in `templates/` and has never been staged for publication, so holding it is the
default state — no action, and no accidental publish."* If it is to be published, that is a second
REL-001 and it needs its own row.
