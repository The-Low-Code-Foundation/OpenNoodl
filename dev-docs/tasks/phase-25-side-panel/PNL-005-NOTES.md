# PNL-005 — One panel chrome, everywhere: notes

**Status:** ✅ Code complete — 2026-07-27. **Live QA owed** (see "Could not verify").
**Spec:** [PNL-005-ONE-PANEL-CHROME.md](./PNL-005-ONE-PANEL-CHROME.md)
**Commits:** `4786509a` (core-ui chrome), `d4d9ad89` (panel migrations), + this file and the gate.

---

## The root cause, confirmed

The spec's central claim held exactly. `PanelHeader.tsx:37` rendered

```tsx
<div className={css['Title']}><Label size={LabelSize.Big}>{title}</Label></div>
```

and `PanelHeader.module.scss` contained **no `.Title` rule whatsoever** — `.Root`,
`.Children` and PNL-003's `.ModeGroup`, nothing else. The title's appearance was
whatever `LabelSize.Big` resolved to (14px / semibold / `fg-default`), inherited by
accident. Every panel that rolled its own header picked something different: 12px
(Components), 13px/600 (Execution History), 14px uppercase with 0.5px tracking
(X-Ray, Trigger Chain), 12px capitalised (Ports). Five treatments, none of them the
shared component's.

The rule exists now, once, in `PanelHeader.module.scss`.

## What the header is

Straight from the mock's `.phead` / `.phead .ptitle`:

