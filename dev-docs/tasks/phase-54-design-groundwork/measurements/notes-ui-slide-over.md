# `ui-slide-over` — what was measured

DSG-003 §3, row 4. Authored 2026-08-11 from a render, not from taste. The file is
[`docs/node-catalog/examples/ui-slide-over.json`](../../../../docs/node-catalog/examples/ui-slide-over.json)
— 421 lines, two components, 28 nodes, 4 connections.

## 1. The boundary against `logic-toggle-details-panel`

The named trap for this row is *"must not duplicate `logic-toggle-details-panel`; this is the
layout, that is the wiring"*. Written down before authoring, so the line could be held:

| `logic-toggle-details-panel` owns | `ui-slide-over` owns |
|---|---|
| `Switch` — the state that flips, `onClick` → `flip` | nothing. It has no logic node at all |
| `Inverter` — deriving the complementary visibility | nothing |
| `Boolean To String` — a self-labelling button | nothing |
| the *distinction* between a signal (momentary) and a value (holds its level) | nothing |
| layout: a `Group` with `flexDirection: column` and two paddings | the whole of it |

What is left over is the **arrangement**, and it is five decisions:

1. an overlay layer that covers the page rather than sitting at the bottom of it;
2. a scrim;
3. a width that is a real width on desktop and full-bleed on a phone;
4. a header row with a close affordance that outlives the scrim;
5. a body that scrolls inside the panel instead of growing the page.

Plus the **interface** — `open` / `title` in, `onClose` out — which is what makes it a panel a page
can own rather than a block of markup. That interface is not a toggle: the recipe deliberately does
**not** contain the thing that decides when `open` is true. Its description says so and names the
sibling recipe, so an agent that finds one finds the other.

## 2. Is a real overlay authorable? **Yes.** Two routes, both in the shipped library

The brief warned this might be refuted. It is not — it is authorable two ways, and the corpus
already contains a working instance of the pattern that nothing pointed at.

