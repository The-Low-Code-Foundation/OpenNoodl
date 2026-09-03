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

### 🟢 CLOSED 2026-09-03 (s17) — 53 of 53, from 1 of 53

Artefact `d40d8f88d933f1232c5f3fc7ec34460b`, built from HEAD `f0ba5635`.
Gates: `npm run template:site-builder` **exit 0**; `sbr014ControlStyleCensus.test.ts` **12/12**
having been **1 failed / 11 passed**; the named neighbourhood — `sb005AdminPanel`,
`sb006PublicSite`, `sb007Template`, `sbr009ThemeEditor`, `sbr010Messages`, `sbr012RawColourGate` —
**7 suites, 248/248**.

| AC | how it closed |
|---|---|
| **1** | 🔴 **Red first, and recorded**: `1 of 53`, not the 3 this file was opened on. Green at 53/53 |
| **2** | `public-site-after/kind-contact-desktop-viewport.png` beside the committed before-arm |
| **3** | `/admin/pages` **and** `/admin/theme` photographed. §2's *"NOT measured"* is now measured |
| **4** | `all-five-desktop-full.png` — the CTA pill and `Send` on one page, one idiom |
| **5** | Regenerated from source, `sb007Template.test.ts` green — no hand edit to the JSON |

#### 🔴 The count in §2 was 3 and the answerable count was 1

§2 counted *"carrying any `var(--…)` parameter"*. That admits `/Pages/Admin`'s `New page` on a lone
`marginLeft` — spacing, not treatment — and `/Admin/PresetChip`, which carries a full chip treatment
but no `fontSize`. Neither reading is wrong. **They are different questions**, and a census whose
number cannot be reproduced from its own definition is a number a later session will re-derive
differently. The contract is now written down per port, per type, with the measured default each one
overrules, in `sbr014ControlStyleCensus.test.ts`.

#### 🔴 Two of the four control types were never part of the defect

§2 reads *"53 interactive controls and styles 3 of them"* and the fix reads across all four types.
Measured on the **live** node definitions — `nodes/controls/`, not the `nodes-deprecated/` twin that
carries the same display names and different defaults:

| type | at its own defaults | against the bar |
|---|---|---|
| `textinput` ×25 | `transparent`, `border-style: none`, width 0 | 🔴 **invisible** — the row's defect |
| `button` ×26 | `black` / `white` / `padding: 5px 20px`, radius 0 | 🟡 legible; a raw pair outside the palette |
| `options` ×1 | `solid`, 2px, `#000000`, radius 5 | 🟢 **draws already** |
| `checkbox` ×1 | `solid`, 2px, `#000000`, radius 3, 32×32 | 🟢 **draws already** |

✅ The invisible-field finding is **confirmed three independent ways** — the node default, the
runtime stylesheet, and the photograph. It is the text inputs. The dropdown and the checkbox took
the treatment to join the palette, and this row does not cite them as evidence of the fix.

#### 🔴 The root cause was ONE parameter's absence, and the product was already correct

`.ndl-controls-textinput { border-style: none; background-color: transparent }` is the whole of it.
Nothing was mis-built: `addBorderInputs`, `addPaddingInputs` and `backgroundColor` all already carry
`styleTag: 'inputWrapper'`, and the text style carries `styleTag: 'input'`, so **every port this
needed lands on the element a person would expect** — a border does not box the label in with the
field. The template simply never set any of them. ⚠️ Nearly filed as a hazard the other way round,
from reading `TextInput.tsx`'s outer `<div>` before reading where the ports are routed.

#### ⚠️ Two ports were REFUSED, and the refusals are the load-bearing part

1. 🔴 **`fontFamily` is not in the contract.** `assets/style.css` gives both control classes
   `font-family: inherit` — P78 D18's fix, measured across eleven pages. Requiring the port would
   have restated a correct value on 53 nodes, moved this census's number, and **changed no pixel**.
   That is REL-010 §6.5's refused move wearing a different hat.
2. 🔴 **Label ports are not in the contract.** A `<label>` is not a form control and inherits the
   page. The labels are legible in the very photograph this row was opened on — *"Your name / Your
   email / Your message"* reads fine; it is the field **beneath** it that is not there.

`fontSize` **is** required, from the same stylesheet's own comment: *"`font-family` only,
deliberately. Size and weight were not measured"* — so every control's text sat at the user agent's
~13px beside a `Text` at `--text-base`, including the one button that was already dressed.

#### 🔴 The fix's first arm was correct and looked unfinished, and only the render said so

With the border drawn, the three contact fields were **~205px in a 700px card**. A `textinput`
defaults to `contentSize`, so they had *always* been that narrow — invisible, so nobody could see it.
✅ **`sizeMode: 'contentHeight'` alone fixed it, with no `width` at all**: `contentHeight` stops the
node assigning its own height and leaves it assigning width, so the field spans the column.

⚠️ **The first draft did set `width: 100%`**, copying `templates/members-area`. That reddened
`sbr012RawColourGate` with **26 new raw dimensions** and `sb006PublicSite` with three more, and the
only way to keep it would have been twenty-six copies of one exemption reason. **The gate was right
and the parameter was redundant** — dropping it is greener *and* fewer parameters. A second render
is what proved it, not the argument.

