# PNL-001 — Panel scroll & box-model correctness: notes

**Status:** ✅ Complete — 2026-07-27
**Spec:** [PNL-001-PANEL-SCROLL-CORRECTNESS.md](./PNL-001-PANEL-SCROLL-CORRECTNESS.md)
**Gate:** `dev-docs/tasks/phase-23-visual-refresh/corpus/panel-geometry.mjs`

## Both defects reproduced before the fix

Measured over CDP at **1280×720** with the Agent Chat Example project open, on every registered rail
panel. Not inferred from the CSS — these are numbers off the live DOM.

**Defect B (the panel is taller than its slot).** `BasePanel .Root`'s border box overflowed
`SideNavigation .Panel` by exactly **34px** on every panel that used `BasePanel` — 16px padding × 2
plus 1px border × 2, as the spec predicted. The ancestor's `overflow: hidden` ate it.

**Defect A (flex children squeeze instead of the container scrolling).** On **Editor Settings**:

| Element | clientHeight | scrollHeight | hidden behind its own `overflow: hidden` |
|---|---|---|---|
| `CollapsableSection .Root` (Appearance) | 116 | 144 | **28px** |
| `CollapsableSection .Root` (AI) | 464 | 573 | **109px** |
| `BasePanel .Inner` | 641 | 862 | **221px** |

28px is the Appearance help text, which is why it died at "…your running app's appearance is". The
"before" screenshot ([`screenshots/pnl-001/before/panel-editor-settings-panel--dark.png`](./screenshots/pnl-001/before/panel-editor-settings-panel--dark.png))
shows the sentence ending mid-clause; the "after" shows "…is unaffected."

## What changed

| File | Change |
|---|---|
| `BasePanel.module.scss` | `box-sizing: border-box`; `min-height: 0` down the whole flex chain; horizontal padding moved off `.Root` onto `.ChildrenContainer`; `overflow-y: overlay` → `auto`; `scrollbar-gutter: stable`; 32px bottom padding inside the scroll area; `flex: 0 0 auto` on the scroll container's children |
| `CollapsableSection.module.scss` | `box-sizing`, `flex-shrink: 0`, `overflow: hidden overlay` → `hidden auto` |
| `Section.module.scss` | same |
| `Checkbox.module.scss` | `position: relative` on `.Root` — see below |

### The `flex: 0 0 auto` rule is scoped to `has-content-scroll`, deliberately

The spec asked for it on "every direct child of a scroll container". Applying it to *every* direct
child of `.ChildrenContainer` regressed three panels: **Explain**, **AI Authoring** and **Problems**
bring their own inner scroller (a `ScrollArea` / results list) and rely on that child *shrinking* to
the panel and scrolling internally. Pinning them to their content height moved 131–288px of content
out of reach — the same class of bug, in the other direction. The measured regression is why the rule
sits inside `&.has-content-scroll`.

### The Checkbox fix was a real find, not a drive-by

`Checkbox .Checkbox` is a visually-hidden `<input>` with `position: absolute`, and `.Root` was not
positioned. Its containing block was therefore whatever ancestor happened to be relative — in a side
panel, `BasePanel .Inner`, *outside* the scroll container. Checkboxes below the fold landed past the
panel's bottom edge and inflated `.Inner`'s `scrollHeight` to 890 against a 607 client height, which
read as 283px of clipped content on Editor Settings even after the panel chain was correct. One line
(`position: relative`) fixes the containing block. No visual change.

## The judgement call: the global reset was evaluated and rejected

The spec said to take the scoped fix first, then evaluate `* { box-sizing: border-box }` reversibly
and keep it only if the corpus is clean. **It is not clean.** Rather than eyeball 26 screenshots, the
reset was injected at runtime and every element's box measured before and after, on each panel:

```
components-panel:       56/464 boxes change size
app-setup-panel:        93/490
settings-panel:        134/569
editor-settings-panel: 136/590
```

Most are ±1px border artefacts, but these are not:

