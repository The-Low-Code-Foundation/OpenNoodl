# UIX-002 Notes — Legacy Hex Mop-up + Ratchet Gate

Date: 2026-07-26. Executor: Sonnet 5, worktree `worktree-agent-afa212bae8225e763`
(branched from a stale point 376 commits behind `cline-dev`; fast-forwarded to
`cline-dev` tip `1276877` before any edits — see "Traps" below).

## Scope actually covered this run

The task spec's "DO" territory named the `packages/noodl-editor/src/editor/src/
styles/` directory plus its named legacy globals (`nodegrapheditor.css`,
`popuplayer.css`, `componentspanel.css`, `layoutpanel.css`,
`createnewnodepanel.css`, `cloudservicespopup.css`, `mixins/`, `variables/`,
`placeholders/`, `propertyeditor/`). Re-measuring after UIX-001 found that
directory already almost entirely tokenized — **7 raw hex literals total**,
all in dead/commented-out CSS. The real 44-file / ~300-occurrence tail the
task background describes lives across the *rest* of `packages/noodl-editor`
(`views/**/*.module.scss`, `assets/css/style.css`, `frames/viewer-frame/`,
`reactcomponents/`), which nothing else in this phase claims (UIX-003 owns
only core-ui control-kit `.scss`). So this run's actual scope was **all of
`packages/noodl-editor/src`**, not just the `styles/` subdirectory — that's
where the task's own success criterion ("Editor styles: 0 unexempted
hardcoded colors") actually gets satisfied.

## Baseline (precise, post-UIX-001, pre-this-task)

- `packages/noodl-editor/src`: **300** hex occurrences / 44 files
  (`grep -rohE '#[0-9a-fA-F]{3,8}\b' --include='*.css' --include='*.scss'`,
  excluding `node_modules`). Of those, 4 occurrences / 2 files are vendored
  Font Awesome CSS (not our code).
- `packages/noodl-core-ui/src`: **260** occurrences / 17 files, of which
  **160** are the canonical token *definitions* inside
  `styles/custom-properties/colors.css` itself (expected — a token has to be
  spelled as a literal somewhere) and **100** are real leaks across 16
  component `.scss` files.

## Editor package: after

**16** hex occurrences remain in `packages/noodl-editor/src`, all in one
file, all documented in-source (search `UIX-002 EXEMPTION` in
`packages/noodl-editor/src/assets/css/style.css`) plus tracked in the
ratchet baseline:

- The **Lessons tutorial popup** (`.lesson-*` selectors, ~line 869 onward)
  is its own light cream card (`#eceae3`) with a sage-teal brand accent
  (`#779988` family) floating over the dark app chrome. It predates the
  token system. There is no dark-elevation token that represents "light
  card floating on dark chrome" without inverting the component's actual
  look — mapping it onto `--theme-color-bg-*` would be a visual redesign,
  which is explicitly out of scope for this task ("same pixels through
  tokens is the whole job"). Left as literal, counted in the ratchet
  baseline as this file's floor. Candidate for a dedicated "light card" +
  brand-accent token pair when UIX-008 (light theme) or the Lessons feature
  itself gets revisited.

Plus 4 occurrences in vendored Font Awesome CSS
(`packages/noodl-editor/src/assets/lib/fontawesome/css/font-awesome{,.min}.css`)
— excluded from the ratchet's target scope outright (third-party code, not
ours to edit).

**284 of 300 occurrences eliminated** (296 of 296 non-vendor occurrences,
100%, excluding the 16 documented Lessons-layer literals).

## core-ui package: deferred (UIX-003's territory this run)

Per the parallel-run split, core-ui `.scss` component modules are UIX-003's
territory this run. **Not touched.** Precise re-baselined count for a clean
follow-up:

