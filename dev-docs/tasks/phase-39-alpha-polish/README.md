# Phase 39 — Alpha Polish (Track X)

**Created:** 2026-08-03
**Origin:** not the roadmap. Richard drove the editor for an hour the way an alpha user will — opened
the launcher, made a project, built a page with the AI Build panel, opened a backend surface, asked
Provenance why a port was empty, clicked the settings gear — and wrote down everything that was
wrong. Fifteen items. This phase is those fifteen items and nothing else.

## What this phase is

Phase 38 fixed the AI build *loop*. This phase fixes everything the same session walked past on the
way: a settings panel that crashes on open, a rail whose glyphs you can barely see, launcher links
that point at Noodl's domains, backend pages that open at the wrong size, and new projects born
with no font and no icon set.

None of these are architecture. Every one is a small, located mechanism. That is why they are worth
doing before the alpha cut rather than after: they are the first ten minutes of every new user's
experience, and they are all cheap.

**The severity is not uniform.** POL-001 is a hard crash on the panel that owns the theme switch and
the AI provider key — it is alpha-blocking on its own. The rest are polish, and are ordered below by
how early a new user meets them.

## The fifteen, and what each one actually is

| # | What Richard reported | Mechanism | Task |
|---|---|---|---|
| 15 | *"the settings panel when clicked throws 'aw snap'"* | `ProjectModel`'s constructor does `this.settings = {}` and then **unconditionally overwrites it** with `args.settings`, which is `undefined` for a project saved with no settings block. `getSettings()` exists to guard exactly this; four read sites index `.settings[…]` directly instead. `SitemapSection.tsx:10` is the one in the stack trace. | [POL-001](POL-001-SETTINGS-PANEL-CRASH.md) |
| 1 | *"the learn tab needs to be hidden"* | `LauncherHeader.tsx:26` lists it unconditionally. Lessons predate every format change since LEARN-001 and are almost certainly broken. | [POL-002](POL-002-LINKS-AND-THE-LEARN-TAB.md) |
| 2, 5 | *"the links at the bottom left of the launcher need to be changed"* + *"the question mark icon… change it to just have the same links"* | `LauncherFooter.tsx:40-42` points at `docs.noodl.net`, `youtube.com/@noodlapp`, `discord.gg/noodl`. `HelpCenter.tsx` is worse: eleven menu items, an **Algolia index (`docs_2-9`) that is not ours**, `forum.noodl.net`, and `noodl.net/support`. All dead. | [POL-002](POL-002-LINKS-AND-THE-LEARN-TAB.md) |
| 3, 4, 6 | *"the icons and font in dark mode sometimes are black on black"* + the hide-panel icon's size + three glyph swaps + narrow/widen → fold/unfold | Two separate causes. Contrast: rail idle is `--theme-color-fg-muted` (`#6b7682`) on `bg-1` (`#12161b`) — **≈3.8:1**, below the 4.5:1 floor. Size: `Icon.module.scss` **declares no `is-size-*` rules at all**, so every `size={IconSize.Large}` in the codebase is an inert class name (confirms UIX-010). | [POL-003](POL-003-THE-LEFT-RAIL.md) |
| 9b, 12a | *"the code editor modal has a white background"* + *"the provenance tab data values are all black font on a dark background"* | The same class twice. `DialogBackground.Secondary` maps to `--theme-color-secondary`, which is a **neutral action colour** (`#eef2f6` dark / `#18212b` light), not a surface. And `ProvenancePanel.module.scss` reaches for `--theme-color-fg-subtle`, `--theme-color-notice-bg`, `--font-family-mono` — **none of which are defined anywhere**, so eight files are silently painting with hardcoded fallbacks that do not respond to the theme. | [POL-004](POL-004-TOKENS-USED-AS-WHAT-THEY-ARE-NOT.md) |
| 7 | *"an extra X in the top right of every backend page that just collapses the view"* + *"the collapsed version looks perfect"* | Not an extra button — it is PNL-009's detached-panel bar, and it docks. `LocalBackendCard.openSurface` calls `layout.openFull()`; the X takes it back to the 860px docked width the surfaces were designed at. Richard is asking for the docked width to be the default, which deletes the button by making the mode unreachable. | [POL-005](POL-005-BACKEND-SURFACES-OPEN-DOCKED.md) |
| 8 | *"new projects get created with no Google font and no icon pack"* | True, and worse than reported: `TextConfig`, `ButtonConfig` and `TextInputConfig` all default `fontFamily: 'var(--font-sans)'`, and **`--font-sans` is defined in exactly one file in the repo** — a deploy artifact's `index.html`. In the editor preview it resolves to nothing. Icon sets have a working registration path (`noodl_modules/*/manifest.json`, `type: 'iconset'`); no project ships one. | [POL-006](POL-006-A-FONT-AND-AN-ICON-SET.md) |
| 9a | *"the layout of the AI builder page is really embarrassing"* | The operation row is `Icon + Text(flex:1) + elapsed + two or three PrimaryButtons` in an `HStack`, inside a **400px** panel. Button labels do not wrap, so the row's min-content width exceeds the panel and the whole page scrolls horizontally — visible as the scrollbar and the clipped `"of 3 built"` in his screenshots. | [POL-007](POL-007-THE-BUILD-PANEL-FITS.md) |
| 10 | *"I clicked 'sample data' and nothing came up, and the component it created is basic AF"* | Two defects wearing one sentence. The preview rendered but the bound Texts were empty, so sample data did not reach the `User` node. Separately, a Profile page produced 6 nodes with no styling — a prompt/vocabulary problem, not a plumbing one. | [POL-008](POL-008-SAMPLE-DATA-AND-A-THIN-BUILD.md) |
| 11 | *"the pin/unpin bar stays visible even if you navigate to other components"* | `ExecutionOverlay` holds `pinnedExecution` in `useState` and clears it only on an explicit unpin. It never listens for the active component changing — and its own source comment already says a pin over the wrong graph *"looks exactly like a broken canvas"*. | [POL-009](POL-009-A-PIN-BELONGS-TO-ONE-CANVAS.md) |
| 12b | *"it doesn't seem to show the real hops… not really the 'walking back from the node' theory"* | Unresolved. The walk showed one row for `filterCollection.items` and never followed the wire from `Query Messages`. Two candidate mechanisms are named in the task; neither is confirmed, and confirming which is the first slice. | [POL-010](POL-010-THE-WALK-DOESNT-WALK.md) |
| 13 | *"add the 'fx' option to the text node's text field"* | The Text node declares `multiline: true` (`text.ts:44`), which routes the port to `TextAreaType` instead of `BasicType`. `BasicType` sets `supportsExpression: true`; `TextAreaType` has no expression support at all. Button's `label` is a plain string, gets `BasicType`, and gets fx — which is why the two behave differently. | [POL-011](POL-011-FX-ON-MULTILINE-STRINGS.md) |
| 14 | *"set all values at once instead of clicking in and out of each field"* | `MarginPaddingInput` renders four independent fields, and `MarginPaddingType.update()` writes one side per call with its own undo entry. There is no "all four" path and no linked mode. | [POL-012](POL-012-SET-ALL-FOUR-SIDES-AT-ONCE.md) |