| Selector | Δ | Consequence |
|---|---|---|
| `TextInput .Root` (and its 4 inner boxes) | **Δw −18** | every text input in the editor gets 18px narrower |
| `Checkbox .FauxCheckbox` | **Δw/Δh −4** | the checkbox glyph shrinks 20px → 16px |
| `SideNavigation .Toolbar` | **Δh −20** | the icon rail loses 20px of height |
| `ClippyLogo .LogoIdleCircle` | **Δw/Δh −8** | the AI logo shrinks |
| `CanvasHud .ZoomCluster` | **Δw −8** | canvas HUD control narrows |

So the shipped state is the **scoped** fix. The global reset stays unadopted, and this table is the
record of what a future attempt has to fix first — start with `TextInput`, which is most of it.

Probe: `/scratchpad/boxsizing-impact.mjs` (transient; the method is a before/after
`getBoundingClientRect()` sweep with the reset injected via a `<style>` element, which anyone can
re-run in ten minutes).

### — re-measured 2026-07-28: the table above is stale, and the scope is bigger

Richard's call (2026-07-28) is to **adopt** the reset. Re-measuring first, because the table above
is nine days old — and it has moved in both directions. The probe is no longer transient: it lives at
`dev-docs/tasks/phase-23-visual-refresh/corpus/boxsizing-impact.mjs`, self-contained like its
neighbours, so the next person measures instead of re-deriving. **Losing the first probe is why this
had to be redone at all.**

It also **freezes animation before sampling**. Without that, `ActivityIndicator`'s loader dots and
Clippy's `bounce1/2/3` dominate the output: a dot sampled at 0.02px "before" and 6.4px "after" reads
as a 6px box-sizing regression and is really two keyframes. The first re-run reported exactly that.
Numbers below are post-freeze and stable across runs.

| Selector | Δ (2026-07-28) | vs. the table above |
|---|---|---|
| `ToastCard .Root` + Body/Title/Message/Actions | **Δw −30** | **new — and now the largest** |
| `SideNavigation .Toolbar` | Δh −20 | unchanged |
| `CanvasHud .ZoomCluster` / `.ZoomValue` | Δw −8 | unchanged |
| `ClippyLogo .LogoIdleCircle` | Δw/Δh −8 (30→22) | unchanged |
| `TextInput` .Root/.InputArea/.InputWrapper/.Input | **Δw −4.42** | **was −18** — most of it has since been fixed |
| `EditorTopbar` .LeftSide/.UrlBarWrapper/.RightSide | Δw −4.42/−2.25, Δh −2 | new, small |
| `Checkbox .FauxCheckbox` | not reproduced | no checkbox in the sampled panels — unconfirmed either way |

**And the original sweep only covered four editor panels, so it missed a whole surface.** The
launcher is affected at least as much:

| Selector | Δ |
|---|---|
| `LauncherSearchBar .Search` / `.SearchInput` | Δw −26 |
| `FolderTree` .Root/.SideLabel/.VirtualFolders/.Grow/.NewFolderButton, `FolderTreeItem .Root` | Δw −21 |
| `Projects` .Sidebar / .Main / .Grid | Δw ∓21, Δh +2/+16 |
| `LauncherProjectCard` .Card/.Thumb/.Meta/.Info/.Name/.Sub/.ThumbImage | Δw +7, Δh +4 |

So the job is **~8–9 component families, not five**, the item the decision was framed around
(`TextInput`, "most of it") is now the *smallest* of them, and two of the biggest — `ToastCard` and
the launcher's search/folder tree — are not in the approved table at all. Adoption is well specified
now but it is its own focused pass with a visual gate, not a tail-end cleanup: **not started**, so
that the editor is not left in a half-converted state.

Order to work in, cheapest-signal-first: `ToastCard` (−30, one component, self-contained), then
`FolderTree`/`LauncherSearchBar` (−21/−26, launcher only), then `SideNavigation .Toolbar` (−20),
then the −8s and −4s. Gate after each: this probe, plus `panel-geometry.mjs` and `panel-modes.mjs`.

### — ✅ ADOPTED 2026-07-28. Both tables above are wrong, and the plan they imply is unnecessary.

`68f5fa15`, with the probe fix in `7a7c252c`. **One global rule, zero per-family
compensation.** Neither the 9-day-old table nor the re-measurement above should be trusted; keep
them only as the record of how the number was arrived at.

