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

1. 🟢 **[D54](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md#d54) — CLOSED
   2026-09-03 (s19), and the row's own description was wrong.** It read: *"the theme presets are
   dead on the deploy — 0 of 7 fields changed, 0 requests, while `Save theme` fires its `PUT`; works
   in the editor's preview and inert in the deployed bundle."* **They were never dead.** They fire on
   every click and publish `night`, whichever chip is pressed, on every surface. See §AC1 below.
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

#### 🟢 The rendered after-arm — AC2 IS CLOSED

Same harness, same seed, same probe, on the rebuilt runtime. The bundle was pinned either side
of the run: **`8facb5b25e80339a28ebf539a4894b23` → `c8d6228e2e61017979e38870ee67e56e`**
(`packages/noodl-viewer-react` `npm run build`, exit 0, size warnings only), and the guard was
confirmed present in the minified text as
`void 0===this._internal.collection&&this.setCollection(t)`.

| moment | elements | buttons | fields | sections | imgs | `bodyChars` |
|---|---|---|---|---|---|---|
| backend up, 3 readings | 82 | 2 | 3 | 6 | 3 | 661 |
| **backend DOWN +0ms** | **82** | **2** | **3** | **6** | **3** | **661** |
| backend DOWN +2s | 82 | 2 | 3 | 6 | 3 | 661 |
| backend DOWN +8s | 82 | 2 | 3 | 6 | 3 | 661 |

*(before the fix, the same three post-stop rows read `38 / 0 / 0 / 0 / 0 / 140`.)*

🔴 **The control that makes this mean something: the query STILL FAILS.** Both
`DbCollection2 (/Pages/Site): Failed to fetch. [query-records/query-failed]` lines are in the
console of the after-run, unchanged. So the fix did not suppress the failure or keep the backend
alive — **it stopped the failure deleting the rows**, and nothing else moved.

🟢 **`sbr005-sections.look.ts` now passes whole — 3 of 3, exit 0** (AC1+AC4+AC5, AC2, AC3),
where AC3 had failed three runs in a row. Its refusal arm is now observable for the first time: the
`Send` button is found, clicked, and the template's refusal sentence renders — so *"a failed message
says so"* is measured rather than blocked behind an empty page.

Pictures: [`verdicts/rel-011b/2026-09-03/after-the-fix/`](verdicts/rel-011b/2026-09-03/after-the-fix/)
(73 files). ⚠️ **The before-arm was restored, not overwritten**: `judge()` keys its output by
`today()`, so this run wrote over `phase-81/verdicts/sbr-005/2026-09-03/` — the after-arm was copied
out first and the committed before-arm restored with `git checkout --`, both `md5`-checked
(`all-five-desktop-full.png`: before `da99c590…`, after `b1d303aa…`). This is REL-011a's hazard
hitting the very next session that ran a look harness.

#### ⚠️ Registered, not built — the deprecated twin has the same defect. Owner: `NONE`

[`packages/noodl-viewer-react/src/nodes-deprecated/std-library/data/dbcollectionnode.ts:384-387`](../../../packages/noodl-viewer-react/src/nodes-deprecated/std-library/data/dbcollectionnode.ts#L384)
carries the identical unguarded `error: … setCollection(_c)`, and both branches are in the shipped
bundle — the substring search that confirmed the fix found the guarded v2 branch **and** the
unguarded v1 one. The site-builder template uses `DbCollection2`, so this AC is unaffected; a
project carrying the **deprecated** node still empties on a failed re-fetch. Not fixed here because
it is outside this row and outside 0.2.2's scope as written.

🟢 **Owner assigned 2026-09-03 (s19): phase 80, as `DEF-043`.** P80 is *the defects the
templates found*, it is open (41 of 42, DEF-042 waiting on Richard), and its own handoff and
`UNOWNED-ROWS-TO-MEASURE.md` both record `DEF-043` as the next free id. ⚠️ **The id is a
recommendation, not a claim** — a P80 session was active while this was written and a peer taking
an id is invisible until it lands, so whoever writes the row re-derives the next free id from
P80's board first. The measurement is done and is above; what is owed is the same one-line guard
in `nodes-deprecated/std-library/data/dbcollectionnode.ts:384-387` and a spec, or a ruling that a
deprecated node does not get fixed.

⚠️ **Adjacent, and worth linking rather than merging**: P80 **DEF-026** is `CloudFunction2`'s dead
failure path on an unreachable backend. Same trigger (the backend is gone), different node, different
defect — noted by the P80 session working beside this one.

### 🟢 AC1 — D54 SETTLED, AND THE ROW DESCRIBED THE WRONG DEFECT. Fixed 2026-09-03 (s19)

Full write-up in [D54](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md#d54).
The row said *"diagnose before fixing"*, and the diagnosis is the part worth reading: it is not the
defect the row names.

#### The measurement that settled it

The deployed bundle (`deploy-from-disk` → `drive-deployed`, `/admin/theme`, 1280×900), driven from
an **empty** form so a change cannot hide inside a value already on screen:

| pressed | the five token fields immediately afterwards |
|---|---|
| `Studio` | `#d9a441` `#14161a` `#eceae5` `"Helvetica Neue"…` `10px` |
| `Press` | the same |
| `Night` | the same |
| `Studio` again | the same |

Those are **`night`'s** values, read out of the shipped picker's own script. So the chain was
never dead: **it published the wrong preset, and D54's screen already held that preset**, which is
why *"0 of 7 changed"* looked like nothing happening. 🔴 **Two opposite diagnoses fit that
reading and only a set starting state separates them.**

⚠️ **There is no preview/deploy difference either.** s46's preview drive picked **`Night`** — the
last chip placed, and the only one that was ever right.

#### The mechanism, and why SBR-009's fix was necessary and not sufficient

All three chips wire their `name` — a `Component Inputs` constant published at **MOUNT** — into the
**same** `presets.in-name` port. Three producers, one input, last placement wins; `run` carries no
payload, so a press says *now* and never *which*. SBR-009's `runOnChange-in-name: false` stopped the
picker **running** at mount (the screen used to boot wearing Night) and said nothing about the
**value** mount had left in the port. 🔴 *A `runOnChange` census asks WHEN a node runs, never WHAT
it will read.*

The fix is one script inside `/Admin/PresetChip`: it publishes **`{ name }` — its own — at the
press**, then fires `Picked`. ⚠️ **An object rather than the name, and the first draft is why**: a
Function's `Outputs` proxy publishes only on change, so `Outputs.name = Inputs.name` is right about
*which* chip and silent on a **re-press** — measured on the deploy as Studio, Press, Night, then
**Studio again reading Night**. Kept as a MUTANT arm.

#### The gates

| gate | reading |
|---|---|
| [`d54ThemePresetIdentity.test.ts`](../../../packages/noodl-mcp/tests/d54ThemePresetIdentity.test.ts) (new) | **10/10** — the shipped chip in the real runtime, with the first-draft MUTANT and the **REVERTED pair** (every press answers `night`) beside it |
| `sbr009ThemeEditorDrive.test.ts` | **9/9** in a real browser, from 6. 🔴 **exactly the three new arms are RED on the reverted source**; the six older ones green in both |
| `npm run template:site-builder` | exit 0 |
| full `noodl-mcp` | **91 suites, 1196/1196, exit 0** |
| `typecheck:mcp` | exit 0 |
| the deployed drive, after the fix | `Studio Press Night Studio Press` → **five presses, five correct palettes** |

#### 🔴 Four things that cost this session time, and are worth carrying

1. **The drive that existed only ever pressed the chip that was right.** `sbr009ThemeEditorDrive`
   has clicked `Night` since it was written, and Night is the last placement. ✅ **Where several
   instances of one control feed one consumer, press a NON-DEFAULT one.**
2. **The structural spec was true and blind.** *"every chip is wired to the picker: the name as a
   value, the click as a signal"* was green and correct — it cannot see that all three wire into
   **one** port. ✅ **A wiring pin says nothing about cardinality at the target.**
3. **A relayed conclusion sent the diagnosis to the wrong package.** *"Works in preview, inert on
   the deploy"* filed this under `SBR-008`'s family and bought a full pass over the export — the
   health filter, the exported `ports`, the bundle's own JSON, all clean, none of them it. The two
   readings differed by **which chip was pressed**, not by which surface.
4. ⚠️ **A content grep does not find a file.** This session recorded *"`sbr009ThemeEditorDrive`
   does not exist"* from a `grep` for that string in code; it is
   `packages/noodl-mcp/tests/sbr009ThemeEditorDrive.test.ts`, and it is the drive the new arms were
   added to. ✅ **Look for the FILE before concluding a cited spec is imaginary.**

### ⚠️ AC3 — the route count on this row is wrong, and it is FOUR, not nine

Re-derived from the artefact rather than inherited: the template declares **seven** `Page`
components, **six** of them under `admin/` — `/admin/setup`, `/admin/signin`, `/admin/pages`,
`/admin/page`, `/admin/theme`, `/admin/messages` (`ADMIN_PATH_PREFIX` is the literal `admin`;
`sb005Components.ts` holds all six, `sb006Components.ts` the public one). s17 photographed
`/admin/pages` and `/admin/theme`, so **four routes remain**, not nine, and *"eleven admin pages"*
above counts something other than routes. ✅ The AC is unchanged in substance — photograph every
`/admin/*` route — only its arithmetic was inherited without being checked.

#### 🟢 The pictures exist — 24 shots, 2026-09-03 (s19)

`vib001-site.look.ts`'s **living** arm, extended by two routes and re-run on the fixed artefact:
**24 shots (from 16), exit 0**, `md5=5e8dfaf9762198143251111cae7d0863`,
`head=3f95a804`. In
[`phase-81/verdicts/vib-001/2026-09-03/site-builder-living/`](../phase-81-the-look-is-the-product/verdicts/vib-001/2026-09-03/site-builder-living/).
It is a **superset** of s17's run in the same directory (16 shots, `md5=1eeb5277`, `head=f0ba5635`):
the eight older shots are re-taken, the eight new ones are `admin-page` and `admin-messages` at four
widths each. ⚠️ `judge()` keys by `today()`, so this overwrote s17's — deliberately, and s17's is
recoverable from `d88368c5`.

⚠️ **The route count on this row was wrong a second time, and the door arm is why.** The AC said
nine, s18 re-derived four, and the answer is **two**: `vib001-site.look.ts`'s **door** arm has
photographed `/admin/setup` and `/admin/signin` at four widths since it was written — signed-out and
unclaimed, which is the only state those two have. `/admin/pages` and `/admin/theme` were s17's.
**`/admin/page/{pageId}` and `/admin/messages` had never been photographed on any date, in any
state.** ✅ **Count from the verdict directories, not from the row.**

Two enquiries are seeded through `submitContactForm` as an anonymous visitor, so `/admin/messages`
is photographed holding something. 🔴 Through the product's own door and not by POSTing rows:
`ContactMessage.create` is `nobody` for everyone (SB-004 §4), so a seeded row would be a picture of
a state the product cannot reach — and the POST would fail, which is the point.

#### 🟢 `/admin/messages` reads well, and 🔴 `/admin/page/{pageId}` is the worst screen in the template

`/admin/messages` is composed: a title, one sentence of guidance, a count, then name · date ·
address · message · which page it came from, ruled between records. Nothing is registered against
it beyond the shell finding below.

`/admin/page/{pageId}` — the screen a client actually spends their time in — is a different matter.
**Registered, not fixed here**; this is a discovery AC and the row says so.

| # | what the pictures show | owner |
|---|---|---|
| **A1** | 🔴 **The admin shell does not fold.** `/Admin/Shell`'s `frame` is a `row`, `sidebar` is `width: 240px, sizeMode: explicit`, and **no node in it carries a `smallLayout`**. At 390 the sidebar keeps all 240px and every admin screen gets ~150px of content: `/admin/messages` clips mid-word (*"read to here"* → *"reac"*, `ted@example.inval`), `/admin/theme` reports **362px unreachable**, `/admin/page` **2379px**. Statically derivable from the artefact and visible in four phone shots. ⚠️ **This is not new to the two routes added here** — `/admin/pages` and `/admin/theme` phone shots have existed since s17 and show the same shell | **REL-011c** |
| **A2** | 🔴 **The page editor overflows horizontally below ~1900.** At **1900** every control is in the photograph. At **1280** — the width this AC names — `Preview`, `Save page`, the whole `Slug` field, `Show in navigation` and `Add section` are **outside the picture**. A client on a laptop cannot see the button that saves their page. ⚠️ **The mechanism is unmeasured**: the fields DO narrow between the two widths (~763px → ~573px), so it is not a fixed width, and no node on `/Pages/PageEditor` carries a `width`, `minWidth` or `maxWidth` at all | **REL-011c** |
| **A3** | 🔴 **The judge has no horizontal reachability metric, and that is why A1 and A2 were invisible.** `unreachablePx` is a **vertical** measure; every one of the twelve desktop and wide admin shots reads `unreachable=0` while `Save page` is off the right edge. A run can look clean in its manifest and be photographing a screen a person cannot operate | **phase 81** (`VIB-001`, the judge) |
| **A4** | ⚠️ `Sections` and `Kind` share one line, with the `Kind` label sitting to the right of the `Sections` heading rather than over its own control, and `Add section` at the far right of the same row | **REL-011c** |
| **A5** | ⚠️ The `gallery` section card shows a rendered picture **and** the words **“No pictures yet”** underneath it, at the same moment | **REL-011c** |
| **A6** | ⚠️ Section cards are headed by the raw kind slug — `hero`, `richText`, `cta` — while the `Kind` picker two lines above offers the human words (`Hero`, `Rich text`, `Call to action`). Two vocabularies for one thing, on one screen | **REL-011c** |
| **A7** | ⚠️ **No admin page has an `h1`.** All twelve admin shots record `headings: []`; the public pages record `Welcome`. The words are drawn by `Text` nodes, so the screens have titles and the document has no heading structure | **REL-011c** |

🔴 **A1 and A2 are the reason this AC was written.** REL-011c asks Richard to rule three surfaces
`PASSABLE`, and until today two of the six admin routes had no pictures at all and the shell's
behaviour below 1280 had never been read off one. **A ruling taken on the pictures that existed
would have been a ruling about four screens out of six.**

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

### 🟡 The six product findings this row owns are BUILT (s22, 2026-09-03)

**AC3 is his and stays his.** What a session could do — and what s20's hand-off said there was none
of left on this board — is the **six product findings REL-011 §AC3 registered against
`/admin/page/{pageId}` and the admin shell**. A1, A2, A4, A5, A6 and A7 are built; A3 is untouched
and still belongs to phase 81's judge.

Gate: **`rel011cAdminSurfaces.test.ts`, 24/24, over the shipped
`site-builder.content.json`** — not over the source constants that produce it, because the door
renames ids, drops parameters it refuses and rewrites connections, so a spec over the arguments can
be green about a template that does not carry the fix.

🔴 **It was written to RED and the red is measured, not asserted.** The same file run with HEAD's
artefact copied over the fixed one (`9de22f4634b7…` in place of the new bytes, restored and
md5-checked afterwards) reads **21 failed, 1 passed of 22**. The single survivor is the arm that
exists to survive: *"the population is real — these are the screens the router actually serves"*,
which asserts only that the six admin components exist. **A control that reads the same in both arms
is what tells you the other twenty-one were reading something.**

#### 🔴 A2 — the mechanism, and it was ONE node's empty parameter bag

The row recorded A2 as *"the page editor overflows horizontally below ~1900, and the mechanism is
unmeasured: the fields DO narrow (~763 → ~573px), so it is not a fixed width, and no node on
`/Pages/PageEditor` carries a `width`, `minWidth` or `maxWidth` at all."* All three of those
observations were correct and the conclusion they invited — *"something has a fixed width"* — was
wrong.

**Measured on the deployed bundle at all four widths**, by walking the widest-right path from
`<body>` and printing every box on it with its flex arithmetic (`main` is `/Admin/Shell`'s
`Admin content`; `body` is the page editor's own column):

| viewport | `main` | `body` | `body` scrollWidth | document width |
|---|---|---|---|---|
| **1900** | 1660 | 1596 | 1596 | 1900 — everything on screen |
| **1280** | **1280** | 1216 | 1217 | **1520** |
| **988** | **988** | 924 | **1217** | **1489** |
| **390** | **390** | 326 | **1217** | **1489** |

🔴 **`body`'s content wants 1217px at every viewport, and it is a 1200×600 picture.**
`/Admin/SectionRow`'s `Image preview` was authored as `{ id, type: 'Image', label, parent }` — **no
parameters at all**. `Image` defaults to `contentSize` (`image.ts:176`), which assigns neither axis,
so the node rendered at its **source's intrinsic width**, and `layout.ts:82` starts every node
`flexShrink: 0` — only a percentage size along the parent's direction opts back in. The look
harness's swatch is 1200px wide; a client's phone photograph is three times that.

🔴 **And that is also why the two boxes behaved differently, which is the part the row could not
explain.** `min-width: auto` on a flex item is `min(its own stated width, its content minimum)`.
`Admin content` carries `width: 100%`, and its content minimum was **1280** — 64px of its own
padding plus the card's 1216. So:

- above 1280, the rail's 240px comes out of the content column correctly (1900 → 1660);
- at or below it, `main` stops shrinking at its own stated width, and the **rail is pushed off the
  right-hand edge instead of coming out of the content**.

The fields narrowed because they are percentage-width children of a box that *was* narrowing;
`Save page` sat at x=1370 on a 1280px screen because it is in a box that was not. **Two different
boxes, one of them clamped.** The fix is the treatment this template's other `Image` already carries
(`/Site/GalleryTile`): `sizeMode: 'explicit'`, `objectFit: 'cover'`, a 100% width and a 180px crop —
plus `mounted` off until there is something to show, because an explicit box draws 180px of empty
ground on every section without a picture.

⚠️ Two raw dimensions, both named with reasons in `TEMPLATE_DIMENSION_EXEMPTIONS`
(`siteBuilderStyleScan.ts`); `sbr012RawColourGate` asserts that list **exactly**, in both directions.

#### 🔴 A1 — the shell had no breakpoint of any kind, and `Columns` is the wrong tool

`/Admin/Shell` carried a `240px` explicit rail and nothing anywhere that read a viewport. Fixing A2
does not fix this: with the picture sized, `main` at 390 shrinks to **150px** and the content column
to 86.

⚠️ **The runtime's own breakpoint is on `Columns` and only there** (`smallBreakpoint`/`smallLayout`,
`columns.ts:239`) — the mechanism `members-area`'s `MemberRow` uses. It is wrong here: a `Columns`
divides its width by a ratio, so the fixed 240px rail would become a **proportion** of the viewport
and grow to ~380px at 1900. The rail is fixed on purpose (`SIDEBAR_WIDTH`), so the breakpoint had to
come from somewhere that does not also resize it.

**`Screen Resolution`** is that somewhere — a reactive `width` output that re-publishes on every
`resize` (`screenresolution.ts:70`). Below **760px** (240 for a rail leaves under 500px of content,
which is narrower than this screen's own two-up field row wants) one function moves four ports
together: the frame's `flexDirection` to `column`, the rail's `sizeMode` to `contentHeight`, its
`width` to `100%`, and its `borderRightStyle` to `none`.

- ⚠️ **All four, or none.** A stacked frame whose rail still states 240px is a 240px block with the
  content beneath it; a rail at 100% inside a row is the whole screen.
- ⚠️ **`railWidth` is built FRESH on every run.** A `Function`'s `Outputs` proxy publishes only on
  change, so a shared constant would be sent once and never re-sent when the window came back over
  the fold. The three strings beside it are deliberately the opposite.
- ⚠️ **The guarded return is the SSR answer.** `Screen Resolution` is client-only, so an unmeasured
  width publishes nothing and the **authored** parameters — which are the wide shape — stand.
- ⚠️ `borderRightStyle` is authored as a real line because `borderRightWidth`/`Color` are dynamic
  ports gated on exactly that; authoring `'none'` would have made the other two unauthorable.

**Second half, same number**: `/Pages/PageEditor`'s title/slug pair stops being two-up below 760 as
well, from its own `Screen Resolution` rather than a contract passed down from the shell — a shell
that reports its layout to its children is a shell that has to be right about all of them. ⚠️
`flexWrap: 'wrap'` is authored on that row purely so `rowGap` is **authorable at all**: the port is
gated on `flexDirection = column OR flexWrap = wrap` (`group.ts:478`) and the Group is authored as a
row, so without it the stacked form would have had no gap between its two fields.

#### 🔴 A5 — the photograph showed a fixture defect, and it was hiding the opposite product defect

A5 read: *"the `gallery` card shows a rendered picture **and** the words 'No pictures yet' at the
same moment."* Both halves of that screen were real. **Neither was the defect.**

`/Admin/SectionRow`'s `absorb` pushes an upload onto `data.images` for a gallery and writes
`data.image` for every other kind — so **a gallery built through the product never has an `image`**,
and the seeded row (`{ image: { url: SWATCH } }`) was a state the product cannot reach. The seed
manufactured the contradiction. Underneath it, `unpack` fed the preview `d.image` for every kind, so
a **real** gallery — three uploads, `images` full, `image` absent — showed **no picture at all**
beside a count that said how many there were. The seed was hiding it by never producing one.

✅ One derivation settles both: a gallery's picture is the **last** of `images`, which is also the
one `Remove last picture` takes back, so what is on the card is what the button acts on. Graded four
ways with the **reverted** script beside it — the reverted arm fails exactly the two the finding
describes and passes the four kinds the fix must not touch.

⚠️ **The seed is fixed too, so the A5 before/after PICTURE is not a one-variable comparison** — the
one-variable evidence is the spec, which runs both data shapes through the same script. The seed had
to move for a second reason: `/Site/GallerySection` reads `data.images` and nothing else, so the
public home page — **one of the three states this row re-photographs** — carried ~150px of empty
ground where the gallery section should have been, in every shot taken of it.

#### A4, A6, A7 — the three cheap ones

- **A4** was containment, not spacing. `useLabel` draws a control's label **above** its box, so with
  the heading, the picker and `Add section` sharing one centred row, the word *Kind* landed beside
  the word *Sections* and read as a second heading of the same rank. The header is a column now:
  heading on its own line, then the picker and the button in a row aligned at `flex-end` (they are
  different heights — one is labelled and one is not, and centred puts `Add section` halfway up the
  field beside it).
- **A6**: the card's heading is wired from a derived label rather than from the raw discriminator,
  with the map **derived from `SECTION_KIND_LABELS`** rather than retyped — the same discipline
  `kindItems` already applies, and for the same reason. An unknown kind falls back to the slug, since
  a card headed `undefined` is worse than one headed `richText`.
- **A7**: six `Text` nodes take `as: 'h1'` — one per admin route. It changes nothing visually, which
  is the point: a `Text` renders a `<div>` unless told otherwise, so twelve admin shots recorded
  `headings: []` on screens that visibly had titles. The public site has said `h1`/`h2` since
  SBR-004; the panel a client works in every day never did. **Exactly one per screen**, because two
  is the other way to have no heading structure.

#### ⚠️ What this build does NOT do

- **A3 is untouched.** The judge still has no horizontal reachability metric, and every desktop and
  wide admin shot will still read `unreachable=0` however far off the right edge something sits.
  Owner is unchanged: **phase 81**. It is worth saying that this session's diagnosis was made with a
  throw-away probe in the look harness's `prepare` hook and **not** by adding a measure to `judge()`
  — that would have been building another task's AC.
- **§3 finding 3 — the nav wrapping — is deliberately NOT fixed**, per the row: *"judged not
  fixed"*. It is named for his look below.

#### 🔴 The render caught a regression the first build shipped, and it is the lesson of the session

`flexWrap: 'wrap'` was authored on `/Pages/PageEditor`'s `nameRow` and `/Pages/ThemeEditor`'s
`columns` for one reason: `rowGap` is a **dynamic port gated on `flexDirection = column OR flexWrap
= wrap`** (`group.ts:478`), and both Groups are authored as rows, so without the wrap the stacked
form would have had no gap at all. The gate went green, the manifest read `unreachable=0` at every
width, and the photographs came back with **Title above Slug at 1280 and 1900** and **the live
preview under the fields at 1900** — because two children whose flex-basis is 100% each take their
own line in a wrap container, at every width. The fix had removed the two-up everywhere instead of
restoring it below the fold.

✅ `flexWrap` now moves WITH the direction (`nowrap` above 760, `wrap` below), and an arm pins the
pair. 🔴 **Nothing in the numbers said this**: `unreachablePx` is vertical, `contentBottom` grew by
66px on a page whose text was byte-identical, and the spec arms about `flexDirection` were all true.
**Only looking at the picture said it** — which is the close protocol's rule 4, and it earned its
keep twice in one session.

#### 🟢 Two residuals, BUILT s23 (2026-09-03) — they were registered here first

1. **The theme editor's live preview says *"follow the fields on the left"*** — true at 1900 and
   false at 390, where A9 now stacks the fields ABOVE it. One string, and it should be neutral at
   both widths rather than width-aware.
2. **`/contact-only` draws the words *"Get in touch"* twice** — once as the section's own heading and
   again as the form card's, one above the other. Visible in
   `sbr-005/2026-09-03/site-builder-living/kind-contact-*`.

🟢 **Both are built.** One string each, as recorded, and the second one is a node removed rather
than a word changed:

1. The theme editor's preview note now reads *"The hero band, the type and the corners follow the
   fields you are editing."* — neutral at both widths rather than width-aware. ⚠️ **A width-aware
   string was deliberately NOT built**: it would need a second consumer of A9's breakpoint for one
   sentence, and a sentence that names a direction is a thing to stop saying, not a thing to compute.
2. `/Site/ContactForm`'s fixed `h2` is **gone**. 🔴 **The defect was not "two headings" but "a
   heading the author cannot edit"**: `/Site/ContactSection` already carries a heading slot, wired to
   the record and mounted on `showHeading` (which is `heading !== ''`), so the card's job is the
   fields. A person who types "Get in touch" into the panel — the natural thing — got it twice. A
   contact section left without a heading now shows the card with no title, which is what "no
   heading" asks for.

**Gates**: `typecheck:mcp` **0**; `template:site-builder` exit 0 (`6a4adc05… → 9fb0e5ea…`); full
`noodl-mcp` **92 suites, 1226 passed, exit 0** (1224 + this row's two new arms); `sb007Template`
green, so the committed JSON is byte-identical to what the door writes. The artefact diff is exactly
**one node and one string** — 24 insertions, 42 deletions, and the only `label`/`text`/`as` values
that move are `Contact heading`, `as: h2`, `Get in touch` and the preview note.

🔴 **The claim is pinned by a shared predicate and graded on the reverted source.** A new arm in
`sb006PublicSite.test.ts` says the card holds no `h1`–`h6` and the section holds exactly one, WIRED
rather than authored and `mounted: false` until it has a value. With the heading node put back,
**two arms redden — the claim and SBR-004 AC1's node census — measured, not predicted.** ⚠️ The
mutant beside it deliberately does NOT redden there: it asserts *one more than the card really has*,
so it grades the predicate (`toEqual([])` is also what a matcher that matches nothing returns) and
stays green whatever the artefact does.

🟢 **Both look harnesses were re-run, so AC3's pictures are of the artefact that ships.**
`sbr005-sections` 3/3 exit 0, `vib001-site` 2/2 exit 0, and the two verdict directories are updated
in place (`judge()` keys by `today()`, and the run s22 committed is preserved at `86fcbcc6`).

🔴 **The diff over the pictures is its own control, and it is narrow:** of sbr-005's 36 living
shots, only `kind-contact-*` and `all-five-*-full` moved — every other kind is **byte-identical**,
and the `all-five` VIEWPORT shots did not move because the contact section is below the fold.
`all-five-desktop.txt` differs from the committed one by exactly **one line: `Get in touch`**. On the
vib-001 side, `admin-theme-*` moved by exactly the one sentence, `admin-page-*` and `admin-pages-*`
did not move at all, and the **door arm's PNGs are unchanged** — its manifest differs only in
`headSha` and the ephemeral port. ⚠️ `admin-messages-*` moved too and it is **not** this change:
the seeded enquiries carry a real clock (`3 Sep 2026, 18:27` → `20:15`), which is worth knowing
before reading a future diff of that page as a regression.

#### 🔴 Five literal gates were RED AT HEAD, and four of them were not this phase's

Found by running the editor's two runners while landing the above. **None was caused by these two
fixes** — the baseline was re-measured with the committed artefact copied back over the working one,
and it read the same five.

| gate | read | since |
|---|---|---|
| `tests/cloud/sb017-…acceptance 6` — browser Function nodes | 38 vs **35** | REL-011c s22 (`86fcbcc6`) |
| `tests-unit/sb-007` — disjoint node ids | 401 vs **393** | REL-011b s19 (`3f95a804`), then s22 |
| `tests-unit/sb-018 (3)` — the six named standing `text`s | `/Site/SectionView body` **undefined** | SBR-005, when `SectionView` became a switch that draws nothing |
| `tests-unit/sb-018 (1)` — the row's output ports, and the repeater-wire census | `DropAt`/`DropIndex` and three wires unlisted | **P77 AC2's drag gesture, `12cc718a`, 2026-08-30** |
| `tests-unit/aib-007` — the backend-requirement table is complete | `noodl.cloud.listusersinrole` unclassified | **P80/DEF-005, `ab677258`, 2026-08-31**, and that phase is CLOSED |

All five are fixed with the decomposition measured at each commit rather than inferred. 🔴 **The
lesson is the one SB-017's own header already records four times and nobody had generalised: a
literal count gate only works if somebody runs it, and the two runners that can see these
(`test:main`, `test:ci`) are not the ones a template session reaches for.** `template:site-builder`,
the full `noodl-mcp` suite and both look harnesses are all green with every one of these red.

⚠️ **`sb-018 (3)`'s row is re-pointed, not deleted.** The rule-level arm beside it (*every* `Text`
carries a standing `text`) stayed green through the whole drift, which is exactly why the named list
exists — it says WHICH node lost its parameter, and a row that is deleted instead of re-pointed
cannot say anything.

⚠️ **And a fact about the before-arm that changes what the sbr-005 pictures are of:** the committed
`sbr-005/2026-09-03` run was taken at **`2696c850` (10:14)**, which is *before* REL-011a landed
(`d88368c5`). So the pictures that were on disk showed the site builder with its **25 text inputs
still invisible**, and this run is the first photograph of that fix on the public surface — the
contact form's three fields are drawn for the first time. That is the +66px on every page holding a
contact section, and it is REL-011a's, not this row's.

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

---

## §5 The document outline the site builder never had — BUILT s27 (2026-09-03)

🔴 **Registered by [session 26's handoff](NEXT-SESSION-PROMPT.md) with owner `NONE`, and it was the
strongest buildable candidate left on the board.** REL-002c gave the members' area a document
outline (§8) and then a gate that the landmark *contains* the heading (§8.7, §11). The site-builder
template shipped **26 `as` tags and nothing anywhere held them**, and the sentence in that handoff —
*"it ships 26 `as` tags and nothing holds them there"* — turned out to understate the finding.

### 🔴 The reading that changed the job: seven headings, and nowhere to jump to

Measured on `site-builder.content.json` at `6112e946`, before a line was written:

| | reading at HEAD |
|---|---|
| pages | 7 |
| pages declaring exactly one `h1` | **7 of 7** |
| pages declaring a `main` | **0 of 7** |
| `as` tags in the whole artefact | 26 |
| tags held by an assertion anywhere in the repo | **0 of 26** |

🔴 **This is a harder absence to see than the one REL-002c met, and the reason is that it looks
better.** The members' area measured *0 semantic tags in 100 files*: every instrument agreed, and
the render-time reading (0 of 60 shots carrying an `h1`) said so too. Here every page already had
its heading — a census of headings reads perfect, a picture reads identical either way, and the
thing that is missing is the region a screen-reader user jumps to in order to skip the rail. **The
closer an outline gets to complete, the fewer instruments can see what is still missing from it.**

### The fix — a parameter on six pages, a node on one

The six admin screens each hang a single content column off `/Admin/Shell` (or, at the two doors,
straight off the `Page`), and that column already held the heading and nothing else — no band, no
foot, no rail. So the landmark goes onto the column that is there: `as: 'main'` on `body`/`shell` in
`PAGE_EDITOR_NODES`, `THEME_EDITOR_NODES`, `MESSAGES_NODES`, `ADMIN_NODES`, `SIGN_IN_NODES` and
`SETUP_NODES`.

🔴 **`/Pages/Site` could not take the parameter, and that is the whole of §12.4.** Its `shell` holds
`nav`, `header`, `sectionList`, `notFoundCard` and `footer` — a `main` on it would announce the site
navigation and the colophon as the page's content. So `siteMain` is a **node**, wrapping the middle
three, and `shell` keeps `['nav', 'siteMain', 'footer']`.

`/Admin/Shell`'s rail took `as: 'nav'` at the same time, and it is a **control as much as markup**:
an assertion that a heading is *inside* a landmark means nothing unless something in the same
document is deliberately outside it.

**400 → 401 nodes, 553 connections both sides, 26 → 34 tags, 33 components both sides.**

### The gate — §12 of `sb007Template.test.ts`, nine specs

| spec | what it holds |
|---|---|
| §12.1 | seven pages, each with exactly one `h1` |
| §12.2 | each with exactly one `main` |
| §12.3 | the `h1` is **inside** the `main` — a real walk, not a same-parent check |
| §12.4 | no page puts its navigation inside its `main`, written over instance **types** (both nav-bearing components are placed as instances, so the nav is never a node in the page's own graph) — plus the five pages that place one, named, so the sweep cannot silently empty |
| §12.5 | no node carries an `as` its type has no port for (`Group` and `Text` are the only two that have one) |
| §12.6 | CONTROL — the census reads the `as` **parameter**, not an id that looks like one |
| §12.7 | CONTROL — containment is a real walk, at both depths and in both directions |
| §12 MUTANT ①| the template exactly as it shipped: every `as: 'main'` stripped. §12.2 and §12.3 redden; §12.1, §12.5 and §12.4's swallow sweep stay **green** |
| §12 MUTANT ②| the shortcut fix: the landmark moved up onto `/Pages/Site`'s `shell`. §12.1, §12.2 and §12.3 **all pass**, and §12.4 is the only assertion that can see it |

🔴 **The two mutants are the point of the block.** The first is the reverted arm run from inside the
same suite — it says what the old artefact *did* satisfy, which is why nothing caught it. The second
is the cheap fix a later session would reach for, and it passes every census in this file.

### ⚠️ A literal census in a second file had to move, and that is the gate working

`sb006PublicSite.test.ts`'s SBR-004 AC1 spec lists **every box its cross-component walk reaches, in
walk order**, so a new node reds it until somebody names the node. `Pages/Site | The page` was
added with the reason it exists — and its `growing` half stayed empty, because `siteMain` is
`contentHeight`: a `Group` authored without a `sizeMode` is `explicit` at `height: 100%`, which a
column parent turns into `flex-grow: 100`, and `Page ground`'s `minHeight: 100vh` is exactly the
ancestor slack that would then be shared into it.

### The readings

| gate | reading |
|---|---|
| `sb007Template.test.ts` | **71/71, EXIT=0** (62 before §12's nine) |
| `noodl-mcp` full jest | **92 suites / 1242 tests, EXIT=0** |
| `tsc --noEmit -p packages/noodl-mcp` | **0 errors, EXIT=0** |
| `sb008-public-site-drive.test.ts` (real backend + browser) | **24/24, EXIT=0** (20 before §6's four) |
| `vib001-site.look.ts` | **EXIT=0, 2/2, 40 shots** |

### 🟢 The browser half — §6 of `sb008-public-site-drive.test.ts`, and its reverted arm

**A parameter is an intention.** §12 asserts what was *authored*; nothing in it says the runtime
turns `as: 'main'` on a `Group` into a `<main>` element, or that the node tree and the element tree
agree — and both were assumed by the change. §6 takes the same claim one layer down, on the four
page loads this drive already makes against a real backend, and costs one `evaluate` per visit.

| reading, per page load | reverted arm (`as: 'main'` stripped) | HEAD |
|---|---|---|
| loads with exactly one `<main>` and one `<h1>` | **0 of 4** | **4 of 4** |
| loads whose `<h1>` is inside their `<main>` | **0 of 4** | **4 of 4** |
| loads with a `<nav>` in the document | 4 of 4 | 4 of 4 |
| `<nav>` inside the `<main>` | 0 | 0 |

🔴 **The third row is what makes the first two mean anything.** The nav band is the thing
deliberately outside `siteMain` and it is in the same document: without it, a probe that answered
*"inside"* for the whole document would pass §6 on every page ever written, and *"0 mains"* in the
reverted arm would be indistinguishable from a probe that sees nothing at all.

⚠️ **The reverted arm's exit code needed reading from a file.** The background task's completion
notice said *"exit code 0"* while the run's own exit file said **1** — that 1 was the entire result
of the run. That is the wrapper's status, not the command's, and it has now misreported twice
(s26's mutant drive, and this).

### 🖼️ The pictures — 192 of 200 identical, and the eight that moved are a clock

`vib001-site.look.ts` re-run at HEAD-of-worktree and compared file by file against the committed
`vib-001/2026-09-03` tree (snapshotted to scratchpad first, because `judge()` keys by `today()` and
overwrites in place):

| | reading |
|---|---|
| PNGs byte-identical | **192 of 200** |
| PNGs differing | **8** — every one an `admin-messages` shot |
| text dumps byte-identical | **96 of 100** |
| the difference, in full | `3 Sep 2026, 20:15` → `3 Sep 2026, 23:07` |

The eight are the four viewports × full/viewport of `/admin/messages`, which prints the time the
drive's own contact-form message was submitted. **The change is visually inert**, which is the
expected result and is exactly why a picture is the wrong instrument for a landmark and §6 is the
right one.

🔴 **`artefactMd5` is NOT the pin here, and reading it as one would have been the trap.** It hashes
`nodegx.project.json` alone — one file — and it moved on the *living* run (which binds a randomly
allocated backend port into that file) while staying **identical** on the *door* run, whose graphs
changed just as much. What actually excludes the stale-artefact explanation is the code path:
`authorSiteTemplate` writes `SB006_COMPONENTS` and `SB005_COMPONENTS` through the MCP door **at run
time**, so the harness cannot have photographed graphs other than the ones on disk when it ran.

⚠️ The baseline tree was written at `1784396c`; the five commits between it and `6112e946` are the
members' area and documentation, and none of them touches this template — checked, not assumed.

### ⬅️ What this does NOT do — owner `NONE`

1. **No drive grades the six admin screens' rendered outline.** §6's four loads are all the public
   catch-all. What carries across is the *mechanism* — `as: 'main'` renders a `<main>`, and a child
   node renders inside it — and per-page authoring is §12's job. Covering them would mean touching
   `sbr010-messages-drive`, `sbr009ThemeEditorDrive` and `ac2-page-editor-drag-drive`.
2. **`<h2>` order is unchecked in both templates.** Every section kind carries one, but nothing
   asserts that a page's headings descend without skipping a level.
3. **No other template has an outline gate.** The members' area and the site builder now have one
   each; anything the shelf grows next starts at zero again, and neither gate is general.

---

## §6 The admin panel's outline, RENDERED — BUILT s28 (2026-09-04)

§5 gave the template a document outline and gated it two ways: `sb007Template` §12 on the `as`
parameters **on disk**, and `sb008-public-site-drive` §6 on what the browser builds — for the four
**public** loads. This section is the half §5 explicitly left with owner `NONE`: the six admin
screens, whose landmark is a parameter on a column they already had, and which **no drive in this
repository had ever opened and looked at**.

### 🔴 The absence, measured before a line was written

A repo-wide sweep for anything that reads a rendered `<main>` (`querySelector`/`querySelectorAll`)
returns **exactly two files**: `sb008-public-site-drive.test.ts` and `tpl001-members-drive.test.ts`
— the public site and the members' area. The three drives that actually load an admin screen —
`sbr010-messages-drive`, `sbr009ThemeEditorDrive`, `ac2-page-editor-drag-drive` — matched **nothing**
for `main`, `h1`, `nav`, `landmark` or `outline`.

⚠️ The sweep was run against `sb008` as a **known-firing control** before its absence on the other
three was believed: the same pattern, the same command, one file known to contain the thing.

The artefact itself: `sb005Components.ts` carries **13 `as` tags — 6 `main`, 6 `h1`, 1 `nav`** — one
landmark and one heading on each of the six screens, plus the rail on `/Admin/Shell`.

### The instrument, and why it is a module rather than a copy

s27 wrote the reading inline in `sb008`. The moment a second drive wanted it, the repo was one
copy-paste from two probes that answer slightly different questions and disagree without anybody
noticing. **`packages/noodl-mcp/tests/documentOutline.ts`** is now the single copy — the expression,
the `Landmarks` type, a `NO_LANDMARKS` sentinel, `outlineFault()` and `stripOutlineTags()` for
reverted arms. `sb008` §6 was refactored onto it and its numbers are unchanged.

It lives in `noodl-mcp/tests` because that is the direction the dependency already runs: the backend
drives import `sb005Components` from there, and the MCP-side drive can reach it without dragging
`BackendService` across.

🔴 **`NO_LANDMARKS` is `-1`, not `0`, and that is the point.** Zeroes are exactly what a *reverted*
arm is supposed to read. An arm that silently never ran would leave zeroes too — and would pass as a
working negative control **by not happening**.

### 🔴 The instrument is itself graded, without a browser

`documentOutline.test.ts` — **11 specs, 0.3 s**. `READ_LANDMARKS` is a *string*; nothing typechecks
it, and a typo inside it surfaces 118 seconds away as a thrown `Runtime.evaluate` blamed on the page.
So the expression is **executed** against a hand-built stub `document`, which grades the two pieces of
logic that can silently be wrong:

| the probe must… | the wrong probe that would pass without it |
|---|---|
| refuse to answer *"inside"* when there is more than one `<main>` | reports a tidy `1` for a document that is already malformed |
| ask the `<main>`, not the document, what is inside it | passes on a page whose `<h1>` sits OUTSIDE the `<main>` — REL-011c's shortcut fix exactly |

It also typechecks `stripOutlineTags` against the real `fs` and `path.join`, which matters because
the two backend drives that call it live in a package whose test typecheck **cannot complete on this
box**.

### What was built, and what it reads

| gate | screens | reading at HEAD | reverted arm |
|---|---|---|---|
| `sbr010-messages-drive` **§7** (5 specs) | `/admin/signin`, `/admin/pages`, `/admin/messages`, **each twice** — empty collection and with rows | **6 of 6** loads: one `<main>`, one `<h1>`, the `<h1>` inside it | **0 of 3**: no `<main>`, no `<h1>`, no `<nav>` |
| `sbr009ThemeEditorDrive` **§4** (4 specs) | `/admin/theme` | 1 `<main>`, 1 `<h1>`, inside | 0 / 0 / 0 |

Both reverted arms strip **13 of 13** tags (asserted exactly — *a strip that matched nothing would
leave the arm reading a good outline and be scored as "the instrument cannot see the defect": the
same numbers, the opposite conclusion*).

### 🔴 The negative control, and the one screen that inverts it

`h1sInMain === 1` proves nothing on its own — a probe answering *"inside"* for the whole document
gives the same answer on every page ever written. `/Admin/Shell`'s rail is the thing deliberately
outside the content column, **in the same document**:

| load | `<nav>` in document | `<nav>` in `<main>` |
|---|---|---|
| `/admin/pages`, `/admin/messages`, `/admin/theme` | **1** | **0** |
| `/admin/signin` | **0** | 0 |

⚠️ **`/admin/signin` is asserted the other way round on purpose.** Nobody has a rail before they
sign in, so it is the reading that says the control tracks *the document it is in* rather than the
template as a whole. It was recorded before it was asserted, then asserted as an invariant.

### 🔴 What this run also found: a drive that was RED at HEAD, and why

`sbr010-messages-drive` **failed on the first run of this session**, and not on anything §7 touched:

```
D42: the one public endpoint stores each enquiry exactly ONCE
  expect(contactSteps.filter((st) => st.endsWith('#pick'))).toHaveLength(1)   →   0
```

The step list had `JavaScriptFunction#pick-2` where the spec pinned `#pick`. Traced to the artefact
on disk rather than guessed:

1. **The MCP door enforces node ids unique across the WHOLE PROJECT** (`graph.ts:186`) and suffixes
   the loser of a collision in authoring order. The artefact shows the pattern everywhere:
   `req`/`req-2`/`req-3`/`req-4`/`req-5` across the five cloud functions, `save`/`save-2`/`save-3`.
2. `authorSiteTemplate` writes the SB-005 panel **before** the SB-004 cloud half.
3. Commit **`3f95a804`** (2026-09-03, REL-011b's D54 fix) added a node with `id: 'pick'` to
   **`/Admin/PresetChip`** — a preset chip, with no relationship to the contact form whatsoever.
4. It took the name, and `__cloud__/site/ContactRecipient`'s `pick` shipped as **`pick-2`**.

🔴 **A node id added to one component silently renamed a node in an unrelated one, and the only
thing in the repository that noticed was a literal in a drive nobody had re-run.** The fix here is
*not* to pin `#pick-2` — that is the same fragility with a fresh literal. `D42` now matches the id
**base** (`stepBase` strips a trailing `-<digits>`), which is stable under the collision numbering
and preserves the assertion's meaning. Verified against **both** recorded step lists — the Sep 2 one
(`#pick`) and today's (`#pick-2`) — so the repair is not tuned to the reading that provoked it.

The door's behaviour is **not changed here** and is registered below as a product question.

### The readings, with their exit statuses

⚠️ Every one gated on an **exit file written by the run itself**. The task-completion notice
reported *"exit code 0"* for a drive that was still executing — the wrapper's status, not the
command's, now misreported across four sessions running.

| gate | reading |
|---|---|
| `documentOutline.test.ts` | **11/11, EXIT=0** (new) |
| `sbr010-messages-drive.test.ts` | **22/22, EXIT=0** — 17 before §7's five |
| `sbr009ThemeEditorDrive.test.ts` | **13/13, EXIT=0** — 9 before §4's four |
| `sb008-public-site-drive.test.ts` | **24/24, EXIT=0** — unchanged, which is the refactor's control |
| `noodl-mcp` full jest | **93 suites / 1257 tests, EXIT=0** |
| `tsc --noEmit -p packages/noodl-mcp` | **0 errors, EXIT=0** — `--listFiles` confirms both new files are in the program |

🔴 **`tsc -p packages/nodegx-backend` is NOT a reading of anything this session changed.** Its
`include` is `src/**/*` and it *excludes* `**/*.test.ts`: it returned EXIT=0 having typechecked none
of the edited files. `typecheck:backend-tests` is the config that covers them and it **could not
complete** — EXIT=**134** (OOM) at a 3 GB heap with **0 `error TS` in the log**, which reads exactly
like a pass, and a timeout with **no exit file at all** at 5 GB. CI runs it; this box cannot.
✅ **Neither editor suite was run, and neither needed to be**: no editor source, no template
component and no node-count literal was touched, and the editor's webpack provably does not reach
`noodl-mcp` — nothing under `packages/noodl-editor/src` imports it as a module (only string paths to
the built server), so the `nodegx-export` sibling-typecheck hazard does not apply.

### ⬅️ What this does NOT do — owner `NONE`

1. **Two of the six admin screens are still ungraded at render time**: `/Pages/PageEditor` and
   `/Pages/Setup`. `/Pages/Setup` has **no drive that loads it at all** — the site is claimed over
   HTTP before any browser opens, so reaching it needs a new arm, not a rider. `/Pages/PageEditor` is
   blocked, and that is the next finding.
2. **The door's project-wide id renaming is unexamined as a product question.** Silently renaming a
   node in component A because component B later used the name is defensible for uniqueness and
   indefensible for anything that refers to a node by id. Nobody has asked which it should be.
3. **`<h2>` order is still unchecked in both templates** (carried from §5).
4. **Neither outline gate is general** (carried from §5) — but `documentOutline.ts` is now the shared
   instrument the next template would use, which is the part that was missing.

### 🔴 `ac2-page-editor-drag-drive` is RED at HEAD — measured at last, and it is 23 of 23

Carried unmeasured since s23 as *"judged not worth a drive, **not** measured"*. It was run this
session, once, as a baseline before adding anything to it — and it does not reach a single
assertion:

| | reading |
|---|---|
| result | **23 failed, 23 total — EXIT=1**, 119 s |
| where | `beforeAll`, in the `setParams` mutant-setup helper (line 309) |
| the assertion | `defect restored was:…,runOnChange-in-image=false` vs received `…=undefined` |

🔴 **The drive is stale; the template is not.** `setParams` finds the node by **label** and asserts
its three `runOnChange` keys are present-and-false before flipping them. Two of the three are on the
node it names; the third is not, and has not been since the picture handling was split out:

| node in `Admin/SectionRow` | label | its `runOnChange` keys |
|---|---|---|
| `merge` | *Fold the edits back into data* | `in-data`, `in-body`, `in-heading`, `in-linkLabel`, `in-linkTarget` |
| `absorb` | *Fold an uploaded picture into this section* | `in-data`, `in-kind`, **`in-image`** |

- `ac2-page-editor-drag-drive.test.ts` last changed **2026-08-30** (`505d9b381`).
- `absorb` was added **2026-09-01** by `bc012147` (SBR-009), taking the image input with it.
- Nothing re-ran the drive in the three days and five sessions between, so its arm has pointed at a
  node that no longer carries the key it asserts ever since.

⚠️ **This is why `/Pages/PageEditor`'s outline is not covered by this session.** The capture would
have ridden this drive's page loads, and a `beforeAll` that throws means no arm runs at all — the
reading would have been the never-ran sentinel, or worse, silently absent. **Fixing the drive is a
P77/AC2 job, not a rider on an outline task**: only the mutant's precondition is diagnosed here, and
the other 22 specs have never been observed passing in this tree, so the cost of repairing it is
unknown rather than small. **Owner: `NONE`.**

🔴 **The transferable half: a drive nobody runs decays against the artefact it drives, and its decay
is invisible.** Both the `#pick` literal above and this mutant broke because an *unrelated,
correct* change moved something they name. Neither template was wrong; both gates were, and each
had been wrong for days behind a green board.
