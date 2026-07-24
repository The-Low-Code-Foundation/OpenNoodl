# PLAT-002 NOTES — Retire the jQuery Islands

Status: inventory + strategy recorded 2026-07-24 (Implementation Step 1 deliverable).
Updated as waves land — §7 is the as-built log.

## 0. Corrections to the task spec (verified 2026-07-24)

- jQuery is **not** provided by a webpack `ProvidePlugin` — there is none in any config.
  It is two `<script>` tags in `src/editor/index.html` (lines 10–11: `jquery-min.js`,
  `jquery.autosize.min.js`) creating window globals. Removal = delete the script tags
  and the two files in `src/assets/lib/`.
- `views/projectsview.ts` (922 lines, 65 `$(` calls) has **zero importers** — no import,
  no require, no string mention anywhere in source. It is dead code and gets deleted,
  not converted. Same for `views/newupdatepopup.js` (51 lines) and its template.
- `lessonevalconditions.js` (flagged in the spec) contains **no jQuery at all**; it is
  imported by the live `lessonlayer2.ts`. Nothing to do here; the file belongs to
  LEARN-001 regardless.
- `colorpicker.js` now lives at `DataTypes/ColorPicker/colorpicker.js`; `filepicker.js`
  at `DataTypes/FilePicker/`. Two stale artifacts exist and should be deleted:
  `views/popuplayer.js.bak`, `views/panels/ComponentsPanelNew/ComponentsPanel.ts.legacy`.
- Prerequisite REV-003 (CI gates) is complete, and PLAT-001 has landed — so the canvas
  shell's jQuery is **in scope** per the spec's own boundary rule.

## 1. Baseline (2026-07-24, excluding `.bak`/`.legacy`/vendored bundles)

| Metric | Value |
|---|---|
| `$(` calls in editor source | **547** across **68 files** |
| `View` subclasses (incl. via `View.call`) | 30 declarations (incl. d.ts shadows) |
| Runtime `.html` templates | 34 files (19 in `templates/`, 14 in `templates/propertyeditor/`, 1 viewer-frame) |
| Orphan templates (no require) | 11 (see §5) |
| `shared/view.js` | 278 lines |
| `views/popuplayer.js` | 1,044 lines, 101 `$(` calls |

Final verification greps (run at close):
`grep -rn '\$(' packages/noodl-editor/src/editor/src packages/noodl-editor/src/shared`
plus confirming `jquery` absent from `index.html` and `src/assets/lib/`.

## 2. Inventory and triage

### Group DEAD — delete, no conversion (wave 1a)

