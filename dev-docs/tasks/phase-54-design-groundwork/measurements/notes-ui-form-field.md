# `ui-form-field` — what was built, and what the render said

DSG-003 §3, recipe 3 of 5. Authored from a measured render, not from taste: every number below
was read out of a headless Chrome driving the fragment through
`example-to-project.js` → `render:report`, plus a scratch CDP probe for per-element geometry
that `render:report` does not print.

## The arrangement

One page, one component.

```
/Pages/Example          Page → band → shell (maxWidth 640) → form card (--space-5 rhythm)
                        three instances of the field, showing all three states at once:
                          hint only · error only · neither
/Components/FormField   Group column, rowGap --space-2
                          Text            label            --text-sm / --font-medium
                          textinput       control          sizeMode contentHeight, width 100%
                          Text            error line       --text-sm / --red-700
                          Text            hint line        --text-xs / --muted-foreground
                        Component Inputs  label, placeholder, value, error, hint   plug "output"
                        Component Outputs text, submitted                          plug "input"
```

Nine connections, no logic node anywhere in the component.

## 1. The named trap: `sizeMode` on `textinput`

`net.noodl.controls.textinput` ships `sizeMode: "contentSize"`. In that mode `width` is a declared
port that is **inert** — the catalog says so out loud (`declaredPortGroups`: `width` appears only
under `sizeMode = explicit OR sizeMode = contentHeight`), but the parameter is accepted, stored and
silently ignored, so nothing fails.

Same file, same `width: {value: 100, unit: "%"}`, inside the same 592px card. Only `sizeMode`
differs:

| control `sizeMode` | control box @1280 | control box @390 | the `<input>` itself |
|---|---|---|---|
| `contentSize` (the shipped default) | **196px** | **196px** | 170px |
| `contentHeight` (what ships) | **526px** | **276px** | 500 / 250px |

The 170px in DSG-003's one-line description is the raw `<input>` intrinsic width; the box a person
actually sees is that plus the field's `--space-3` padding and 1px ring, so **196px** is the number
to compare against 526px.

The tell that makes this trap worth a recipe: **196px at both viewports.** It is not merely too
narrow, it is completely deaf to its container, so it looks identical on a phone and on a desktop
and no responsive check catches it.

`sizeMode: "explicit"` also frees the width (measured: identical 526/276), but it takes the `height`
port with it. Left alone the height happens to land the same 46px; set it (48px) and the control
freezes at 48px regardless of font or padding. A field that should grow with its own type wants
**`contentHeight`**, which is what shipped. Both are named in the description so a search for either
finds the recipe.

## 2. The falsiness mechanism — `visible` is the WRONG port, measured

The brief asked for "the error line hidden by falsiness into `visible`, the same mechanism
`ui-empty-state` uses — verify it actually works rather than copying the claim." It does not work,
and the render says so twice over.

**`visible` keeps the space.** `node-shared-port-definitions.ts:215` — the setter is
`setStyle({ visibility: 'hidden' })`, and the port's own description reads *"Hides the element while
keeping the space it occupies in the layout."* `mounted`
(`react-component-node.ts:1776`) is the one that *"Removes the element from the page entirely when
false, unlike Visible which leaves its space behind."*

Same file, same instances, one word changed in two connections:

| wired to | clean field height | DOM children of a clean field | `visibility:hidden` elements | total divs |
|---|---|---|---|---|
| `visible` | **87px** | 4 | 4 | 23 |
| `mounted` | **71px** | 2 | 0 | 19 |

71px is exactly `17 (label) + 8 (gap) + 46 (control)` — the line is *gone*, not hidden. The 16px
difference is the two `--space-2` flex gaps the hidden-but-present boxes still claim, and it lands
as an asymmetric hole under every clean control (49px below the last input against 33px above the
first label, inside 32px of card padding). Per field with one line showing the cost is 8px
(103.5 → 95.5).

**And it only fires if something DRIVES the port.** Rendering the fragment with the two `visible`
connections *deleted* produced a byte-identical layout — 23 divs, same heights, same positions —
because an instance that simply omits `error` never sends anything, the port keeps its default
`true`, and the line was invisible only because its `text` was empty as well. The `visible` wire was
doing nothing at all. Wiring an explicit `error: ""` on the instance is what makes the port fire
(two `visibility:hidden` elements then appear).

So the recipe ships `mounted`, and every instance passes `error` and `hint` explicitly, empty string
included. It is still falsiness with no logic node — the same string drives `text` and `mounted`.

