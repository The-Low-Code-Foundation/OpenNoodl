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
