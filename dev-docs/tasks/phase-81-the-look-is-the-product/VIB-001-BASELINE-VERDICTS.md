# VIB-001 — the baseline verdicts

**Recorded 2026-08-31 at HEAD `d96a7cb4`.** Every verdict below was written with the PNG open as an
image in the session's context, per README §3.4 and VIB-001 §5.2. Evidence:
`verdicts/vib-001/2026-08-31/<subject>-<state>/`, one `manifest.json` per run naming the page, the
state, the viewport, the artefact md5 and the HEAD sha.

🔴 **The baseline is expected to be SHITTY. Recording that honestly is VIB-001 AC3 succeeding.**
This is the number VIB-008 and VIB-009 are measured against, not a complaint.

✅ **Richard has looked and ruled (§7, 2026-08-31).** The two PASSABLE verdicts are now **SHITTY**.
**Final baseline: 9 SHITTY, 0 PASSABLE, 0 WORTHY.** The rubric was amended where his ruling found
it wrong — that amendment is what AC5's calibration was for.

---

## §1 The members' area (TPL-001) — the door

Served bytes md5 `ac1f0163bd77eef1871ac0b1d27d3197`, identical to
`templates/members-area/nodegx.project.json`. No `metadata.cloudservices`, nothing seeded, nobody
signed in — the state P78's own D9 named and deferred, rendered here for the first time.

### `/` — the landing page · **SHITTY**

The first thing anyone sees is a 13px green all-caps eyebrow reading `MEMBERS' AREA`, a gap, and
two buttons. At 1900×1080 that is 220px of content in a 1080px viewport: **80% of the first screen
is empty white.**

Rubric tells fired (README §2): no imagery and no iconography anywhere · one background colour end
to end · the type ramp reads as *one* size, because **there is no headline at all** · content
island floating in dead viewport space. Four of five disqualifying tells, on the product's front
page.

The gap between the eyebrow and the buttons is where the association name and blurb belong. They
are gated on a query that never answers, and the gate fails open into nothing — **V4**, now with a
picture. Seam: template (V4), compounded by VOCABULARY (V5 — there is no designed ground for the
page to fall back to, so "no data" and "no page" look identical). Owner: **VIB-008**.

### `/members` — the gated area, unauthenticated · **SHITTY**, and a correctness finding

With no backend and no session, the page renders **the full member chrome**: a `Sign out` button,
the five-item nav, `FOR MEMBERS / Announcements`, and a red line reading *"We could not check your
membership just now."*

That is **V3 fail-open, in a photograph** — the chrome rides `done` only, so backend absence is
indistinguishable from membership. As a look: outlined pill buttons and one bordered grey box are
the entire structure, no imagery, and ~600px of dead white below a single error line at 1280.
Seam: template (V3). Owner: **VIB-008**.

### `/setup` — the owner's first run · **SHITTY** (was PASSABLE; Richard's ruling, §7)

