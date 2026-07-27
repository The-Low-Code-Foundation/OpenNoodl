# PNL-004 — Container-query panel layout + shared `PanelRow`: notes

**Status:** 🟡 **Code complete, not live-verified.** Every gate that can be run from a worktree is
green; every gate that needs a running editor is owed. The live-QA checklist at the bottom is the
work remaining, and the "could not verify" list is honest rather than short.
**Spec:** [PNL-004-CONTAINER-QUERY-LAYOUT.md](./PNL-004-CONTAINER-QUERY-LAYOUT.md)

## The premise held, with one correction

The spec said no panel declares a container query. Confirmed: `grep -rn "container-type\|@container"`
over `noodl-core-ui/src` and `noodl-editor/src` returned **nothing** before this task. Both reported
defects reproduce by reading, and both are now fixed.

The one correction is to the *mechanism* of the second defect. The spec says the settings labels wrap
"because the label column is a fixed width". It is not fixed —
[`PropertyPanelInput.module.scss`](../../../packages/noodl-core-ui/src/components/property-panel/PropertyPanelInput/PropertyPanelInput.module.scss)
gives `.Label` **`width: 37%`**, plus `overflow: hidden` and `max-height: 28px`. So it *is*
proportional, and it still fails, for a reason worth stating: at a 300px panel 37% is ~99px and "API
Key (saved)" needs ~96px at 12.5px, so it wraps — and then the `max-height` clips the second line.
A proportional column does not help, because the proportion is wrong at every width; what helps is
changing the *layout* below a threshold, which is what a container query is for. The conclusion the
spec reaches is right; the sentence explaining it was not.

## The container names, and the number nobody should trust by accident

Declared in [`BasePanel.module.scss`](../../../packages/noodl-core-ui/src/components/sidebar/BasePanel/BasePanel.module.scss):