**1. The probe was reporting one panel and calling it ten.** `report[label]` was keyed by panel
title, and the title came from a bare `document.querySelector`. Panels stay mounted — **34
`PanelHeader` elements exist at once** — so it always returned the first in DOM order. Every panel
produced the same key, the report overwrote itself, and only the **last** survived into the JSON.
That is this very file's own "panels stay mounted, filter on `clientHeight > 0`" trap, reappearing
inside the instrument, and F40's lesson a second time.

Fixed, the panels are nothing alike:

| Panel | significant boxes |
|---|---|
| Search / Explain / Build / Problems / Docs | **52–57 each** |
| Version Control / GitHub / Execution History / Workflows | 13 |
| Backend Services | 7 |

So the headline disagreement between the two tables dissolves. **`TextInput` never went from −18 to
−4.42 because someone fixed it** — −18 is Search, −4.43 is Workflows. The same selector genuinely
measures differently depending on how much room the panel leaves the topbar, so **these deltas are
not per-component constants** and only mean anything compared like-for-like.

**2. The deltas were parity errors, not breakage — so "fix them first" was the wrong instinct.**
The phase-24 mock states **outer** dimensions, the way design tools report them: *"Sidebar (224px,
bg-1, border-r, padding 16px 10px)"*, *"search flex max-width 380px … padding 8px 12px"*, *"Toast …
width 340 … padding 13px 14px"*. Under content-box the padding and border were added **on top**, so
every one of these has been rendering wider than the mock ever asked for — the sidebar at 245px
against a specified 224, the search box at 406 against 380. Compensating the numbers to preserve
today's pixels would have **locked the parity bug in**. Adopting the reset is what delivers PAR-001.

That is also why the launcher's "7 families" were only ever 2 causes: `Projects .Sidebar` and
`LauncherSearchBar .Search`. The `+21` on `Projects .Main` / `LauncherPage` and the `+7` on
`LauncherProjectCard` were that same 21px redistributed across a 3-column grid.

`ToastCard` — the item the plan was ordered around — **never appears in any run**, because no toast
is on screen when the probe samples. Same reason `Checkbox` was "not reproduced". An element that
is not rendered cannot be measured, and neither belongs in a table presented as complete.

**Where the reset lives:** `packages/noodl-editor/src/assets/css/style.css`, not
`noodl-core-ui/styles/global.css` — the latter is **not imported by the editor at all**, only
mentioned in a comment in `fonts.css`. One sheet covers the launcher too; they share a window.

**Two real defects surfaced**, both at the 240px floor, both content that never fitted and was only
concealed by containers being handed more width than their CSS asked for:

- the Build panel's `This component | Project | Docs` control needs 242px against 204px available —
  now wraps, as `ProjectReviewBanner` in the same panel already did;
- the Docs toolbar's path label held its full min-content width and shoved the buttons out — now
  ellipsizes, the same shape as F37 and F38.

**And six of the eight corpus gates were attaching to the wrong window.** `/index\.html/` also
matches `frames/viewer-frame/index.html` and `about-window/about.html`, both of which sort **ahead**
of the editor in `/json/list`. Any gate run with a preview open silently measured the preview:
`panel-geometry` reported *"No rail panel buttons found. Open a project in the editor first."* with
a project plainly open. Only `boxsizing-impact` was hardened, after the About window bit the
previous session. All six now match `noodl-editor/src/editor/index.html` specifically.

| Gate | Result |
|---|---|
| `boxsizing-impact --launcher` | **91 significant → 0/301** |
| `boxsizing-impact` (panels) | all 12 panels **0 changed, 0 significant** |
| `panel-geometry` | **12/12** vertical, **60/60** panel×width horizontal |
| `panel-modes` | **13/13**, F41's round trip included |
| `npm run test:ci` | **1766 specs, 0 failures** (seed 63183) |
| `npm run colors` | 16/16, holding |
| `npx tsc -p packages/noodl-editor` | clean |