| | |
|---|---|
| bar | 44px, `--theme-color-bg-2`, `padding: 0 6px 0 14px`, `gap: 4px` |
| divider | 1px `--theme-color-border-default` (was `--theme-color-bg-1` — a background token doing a border's job) |
| title | `--font-size-md` (13px) / weight **650** / `--theme-color-fg-highlight`, `letter-spacing: -.005em`, nowrap + ellipsis |
| action slot | existing `children` |
| mode group | PNL-003's, behind a hairline, unchanged |

**Deviation — two literals, deliberately.** Weight `650` and `letter-spacing: -.005em`
have no token: the ramp has `--font-weight-semibold: 600` and `--font-weight-bold: 700`,
and `--letter-spacing-tight` is `-0.025em` (five times the mock's). Bending the shared
scales to serve two rules is worse than two literals with a comment. Neither is a hex,
so the ratchet is unaffected. Size uses the token (`--font-size-md` is exactly 13px).

### Three things the implementation had to get right

**The title is a plain `<span>`, not a `Label`.** `Label.module.scss` sets
`display: block; white-space: pre`. `text-overflow: ellipsis` on the *wrapper* can
never engage against a block-level child, so `<div class=Title><Label>` could not
ellipsise no matter what the `.Title` rule said. The same fix went into
`CollapsableSection`.

**The native `title` attribute, not core-ui's `Tooltip`.** This is **F26**: `Tooltip`
wraps its child in a trigger `div` with no `min-width: 0`, which is precisely what cost
PNL-007 its ellipsis until `UNSAFE_triggerClassName` was used. Ellipsised panel titles
would have hit it identically. Sidestepped rather than worked around.

**`min-width: 0` on `.Title`, `flex: 0 0 auto` on `.Children`.** The title absorbs all
of the header's squeeze. This is what actually keeps the action and mode controls inside
the panel at 240px — the thing acceptance item 3 is really asking for.

## The header is now the panel's top edge

`BasePanel`'s `.Root` carries `padding: var(--spacing-panel-padding) 0` and a flex
`gap`, both of which landed *above and below* the header. A "44px header" measured from
the panel's top edge was really 44 + 16 + gap, with the hairline floating in the middle
of the panel ground rather than sitting on the panel's shoulder. `BasePanel.tsx` now
marks itself `has-panel-header` and the rule zeroes the top padding and the gap, moving
the inset onto the scrolling content where it scrolls with it.

> ⚠️ **`BasePanel.module.scss` — appended block, called out as instructed.** PNL-004
> owns that file this wave, so the rule sits in a marked block at the **very end** of
> the file and touches nothing above it. It is ~8 lines (`.Root.has-panel-header`).
> **Fold it into the rules above at the next opportunity.** No other change was made to
> that file.

## Section-header subordination

`CollapsableSection`'s panel-variant header was `--theme-color-bg-3` — *more* prominent
than the panel ground (`bg-2`) that the panel header sits on. The section header was
out-shouting its own parent, which is a large part of the reported "the column reads as
undifferentiated". It moves to `bg-1`, as the mock's `.psec > header` does: recessed in
dark, raised in light, subordinate in both. Its title gets a real `.Title` rule at
12.5px / 650 against the panel header's 13px / 650 — same voice, one step down, plus the
8px height difference (36 vs 44).

**Not done:** the mock's full `.psec` card treatment (1px border, 9px radius, `bg-1`
body). That is a restyle of the section, not of the header, and belongs to PNL-006 /
PNL-008.

## The 14-panel list was wrong in four places

I was asked to confirm the list against the tree rather than the spec. It does not hold:

| Panel | Spec says | Reality |
|---|---|---|
| `auth/AuthPanel` | migrate | **Full-viewport `createPortal` from `LocalBackendCard:326`** — same class as Schema/Permissions/Triggers. Deferred with them. |
| `email/EmailPanel` | migrate | **Same** (`LocalBackendCard:317`). Deferred. |
| `search/SearchPanel.tsx` | "a dead duplicate, no importer" | **False.** It is imported at `LocalBackendCard.tsx:25` and is BAK-008's backend full-text search overlay — a different panel entirely, not a duplicate of `search-panel/search-panel`. It is the seventh portal. **Do not file it for DEBT-010 on the "dead duplicate" grounds.** |
| `MigrationNotesPanel` | migrate | **Zero importers repo-wide.** Already recorded as "built–not wired" in `phase-2-react-migration/PROGRESS.md:50`. Not a sidebar panel; not migrated. |
| `GraphDiffPanel` | migrate | **Not a sidebar panel.** The `GraphDiffPanel` component itself has no consumer; the live exports are `ComponentDiffView` and `GraphConflictList`, used *inside* `VersionControlPanel` (already on `BasePanel`), `ImportFlow` and `ChangeReviewDocument`. Content, not chrome. Not migrated. |
| `componentports` ("Ports") | **absent from the list** | A registered panel (`id: 'PortEditor'`) wearing a **fifteenth** header — the legacy 33px `.sidebar-panel-header` with a 12px capitalised label. Migrated. |

That leaves the deferral set at the **seven** `createPortal` overlays — DataBrowser,
Schema, Permissions, Triggers, Email, Auth, Search — exactly the set PNL-009's remaining
half moves onto the real full-panel mode. They were not touched and not half-migrated.

## What landed, panel by panel

| Panel | Before | After |
|---|---|---|
| `componentspanel` → `ComponentsPanelReact` | 36px `bg-3` bar, 12px title, sheet selector inline | `BasePanel`; sheet selector in the action slot; `.ComponentsPanel`/`.Header`/`.Title` deleted |
| `ExecutionHistoryPanel` | 12/16px bar, 13px/600 title, `↻` in a bare `<button>` | `BasePanel`; Refresh is an `IconButton` in the action slot; `.Panel`/`.Header`/`.Title`/`.RefreshButton` deleted |
| `ComponentXRayPanel` | 16px bar, 14px uppercase `h2` + component name | `BasePanel`; the component-name band **stays as content** (it names the subject, not the panel); `.ComponentXRayPanel`/`.Title` deleted |
| `TriggerChainDebuggerPanel` | 16px bar, 14px uppercase `h2`, recording pill | `BasePanel`; the recording pill is an action-slot chip, resized to 22px to sit beside 27px icon buttons; shell + `.Header` + `.Title` deleted |
| `GitHubPanel` | **no title bar at all**; `.Header` is a tab strip | `BasePanel` wrapped **once** around a renamed `GitHubPanelContent`, so all six early returns (initialising / loading / not connected / no remote / not GitHub / not ready) get a header. Tab strip untouched. |
| `propertyeditor` | no panel header; PNL-007's node header only | `BasePanel title="Properties"` **around** PNL-007's bar, PAR-002's `bg-1` ground preserved via `UNSAFE_style` |
| `componentports` | legacy 33px `.sidebar-panel-header` | `PanelHeader` directly |

Every registered panel is now on the shared chrome. Verified against `router.setup.ts`:
all 21 registrations resolve to a component that renders `BasePanel` (or, for
`componentports`, `PanelHeader`).

### Why the property editor gets a header *and* PNL-007's bar

They are not duplicates. PNL-007's bar names the **subject** (the node — name, type
chip, rename/docs/delete). `PanelHeader` names the **panel**. Read `PNL-007-NOTES.md`
first, as instructed: nothing in it was reverted — `NodeLabel` is untouched.

