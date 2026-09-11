# CN-018 AC4 — the picker names the kit: the drive

**Written BEFORE the editor was launched, 2026-08-17, session 15.** AC4 is the one criterion
producer-side tests cannot reach: *"the two `Stat Tile` cards are distinguishable **without reading
`data-test`**."*

## The blocker was already lifted, and nobody had checked

Three handovers (s12, s13, s14) recorded CN-018 as blocked on a viewer build, because the editor
loads `packages/noodl-editor/src/external/viewer`, which is gitignored build output
(`.gitignore:197`).

🔴 **A build already existed.** `noodl.viewer.js` has mtime **2026-08-16 21:57**; the CN-018 fix
committed at **21:52** (`2d8f8e02`). Timing alone is not proof, so the bundle's *content* was
checked: `moduleNodesByKit` appears at 5 sites in the bundle as compiled code
(`const moduleNodesByKit = new Map();` at line 66784), not in a comment and not in a sourcemap.
**The bundle carries the fix.** The blocker was stale, not real.

⚠️ **The transferable bit:** "blocked on a build" is a claim about an *artifact*, and an artifact has
an mtime and a content. Neither was checked for three sessions; the blocker was inherited by relay.

## The fixture

`NodeGX test projects/cn069-s15-drive` — a `cp -R` of `cashflow-command-centre` (the only copy of the
cashflow kit carrying the D8 token change; the copies in `cn001-kit-drive` and `cn019-drive` are
pre-D8, 0 `var(--)` and 6 live hex), plus **two scaffolded kits**:

| kit dir | manifest `name` | node type | node display name |
|---|---|---|---|
| `cashflow-kit` | Cashflow Kit | `nodegx.cashflow.*` | Lane, Pill, Balance Strip, Day Axis, Danger Banner |
| `harbour-metrics` | Harbour Metrics | `harbour-metrics.StatTile` | **Stat Tile** |
| `wren-analytics` | Wren Analytics | `wren-analytics.StatTile` | **Stat Tile** |

🔴 **Two `Stat Tile`s is the whole point.** With one kit an unnamed group is indistinguishable from a
correctly-named one that is merely collapsed — every existing single-kit fixture passes against the
old code. Three kits also tests that grouping is not accidentally binary.

## The observations

### O1 — three headings, named, each holding only its own kit

**Expected**, reading the picker's rendered group headings as *text*:

| what | expected | what it excludes |
|---|---|---|
| group headings under the kit area | **`Cashflow Kit`, `Harbour Metrics`, `Wren Analytics`** as three separate headings | — |
| | *not* one heading reading `External libraries` holding all 7 nodes | the old `''` group — `NodePicker.search.ts:421` falls back `subCategoryName \|\| categoryName`, so the collapse renders as a *plausible* heading, not an empty one |
| | *not* three headings all reading `External libraries` | grouped but not named |
| each `Stat Tile` sits under a **different** heading | ✅ | — |

⚠️ **The fallback is why an eyeball says "fine".** A broken picker shows a tidy "External libraries"
section. The discriminator is the *count and text of headings*, never "does it look organised".

### O2 — distinguishable without `data-test`

Read the two `Stat Tile` cards' **visible text** only (label + meta line), with `data-test` stripped
from the readout. They must differ. `NodePickerCard.tsx:70` renders `toItem`'s `meta`, which
`NodePicker.search.ts:302-308` fills with the subcategory name.

🔴 **If the readout includes `data-test`, the observation is worthless** — that attribute always
differed, and it is exactly what s11 had to fall back on.

### O3 — the P1 check (AC5)

The kit heading must read as *attribution*, not as a warning label: same tag, same class, same
computed font-size/weight/colour as a built-in group's heading. Compare a kit heading's
`getComputedStyle` against a built-in category heading in the same DOM. Different values ⇒ a kit node
is being visually demoted, which P1 forbids.

⚠️ `BaseDialog` renders every dialog **twice** (a `MeasuringContainer` copy). Every picker query must
filter `:not([class*=MeasuringContainer])` or the heading count doubles and O1 reads as six groups.

---

# THE RESULTS — written after the drive