**Route A — `position` on the node itself.** `NodeSharedPortDefinitions.addAlignInputs` declares a
`position` port on every visual node with enums `relative` / `absolute` / `sticky` / `fixed`
([`node-shared-port-definitions.ts:536-558`](../../../../packages/noodl-viewer-react/src/node-shared-port-definitions.ts#L536-L558)).
`Layout.align` then defaults `alignX`/`alignY` to `left`/`top` for anything not `relative` and
writes `left: 0` / `top: 0`
([`layout.ts:113-135`](../../../../packages/noodl-viewer-react/src/layout.ts#L113-L135)), and
`Layout.size` keeps percentage width/height as percentages out of flow rather than converting them
to `flex-grow` ([`layout.ts:102-109`](../../../../packages/noodl-viewer-react/src/layout.ts#L102-L109)).
A Group's `sizeMode` defaults to `explicit` with width and height both defaulting to 100%
([`node-shared-port-definitions.ts:753-756`, `:812-823`](../../../../packages/noodl-viewer-react/src/node-shared-port-definitions.ts#L753-L756)),
so **a bare Group with `position: "absolute"` is already a full-bleed box over its parent**. That is
the whole mechanism.

**Route B — `flexDirection: "none"` on the parent.** The Group's Layout port offers `None`, which
sets `parentLayout = 'none'`, and `Layout.size` turns that into `position: absolute` for every child
([`group.ts:36-50`](../../../../packages/noodl-viewer-react/src/nodes/visual/group.ts#L36-L50),
[`layout.ts:56-58`](../../../../packages/noodl-viewer-react/src/layout.ts#L56-L58)). Not used here —
it takes the whole parent out of flex, which costs the header/body column inside the panel.

**The precedent nobody cites.** `library-dist/prefabs/popup-modal-0.2.0.zip` →
`/Popup Modal/Modal Component` is exactly this shape already: a root Group holding a scrim Group
(`backgroundColor: "#000000A5"`) and an absolutely-positioned modal Group with
`alignX: center, alignY: center, width: 420px, sizeMode: contentHeight`. And
`validation/parameterValues.ts:625-642` records a corpus census of it —
**151 absolute boxes with no width or height, 122 of them carrying no decoration**, with the note
that *"a full-bleed absolute box IS the overlay/scrim pattern, authored on purpose"*. The pattern is
in the library, in the prefabs and in a validator's calibration table. It was in no example.

**`fixed` over `absolute`, decided by a measurement.** Both render an overlay. The first build used
`absolute` and it was correct-looking and wrong: an absolute box's containing block is the nearest
positioned ancestor, so the overlay measured **1280×278 / 390×298** — the *page canvas's content
height*, not the viewport. Switching one enum value to `fixed` gave **1280×900 / 390×844** with the
page canvas still 278/298 tall. The recipe ships `fixed` and says why, because "my slide-over is
278px tall on a short page" is the failure an author would otherwise hit and not understand.

## 3. What was built

```
/Pages/Example                       /Components/SlideOver
  Page                                 overlay  Group  position:fixed 100%x100% row/flex-end
    canvas Group  (position:relative     scrim  Group  position:absolute 100%x100%
            by default — the                          --foreground @ opacity 0.5
            containing block)           panel  Group  width 100% / maxWidth 420px / height 100%
      shell Group  1200px shell                       --surface, hairline border-left
        toolbar  heading + "Filters"      panel_header  row, space-between, hairline border-bottom
        4 order rows                        panel_title (18/600) + close_button (icon-x)
      slide_over  → /Components/SlideOver  panel_body    height 100%, scrollEnabled
                    open:true                             8 filter texts, 2 group labels
                    title:"Filter orders"
                                       panel_inputs   Component Inputs  open, title   plug "output"
                                       panel_outputs  Component Outputs onClose       plug "input"
```

Connections (4): `open → overlay.mounted`, `title → panel_title.text`,
`close_button.onClick → onClose`, `scrim.onClick → onClose`.

Port direction is the §2 trap and is explicit on all three ports:
`Component Inputs` ports are plugged `"output"`, `Component Outputs` `"input"`, per
`REQUIRED_PLUG` in
[`componentInterface.ts:319-323`](../../../../packages/noodl-editor/src/editor/src/validation/componentInterface.ts#L319-L323).
`checkComponentPortDirection` + `checkInstancePorts` + `checkInstanceInterfaces` all clean —
the page instance sets `open` and `title`, both of which are real inputs.

Every colour and spacing value is a `var(--token)`: 23 distinct references, all resolving against
`DEFAULT_TOKENS` (182 tokens). Verified by running `validate-token-references`'s own resolver over
this file alone, since the corpus-wide gate is shared with four concurrent agents.

## 4. The measurements

Harness: `example-to-project.js` → `render:report` (headless Chrome, own instance — no Electron
touched). Element boxes read over CDP with a scratch probe reusing `render-report.js`'s exports.

### 4a. Both states, both viewports

| | desktop 1280×900 | phone 390×844 |
|---|---|---|
| **OPEN** (`open: true`) | 15 texts, 15 on screen; 5 font sizes; page 900px; **30 boxes** | 15 texts, 15 on screen; 5 sizes; page 844px; **30 boxes** |
| overlay | `fixed` **1280×900** at 0,0 | `fixed` **390×844** at 0,0 |
| scrim | `absolute` 1280×900, `rgb(15,23,42)` @ **opacity 0.5** | `absolute` 390×844, same |
| panel | **860,0 · 420×900** — right edge, hairline `1px rgb(226,232,240)` | **0,0 · 390×844** — full-bleed |
| panel header | title 18px/600 at 881,24; close button 36×36 at 1228,16 | title at 21,24; close at 338,16 |
| panel body | 861,69 · 419×831, `overflow-y: auto` | 1,69 · 389×775, `overflow-y: auto` |
| page content behind | canvas 1280×278, rows at x=64 w=1152 | canvas 390×298, rows at x=24 w=342 |
| **CLOSED** (`open: false`) | **6 texts**, 6 on screen; 3 sizes; page 900px; **16 boxes** | **6 texts**; 3 sizes; page 844px; **16 boxes** |
| page content when closed | canvas **1280×278** — identical to open | canvas **390×298** — identical to open |

`render:report` on the open state: **0 errors, 2 warnings** (`empty-decorated-box`, one per viewport
— see §6). On the closed state: **"Rendered clean"**, 6 texts.

The two states differ by exactly the 14 elements of the overlay subtree (30 → 16) and by 9 texts
(15 → 6). The page behind is byte-identical in both — closing the panel moves nothing.

### 4b. `mounted` vs `visible` — measured, because the difference is invisible in a summary

A third build wired `open → overlay.visible` instead, and was rendered closed:

| closed via | boxes | overlay box | computed |
|---|---|---|---|
| `mounted: false` | **16** | absent from the DOM | — |
| `visible: false` | **30** | still **1280×900** at 0,0 | `visibility: hidden` |

`visible`'s setter is `setStyle({ visibility: 'hidden' })`
([`node-shared-port-definitions.ts:214-228`](../../../../packages/noodl-viewer-react/src/node-shared-port-definitions.ts#L214-L228),
described as *"Hides the element while keeping the space it occupies in the layout"*); `mounted`
*"removes the element from the page entirely"*
([`react-component-node.ts:1776-1797`](../../../../packages/noodl-viewer-react/src/react-component-node.ts#L1776-L1797)).
For a `fixed` overlay the *layout* consequence is nil — a fixed box takes no space either way — so
the shove-the-content-off-screen failure does **not** appear here. What does appear is that the
panel's entire subtree, its 9 texts and its focusable close button, stay in the document while the
user believes the panel is shut. That is enough. The recipe ships `mounted` and names the trap.

### 4c. The body scrolls, the page does not grow

At 1280×900 and 390×844 the body does **not** overflow — scrollHeight 831/831 and 775/775, i.e.
this much filter content simply fits, which is the honest number. Shrink the window until it does:

| viewport | body box | scrollHeight / clientHeight | page height |
|---|---|---|---|
| 1280×300 | 861,69 · 419×231 | **284 / 231** — scrolls | **300** (unchanged) |
| 740×340 | 321,69 · 419×271 | **284 / 271** — scrolls | **340** (unchanged) |
| 1280×360 | 861,69 · 419×291 | 291 / 291 | 360 |

The claim the recipe makes — *the panel scrolls inside itself and the page does not grow* — is the
first two rows: the body's own scroll box absorbs the overflow and `document.scrollHeight` stays at
the viewport height.

### 4d. The one width, at both ends

`width: 100%` + `maxWidth: 420px`, one declaration, no breakpoints:

| viewport | panel x | panel width |
|---|---|---|
| 1280 | 860 | **420** |
| 844 (landscape) | 424 | **420** |
| 390 | 0 | **390** — full-bleed |

A consequence worth having measured: at 390 the panel *is* the viewport, so the scrim is completely
covered and there is no tap-outside target left. The header close button is the only way out on a
phone. That is why it is in the recipe and not decoration.

## 5. What did not work

- **`position: "absolute"` on the overlay.** Renders a genuine overlay, but sized to the containing
  block: 1280×**278** / 390×**298** against a 900/844 viewport. Correct CSS, wrong panel. → `fixed`.
- **Instance `title` set to the same string as the panel's hardcoded fallback.** With both `"Filters"`,
  `render:report` raised **`dead-placeholder-text` as an ERROR on both viewports** (*2× "Filters"*).
  It is right to: `overriddenDefaults` derives, from the graph, that `panel_title.text` is hardcoded
  *and* fed by Component Inputs, so that string is only ever seen when the input fails to arrive —
  and it cannot tell "the input arrived carrying the identical string" from "the input never came".
  Fixed by making the fallback (`"Panel"`) differ from the value (`"Filter orders"`); the render then
  proves the wire, because the rendered text is the one only the connection can have supplied.
  **General rule for the corpus: never set an example's instance parameter to the same string as the
  fallback it overrides — you lose the only evidence the wire works.**
- **A shadow on the panel edge.** There is no port that takes one. `boxShadow` is assembled from six
  sub-ports — offset X/Y, blur, spread, inset, colour
  ([`node-shared-port-definitions.ts:1133-1265`](../../../../packages/noodl-viewer-react/src/node-shared-port-definitions.ts#L1133-L1265))
  — so the eight `--shadow-*` tokens cannot be applied to a Group at all. Shipped a hairline
  `border-left` instead, which is tokenised and measured (`1px rgb(226,232,240)` = `--border`).
- **A scrim without `opacity`.** No token in the 182-token default set carries an alpha channel, so
  a scrim cannot be a single `backgroundColor` reference. `var(--foreground)` at `opacity: 0.5` is
  the tokenised way to get one, and is why the scrim is a childless sibling rather than the panel's
  parent — as a parent its opacity would dim the panel too.
- **Padding the body until it overflows at 900px.** Would have needed ~17 more `Text` nodes, taking
  the file past 600 lines. `get_example` returns the whole file on every retrieval, so the content
  was left realistic and the scroll proved at a viewport where it genuinely happens (§4c). Recorded
  because the alternative is a recipe that costs tokens to teach nothing extra.

## 6. Findings

**F-a — `empty-decorated-box` cannot tell a scrim from a card that failed to load.**
The open state's only render finding, on both viewports, is a warning against a 1280×900 box with a
background and no children — the scrim, which is correct by construction. The predicate is
`no children && no text && >8px && (background || border)`
([`nodegx-render-measure/src/index.js:166-172`](../../../../packages/nodegx-render-measure/src/index.js#L166-L172)),
and there is no way to author a tinted scrim that escapes it: giving it a child would put the panel
inside the 0.5 opacity. Note that the sibling check `unsized-absolute-box` **was** calibrated for
exactly this shape and deliberately exempts it (`parameterValues.ts:634` — *"The 122 are not defects
— a full-bleed absolute box IS the overlay/scrim pattern, authored on purpose"*). One instrument
learned the lesson; the render check did not. Worth an exemption of the same kind, filed rather than
fixed here — it is a shared tracked file and four other agents are in this corpus.

**F-b — the enriched catalog artifact goes stale when an example is added.**
`scripts/node-catalog/merge.js` embeds every example into
`packages/noodl-types/src/node-catalog-enriched.json` (57 today), and `catalog:merge:check` fails on
a stale artifact. Five recipes are landing concurrently, so `npm run catalog:merge` needs to be run
**once, after all of them**, by whoever commits. Not done here: that file is tracked and outside this
task's one-file scope.

**F-c — the scrim is measured as the page's one accent, at 100% area share.**
`colors.distinctAccents: 1`, `accents: [{ color: "rgb(15,23,42)", share: 1 }]`. `--foreground` is
slate-900, chroma 27, which clears the neutral threshold, so a full-viewport scrim reads to DSG-006's
one-accent measure as a full-viewport accent. It raises no finding today (one accent is the target),
but any future rule that reasons about *which* accent or about area share will be reading the scrim.

**F-d — nothing in the corpus pointed at an overlay before this.**
The mechanism was declared in the node library, demonstrated in a shipped prefab, and counted in a
validator's calibration table — and absent from all 57 examples. This is the F14 shape again: the
gate could see every port name and could not see that no arrangement in the corpus overlaid anything.

## 7. Reproducing it

```
node dev-docs/tasks/phase-54-design-groundwork/measurements/example-to-project.js \
     docs/node-catalog/examples/ui-slide-over.json --out /tmp/slide-over
npm run render:report -- /tmp/slide-over --viewports desktop,phone --out /tmp/slide-over-shot
```

For the closed state, set the `slide_over` node's `open` parameter to `false` in a copy of the JSON
and rebuild. For the box-level numbers, `Runtime.evaluate` over CDP against the same served project;
`render:report`'s own summary reports counts, not rectangles, and 30-vs-16 boxes is the whole of §4b.