There is also a concrete functional gain, not just consistency. `PanelHeader`'s mode slot
is where PNL-003's widen/hide and PNL-009's float/full live. Without a `PanelHeader`,
selecting a node switched you to a panel with **no mode controls at all**. It has them now.

`componentports` is the one place that is still true: it is mounted into its own React
root (`createRoot` in `componentports.tsx`), and `PanelModeSlotContext` does not cross a
root boundary. It gets the same bar, no mode controls — the same as today, not a
regression. Worth a follow-up if anyone cares about widening the Ports panel.

## Deviations from the spec, with reasoning

**1. No `⋯` overflow menu at narrow widths.** The spec (and acceptance item 3) wants the
mode group down to widen + hide + `⋯` under 360px. The mode buttons are built in
`SidePanel.tsx`, outside this task's territory, and **hiding float and full without
building the menu that holds them would make those actions unreachable** — a functional
loss traded for a cosmetic gain. What is delivered instead is the part that matters: the
title absorbs the squeeze, the bar gives back its own horizontal padding under 360px, and
nothing is pushed out of the panel. The hook is in place and commented — tag the
demotable controls `data-panel-chrome="secondary"` and the container query already hides
them. **Acceptance item 3 is therefore partially met by design; the "no overflow at
240px" half is met, the "`⋯`" half is not.**

**2. The container query is written but not declared here.** As instructed:
`@container panel-frame (max-width: 359px)` in `PanelHeader.module.scss`, with
`container: panel-frame / inline-size` left for PNL-004 to declare on `BasePanel`'s
`.Root`. **This cannot be visually verified until both land** — until PNL-004 merges, the
query matches nothing and the header simply keeps its wide padding. That is a safe
no-op, not a broken state.

**3. `--font-weight: 650` and `letter-spacing: -.005em` as literals.** See above.

**4. `UNSAFE_content_style={{ paddingInline: 0, paddingTop: 0 }}` on five panels.**
`BasePanel`'s `.ChildrenContainer` insets its content 16px. For a tree, a list and three
legacy-hosted views that already manage their own padding, that would have double-inset
them or broken full-bleed row fills. `UNSAFE_content_style` is the existing escape hatch
and was used rather than adding a prop. PNL-004/PNL-006 may want to replace it with
something less blunt.

**5. `.AddButton` in `ComponentsPanel.module.scss` left in place.** It is dead, but it was
dead *before* this task — it has no reference in any revision of `ComponentsPanelReact`.
Deleting it is PNL-006's call, and it is flagged in the file.

## F28 — the mode buttons' `data-test` ids are not unique

Confirmed. `SidePanel.tsx:324-355` keeps **every** panel mounted behind
`display: none` and wraps them all in one `PanelModeSlotProvider`, so every mounted
`BasePanel` renders its own copy of `side-panel-wide-toggle`,
`side-panel-float-toggle`, `side-panel-full-toggle` and `side-panel-hide-toggle`.
A dozen of each in the document.

**The cheap half, done here:** `PanelHeader`'s root now carries
`data-test="panel-header"` and `data-panel-title={title}`, so the ids become
*addressable* — `[data-panel-title="Components"] [data-test="side-panel-wide-toggle"]`
resolves to exactly one node. The new gate below relies on this.

