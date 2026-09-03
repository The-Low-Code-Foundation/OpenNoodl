# REL-002c — what I would change

_Written 2026-09-01, session 9, after Richard ruled the row **FINE** and asked what I would change
rather than leaving me to guess at a fix. Read against the renders at HEAD `60fe7e16`, artefact
`27f127e9` — the same photographs as the
[proof sheet](https://claude.ai/code/artifact/137133e4-aa38-4f02-9251-bbc94124bef7)._

🔴 **These are mine, from looking at the pictures. Richard's own verdict may name none of them** —
if it does, his list wins and this one is a starting position, not a plan.

Ordered by how much they cost against how much they change.

---

## ⛔ SUPERSEDED 2026-09-01, s11 — items 5 and 6 are BACK ON, and 6 is BIGGER than written

🔴 **Richard, the same day, after his usage limit reset:** *"we're going back round and fixing that
fucking template… I want all pages looking as good as the homepage."*

**Items 5 and 6 were declined on COST, not on merit.** That constraint is gone, so they are live
work again. Two corrections to them before anyone starts:

- **Item 6 named `/setup` and called itself optional taste. It is neither.** s11 read every page's
  `nodes.json` and found **three** pages with no identity at all — `/setup`, **`/sign-in`** and
  **`/unsubscribe`** all carry no `backgroundImage` and no band, against `/` and `/join` which do.
  Two of the three are the highest-traffic doors in the template. **Richard has now explicitly asked
  for it**, so the "I would ask first" caveat is answered.
- ⚠️ **`/join` is the only page in the whole template with no footer.** Not noticed until s11.
  Nothing recorded a decision either way; grade it against a render.

✅ **The hero is a `backgroundImage` on a Group** — the template contains **zero** `Image` nodes —
and there are **44 `.webp` files** under `noodl_modules/starter-imagery/` to draw on.

⚠️ **The estimates below were written from the s9 renders and are left as they were.** Item 4 has
already proved they can be wrong in mechanism as well as size.

---

### The superseded ruling

## 🔴 RULED 2026-09-01, s10 — items 1–4 BUILT, items 5 and 6 WILL NOT BE

Richard, with the after-renders in hand: *"It looks fine (not worthy) but just push it as V1 of the
template, we can't waste more time on this."*

**So this file stops being a plan and becomes the V2 brief.** Items 5 and 6 are not deferred
pending anything — they were **declined on cost**, which is a different disposition and worth
recording as one. If a later phase reopens the template's look, the two below are where it starts
and the measurements in them were taken against the shipped artefact.

---

## ✅ Session 10 built items 1–4. What it found while doing it

**Items 1, 2 and 3 were what this file said they were** and cost what it said they would.

🔴 **Item 4's stated fix would have changed no pixel, and its stated mechanism was wrong twice.**
Both corrections are recorded on the constants themselves (`PAGE_SHELL`, `PAGE_GROUND`) and in the
session's handoff; in short:

1. **`minHeight: 100vh` on `PAGE_GROUND` paints nothing.** That Group carries no `backgroundColor`
   in the artefact — checked in `components/Pages/Directory/nodes.json` rather than reasoned about —
   so growing the box leaves `/setup` ending in exactly the same white. A page has a bottom edge
   when something is **at** the bottom. The eleven pages got the footer the landing page has had
   since s7, as `Members/Footer` — a component, so the two `EDIT ME —` lines stay two strings
   rather than becoming twenty-six.
2. **`height: 100%` was never inert.** `layout.ts:98` turns a percentage height inside a column
   parent into `flexGrow`, so `PAGE_GROUND` has always meant `flex-grow: 100`. It did nothing only
   because the chain above ended at a content-sized `Router`. The moment the page got a floor, the
   slack went **into** the ground and was shared among its children — 150px between `/sign-in`'s
   heading and its form, and the form panel stretched by as much again. Photographed, not predicted.
3. 🔴 **Every `Group` in this template without a `sizeMode` is `flex-grow: 100`.**
   `addDimensions` defaults `sizeMode` to `explicit` and `height` to `100%`. That is a fact about
   the runtime, and it is why the fix is a two-band shell (`pageBody` + the footer, `space-between`)
   with `PAGE_GROUND` and the chrome band both pinned to `contentHeight` — rather than a
   `justifyContent` on a three-child shell, which opens a gap **under the header**.

⚠️ **So item 4 cost a component, a shell and two pinned heights, not "one constant".** The estimate
below was made from the renders and is left as it was written.

---

## 1. The door landing is a photograph and then nothing — 🟢 small

**The symptom.** At 1280 the unconnected landing is: photograph, the "not connected yet" notice on
its scrim, then **~230px of bare `--muted` ground**, a hairline, and the footer. At 1900 it is
**~330px**. A stranger who opens an app that has not been connected sees a picture, an apology, and
a void.

🔴 **This is session 8's own lesson repeating one element further down.** S7 added the footer "so
the page has a bottom edge in every state"; s8 found the door state still ended in 270px of bare
ground below it and fixed that with `space-between`. `space-between` did not remove the hole — it
**moved it above the footer**. The page still does not fill.

**The change.** The living landing carries two bands the door state does not: "About us" and **"What
members can see"** (the three tiles). The tiles are **static copy that needs no backend and no
association** — "Announcements / The diary / The directory" is true of every install. Mounting that
band in the door state fills the page *and* answers the question a stranger actually has, which is
*what is this*.

**Cost.** One `mounted` parameter on a band that is already built, plus a render to grade.
🔴 **The two edits are one edit** — a default-closed group without the wire that opens it is a
deletion, which is exactly how the hero was lost in s7.

---

## 2. `/members` ends with four buttons that are all already in the nav — 🟢 small

**The symptom.** Below the announcements list: a `What's coming up` button, then a "FOR MODERATORS"
strip with `Post something`, `Requests to join`, `Who belongs`. The nav pills at the top of the same
page are `Announcements · Meetings · Post · Requests · Who belongs · Your account`. **Every one of
the four duplicates a pill three inches above it.**

**The change.** Keep `Post something` — it is the page's one real call to action and deserves to be
a filled button. Delete the other three. The "FOR MODERATORS" label then means something, because
what is under it is genuinely the moderator's action rather than a second copy of the nav.

**Cost.** Deleting three buttons. The risk is nil and the page gets shorter and clearer.

---

## 3. `/join`'s sign-in offer is made twice — 🟢 trivial

**The symptom.** Under the form: *"Already have an account? Sign in instead."* — which reads as a
link and is not — immediately followed by a separate outline **`Sign in`** button.

**The change.** *"Already have an account?"* and the button. One sentence, one control.

**Cost.** One string.

---

## 4. Eleven pages still have no bottom edge — 🟡 one constant, but it touches every page

**The symptom.** `/setup` ends at ~500px with white beneath; `/directory` is four rows and then
~230px of white. `PAGE_GROUND` carries an inert `height: 100%` — a percentage height resolving
against a `Router` that sizes to its content, so it has never done anything on any page.

**The change.** `minHeight: 100vh`, the one dimension port that takes `vh`. The landing and `/join`
already float on `BAND_PAGE_GROUND` and are unaffected.

**Cost.** One constant — but it changes all eleven, so it needs a render pass across the set to
grade rather than a spot check. This was deliberately left in s8 for exactly that reason.

⚠️ Doing 1 and 4 together is cheaper than doing them apart: they share a render.

---

## 5. `/directory` is a table with no headers and very wide gaps — 🟡 small-to-medium

**The symptom.** At 1200 the three columns land at roughly x=36, x=285 and x=537, so a name and its
email are separated by ~250px of nothing, and `Member · since 1 September 2026` runs on as one
string with no column to tell you what it is. There is no header row, so nothing names the columns.

**The change.** A header row — *Name · Email · Standing* — and tighter column proportions (roughly
40 / 35 / 25 rather than three equal thirds).

**Cost.** Medium only because of the fold: the row already collapses to one column under 700px, and
a header row has to disappear when it does. 🔴 **The census in §2 of the gate counts "a Group
wrapping exactly one Text" as a notice box** — three more such cells is exactly the shape s8 had to
correct the census for. Read the gate before choosing the tree.

---

## 6. `/setup` has no identity at all — 🟠 optional, and I would ask first

**The symptom.** `/` and `/join` both open on a photograph with the page's head on the scrim.
`/setup` — the owner's **first ever screen of the product** — is a bare form on white with a small
eyebrow. It is the least designed page in the template and it is the first one anybody sees.

**The change.** The `/join` band pattern, reused: a band photograph with `Set up this members' area`
on the scrim.

**Cost.** Small in mechanism — the pattern exists and `/join` is built on it. I list it last and
call it optional because it is the only item here that is **taste rather than defect**: a plain
setup form is a defensible choice, and a first-run page carrying a stock photograph before the
association has chosen anything is arguable in both directions. **Richard's call, not mine.**

---

## What I am NOT proposing

- ⚠️ **The `EDIT ME —` footer lines stay.** They look like placeholder copy because they are, but
  they are an instruction to the person installing the template and that is correct for a template.
- ⚠️ **The announcement row's remaining white space stays.** S8 added the excerpt for exactly this
  and recorded that every rearrangement of the row was a 390px regression. It is better than it was;
  it is not worth reopening.
- ⚠️ **`FORM_GROUND` stays at 720 centred** — ruled by Richard, 2026-09-01, this session.

## ✅ SESSION 12 — what was built, and the half a gate refused

**Item 6 is BUILT for all three pages, and `/join`'s missing footer with it.** A `band` option on
`pageShell()`; the band goes inside `pageBody` so `PAGE_SHELL`'s two-child `space-between` survives
and the pages keep the footer. Pictures: `/setup` `work-carpenter`, `/sign-in` `people-desk`,
`/unsubscribe` `ground-shore` — the reasoning for each is on the page in `tpl001Components.ts`.

🔴 **The renders were worse than this file's audit.** `/sign-in` carried **~280px** of dead
white above its footer and `/unsubscribe` **~530px** — the same void item 1 fixed on the landing
page, sitting unphotographed on two of the highest-traffic doors in the template. `/setup`, the page
item 6 actually named, was the *least* broken of the three: its long form fills the page.

🔴 **Item 5 is HALF ALREADY BUILT, and this file did not know.** The stated symptom —
*"columns at x=36, x=285 and x=537… ~250px of nothing"* — was fixed by s10's `Columns` work:
`MEMBER_ROW` now carries `layoutString: '3 3 2'` with a 700px breakpoint, which IS the *"roughly
40/35/25"* this file proposed. **Only the header row remains**, and it has a real cost nobody had
priced: below 700px the `Columns` folds to `smallLayout: '1'`, so a header would stack into three
stray words with no rule in the runtime to hide it. ✅ **Re-measure item 5 against the artefact
before building it** — `MEASURE THE ARTEFACT, not the task file`.

🔴 **A gate refused half of the `/unsubscribe` work, and it was right.** After the band,
~290px of void remained, so the page got a hint and a *Sign in to your account* button — this
row's hazard 3 applied (*a layout complaint here has had a content answer four times*). That is
**ruled against**: Richard's **D39**, 2026-08-29, is that the page names no association and offers no
way back, and `tpl001Template.test.ts` §5 reads that place. The spec's own note predicted the
session exactly: *"a link back is free… the cheap half is the one somebody adds without thinking
about the ruling at all."* Reverted.

⚠️ **So the remaining slack on `/unsubscribe` is a CONSEQUENCE OF A RULING, not an unfixed
defect.** It is the one place where *"as good as the homepage"* and D39 pull against each other, and
**that is Richard's to settle, not a session's.** See the handoff.

## What is still unmeasured

✅ **CLOSED s12 — all four are now in the shot lists.** `/unsubscribe` went into both door runs,
and `/post` plus the two detail pages into the living run, the latter on `objectId`s the seed now
captures instead of discarding. The harness asks for **all thirteen pages**, so *"every page"* is a
claim the instrument can support for the first time.

~~🔴 **Four of the thirteen pages have never been photographed** — `Announcement`, `Meeting`, `Post`,
`Unsubscribe`.~~ The harness asks for nine (`vib001-members.look.ts`, two shot lists), so their
absence is a fact about the request, **not** about how they look. If REL-002c is to mean all
thirteen pages, they need adding to the harness before the row can honestly close.

# §7 SESSION 24 — the phone column, read at last, and what reading it cost

This row's remaining line was *"the PHONE column of that run is UNREAD, `/join` was never
opened."* Both are now discharged: **all thirteen pages re-photographed at HEAD and all thirteen
phone shots looked at**, `/join` included. Run: `vib-001/2026-09-03/members-area-{door,living}`,
`vib001-members.look.ts`, **`EXIT=0`, 2/2, 60 shots**.

## §7.1 🔴 The manifest could not say what the old pictures were OF, in three ways at once

Before reading the column I checked whether the 2026-09-02 shots were still of the shipping
artefact. They were not obviously either way, and **none of the manifest's three provenance fields
could settle it**:

| field | what it recorded | why it could not answer |
|---|---|---|
| `artefactMd5` | `f969ad96…` | md5 of `nodegx.project.json` **only** — 8K of settings and tokens against **648K in 97 `components/**` files**, where every drawn thing lives |
| `headSha` | `6383ee30` | the last *commit*; the tree at render time held an **uncommitted** fix (below), so it matched no commit at all |
| — | — | nothing recorded the components |

Measured through `git archive` of both commits, same script both sides:

```
template at 6383ee30 (when the shots were taken)   at HEAD
  project.json   f969ad96…                          f969ad96…   ← IDENTICAL
  components/    f6c34e1c…                          d92d1972…   ← 19 files differ
```

The nineteen are `0e294dd9`'s alignment fix (`Members/Prompt`) and `9ab6c701`'s 57 settled
parameters from **P80/DEF-038, a closed phase** — including `Members/Chrome`, which is on every
signed-in page. **A field that reads identical across that cannot say what a picture is of, which is
the only job it has.**

✅ **Built.** `md5Tree()` in [`judge.ts`](../../../packages/nodegx-backend/tests/helpers/judge.ts),
path-ordered over every file (the path is hashed with the bytes, so a rename is a change and two
files swapping names do not cancel); a new **`artefactTreeMd5`** in every manifest; the during-run
mutation check extended from 1 file to all 98; and the door test's claim *"the served bytes are the
shipped bytes"* — which asserted **one** file — now asserts `components/` against `TEMPLATE_DIR`.

⚠️ **`artefactMd5` was kept beside it, unchanged.** Callers assert it and that assertion is still
worth making. It was never the wrong file; it was never the whole artefact.

## §7.2 ✅ …and the pictures Richard has were fine, which is now MEASURED rather than assumed

The obvious inference from §7.1 — *"his look is invalidated, he would be ruling on superseded
pictures"* — **is wrong, and the re-run is what says so.** Of 120 PNGs:

- **113 byte-identical** to 2026-09-02;
- **7 moved, and all 7 are one page**, `/directory`;
- the only text change in the whole run is `since 2 September` → `since 3 September`, ×4.

🔴 **`/directory` seeds member join dates from the current date, so its four shots differ from every
other day's run and always will.** Know that before reading a future diff of that page — the same
trap `admin-messages-*` carries on the site-builder side, for the same reason.

🔴 **And the 2026-09-02 shots already contained `0e294dd9`'s fix.** `Members/Prompt` renders on
`/join`, `/setup` and `/sign-in`; all three are byte-identical across the two runs, and HEAD still
carries that commit's version of the node. So the pictures were taken from a working tree holding a
change that was committed seven minutes later — which is exactly why `headSha` could not describe
them. **The nineteen-file drift is visually inert at all four widths.**

⚠️ **The general shape, and it is the reason this row exists**: every numeric in the phone column —
`contentBottom`, `textChars`, `unreachablePx`, error counts — read **identical on all thirteen pages
across a nineteen-file artefact change**. The numbers cannot see the artefact move. Only the bytes
of the pictures could, and only a hash of the right files could say whether they should have.

## §7.3 The phone column, read

**No breakage anywhere.** Thirteen pages, `unreachable=0` on every one, nothing overlapping, nothing
clipped, no overflow, no unreadable type. `/join` opens correctly. The living landing — the page the
whole row benchmarks against — holds up at 390 as well as it does at 1280. What the column shows is
four things that are judgements, not faults, and they are Richard's:

1. 🔴 **44.2% of the first phone screen is chrome, on eight of the thirteen pages.** Measured off
   the PNGs by scanning for the page-head band, uniform to the pixel:

   | | content starts at | of the first screen |
   |---|---|---|
   | phone, 390×844 | **y=373** | **44.2%** |
   | desktop, 1280×900 | y=275 | 30.6% |

   The band is 121px at both widths; the difference is entirely the navigation, which is **one row
   of six pills on desktop and a 2×3 grid on a phone**. On `/requests` the first request card begins
   below the halfway line of the phone.

2. ⚠️ **The "What members can see" block — three cards, three photographs, ~1100px of phone scroll —
   is on 6 of the 13 pages**: five of the six door pages plus the living landing. A stranger going
   `/` → `/join` → `/sign-in` meets the identical block three times. **On `/setup` it is the odd one
   out**: that is the owner's first-run admin task, and below the seven-field form it sells them the
   product they are installing.

3. ⚠️ **`/unsubscribe` carries ~190px of void above its footer**, and the phone makes it starker
   than the desktop shot did. **This is §"SESSION 12"'s ruled consequence, not a new defect** — D39
   says the page names no association and offers no way back. Named here only because it is the one
   place where D39 and *"as good as the homepage"* pull against each other, and Richard is about to
   look at it.

4. ⚠️ **`/` and `/members` unauthenticated are byte-identical** — fail-closed working as REL-002b
   built it. A person who followed a deep link to `/members` is shown the landing page with no
   acknowledgement they were moved.

## §7.4 🔴 The template has no headings and no landmarks — 0 tags in 100 files

Found while reading the column, and it is the one thing here that is not a judgement.

`Text` carries an `as` port (displayName **Tag**, group *Advanced HTML*) with `h1`…`h6`, `nav`,
`header`, `footer`, `section`, `p`, `span`. Same recursive command over both shipped artefacts, the
control firing:

| artefact | files | `as` tags |
|---|---|---|
| `site-builder.content.json` | 1 | **26** — 7 `h1`, 5 `h2`, plus `nav`, `header`, `footer`, `section`, `p`, `span` |
| `templates/members-area/` | 100 | **0** |

Confirmed at render time by the harness's own reading: **0 of 60 members-area shots carry an
`h1` or `h2`**, against **24 of 24** for the site-builder. So the members' area — the row the shelf
opens with — ships as an undifferentiated pile of `<div>`s: no document outline for a screen
reader, and nothing structural on `/`, `/join` or `/sign-in`, which are public.

🔴 **The sibling template shipped in the same release does it properly**, which is what makes this a
defect rather than a limitation of the runtime. The generator builds every page's heading in exactly
one place — `pageHead()` in `tpl001Components.ts` — and sets no tag there. No validator covers it;
`typographyHierarchy.ts` is the nearest precedent and it is about `fontWeight`.

⚠️ **Registered, NOT built** — this phase's rule: *a defect is the next first job only if it blocks
an AC*. It blocks none of REL-002c's, and building it would change the artefact under the pictures
this session just took. **It is named for Richard in the same breath as REL-001 because it is a
property of the thing he is about to publish**, and the fix is one seam, not a sweep.

## §7.5 ✅ The change was controlled on the OTHER caller, and it cost s23's evidence nothing

`md5Tree` now **throws** where nothing threw before, so a harness that writes into its own project
directory mid-run would redden for whoever ran it next. Every importer of `judge.ts` is a `.look.ts`
and therefore outside `testMatch` — **no routine suite can go red** — but that is an argument, not a
reading. So `vib001-site.look.ts`, the heaviest caller (a bound backend, a signed-in admin, 24
shots), was re-run: **`EXIT=0`, 2/2**, both arms recording an `artefactTreeMd5`.

⚠️ **It also reproduced the pictures.** Of the site-builder's shots, everything was byte-identical
except `admin-messages` — **the page s23's handoff already flagged as carrying a real clock.** The
control therefore says two things at once: the tree check does not throw, and the harness renders
identically under it.

🔴 **And it overwrote s23's committed AC3 evidence in place**, because `judge()` keys its output by
`today()` and both harnesses write into `vib-001/2026-09-03/`. **All sixteen files were restored
from `HEAD`** — s23's pictures are the AC3 record and a control run is not entitled to replace them.
The control's own manifests are kept out of the tree. ✅ **Before running any `.look.ts`, check
whether its date directory already holds somebody else's committed verdict.**
---

# §8 SESSION 25 — the tags, built. 0 → 63, and 120 of 120 pictures unmoved

§7.4 registered *"the template ships zero semantic tags"* and named it the strongest candidate for
this session's first job. It was built. **Every reading below is from a run taken today at
`a013697d` + this working tree**, and the two that matter are taken from the *same* run so that
neither can be true without the other.

## §8.1 What was built

One source file — `packages/noodl-mcp/tests/tpl001Components.ts` — and `npm run template:members`
to regenerate. **24 of the artefact's 100 files changed; two nodes were added (551 → 553) and no
connection was (493 both sides).**

| where | tag | how many | what it is |
|---|---|---|---|
| `H_HERO`, `H_DOOR`, `H_PAGE` | `h1` | **13** | the page heading, and there are thirteen pages |
| `H_BAND`, `H_SECTION`, `T_CARD_TITLE` | `h2` | 9 | band heads, the two `/post` forms, the four repeater rows |
| `InsideTile`'s title | `h3` | 1 | a tile under a band that is already an `h2` |
| `T_EYEBROW`, the band's name | `span` | 17 | the lines that wear a heading's SIZE and are not headings |
| `PAGE_GROUND` (and `FORM_GROUND` through it), `landingMain` | `main` | **13** | one per page |
| `SECTION` | `section` | 8 | |
| chrome `bar` / `navWrap` / `Footer` | `header` / `nav` / `footer` | 1 each | one component apiece, placed on every page that has chrome |

🔴 **Corrigendum to §7.4: `nav`, `header`, `footer` and `section` are NOT on `Text`.** `Text`'s `as`
enum is `div|h1…h6|p|span`; the landmark names are on **`Group`** (`div|section|article|aside|nav|
header|footer|main|span`). Only those two node types have an `as` port at all — `Columns`, `Image`,
`Icon`, `Circle` and the rest have none. The §7.4 table read the two enums as one, which is why the
fix below needed a wrapper it did not predict.

## §8.2 The two structural nodes, and why each exists

**`navWrap`** — the band's nav is a `Columns` (for the breakpoint reason its own note gives) and
`Columns` has **no `as` port**, so the landmark goes on a `Group` around it. REL-002b's
`isSignedIn → mounted` gate **moved up onto the wrapper rather than being duplicated**: left on the
`Columns`, a signed-out stranger would get an empty `<nav>` on `/`, `/join` and `/sign-in` — a
landmark announcing navigation that contains none.

**`landingMain`** — `/` and `/join` are the two pages built on `BAND_PAGE_GROUND` instead of
`pageShell`, so neither has a `ground` node to carry `main`. `/join` gets one anyway through its
form band; `/` had nothing, and it is the page a stranger meets first. The wrapper re-parents three
of the ground's four children, and `BAND_PAGE_GROUND`'s `justifyContent: space-between` is why that
needed a check rather than an argument: in the door state only the hero and the foot are mounted,
so the ground had two children before and has two after; in every living state the content exceeds
the `100vh` floor and there is no slack to distribute. **The pictures are what settled it.**

## §8.3 The readings

| gate | reading |
|---|---|
| `tpl001Template.test.ts` (the drift gate, +§8's five) | **77/77, EXIT=0** (72 before §8) |
| `noodl-mcp` full jest | **92 suites / 1231 tests, EXIT=0** (1226 before §8) |
| `tsc --noEmit -p packages/noodl-mcp` | **0 errors, EXIT=0** |
| `tpl001-members-drive.test.ts` (real backend) | **59/59, EXIT=0** |
| `packages/noodl-editor` `test:main` | **412 suites / 6847 tests, EXIT=0** |
| `packages/noodl-editor` `test:ci` | **2943 specs, 4 failures, seed 23116, HEAD `a013697d`** — the documented floor, and all four are `AIX-006 style vocabulary`, by name |
| `vib001-members.look.ts` | **EXIT=0, 2/2, 60 shots** |

**At render time, through the harness's own `document.querySelectorAll('h1,h2')`:**

| | s24 | s25 |
|---|---|---|
| members-area shots carrying a heading | **0 of 60** | **60 of 60** |
| headings counted, door arm | 0 | 48 |
| headings counted, living arm | 0 | 116 |

**And the pictures did not move: 120 of 120 PNGs byte-identical to s24's committed run**, both arms,
both viewports, viewport and full.

## §8.4 🔴 The two readings are each other's control, and that is the point

*"120 of 120 identical"* is the shape of a run that photographed the **old** artefact — a stale
copy, a server holding a cached bundle, a drive pointed at the wrong directory. It is exactly the
null result that would fit both a working change and a broken instrument, and this board has been
caught by that shape before.

It is excluded **from inside the same run**: the shots that are byte-identical are the shots whose
manifests record 116 headings where s24's recorded none. An old artefact cannot produce both. So the
pair says the thing neither says alone — **the tags are being served, and they change nothing a
person sees**, which is what a semantic tag is supposed to do.

✅ **s24's `artefactTreeMd5` earned its keep on the very next change, and the field it replaced
failed in the predicted way.** Door arm: `artefactTreeMd5` `32c42a43` → `eeb3b2f0`, while the old
single-file `artefactMd5` read **`f969ad96` on both sides** — unchanged, across 22 component files
gaining tags. The pin s24 built for exactly this case is the only one of the two that could see it.

## §8.5 ⚠️ What is NOT built, and is named rather than left to be found

1. ~~No gate holds the tags in place.~~ ✅ **Built — §8.6.**
2. **The `h1` sits outside `<main>` on the nine chrome pages** — `pageHead()` roots in `headBand`,
   which is `ground`'s sibling. Common, legal, and not ideal; fixing it means wrapping in
   `pageShell` and re-photographing.
3. **The four judgements of §7.3 are untouched** — they were always Richard's.

## §8.6 ✅ The gate, and it was driven RED before it was believed

Five specs in `tpl001Template.test.ts`, in the `design system is finished` describe: every page
declares **exactly one `h1`** (and there are thirteen pages), every page declares **exactly one
`main`**, the chrome and the foot carry the three landmarks a page cannot own itself, **no node
carries an `as` its type has no port for**, and a **control**.

🔴 **A green census over a tree is worth nothing until it has been shown to go red**, and this one
was the most obviously vacuous kind: one session ago the same three specs would have read clean
against an artefact with zero tags in it, had they counted the wrong field. So the artefact was
sabotaged and the gate re-run:

| mutant | result |
|---|---|
| `/directory` loses its `h1` and its `main` (`"h1"` → `"div"`) | **§8.1, §8.2 and the CONTROL red** |
| the chrome's `navWrap` and `bar` lose theirs | **§8.3 red** |
| an `as: 'nav'` put on the nav `Columns`, a type with no such port | **§8.4 red** |

Four of the five reddened on the first mutant pair and the fifth on its own, which is the right
answer: §8.4 is about the **type**, not the value, so a mutant that only changes values on `Group`s
must leave it green. **Both files were restored and md5-checked** (`dc59b483…`, `0a08cc8e…`) and the
suite re-read **77/77, EXIT=0**.

⚠️ **The control grades the PREDICATE, not the artefact.** `tagsIn` is run over a hand-built mutant
holding the two near-misses that would make the census a tautology — a node whose *id* is `main`,
and a `Text` whose *content* is the word `main` — and must return neither.