| Element | Container | Who queries it |
|---|---|---|
| `.Root` — the panel frame, header included | `panel-frame` | PNL-005 (the header's `max-width: 359px` breakpoint) |
| `.ChildrenContainer` — the scrolling body | `panel-body` | `PanelRow`, and every card that opts in |

Written as `container-type` + `container-name` longhands rather than the `container: name / type`
shorthand, so Sass never has to decide what the `/` means. Computed values are identical; the
shorthand is in a comment beside them.

**The band numbers are not panel widths.** A size query resolves against the query container's
*content box*, and `panel-body` is the element carrying the panel's 16px horizontal inset, inside
`.Root`'s 1px border. So:

```
panel-body content box  ≈  panel width − 34px
```

The bands are stated in the mock's terms — compact `< 340`, default `340–559`, wide `≥ 560` — and are
kept **verbatim** because PNL-005 is writing against them concurrently and changing them unilaterally
would desync the two. In panel-width terms they therefore land at roughly **374px** and **594px**.

This matters for one acceptance item. Item 2 asks for two-column-with-inline-help "at 560px". At a
560px panel the body is ~526px, which is the *default* band: two-column, but with the 104px column and
the help under the control rather than the 132px column. If the mock's numbers were meant as panel
widths, subtract 34 in
[`panel-bands.scss`](../../../packages/noodl-core-ui/src/components/sidebar/PanelRow/panel-bands.scss)
— one file, one place, every consumer follows. **Flagged rather than decided**, because it is a
cross-task contract and not mine alone.

### `container-type: inline-size` implies `contain: layout style inline-size`

Two consequences were checked before adding it, because PNL-001's comment block at the top of that
file is load-bearing and PNL-009's modes depend on `position: fixed` working:

- **`.Root` becomes the containing block for `position: fixed` descendants.** Every full-screen
  overlay reachable from a `BasePanel` panel escapes the panel first, so nothing fixed is left
  in-tree: `BaseDialog` portals to `.dialog-layer-portal-target` (which is `Modal`, `MenuDialog`,
  `ConfirmationDialog`, and therefore `AddBackendDialog`), and `LocalBackendCard`'s seven surfaces
  `createPortal` to `document.body`. Verified by enumerating every `position: fixed` in
  `views/panels/` and checking which of those files sit under a `BasePanel`.
- **It contains inline size only, never block size.** `height: 100%`, `min-height: 0` and the flex
  chain PNL-001 fixed are untouched.
- **It does not affect PNL-009.** Those modes make `SideNavigation .Panel` — an *ancestor* of
  `BasePanel .Root` — `position: fixed`. Containment on a descendant cannot defeat that.
- **Stacking contexts are a non-issue** because every dropdown in these panels portals out.
  `PropertyPanelSelectInput` goes through `BaseDialog`; `.ChildrenContainer` already had `z-index: 0`
  whenever it scrolled.

## `PanelRow`

[`components/sidebar/PanelRow`](../../../packages/noodl-core-ui/src/components/sidebar/PanelRow/).
Built and reviewed before anything was migrated, as the spec asks, because PNL-006 and PNL-008 both
consume it.

```
label            required, even when hidden — it is the row's accessible name
isLabelHidden    sr-only label; the row becomes role="group" aria-label=<label>
variant          Control (default) | Actions | Toggle
children         the control(s) — a wrapping flex row, so a cluster is the same shape as one input
helpText         guidance in the control column; full width when compact
fxSlot           trailing affordance that never shrinks or wraps away (expression toggle, browse)
isStacked        force label-above-control at every band (a textarea, a code field)
isChanged        accented label
onReset          with isChanged, the reset dot
htmlFor          makes the label a real <label for>, so clicking it focuses the control
testId
```

Three API decisions worth their reasons:

- **The *default* band is the unqueried baseline.** A `@container panel-body (…)` query with no such
  ancestor never matches, so a row outside a panel — a story, a modal, one of the 15 panels PNL-005
  has yet to migrate — would collapse to whatever the queries left it. Writing the middle band as
  plain declarations means it degrades to a sane two-column row instead.
- **A hidden label is a `role="group"` label.** `htmlFor` is the better association, but it needs the
  caller to give the control an id and none of the existing call sites do. A hidden label with no
  association is no label at all, so the row names itself.
- **Variants, not a second component.** The spec forbids a second row component and it was not
  needed: `Toggle` (label takes the row, control hugs the trailing edge, never stacks) and `Actions`
  (children get `flex: 1 1 84px`) are the two shapes the settings panels actually contain.

A defect in my own first version, caught by re-reading rather than by a test: `grid-template-areas`
creates the label track whether or not anything occupies it, and the sr-only label is absolutely
positioned — so **every hidden-label row grew a 104px hole beside its control**. Fixed by putting
`is-label-hidden` on the row and guarding it out of both band rules (`1a6084ea`). Worth flagging
because it is exactly the class of bug that a story would show and a unit test would not.

### Where the bands live

[`PanelRow/panel-bands.scss`](../../../packages/noodl-core-ui/src/components/sidebar/PanelRow/panel-bands.scss)
— mixins `compact`, `default-band`, `wide`, `frame-narrow`, plus `$label-column` / `$label-column-wide`.

`styles/scss-mixins/` would be the better long-term home, but `styles/` is outside this task's
territory this wave and a new shared directory is exactly the sort of thing two concurrent agents
collide over. **Promote it after the wave settles.** Editor `.scss` can `@use` it today via the
`@noodl-core-ui` webpack alias, the same way `@scss-mixins/layout` already works.

## What changed, by area

### Backend Services — the reported overflow (`f3c881d4`)

`.Actions` was a bare `HStack` — one non-wrapping flex line, `gap: 16px` — holding up to **eleven**
controls when running (the spec says five; that was true before Triggers, Email, Search and Sign-in
were added). Now:

- The row is `flex-wrap: wrap; gap: 6px; min-width: 0`.
- **Start/Stop owns its own row** (`flex: 1 1 100%`), per the mock and per §4 of the spec.
- Data / Schema / Access share the wrapping row beneath it at `flex: 1 1 84px` — 84px is the mock's
  basis: wide enough for "Schema", narrow enough that three fit at 340px.
- **Triggers, Email, Search, Sign-in, Export and Delete move behind `⋯`**, via the existing
  `showContextMenuInPopup`. Delete is `isDangerous` and keeps both its `delete-local-backend-<id>`
  test id and its "stop the backend first" disabled rule (now with a tooltip saying why).
- The endpoint URL gets `flex: 1 1 auto; min-width: 0` and ellipsises, with the whole row still
  click-to-copy and a copy glyph replacing the "(click to copy)" text that was competing for width.
  The `(click to copy)` affordance moves into the row's `title`.
- Both cards declare `panel-body` **on themselves**, so their rows follow the card's width rather
  than the panel's — the mock's point about a card in a 268px docked panel and a 600px floating one.

`BackendCard` got the same treatment (its four-button row had the same defect), plus
`overflow-wrap: anywhere` on the connection-error line, which is unbounded server text.
`CloudServicesEndpointSection` and the panel's create-backend form got wrapping button rows and an
ellipsising endpoint.

### Settings panels (`7b279832`)

`AiSettings`, `AppearanceSettings`, `Runtime`, `Sitemap` and `Deploy` move from `PropertyPanelRow` to
`PanelRow`. Their free-floating `<Box><Text>…` explanations become `helpText`, which is what they
were.

The **App Setup** sections were the same idea a third time, hand-rolled: every label an inline-styled
`<label>` stacked above its field — i.e. the compact layout applied at every width, whether or not
there was room for better. Identity, SEO and PWA now go through `PanelRow`; what is left in their new
`sections.module.scss` is only what `PanelRow` deliberately does not own — a textarea, a native
select, a colour swatch beside a hex field.

### Exemptions, stated rather than hidden

- **`VariablesSection` (792 lines) gets a reflow-only pass.** Its three horizontal groups wrap, the
  user-supplied key ellipsises instead of pushing the delete button out of the card, and its add-form
  labels join `PanelRow`. Its hand-rolled `<button style>` chrome is a *restyle*, which the spec puts
  out of scope ("this task changes how cards reflow, not what they contain"). One exception taken: a
  hardcoded `#dc3545` is now `var(--theme-color-danger)`, because the phase's red-is-danger-only law
  is cheap to honour here and the button is in fact a destructive one.
- **`AddBackendDialog` is untouched.** It is a portaled `Modal`, not panel-width-constrained. Its
  `HStack`s are correct where they are.
- **`ProjectSettingsPanel`'s legacy `Ports` view** is phase-9 (STYLE-004) territory and is not
  migrated. See the note below on what breaks at 240px.
- **`Stack` / `HStack` are not changed.** `HStack` is one non-wrapping flex line with `height: 100%`,
  used across the whole editor; making it wrap would be an editor-wide behaviour change well outside
  this task. The panels use local wrapping rows instead, and each one says so in a comment.

### The legacy `DataTypes/*` at 240px — what the spec asked me to note

Static reading only; I could not run the property editor. Of the 30 `DataTypes/*` views, the ones that
build DOM directly (`MarginPaddingType`, `AlignTools`, `Dimension`) all set `width: 100%` and should
reflow. The only fixed widths found anywhere under `propertyeditor/` are:

- `ExpressionEditorModal` 700px and `GeneratedCodeModal` 800px — both `position: fixed` modals, not
  in-panel, so not a 240px problem.
- `ByobFilterBuilder`'s condition row: `min-width` 120 / 100 / 100 across three fields. It already
  has `flex-wrap: wrap`, so at 240px it should go one field per line rather than overflow — but this
  is the one worth actually looking at, because a 120px minimum inside a ~200px content box leaves
  nothing for the drag handle and delete button that share the row.

**This list is from grep, not from looking at it.** STYLE-004 should re-derive it live.

## Gates

| Gate | Result |
|---|---|
| `npx tsc -p packages/noodl-editor --noEmit` | **clean** (0 errors, same as baseline) |
| `npx tsc -p packages/noodl-core-ui --noEmit` | **45 errors, unchanged from baseline** — all pre-existing `TS2307` module-resolution failures in `noodl-editor` files the core-ui project pulls in (`@noodl-store/*`, `@noodl-versioning`, `@noodl-viewer-cloud/*`). Verified by stashing every core-ui change and re-running: 45 before, 45 after. **Zero errors in `noodl-core-ui/src` itself.** This gate is red at baseline and nobody should read a green from it. |
| `npm run colors` (hex ratchet) | **16/16, holding.** Unchanged. |
| Sass compilation of every touched `.scss` | clean, checked directly with the repo's `sass` 1.94.2 |
| `npm run test:ci` (`noodl-editor`) | **not run** — see below |
| `noodl-core-ui` jest | **does not exist.** `packages/noodl-core-ui/package.json` has exactly two scripts, `start` and `build`, both Storybook. There is no core-ui test suite to run. |

`npm run test:ci` routes through `ts-node scripts/test-editor.ts`, which resolves the package root to
the **main checkout**, so running it from this worktree would grade main-checkout code and any
result — pass or fail — would be unrelated to this diff. Deliberately not run. It needs running from
the primary checkout after merge. Note that PNL-009 recorded one pre-existing failure there
("Project import and export … Expected 8 to be 5") that arrived with a concurrent merge and is not
from this phase.

## Live-QA checklist — run from the primary checkout, in this order

Prerequisites:

```bash
nohup setsid npm run dev:debug -- --quiet > /dev/null 2>&1 &
until curl -s http://localhost:9222/json/list >/dev/null; do sleep 5; done
# open a project — the rail does not exist at the launcher
```

### 0. The automated gate first, because it is cheap and it scopes the manual work

```bash
node dev-docs/tasks/phase-23-visual-refresh/corpus/panel-geometry.mjs \
  --json /tmp/pnl-004-geometry.json
```

It now runs the PNL-001 vertical pass **and** a horizontal pass over every registered panel at
240 / 300 / 380 / 560 / 760px. Expect it to be honest rather than green: panels outside PNL-004's
scope (Components, Search, GitHub, Version Control, Docs …) have never been checked at 240px and may
well report. **That is the point of the gate, not a failure of this task** — read the panel names in
the output and route the ones outside `BackendServices` / `EditorSettings` / `AppSetup` /
`ProjectSettings` to PNL-005 and PNL-006.

Three notes on reading it:
- `sticks Npx past the panel's right edge` is the real defect. Fix is nearly always `min-width: 0` on
  a flex child or `flex-wrap` on its parent.
- It does **not** flag deliberate `text-overflow: ellipsis` truncation, sub-2px boxes, or
  `visibility: hidden` measuring nodes. The reasons are in the file header. If you add an exemption,
  add the reason beside it.
- It forces the panel width with an `!important` inline style and always hands it back. If the editor
  is left with a stuck panel width, that override leaked — reload before trusting anything after it.

### 1. The first reported case — the local backend action row

1. Backend Services panel, drag it to **300px**.
2. Create a local SQLite backend if there isn't one. Note the row while **stopped**: "Start backend"
   full width, `⋯` at its right.
3. **Start it.** Expect: "Stop backend" still full width on its own row; Data / Schema / Access
   sharing the row below it, wrapping to two lines if needed; `⋯` at the end. **Nothing scrolls
   sideways and no button is clipped.**
4. Open `⋯`. Expect Triggers, Email, Search, Sign-in providers, a divider, Export data…, a divider,
   and **Delete backend in danger red and disabled**, with the tooltip "Stop the backend before
   deleting it".
5. The endpoint row: expect the URL **ellipsised**, a copy glyph at the right, the card no wider than
   the panel. Click it — the clipboard should hold the endpoint.
6. Stop the backend, open `⋯` again: Delete is now enabled and the inspection items are gone.
7. **Repeat 3 and 5 at 240px.** This is the width the whole thing was built for.

### 2. The second reported case — Editor Settings label columns

1. Editor Settings, panel at **300px**. Pick the Anthropic provider so the API-key row appears.
2. Expect: Provider, Model, "API Key (saved)", "Endpoint (optional)" and Connection each with the
   **label on its own line above** a full-width control. No label clipped, no label wrapped beside a
   half-empty field.
3. Widen to **560px**. Expect two-column with a 104px label column. **Then widen to 620px** and
   expect the column to grow to 132px — that is the wide band, and per the note above it starts at a
   ~594px *panel*, not 560. If you would rather it started at a 560px panel, say so and I will move
   the two numbers in `panel-bands.scss`.
4. The help text ("Leave blank to use …", the usage-log paragraph) should sit under its control, not
   float loose between rows.
5. The "Usage log" row is a `Toggle`: label left, switch right, **at every width including 240px**.

### 3. Every migrated panel at 240px and at 760px

For each of **Backend Services, Editor Settings, App Setup, Project Settings**:

- At **240px**: no horizontal scrollbar, no clipped control, every field usable.
- At **760px**: no row stretched absurdly wide; App Setup's colour swatch still beside its hex field
  rather than adrift from it.
- App Setup specifically: expand PWA, check the native `<select>` and both colour swatches; expand
  Custom Variables, add one, check the key ellipsises and the Add/Cancel pair wraps at 240px.

### 4. The drag, slowly

Drag the divider from 240px to 760px and back with each migrated panel open. Watch the band
transitions at roughly **374px** and **594px**. Expect no broken intermediate state — no row half
stacked, no control briefly zero-width, no reflow that leaves a control unreachable.

### 5. Both themes

Repeat items 1, 2 and 3 in light. The only theme-sensitive things this task introduced are the
compact-band label colour (`--theme-color-fg-default-shy`) and the `sections.module.scss` controls,
all of which use tokens — but "uses tokens" has been wrong before.

### 6. Storybook

```bash
npm run start:storybook
```

`Sidebar/Panel Row` → **Three Bands** is the triptych; also check **Long Label**, **Button Row
Control**, **Hidden Label** (inspect it: the row must be single-column with no 104px gap, and the
`<div>` must carry `role="group"` and `aria-label`), **With Help Text**, **With Fx Slot**,
**Changed**, **Stacked**.

## Could not verify — stated plainly

Everything in the checklist above. Specifically, **none** of the following has been observed:

1. Any of it running. No screenshot was taken, before or after. The spec asks for "before"
   screenshots at 240px and 300px and **they were not captured** — the editor cannot be launched from
   a worktree without grading main-checkout code, and I did not want a screenshot that proves nothing.
   The before-state is nonetheless unambiguous from the code: `.Actions` had no `flex-wrap`, and
   `.Label` was `width: 37%; max-height: 28px; overflow: hidden`.
2. **The extended `panel-geometry.mjs` has never been executed.** It is syntax-checked and its logic
   is reviewed, nothing more. The panel-width override in particular (`!important` on the
   `SideNavigation` root) is reasoned about, not observed; if the root override does not reach the
   panel there is a fallback that pins the panel directly, and the script reports the width it
   actually achieved — but nobody has watched it do so.
3. **Whether panels outside this task's scope pass the horizontal gate.** I expect several not to.
4. The `⋯` menu opening at a sensible position from inside a scrolled panel.
   `showContextMenuInPopup` attaches at the cursor point, and PNL-009 flagged popup positioning from
   a *floating* panel as unverified. Worth one look in floating mode.
5. **The container queries firing at all.** Chromium in this Electron supports them, and the CSS
   compiles, but "the query matches the container I think it matches" is precisely the thing that
   should be seen rather than assumed — particularly for the cards, which declare a *nested*
   `panel-body` inside the panel's own.
6. The `htmlFor` associations added to the App Setup textareas and the PWA select actually focusing
   their controls on label click.
7. Whether `contain: layout` on `.ChildrenContainer` shifts anything absolutely positioned inside a
   panel that previously resolved against `.Inner`. I found no such element by grep, but grep does
   not see inline `style` computed at runtime.

## Commits

| Sha | What |
|---|---|
| `16e3cda6` | `BasePanel` declares `panel-frame` / `panel-body`; `PanelRow` + bands + stories |
| `f3c881d4` | Backend Services: wrapping action rows, primary action, `⋯` menu, ellipsising endpoint |
| `7b279832` | Settings panels through `PanelRow`; App Setup sections de-inlined |
| `5ff7adb3` | `panel-geometry.mjs` grows a horizontal axis at five panel widths |
| `1a6084ea` | Fix: a hidden `PanelRow` label reserved its 104px column |

## For PNL-005, PNL-006 and PNL-008

- `panel-frame` exists on `BasePanel .Root`. Query it as
  `@container panel-frame (max-width: 359px)`, or `@include bands.frame-narrow { … }`.
- `panel-body` exists on `.ChildrenContainer`, and on `LocalBackendCard`/`BackendCard`. Any card that
  wants its own bands re-declares `container-name: panel-body` on itself; the nearest ancestor wins,
  which is what you want.
- Use `PanelRow`. If it does not fit, that is information about `PanelRow` — widen it rather than
  forking. The two shapes most likely to be missing are a row with **two** independent controls that
  should stack at different widths, and a row whose label is itself interactive.
- The 34px content-box offset is the thing that will bite you. Read the header of
  `panel-bands.scss` before writing a number.