✅ **DRIVEN 2026-08-17, session 15. AC4 and AC5 both MET.** Editor launched on an undisturbed tree
(9222 free, no peer stack, no test suite in flight). Screenshot: [cn018-picker-driven.png](cn018-picker-driven.png).

## O1 — three headings, named ✅

`NodeLibrary.instance.library.nodeIndex.moduleNodes`, read live in the running editor:

| group | items |
|---|---|
| `Cashflow Kit` | `nodegx.cashflow.Lane`, `.Pill`, `.BalanceStrip`, `.DayAxis`, `.DangerBanner` |
| `Harbour Metrics` | `harbour-metrics.StatTile` |
| `Wren Analytics` | `wren-analytics.StatTile` |

Rendered, the picker draws **three separate `<h3>` headings** with their own item counts (5 / 1 / 1)
— not one `External libraries` heading holding all seven. Each kit's nodes appear only under its own
heading.

## O2 — distinguishable without `data-test` ✅, and the two modes do it DIFFERENTLY

🔴 **This is the part worth carrying.** The kit name is never absent, but *which element carries it
swaps between the two modes*, and each mode looks broken if you check only the other one's carrier:

| mode | group heading | card's second line |
|---|---|---|
| **browsing** | **`Harbour Metrics`** / **`Wren Analytics`** | `External libraries` (the category) |
| **searching** `"Stat Tile"` | `External libraries` (the category) | **`Harbour Metrics`** / **`Wren Analytics`** |

Search-mode readout, verbatim: `EXTERNAL LIBRARIES ⏵ 2 ⏵ S ⏵ Stat Tile ⏵ Harbour Metrics ⏵ S ⏵ Stat
Tile ⏵ Wren Analytics`.

⚠️ **I nearly filed a false defect here.** Reading the browse-mode cards first, every kit card's meta
said `External libraries` and CN-018's spec had predicted the kit name would be on the card's second
line — so it read as the fix not landing on the card. The spec's sentence was scoped to **searching**
and was exactly right; the browse-mode meta is the *category* by design, because the heading is
already carrying the kit. **Check both modes before calling a two-mode surface broken.**

Preview pane, third carrier, also confirmed: the chip reads
**`EXTERNAL LIBRARIES · HARBOUR METRICS`** (`NodePickerPreview.tsx:57`), as traced.

## O3 — the P1 check (AC5) ✅

Kit heading vs a built-in category heading (`Logic`), same DOM, `getComputedStyle`:

| | tag | class | font-size | weight | colour | transform | letter-spacing |
|---|---|---|---|---|---|---|---|
| `Logic` (built-in) | H3 | `…GroupTitle--keaAO` | 11px | 700 | `rgb(166,176,187)` | uppercase | 0.77px |
| `Harbour Metrics` | H3 | `…GroupTitle--keaAO` | 11px | 700 | `rgb(166,176,187)` | uppercase | 0.77px |
| `Cashflow Kit` | H3 | `…GroupTitle--keaAO` | 11px | 700 | `rgb(166,176,187)` | uppercase | 0.77px |

Identical in every property. Attribution, not a warning label — **P1 satisfied, measured rather than
argued from "it goes through the same component"**.

## A fourth confirmation, free: a kit scaffolded mid-session

Scaffolding `Midsession Kit` into the *open* project and reloading the viewer took the library
177 → 178 types and produced a correctly-named second group immediately (`['Demo Kit', 'Midsession
Kit']`). The grouping is not a property of the fixture — a brand-new kit lands named. See
[cn-006-midsession-kit-pickup.md](cn-006-midsession-kit-pickup.md) for the reload half.

## Method note

The picker opens on **right-click over empty canvas**, and a synthetic right-click reaches nothing.
It was opened by invoking the canvas's own call site — `new CreateNewNodePanel({...})` + `render()` +
`PopupLayer.instance.showPopup(...)`, the same four lines as
`InteractionController.ts:909-927` — so the React tree, the library payload and the styling are all
real; only the mouse event was substituted. Every query filtered
`:not([class*=MeasuringContainer])`, without which `BaseDialog`'s second render doubles the heading
count.