✅ **Independent confirmation of the treatment itself**: `templates/members-area` — the template
Richard rates — reached the same eleven-line field treatment on its own, down to the token names
(`--background` / `--border-1` / `--border` / `--radius-md` / `--space-3` / `--space-2` /
`--text-base` / `--foreground`). Two templates, arrived at separately, agree.

#### What a person sees now

- **Public contact form**: three bordered fields on the card, and `Send` as a filled `--primary`
  with `--radius-md` corners instead of a black square.
- **`/admin/pages`**: `New page` and `Published` filled; `Edit` / `More` as bordered chips.
- **`/admin/theme`**: all seven fields boxed with their values legible; the three preset chips and
  `Save settings` in one idiom.
- **One page, both idioms** (`all-five-desktop-full.png`): the CTA keeps its deliberate inverse
  treatment on the brand band, and now shares the corner radius, weight and size of `Send`.

⚠️ **The admin before-arm is `vib-001/2026-08-31/`, and it is NOT a one-variable pair.** It confirms
the admin fields were invisible in the same way as the contact form's — which is exactly what §2
flagged as unmeasured — but the cards, the section headings, the preset chips and the live preview
all landed between that shot and this one. Cite it for the fields, not for the screen.

#### 🔴 A hazard this row met, which will bite the next look session

**`judge()` keys its output directory by `today()`, so two sessions running the same look harness on
the same day overwrite each other's verdicts in place.** This session's first run replaced P77 s48's
`sbr-005/2026-09-03/site-builder-living` — the very before-arm AC2 names. ✅ Recovered in full from
`9bd1488f` and restored (`md5` checked against `git show` on both arms); the after-arm now lives in
`verdicts/rel-011a/2026-09-03/`. ✅ **Commit a run before taking another, and copy an after-arm out
before re-running.**

#### One measurement handed to REL-011b, not fixed here

`sbr005-sections.look.ts` AC3 failed again with **`no button labelled "Send". Buttons on the page:
[]`** after `service.stop()` — REL-011b AC2's known defect, **reproduced a third time**, on a
template whose buttons are now unmistakably present when the backend is up. AC1 (five kinds), AC2
(the CTA navigates), AC4 and AC5 all passed in the same run.

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
   pre-existing at HEAD and not an artefact of that change. 🟢 **DIAGNOSED AND FIXED 2026-09-03
   — see §AC2 below.** It is the **product**: a failed fetch published an empty collection over the
   rows it had already delivered, so a dropped realtime stream emptied the page. The sentence below
   is what the row said before that, kept because the question it asks is the right one. **Settle
   which before fixing anything.**
3. **The admin screens are photographed at last, now the void is gone.** Every `/admin/*` route at
   1280, on the fixed artefact. 🔴 This is a **discovery** AC: D40 hid whatever is below the first
   screen on eleven admin pages for the whole life of this template, and REL-011c cannot be scoped
   from pictures that do not exist. Anything found is registered with an owner — it does not
   automatically join this row.

### 🟢 AC2 — SETTLED, AND IT IS THE PRODUCT. Fixed 2026-09-03 (s18)

**The harness is exonerated and the mechanism is named.** The row asked to settle harness-vs-product
*before fixing anything*; the settling is a step-by-step probe, and the fix follows from what it read.

#### The measurement — `sbr005-sections.look.ts`, AC3's failure arm, 2026-09-03

| moment | elements | buttons | fields | sections | imgs | `bodyChars` | headings |
|---|---|---|---|---|---|---|---|
| fresh load, backend **up** | 82 | 2 | 3 | 6 | 3 | 661 | 6 |
| filled, backend **up** | 82 | 2 | 3 | 6 | 3 | 661 | 6 |
| after the resize, backend **up** | 82 | 2 | 3 | 6 | 3 | 661 | 6 |
| **backend DOWN, +0ms** | **38** | **0** | **0** | **0** | **0** | **140** | **1** |
| backend DOWN, +2s | 38 | 0 | 0 | 0 | 0 | 140 | 1 |
| backend DOWN, +8s | 38 | 0 | 0 | 0 | 0 | 140 | 1 |

Console across that step, and nothing else:
`DbCollection2 (/Pages/Site): Failed to fetch. [query-records/query-failed]` × 2.

🔴 **The page was WHOLE at the moment before the stop**, on the same probe, three times. That
is what makes this a product finding: nothing the harness did emptied it, and the emptying is
**immediate** — inside one `evaluate` round trip, not a slow timeout. The three post-stop readings
exist to separate those two, because they have different fixes.

⚠️ **The nav band survives** (`bodyKids` stays 6, the page's own `Welcome` heading is still
there). It is the *records-driven* content that goes: all six sections, all three pictures, both
buttons and all three form fields.

#### 🔴 The arm could not have told you this, and its own control was the reason

