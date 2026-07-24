# PLAT-002 NOTES — Retire the jQuery Islands

Status: waves 1a–4 landed 2026-07-24. **547 → 51 `$(` calls, 68 → 12 files.** Only wave 5
(the `View` framework, the utility one-liners and the vendored jQuery itself) is left; §8 has
the file-by-file list. §7 is the as-built log.

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

Waves 1a–4 are done (§7). Wave 4 landed the whole of its row: PopupLayer, its four popups
and the Group D sweep, plus `router.tsx` and `whats-new.ts` pulled forward from wave 5.

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

- 2026-07-24: Wave 2g + wave 3 (partial) (61414da) — **Group A is done.**
  `colorpicker.js` + `templates/propertyeditor/colorpicker.html` → `colorpicker.ts`: iro
  stays imperative (it owns a canvas and call sites drive `setColor`/
  `setColorChangedListener` synchronously right after `render()`, so it cannot move into a
  React effect), and only the hex/opacity row is React (`components/ColorPickerFields.tsx`).
  Those fields commit on blur/Enter **only when the value changed** (legacy `change`
  semantics) and re-sync on a `revision` prop, which is what re-formats an invalid entry
  the way the legacy `_setInputFieldsToColor` did. `colorstylepicker.jsx` now disposes the
  picker it opens (it never did — iro listeners leaked per style edit).
  **PopupLayer normalization brought forward from wave 4** (the positioning half of the
  rewrite is untouched): `showPopup`/`showPopout`/`showModal` accept `content.el` as a raw
  element (`content[0] || content`, `detach?.() : remove()`) and `attachTo` as a raw element
  (new `attachToRect()` helper — jQuery objects still go through `offset()`/`outerWidth(true)`,
  so existing call sites are bit-identical). That let 15 call sites drop `$()` mechanically.
  Wave 3 proper: `CanvasDOMBindings` uses native listeners keyed by an `AbortController` per
  canvas (replaces jQuery `.off(type)` on the resize rebind; also fixes the mouseover
  `topLeft` handler being bound 5× — it was inside the event loop), `lessonlayer2`'s
  image/video loading is native DOM, and `componentports.tsx` (the "Inputs"/"Outputs" panel
  reachable from Component Inputs/Outputs, Globals and the deprecated animation node) is
  React: `panels/componentports/ComponentPortsView.tsx` owns the rows, inline rename,
  PopupLayer drag/drop and the footer, the class keeps the model logic, and
  `templates/componentports.html` is deleted. 236 → 192 `$(`, 49 → 39 files.
  **Bug found while smoke-testing and fixed** (pre-existing, not from this wave): the
  property panel's `NodeLabel` committed the label on *every* blur, and `setLabel` pushes an
  undo entry unconditionally — so merely opening a popout pushed a "change label" entry and
  the user's next Cmd+Z undid nothing. Now it commits only when it was actually editing and
  the text changed. Same failure mode as the wave-2d core-ui input bug; worth grepping for
  more `onBlur → commit` without a value-differs guard.
  **Verified live via CDP** (scripted, one connection; 15/17 checks green, the 2 reds were
  the test driving a stale HMR bundle): colour popout opens with the iro box + 2 sliders at
  228×343 with the `.IroBox` radius override applied, shows the current colour, a hex commit
  writes the parameter and pushes **exactly one** "edit parameter" entry, a blur with no
  change pushes **none**, an opacity commit writes `#RRGGBBAA`, the popout closes; the ports
  panel renders header "Inputs" + the Port/Group footer for a Component Inputs node, the
  add-port `StringInputPopup` opens anchored above the button, and the raw-element
  `attachTo` measures the same rect as `$(btn).offset()/outerWidth(true)` (±0.1px).
  **Smoke traps (new):** `editor.selectNode()` takes a `NodeGraphEditorNode` **view**, not a
  model node — use `ed.selectNode(ed.findNodeWithId(model.id))`. `NodeLibrary.instance` can
  still be empty right after boot (it loads `window.NodeLibraryData` in its constructor);
  call `NodeLibrary.instance.reload()` before asserting on property rows. Several panels are
  `.sidebar-panel`, so scope queries (the ports panel is the one with
  `.sidebar-panel-footer-button`). React drops synthetic `keypress` events with charCode 0,
  so `KeyboardEvent('keypress')` from CDP never reaches an `onKeyPress` handler — dispatch
  `keydown` (and prefer `onKeyDown` in new code). Editing a file only reaches the running
  app if webpack recompiles **and** the owning module is re-evaluated: a class that renders
  a React component holds the old function across HMR, so restart Electron before trusting
  a UI change.