Judged as app chrome for designed clarity (README §2's last paragraph), not marketing flash.

For it: legible, a real three-step type ramp (eyebrow / 32px heading / body / field labels), copy in
an actual voice — *"Name your association and create the first moderator account. The setup token
comes from your backend configuration."* — and the form sits on a card rather than loose on white.

Against it: **all six fields say `Type here...`** (**V14**, new — see §4); the card is the only
structure on the page; at 1900 the form occupies a ~710px column and the remaining ~1200px is
white. **And every one of those fields is a full-width bordered input stacked in a single
card with a label above it — the default output of every form library ever written. Nothing on
this page is a decision.**

### `/join` — a stranger asking to join · **SHITTY**

Same form treatment as Setup, and one thing worse: below the form, *"Already have an account? Sign
in instead."* is followed by a **filled primary-green `Sign in` button of the same visual weight as
the form's own `Send my request` submit**. Two primary actions of equal weight on one page, so the
page does not say what it wants you to do. All four fields read `Type here...`.

---

## §2 The members' area — the living state

Claimed as *St Anywhere*, six announcements, four meetings, five join requests (three approved),
moderator signed in through the product's own SignIn form. Seeds asserted before any picture was
taken, so an empty list in a screenshot is the product's and not the harness's.

### `/` — the landing page · **SHITTY**

Now the hero exists: `St Anywhere` at ~48px, a subtitle, two buttons. Below it *"What members can
see"* and three grey bordered cards — Announcements / The diary / The directory — stacked
**full-width, vertically**, in a ~710px column.

Tells fired: no imagery and no iconography (the artefact contains **zero** `Image` or `Icon`
nodes — measured from disk) · one background colour end to end, with bordered grey boxes as the
only structure · the headline is 48px, **exactly the ceiling V13 names** · ~230px of dead white
below the fold at 1280 and ~370px at 1900 · three visually identical boxes where a designed page
puts a 3-up grid with icons and distinct grounds.

This is the honest centre of the phase: nothing here is *broken*. It is a competent page with
nothing to look at, which is precisely *"shitty and boring like a WordPress starter template."*
Seam: VOCABULARY (V5 no ground, V6 no marketing compositions, V13 type ceiling) + CORPUS (V8 —
nothing in the corpus shows what the alternative would be). Owner: **VIB-008**, consuming
VIB-002/004/006.

### `/members` — the announcements list, with rows · **SHITTY** (was PASSABLE; Richard's ruling, §7)

The strongest surface in either template. Ruled rows, title + date + a `Read` action, a real
hierarchy from eyebrow through 32px heading to row titles, and an honest `FOR MODERATORS` band at
the foot. As app chrome this is not embarrassing.

Against it, at 1900 specifically: the nav **wraps to two rows** — `Your account` alone on the
second line — while ~600px of viewport sits empty to the right, because the measure is capped
independently of the width (**V15**, new). Every nav item and every row action is the same
outlined pill, so nothing on the page signals primacy. No iconography anywhere. **Ruled rows and
outline-secondary pills is Bootstrap's list-group with content poured into it; the row's state
(read / unread / new) has no treatment at all.**

⚠️ **At 988×313 — the editor's own default preview — the entire first screen is chrome.** The
eyebrow, the association name, `Sign out`, and a six-item nav that wraps onto a second row consume
~190 of the 313 available pixels; what is left shows `FOR MEMBERS / Announcements` and **not one
announcement**. The list this page exists for begins below the fold. It is reachable by scrolling,
so this is a composition finding rather than a correctness one — but it is the first render of this
template that anybody, including its author, ever sees.

---

## §3 The site builder — the door

Not a byte copy, because this template ships a `ProjectContent` blob rather than a directory: the
graphs come from the same door writes that generate `site-builder.content.json` (byte-gated by
`sb007Template.test.ts`) and the look from `buildSiteDesignTokens()`, written into
`metadata.designTokens` exactly as `EmbeddedTemplateProvider:148` does at install. The token count
is asserted before the first shot, so *"the page looks unstyled"* and *"the harness forgot the
theme"* cannot be confused.

### `/` — the public site, before anything is written · **SHITTY**

**The entire page is the word `Home`.** A blue link, an empty header band drawn as two horizontal
rules with nothing between them, and an off-white ground. Four characters of text. At 1900×1080 the
content box is 1080px tall and holds one word — the page ground is a grower filling the viewport
(**V1**, photographed).

The theme *is* applied — the warm ground and the blue are the installed tokens, which is what makes
this a verdict about the product rather than the harness. This is what a person sees in the second
after they choose "Site Builder" and press preview.

Seam: CORPUS/template — the template ships zero content, and nothing renders a designed
"nothing here yet" state. Owner: **VIB-009** (cross-link V4: the members' area has the identical
shape, and one designed empty-state answer probably serves both).

### `/admin/pages` — the panel, signed in as the owner (living) · **SHITTY**

Judged as app chrome for designed clarity, and it fails on that bar rather than the marketing one.

The information design is fine — a left rail, `Pages`, a `New page` action, a truthful count
(*"Two pages, two published"*), one row per page with slug and status. Against it:

- **The left rail stops 246px down**, leaving a grey rectangle floating against white for the
  remaining ~830px at 1900. A sidebar that does not reach the bottom of the window does not read as
  a sidebar; it reads as a mistake. Same family as V1 — the rail has content height where the page
  spine needed to be full height.
- **Three button treatments on one row**: a blue rounded `Published` pill beside black
  sharp-cornered `Edit` and `More` rectangles, with a fourth black rectangle (`New page`) jammed
  against the `Pages` heading with no gap. Rubric tell: *buttons that look like browser defaults*.
- Content ends at y=284 with the rest of a 1080px viewport empty.

Owner: **VIB-009**. ⚠️ P77 is active in this template's files — cross-link, do not duplicate.

### `/` — the published home page, every section kind, with imagery · **SHITTY**

🔴 **This is the site builder's best case, and it is the sharpest reading in the baseline.** See §6
for why the seed had to be redone before this verdict was worth anything.

The page has real content, a real theme (Georgia display, warm ground, blue accent — all installed
tokens doing their job), and one of every section kind the template supports: `hero` with an image,
`richText`, `gallery`, `cta`. 1594px of content that scrolls properly. Nothing is broken.

It is still a **single narrow centred column of stacked blocks**: image, serif line, paragraph,
image, bold sentence. Tells fired:

- **One background colour end to end.** No section ever changes ground. "At least three visually
  distinct section treatments" scores zero — the hero and the gallery are the same rounded image
  block at the same width, and the only thing separating a hero from a paragraph is font weight.
- **The `cta` renders as a bold sentence with nothing to click.** A call to action with no action.
- **The hero image sits *above* its own headline** as a detached block, so the page's biggest
  gesture is a picture and a caption rather than a hero.
- At 1900 the column is still ~705px — **37% of the width**, the same V15 shape as the members
  area — and `/about` grows to exactly 1080px of box around 955px of content, which is **V1**
  padding a page out to the viewport instead of letting it end.

Seam: **VOCABULARY**, and now with a specific mechanism rather than an absence — see **V16** in §4.
Owner: **VIB-009**, consuming VIB-002/004.

---

## §4 New register rows this baseline produced

| id | finding | seam | owner |
|---|---|---|---|
| V14 | `packages/noodl-viewer-react/src/nodes/controls/text-input.ts:97` defaults `placeholder` to `"Type here..."`. The members-area artefact sets `placeholder` explicitly **once** in the entire template; the site builder's SignIn sets it never. So every field of every shipped form reads *"Type here..."* — a runtime default that manufactures the rubric's own "placeholder-grade copy" tell, and nothing anywhere fires on it | RUNTIME/GATE | VIB-005 |
| V16 | The site builder's four section kinds are **one layout**. `SECTION_VIEW`'s script (`sb006Components.ts`) dispatches on `kind` to change only `fontWeight`, `fontSize`, `fontFamily` and whether the image mounts — no kind changes ground, arrangement or column count, and `cta` emits no button. So a page built from every kind the product has is still one column of stacked text blocks. This is the ceiling **V6 predicts, measured inside the one template that has section vocabulary at all** | VOCABULARY | VIB-009 (cross-link V6) |
| V15 | The content measure is capped independently of the viewport. At 1900 the members chrome's nav wraps to two rows while the page uses ~37% of the width. A max-width that is right at 1280 is not a decision about 1900 | VOCABULARY | VIB-008 (cross-link VIB-002) |

## §5 🔴 A correction to the diagnosis, measured

README §1(b) says *"nothing scrolls unless `scrollEnabled` is set (zero hits in the whole
members-area artefact)"* and attributes *"the unreachable Setup form"* to it.

