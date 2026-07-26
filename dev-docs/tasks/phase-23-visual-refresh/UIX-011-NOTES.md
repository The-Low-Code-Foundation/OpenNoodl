# UIX-011 — Legacy CSS-Background Icon Retirement · Notes

**Status:** implementation complete, live QA outstanding (see [Both-theme QA checklist](#both-theme-qa-checklist))
**Base:** `e1914e1` · worktree agent, merged by orchestrator to `cline-dev`

---

## 1. The defect, re-verified at start

The spec's premise checks out, and it is worse than "inconsistent":

```
$ grep -L currentColor packages/noodl-editor/src/assets/icons/**/*.svg | wc -l
   → 255 of 255   (zero editor SVGs use currentColor)
$ grep -L currentColor packages/noodl-core-ui/src/assets/icons/icon-component/*.svg | wc -l
   → 0 of 149     (every core-ui glyph uses currentColor, post-UIX-007)
```

The editor glyphs carry baked literals — `fill="white"`, `#F8F8F8`, `#F5F5F5`, `#7e7d7d`, and in
the lesson checkmarks the **pre-azure Noodl yellow `#FCCC73`**. An SVG pulled in through CSS
`url()` is a separate document: `currentColor` inside it would resolve against its own root, and
the referencing element's `color` never reaches it. So none of these can respond to UIX-008's
light theme, and none of them got re-paletted by UIX-001/005.

Two mechanisms were in play, and only one is broken:

| Mechanism | Themeable? | Where |
|---|---|---|
| `content: url(x.svg)` / `background-image: url(x.svg)` | ❌ **frozen** — this is the defect | 22 of 24 live refs |
| `-webkit-mask-image: url(x.svg)` + `background: var(--token)` | ✅ already correct | `reset-to-default` ×2, `push_pin` ×2 |

The mask sites were never broken; they are migrated anyway so the `url()`-to-SVG grep can be
asserted at **zero** and stay there.

## 2. Measured inventory (start of task)

| Location | SVGs | Disposition |
|---|---|---|
| `assets/icons/core-ui-temp/` | 142 | 136 are byte-level duplicates of core-ui's set. **Reduced to 5 canvas glyphs, dir renamed `canvas/`.** |
| `assets/icons/` (root) | 86 | 4 kept (curve diagrams), 1 kept (viewer-frame), 81 deleted |
| `assets/icons/editor/` | 27 | 2 kept (viewer-frame), 25 deleted |

`url()`-to-`.svg` references in editor `.css`/`.scss`: **50** (the spec's per-file table counted
font `src: url(...)` loads in `style.css` as icons — `style.css` actually held **1** icon ref,
not 21; every other number in the spec's table was accurate).

Excluded from the count throughout, as the spec directs: `assets/lib/fontawesome/*` (font loads)
and `frames/viewer-frame/assets/style.css` (runtime, not editor chrome).

## 3. The whole mapping table

### 3a. Dead stylesheets — deleted outright, no migration (26 of 50 refs)

The single biggest finding. Four stylesheets are **required by nothing**; their rules have not
rendered since the panels they styled were rewritten. Confirmed by grepping the filename and
every class name they define across all of `packages/noodl-editor/src`.

| Stylesheet | refs | Why dead |
|---|---|---|
| `styles/componentspanel.css` | 15 | Superseded by `views/panels/ComponentsPanelNew/ComponentsPanel.module.scss`, whose header comment says "Migrated from legacy componentspanel.css". Zero `require`/`import`. |
| `styles/createnewnodepanel.css` | 6 | Zero `require`/`import`. Its only distinctive class, `.create-node-quickbar-icon`, appears **nowhere but in the file itself** — the quickbar UI is gone. |
| `styles/layoutpanel.css` | 2 | Zero references of any kind, including the filename. |
| `views/DeployPopup/deploypopup.css` | 2 | Zero `require`/`import`. `.deploy-cloud-item*` / `.deploy-clipboard-icon` / `.deploy-lock-icon` appear only inside this file. |
| `assets/css/style.css` `.sidebar-add-icon` rule | 1 | Rule kept, glyph did not: class has no consumer anywhere. Rule deleted, file kept. |

This is why the "13 stylesheets" figure shrank to 9: the spec was inventorying the CSS, and the
CSS outlived its markup.

### 3b. Live consumers — migrated to `<Icon>` (24 refs, 13 call sites)

Every live consumer turned out to be **React**, except the lessons one. The spec anticipated
"imperative `View` subclasses"; the property editor's React migration had already landed, so the
imperative-surgery risk was one file, not thirteen.

| # | Old glyph | Old mechanism | → core-ui `IconName` | Consuming view (all React unless noted) |
|---|---|---|---|---|
| 1 | `property-tab-borders-all.svg` | `content:url` | `BorderAll` | `propertyeditor/components/PropertyTabs.tsx` |
| 2 | `property-tab-borders-left.svg` | `content:url` | `BorderLeft` | ″ |
| 3 | `property-tab-borders-right.svg` | `content:url` | `BorderRight` | ″ |
| 4 | `property-tab-borders-bottom.svg` | `content:url` | `BorderDown` | ″ |
| 5 | `property-tab-borders-top.svg` | `content:url` | `BorderUp` | ″ |
| 6 | `property-tab-corners-all.svg` | `content:url` | `RoundedCornerAll` | ″ |
| 7 | `property-tab-corners-top-left.svg` | `content:url` | `RoundedCornerLeftUp` | ″ |
| 8 | `property-tab-corners-top-right.svg` | `content:url` | `RoundedCornerRightUp` | ″ |
| 9 | `property-tab-corners-bottom-left.svg` | `content:url` | `RoundedCornerLeftDown` | ″ |
| 10 | `property-tab-corners-bottom-right.svg` | `content:url` | `RoundedCornerRightDown` | ″ |
| 11 | `editor/reset-to-default.svg` | `-webkit-mask` | `Reset` | `AlignToolsInput.tsx`, `MarginPaddingInput.tsx` |
| 12 | `editor/reset-to-default.svg` | `-webkit-mask` | `Reset` | `VisualStates/VisualStateTransition.tsx`, `.../DefaultVisualStateTransition.tsx` |
| 13 | `editor/up-down-arrows.svg` | `content:url` | `CaretDownUp` | `VariantStates/variantseditor.tsx`, `VisualStates/visualstates.tsx` |
| 14 | `queryeditor-trash.svg` | `content:url` | `Trash` | `QueryEditor/QueryRulePopup/QueryRulePopup.tsx` |
| 15 | `page.svg` | `content:url` | `File` | `propertyeditor/Pages/Pages.tsx` ×2 |
| 16 | `page-filled.svg` | `content:url` | `FileFill` | ″ |
| 17 | `editor/edit-controls.svg` | `content:url` (`::before`) | `Sliders` | `TextStylePicker/TextStylePicker.jsx` |
| 18 | `flash.svg` | `content:url` | **`Lightning`** (new) | `ConnectionPopup/components/PortItem.tsx` |
| 19 | `editor/push_pin_black_24dp-outline.svg` | `-webkit-mask` | **`Pin`** (new) | `InspectJSONView/InspectPopup.tsx` |
| 20 | `editor/push_pin_black_24dp-filled.svg` | `-webkit-mask` | **`PinFill`** (new) | ″ |
| 21 | `lesson-check-incomplete.svg` | `content:url` | **`CheckCircle`** (new) | `models/lessonformat.ts` — **the one imperative site** |
| 22 | `lesson-check-complete.svg` | `content:url` | **`CheckCircleFill`** (new) | ″ |
| 23 | `lesson-check-incomplete-selected.svg` | `content:url` | *collapsed* → `CheckCircle` + `color` | ″ |
| 24 | `lesson-check-incomplete-selected-hover.svg` | `content:url` | *collapsed* → `CheckCircle` + `color` | ″ |

**Note on 23/24.** The two "selected" lesson assets were the *same circle-with-check* redrawn at
a 24 viewBox purely to change its baked colour — exactly the workaround `currentColor` exists to
delete. They collapse into one glyph whose colour comes from the item's `color`, which the
`.lesson-item.selected` / `:hover` rules already set. Four assets → two glyphs, and the state
machine now lives in tokens instead of in four PNG-shaped SVGs.

### 3c. Exact-duplicate check (why `core-ui-temp/` mostly just vanished)

```
comm -23 <(ls core-ui-temp) <(ls core-ui/icon-component)   → 6 files
comm -12 <(ls core-ui-temp) <(ls core-ui/icon-component)   → 136 files
```

136 duplicates deleted without ceremony. Of the 6 uniques:

| Glyph | Fate |
|---|---|
| `home--nodegraph.svg` | **kept** — canvas painter |
| `component--nodegraph.svg` | **kept** — canvas painter |
| `aiAssistant--nodegraph-inner.svg` | **kept** — canvas painter |
| `aiAssistant--nodegraph-outer.svg` | **kept** — canvas painter |
| `component-visual.svg` | deleted — only consumer was `componentspanel.css`, and in a **commented-out** `TODO: review this icon` block |
| `component_with_children-visual.svg` | deleted — no consumer at all |

Plus `warning_triangle.svg`, a duplicate by name but **kept** because the canvas painter loads it.

### 3d. Where the spec's "delete `core-ui-temp/` entirely" was wrong

`views/nodegrapheditor/canvas/CanvasIcons.ts` `require()`s five glyphs from `core-ui-temp/` and
paints them onto `<canvas>` via `new Image()`. `ICONOGRAPHY.md` already carves canvas category
glyphs out of the Icon component ("painted on `<canvas>` by the node-graph painter (UIX-005,
`CanvasIcons.ts` + `core-ui-temp/`), not DOM"), so the spec's own convention doc contradicts its
"delete entirely". **A canvas-painted `<img>` cannot use `currentColor` either** — the colour has
to be baked, or the painter has to re-render per theme. That is UIX-005's contract, not this
task's.

Resolution: the directory is reduced 142 → 5 and **renamed `assets/icons/canvas/`**, because
`core-ui-temp` now describes neither its contents nor its purpose. The five glyphs keep their
baked fills deliberately.

→ **Handed to UIX-005 (not UIX-010):** the canvas glyphs are still theme-frozen. In light theme
the node-card home/component/AI marks stay light-on-light. Fixing it means the painter picking a
variant per theme (there is already a `nodegx:themechanged` repaint hook to hang it on), which is
canvas-paint territory. Recorded here so it is not lost — it is the last theme-frozen icon
surface in the editor.

### 3e. Glyphs migrated *into* core-ui (5 new)

Migration, not redrawing — each is an existing editor glyph with its baked fill swapped for
`currentColor` and nothing else changed.

| New `icon-component/` file | `IconName` | Source | Drawing style |
|---|---|---|---|
| `lightning.svg` | `Lightning` | `flash.svg` | **fill** |
| `pin.svg` | `Pin` | `editor/push_pin_black_24dp-outline.svg` | **fill** (Material 24dp) |
| `pin_fill.svg` | `PinFill` | `editor/push_pin_black_24dp-filled.svg` | **fill** (Material 24dp) |
| `check_circle.svg` | `CheckCircle` | `lesson-check-incomplete.svg` | **stroke**, already on-grid |
| `check_circle_fill.svg` | `CheckCircleFill` | `lesson-check-complete.svg` | **fill** (intentional — solid status glyph) |

→ **Handed to UIX-010** for stroke-grid redraw: `lightning.svg`, `pin.svg`, `pin_fill.svg`. All
three are fill-drawn at a non-16 viewBox (7×12, 24×24, 24×24) and want redrawing to the
16×16 / 1.5px round-stroke grid. `check_circle.svg` was normalised to a 16 viewBox with a 1.5
round stroke and needs nothing. `check_circle_fill.svg` is a deliberate solid status counterpart
per ICONOGRAPHY's solid-glyph rule, so it is correct as-is.

## 4. Layout adjustments — the part that actually needed care

A CSS background paints inside the element's own box; an `<Icon>` is a `<span>` child with its
own box. Every swap was sized against the rule it replaced rather than dropped in at the enum
default. The `Icon` `Root` is `display:flex` with `align-items:center`, so vertical centring is
free — horizontal spacing and *box size* are what shift.

| Site | Old box | Fix applied |
|---|---|---|
| `PropertyTabs` | `.property-tab-icon` 32×32 | Icon container pinned to 32×32 via `UNSAFE_style`; the core-ui border/corner glyphs are 31 viewBox so they fill it at the same optical weight. `.property-tab` opacity 0.25/1 selected-state kept on the parent — it still works, since opacity is inherited by the child. |
| `property-changed-dot` (×2 files) | 16×16 absolutely positioned at `top:9px/left:4px` and `left:5px/top:12px` | Kept the absolute positioning on the wrapper `<span>`; Icon sized `Tiny` (16) inside it. Same box, same origin. |
| `visual-state-transition-changed-dot` | 16×16, `margin-left:8px` | Wrapper keeps `margin-left`; Icon `Tiny`. |
| `variants-pick-icon` | 8×10 glyph, `margin-top:2px`, `margin-left:4px`, opacity 0.7 | `CaretDownUp` at `Tiny` (16) is visually larger than the old 8×10; container constrained to **10×12** so the row height does not grow. |
| `queryeditor-trash-icon` | 20×20, `margin-left:10px`, `margin-right:5px`, `align-self:center` | Margins + `align-self` moved onto the Icon's `UNSAFE_style`; Icon `Small` (20) matches. |
| `router-pages-icon` | 18px wide, `margin-right:7px`, `align-self:center`, opacity 0.7 | Icon `Tiny` (16) — 2px narrower than the old 18. Kept `margin-right:7px`; the row is `display:flex` so the 2px comes off the icon, not the label baseline. **Flagged for visual check.** |
| `textstyles-edit-style::before` | 20×20 pseudo-element inside a 33×33 flex-centred box | Pseudo-element deleted; Icon becomes a real child of the already-centred `.textstyles-edit-style` div. Hover opacity moved from `::before` to a child selector. |
| `signalIcon` | 15×15, `margin-right:3px` | `Lightning` at `Tiny` (16). 1px wider; `margin-right:3px` kept. |
| `PinButton` | `$pin-icon-size` square mask on a `<button>` | Button keeps its box; Icon becomes its child. Mask + `background:` removed, `color: var(--theme-color-fg-default)` added so the glyph inherits what the mask used to be filled with. |
| lesson checkmark | `height:16px` / `21px` by state | Both glyphs are 16×16; the `21px` variant was compensating for the 24-viewBox selected asset, which no longer exists. Rule simplified to a flat 16px. **Flagged for visual check.** |

The two flagged rows are the only places where the box genuinely changed size rather than moving
between parent and child.

## 5. Dead assets removed

Beyond the glyphs the migration replaced, the usage scan (every `.svg` basename grepped across
all non-`.svg` sources under `packages/noodl-editor/src`) found a large orphan set — assets no
stylesheet, view, or `require` had referenced in a long time.

| Bucket | Count |
|---|---|
| `core-ui-temp/` duplicates of core-ui | 136 |
| `core-ui-temp/` uniques with no live consumer | 2 |
| Root orphans (never referenced) | 55 |
| Root, referenced only by a now-deleted dead stylesheet | 11 |
| Root, migrated to core-ui or replaced by a core-ui twin | 15 |
| `editor/` orphans (never referenced) | 18 |
| `editor/` referenced only by dead CSS / migrated | 7 |
| **Total deleted** | **244** |

Kept (7):

| File | Why |
|---|---|
| `canvas/` × 5 | canvas painter (§3d) |
| `debug.svg`, `editor/close_20.svg`, `editor/refrsh_24.svg` | **`frames/viewer-frame/assets/style.css`** — the runtime viewer frame, explicitly out of scope |
| `curve-ease-in.svg`, `curve-ease-out.svg`, `curve-ease-in-out.svg`, `curve-linear.svg` | `CurveEditor/curveeditor.jsx` — easing-curve *diagrams*, not chrome icons |

(That is 5 + 3 + 4 = 12 files; the "7" above counts directories/groups. Exact final tree is in
the commit.)

## 6. The regression gate

`scripts/css-icon-url-ratchet.js`, wired as `npm run icons:css` and run alongside the hex
ratchet. Unlike the hex ratchet this is a **hard gate at zero**, not a ratchet — there is no
legacy tail left to burn down, so any reintroduction is a straight regression.

It scans `.css`/`.scss` under the editor and core-ui `src/` trees for `url(...)` pointing at a
`.svg`, ignoring `url(data:...)` payloads and the two vendored Font Awesome files.

```
$ npm run icons:css
Scanned 214 .css/.scss files under packages/noodl-editor/src, packages/noodl-core-ui/src
✓ 0 url()-to-SVG references. Icons render through the Icon component.
```

## 7. What I could not verify — read this before believing anything visual

**I cannot run the editor from a worktree.** `lerna exec` resolves to the primary checkout, so
the dev stack and therefore the UIX-009 screenshot corpus (`corpus/run.sh`, which drives a
*running* editor) are both out of reach here. Everything below is verified:

| Claim | How verified | Confidence |
|---|---|---|
| Dead stylesheets are dead | Filename grep + every defined class name grepped across all of `packages/noodl-editor/src` | High — a class no file names cannot be styled |
| `core-ui-temp` duplicates are identical | `comm` on the two file lists + spot `diff` | High |
| Glyph metaphors map correctly | Read the path data of both old and new for every pair | High for the 15 straightforward ones; the `edit-controls` → `Sliders` pairing is the one judgement call |
| Editor renderer builds | webpack build, exit 0 | High |
| `url()`-to-SVG count is zero | the new gate | High |
| Hex ratchet holds | `npm run colors` | High |
| **Icons visibly re-tint on theme flip** | **not verified — needs a running editor** | **none** |
| **No pixel shift at the 10 migrated sites** | **not verified — reasoned per site in §4, not seen** | **none** |

The acceptance test for this task is inherently visual and I did not run it. The checklist below
is written so someone else can.

---

## Both-theme QA checklist

Run from the **primary checkout** (`npm start`), on a project with at least one page, one
variant, one visual state, a Query/Filter node, a Text Style, and a Router. Toggle theme in
**Editor Settings → Appearance**.

For every row: the icon must be **visible and correctly contrasted in both themes**, and must
**change colour when the theme flips**. An icon that looks identical in both themes is a
failure — that is precisely the bug this task exists to remove.

| # | Surface | How to reach it | Icon(s) | Check |
|---|---|---|---|---|
| 1 | Property editor — box-model tabs | Select any visual node → Style → Border / Corners group | 10 border/corner tab glyphs | All 10 render; selected tab is full-opacity, others 25%; **32×32 box unchanged** (compare against `corpus/captures/2026-07-26/` property-editor shots) |
| 2 | Property editor — reset dot | Change any property so the reset dot appears (align tools + margin/padding) | `Reset` | Appears at the same offset as before; hover brightens to `fg-highlight`; click still resets |
| 3 | Visual states — reset dot | Select node → Visual States → change a property in a non-default state | `Reset` | Same; `margin-left:8px` gap intact |
| 4 | Variants picker | Select node → Variants dropdown | `CaretDownUp` | Sits at the row's right edge; **row height unchanged** (this one was resized 8×10 → 10×12) |
| 5 | Visual states picker | Select node → Visual States header dropdown | `CaretDownUp` | Same |
| 6 | Query editor rules | Select a Query/Filter node → open a rule popup | `Trash` | 20×20, hover opacity change works, delete still fires |
| 7 | Router pages list | Select a Router node → Pages section | `File`, `FileFill` | Start page shows the **filled** variant, others outline; **⚠ box went 18px → 16px — check label alignment doesn't shift** |
| 8 | Text style picker | Properties → any text-style field → edit (pencil/controls button at the right of the field) | `Sliders` | Centred in its 33×33 box; hover opacity 0.6 → 1 |
| 9 | Connection popup — signal ports | Drag a connection from a signal output, or click an existing connection | `Lightning` | Renders beside signal port names only, not data ports; 3px gap to the label |
| 10 | Inspect-JSON popup | Enable inspect on a connection → pin button | `Pin` / `PinFill` | Toggles outline ↔ filled on click; button box unchanged |
| 11 | Lessons layer | Learn tab → open a lesson with tasks | `CheckCircle` / `CheckCircleFill` | ⚠ **highest-risk row.** Incomplete = outline, complete = filled; selected + hover states change **colour only**; **the old `#FCCC73` yellow must be gone** — completed check should now read on the azure/token palette |
| 12 | Node graph canvas | Open any component with a Home / Component / AI node | canvas home/component/AI/warning | **Expected to still be theme-frozen** — §3d, handed to UIX-005. Note whether they are illegible in light; that sizes the follow-up |
| 13 | Regression: components panel | Open the components tree | (none of mine) | Unchanged — I deleted `componentspanel.css` claiming it was dead. **If the tree loses its folder/component/caret icons or its spacing, that claim was wrong.** |
| 14 | Regression: create-node | Right-click canvas → node picker | (none of mine) | Unchanged — same claim about `createnewnodepanel.css` |
| 15 | Regression: deploy popup | Deploy button → popup | (none of mine) | Unchanged — same claim about `deploypopup.css` |
| 16 | Regression: viewer frame | Run the app preview | debug / close / refresh | Untouched by design; confirm still present |

Rows 13–16 are the ones I would check first. They are where a wrong "this is dead code" call
would show up, and dead-code deletion is the largest single part of this change.

## Residuals

1. **The entire visual acceptance test.** Nothing above the line was seen running. Rows 1–11 of
   the checklist are the task's actual acceptance criteria.
2. **Canvas glyphs remain theme-frozen** (§3d) — handed to UIX-005, not fixed here. This is the
   one place the task's stated goal ("every icon in editor chrome themes") is knowingly not met,
   and the reason is a real constraint, not an omission.
3. **3 fill-drawn glyphs handed to UIX-010** (§3e): `lightning`, `pin`, `pin_fill`.
4. **`edit-controls` → `Sliders` is a judgement call.** The old glyph is two vertical slider
   tracks; `Sliders` is core-ui's nearest equivalent. If it reads wrong at 33×33, the alternative
   is `SlidersHorizontal` or a migrated glyph.
5. **`curveeditor.jsx` uses raw `src="../assets/icons/curve-*.svg"` string paths** — not
   webpack-processed, so those `<img>`s are resolved relative to the renderer document and are
   likely already broken. Out of scope (not a CSS `url()`), but it is a real bug and someone
   should own it. The 4 assets were kept so fixing it stays a one-line change.
6. **Font Awesome is still loaded** (`assets/lib/fontawesome/`) — a separate retirement question
   the spec explicitly parks. Noted, not started.