- 2026-07-24: Wave 3, import/export popups (940e41d) — `importpopup.js` +
  `importpopup.html` + `importoverwritepopup.html` + `exportpopup.html` →
  `importpopup.ts` + `importpopup/ImportPopupView.tsx`. The three templates were the same
  list with different copy, so the view takes a `variant: 'import' | 'overwrite' | 'export'`
  and the four call sites pass that instead of a template require. Folder open/import state
  moved onto the popup object (it used to live in the DOM, kept alive by `bindView`'s
  `watch()` bindings), and `buildTree()` reproduces the legacy append order (items sorted by
  name, folders created on demand, parents first). Kept faithfully: the collisions variant
  omits text styles and shows the "cannot be undone" warning, export keeps sticky section
  labels and the 700px scroll area, an item that is both implicit and explicitly imported
  still gets **both** marker classes, cancel still fires on a 10 ms timeout, and consumers
  now do `popup.el.style.width = '500px'` instead of `.css()`. 192 → 183 `$(`, 39 → 38 files.
  tsc + eslint clean (ratchet: 209 below baseline). **Not smoke-tested** — the import flow
  needs a second project to import from, and the shared dev stack was unavailable.

- 2026-07-24: Wave 4 (4907242) — **PopupLayer is TypeScript.** `views/popuplayer.js` +
  `popuplayer.d.ts` (1,044 ln, 101 `$(`) → `views/popuplayer.ts`, same public API, shell
  built in code (`buildShell()`), native DOM throughout. Decisive design call: the layer
  hosts *foreign* content elements, so it is **not** a React root — a portal layer would only
  add indirection around imperative measurement. React is used where there is a component:
  `PopupLayer/ConfirmModal.tsx` (confirm + error modals) and `PopupLayer/StringInputPopup.tsx`.
  `confirmmodal.js`, `errormodal.js` and 5 templates deleted; `YesNoPopup` had **no callers
  anywhere** and went with its template and its CSS block in `assets/css/style.css`.
  Geometry is preserved by construction: `outerSize()` reproduces jQuery `outerWidth(true)`
  (margin box for popups/popouts, border box for tooltips — the legacy code measured them
  differently and that difference is kept), and `attachToRect()` still accepts a jQuery anchor
  for the views that have not converted. Outside-click handling keeps the legacy listener
  *registration order* (popup → popout → modal → file-drop; the handlers depend on each
  other's state within one event) and the strict-descendant semantics of
  `.parents().is(el)` as `isInside()`. Drag listeners moved to an `AbortController` instead
  of jQuery's global `.off('mousemove')`, which used to rip out every other body handler.
  Group D swept: 23 `attachTo: $(x)` call sites lost the wrapper, `router.tsx` (4) and
  `whats-new.ts` went native. **236 → 51 `$(`, 38 → 12 files.** tsc clean, 1060 specs green,
  lint ratchet −275, TSFixme −19.
  **Bug fixed while converting**: the comment editor ran its text through the
  `split(',').map(trim).join()` that the port-name call sites need — "Hello, world" was saved
  as "Hello,world". `StringInputPopup` now takes `splitCommaSeparated` (false for comments)
  and seeds `value` through options instead of a jQuery `.val()` after `render()`.
  **Trap found in the running app**: `root.render()` is asynchronous, but `showPopup`
  measures its content the instant it is appended — a React-rendered popup measured 0×0.
  `StringInputPopup.render()` therefore uses `flushSync`. The same trap still applies to the
  call sites that build their own root (Pages, TextStylePicker, …) — pre-existing, listed
  below.
  **Trap for future conversions**: turning a legacy CJS view into an ESM TS module breaks
  every `require('…/popuplayer')` (they get the namespace, so `PopupLayer.instance = …`
  silently writes to the wrong object). Six source files and **two spec files** needed
  `.default`; grep `packages/noodl-editor/tests` too, not just `src`.
  Deliberate deviations, all recorded: the no-op `popoutEl.find('.popup-layer-popout')
  .css({visibility})` line is gone (the template root *is* that element, so the selector never
  matched); `View.showTooltip`/`hideTooltip` are no longer assigned because no remaining
  template carries a `data-tooltip` attribute; the deprecated `showToast`/`showActivity`
  center on the border box rather than jQuery's content-box `.width()`; the default
  `arrowColor` stays `'313131'` (no `#`, so it is an invalid declaration that the browser
  drops — exactly as before).
  Incidental fixes: `SizeModeInput`'s icon array had no React keys, and
  `PropertyPanelBaseInput` rendered a null `value` — both were logging on every property
  panel render.
  **Verified live via CDP** (cold boot, 0 renderer exceptions): shell builds in the legacy
  child order; tooltip x/y match the legacy formula to 0.01px; a `StringInputPopup` opened
  with `attachTo` measures 532×324, centres on the anchor, points its arrow down, focuses its
  textarea, and returns its value unsplit; screen-center popups land at exactly
  `(w/2 − cw/2, h/2 − ch/2)` and dim the background; `showConfirmModal` renders, dims,
  fires `onConfirm`, closes, undims and unmounts its root; Escape closes a modal; a popout
  positions from `attachToPoint`, colours its arrow, sets `has-popouts`, and the
  ResizeObserver resizes + repositions it when its React content arrives; clicking **inside**
  a popout keeps it open and clicking outside closes it and clears the blocker.
  **Owed wave-3 verification, partly paid**: the **export** variant of the import popup was
  driven (`exportProjectComponents()` → sticky "COMPONENTS" label, `#__page__` folder with
  indented children, checkboxes, EXPORT/CANCEL, 500px modal). The import and collisions
  variants still need a second project.

## 8. Handoff — next session starts here

Waves 1a–4 are complete. **51 `$(` calls across 12 files remain**, and every one of them
is wave 5:

| File | `$(` | What it needs |
|---|---|---|
| `shared/view.js` + `view.d.ts` | 32 | delete; last consumers are `nodegrapheditor.ts` (one `bindView`) and `ReactView.ts` |
| `utils/filesystem.js` | 5 | `#__hiddenFileInput__` create/remove → native DOM |
| `utils/thumbnailcache.js` | 3 | `#tnumbnailCacheCanvas` → native DOM |
| `utils/docs-parser.ts` | 3 | `$('<div>' + html + '</div>')` + `.each` → `DOMParser`/`querySelectorAll` |
| `utils/keyboardhandler.ts` | 2 | `$(':focus')` → `document.activeElement` |
| `views/nodegrapheditor.ts` | 1 | the last `bindView($(template))` + `templates/nodegrapheditor.html` |
| `views/nodegrapheditor/CanvasDOMBindings.ts` | 1 | `editor.$('#nodegraphcanvas')` — falls out when nodegrapheditor's `el` is raw |
| `views/nodegrapheditor/ConnectionPopups.ts` | 1 | same lookup |
| `shared/ReactView.ts` | 1 | `this.el = $(div)` → raw div; only subclass is `PopupLayer/PopupMenu` |
| `utils/fontloader.js` | 1 | `$(document.head).append` |
| `pages/EditorPage/EditorPage.tsx` | 1 | commented-out line, just delete |

Then: remove the two `<script>` tags from `src/editor/index.html` and delete
`src/assets/lib/jquery-min.js` + `jquery.autosize.min.js` (orphaned since wave 1b),
`@types/jquery` from `packages/noodl-editor/package.json`, repo-wide grep, CHANGELOG in
the task doc (before/after: baseline **547 `$(` / 68 files**), update PROGRESS.md.

Owed verification carried forward: the **import** and **collisions/overwrite** variants of
`importpopup.ts` still have not been driven in the running app (the export variant was, in
wave 4) — they need a second project to import from. Check the tree indentation, the
implicit-dependency markers, folder toggles, and that the collisions popup still filters
what gets imported.

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
  sizemode tooltips use `title=`. PopupLayer's `showTooltip` is now plain TS and takes a raw
  element as `attachTo`, so a `PropertyPanelInput` hover tooltip is a small, self-contained
  follow-up whenever it is wanted.
- **`showPopup` measures its content synchronously**, so any caller that renders its content
  through React must flush before showing it. `StringInputPopup` does (`flushSync`); the
  call sites that build their own root — `Pages.tsx`, `TextStylePicker.jsx`,
  `propertyeditors.jsx`, `useComponentActions` — do not, so their popup box is sized 0×0
  while the content (absolutely positioned) still paints. Pre-existing, unchanged by wave 4,
  and worth a sweep: `flushSync(() => root.render(...))` at each site.
- A `value` prop on `input` should not be null warning still fires once on the first
  property-panel render. `PropertyPanelBaseInput` was fixed in wave 4, so the remaining
  source is one of the editor-side inputs (`PickerTextInput`/`NumberUnitInput`/`ColorInput`/
  `VariableInput`/`ResizingInput`); React de-duplicates the warning per element type, so it
  cannot be caught by re-selecting a node — catch it on a cold boot instead.
- **Shared working tree:** PLAT-003/PLAT-004 (and any other parallel session) edit the same
  checkout. `npm run dev:debug` only launches Electron on an **error-free** webpack compile,
  so an unrelated in-flight TS error elsewhere blocks the smoke test entirely. Check
  `grep "ERROR in" .logs/dev.log` before blaming your own change — in wave 4 the *Viewer*
  bundle had 12 errors from PLAT-003 while the Editor bundle compiled and launched fine, so
  read the `[Editor]`/`[Viewer]` prefix before reacting. Commit with an explicit pathspec
  (`git commit -- <your paths>`); the index will contain other sessions' staged work.
- Editing files while the app is running can leave the renderer in the "Aw, Snap!"
  (`chrome-error://chromewebdata`) state mid-session; `webpackChunknoodl_editor` disappears
  and every cdp eval fails. Kill Electron + `dev:debug` and relaunch — do not chase it.