| File | $( | Why dead |
|---|---|---|
| `views/projectsview.ts` (922 ln) | 65 | zero importers; launcher superseded it |
| `views/newupdatepopup.js` (51 ln) | 1 | zero importers |
| `views/popuplayer.js.bak` | ~101 | stale backup |
| `views/panels/ComponentsPanelNew/ComponentsPanel.ts.legacy` | many | stale legacy copy |
| 11 orphan templates (§5) | — | no requires |

### Group A — property-editor DataTypes rows (TypeView subclasses; leaves)

All render via `cloneTemplate`/`bindView` against `templates/propertyeditor/*.html`
fragments, hosted by `Ports.ts` (the dispatcher, 502 ln) → `propertyeditor.ts`.

TS rows (in rough conversion order — simplest first):
`FontType`(3), `TextAreaType`(2), `IdentifierType`(5), `EnumType`(13), `SizeModeType`(7),
`ImageType`(7), `IconType`(8), `TextStyleType`(8), `ColorType`(7), `ComponentType`(4),
`SourceCodeType`(5), `Dimension`(19), `NumberWithUnits`(19), `VariableType`(15),
`QueryFilterType`(1), `QuerySortingType`(1), `LogicBuilderHiddenType`(1),
`LogicBuilderWorkspaceType`(1), `CurveType`(1), `ByobFilterType`(1), `CodeEditorType`(2),
`TabGroup`(6), `PopoutGroup`(0 direct, uses PopupLayer), `Ports.ts` itself (2).

JS legacy views in the same subsystem:
`aligntools.js`(14), `colorpicker.js`(12), `stringlist.js`(3), `filepicker.js`(4),
`fontpicker.js`(2), `imagepicker.js`(4), `identifierpicker.js`(2), `proplist.js`(3),
`marginpaddingview.js`(32), `resizingview.js`(33), `TypeView.js`(9, the row base class),
`propertyeditor.ts`(10, the panel host).

### Group B — standalone popups/panels

`importpopup.js`(9) — live: EditorPage, module/projectlibrarymodel, exportProjectComponets.
`confirmmodal.js`(1), `errormodal.js`(1) — used **only by popuplayer.js**; convert with it.
`createnewnodepanel.ts`(1), `componentports.tsx`(4), `ComponentTemplates.ts`(1),
`utils/exportProjectComponets.ts` (exportpopup.html host).

### Group C — canvas shell (unblocked by PLAT-001 landing)

`nodegrapheditor.ts`(1), `nodegrapheditor/CanvasDOMBindings.ts`(6),
`nodegrapheditor/ConnectionPopups.ts`(3), `nodegrapheditor/NodeGraphEditorNode.ts`(1),
`VisualCanvas/CanvasView.ts`(1), `lessonlayer2.ts`(6).
Small, surgical: mostly `$(template)` binds and `.on()` wiring at the shell edge.

### Group D — React files whose ONLY jQuery is feeding PopupLayer's API (19 files, 1–2 calls each)

`VersionControlPanel.tsx`, `AiChat.tsx`, `CommentForeground.tsx`, `VariablesSection.tsx`,
`ShowContextMenuInPopup.tsx`, `ShowInspectMenu.tsx`, `LessonLayerView.jsx`, `LessonItem.jsx`,
`TextStylePicker.jsx`, `PagesType.tsx`, `QueryEditor/utils.ts`, `visualstates.tsx`,
`variantseditor.tsx`, `colorstylepicker.jsx`, plus `ReactView.ts` itself.
**Key finding:** every one is `attachTo: $(ref)` or `content: { el: $(div) }`. They all
disappear mechanically once PopupLayer accepts raw `HTMLElement` — no per-file thought
needed. PopupLayer today genuinely requires jQuery objects (`.offset()`, `.outerWidth(true)`,
`.detach()`).

### Group E — the hub and the framework (endgame)

`views/popuplayer.js` (1,044 ln; popouts, modals, tooltips, toasts, drag/drop, activity,
file-drop; singleton + `PopupMenu`/`StringInputPopup`/`YesNoPopup` inner Views),
`popuplayer.d.ts` (its API is fully documented here — the rewrite contract),
`shared/view.js` + `view.d.ts`, `shared/ReactView.ts` (drops its `$(div)` wrapper last).

## 3. Conversion architecture

### The row idiom (already proven in-tree by `PagesType.tsx`)

A converted property row stays a `TypeView` subclass whose `render()` mounts a React
component into a fresh div and sets `this.el = $(div)`. The `$()` wrapper stays until
`Ports.ts`/`propertyeditor.ts` themselves convert (they call `.append(v.el)`, `.find()`).
This lets rows convert **one at a time** with zero host changes and regressions
attributable per-row. React components go in `DataTypes/<Name>/` per `noodl-core-ui`
conventions; shared row chrome (label, connected-dot, reset-to-default dot, tooltips —
today's `TypeView.render()` behaviour) becomes a `PropertyRow` wrapper component built
once in wave 1.

### PopupLayer strategy (decided, wave 4)

Rewrite as a TypeScript singleton with the **same public API** (`popuplayer.d.ts` is the
contract), rendering through a single persistent React root (portal-style layer stack).
During transition it normalizes `attachTo`/`content.el` inputs:
`const node = el.jquery ? el[0] : el` — so Group D callers can drop `$()` immediately
after it lands, and un-converted legacy callers (which pass jQuery-wrapped
`view.render()` output) keep working. `confirmmodal.js`/`errormodal.js`/`yesnopopup`/
`stringinputpopup` templates become React components inside it.
`View.showTooltip`/`hideTooltip` statics (used by `bindView`'s `data-tooltip`) die when
view.js dies.

### Ordering rationale

Leaves→host as the spec says, with one amendment: dead-code deletion first (free 12%+
of the call count), and the canvas group early (small, PLAT-001 fresh in memory,
regression harness for it already exists).

## 4. Wave plan

| Wave | Content | Deletes |
|---|---|---|
| 1a | Dead code: projectsview, newupdatepopup, .bak, .legacy, 11 orphan templates | ~170 `$(`, ~2,400 ln |
| 1b | Idiom: `PropertyRow` chrome component + convert `FontType`, `EnumType`, `TextAreaType` | 18 `$(` |
| 2 | Remaining DataTypes rows + pickers (fontpicker/imagepicker/identifierpicker/filepicker/colorpicker/aligntools/stringlist/marginpadding/resizing) + `TypeView.js` → TS React chrome | ~200 `$(` |
| 2c | `proplist.js`, `Ports.ts`, `propertyeditor.ts` (the hosts) | ~15 `$(` |
| 3 | Canvas shell group C + `componentports.tsx`, `createnewnodepanel.ts`, `ComponentTemplates.ts`, `importpopup.js`, `exportProjectComponets.ts` | ~35 `$(` |
| 4 | PopupLayer rewrite (+ confirm/error/yesno/stringinput popups) then Group D `$()` sweep | ~125 `$(` |
| 5 | Delete `view.js`/`view.d.ts`, de-jQuery `ReactView.ts`, drop script tags + vendored files, remaining templates, final grep, CHANGELOG | rest |

Each wave: behaviour checklist before, `npm run typecheck` + targeted tests + editor
smoke (run-editor skill) after, own commit(s) to `cline-dev`.

## 5. Template disposition (34 files)

Orphans, delete in wave 1a: `componentspanel.html`, `createnewnodepanel.html`,
`framesview.html`, `lessonlayer.html`, `lessonpopup.html`, `nodepanel.html`,
`templates/viewer.html` (editor copy; viewer-frame has its own), `projectsview.html`*,
`newupdatepopup.html`*, `propertyeditor/sizetools.html`, `propertyeditor/textstylepicker.html`.
(* orphaned by wave 1a's own deletions.)

Live templates die with their consumers in the wave that converts them:
propertyeditor/* (12) in waves 1b–2c; `componentports`, `importpopup`,
`importoverwritepopup`, `exportpopup`, `nodegrapheditor` in wave 3; `popuplayer`,
`confirmmodal`, `errormodal`, `stringinputpopup`, `yesnopopup` in wave 4.

## 6. Behaviour-preservation notes (filled per wave, before converting)

### TypeView chrome (applies to every Group A row)
- `.property-input-connected` hover → tooltip "port is connected…" (right side)
- `.property-changed-dot` click → `setParameter(name, undefined, {undo})` + reset;
  hover 1s → "Reset to default" tooltip
- input focus/blur → `.property-input-focused` class toggle
- `parentPort` styles: re-render on `ProjectModel.metadataChanged(styles)` when at default
- `getCurrentValue` returns `{value, isDefault}`; dynamic ports may lack `hasParameter`
- buttons blur on focus (global `bindView` rule — preserve per-component where relevant)

(Per-view checklists appended in each wave's section of §7.)

## 7. As-built log

- 2026-07-24: Wave 0 — this document. Baselines in §1.
- 2026-07-24: Wave 1a — dead code deleted (projectsview, newupdatepopup, `.bak`/`.legacy`,
  11 orphan templates + their orphaned CSS). 547→481 `$(` calls, 68→66 files. tsc clean.
- 2026-07-24: Wave 1b — idiom established. Found `BasicType.ts` was already React
  (PropertyPanelInputWithExpressionModal) and is the real precedent — converted rows set
  `this.el` to a **raw div** (no `$()` wrapper needed; jQuery `.append()` accepts nodes).
  Converted `EnumType.ts` (PropertyPanelInput/Select — the BaseDialog select makes the
  legacy `.property-drop-down-padding` scroll hack obsolete) and `TextAreaType.ts` (new
  core-ui `PropertyPanelTextArea`, autosize via CSS `field-sizing: content`, commit on
  blur only when the value actually changed — matches the legacy `change`-event
  semantics). Restored the lost **reset-to-default** behaviour at the primitive level:
  `PropertyPanelInput`/`PropertyPanelRow` now take `onReset` and render a clickable
  changed-dot in the label (legacy `.property-changed-dot` equivalent); wired it in
  BasicType, EnumType, TextAreaType. Verified live via CDP in the running editor:
  enum select commits + resets, textarea commits on blur, dots appear/disappear.
  Known deviations, deliberate: label hover-tooltips (`data-tooltip`) and the
  connected-port hover tooltip are not yet in PropertyPanelInput — tracked for wave 2;
  BasicType had already shipped without them.
  TextAreaType was the only `jquery.autosize` user — the vendored file is now orphaned
  (deleted in wave 5 with the script tags).
- 2026-07-24: Wave 2a (737101f) — FontType, ImageType, IdentifierType, ComponentType via new
  shared `DataTypes/PickerTypeView.ts` + `components/PickerTextInput.tsx`; SizeModeType via
  `components/SizeModeInput.tsx` (reuses global `size-icon`/`resizing-*` CSS). Verified live.
- 2026-07-24: Wave 2b (206fe66) — ColorType (`components/ColorInput.tsx`; module-level
  colorPicker rebinding preserved), SourceCodeType, CurveType (PropertyPanelButton),
  QueryFilter/QuerySorting/LogicBuilderHidden/ByobFilter de-jQueried (raw `el`).
  **data-identifier restored**: threaded through PropertyPanelBaseInput/TextInput/
  NumberInput/Button/TextArea (+`data-type="color"`); BasicType's earlier conversion had
  silently dropped it, breaking `_tryPropertyPanelInputInteraction` (node double-click
  focusPort). All converted rows now pass `dataIdentifier: this.name`.
- 2026-07-24: Wave 2c (3045544) — NumberWithUnits + Dimension via
  `components/NumberUnitInput.tsx` (unit-suffix parsing, Fixed checkbox for %).
- 2026-07-24: Wave 2d partial (90bcdb5) — VariableType via `components/VariableInput.tsx`;
  TabGroup show/hide now tolerates raw-element child els (needed once converted rows appear
  inside tab groups). Session ended here; count 481 → 379 `$(` calls.
- 2026-07-24: Wave 2d complete — IconType via new `components/IconInput.tsx` (label +
  clickable thumbnail box; IconPicker popout root now unmounted on close); TextStyleType
  rewritten as a `PickerTypeView` subclass (create-style UndoQueue block and sibling
  child-port refresh preserved verbatim; picker live-filter re-render kept; Enter closes
  the popout via a new `PickerTypeView.onEnterPressed` hook — no-op for the other pickers);
  LogicBuilderWorkspaceType via two stacked `PropertyPanelButton`s (dropped its injected
  `.property-editor-group-name:empty` CSS hack — that class exists nowhere in the repo, the
  rule was dead); CodeEditorType bindView shell removed (`this.el` is now the React Property
  div; `attachTo: $(el)` remains for the wave-4 sweep). 379 → 360 `$(` calls, 66 → 62 files.
  **Undo-corruption bug found and fixed while verifying** (noodl-core-ui, pre-existing, NOT
  from this wave's conversions): `PropertyPanelTextInput`, `PropertyPanelNumberInput`,
  `PropertyPanelLengthUnitInput` and `PropertyPanelPasswordInput` all called `onChange` from
  their `useEffect(..., [value])` — so every property-panel mount/re-render committed each
  row's own value back through `setParameter`, pushing a phantom "edit parameter" undo entry
  per row, and undoing anything re-triggered the commits: app undo was effectively a no-op
  while the property panel was open. Fix: the effect now only syncs display state, and
  blur/Enter commits fire `onChange` only when the value actually differs (matches legacy
  change-event semantics). Verified live via CDP: selecting a node pushes 0 undo entries
  (was 4+); create-text-style pushes exactly 1; undo reverts it and redo reapplies, no
  cascade. Also smoke-tested: TextStyle picker open/filter/create + Font Size changed-dot
  absorbed into style and restored on undo; IconType row + picker popout on a Button node's
  dynamic `iconIconSource` port; LogicBuilder both buttons + generated-code modal open/close;
  CodeEditor Edit-button popout open/close. tsc clean in noodl-editor and noodl-core-ui;
  0 renderer exceptions.
- 2026-07-24: Wave 2e part 1 (6e8d252) — the four composite widgets to React:
  `AlignToolsInput` (icon set generated from the template into `components/alignToolsIcons.ts`;
  values now refresh on `parametersChanged` so undo updates the icons — the legacy view never
  did), `ResizingInput` (constraint rules extracted to a pure `computeResizingModes`; compact
  W/H unit inputs), `MarginPaddingInput` (drag-to-adjust + inline edit box; a completed drag
  no longer also opens the edit box via a `suppressClick` guard), `StringListInput` (inline
  rename/delete/add via `StringInputPopup`). Legacy `aligntools.js`/`resizingview.js`/
  `marginpaddingview.js`/`stringlist.js` + 4 templates deleted. 360 → 279 `$(`.
  **Did NOT reuse core-ui `PropertyPanelMarginPadding`** — it models CSS margin/padding
  (top/left/right/bottom nesting) but Noodl's marginpadding widget is 8 independent named
  drag-handles bound to arbitrary ports; wrong shape, faithful conversion instead.
- 2026-07-24: Wave 2e part 2 (4dd8d0a) — pickers + proplist. New shared `components/
  ContentPicker.tsx` (header + folder-group labels + clickable items; `sortMode` folder vs
  nameDesc) replaces fontpicker/imagepicker/identifierpicker/filepicker. `PickerTypeView.
  openContentPicker()` owns the popout: it returns an `addItems` handle so async loaders
  (thumbnails, font data URLs) stream in, and `filterPicker` re-renders the picker live.
  Font @font-face injection + common-font list moved to `components/fontItems.ts`, reused by
  `reactcomponents/propertyeditors.jsx`'s `FontProperty` (which also built a FontPicker —
  its `require('.../fontpicker')` is gone). `PropListInput` hosts each item's child property
  rows (appends the raw/jQuery `view.el` into a `.props` div) and keeps the PopupLayer
  drag-reorder. Legacy 5 views + 5 templates deleted. 279 → 262 `$(`, 62 → 52 files.
  Verified live via CDP: font picker open/filter(input-event, not cdp `type`)/select/reset
  on a Text node; proplist add/rename/delete on a Script (`Javascript2`) node's `scriptInputs`.
  **Smoke trap:** cdp `type` re-focuses the input and closes the popout — drive the filter by
  dispatching a native `input` event with the value setter instead.

- 2026-07-24: Wave 2f — the property-editor **hosts**. `TypeView.js`+`TypeView.d.ts` →
  `TypeView.ts`: the hand-wired chrome (connected-port tooltip, `.property-input-focused`
  toggle, `.property-changed-dot` click/tooltip) is gone — the React rows own it — leaving
  the model-side behaviour. `BooleanType` → `PropertyPanelInput` (Checkbox), the last
  `cloneTemplate` row. `TabGroup` → `components/PropertyTabs.tsx` (tab name doubles as the
  icon class) with the child-view container built in code. `PopoutGroup` → `PropertyPanelRow`
  + `PropertyPanelButton`. `Ports.ts` → new `components/PropertyGroups.tsx` renders the group
  chrome and hosts each group's row elements via a `useLayoutEffect` (`RowHost`); `el` is now
  a raw div and the input-focus z-index hack is a `focusin`/`focusout` pair on it.
  `propertyeditor.ts` builds its shell in code (`buildShell()`). `Frame.tsx` now accepts a raw
  `el` as well as a jQuery one; `view.d.ts`'s `el` widened to `HTMLElement | JQuery` (the two
  views that still need jQuery — `componentports`, `popuplayer` — pin it locally).
  Deleted `templates/propertyeditor/propertyeditorports.html` (the last multi-template file)
  and `propertyeditor.html`; only `colorpicker.html` is left. 262 → 236 `$(`, 52 → 49 files.
  **Regression found and fixed while converting** (introduced by waves 1b–2e, not by this
  one): the converted rows never chain to `TypeView.render()`, so the `parentPort` watch —
  "this row's default comes from a text style, refresh it when the style changes" — had been
  dead for every React row. It is now `TypeView.bindStyleDefaultWatch()`, called centrally
  from `Ports.getViewGroupsFromPorts()` for every row it creates, and it uses its own
  listener group so a subclass's `EventDispatcher.off(this)` cannot take it with it.
  Base `resetToDefault()` (which does not reset — it re-reads the model) now calls the row's
  `renderReact()`, so rows without an override no longer hit `this.$('input')` on a raw el.
  Incidental fix: `PropertyEditor.render()` used to rebuild its shell, which left
  `variantsRoot`/`visualStatesRoot`/`elementStyleRoot` pointing at detached containers on any
  re-render (AiChat's `onUpdated`); the shell is now stable so those sections survive.
  Deliberate deviation: `onEditVariant`/`onDoneEditingVariant` hid `.property-editor-label-and-
  buttons`, which lives in `NodeLabel.tsx` **outside** `PropertyEditor.el` — `this.$()` never
  matched it, so the calls were no-ops and are simply gone.
  Verified live via CDP (tsc clean, 0 renderer exceptions): shell is
  `.sidebar-panel > .sidebar-property-editor > {variants, element-style-section, visual-states,
  groups}` with all four populated; a Text node renders 13 group headers and 30 rows; a Group
  node renders both tab groups (`borders-*`, `corners-*`) with the right tab selected, and
  clicking `corners-top-left` swaps which row is visible **and** moves the `selected` class;
  a Button node's "Text Style" popout group opens a nested `Ports` view (300px, 7 rows) and
  the click no longer closes it. BooleanType: toggling **Visible** writes `false`, shows the
  changed dot, and pushes exactly one "edit parameter"; its reset dot restores the default and
  pushes "reset parameter". Selecting three nodes in a row still pushes **0** undo entries
  (the wave-2d fix survives the host rewrite). 21 `ProjectModel.metadataChanged` listeners are
  live, 16 of them the new per-row style watchers, and emitting `{key:'styles'}` refreshes
  every row without throwing.
  **Smoke traps:** React commits asynchronously, so anything asserted straight after a click
  (e.g. the tab's `selected` class) needs a second CDP round-trip. `npm run dev:debug` only
  launches Electron on an error-free compile, and ts-loader's watch can hold a **stale** copy
  of a file another session rewrote — the fix is to restart the dev stack, not to chase the
  error. The launcher card's root class is `LauncherProjectCard-module__Details`, not `Root`.
  Fixtures can be created without fighting the node picker:
  `window.__nodeGraphEditor.createNewNode({name:'Group'}, {x,y})` then `selectNode(findNodeWithId(id))`;
  `UndoQueue`/`EventDispatcher` singletons are reachable by grabbing webpack's require via
  `webpackChunknoodl_editor.push([[Symbol()],{},r=>window.__req=r])`.

## 8. Handoff — next session starts here

Remaining, in the planned order (waves 2d–2f complete; count now 236 `$(` / 49 files):

1. **Wave 2g — the colour picker**, the last of Group A: `DataTypes/ColorPicker/colorpicker.js`
   (12 `$(`) + `templates/propertyeditor/colorpicker.html`, plus `colorstylepicker.jsx`(1) and
   `ColorType.ts`(3, all `attachTo`/`content.el` feeding PopupLayer — those go in wave 4).
   It was skipped in wave 2b, which converted the `ColorType` row but left the picker popout.
2. **Wave 3**: canvas group (CanvasDOMBindings 6, ConnectionPopups 3, nodegrapheditor 1,
   NodeGraphEditorNode 1, CanvasView 1, lessonlayer2 6), `componentports.tsx`(4),
   `createnewnodepanel.ts`(1), `ComponentTemplates.ts`(1), `importpopup.js`(9) + its
   templates, `exportProjectComponets.ts` (exportpopup.html).
3. **Wave 4**: PopupLayer rewrite (contract = `popuplayer.d.ts`; §3 strategy: same API, one
   React root, normalize `attachTo`/`content.el` accepting raw elements) then sweep the 19
   Group D files' `$()` calls; convert confirmmodal/errormodal/yesnopopup/stringinputpopup.
4. **Wave 5**: delete `shared/view.js`+`view.d.ts`, de-jQuery `ReactView.ts`, remove the two
   `<script>` tags from `src/editor/index.html` + `src/assets/lib/jquery-min.js` +
   `jquery.autosize.min.js`, delete remaining orphan templates, repo-wide grep, CHANGELOG
   in the task doc (record before/after counts: baseline 547/68), update PROGRESS.md.

Working notes for the next session:
- Smoke-test flow: `npm run dev:debug -- --quiet`, wait for "launching Electron" in
  `.logs/dev.log` + 35s; `npm run cdp -- health`; open the "test" project by tagging its
  launcher card (`h2` text 'test' → closest `LauncherProjectCard-module__Root`) and cdp click;
  select the Text node by dispatching mousedown/up/click on the canvas at its screen coords
  (screenshot first — window size varies); property rows are found via
  `[class*=PropertyPanelInput-module__Label]`. Use `--target=dashboard` (URL substring) —
  `--target=NodeGX`/default fall back to the wrong page after navigation. Don't use
  `cdp reload` (the app can't cold-boot from the rewritten dashboard URL and HMR can leave
  the panel in a fake "Aw, Snap!" state) — kill Electron + relaunch dev:debug instead.
  React blur commits need `focusout` (bubbling), not `blur`.
- Ports.ts re-creates all row views on every renderGroups (no reuse), so per-instance
  `render()` runs once; guarded `createRoot` is safe. Old row views and their React roots are
  still not disposed on panel re-render — the legacy `el.html('')` dropped them the same way,
  so wave 2f left the leak alone rather than change lifetimes while converting the hosts.
  Worth a dedicated pass (`Ports.renderGroups` could dispose `this.views` before rebuilding).
- Anything that measures the property rows must now wait a frame: `Ports.renderGroups`
  renders through React, so the rows land in `RowHost`'s layout effect, not synchronously.
  The scroll-position restore already does this via `setTimeout(0)`.
- Known deliberate deviations so far: label hover-tooltips (`data-tooltip`) and the
  connected-input hover tooltip are not reproduced in React rows (BasicType precedent);
  sizemode tooltips use `title=`. Wave 2f did not add them — a PopupLayer-backed tooltip in
  `PropertyPanelInput` is best done after the wave-4 rewrite, when PopupLayer is React.
- **Shared working tree:** PLAT-003 (and any other parallel session) edits the same checkout.
  `npm run dev:debug` only launches Electron on an **error-free** webpack compile, so an
  unrelated in-flight TS error elsewhere blocks the smoke test entirely. Check
  `grep "ERROR in" .logs/dev.log` before blaming your own change.