The `beforeThePress` assertion reads *"answered before the press — sent: false, refused: false"*.
That is **exactly what a blank page reports.** It was written to catch a form that submits on typing
(D41) and it passes unchanged on a document with nothing in it — so every reading this file has ever
taken of the zero-buttons failure was equally consistent with *"the page emptied earlier"*. ✅ A
**presence control** now stands beside it (`any button: true, any field: true`, backend still up), so
the after-picture is attributed to `service.stop()` and to nothing else. This is
[[assert-an-absence-with-a-known-firing-signal-beside-it]] on a control that had been green for weeks.

#### The mechanism, and why the fix is one guard

[`dbcollectionnode2.ts`](../../../packages/noodl-runtime/src/nodes/std-library/data/dbcollectionnode2.ts)'s
`fetch()` mints an empty `Collection` at the top and fills it **only** in the `success` branch. The
`error` branch published **that empty collection** — so a query that merely failed to answer was
indistinguishable from a table that had been emptied: `items` → `[]`, `isEmpty` → true, every
`For Each` below it redrew zero rows, and every `mounted` wrapper they feed unmounted.

SBR-011 gives three of this template's queries a **realtime subscription**, and a dropped stream
re-runs the query. So on a published site **any backend restart or network blip empties every
visitor's page until they reload it** — which is a far larger consequence than the one this AC was
opened on.

🔴 **The failing branch was the odd one out among `fetch()`'s three failure exits.** The
unconfigured-backend exit and the bad-filter exit both `setError` and return, leaving the collection
alone; only the fetch-error callback overwrote it. The fix aligns the third with the other two:

```ts
if (this._internal.collection === undefined) this.setCollection(_c);
this.setError(err || 'Failed to fetch.');
```

⚠️ **The FIRST failure is deliberately unchanged.** With nothing bound yet the empty
collection is still published, so a query that has never succeeded still reports `[]`, `isEmpty: true`
and `count: 0` exactly as before. The behaviour differs **only where there is something to lose**.

⚠️ **It does NOT make a refusal legible, and must not be read as closing that.** P77
[D4](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md) — *"a refused query and
an empty collection are the same screen"* — is a separate row with a separate fix (wiring the
`failure` signal and `error` string this node already offers), reclassified to the template in
THE-SWEEP-2026-08-29 and owned by SBR-006/010. **This one stops the failure destroying good data on
its way to being illegible.** The two are adjacent and neither substitutes for the other.

#### The gate, and the reverted arm

[`rel011b-failed-fetch-keeps-rows.test.ts`](../../../packages/noodl-runtime/test/nodes/rel011b-failed-fetch-keeps-rows.test.ts)
— **5 specs, and the control matters more than the count**:

| spec | fixed | 🔴 **reverted source** |
|---|---|---|
| a successful fetch delivers the rows (**presence control**) | ✓ | ✓ |
| **keeps those rows when the NEXT fetch fails** | ✓ | ✕ `count: 0, isEmpty: true` |
| still reports the failure — keeping rows must not hide the error | ✓ | ✓ |
| a FIRST fetch that fails still reports empty (**unchanged half**) | ✓ | ✓ |
| a successful re-fetch still REPLACES the rows (**not a freeze**) | ✓ | ✓ |

✅ **Exactly one spec reddens on the pre-fix source**, and the two no-change controls stay green in
both arms — so the file grades the change and not the neighbourhood.

**Gates**: full `noodl-runtime` **150 suites, 2637 passed, 13 skipped, 0 failed, exit 0**.

⚠️ **A trap inside the spec worth keeping**: `setInputValue('collectionName', …)` is dropped
with a console line and no error — `collectionName` is a **dynamic** port registered from the
editor's class list, so it does not exist on a bare node. The prototype extension
`setCollectionName()` is the one that works. And `CloudStore._fromJSON` calls
`(modelScope || Model).get(objectId)`, so a `{}` model scope makes every *successful* fetch throw —
which would have left the file able to grade only the failure, with no presence control beside it.

#### ⏳ What is still owed on AC2

The **rendered after-arm**. The look harness serves the built `noodl.viewer.js`, so the page-level
before/after needs that bundle rebuilt from this source. Pinned before the work:
`8facb5b25e80339a28ebf539a4894b23`, mtime 2026-09-02 22:55:56. 🔴 **A peer was mid
`render-from-disk.js` run with the box at load 40 when this was written**, and rebuilding the shared
bundle under a live reading is this phase's own hazard 13 — so the rebuild waits for a quiet box, and
the after-arm is taken with the md5 recorded **either side** of the run.

### ⚠️ AC3 — the route count on this row is wrong, and it is FOUR, not nine

Re-derived from the artefact rather than inherited: the template declares **seven** `Page`
components, **six** of them under `admin/` — `/admin/setup`, `/admin/signin`, `/admin/pages`,
`/admin/page`, `/admin/theme`, `/admin/messages` (`ADMIN_PATH_PREFIX` is the literal `admin`;
`sb005Components.ts` holds all six, `sb006Components.ts` the public one). s17 photographed
`/admin/pages` and `/admin/theme`, so **four routes remain**, not nine, and *"eleven admin pages"*
above counts something other than routes. ✅ The AC is unchanged in substance — photograph every
`/admin/*` route — only its arithmetic was inherited without being checked.

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