Half of that reproduces and half does not, and the difference matters because VIB-005's ACs are
written against it:

- ✅ **Confirmed from disk**: `scrollEnabled` appears **0** times in the shipped artefact; 65 of its
  86 `Group` nodes carry no explicit `sizeMode`; `clip: true` appears 35 times; `Image`/`Icon`
  nodes: 0.
- ❌ **Did not reproduce**: `unreachablePx` is **0 on all 44 shots** across both states. Every page
  that overflowed its viewport could be scrolled, including `/setup` at 988×313. Nothing measured
  here was amputated or unreachable.

The reconciliation is that `scrollEnabled` governs *a Group's own* scroll container, not the page's
— and in a served page the **document** scrolls regardless. So V2's mechanism is real and its
consequence as written is too strong for this surface.

🔴 **Name what this instrument cannot see**: it is a headless Chrome serving the project through
`render-from-disk.js`. **The editor's own preview pane is a different container, and this does not
render it.** P78's observation was made there. So this is not a refutation — it is a measurement of
a different surface, and the honest next move is for VIB-005 to state *which* surface its
"unreachable" AC is about before building a diagnostic for it.


## §6 ⚠️ The seed that would have made the site-builder verdict worthless

The first site-builder living run wrote `kind: 'richText'` for **every** section, because that is
what `sb008-public-site-drive.test.ts` seeds — it is a *publication-boundary* drive, and one section
kind is all a publication boundary needs.