## Two design positions

Recorded here because more than one task is downstream of each.

### 1. A token that does not exist is worse than a hardcoded colour

`var(--theme-color-fg-subtle, #7c7c7c)` looks like theming and is not. It renders the same grey in
both themes, it passes review because it *reads* as a token, and nothing fails when the token is
missing — CSS custom properties have no undefined-variable error. Eight files in the editor are
doing this today with six different non-existent names.

The rule this phase adopts: **every `var(--…)` in editor chrome must name a token that is defined in
`colors.css` or `custom-properties/`, and the fallback argument is for genuinely optional tokens
only, never as insurance against a typo.** POL-004 adds a check that fails on an undefined token
name, so this class cannot come back silently.

### 2. Contrast is measured, not eyeballed

Richard reported "black on black". The computed value is `#6b7682` on `#12161b` — not black, but
**3.8:1**, under the 4.5:1 floor, through a 1.5px stroke. He was right about the experience and
imprecise about the cause, and if we had fixed what he literally described we would have fixed
nothing.

The rule: **rail and panel-chrome glyph colours get a computed contrast ratio in the task notes, not
an opinion.** POL-003 carries the numbers.

## Order

POL-001 first and alone — it is a crash on the panel that owns the theme switch and the AI provider
key, which means it also blocks anyone verifying the rest of this phase in light mode.

Then, roughly in the order a new user meets them:
POL-002 (launcher) → POL-006 (new project) → POL-003, POL-004 (chrome, everywhere) →
POL-007, POL-008 (build panel) → POL-005 (backend) → POL-011, POL-012 (property panel) →
POL-009, POL-010 (workflow + provenance).

POL-003 and POL-004 both touch `noodl-core-ui` chrome and should not be run in parallel with each
other in separate worktrees.

## ⚠️ Concurrent-session note

At the time of writing, another session has uncommitted work in:

```
packages/noodl-editor/src/editor/src/models/projectmodel.ts
packages/noodl-editor/src/editor/src/models/projectmodel.editor.ts
packages/noodl-editor/src/editor/src/utils/LocalProjectsModel.ts
packages/noodl-editor/src/editor/src/io/ProjectImporter.ts
packages/noodl-editor/src/editor/src/utils/import-engine/analyze.ts
packages/noodl-editor/src/editor/src/services/ProjectStructure/featureFlags.ts
packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/**
```

**POL-001 needs a one-line change in `projectmodel.ts`, and POL-006 needs one in
`LocalProjectsModel.ts` — both are on that list.** Commit those with an explicit pathspec, never
`git add -A`, and never stash. If the constructor line has already changed underneath you, re-read
it before editing rather than applying the diff in this spec verbatim.
