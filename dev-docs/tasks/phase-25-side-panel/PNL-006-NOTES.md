# PNL-006 — Components panel restyle: notes

**Status:** ✅ Code complete — 2026-07-27. **Live QA owed** (see "Could not verify").
**Spec:** [PNL-006-COMPONENTS-PANEL-RESTYLE.md](./PNL-006-COMPONENTS-PANEL-RESTYLE.md)
**Base:** `618a86ed` (PNL-005 merge). The worktree arrived ~500 commits stale and was
fast-forwarded before any work started — `PanelRow/panel-bands.scss` was the tell.
**Commits:** `0813c7ee` (derivation), `724e9f3c` (restyle), `ce88d9ea` (filter),
`+` the gate and this file.

---

## The reported bug, as a number

The spec's diagnosis held exactly. `.TreeItem.Selected` set both

```scss
background-color: var(--theme-color-primary-transparent);
color: var(--theme-color-primary);
```

Composited — the fill is translucent, so the ink is not on the token, it is on the
token *over the panel's `bg-2`* — that is:

| | selected fill (rendered) | label | ratio |
|---|---|---|---|
| **light, before** | `rgb(220,233,250)` | `#1570ef` | **3.70:1** ❌ below AA |
| **dark, before** | `rgb(32,49,69)` | `#4da3ff` | 5.04:1 |
| **light, after** | `rgb(227,237,250)` | `#18212b` | **13.72:1** ✅ |
| **dark, after** | `rgb(31,46,64)` | `#eef2f6` | **12.20:1** ✅ |