⚠️ One reading was transient and did not reproduce: a first pass showed `03-Problems` with 79
significant boxes, all of them `FrameDivider Container1 −20 / Container2 +20` and the canvas moving
with them — a panel resize in flight, not box-sizing. It came back 0/0 on a re-run. **Re-run before
filing anything whose signature is "the whole layout shifted by one round number".**

## The regression gate

`node dev-docs/tasks/phase-23-visual-refresh/corpus/panel-geometry.mjs [--width 1280] [--height 720]`

Lives beside the phase-23 corpus, shares its shape (one raw CDP socket, no dependencies, drives the
real editor). Needs a dev editor up **with a project open**. Exits non-zero on failure. It
self-discovers the rail from `[data-test$="-panel"]`, so a panel added later is covered for free.

Two assertions per panel, measured from the panel **slot** down so both defects are in range:

1. every scroll container reaches its own end after `scrollTo(0, scrollHeight)`;
2. no element clips content it cannot scroll (`scrollHeight > clientHeight` while `overflow-y` is
   `hidden`/`clip`) — the one that catches the squeeze.

Three documented exemptions: `clientHeight === 0` (a deliberately collapsed section), `visibility:
hidden` / `opacity: 0` (measuring nodes such as TextInput's autosize sizer), and overflow smaller
than one line box (single-line inputs clip a few sub-line pixels on purpose — nothing can be hidden
by less than a line).

**The gate was proved to bite.** With the pre-fix rules re-injected over the fixed build it reports
3/11 clean, naming the 34px slot overflow on seven panels and the 41px/152px section squeeze on
Editor Settings. With them removed, 11/11.

## Verification

| Check | Result |
|---|---|
| Gate at 1280×620 / 720 / 1200 | **11/11 clean** at all three |
| Editor Settings scrolled to end | `scrollHeight − scrollTop − clientHeight = 0`; the AI-docs card and its button fully visible with breathing room |
| Appearance help text | reads to "…is unaffected." |
| Collapse/expand while scrolled | scrollTop 318 → 210 → 318 as content shrinks and returns; 0 clipped elements throughout |
| `npm run typecheck:editor` | clean |
| `npm run colors` | 16/16, holding the line |
| Screenshot corpus, both themes, 1280×720 | `screenshots/pnl-001/{before,after}/`, 26 captures each |

`npm run typecheck:core-ui` reports pre-existing `TS2307` module-resolution errors from
`@noodl-versioning` and `@noodl-viewer-cloud/*` — it compiles editor sources through the core-ui
project. Untouched by this task (which changed only `.scss`).

## Recorded for later tasks, not fixed here

- **`PanelHeader` lost 16px of horizontal inset.** It carried its own `padding: 0 16px` *plus* the
  root's, so its title sat 32px in. With the root's horizontal padding gone it is now 16px, which is
  what the mock's `.phead` (14px) wants. Intentional; **PNL-005** owns the header's final chrome.
- **`TextInput .InputWrapper` clips 4px** of its own content (`overflow-y: hidden`, added
  deliberately to suppress a vestigial scrollbar). Sub-line, so nothing is hidden, and it is a shared
  input's metrics rather than a panel defect. It is why the gate has a line-box threshold. Worth a
  look when **PNL-004** touches input rows.
- **15 panels do not use `BasePanel`** and were not audited for their own version of this bug — that
  audit belongs with the migration in **PNL-005**, per this task's scope.

## Traps

- **`overflow: overlay` was not the bug.** It is a Chromium alias for `auto`. It is now written as
  `auto` because it was stale, and it fixed nothing.
- **Fixing B hides A.** Removing the 34px gives the panel more room, so a marginal squeeze stops
  showing. Verify each defect separately and shrink the window until content is genuinely taller
  than the panel — 620px height is a good floor.
- **The dev stack dies with the shell.** `nohup setsid npm run dev:debug &` still got SIGTERM'd when
  a foreground Bash call timed out and when a background task was stopped. Launching it as a *tracked*
  background task is what survived a full session.
- **Panels stay mounted.** `document.querySelector('[class*=ChildrenContainer]')` returns the first
  panel in DOM order (Search), not the visible one. Filter on `clientHeight > 0`.
