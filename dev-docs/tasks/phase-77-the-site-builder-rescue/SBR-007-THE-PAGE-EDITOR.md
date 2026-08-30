# SBR-007 — The page editor

**Fixes finding 4 where it hurts most.** Screen 3 — the screen a client spends their time in,
and the one carrying the deploy damage (SBR-008 owns that fix; this task owns the screen).

## 1. The person sentence

**A client can retitle a page, reorder its sections by dragging, add a gallery image by
dropping a file, and save — and see the publish state while doing it.**

## 2. Scope

- **Fields in a card, labelled, grouped** — Title + Slug two-up; SEO description; Nav order +
  Show-in-navigation together. Today: five stacked unlabelled inputs.
- **Header row** — "Editing · <title>", status pill, Preview, Save. Publish state visible while
  editing.
- **Section list, readable** — each row: title, kind (and image count for galleries), Edit.
  "Add section" opens the kind picker.
- **Drag to reorder** — `order` is already on the record and nothing can change it. Writing
  order on drop; the public site renders the new order.
- **Image upload** — works today via `POST /files/:name`; needs a drop target and a thumbnail
  (and multi-image authoring for galleries, shared with SBR-005's model change).
- **Preview** — opens the public page (draft preview for the owner; the dev-open twin from
  SB-008 showed the same draft renders for an authorised viewer).

## 3. Acceptance criteria

1. **(person)** In preview (pre-deploy), the full loop: retitle → save → public site shows the
   new title. On the **deployed** panel, the same loop — this half lands when SBR-008 does;
   until then it is ⬜ blocked, recorded, and not rounded off.
2. **(person)** Dragging a section from position 3 to 1 and saving changes the rendered order
   for a visitor.
3. **(person)** Dropping an image file onto the gallery editor uploads it and shows a
   thumbnail; the public gallery gains it on save.
4. Every field save round-trips through the record (assert the stored row, not the input's
   echo).
5. Unsaved-changes state is visible (Save enabled/disabled or a dirty marker) — a small thing
   the mockup implies and clients rely on.

## 4. Traps

- 🔴 This screen owns 13 of the 19 dropped `prop-` wires — do not "fix" any of them here by
  re-typing parameters; SBR-008 is the fix and the census spec is the meter.
- 🔴 Drag-and-drop in the viewer: verify the pointer events the runtime's nodes actually
  support before designing on hover/drag affordances; drive with CDP input (focus emulation on
  the same connection).
- 🔴 The input queue drain order was an accident once (P75) — sequencing save-then-requery by
  wire order is not a guarantee; sequence on `done` signals.

---

# 🟢 s21 (2026-08-29) — the screen is rebuilt; AC2 and AC3 are re-measured and one of them is blocked

## 5. What the task file had wrong, measured before building

🔴 **§2's first bullet — *"Today: five stacked unlabelled inputs"* — was stale.** All five already
carried `useLabel: true` with real labels, in the generator *and* in the shipped artefact. What was
true is that they were **ungrouped**: five controls stacked directly in one column with no card, no
pairing, and `Save` sitting below them and above the section list, so on a page with sections the
save button was off-screen while editing.

⚠️ The rest of §2 was accurate. The lesson is the standing one — the task file is a record of a
reading taken once, and the artefact is the thing.

## 6. 🔴 The defect nobody had listed: this screen did not wear the admin shell

Recorded in full as **[D17](DEFECTS-THE-SITE-BUILDER-FOUND.md)**. SBR-006 put "Theme and settings"
into a permanent sidebar *"on every admin screen"*; `/Pages/PageEditor` was the one admin page that
never placed `/Admin/Shell`, so the rail, the theme link and `Sign out` **disappeared on the screen
this task's person sentence is about** and came back when the client left it.

🔴 **`sb005AdminPanel.test.ts`'s AC5 case pinned the placements at exactly
`['Pages/Admin', 'Pages/ThemeEditor']` and was green the whole time — the gate asserted the defect.**

## 7. What was built

Placing `/Admin/Shell` (`active: 'pages'`), then inside it:

- **A header row** — `Editing · <title>` (a `headline` function, so an untitled page reads
  "Editing · Untitled page" rather than a dangling separator), the draft/published **pill** wired
  from the same three-output `status` function `/Admin/PageRow` uses, an **unsaved-changes marker**,
  **Preview**, and **Save** — moved up out of the middle of the form.
- **A card** — Title + Slug two-up, SEO description, then Nav order + Show-in-navigation together.
- **A sections panel** — a "Sections" heading beside the kind picker and Add button, and the rows
  themselves rebuilt as cards.
- **Preview** — a `RouterNavigate` at `/Pages/Site` with `pm-slug` from the **record**, not the
  field: previewing a slug that has only been typed would open a page that does not exist.
  (SBR-006's `8661ce83` was this exact defect on "View site".)

### 🔴 Acceptance 5 is a comparison, and a `States` node would have been wrong

The obvious build is `States(Clean,Dirty)` driven by each field's `textChanged` signal, cleared on
`save.done`. It does not work, and the reason is in the runtime rather than in taste:
`startValue.set` calls `setText`, `setText` flags `onTextChanged`, and `onTextChanged`'s `onChange`
fires the **`textChanged` signal** (`text-input.ts:272`). **The record merely loading marks the form
dirty**, and the only repair is landing a `to-Clean` after five `to-Dirty`s that arrive in the same
pass — i.e. sequencing on drain order, which is exactly what this task's own third trap says is not
a guarantee.

So `dirty` compares the record's five loaded values against the five controls' current values. It is
order-independent, and it is *more correct*: typing a character and typing it back out again leaves
the form clean, which no signal counter can do. `save.done → record.fetch` re-reads the row, which
both clears the marker and makes **AC4** true by construction — the screen shows the stored row, not
the input's echo.

## 8. AC2 and AC3 — the runtime capability check the traps asked for, done first

**AC2 (drag to reorder) — buildable, not built, and more expensive than it looks.** `visual/drag.ts`
gives `Drag Started/Moved/Ended` and `Drag X/Y`, `Delta X/Y`. It reports **no drop target and no hit
test**, so the row index is arithmetic the author must do. The harder half is the write: reordering
means renumbering *siblings*, a `SectionRow` knows only its own id, and there is no loop node —
phase 78 already measured `Send Email` fanning out serially for want of one. It needs a cloud
function that takes (pageId, id, toIndex) and renumbers, which is a design decision, not an
afternoon.

**AC3 (drop an image, get a thumbnail) — ⚠️ the AC is three things and they have three different
verdicts:**

| half | verdict |
|---|---|
| a thumbnail after upload | 🟢 **already shipped** — `/Admin/SectionRow` has had picker → `Upload File` → `merge` → `Image` preview all along. The next-session prompt's *"untouched"* was wrong about this |
| the **drop** gesture | 🔴 **not buildable — [D15](DEFECTS-THE-SITE-BUILDER-FOUND.md)**. The runtime has **zero** drop-target API (`onDrop`/`dataTransfer`/`dragover`/`dragenter`: 0 hits against a 39-hit `onClick` control). Needs a new viewer node. Unowned |
| multi-image galleries | ⬜ **SBR-005's**, explicitly — a gallery is one image today and §2 says the model change is shared with that task |

## 9. Where the ACs stand

| | verdict |
|---|---|
| **AC1** | 🟡 the screen is built and the save path is wired; **not driven** — the retitle → save → public-site loop is the first job next |
| **AC2** | ⬜ **not built.** Runtime capability confirmed present but partial; the renumbering half needs a cloud function and a decision |
| **AC3** | 🟡 thumbnail half already shipped · 🔴 drop gesture blocked on **D15** · ⬜ gallery model is SBR-005's |
| **AC4** | 🟢 built by construction (`save.done → record.fetch`); shares AC1's drive |
| **AC5** | 🟢 **built** — the comparison above, `mounted` not `visible` |

## 10. Gates

- **`test:ci` 2894 specs, 4 failures, all four `AIX-006 style vocabulary` by name** — the documented
  floor. Fresh readout, seed 65644. ⚠️ The first run read **5**: `sb017-deploy-connection-parity`'s
  browser-Function literal was 20 and is now 23. Its own header says a stale count *"sat red for a
  whole session because s9 never ran `test:ci`"* — this time the session that moved it ran it.
- `noodl-mcp` **958/958** (69 suites), `typecheck:mcp` clean, editor `tests-unit/sb-017` + `sb-018`
  **32/32**.
- 🔴 **Four pinned censuses moved and every one was grown as arithmetic, not replaced by a new
  constant** — so a number that moves for any *other* reason still reddens. The one that matters is
  in `the-browser-half-drops-every-record-field`: the population went **19 → 27** `record.prop-*`
  wires (the eight this screen added) and **`unresolvedWires()` is still `[]`** — SBR-008's fix
  covers the new ones, so this screen did not re-open that defect.

## 11. 🔴 What the appearance ratchet does and does not prove — [D16](DEFECTS-THE-SITE-BUILDER-FOUND.md)

`/Pages/PageEditor` was **the only bare page left in site-builder** at HEAD; the other three names in
`BARE_PAGES_TODAY` had been paid by SBR-006/SBR-002 without anyone shrinking the list. It is now 0,
and the allowance is tightened to `[]`.

⚠️ **But §4 would have said that for the shell placement alone.** `barePages()` walks the transitive
closure of placed components, and `/Admin/Shell` carries `backgroundColor` — sabotage confirms the
page reads "styled" with **every one of its own structure parameters stripped**. So the evidence
this screen is designed is the count in its **own** tree: **0 → 9** structure parameters. §4 is not
that evidence and is not cited as it.

---

# 🟢 s22 (2026-08-29) — the drive: AC1, AC4 and AC5 are met on a person's screen; one new defect the drive found

**Fixture: `SBR-007 Page Editor Drive`**, minted through the launcher's own template flow from the
artefact at `7a156972`, backend **`backend_mterfnli74qwv`** on port **8601**, functions secret
`SITE_SETUP_TOKEN=drive-token-007`, owner `owner@sbr007.test` / `drive-pass-007`. A fresh mint for
the standing reason: a project is a copy of the template *at mint time*, and s21's screen only
exists in projects minted after it.

Verified on disk before driving anything: `components/Pages/PageEditor/nodes.json` contains
`/Admin/Shell`, so the fixture carries s21's build rather than the pre-s21 screen.

## 12. The sequence, and what each act answered

| # | act | reading |
|---|---|---|
| 1 | claim through `/admin/setup` | lands on `/admin/pages`, `No pages yet. Use New page to make your first one.` |
| 2 | create `Original Title` / `drive-007` | row renders **titled and slugged** — SBR-008's fix, on a fresh mint |
| 3 | **Publish** from the overflow menu | 🟢 **`One page, one published`**, row reads `Published` — **D14 driven** |
| 4 | **Duplicate** | 🟢 `Two pages, one published`, `Copy of Original Title` / `drive-007-copy-ogsb33` — **D14 driven** |
| 5 | public `/drive-007` | `<h1>` **`Original Title`** at y=153, 36px/700 — **AC1's control** |
| 6 | open the page editor | the rail is **present**, `Pages` lit; header `Editing · Original Title`, `Published` pill, `Preview`, `Save page`; **no unsaved marker** |
| 7 | type one character | **`Unsaved changes` appears** |
| 8 | type it back out | **`Unsaved changes` disappears** ← the reading a `States` counter cannot produce |
| 9 | retitle to `Retitled By The Drive`, **Save** | `PUT /classes/Page/<id>` then `GET /classes/Page/<id>`; header flips to `Editing · Retitled By The Drive`, marker clears |
| 10 | public `/drive-007` | `<h1>` **`Retitled By The Drive`**, same element, same position — **AC1** |
| 11 | **Preview** button from the editor | lands on `/drive-007`, the **real slug**, and the page renders |
| 12 | **sign out**, then public `/drive-007` | a real visitor sees `Retitled By The Drive` — and the draft copy is **gone** from the nav |

### 12.1 AC1 — met in preview, and the strongest arm is the signed-out one

Steps 5 and 10 are a control pair on one page in one session with **one variable**: the title. Same
`<h1 class="ndl-visual-text">`, same y=153, same 36px/700 — `Original Title` before the save,
`Retitled By The Drive` after it.

⚠️ **SBR-016 §8.4's trap was live here**: the site's own nav lists the page by title, so
`body.innerText.includes(...)` would have passed at the public URL *before anything was driven*. The
oracle is the **36px heading element**, which only the page body produces.

✅ **Step 12 is the better reading and it is the one the person sentence asks for**: signed out, with
no session at all, a visitor at `/drive-007` gets the new title. Steps 5–10 were taken as the owner.

🔴 **AC1's deployed half is still owed** and is now *unblocked* rather than blocked: its blocker was
SBR-008, which closed at s18. It was not attempted this session because the peer holding `test:ci`
needed the editor back. Nothing else stands in its way.

### 12.2 AC4 — no longer "by construction"; the round trip was watched

The save is **two requests, in order**: `PUT /classes/Page/<id>` then `GET /classes/Page/<id>`.
That is `save.done → record.fetch`, and the consequence is observable rather than inferred: while
the input read `Retitled By The Drive` and the record still read `Original Title`, the header —
which is fed from the **record** — still said `Editing · Original Title`. It changed only after the
`GET`. **The screen shows the stored row, not the input's echo.**

### 12.3 AC5 — three states, and the third one is the point

| state | `Unsaved changes` |
|---|---|
| on load, record just fetched | **absent** |
| after typing one character | **present** |
| after typing that character back out | **absent** |
| after `Save page` | **absent** |

The third row is what §7 promised and what the rejected `States(Clean,Dirty)` build could not have
produced: a signal counter that has seen two `textChanged`s cannot know the form is back where it
started. The first row is the guard against `startValue.set → setText → textChanged` marking a
merely-*loading* form dirty; it was re-read on three separate cold arrivals and was absent each time.

### 12.4 D17 — the rail, measured rather than eyeballed

On `/admin/page/<id>`, with the shell placed `active: 'pages'`:

| rail item | x | y | colour | weight |
|---|---|---|---|---|
| `Pages` | 16 | 65 | **`rgb(30,77,140)`** = `--primary` | **600** |
| `Theme & settings` | 16 | 96 | `rgb(27,26,23)` | 400 |
| `Messages` | 16 | 127 | `rgb(27,26,23)` | 400 |

Stacked, and `active: 'pages'` is **lit, not dark** — the same shape as SBR-006 AC5's control pair.
Screenshot: `notes/sbr007-page-editor-driven.png`.

### 12.5 The draft in the public nav was ACL, not a leak — and only the signed-out arm could say so

Signed in as the owner, the public nav listed **both** pages, including the unpublished
`Copy of Original Title`. The nav query is `where {"showInNav": {"$eq": true}}` with **no
`published` filter**, so the query alone cannot explain the difference. Signed out, the draft is
**absent**: the published row's ACL grants `"*": {"read": true}` and the draft's does not.

⚠️ Recorded because the query is the wrong place to look for the guarantee. The nav is protected by
row ACLs; a future change that widens a draft's ACL puts it in the public nav with no query to stop
it.

## 13. 🔴 D14 is driven — five steps, all `success`, at the node that used to throw

`publishPage` **success, 25 ms**, and `duplicatePage` **success, 23 ms**, on `backend_mterfnli74qwv`
with `claimSite` (55 ms) as the same-backend control. `execution_steps` for the publish:

```
0  JavaScriptFunction    success  2ms   {"outcome":"done"}   ← the node that threw `Outputs.ready is not a function`
1  JavaScriptFunction    success  6ms   {"outcome":"done"}
2  RunTasks              success  1ms   {"outcome":"done"}
3  SetDbModelProperties  success  8ms   {"outcome":"done"}
4  noodl.cloud.response  success  1ms   {"outcome":"done"}
```

Step 0 is the gate that held the request until its parameters arrived — the **first** node of the
function, and the exact one that threw in SBR-006 §5.12. It now returns `done`. s20's fix is real
in the app and not only in a spec pair.

⚠️ **Scope**: this is the *editor preview* deploy path. The `ports: []` exposure on the **browser**
deploy path (`build/deployer.ts`), recorded at the end of D14, is untouched and still unowned.

## 14. 🔴 What the drive found that nobody had listed — [D18](DEFECTS-THE-SITE-BUILDER-FOUND.md)

**The header row this task built does not fit, and below 897px the `Save page` button cannot be
reached at all.** Measured on the driven screen with `elementFromPoint`, sweeping the viewport:

| viewport | `Save page` visible | hit test | horizontal scroll available |
|---|---|---|---|
| 1440 | 104 / 104 px | ✅ SELF | 0 |
| 1024 | 104 / 104 | ✅ SELF | 0 |
| **988** (this phase's driving width) | **91 / 104** — clipped | ✅ SELF | **0** |
| **800** | **0** | 🔴 **none** | **0** |
| **600** | **0** (and `Preview` too) | 🔴 **none** | **0** |

The row's right edge is pinned at **1001 px at every viewport**, while `#root` tracks the viewport
exactly (1440 / 988 / 600) — that control is what makes the fixed 1001 mean something rather than
being a resize the runtime had not processed. `document.scrollWidth === innerWidth` at every width,
so **there is no horizontal scroll that reaches the button**.

⚠️ **Honest about severity**: at 988 the label is still readable and the button still clicks, which
is why AC1 was driveable. The failure is below 1001 px, and it is total below 897.

✅ **Two controls place the blame on this row and not on the shell**: `/admin/pages` row buttons
(`Edit`, `More`) *do* track the viewport — 1336 → 884 → 496 — and `/admin/theme`'s `Save theme` is
left-anchored at 384 and fine at every width. It is this screen's header row alone.

## 15. Where the ACs stand after the drive

| | verdict |
|---|---|
| **AC1** | 🟢 **preview half MET and DRIVEN**, signed-out · ⬜ **deployed half owed** — now unblocked (SBR-008 closed s18), not attempted |
| **AC2** | 🟢 **outcome BUILT + DRIVEN s27** (§31) — `reorderSection` renumbers siblings and the stored order moves · ⬜ the **drag gesture** is still not built, but s29 **DISPROVED D23**: the geometry was always on the wire (§32), so this is authoring work, not a missing capability |
| **AC3** | 🟡 thumbnail shipped (source-measured, **not driven** — needs an OS file dialog) · 🔴 drop gesture blocked on **D15** · ⬜ gallery model is SBR-005's |
| **AC4** | 🟢 **MET and DRIVEN** — `PUT` then `GET`, and the header proves the record won (§12.2) |
| **AC5** | 🟢 **MET and DRIVEN** — three states including the undo (§12.3) |
| **new** | 🟢 **D18** — fixed s23 in the template (§17), 🔴 **not yet driven** (§18) |

## 16. 🔴 The session's own error, kept because it nearly became a finding

Between the control reading and every later one, **the instrument changed and nothing else was held
constant.** The control dumped `document.querySelectorAll('div,span,h1,h2,h3,a')`; the later dumps
were written as `('div,span')` and `('div,span,a')`. The page's title is an `<h1>`, so it vanished
from four consecutive readings and the note being drafted was *"the heading disappears after the
Preview click"* — a plausible defect with a plausible mechanism (`RouterNavigate` with a `pm-slug`
parameter versus a slug in the URL path, which is exactly SBR-004 §10.3's family).

It was caught by a probe that names **no selectors at all** — `querySelectorAll('*')` filtered on
computed `font-size` — which found the `<h1>` present the whole time.

**The rule this pays for: a control pair proves what you varied, and the instrument is a variable.**
The arrival route was the variable I *intended* to test; the selector list was the one I actually
changed. Any negative reading taken with a different probe than its control is not a reading.


# 🟢 s23 (2026-08-29) — D18 is fixed in the template, and a gate nobody was watching is green again

## 17. D18 — the lever, and why the row above it was wrong twice

**Built, 🔴 not driven.** [D18](DEFECTS-THE-SITE-BUILDER-FOUND.md) recorded the fix as *"a design
call"* and pointed at SBR-004 §9.1 for the precedent. Both halves needed correcting before anything
could be built:

- **the citation**: the `sizeMode` precedent is SBR-004 **§8.2 and §10**, not §9.1 (which is AC2 on a
  real page load and says nothing about layout);
- **the family**: SBR-004's was a **height** problem fixed by making Groups stop claiming height.
  D18 is a **width** problem, and its children are *already* `contentSize` — which is the cause, not
  the cure.

### The mechanism, read off the runtime

`layout.ts:82` sets **`flexShrink = 0` on every node**, and only the percentage-along-the-parent's-
direction branches below it set `flexShrink = 1`. Every child of the header row is `IN_A_ROW`
(`contentSize`), which assigns a percentage on neither axis. So **no child can shrink**, and under
the default `nowrap` the row overflows and is clipped — which accounts for all three of §14's
readings at once (right edge fixed at 1001, `#root` tracking the viewport, `scrollWidth ===
innerWidth`). 🔴 It is also why `flex-grow` was never the lever in either task: growing a child that
cannot shrink does nothing about overflow.

### What changed

`flexWrap: 'wrap'` and `rowGap: 'var(--space-3)'` on `headerRow` in `sb005Components.ts`
(`group.ts:478` gates `rowGap` on exactly that condition, so they are authored together). The
artefact diff is **three lines in one `parameters` block** — the wide-screen design is unchanged, and
the actions move to a second line only where they would otherwise have been clipped away.
✅ Not a novel lever here: `/Site/Nav` already ships `flexWrap: 'wrap'`.

### The gate, stated at its real reach

`sb007Template.test.ts` gains a grader and a mutant. ⚠️ It pins **this row**, not the family: eleven
row-direction Groups ship and five are `nowrap` with every graded child non-shrinking, but §14
**measured two of those five reflowing correctly**, so the obvious rule would contradict readings
already taken. The graded property is a **wire-fed `Text` at a display font size** — a width the
template cannot know, because it is a user's page title. Population: exactly 1.

## 18. 🔴 What is owed on D18 — nobody has seen it

The fixture `SBR-007 Page Editor Drive` was minted from the **old** template and still holds the
unwrapped row, so the fix does not reach it retroactively. A peer held the only editor (a live viewer
on `:8574`) all session and two editors cannot share 9222.

**The drive that closes it**: §14's own probe re-run on a project minted from the new template —
`elementFromPoint` on `Save page` at 1440 / 988 / 800 / 600, expecting `SELF` at every width and the
row's height to grow by one line below ~1001px.

## 19. 🔴 [D19](DEFECTS-THE-SITE-BUILDER-FOUND.md) — the editor suite was red at HEAD and had been for three commits

Running `tests-unit` before committing found `sb-007/site-template.test.ts` failing on three
hard-coded counts (21/14/236 against an actual 22/15/274). ✅ **Measured read-only at HEAD and in the
working tree — identical**, so D18's fix could not have caused them.

They live in **`test:main`**, and the phase's standing gate note quotes **`test:ci`**. A green for one
runner was being read as a green for the other, and three feature commits landed on the red one.
Repaired with attribution rather than bumped (236 → 257 SBR-017, → 259 SBR-016, → 274 SBR-007 s21);
`tests-unit` is now **363 suites / 6105 tests / exit 0**.

---

# 🟢 s24 (2026-08-29) — D18 is driven, without the editor, and the fix is bigger than its own row claimed

## 20. The drive — one probe, two arms, and a control that had to reproduce §14 first

**D18 is met on a rendered screen.** No editor was involved: a peer held 9222 and `:8574` for this
session as well, so the drive was taken against `scripts/devtools/render-from-disk.js` — the same
`packages/noodl-editor/src/external/viewer/noodl.viewer.js` bundle the editor's viewer runs —
driven over CDP by `withRenderedPage` on a free port.

### The two arms differ by exactly the committed diff, and nothing else

Both arms are copies of the fixture `SBR-007 Page Editor Drive`. The fixed arm's `Editor header`
`parameters` block was replaced with the one read out of `site-builder.content.json` **at HEAD**, so
the difference was not typed by hand. `diff -r` over the two project trees returns exactly:

```
-        "columnGap": "var(--space-3)"
+        "flexWrap": "wrap",
+        "columnGap": "var(--space-3)",
+        "rowGap": "var(--space-3)"
```

✅ **The seam this leaves — install — is closed by a measurement already in hand.** The fixture was
minted through `EmbeddedTemplateProvider.install` at 21:15 from the *pre-fix* template, and its
header row on disk read `{sizeMode, flexDirection, alignItems, columnGap}` — **byte-identical to the
pre-fix artefact**. Install carries this node's parameters through verbatim, so an install from the
HEAD template yields the block above. Population 1, like the gate.

### 🔴 The control arm reproduces §14 exactly — that is what licenses the second arm

Same probe string, same run, `owner@sbr007.test` signed in, height held at 900 so only width varies:

| viewport | §14 recorded | control arm measured | agrees |
|---|---|---|---|
| 1440 | 104 / 104, `SELF` | 104 / 104, `SELF` | ✅ |
| 1024 | 104 / 104, `SELF` | 104 / 104, `SELF` | ✅ |
| 988 | **91 / 104**, `SELF` | **91 / 104**, `SELF` | ✅ |
| 800 | 0 / 104, **`none`** | 0 / 104, **`none`** | ✅ |
| 600 | 0 / 104, **`none`** | 0 / 104, **`none`** | ✅ |
| right edge | pinned **1001** at every width | pinned **1001** at every width | ✅ |
| `scrollWidth === innerWidth` | true at every width | true at every width | ✅ |

Seven readings, seven agreements, taken through a different host from the one that produced them.
🔴 **This is the step §16 was paid for.** The first attempt at this probe measured
`saveButton.parentElement` rather than the button, reported a 1136px "button" that hit-tested `SELF`
at 600px, and would have read as *"the defect is not reproducible."* It was caught by the control
disagreeing with §14, not by inspection — the ancestor dump that followed showed the button is the
leaf itself, `BUTTON.ndl-controls-button`, 104px wide, right edge 1001.

### The fixed arm

| viewport | row `flexWrap` | row h | `Save page` | visible | hit |
|---|---|---|---|---|---|
| 1440 | `wrap` | 35 (one line) | 897..1001 | 104/104 | ✅ `SELF` |
| 1040 | `wrap` | 35 (one line) | 897..1001 | 104/104 | ✅ `SELF` |
| 1024 | `wrap` | **73 (two lines)** | 272..376 | 104/104 | ✅ `SELF` |
| 988 | `wrap` | 73 | 272..376 | 104/104 | ✅ `SELF` |
| 897 | `wrap` | 73 | 373..477 | 104/104 | ✅ `SELF` |
| 800 | `wrap` | 73 | 475..580 | 104/104 | ✅ `SELF` |
| 600 | `wrap` | 73 | 475..580 | 104/104 | ✅ `SELF` |

Computed `flex-wrap: wrap` and `row-gap: 12px` — `var(--space-3)` resolved — so the parameters
reached the DOM. **`Save page` is reachable at every width tested.** Screenshot pair at 800:
[`notes/d18-before-800.png`](notes/d18-before-800.png) ·
[`notes/d18-after-800.png`](notes/d18-after-800.png).

⚠️ **§18 predicted the wrap at "~1001px"; it is measured between 1040 and 1024** — and that is
correct rather than early. The row wraps when its content overflows **the row**, which happens at
1024; the pre-fix arm went on overflowing the row silently from the same width and only left the
**viewport** at 1000. The prediction was reading the second threshold as if it were the first.

✅ **A consequence neither row anticipated**: the details card below reflows too (right edge 1408 →
768 at 800px). The unwrapped row was 1001px wide and its parent column was sized to it, so the whole
content column overflowed. Visible in the screenshot pair.

## 21. 🔴 D18 was worse than its own row said — the threshold is the title, not 897px

§17 named the graded property *"a wire-fed `Text` at a display font size — a width the template
cannot know, because it is a user's page title."* That is exactly right, and it means **`897` is a
property of the fixture's short title, not of the defect.**

Re-run against a throwaway copy of the backend whose page title is 56 characters
(`Quarterly Board Meeting Minutes and Strategic Review 2026`, 965px at 30px):

| viewport | control (pre-fix) `Save page` | fixed arm |
|---|---|---|
| 1920 | 104/104 ✅ `SELF` | 104/104 ✅ `SELF` |
| **1440** | **0/104 🔴 `none`** | 104/104 ✅ `SELF` |
| **1200** | **0/104 🔴 `none`** | 104/104 ✅ `SELF` |
| **1024** | **0/104 🔴 `none`** | 104/104 ✅ `SELF` |
| **800** | **0/104 🔴 `none`** | 104/104 ✅ `SELF` |

🔴 **On an ordinary 1440 laptop screen, with an ordinary page title, `Save page` did not exist.**
The fix holds at every width. Pair at 1440:
[`notes/d18-longtitle-before-1440.png`](notes/d18-longtitle-before-1440.png) ·
[`notes/d18-longtitle-after-1440.png`](notes/d18-longtitle-after-1440.png).

**The rule this pays for: a threshold measured on a fixture is a fact about the fixture.** D18's row
carried `897` in its own heading, and the number was true of one 22-character title. The defect was
never bounded by a viewport width — it was bounded by a string a user types.

## 22. 🔴 [D20](DEFECTS-THE-SITE-BUILDER-FOUND.md) — the title itself still cannot be read, and D18's fix cannot reach it

The same probe, same runs: the title `Text` measures **409px** (short title) and **965px** (long
title) — **identical at every viewport in both arms**. It never shrinks and never wraps, and
`scrollWidth === innerWidth` throughout, so whatever leaves the viewport is unreachable. With the
56-character title the heading is clipped at **every width at or below 1237px**, fixed arm included.

Wrapping the row moves the *actions*; it cannot move the text inside a single non-shrinking child.
Filed as **D20**, `NONE` — it needs a decision (let the title shrink and ellipsize, or let it wrap),
which is not this task's build.

## 23. What the instrument cannot see

- **It is not the editor's preview pane.** Same viewer bundle, same project data, different host —
  no editor chrome, no preview iframe sizing, no `ViewerConnection`. The control arm reproducing all
  seven of §14's readings is the argument that this does not matter *for this question*; it is not
  an argument about anything else.
- **It renders `arm-fixed`, not a project freshly installed from the HEAD template.** See §20 for why
  that seam is closed by measurement rather than assumed.
- **`test:ci` was not run this session either** — a peer held the editor throughout, again.

## 24. Where the ACs stand after s24

| | verdict |
|---|---|
| **AC1** | 🟢 preview half MET and DRIVEN (s22) · ⬜ **deployed half still owed** — unblocked since SBR-008 closed at s18, not attempted at s22, s23 or s24 |
| **AC2** | 🟢 **outcome BUILT + DRIVEN s27** (§31) — `reorderSection` renumbers siblings and the stored order moves · ⬜ the **drag gesture** is still not built, but s29 **DISPROVED D23**: the geometry was always on the wire (§32), so this is authoring work, not a missing capability |
| **AC3** | 🟡 thumbnail shipped, source-measured only · 🔴 drop gesture blocked on **D15**, `NONE` · ⬜ gallery model is SBR-005's |
| **AC4** | 🟢 MET and DRIVEN (§12.2) |
| **AC5** | 🟢 MET and DRIVEN (§12.3) |
| **D18** | 🟢 **FIXED s23, DRIVEN s24** (§20–§21) — and its recorded severity was raised, not confirmed |
| **D20** | 🔴 new, `NONE` — the title the fix cannot reach (§22) |

🔴 **AC3 is still not met, and the phase must not close as if it were.** D15 is unowned.

---

# 🟢 s25 (2026-08-29) — AC1's deployed half is MET and DRIVEN, and the deploy nobody had served was hiding a defect that had nothing to do with this screen

## 25. What was driven, and on what

**The artefact is a real deploy folder** — `deployToFolder`'s own output, written by the editor's
export pipeline running headlessly (§26), not a reconstruction. `render-from-disk.js` was the right
instrument for D18 and is the wrong one for this question: nothing it serves has been through
`Exporter.exportToJSON`, and the whole point of AC1's deployed half is what the *export* produces.

The loop, on the deployed panel, in one run:

| # | act | reading |
|---|---|---|
| 1 | public `/drive-007`, **signed out** | `h1.ndl-visual-text`, **36 px / 700**, y=152 — `Deployed Retitle 001` |
| 2 | stored row, over REST | `title: "Deployed Retitle 001"` |
| 3 | sign in as `owner@sbr007.test` | lands `/admin/pages`, nav shows **`Sign out`** |
| 4 | open the page editor | header `Editing · Deployed Retitle 001` |
| 5 | retitle + `Save page` | header becomes `Editing · Cross Origin Retitle 002` |
| 6 | stored row, over REST | `title: "Cross Origin Retitle 002"` |
| 7 | public `/drive-007`, **a browser that never signed in** | **36 px / 700** — `Cross Origin Retitle 002` |

Zero console errors. §12.1's oracle throughout — the **36 px heading**, never `body.innerText`,
because the site's nav lists the page by title and would pass before anything was driven. Step 7 is
a separate Chrome with a fresh profile: not a logged-out view, a session that never had one.

✅ **Step 5 is §12.2's reading again, on the deploy caller.** The header is fed from the record, so
it changing is the stored row changing — the input's echo cannot produce it. Step 6 is the
independent oracle beside it.

## 26. The instrument: the editor's deploy path, without the editor

`scripts/devtools/deploy-from-disk.entry.ts` (bundled by `build-deploy-from-disk.mjs`, mirroring
`noodl-preview/build.mjs`) composes exactly what `compilation.deployToFolderWithContext` composes —
`ProjectModel`, a populated `NodeLibrary`, `utils/exporter`, `build/deployer` — in Node.
`scripts/devtools/drive-deployed.js` serves the resulting folder and drives it over CDP.

### 🔴 The health filter is inert headlessly, and a green from it means nothing

`exportComponent` drops every connection `getConnectionHealth` calls unhealthy, and that predicate
reads **no ports**: it asks `WarningsModel` whether a warning is *currently recorded* and answers
`healthy: true` when none is — including when none has ever been evaluated (SBR-008 §5.4). A fresh
Node process has evaluated nothing, so the export keeps every wire unconditionally.

**`graph.evaluateHealth()` does not fix that on its own.** It has four early returns and takes them
silently; on all 22 components it took `isModuleRegistered(project)` — the editor registers the open
project as a node-library module and nothing headless does. Counting calls read *"22 components
evaluated"* while the number of components actually evaluated was **0**.

The census that caught it, and that the tool now prints on every run:

| arm | on graph | in deploy | cloud-excluded | **dropped by filter** | sabotaged wire |
|---|---|---|---|---|---|
| before `registerModule` | 360 | 242 | 118 | **0** | 🔴 **deployed** |
| control, after | 359 | 241 | 118 | **0** | — |
| sabotage, after | 360 | 241 | 118 | **1** | ✅ **dropped** |

🔴 **The sabotage arm is the only thing separating "the deploy kept every wire" from "the filter
never ran".** Its first version wired the bad port onto a `/#__cloud__/` component — which
`deployToFolder` excludes wholesale — so it was absent from the bundle either way and reported a
confident `false`. A control that reads zero for its own reasons is worth less than none.

✅ **With the filter live, every one of the 241 non-cloud connections reaches the deployed bundle**,
and the 359→241 gap is exactly the 118 cloud-component connections the deploy excludes by design.
That is SBR-008's claim, on the deploy caller, with a known-firing control beside it.

## 27. 🔴 [D21](DEFECTS-THE-SITE-BUILDER-FOUND.md) — the first arm could not sign in at all

Served cross-origin from its backend — the normal deployed shape — the panel answered a correct
password with *"That email and password did not match."* The backend never received the request:
`X-Parse-Installation-Id`, which the runtime's auth seam sets on every auth call, was missing from
the backend's CORS allow-list, so Chrome refused the POST after allowing the preflight.

Fixed in `nodegx-backend/src/ops/headers.ts`, specced with a control, mutant-checked, and the
identical drive re-run afterwards to completion. **The full write-up, including the two wrong
readings it took to get there, is D21's row.**

⚠️ **AC1's deployed half was taken in both configurations.** Same-origin (proxied) passed before the
fix; cross-origin passed only after it. The table in §25 is the cross-origin run.

## 28. What this instrument cannot see

- **It is not the editor's Deploy popup.** `DeployToFolderTab` collects a directory and an
  environment and calls the same `deployToFolder`; what is unmeasured here is that UI, not the
  export.
- **`environment` was supplied by hand** for the same-origin arm (`--endpoint`), which is what the
  Deploy popup's environment picker does. `appId`/`type` are carried from the project's own metadata
  because `json.ts:121` replaces the whole `cloudservices` block — omit them and the deployed app
  authenticates against nothing.
- **One project, one backend.** Every number here is the site-builder fixture's.

## 29. Where the ACs stand after s25

| | verdict |
|---|---|
| **AC1** | 🟢 **MET AND DRIVEN, both halves** — preview s22 (§12.1), **deployed s25 (§25)** |
| **AC2** | 🟢 **outcome BUILT + DRIVEN s27** (§31) — `reorderSection` renumbers siblings and the stored order moves · ⬜ the **drag gesture** is still not built, but s29 **DISPROVED D23**: the geometry was always on the wire (§32), so this is authoring work, not a missing capability |
| **AC3** | 🟡 thumbnail shipped, source-measured only · 🔴 drop gesture blocked on **D15**, `NONE` · ⬜ gallery model is SBR-005's |
| **AC4** | 🟢 MET and DRIVEN (§12.2) |
| **AC5** | 🟢 MET and DRIVEN (§12.3) — the dirty marker was seen again on the deployed panel at s25 |
| **D18** | 🟢 FIXED s23, DRIVEN s24 (§20–§21) |
| **D20** | 🔴 open, `NONE` — the title the fix cannot reach (§22) |
| **D21** | 🟢 **NEW, FIXED and DRIVEN s25** (§27) — product, `nodegx-backend` |

🔴 **AC3 is still not met, and the phase must not close as if it were.** D15 is unowned.

---

## 30. 🔴 [D20](DEFECTS-THE-SITE-BUILDER-FOUND.md) — decided by measurement, fixed, and driven

s25 left D20 as *"a design decision, not a build"*, with a suspicion in the handoff that the
ellipsize option *"probably needs `layout.ts` — so this may be a **product** row wearing template
clothes."* **The suspicion was right about one option and wrong about the other, and the two have
opposite dispositions.** That is what the session settled first, before building anything.

### 30.1 The disposition, read off the runtime

The heading fails to shrink **and** fails to wrap, and those are two different branches:

| mechanism | where | what it does |
|---|---|---|
| shrink | `layout.ts:82` | every node starts `flexShrink: 0`; **only** a percentage size along the parent's direction assigns `flexGrow` **and** `flexShrink: 1` |
| wrap | `Text.tsx:60` | `whiteSpace: 'pre'` — i.e. **nowrap** — for `contentSize` and `contentWidth`; `pre-wrap` for every other mode |

`IN_A_ROW` is `{ sizeMode: 'contentSize' }`, which fails both at once. So:

- **wrap is TEMPLATE work and reachable today** — one percentage width flips *both* branches,
  because a percentage width is only legal in a mode that assigns a width, and every such mode
  takes `Text.tsx`'s `pre-wrap` path.
- **ellipsize is PRODUCT work** — `textOverflow` / `text-overflow` measures **0** across
  `noodl-viewer-react/src` and `noodl-runtime/src`, against controls of **2** (`wordBreak`, a port
  that exists) and **11** (files carrying `inputCss`, the mechanism a new port would use). There is
  no port to set. ⚠️ The first run of that pair passed both paths as a quoted shell variable, zsh
  did not word-split it, and the finding *and both controls* read 0 — the same zsh trap
  [D15](DEFECTS-THE-SITE-BUILDER-FOUND.md) recorded, caught here only because the controls were
  read before the finding.

### 30.2 🔴 The two levers are inseparable, and that is a product observation

`layout.ts` assigns `flexGrow` and `flexShrink` **in the same branch**. There is no way to opt a
node into shrinking without also opting it into growing. So the fix necessarily moves the actions to
the right of the row rather than clustering them beside the title. **That is a real visual change
and it was not free** — it is recorded here rather than discovered by whoever next looks at the
screen and wonders when the header changed.

### 30.3 The control arm reproduced §22 exactly, which is what licensed the fix

Two arms, copies of the fixture `SBR-007 Page Editor Drive`, differing by **exactly two parameters**
on one node (`diff -r` over the trees returns only `sizeMode` and `width`). Backend: a **copy** of
`backend_mterfnli74qwv`'s data on 8601, so the fixture's own rows are untouched. Signed in as
`owner@sbr007.test`, height held at 900 so only width varies.

| viewport | §22 recorded | control arm measured | agrees |
|---|---|---|---|
| 1920 / 1440 / 1200 / 1024 / 800 / 600 | **965 px at every width** | **965 px at every width** | ✅ |
| heading box | 272..1237 | 272..1237 | ✅ |
| `scrollWidth === innerWidth` | true at every width | true at every width | ✅ |

The control also read the mechanism straight off the screen — `whiteSpace: pre`, `flexShrink: 0` —
which is the two branches above, confirmed rather than inferred.

⚠️ **§22 calls the title 56 characters; it is 57.** The pixel width is identical, so it is the same
string and the count was off by one. Recorded because the *number* is what a future session would
re-derive from.

### 30.4 The fixed arm

`{ sizeMode: 'contentHeight', width: { value: 60, unit: '%' } }` → `flexShrink: 1`, `flexGrow: 60`,
`whiteSpace: pre-wrap`.

| viewport | heading width | lines | right edge vs row | `Save page` |
|---|---|---|---|---|
| 1920 | 1296 | 1 | 1568 < 1888 | `SELF` |
| 1440 | 816 | 2 | 1088 < 1408 | `SELF` |
| 1200 | 576 | 2 | 848 < 1168 | `SELF` |
| 1024 | 517 | 2 | 789 < 992 | `SELF` |
| 800 | 393 | 3 | 665 < 768 | `SELF` |
| 600 | 193 | 7 | 465 < 568 | `SELF` |

**Nothing is clipped at any width**, the heading tracks the viewport instead of being pinned at 965,
and `Save page` hit-tests `SELF` throughout — so **D18 has not regressed.**

### 30.5 ✅ The short-title control — the fix does not cost the common case

Re-run with the fixture's own 21-character title in both arms. The reading that matters is the one
that was *not* expected: **the control clips a 21-character title too.** At 600px its heading is
272..681 against a viewport of 600, so even a short title ran off the screen; the fixed arm wraps it
to three lines and keeps it inside. There is no width at which the fix is worse.

### 30.6 Why 60% and not 100%

Measured, not chosen: at `100%` the heading owns its line at **every** width, so the actions drop to
a second row even at 1920 where they fit today — a permanent extra header row for every title,
including short ones. 60% keeps the one-line header wherever it fits. It wraps slightly more at the
extremes (7 lines vs 5 at 600px) and that is the trade that was taken.

🔴 **This is the half that is still Richard's**, and it is an appearance judgement, not a
measurement: the fix moves the actions to the right of the header. Reverting to the old look is two
parameters.

### 30.7 🔴 The gate said `flexShrink:0 throughout` and would have gone on saying it

D18's grader classified shrinkability from `sizeMode` alone, against
`NON_SHRINKING = ['contentSize', 'contentHeight']`. The fixed heading is `contentHeight` — **in that
list** — and measures `flexShrink: 1` on the rendered screen. So the gate stayed **green while its
own sentence became false**, which is this suite's recorded failure mode: the literal did not move,
the claim beside it stopped being true.

The rule now models `layout.ts` — a child shrinks in a row iff its mode assigns a width
(`explicit`/`contentHeight`) **and** that width is a percentage — and the row is graded *"a child
can shrink, so the row reflows"* rather than *"it wraps"*.

🔴 **And the mutant had stopped testing anything.** Dropping `flexWrap` alone no longer reddens the
grader, because a shrinkable heading reflows the row without wrapping at all. It now drops **both**
levers, and a **second** mutant drops D20's alone to prove the two are independent — the green above
is not being carried by wrap.

⚠️ **Both mutants silently mutated the wrong node first.** `find(n => n.id === 'heading')` matched a
node in another component, because **the door rewrites ids on write** — `heading` ships as
`heading-2`. They now resolve the target through the row's own `children`. A mutant that mutates
nothing is green for the same reason a correct one is.

### 30.8 What this leaves

- **Ellipsize is unbuilt and unowned** — it needs a `textOverflow` port on `Text` that does not
  exist. It is a **product** row and it is not SBR-007's. Filed as **D22**, `NONE`.
- ⚠️ **Dimension ports take `{value, unit}`.** A bare `'60%'` string was accepted **in silence** and
  rendered at content width — the first fixed arm read `flexShrink: 0` and `965px` and looked like a
  refuted fix. Same family as **D8**/**F15**.

---

# 🟢 s27 (2026-08-30) — AC2 is built and driven, and its *gesture* is a product row

## 31. What AC2 needed, and why it was never an afternoon

§8 called it *"buildable, not built, and more expensive than it looks"*, and both halves held.

**The write half is genuinely cloud-only.** Reordering does not write the section that moved — it
renumbers its **siblings**. A `SectionRow` is a `For Each` template that knows its own `id`, `kind`,
`order` and `data` and nothing about the row above it, and the browser runtime has no loop node. So
a panel that wanted to write N records would need N authored `Set Record`s for an N nobody knows.
`Run Tasks` is that loop, it is cloud-only, and this is exactly what it is for.

### 31.1 What shipped

**`/#__cloud__/reorderSection(pageId, sectionId, toIndex)`** and its worker
**`/#__cloud__/site/SetSectionOrder`** — the signature §8 named. It sorts, splices, and writes each
moved row its index.

🔴 **`toIndex` is a position in the order-sorted list, not an `order` value**, and that distinction
is the whole reason the endpoint sorts rather than doing arithmetic. Nothing has ever guaranteed
`order` is contiguous: sections are born at `sections.count`, so deleting the middle of three leaves
`0, 2`. A caller computing `order - 1` to move a row up would, on that page, ask for position 1
meaning position 0. Sorting removes the assumption instead of documenting it — and because the write
renumbers to the index, `order` **is** contiguous afterwards for every page anyone has reordered.

🔴 **The worker carries NO access rules**, and that is the invariant rather than an omission.
Reordering a *published* page is an ordinary edit; `ADMIN_ONLY_RULES` here would revoke the world's
read on every section it touched while `Page.published` stayed `true`. **Driven**: a published
page's sections are still anonymously readable after a reorder.

**The browser half** is `Move up` / `Move down` on each row, `MoveUp`/`MoveDown` Component Outputs,
and two planner Function nodes on the page editor that turn a direction into a `toIndex`.

- **Two planners, not one**, because a `JavaScriptFunction` has exactly ONE input signal (`run`) —
  `simplejavascript.ts` mints `in-<name>` for values only — so there is no way to tell one script
  which button was pressed.
- 🔴 **`runOnChange-in-…: false` on both, and it is load-bearing.** `itemActionItemId` is set for
  **every** item output signal a row sends, `Changed` included (`foreach.tsx:911`). Left ticked — and
  absent means ticked — pressing **Save** on a row would land a new `itemId`, re-run both scripts,
  and silently move the section the client had just edited.
- The id and the trigger both leave `sectionList`, which is `publishPage`'s `prep` rule. `For Each`
  gives it for free: it flags every `itemOutput-…` dirty and *then* sends the signal, in one
  scheduled pass (`foreach.tsx:915-927`).
- ⚠️ **`CloudFunction2` has no `success` port** — ERG-001 renamed it `done` (`cloudfunction2.ts:143-156`).
- ⚠️ **`failure` is a signal and `mounted` is a value port**, so they cannot be wired together — a
  signal into a value port arrives once, as `false`. A `States` node is the recorded repair, and it
  resets, so a refusal cannot outlive the thing it was about.

### 31.2 The drive — AC2 is met, on stored rows

Ten cases in `sb004-publication-invariant.test.ts`, which authors through the real MCP door and runs
a real backend with enforcement on. **Every reading is taken from the stored rows, never from the
answer.** Third-to-first, back down, contiguity, the bystander page untouched, a no-op that answers
rather than hanging, clamping past the end, a section from another page refused, the published-ACL
invariant, and a non-admin refused 403.

### 31.3 ⬜ The gesture is NOT met — and s29 found the recorded reason was false

AC2 says *"dragging"*. It ships as buttons. **s27 recorded why as a missing capability — filed as
D23, `NONE`, D15's twin — and [§32](#32) disproved that.** Every visual node has reported its
rendered geometry the whole time, on four `Bounding Box` output ports, driven in a browser.

So the standing entry here was wrong in the way that costs most: it converted *"nobody built this"*
into *"the runtime cannot do this"*, and put an authoring job behind a product row nobody owned.

**AC2's outcome is met and driven. AC2's gesture is unbuilt — and buildable.** The remaining work is
`Drag Y` ÷ the pitch the `Bounding Box` ports report, which is arithmetic in the graph. Left unbuilt
rather than quietly ticked, but it is now scoped as SBR-007's own work and not a blocker.

### 31.4 What driving cost, beyond the fix

- 🔴 **A checker had a hole nothing had ever reached.** `sb007Template.test.ts`'s SBR-016 rule walks
  a query's producers to find a trigger that predates any edit. `CloudFunction2` was in its
  `TRANSPARENT` set but has no `runOnValueChange` entry, so it fell through to *"not signal-driven,
  so a value landing runs it"* — untrue: `scheduleCall` is *"the only method the `Call` port
  reaches"*. With `reorder.done → storageFetch` the walk reported the page editor's query as running
  because *"the page mounted"* — **true of the value it followed, false of the trigger it graded**.
  Fixed with an explicit `INVOCATION_ONLY` map. 🔴 **The pinned literal did not need to move**: with
  the checker right it names the mount path again, which is what says the hole was the cause.
- ⚠️ **Four census literals moved and one I read backwards.** `sb005AdminPanel`'s pair is *code
  nodes* and *code nodes that declare a port*; I commented that the second would stay at 4 and it
  correctly went to 6 — both planners declare `out-go`. The number was right and my sentence about
  it was wrong.
- 🔴 **The template must ship a rule for its own endpoint.** `site-builder.security.json` gained
  `reorderSection: role:admin`, because SB-016's gate refuses a public bind while any endpoint is
  undeclared. Its *"two of four land on the wrong rule"* finding is now **three of five** — the
  finding got wider as the template grew.
- 🔴 **D24** — the reorder drive makes `duplicatePage` fail 4 runs in 5 with `run-tasks/already-running`
  on duplicatePage's own node, from a previous request. Three controls say it is not call volume.
  **Two wrong readings were recorded on the way** (an id shift that did not happen, then a bundle
  order that was luck) — see D24. Unowned, mechanism unestablished.

---

## §32 — s28: D24 was not what s27 wrote down, and the endpoint was writing four pages

**2026-08-30.** §31 left D24 as *"a cloud function's graph outlives its request"*, unowned and with
its mechanism explicitly unestablished. It is established now, and the recorded mechanism was
wrong — the true one is worse and had been shipping, green, for ten sessions.

### What the trace said

An env-gated trace in `runtasks.ts` and `simplejavascript.ts` (added, read, reverted) printed an
instance identity beside every `Do`. **Every request builds a fresh `Run Tasks` instance**, and the
two `Do` pulses that produced `already-running` were **1ms apart on that same fresh instance**.
Nothing outlived anything.

The two pulses came from a code node that **ran four times in one request**, each run firing the
signal wired to `Create Record.store`:

| run | trigger | wrote |
|---|---|---|
| 1 | `source.fetched` — sent by the **`Id` setter**, before any read | `Copy of Untitled` |
| 2 | `title`/`slug` arrived | `Copy of Pricing`, no sections |
| 3 | `title`/`slug` arrived **again, identical** | `Copy of Pricing`, no sections |
| 4 | the last arrival | the real copy, answered |

🔴 **Counted over `/classes/Page`, one Duplicate press left four rows.** The 400 was only the
fourth `Do` colliding with the third run — the one symptom that reaches a caller, which is why it
was the only one anybody saw.

### The repair, and the gate

`source.done` in place of `source.fetched`; `runOnChange-in-title/-in-slug/-in-sourceId` unticked;
a readiness guard on the id. **Four rows → one**, and the AC2 drive is back in front of
`duplicatePage` — 5/5 green, zero `already-running`. The count is now asserted
(`wrote exactly ONE page … (D24)`), naming every extra row `ORPHAN`; reverting the template reddens
it.

### What it cost, and what it is worth remembering

- 🔴 **Every assertion in a 47-spec suite read the row the response named.** That row was always
  correct. A defect that writes *extra* rows is invisible to every reading taken from the answer —
  and the file's own header says to read the stored rows, which it did, for the one id it was given.
  **The reading that finds this class is a count over the class.**
- 🔴 **s27's mechanism fitted every observation and excluded nothing.** Traffic dependence,
  flakiness, one endpoint and not another — all explained, all still explained by the true cause.
  What separated them was an **instance identity in a trace**, not more thought about the same
  evidence.
- ⚠️ **A peer had measured the opposite the same morning.** DEF-023 (09:21) established that a cloud
  function's component scope dies with its request. That was a free contradiction of s27's sentence,
  sitting in the git log, and this session nearly re-derived it from scratch.
- 🔴 **Two runtime behaviours are behind it and neither is fixed**: `Fetched` firing on a bind
  ([D25], description repaired, behaviour unowned) and an identical value re-running a node
  ([D26], unowned, twelve node families). Both are registered in phase 80. **The template fix helps
  one template; those two are the objective.**

---

## 32. s29 — the row that was wrong about the runtime, and the port it would have duplicated

**The session's whole finding is that [D23](DEFECTS-THE-SITE-BUILDER-FOUND.md#d23) was false**, and
the way it was false is worth more than the row was.

### 32.1 What was on file

*"No visual node reports its rendered geometry, so a drag cannot know what it is over."* Filed s27
with a measurement, a control, and a note that the control had already caught one bad population:

> ⚠️ **The first population was wrong and the control is what said so.** Grepping `plug: 'output'`
> returned 18 hits across the whole directory, which is far too few for 51 output blocks […]
> Re-run against `outputs:`, the controls fire and the 0 stands.

### 32.2 What is actually there

`react-component-node.ts:1053-1111` declares a **`Bounding Box`** output group **once, for every
visual node**: `Screen Position X`, `Screen Position Y`, `Width`, `Height`. `boundingHeight`'s
shipped description is *"Height this element actually ended up with after layout, in pixels"*.

| measured over the 175-node catalog | |
|---|---|
| visual nodes | **29** |
| carrying all four `Bounding Box` outputs | **27** |
| carrying none | **2** — `Component Children`, `For Each`, neither of which draws a box |

And a second route the row also missed: **`this`, a `reference` output on all 27**, which a
`Function` node's `*`-typed input accepts, and on which `getDOMElement()` is available — the same
accessor `Group.tsx`'s own `Scroll To Element` resolves through.

### 32.3 🔴 The lesson: a control drawn from the same population tests the syntax, not the boundary

The s27 control was *"`displayName` matching height/width/size/bounds/top/left — **20**"*, run over
`noodl-viewer-react/src/nodes`. It proved the grep reached port declarations. It could not prove the
grep reached **these** port declarations, because they are not in `nodes/` — and no control drawn
from inside the searched directory ever could.

The row repaired its *predicate* twice (`plug:` → `outputs:`) and never re-asked its **directory**.
✅ **A finding of 0 needs a control on the boundary as well as on the predicate**: a count of files
reached, or a known-present instance of the thing being searched for, deliberately placed *outside*
the population under suspicion. [D15](DEFECTS-THE-SITE-BUILDER-FOUND.md#d15) was re-run this session
with that second control and **survives it**; D23 did not.

### 32.4 The drive

`packages/noodl-mcp/tests/d23GeometryDrive.test.ts` — **5 specs, ~11s**, authored through the real
MCP door, rendered in headless Chrome by `withRenderedPage`. A catalog declaration is a claim: these
four ports are *getters* over `clientBoundingRect`, filled by a polling observer that only starts on
`onFirstConnectionAdded`, so "declared" and "reports the number" are different questions.

| probe | read back |
|---|---|
| Group A, authored `160px` | port says **"160"**, `offsetHeight` **160** |
| Group B, authored `240px` | port says **"240"**, `offsetHeight` **240** |
| Group A `boundingWidth`, authored `320px` | **"320"** |
| `Group.this` → `Function` → `getBoundingClientRect().height` | **"160"** |
| literal `Text` — the render control | `"render control literal"` |

🔴 **Two boxes at different heights, not one.** A single box is satisfied by a port reporting the
viewport, the page, or a constant. Two that differ by exactly what they were authored to differ by
are not. This is the same discrimination `def003PageTitleDrive` built its control page for.

### 32.5 The fix the row proposed would have shipped a dead port

D23 offered *"a `domelement` output on `Group` (three lines, `video.ts:283-288` is the template)"*.
Executing `canCastPortTypes` over the shipped `typecasts` table:

- `domelement` reaches **0** typed inputs in the 175-node library (the 14 it reaches are `*`).
- `domelement → reference` is **`false`** — and `reference` is the type of `Group`'s
  `Scroll To Element - Element`, **the destination `Video`'s own port description names**.

That is now [**D27**](DEFECTS-THE-SITE-BUILDER-FOUND.md#d27), and it exists only because the fix was
checked before it was written. 🔴 **A row that is wrong about the defect is usually wrong about the
repair, in the same direction** — here it would have added a second unconnectable port and closed
looking green.

### 32.6 What this leaves

- **AC2's gesture** — unbuilt, and now scoped as authoring work rather than a product blocker.
- **AC3** — still not met, still blocked by **D15**, which was re-measured at HEAD and stands.
  The two were filed as twins; only one of them was real.