So the selected row really was the least readable row in the tree, on light, by a
factor of nearly four. The fill stays (`--theme-color-primary-bg`, the closest thing
the token set has to the mock's `accent-soft`), a **2px accent bar** on the leading
edge takes over carrying the state, and the label is left at `fg-highlight`.

The bar is an `inset` box-shadow rather than a border or a `::before`: no layout
shift, no extra box, and it cannot collide with the first indent guide, which starts
16px in.

Two secondary numbers worth having on record, both measured the same way:

- `fg-muted` on the light selected fill is **3.05:1** — fine for a glyph, *not* fine
  for text. So the caret goes to `fg-default` on a selected row, and the dimmed-row
  treatment is never combined with selection in practice.
- Kind glyphs against the panel ground, at the 3:1 non-text threshold:
  visual 4.00 / 3.25 (data, light) / 3.81 / 4.46 / 3.30. All clear.

## What "kind" turned out to mean — and the two dead branches

The spec said kind is not first-class and asked what is genuinely derivable. Reading
the code first found something more useful: **three of the four flags the panel
already claimed to derive were not derivations.**

```ts
// useComponentsPanel.ts, before
function checkIsCloudFunction(component) {
  component.forEachNode((node) => {
    if (node.type.name === 'Cloud Function' || node.typename === 'Cloud Function') { … }
  });
}
function checkIsVisual(component) { return !checkIsCloudFunction(component); }
```

**There is no node type called `Cloud Function` anywhere in the codebase.** A cloud
function component is rooted in `noodl.cloud.request` / `noodl.cloud.response` — see
`ComponentTemplates.CloudFunctionComponentTemplate` and
`packages/noodl-viewer-cloud/src/nodes/cloud/`. The only other occurrence of the
string is `nodelibraryexport.ts:753`, where it is a *category* label ("Cloud
Functions"), not a type name.

So `isCloudFunction` was always `false`, and therefore `isVisual` was always `true`.
`ComponentItem` picked its glyph in the order root → page → cloud function → visual,
so **every non-page, non-home component in every project rendered the same `UI`
glyph.** That is the reported "every node in the tree gets the same folder-or-page
glyph" — not a design decision anyone made, a dead branch.

And `hasWarnings` was:

```ts
hasWarnings: false, // TODO: Implement warning detection
```

so the 16px amber `!` badge the spec asks to replace **had never rendered once.**

### What is shipped, and how reliable each one is

`componentKind.ts` derives six kinds, in precedence order, in **one** pass over the
project's graphs — replacing two-to-three `forEachNode` walks *per component*, so it
is strictly less work than what it displaces.

| kind | derivation | reliability |
|---|---|---|
| `home` | `project.getRootComponent() === component` | the project's own answer; not derived at all |
| `cloudfunction` | a `noodl.cloud.request`/`response` root | intrinsic, unambiguous |
| `page` | a `Page` node | intrinsic; `Page` is a singleton and only a page component has one |
| `popup` | named as the `target` of a `NavigationShowPopup` node | **extrinsic** — see below |
| `visual` | `ComponentModel.allowAsChild` | the model's own definition of "can sit in a visual tree" |
| `component` | everything else | the honest "I don't know" |

**Popup is the one I want flagged.** It is derivable — a port of type `component`
stores the component's *name* in `parameters` (this is exactly what
`NodeGraphModel`'s rename handling rewrites), so the reverse index is the same string
the runtime resolves the popup by. But it is a property of *other* components, so it
ranks below everything intrinsic (a page also shown as a popup is a page first), and
it **under-detects rather than mis-detects**: if `target` is driven by a connection
instead of a parameter there is no name to read and the component falls back to what
it is intrinsically, usually `visual`. That is the right failure direction. A popup
shown as a visual component is a duller glyph; a visual component shown as a popup
would be a lie.

**There is deliberately no `logic` kind**, and this is where "three honest glyphs beat
five guessed ones" bit. The spec's desired list was page/popup/visual/logic/component.
A component with no visual root and no cloud root *might* be a logic component — or it
might be empty, half-built, or have a root type that failed to resolve because a module
is missing. Those are indistinguishable from the graph, so they all land on the neutral
`component` glyph. Five glyphs are shipped; the fifth is home, not logic.

## Colour: one token, two consumers

The spec's hardest constraint was "do not introduce a second node-colour source". The
answer turned out to be cleaner than a hook.

`ComponentModel.color` walks `graph.roots` and returns the colour of the first root
that `allowAsChild` — and that is *precisely* the value
`NodeGraphEditorNodePainter` passes to `CanvasTheme.categoryColors()` when it paints
an instance of that component on the canvas, because a component model doubles as its
own node type. So the tree and the graph are reading the same property off the same
object.

That value is carried to the view as a class (`.Cat-visual`, `.Cat-component`, …) and
the stylesheet resolves it from the **same `--theme-color-node-category-*` custom
properties `CanvasTheme` reads** (see its `COLOR_SPECS`). One token, two consumers.

Why CSS rather than `useNodeColorScheme`:

- **no per-row JS.** Rows are the hot path; this costs one class name.
- **no theme subscription and no re-render.** The tree re-themes with the document.
- **it cannot drift.** `CanvasTheme` resolves the token at runtime; so does this. A
  hook would have been one resolution step *further* from the source, not closer.

The one mapping that has to be restated: CanvasTheme maps its `javascript` category
onto `--theme-color-node-category-function` (there is no `--…-javascript` token). The
`.Cat-javascript` rule matches that deliberately, with a comment. Unknown category
strings normalise to `default` in `componentKind.ts`, which resolves `fg-muted` —
exactly what `CanvasTheme.categoryColors()` does with them.

**The gate asserts this rather than trusting it.** Assertion E compares every rendered
glyph's *computed* colour against the custom property read off `document.documentElement`
and fails on any difference at all. If someone later hard-codes a hue here, it goes red.

## Indent guides cost no JavaScript

One 1px rule per ancestor level, drawn as a repeating gradient clipped to the indent
area:

```scss
background-image: repeating-linear-gradient(to right,
  var(--theme-color-border-default) 0 1px, transparent 1px var(--tree-indent));
background-size: calc(var(--level, 0) * var(--tree-indent)) 100%;
background-position: var(--tree-guide-x) 0;   /* a caret's centre */
```

The count is exact **by construction**: the background box is `level × indent` wide, so
depth 4 paints four rules and depth 0 gets a zero-width box and none. Positioned at a
caret's centre, so each rule runs down through the carets of the ancestors it belongs
to rather than floating between them. The guides paint over the selection fill, so
continuity survives selection.

This also retired the arithmetic that was the real reason nothing lined up: the old
code carried `level * 12 + 23` inline for a component and `level * 12 + 10` for a
folder, as two unrelated magic numbers. A component row now renders an empty
caret-sized slot, both rows use one padding formula, and glyphs at one depth share
one x. The only per-row value the JS supplies is `--level`.

## Deviations from the spec, with reasoning

**1. No container-query band, and no band number restated.** The brief said never to
restate a band number and always to `@use` the mixins. This stylesheet does neither,
because it needs neither: a tree row has one layout at every width. The phase's own
rule in `panel-bands.scss` covers it — *"overflow is not a layout change"* — and
acceptance item 7 is satisfied by `min-width: 0` + ellipsis + a non-shrinking dot,
which reflow correctly at 240px and at 700px with no query at all. Adding a query I
did not need would have meant importing core-ui SCSS across a package boundary
(unprecedented in `noodl-editor/src` — every existing `@use` there is `@scss-*` or
relative) for no behaviour.

**2. The warning dot does not route to Problems — by design, not omission.** The spec
said to check whether `ProblemsPanel` can accept a filter-to-component route and, if
not, to make the dot tooltip-only and file it. It cannot, for two independent reasons:

- `ProblemsPanel` takes **no props**. It reads `ProjectValidationService.instance`,
  groups by component name internally, and exposes no filter, no selection and no
  imperative entry point. Adding one means editing that panel, outside this territory.
- **The two surfaces do not show the same warnings.** The dot counts `WarningsModel`
  entries — editor/runtime warnings (missing node type, broken connection, merge
  conflict), the same source as the top bar's badge and the titlebar's count. The
  Problems panel shows SUB-006 *semantic validation* diagnostics. A click could
  easily land on a component the Problems panel lists nothing for.

So the dot is an indicator: `role="img"`, an `aria-label` and `title` carrying the
count, and `cursor: help` rather than `pointer`. **Follow-up filed below.**

**3. `isVisual` changed meaning, which changes one menu.** It now means "has a root
that may act as a child of a visual tree" (plus page/popup/home) instead of "is not a
cloud function". `ComponentItem`/`FolderItem` gate **"Make Home"** on
`isPage || isVisual`, so a pure logic component no longer offers it. That is correct —
you cannot make a logic component the home — but it is a visible behaviour change and
should be sanity-checked in QA rather than discovered.

**4. Page uses `IconName.File`, not `PageRouter`.** `File` is what
`PageComponentTemplate` uses in the create menu, so the tree and the menu now agree.
`PageRouter` is the Router node's glyph and was borrowed.

**5. Popup uses `IconName.Cards`.** There is no popup glyph in the icon set; `Cards`
(stacked rectangles) is the nearest honest reading of "a thing shown over a page".
Worth a look in QA — if it does not read, the fallback is to demote popup to the
neutral glyph, which costs nothing.

**6. You cannot collapse a folder while the filter is active.** The effective
expansion set wins for as long as the query is non-empty. Collapsing would hide a
match, so this is deliberate, but it is a real interaction difference.

**7. `.AddButton` deleted.** PNL-005 left it in place with a note saying PNL-006 owned
it. It has no reference anywhere in the codebase (`grep` across `*.ts`/`*.tsx`: zero).

## Numbers

| Gate | Result |
|---|---|
| `npx tsc -p packages/noodl-editor --noEmit` | **clean** (clean at baseline, clean after) |
| `node scripts/hex-color-ratchet.js` | **16/16, `=`** — unchanged. No hex added; every colour is a token |
| `npx sass … ComponentsPanel.module.scss` | compiles, exit 0 |
| `node --check components-tree.mjs` | OK |
| Selected-row contrast, light | 3.70:1 → **13.72:1** |
| Selected-row contrast, dark | 5.04:1 → **12.20:1** |
| Graph walks per tree build | 2–3 **per component** → **1 pass total** |
| Per-row JS for indent + guides | a formatted `paddingLeft` string → one `--level` custom property |
| Scroll cost on ~200 components | **NOT MEASURED — the gate measures it.** See below |

**On the scroll measurement.** The spec asked for a number and said to file it rather
than absorb it. I could not produce one: an editor launched from this worktree runs
main-checkout code (`lerna exec` resolves the package root to the primary checkout),
so any figure I measured would describe the wrong build. Rather than guess, the number
is produced *by the gate*, from the real scroller: it drives `scrollTop` over the full
range for 90 frames and records median / p95 / max frame duration alongside the row
count, into the JSON report. p95 over the 16.7ms 60fps budget is reported as a named
skip, not a failure — virtualising the tree is explicitly out of scope, so it is a
finding to file.

What I *can* assert about the direction of travel: the per-row work went down, not up.
Guides and indent are pure CSS, the classification moved from per-component walks to
one memoised pass, and no row gained a subscription.

## The gate

`dev-docs/tasks/phase-23-visual-refresh/corpus/components-tree.mjs` — beside
`panel-chrome.mjs` and `panel-geometry.mjs`, sharing their harness shape (one raw CDP
socket, zero dependencies, drives the real editor). *This is the one file outside the
stated territory; it is additive and collides with nobody.*

Both themes, wide and 240px. Assertions:

- **A — the light-mode fix.** The selected row's label measures ≥ 4.5:1 against the
  background that is **actually rendered**. The fill is translucent, so the comparison
  walks up the ancestors collecting background layers and composites them back-to-front
  exactly as the compositor does. Comparing against the declared `rgba()` would flatter
  the result, and flattering the result is how a 3.70:1 selection survived review. Also
  asserts the accent bar exists, so the fix cannot silently regress to fill-only.
- **B — indent guides at four levels.** Each row's painted guide box must equal
  `level × 12px`. A row at depth 4 drawing three guides fails.
- **C — ellipsis and the dot at 240px.** Labels ellipsise, dots keep their width,
  nothing crosses the panel's right edge.
- **D — the dot's contract** (6px, round, amber) read from `document.styleSheets`, so
  it is checked even against a project that happens to be clean, plus the rendered
  geometry of any real dots.
- **E — no second node-colour source.** Every glyph's computed colour vs. the
  `--theme-color-node-category-*` token. This is what makes "the tree matches the
  graph" a fact rather than a claim.
- **Scroll cost**, measured and reported.

Hardening carried over from `panel-chrome.mjs`, which earned it the hard way: every
phase wrapped so a CDP timeout skips and records rather than aborting; screenshots
captured **before** anything is asserted; JSON flushed after every phase; three
consecutive timeouts abort cleanly; and **every injected style released in a
`finally`** — a leaked `width !important` is what wedged the editor for the previous
agent.

**One deliberate difference from `panel-chrome.mjs`:** it targets the panel column by
the hashed class `[class*="SideNavigation-module__Panel"]`. This gate resolves the
element at runtime by walking up from `[data-panel-id]`. PNL-009 is reworking
`SidePanel.tsx` right now; a hash is not a contract, and a gate that silently stops
narrowing anything is a gate that silently stops testing assertion C.

**Skips are not passes.** Anything the run could not prove — no project open, a tree
shallower than four levels, a project with no warnings, no label long enough to
ellipsise — is printed by name at the end and recorded in the JSON.

## Verification

### Ran (these work in a worktree)

```bash
npx tsc -p packages/noodl-editor --noEmit          # clean
node scripts/hex-color-ratchet.js                  # 16/16, holding
npx sass --no-source-map \
  packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/ComponentsPanel.module.scss /dev/null
node --check dev-docs/tasks/phase-23-visual-refresh/corpus/components-tree.mjs
```

Contrast figures were computed offline from the committed token values in
`packages/noodl-core-ui/src/styles/custom-properties/colors.css`, using the WCAG
relative-luminance formula and compositing the translucent fill over `bg-2`. The gate
recomputes them in the renderer from *computed* styles — if the two ever disagree,
believe the gate.

### Could NOT verify — be sceptical of anything below this line

An editor launched from this worktree executes main-checkout code, so nothing below
was run against this diff. **Every item here is unproven.**

- ❌ **Nothing was seen rendered.** No screenshot in this commit set is a "before" or
  an "after" of this work; `screenshots/pnl-006/` is created by the gate, not by me.
- ❌ `npm run test:ci` for `noodl-editor` — same reason. The changed files have no
  existing spec coverage, but the suite has not been run.
- ❌ **Kind accuracy against a real project.** Every derivation is reasoned from the
  models and the templates. Whether `popup` fires on real popups, and whether
  `allowAsChild` classifies the components people actually build, is unproven.
- ❌ **Whether the glyph set reads.** Five shapes at 15px in two themes.
- ❌ **The warning dot rendered at all** — it needs a project carrying warnings.
- ❌ **The filter's feel** — expansion restore, the dimmed-ancestor treatment, the
  no-match copy.
- ❌ **Scroll cost.** No number exists yet.
- ❌ Drag-and-drop, rename and the context menus after the markup change (the caret
  slot is a new child of every component row, and `RenameInput` moved to `--level`).

### Run it from the PRIMARY checkout, after merge

```bash
# 1. editor up, project open (the rail does not exist at the launcher).
#    Use a project with four levels of nesting and a component carrying warnings —
#    the reported "Shine" project, or any project plus a node of an unresolved type.
nohup setsid npm run dev:debug -- --quiet > /dev/null 2>&1 &
until curl -s http://localhost:9222/json/list >/dev/null; do sleep 5; done

# 2. this task's gate — both themes, wide + 240px, screenshots + JSON
node dev-docs/tasks/phase-23-visual-refresh/corpus/components-tree.mjs \
  --json /tmp/pnl-006.json

# 3. prove nothing upstream regressed
node dev-docs/tasks/phase-23-visual-refresh/corpus/panel-chrome.mjs --json /tmp/pnl-005.json
node dev-docs/tasks/phase-23-visual-refresh/corpus/panel-geometry.mjs

# 4. the suites a worktree cannot run
npx lerna exec --scope noodl-editor -- npm run test:ci
node scripts/hex-color-ratchet.js
```

Read the gate's **SKIPS** section, not just its exit code. A green run with four skips
is four things still to check by hand.

### Ordered live-QA checklist

Both themes (toggle between them at each step). Numbers map to the spec's acceptance.

1. **(A1) Selection, light theme.** Click a component. The label must be near-black at
   full contrast, not azure. A 2px accent bar sits on the row's left edge. Compare
   against the same row unselected — the *label* should not have changed colour at all,
   only the ground. Repeat on dark.
2. **(A2)** Hover a selected row: the fill must not revert to the hover grey.
3. **(A2) Four levels.** Open a four-deep branch (`/Pop-ups/Privacy/Terms of Use
   Popup`). Count the vertical rules on the deepest row: there must be exactly as many
   as it has ancestors, each aligned with an ancestor's caret. Scroll — the rules must
   join up between rows with no gap at the row seam.
4. **(A3) Kinds.** Confirm the home component, a page, a cloud function (Cloud
   Functions panel), a plain visual component and a logic component all show
   *different* glyphs. Before this change every one of them showed the same `UI` glyph.
5. **(A3) Colour parity.** Pick a component, note its glyph colour, then place an
   instance of it on the canvas and compare against the node card's category hue. They
   must be the same colour. Repeat in the other theme. *(The gate asserts the token; this
   confirms the token is the one the canvas uses.)*
6. **(A3) Popup.** Find a component targeted by a Show Popup node — it should carry the
   stacked-cards glyph rather than the visual one. If nothing in the project uses Show
   Popup, record it as not covered.
7. **(A4) Home.** Findable without reading a label — coral, filled home glyph, heavier
   label. Then use **Make Home** on another component and confirm the coral moves.
8. **(A5) Warnings.** On a component with warnings: a 6px amber dot at the row's right
   edge. Hover — the tooltip gives the count. Click it — **nothing should happen**, and
   the row should just select as normal. Confirm the count matches the top bar.
9. **(A6) Filter.** Type a fragment: matches remain, their ancestors remain and are
   visibly dimmed, everything else goes. Type nonsense: "No components match …", *not*
   "No components in project". Clear the field: the tree returns to **exactly** the
   expansion you had before typing.
10. **(A7) 240px.** Drag the panel to ~240px. Long names ellipsise, do not wrap, do not
    push. The warning dot stays visible and inside the panel. Nothing scrolls sideways.
    *(The header title truncating to "Co…" at this width is PNL-005's known open defect
    and the concurrent `⋯` overflow work — not this task.)*
11. **Regression — the things the markup change could have broken.** Drag a component
    onto a folder; drag onto empty space; right-click a component, a folder and empty
    space; double-click to rename and confirm the input sits exactly where the row was
    at depth 3; switch sheets; create a component from the context menu.
12. **Regression — "Make Home"** now hidden for pure logic components (deviation 3).
    Confirm it still appears for pages and visual components.
13. **(A8) Screenshots.** The gate writes four (`components-tree--{dark,light}[--narrow240].png`)
    into `screenshots/pnl-006/`. There is no "before" — capture one from `cline-dev` at
    the merge-base if a pair is wanted for the record.

## Follow-ups filed

1. **The warning dot has nowhere to go.** Routing to Problems needs (a) `ProblemsPanel`
   to accept a component filter, and (b) a decision about the two warning sources —
   either `ProblemsPanel` also surfaces `WarningsModel`, or the tree dot switches to
   `ProjectValidationService`, or the dot grows two states. Worth doing; not worth
   faking. *(Owner: unassigned.)*
2. **`ComponentsPanel` has no test coverage at all.** `componentKind.ts` and
   `useComponentFilter.ts` are both pure and trivially testable — the kind precedence
   table and the ancestor-retention rule are exactly the things that will rot silently.
3. **`RenameInput` ships four `console.log` calls** (`🔍 RenameInput keyDown:` and
   friends) on every keystroke of every rename. Pre-existing, out of territory, and
   PNL-007 owns rename affordances.
4. **Popup detection misses connection-driven targets.** If `Show Popup`'s `target`
   comes from a connection rather than a parameter, the component reads as visual.
   Fixable by following the connection, at real cost; not obviously worth it.

## Traps met

**The worktree was ~500 commits stale.** `git log --oneline -1` gave
`360cdc46 Added Contribution markdown file` — a 2023-era commit. `git merge --ff-only
cline-dev` fixed it, and the presence of `PanelRow/panel-bands.scss` was the check that
confirmed it. Anything built on that base would have silently missed both PNL-004 and
PNL-005.

**CSS-module class names sanitise `.` to `-`.** `localIdentName` is
`[name]__[local]--[hash:base64:5]`, and `[name]` for `ComponentsPanel.module.scss` is
`ComponentsPanel.module` — which webpack emits as `ComponentsPanel-module__Label--h4sh`.
Any gate selector written as `ComponentsPanel.module__…` matches nothing, silently.
`panel-chrome.mjs` had already learned this; the hyphen in its selectors is why.

**`useEffect` cleanup must return `void`, and `Model.off` returns the model.**
`return () => WarningsModel.instance.off(group)` typechecks as
`() => Model` and fails `EffectCallback`. The braces are load-bearing.

**React does not append `px` to custom properties**, so `{'--level': level}` works with
a raw number — but it is passed as `String(level)` anyway, because relying on a
framework's serialisation rule inside a `calc()` that drives every row's padding is a
bad trade for zero benefit.
