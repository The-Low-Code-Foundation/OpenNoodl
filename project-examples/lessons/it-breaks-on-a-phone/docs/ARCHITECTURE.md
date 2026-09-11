# Architecture

## Page map

- **Home** (`Pages/Home`) — The only page. `Page shell` holds two children: `Card` (lesson 1's creature card, untouched) and `Board` (this lesson's strip).

## The tree this lesson adds

```
Page shell  (Group)                      lesson 1's furniture, untouched
  ├ Card    (Group, contentSize)         lesson 1, untouched
  │   ├ Creature (Circle)
  │   └ Name     (Text)
  └ Board   (Group)                      step 2 — contentHeight, maxWidth 560, padding
      └ Care  (Columns)                  steps 3, 5, 6 — layoutString, breakpoint
          ├ Feed  (Text)                 step 4
          ├ Play  (Text)
          └ Sleep (Text)
```

## Data model

No records. Lesson 2 is purely visual. The database arrives at spine lesson 8.

## 🔴 The two measurements that decide this lesson's numbers

Both were read off a render, not reasoned about, and changing either one breaks the lesson without breaking any gate.

1. **`smallBreakpoint` measures the Columns node's own container, not the viewport** — `packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx:205`, NDA-006 §3. Inside a 560-wide `Board` with 16px of padding each side, the strip is **528** across on a 1440 laptop and **358** on a 390 phone. `480` is the number that separates those two, and it is why the breakpoint is not a viewport-shaped number like `600`. A first draft used 600 and the columns folded at **every** width, on a laptop included.

2. **A Columns node overflows its parent by `marginX` unless the parent has horizontal padding.** It draws its gutters with negative margins, so at full width its container measures `parent + marginX`. With no padding on `Board`, `render_report` at 390px found four elements at 406px, clipped. That is what `Board`'s padding is for; it is not decoration, and the step prose says so.

3. **`Group.maxWidth`'s default unit is `%`, not `px`.** The panel renders a unit dropdown beside the number (four units: `%`, `px`, `vw`, `vh`) and it opens on `%`, so a learner typing `560` commits `{"value":560,"unit":"%"}` — 560 *per cent*. The condition wants px, so the step would have refused work the learner had done correctly, and **no gate would have caught it**: F2 replays conditions against the *solution*, and the solution has px because the authoring tool wrote it. The step body names the unit for that reason, in `body` rather than `detail`, because `detail` is collapsible and this is load-bearing.

   🔴 **The general rule, worth carrying to every future lesson:** before grading a number-with-units port by value, read its `defaultUnit` off `get_node_type`. `paddingLeft` and `Columns.smallBreakpoint` both default to `px` and need no such sentence; `maxWidth` does. `NumberWithUnits.updateValue` is the code that decides, and a port with one unit renders a static label instead of a dropdown.

Verified by `render_report` at `1440x900` and `390x844`: 3 columns / 1 row on the laptop, 1 column / 3 rows on the phone, `overflowingCount: 0` at both.

## Decisions

Considered and deliberately not done:

- **Teach `sizing: autoFit` + `minWidth` instead of a breakpoint** — it reflows with one control and no magic number, and it is the better habit. Rejected for this lesson because the lesson is called "It breaks on a phone": an explicit *"below 480, use this layout"* is the sentence a beginner can read back. `autoFit` is a natural follow-up wherever the curriculum wants it.
- **Grade `Care`'s Justify Content** — it would have covered the "alignment" third of the curriculum entry's `teaches`. Rejected on a measurement: setting it to `center` changed **nothing** on screen, at either viewport, pixel for pixel. It is `align-items` on the cross axis and the column items are auto-height, so it is inert here. A lesson step that sets an inert control teaches a lie.
- **Revise `Card`'s `sizeMode` to `contentHeight`** — the most natural way to teach responsive width. Rejected because it is a revision, not an addition, and the chain rule in `docs/BRIEF.md` forbids it: `derive_starter` would clear the parameter lesson 1 graded.
- **Style the three tiles** — a background, padding and centred text would look far better. Rejected because every parameter on those nodes would be one no step asks for, so the learner's result would not match the answer they are graded against.
- **Fix the page's `bodyScroll`** — the project cannot scroll, which `validate_project` reports on every write. Inherited from lesson 1's project and left alone: changing it is a project-metadata edit that would land in the derived starter, which is lesson 1's file to change, not this lesson's.

Left open:

> TODO: The learner-facing step prose in this lesson is drafted by Claude and must be edited by Richard before it ships. Same for the `description` and the `Holds Its Shape` badge.
> TODO: Richard's curriculum entry for this lesson says `teaches: layout, responsive sizing, alignment` and lists nodes `Group, Columns`. Alignment is **not** taught — see the Justify Content decision above. The entry needs `teaches` corrected when it is added to `curriculum.json`.

_Scoping record: `docs/decisions/000-initial-scope.md`._
