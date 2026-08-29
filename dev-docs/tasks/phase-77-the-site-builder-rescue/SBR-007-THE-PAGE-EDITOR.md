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
| **AC2** | ⬜ not built — sibling renumbering needs a cloud function and a decision (§8) |
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