Photographed, that produced a page that was a stack of prose, and the verdict very nearly written
from it was *"the public site is a column of paragraphs."* **That would have been a statement about
the seed.** The template dispatches on four kinds; a picture built from the plainest one measures a
ceiling the product does not have.

Re-seeded with `hero` + `richText` + `gallery` + `cta` and real imagery, the verdict is still
SHITTY — but now it is *about the product*, and it produced **V16**, which the first seed could not
have found.

✅ **The rule for every later task in this phase**: before judging a data-driven surface, ask which
of the states the picture shows were chosen by the **harness** rather than the artefact. Reusing a
drive's seed inherits the question that drive was asking, and that question is usually not "what
does this look like at its best?"

⚠️ Stated so it is not assumed: the seeded `data.image` is a renderable `data:` URI, not a real
uploaded `cloudfile` with a backend URL. Same render path, different URL source.


---

## §7 ✅ Richard's ruling — the calibration (2026-08-31)

> I think the two passable ones are passable in terms of you can at least see the elements clearly
> and interact, but they still look like original Wordpress default templates

**Both PASSABLE verdicts become SHITTY. Final baseline: 9 SHITTY, 0 PASSABLE, 0 WORTHY.**

### What the session got wrong, named so it does not recur

README §2's last paragraph said app-chrome pages *"are judged for designed clarity rather than
marketing flash."* The session read **"designed clarity"** as **"legible and operable"**, and both
PASSABLE verdicts were awarded on exactly that: *"legible"*, *"a real hierarchy"*, *"not
embarrassing"*.

🔴 **Legible and operable is the floor, not a grade.** It is true of every WordPress default
template ever shipped — that is the whole point of a default template. A verdict that rewards it is
measuring the precondition for judging rather than the thing being judged. Same shape as
[the recurring correct-vs-usable trap], one level up: the session proxied *"can a person use this"*
for *"does this look designed"* because the first is the one it could check confidently.

### The amended rule (now in README §2)

App chrome is exempt from the **marketing** tells — a settings page needs no hero, no gradient
ground, no 72px display type, and demanding one would be wrong. It is **not** exempt from the
default-template test, which is the same for every surface:

> **Does anything on this page show a decision?** A considered density; a real hierarchy of action
> weight; iconography doing work; a treatment for state. Or is it the framework's defaults with
> this app's content poured into them?

Applied to the two flips, and both fail it in one sentence:

- **`/setup`** — full-width bordered inputs stacked in a card, label above each, `Type here…` in
  every one, one submit. That is what a form library emits before anyone designs anything.
- **`/members`** — ruled rows plus outline-secondary pills is Bootstrap's list-group; six identical
  nav pills carry no weight hierarchy, and row state has no treatment.

### What this changes downstream

🔴 **VIB-005 is no longer sufficient for app chrome.** Fixing the ambush defaults makes these pages
*correct*; Richard's ruling says correct was never the question. Every app-chrome surface in
VIB-008 and VIB-009 now needs design work of its own, drawing on the same widened kit as the
marketing surfaces — which strengthens the case that the **kit** is the seam, since app chrome and
landing pages fail on the same vocabulary.

⚠️ It also removes the phase's only route to a soft close. PASSABLE was never a close condition;
now nothing in the baseline is even near one.