**The real fix, not done — it is in `SidePanel.tsx`, which is not this task's
territory:** move `PanelModeSlotProvider` *inside* the `Object.entries(panels).map()`
and pass `slot={id === activeId ? modeSlot : null}`. Three lines. Whoever owns
`SidePanel.tsx` next (PNL-009's second half) should take it.

## Verification — what was and was not run

### Ran (these work in a worktree)

| Gate | Before | After |
|---|---|---|
| `npx tsc --noEmit -p packages/noodl-editor/tsconfig.json` | clean | **clean** |
| `npx tsc --noEmit -p packages/noodl-core-ui/tsconfig.json` | 45 errors | **45 errors** — all pre-existing `TS2307` on `@noodl-versioning` / `@noodl-store` / `@noodl-viewer-cloud`, because core-ui's tsconfig pulls in editor sources without the editor's path aliases. Zero new. |
| `node scripts/hex-color-ratchet.js` | `noodl-editor 16 / baseline 16` | **`noodl-editor 16 / baseline 16`, delta `=`** — holding. (core-ui is already 0 and does not appear in the table.) |
| `node --check` on the new gate | — | syntax OK |

`noodl-core-ui` has no jest/test script in its `package.json`, and no test file in
either package references `PanelHeader`, `BasePanel` or `CollapsableSection`. There was
no unit suite to run for this change.

### Could NOT verify — be sceptical of anything below this line

**`npm run test:ci` for `noodl-editor` was not run, and neither was the editor itself.**
`lerna exec` resolves the package root to the **main checkout**, so an editor launched
from this worktree executes main-checkout code and any result would be unrelated to this
diff. Running it would have produced a number, not evidence. Specifically unverified:

1. **All six acceptance items.** Nothing in this task has been seen rendered.
2. **Every screenshot the spec asks for** (`screenshots/pnl-005/`, both themes). The
   directory is empty; a scripted capture is committed instead — see below.
3. **The container query** — inert until PNL-004 lands (deviation 2).
4. **`CollapsableSection`'s `bg-3 → bg-1`** in *light* theme, where `bg-1` is pure white
   against the panel's `#F7F9FB`. It matches the mock and is subordinate by type and
   height regardless, but it is the change most likely to need a second look.
5. **`Frame`-hosted panels at the taller header** — `propertyeditor` (`ScrollArea` →
   `Frame isContentSize`) and `ProjectSettingsPanel` (legacy `Ports` via `Frame`). The
   flex chain is unchanged and one 44px sibling was added above it, so the risk is low,
   but this is acceptance item 6 and it is exactly what the orchestrator asked to be
   reported rather than guessed at.
6. **The Components panel's sheet-selector dropdown escaping the 44px header.** It is an
   absolutely-positioned in-flow dropdown, not a portal; no ancestor in the new chain
   sets `overflow: hidden` (`BasePanel .Root`, `PanelHeader .Root`, `.Children` are all
   `visible`), so it should still open over the tree. Should.
7. **`propertyeditor` on the `AiAssistant` path** (`AiPropertyEditor` with its `Tabs`),
   which needs an AI node selected.

## The capture / QA plan — one command

`dev-docs/tasks/phase-23-visual-refresh/corpus/panel-chrome.mjs` is committed. It extends
the phase-23 corpus harness (same shape as `capture.mjs` and PNL-001's
`panel-geometry.mjs`: one raw CDP socket, zero dependencies, drives the real editor) and
turns "screenshot every panel in both themes" into one command — **and asserts the
chrome, which a screenshot cannot**.

Per panel, per theme, at full width and forced to 240px, it checks:

- **A.** exactly **one** visible `[data-test="panel-header"]` — not zero (never migrated)
  and not two (kept its own bar as well). *Acceptance 1.*
- **B.** the header is 44px.
- **C.** the title computes to 13px / 650 / `nowrap` / `ellipsis`, on one line.
- **D.** nothing in the header sits past the panel's right edge. *Acceptance 3* — this is
  PNL-007's item-8 assertion generalised.
- **E.** section headers are shorter than the panel header and set smaller than its
  title. *Acceptance 4.*

Screenshots land in `dev-docs/tasks/phase-25-side-panel/screenshots/pnl-005/` as
`<panel>--<theme>.png` and `<panel>--<theme>--narrow240.png`. *Acceptance 5.*

### Run it from the PRIMARY checkout, after merge

```bash
# 1. editor up, project open (the rail does not exist at the launcher)
nohup setsid npm run dev:debug -- --quiet > /dev/null 2>&1 &
until curl -s http://localhost:9222/json/list >/dev/null; do sleep 5; done
#    then open a project — Agent Chat Example is the usual one

# 2. the gate + the corpus, both themes, one command
node dev-docs/tasks/phase-23-visual-refresh/corpus/panel-chrome.mjs \
  --width 1400 --height 900 \
  --json /tmp/pnl-005-chrome.json

# 3. the gates PNL-001 and UIX-009 already own, to prove nothing regressed
node dev-docs/tasks/phase-23-visual-refresh/corpus/panel-geometry.mjs --width 1280 --height 720
node scripts/hex-color-ratchet.js

# 4. the suites a worktree cannot run
npx lerna exec --scope noodl-editor -- npm run test:ci
```

Then `git add dev-docs/tasks/phase-25-side-panel/screenshots/pnl-005` and commit the
corpus.

### Ordered live-QA checklist (both themes, ⌘-toggle between them)

The script covers 1, 3, 4 and 5 mechanically. These are the ones that need eyes:

1. **Components** — the `bg-3` bar is gone; the sheet selector opens **over the tree**
   from the action slot and its dropdown is not clipped by the 44px header; create /
   rename / delete sheet still work. *Acceptance 2.*
2. **Properties** — select a node. The "Properties" bar sits above PNL-007's node header;
   the node name still ellipsises; double-click rename, Escape, the pencil and the check /
   cancel pair all still behave (PNL-007's items 3a/3b/4/5a/5b). The `Frame` content below
   is not clipped at the bottom and does not overlap. *Acceptance 6.*
3. **Ports** — select a Component Inputs/Outputs node. 44px header reading "Ports"; the
   port list scrolls; drag-to-reorder still works.
4. **Project Settings** — the legacy `Ports` view via `Frame` renders at the right height
   with nothing clipped. *Acceptance 6.*
5. **Editor Settings / App Setup / Backend Services** — collapsable sections read as
   *inside* the panel, not as sibling panels. Check light theme especially. *Acceptance 4.*
6. **Execution History** — the Refresh icon button works and its tooltip shows.
7. **Trigger Chain Debugger** — start recording; the chip appears in the header and does
   not push the mode buttons out.
8. **GitHub** — with and without a GitHub remote: a header in *every* state, including
   the "Connect GitHub" empty state.
9. **X-Ray, Explain, Build, Docs, Problems, Version Control, Search, History, File
   Explorer, Design Tokens, Node References** — click through; header present, one per
   panel, same treatment.
10. **Narrow** — drag the divider to ~240px on the panel with the longest title
    (Trigger Chain Debugger). The title ellipsises, the mode buttons stay inside the
    panel. Then ⌘\ to widen and back.

## Traps met

- **A fresh worktree is rooted ~500 commits behind.** Seven for seven, and this was the
  eighth. `git merge --ff-only cline-dev` before anything else; the spec file's existence
  is the cheap tell.
- **`Label` cannot ellipsise.** `display: block; white-space: pre` — an ellipsis on the
  wrapper is dead CSS. Two components had this bug (`PanelHeader`, `CollapsableSection`)
  and in both the *stated* intent was a single ellipsised line.
- **`Tooltip`'s trigger div has no `min-width: 0`** (F26). Known from PNL-007; avoided
  here by using the native `title` attribute for the one string that has to shrink.
- **A panel with early returns needs wrapping at the top, not at each return.**
  `GitHubPanel` has six; five of them are the states where a missing header is most
  confusing.

---

# Follow-up — after the coordinator's live run (2026-07-27, post-merge `3deb7208`)

The gate was run from the primary checkout with a project open. It found a real gap, it
died partway, and one of its passes turned out to be green about the wrong thing. All
three are addressed below.

**Commits:** `6946bcae` (chrome-less states), `96c81b5a` (gate + band mixin).

## 1. "Every registered panel is on the shared chrome" was false — it was a *state*, not a panel

The gate reported `versioncontrol-panel — no panel header at all`. `VersionControlPanel`
*is* on `BasePanel`, with `title="Version Control"`, in two of its three render paths.
The third was:

```tsx
// TODO: Loading state? Should be really quick though
if (git === null) {
  return null;
}
```

A registered panel rendering **nothing**: no header, no content, a blank column. And the
TODO's "should be really quick" is only true on the happy path — the `isGitProject()`
promise that clears this state carries **no `.catch()`**, so a rejection leaves the panel
blank *permanently* rather than briefly. That is very likely what the gate actually
caught, since it reproduced in both the wide and the 240px pass.

It now renders `<BasePanel isFill title="Version Control" hasActivityBlocker />`. The
underlying missing `.catch()` is left alone — it is a VersionControl defect, not a chrome
one, and is filed here rather than fixed silently. **The chrome is no longer conditional
on the content being ready**, which is the general rule this task should have applied
from the start and did not.

`BasePanel`'s `children` is now optional, so a loading panel does not have to choose
between `{null}` boilerplate and rendering no chrome.

### The audit for others in the same position

Every one of the 21 `SidebarModel.instance.register()` calls was traced, including
commented-out ones. Results:

- **One more, `componentports` ("Ports")** — same shape, different cause. Its header sat
  inside `ComponentPortsView`, which `Frame` renders into its **own React root**
  (`createRoot`). Before `instance` existed, the whole panel was an empty `<div>`.
  The header moved up into `ComponentPortsComponent`, in the main tree.
  **This also fixed something the first commit documented as unavoidable:**
  `PanelModeSlotContext` does not cross a root boundary, so Ports could never show
  widen / hide / float / full. In the main tree it can, and does. `title` is gone from
  `ComponentPortsViewProps` so a second header cannot be added back by accident.
- **`PropertyEditor`** has the identical first-render window (`instance === null`) but is
  already safe: the `BasePanel` wraps the `Frame`, so the header renders regardless.
  This is the pattern; `componentports` now matches it.
- **Everything else is clean.** All other registered panels wrap every render path, and —
  the trap worth naming — **no `<BasePanel>` anywhere in the panels tree is missing a
  `title` prop**, which matters because `BasePanel` renders no header at all without one.
  `GitHubPanel`'s six early returns are all inside the outer wrapper, as intended.
- **Not fixed, filed:** `UndoQueuePanel` renders `title="History"` while registered as
  `name: 'Undo Queue'` — the header disagrees with the rail tooltip. Cosmetic, but it is a
  "one chrome" concern. Not changed here because I do not know which of the two names is
  the intended one, and guessing at a user-visible label is not my call.
- **Not fixed, out of scope:** the two commented-out panels (`TopologyMapPanel`,
  `DataLineagePanel`) both hand-roll headers and would be findings if re-registered.
  DEBT-010 / DEBT-012 own them.

## 2. What wedged the renderer — and why the editor stayed broken afterwards

These are two different failures and it is worth separating them.

**Why the editor was unusable *afterwards*: the harness leaked its overrides.** On any
failure the old script called `process.exit(1)` while `width: 240px !important` was still
injected as a `<style>` in the page, and with `Emulation.setDeviceMetricsOverride` still
set. The injected stylesheet is not undone by the socket closing — it is just DOM. So the
side panel stayed pinned at 240px with `!important`, the divider drag did nothing, and the
editor looked dead. **This is almost certainly the "unresponsive afterwards", and it is
now impossible:** the overrides are released in a `finally` that runs on every path.

**Why the `Runtime.evaluate` timed out in the first place — most likely a layout feedback
loop.** `forcePanelWidth` was toggled *four times per panel* (wide → narrow → release, per
panel, per theme): about 44 forced relayouts of a canvas-bearing Electron app, each one
fighting machinery that reacts to exactly that — PNL-003 persists the panel width,
`EditorPage` recomputes the divider on resize, and the canvas repaints on every change. A
resize → restyle → resize loop pegs the main thread, and a pegged main thread is precisely
a `Runtime.evaluate` timeout. It is consistent with the run getting most of the way
through before dying rather than failing early.

Mitigations, in order of confidence:

- The width override is now applied **twice per theme**, not twice per panel — a whole
  wide pass over every panel, then a whole narrow pass. ~44 relayouts become 4.
- `--skip-narrow` removes the width override entirely, so if it happens again one run
  settles whether the override is the cause.
- The theme toggle is the other suspect and is *not* mitigated, because it is two DOM
  writes per theme and was already cheap. If `--skip-narrow` still wedges, it is the
  theme path or the screenshot call.
- `Page.captureScreenshot({ fromSurface: true })` is the third suspect — it captures from
  the OS compositor and can block on an occluded window. It now has its own 15s timeout
  rather than sharing the default.

**And the run no longer dies as a unit.** Each panel is isolated in a try/catch: a timeout
skips that panel and is recorded, screenshots are taken *before* asserting so a failing
panel still leaves an image, the JSON report is flushed after every panel, and three
consecutive timeouts abort cleanly rather than grinding through thirty more 8-second
waits.

## 3. The gate was green about "Co…" — assertion F

This was the most valuable finding and the most embarrassing. `components-panel--dark.png`
shows the title rendered as **"Co…"**, and the gate passed it, because
single-line-and-ellipsised is exactly what assertion C checks. The gate measured
conformance to a rule while the rule was producing the outcome the mock explicitly named
as the failure: *"the header keeps only widen and hide, and moves Float and Full into an
overflow menu **rather than truncating the panel title to 'Compo…'**"*.

**I was wrong to call the missing `⋯` menu a cosmetic trade.** It is a functional loss —
the panel stops saying what it is — and my deviation note argued the opposite. Correcting
that here rather than leaving it in the record.

**Assertion F**, added: at the panel's *default* width, measure how many characters of the
title actually fit — real `measureText` in the renderer, in the header's own computed
font, binary-searching the longest prefix that fits inside `clientWidth` allowing for the
ellipsis glyph — and fail below `--min-title-chars` (default 12, clamped to the title's
own length so short names like "Docs" pass). "Co…" is 2 against a floor of 10 for
"Components": red.

It is reported separately, as `▲ EXPECTED`, with the reason inline:

```
▲ 1 EXPECTED failures — the ⋯ overflow menu is not built yet (SidePanel.tsx):
  - components [dark] wide: title "Components" renders only 2 of 10 characters
    ("Co…") in 24px at a 380px panel — needs 10. The action slot and four mode
    buttons are eating the bar; this is what the ⋯ overflow menu is for.
```

**This gate is now expected to exit non-zero until the overflow menu lands.** That is
deliberate and was asked for. The wave-2 agent that owns `SidePanel.tsx` turns it green by
tagging Float and Full `data-panel-chrome="secondary"` — `PanelHeader.module.scss` already
has the container query that hides them — and building the `⋯` that holds them.

## 4. Coverage: the rail shows 8 of 21 panels by default

The audit turned up something the first version of the gate hid. `router.setup.ts`
registers 21 panels, but a rail walk cannot see most of them:

- `transient: true` — `PropertyEditor`, `PortEditor` — are filtered out of
  `getVisibleItems()` entirely; they appear only on canvas selection.
- `experimental: true` — 10 panels — need `experimental.panel.<id>` set in EditorSettings.
- 3 more sit behind `config.devMode`.

**A default-settings editor shows 8 rail buttons.** The coordinator's run saw 11, so some
experimental flags were on; either way "11 panels walked" is not "every panel checked",
and a gate that quietly covers a third of the surface is how a gap survives a green run —
which is exactly what happened to `versioncontrol`.

The gate now prints what the rail reached, prints anything mounted but not rail-reachable,
and takes `--expect-panels N` so a shrinking rail is loud rather than silent. **Properties
and Ports still need checking by hand** — they are items 2 and 3 of the live-QA checklist
above.

## 5. Band boundary synced

PNL-004 corrected my `@container panel-frame (max-width: 359px)` to 357px in `68fdff3b` —
`.Root`'s padding is vertical only, so the frame's content box is the panel width less 2px
of border. That number is no longer written in this file at all: `PanelHeader.module.scss`
now goes through `bands.frame-narrow` from `PanelRow/panel-bands.scss`, which owns the
offset arithmetic. Verified: the compiled CSS emits `@container panel-frame (max-width: 357px)`.

## Gates, re-run

| Gate | Result |
|---|---|
| editor `tsc` | clean |
| core-ui `tsc` | 45, unchanged, all pre-existing `TS2307` |
| `node scripts/hex-color-ratchet.js` | `noodl-editor 16 / baseline 16`, delta `=` |
| `npx sass` on every changed `.module.scss` | compiles; band resolves to 357px |
| `node --check panel-chrome.mjs` | OK |

## Still could not verify

Unchanged from the first pass, and now with two more items:

- **The `componentports` restructure is the highest-risk unverified change in this task.**
  A legacy imperative view hosted through `Frame` had its header moved into the outer
  React tree and the `Frame` re-parented into a flex column. The flex chain is
  `PanelItem → column div → PanelHeader (44px) + flex:1 min-height:0 → Frame (100%×100%)`,
  which should behave, but **the port list's scrolling and drag-to-reorder need a live
  look** — item 3 of the checklist.
- **`VersionControlPanel`'s loading state** now renders a header plus an activity blocker.
  Reaching it deliberately means opening a non-git project, or a project whose git open is
  slow. Worth checking that the blocker does not sit on top of the header.