⚠️ This is a corpus-wide finding, not a local one: `ui-empty-state` and `ui-card-grid-repeater` both
teach "wire it straight into `visible`, that is conditional rendering with no logic node." For a
Group with real content in it, `visible: false` leaves a hole the exact size of the content. The
coordinator is fixing `ui-empty-state`; `ui-card-grid-repeater`'s badge (`badge → visible`) has the
same defect and is **not** fixed by this task — it is an absolutely-positioned badge so the hole
costs nothing there, but the sentence in its `description` is what an agent will copy.

## 3. Contrast — `--destructive` fails AA as text

The first draft used `--destructive` (#ef4444) for the error line, which is what "destructive" reads
like it is for. Measured against `--surface` (#f8fafc) that is **3.60:1** at 14px — below the 4.5:1
AA floor, on the single most important sentence on the field.

| colour | on `--surface` | on `--background` |
|---|---|---|
| `--destructive` #ef4444 | 3.60 | 3.76 |
| `--destructive-hover` #dc2626 | 4.62 | 4.83 |
| `--red-700` #b91c1c | **6.18** | 6.47 |

Shipped `--red-700`, confirmed at the rendered pixel (`rgb(185, 28, 28)` at 14px/400 on the card).
`--destructive-hover` also clears AA but naming a hover token for static text is a lie about intent.

🔴 **Gap for the phase: there is no AA-passing semantic token for destructive *text*.** This is
exactly the hole DSG-006 closed for control rings with `--border-control` (#7c8894, 3.62:1 on
`--background`, which this recipe uses for the field ring). `--destructive` is a fill colour and
works as one — `--destructive-foreground` on it is white — but nothing in the 182 defaults says
"error text". Until there is, a recipe has to name a palette step, which is the thing the doctrine
otherwise tells authors not to do.

## 4. It renders, at both viewports

`npm run render:report -- <proj> --viewports desktop,phone`, on the shipped file:

```
ui-form-field — Rendered clean: desktop 1280×900px, 5 texts, 5 on screen, 0 images;
                                phone   390×844px, 5 texts, 5 on screen, 0 images.
  desktop 1280px → layout 1280px, page 900px, 5 texts / 2 sizes / weights 400+500, 0 placeholders
  phone    390px → layout  390px, page 844px, 5 texts / 2 sizes / weights 400+500, 0 placeholders
```

5 texts is the right number and the proof of the switch: 3 labels + 1 hint + 1 error, from three
fields that declare four text slots each. ("Rendered clean" alone means nothing — a blank page
reports clean too.)

Per-field geometry, from the CDP probe:

| field | @1280 | @390 | DOM children |
|---|---|---|---|
| Full name (hint, no error) | 95.5px | 95.5px | 3 |
| Email (error, no hint) | 98.3px | 117.5px (error wraps to 2 lines) | 3 |
| Discount code (neither) | **71px** | **71px** | **2** |

Control box 526px @1280 / 276px @390; card 592px / 342px. Nothing overflows, nothing is clipped,
0 elements hidden, page height equals the viewport at both sizes.

## 5. Gates

- `validate-examples.ts --dir <isolated>` — **1/1 clean** (strict, warnings-as-errors), run on a
  directory holding only this file, because four sibling agents were writing into the corpus.
- `npm run catalog:tokens` — 485 references across 68 files all resolve.
- Interface direction: 5 `Component Inputs` ports plugged `output`, 2 `Component Outputs` ports
  plugged `input`, `component-port-direction` clean.

## 6. What did not work, and tooling notes

- **`render:report` cannot answer this task's question.** It prints element counts, distinct font
  sizes, page height and findings — nothing per-element. Both headline numbers here (a control's
  width, a field's height) needed a scratch CDP probe re-implementing `render-report.js`'s
  serve-and-drive loop with my own expression. `renderReport()` takes no expression hook and
  `measureExpression`'s `probes` argument is fed only by `listProbes`, which builds probes for
  `For Each` rows and nothing else. A `--probe <js>` passthrough on `measure-from-disk.js` would
  have saved the detour, and every future "author from a measured render" task will need it.
- **A `messages` wrapper Group was built and then deleted.** With `visible` wiring, nesting the
  error and hint in one sub-Group cut the empty-field cost from two `--space-2` gaps to one
  `--space-1` gap (87 → 83px). Once the port changed to `mounted` the wrapper bought exactly
  nothing — unmounted children leave no slot — so the flat four-child column shipped. Worth
  recording because the wrapper is the instinctive fix and it is the wrong one.
- **`example-to-project.js` did the job unchanged**, including a `Page` node hosted under its
  synthesised full-viewport Group with no Router in the project.
- The three-instance page is deliberate: one render shows hint-only, error-only and neither, so the
  switch is visible as a *comparison* rather than as an assertion about a single field.