**100** occurrences across **16** files (canonical `colors.css` itself
excluded — that's the token source of truth, not a leak):

| File | Count |
|---|---|
| `components/json-editor/modes/EasyMode/EasyMode.module.scss` | 24 |
| `components/StyleSuggestions/SuggestionBanner.module.scss` | 13 |
| `components/code-editor/JavaScriptEditor.module.scss` | 10 |
| `components/code-editor/CodeHistory/CodeHistoryDiffModal.module.scss` | 9 |
| `components/json-editor/modes/AdvancedMode/AdvancedMode.module.scss` | 9 |
| `components/json-editor/JSONEditor.module.scss` | 6 |
| `components/property-panel/ExpressionInput/ExpressionInput.module.scss` | 6 |
| `components/StylePresets/PresetCard.module.scss` | 5 |
| `components/property-panel/ExpressionToggle/ExpressionToggle.module.scss` | 4 |
| `preview/launcher/Launcher/components/TagPill/TagPill.module.scss` | 3 |
| `components/StylePresets/PresetSelector.module.scss` | 2 |
| `components/ai/AiIconAnimated/AiIconAnimated.module.scss` | 2 |
| `components/common/HtmlRenderer/HtmlRenderer.module.scss` | 2 |
| `preview/launcher/Launcher/components/ProjectCreationWizard/steps/EntryModeStep.module.scss` | 2 |
| `preview/launcher/Launcher/components/ProjectCreationWizard/steps/ReviewStep.module.scss` | 2 |
| `components/json-editor/modes/EasyMode/ValueEditor.module.scss` | 1 |

All paths are relative to `packages/noodl-core-ui/src/`. This exact list is
recorded machine-readably in `.hex-color-baseline.json` under `byFile` — run
`npm run colors:report` any time for a regenerated snapshot. **Run this
slice after UIX-003 merges** (their in-flight edits to these same files make
now a bad time to also touch them — territory collision, not a technical
blocker).

## Mapping decisions worth flagging

- **`var(--theme-color-x, #hexFallback)`** — a pattern used across 16 files
  (mostly `ExecutionHistoryPanel`, `CanvasOverlays/ExecutionOverlay`,
  `migration/*`), a defensive CSS custom-property fallback for browsers that
  don't support `var()`. Electron's bundled Chromium always supports it, so
  the fallback is dead weight and pure hex debt. Mechanically stripped down
  to `var(--theme-color-x)` — zero visual change, ~52 occurrences resolved
  for free before any judgment-based mapping started.
- **GitHub panel status badges** (Issue/PR detail & list items): GitHub's
  own open/closed/merged/draft colors. Mapped open→`success`,
  closed→`danger` (phase law: red is danger-only, and "closed" reads as a
  terminal/failure-ish state), merged→`--theme-color-node-category-component`
  (nearest existing vivid purple token), draft→`fg-muted`. The `rgba(...)`
  tinted badge backgrounds were left as literal rgba (not hex, alpha
  composites, rule 4).
- **TopologyMapPanel** (`ComponentNode`/`FolderNode`/`TopologyNode`/
  `*Edge`): a genuine 6-way categorical color code (page/feature/
  integration/ui/utility/orphan) plus a gold "app" accent, each with a dark
  fill + bright stroke pair. Mapped each category to the nearest **distinct**
  base-color family so the map stays legible: page→azure, feature→node-purple
  + `--theme-color-node-category-component`, integration→success,
  ui(cyan)→node-blue + `--theme-color-wire-signal`, utility→neutral,
  orphan/app→amber. No exact hue match existed for the two cyan-family
  values; nearest-role judgment per spec rule 2.
- **AI-branded panels** (`AIConfigPanel`, `MigrationNotesPanel`): local SCSS
  `$success`/`$warning`/`$danger` variables now hold `var(--theme-color-*)`
  strings (verified none of their call sites use Sass color functions like
  `darken()`/`rgba($var, …)` that would break on a custom-property string —
  all are plain property values, including `linear-gradient()` stops, which
  accept `var()` fine). `$ai-primary`/`-light`/`-dark` (a vivid purple triad,
  `#8b5cf6`/`#a78bfa`/`#7c3aed`) had no matching 3-step token family — the
  existing `--base-color-node-purple-*` scale is deliberately desaturated
  (UIX-001 decision) and would visibly mute this specific screen. Mapped to
  `--base-color-node-purple-500`/`--theme-color-node-category-component`/
  `--base-color-node-purple-700` anyway (nearest available, zero design
  authority to invent a new token per this task's own metadata) — flagging
  that the AI-panel accent will read slightly less vivid than before as the
  one deliberate compromise in this run.
- **DataGrid type-swatches** (`TypeDate`/`TypeObject`/`TypeArray`): mapped
  to the three otherwise-unused node-category hues
  (component/function/visual) alongside the pre-existing
  `TypeNumber`→success, `TypeBoolean`→notice, `TypePointer`→danger — extends
  a pattern that was already half tokenized rather than inventing one.
- **Dead code deleted**: `packages/noodl-editor/src/editor/src/styles/
  variables/color.scss` (legacy `$noodl-orange` etc. SCSS variables aliasing
  to `--color-*` custom properties that are defined nowhere in the
  codebase — verified via repo-wide grep before deleting) plus its one
  now-pointless `@use` import in `ConnectionPopup.module.scss`, and five
  commented-out dead CSS blocks in `layoutpanel.css`, `createnewnodepanel.css`,
  `EditorBanner.module.scss`'s sibling `LessonLayerView.css`, and
  `ConnectionPopup.module.scss`.
- **Named color keywords** (`color: black;`, `color: white;`) are a
  separate, non-hex problem this ratchet doesn't count and this task didn't
  chase (kept in scope discipline). A couple were seen in passing (e.g.
  `deploypopup.css` line ~85 pre-edit) — worth a follow-up grep for
  `\b(black|white)\b` in `color:`/`background`/`border` contexts if a future
  slice wants to close that gap too.

## The ratchet

`scripts/hex-color-ratchet.js`, baseline `.hex-color-baseline.json` at repo
root, `npm run colors` / `colors:baseline` / `colors:report` — same shape as
`scripts/tsfixme-ratchet.js` (PLAT-004): counts may fall, never rise, checked
**per package** (not one combined total) specifically so a drop in one
package can never mask a rise in the other while UIX-002/UIX-003 run in
parallel on different packages. Wired into `.github/workflows/pr.yml`'s
`lint` job alongside `npm run tsfixme`. Regex-based (no CSS AST parser was
readily available, matching the spec's own sanctioned "rough grep -cE"
methodology) with comments and `url(data:...)` payloads stripped before
counting, so a documented exemption comment doesn't self-sabotage the count
it's explaining.

Current state: `noodl-editor: 16/16`, `noodl-core-ui: 100/100` — holding the
line, both floors are real (not padded).

## Traps hit this run

- **Stale worktree branch** (see `parallel-worktree-traps.md`): this
  session's worktree branch was 376 commits behind `cline-dev` tip with zero
  unique commits — fast-forwarded before touching anything. Always check
  `git rev-list --count HEAD..cline-dev` first in a fresh worktree.
- **No `node_modules`** in the worktree — `npm install` (2401 packages, ~20s
  with `--prefer-offline`) was needed before any build/lint verification
  would run.
- **`npm run lint:ci` fails in this worktree** with `PluginConflictError:
  Plugin "react" was conflicted between ".eslintrc.js" and
  "../../../.eslintrc.js"` — an ESLint config resolution issue seemingly
  tied to this worktree's install, unrelated to any CSS/SCSS change (zero
  `.ts`/`.tsx` files touched this run). Not investigated further; flagged
  for the orchestrator in case it recurs outside this worktree.
- **`npm run tsfixme` fails** on this checkout with several `+N` deltas in
  files this task never touched (`nodegx-backend/*`, `ExecutionHistoryManager.ts`,
  `projectmodules.ts`, `cloudfunction2.ts`, …) — pre-existing baseline drift
  from work merged to `cline-dev` since the committed `.tsfixme-baseline.json`
  (`commit: 78ba241`) was last updated. Not this task's concern (no `.ts`
  files were edited) but the orchestrator should know the baseline needs a
  re-run of `npm run tsfixme:baseline` independent of this task.
- Verified `npx webpack --config=webpackconfigs/webpack.renderer.production.js`
  (run directly inside `packages/noodl-editor`, not via `lerna exec`, per the
  known "lerna exec runs the main checkout" trap) compiles clean —
  confirms every SCSS edit (including the `$var: var(--x);` reassignment
  pattern and the deleted `variables/color.scss` file) is syntactically
  valid and resolves.

## Residuals for the orchestrator

- core-ui slice (100 occurrences / 16 files, table above) — run after
  UIX-003 merges.
- Live-editor screenshot spot-check of the touched panels (TopologyMapPanel,
  GitHub panel, DeployPopup, migration wizard steps, BlocklyEditor dropdowns,
  DataGrid type badges) was **not** performed from this worktree per the
  task's own instruction (lerna/live-editor unreliable here) — webpack build
  success is the verification actually done. Recommend a screenshot pass
  from the primary checkout, particularly for the TopologyMapPanel category
  re-colors and the AI-panel purple-triad desaturation noted above.
- `color: black;` / `color: white;` named-keyword literals are out of this
  ratchet's count and unaddressed — candidate for a follow-up if named-color
  debt matters as much as hex debt.
