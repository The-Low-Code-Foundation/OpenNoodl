# Accordion

A list of sections that open and close, one click each.

| Input (Accordion) | What it does |
|---|---|
| `Items` | Array of `{ Title, Body }`, optionally `Start Open`. Empty falls back to three sample sections, so the component shows what it is the moment you place it. |

| Input (Section) | What it does |
|---|---|
| `Title` / `Body` | The row and what it reveals. |
| `Start Open` | Render this one already open. |

Each section publishes `Opened` (boolean), so you can react to one without
owning its state.

## Decisions worth knowing before you change it

**Each section owns its own state.** Opening one never closes another. If you
want single-open behaviour, hold the open index above the `For Each` and drive
`Start Open` from it — the section will follow, because its state is a count
of its own clicks and not a hidden mode.

**The state is a click count, not a remembered boolean.** This is the part that
was wrong first and looked fine. A Function that flips `Outputs.IsOpen` has to
know whether it has ever run — and it has not: with `Start Open` unset, no
value ever arrives on its inputs, so the node never runs at load and the first
click is silently consumed as the missing boot run. The drive had to click each
header **twice** to open it. A `Counter` arrives at `0` on load, so the Function
has a real answer before anyone touches it, and `Start Open` works with no boot
run to seed it.

**The whole header row is the hit area**, not the words. The drive clicks the
middle of the row — a gap, not the text — on purpose.

**The chevron swaps glyph rather than rotating.** Lucide has no rotation port,
and a swap reads correctly with animation turned off.
