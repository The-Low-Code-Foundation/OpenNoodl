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
