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
