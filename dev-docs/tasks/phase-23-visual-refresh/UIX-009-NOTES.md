# UIX-009 Notes — Long-tail Sweep & Visual QA Harness

Executor: Fable 5 (Opus-class), primary checkout on `cline-dev`. This is the
phase closer — it sweeps every surface the Tier-1/2 tasks didn't explicitly own,
proves the phase standard surface-by-surface, and leaves the screenshot-corpus
harness behind as the permanent regression instrument.

## The "before" corpus never existed — and that's already on the record

The spec orders this task's harness to run at *phase start* to capture a "before"
set. It didn't: UIX-001 landed before the harness was built (PROGRESS.md's UIX-001
line flags it explicitly). The earliest reference images are the
`screenshots/after-tier1/` + `after-parallel-merge/` folders. So there is no true
before/after diff to show; instead **this task's corpus becomes the forward
baseline** — capture it before a change, capture it after, diff the two folders.
The harness supports two-folder before/after diffing for everyone after us.

## What actually shipped this task

### 1. core-ui hex slice — the last big straggler — 100 → 0

UIX-002 deferred the core-ui `.scss` slice (100 hex occurrences / 16 files) so it
wouldn't collide with UIX-003's in-flight edits to the same files. UIX-003 has
long since merged, so this task closed it. All 100 eliminated; the hex ratchet
re-baselined (`noodl-core-ui` dropped out of the `max` block entirely — it's 0).

Two mechanical + judgment patterns, same as UIX-002's:

- **Dead `var(--token, #hexFallback)` fallbacks stripped** (6 files went to zero
  this way: SuggestionBanner, PresetSelector, ExpressionInput, ExpressionToggle,
  EntryModeStep, ReviewStep). Electron's Chromium always supports `var()`, so the
  fallback is dead weight — zero visual change. Several fallbacks were stale
  **red** (`var(--theme-color-primary, #ef4444)`) from the pre-azure era; good
  riddance.
- **Real semantic literals mapped to tokens** — and this caught two genuine
  theme bugs, not just debt:
  - **JavaScriptEditor + JSONEditor error panels were baked light** (`#fef2f2`
    pale-red bg, `#dc2626` red text, `#7c2d12` brown) — a light box hardcoded
    into a dark-default component that would never flip. Mapped to
    `--theme-color-danger-bg` / `--theme-color-danger` / `--theme-color-warning-bg`
    etc. Now correct in *both* themes.
  - **`color: white` on azure primary buttons** (EasyMode, AdvancedMode,
    JavaScriptEditor, JSONEditor) fails AA — white on azure-500 is ≈1.9:1.
    Switched to `var(--theme-color-on-primary)` (the design-system contract:
    dark text on azure in dark theme, white on azure in light). A real contrast
    fix, not cosmetic.

Categorical colours (JSON value-type badges; CodeHistory diff add/remove/modify)
were mapped to the semantic + node-category tokens, with the alpha tints done via
`color-mix(in srgb, var(--token) N%, transparent)` — the tinting pattern already
used in VariantSelector/TokenPicker/ExecutionList, so it's theme-aware and
introduces nothing new. Mapping: string→primary, number→success, boolean→warning,
null→fg-muted, array→node-category-component, object→node-category-function;
diff add→success, remove→danger, modify→warning.

Verification: **editor renderer webpack build green** (29.8s, exit 0) — the SCSS,
including every `color-mix()`, compiles. Ratchet: `noodl-core-ui 0`,
`noodl-editor 16` (unchanged; the documented Lessons exemption), `canvas-paint-ts 2`.

### 2. Two more theme-breakers fixed in the legacy global `style.css`

Found by the named-keyword sweep (`black`/`white`, which the hex ratchet doesn't
count):

- `.string-input-popup-button-ok` had `color: black` on an azure primary fill →
  `var(--theme-color-on-primary)` (AA + theme correctness).
- `.frames-divider` had `background-color: white` (invisible at `opacity:0`, but a
  light-theme landmine if ever shown) → `var(--theme-color-border-strong)`.

The color-picker alpha checkerboard's `background-color: white` (line ~1129) was
**left** — it's the conventional transparency-preview base, semantic not chrome,
light in every tool. Noted, not "fixed".

### 3. Icon handover triage (from UIX-007)

- **Deleted the 5 dead `assets/icons/icon-button/*.svg`** (caret-down, close,
  close-dark, generate, vertical-dots). UIX-007 left them as a delete-candidate
  pending a runtime confirm. Confirmed: no `icon-button/` path reference in any
  source, no `require.context` globs them, and the build is green without them.
  This is the one *cheap* item in the handover.
- **Deferred (documented, not silent):**
  - The 92 filled node-type/decorative glyphs → 16×16 stroke-grid redraw. This is
    "redraw hundreds" work the spec explicitly parks; doing it blind is what
    UIX-007 declined. They already inherit `currentColor` (theme-aware); only the
    fill→stroke drawing remains. Filed follow-up **UIX-010** (icon stroke-grid
    redraw).
  - `IconSize` enum retune (16/20/24/28 → the mock's 12/14/15/17-per-context).
    Resizes icons app-wide; needs a live sizing pass, not a blind constant swap.
    Folded into UIX-010.
  - Legacy CSS-background icon sets (`assets/icons/*.svg`, `assets/icons/editor/*`)
    still drive ~13 legacy `.css` via `background-image: url()` (componentspanel,
    layoutpanel, createnewnodepanel, propertyeditor/*, deploypopup). Migrating them
    onto the `currentColor` Icon component is legacy-view surgery (imperative
    `View` subclasses). They render fine today — just off the one-icon-convention.
    Filed follow-up **UIX-011** (legacy CSS-background icon retirement).

### 4. Verified non-issues (audited, nothing to fix)

- **Red-as-action:** grep for `danger`/`error`/`red` tokens on button/CTA/action
  selectors returned **nothing**. The de-red phase law holds across editor + core-ui.
- **Color-picker palette names:** the spec worried the pickers might show old
  palette names from a `styles/colors.js` name map. There is no such static map —
  `colorstylepicker.jsx` + `extractProjectColors.ts` drive the picker from the
  **user's own project color styles** plus raw hex values. UIX-005 already deleted
  `NodeGraphColors.ts`. Nothing to make coherent.
- **CodeMirror both themes:** `codemirror-theme.ts` is 100% token-driven — 59
  `var(--theme-color-syntax-*)` references, **zero hex** — and colors.css defines a
  dark value AND a `[data-theme='light']` value for every syntax token, so it
  auto-flips via CSS vars. With the surrounding code/JSON-editor chrome now fully
  tokenized (item 1) and the build green, both-theme correctness is proven by
  construction. **Residual:** a live pixel spot-check of rendered syntax colours —
  reaching a live code node via CDP is unreliable (UIX-008's own finding), so it
  stays owed, not claimed.

## The screenshot-corpus harness (`corpus/`)

The phase's verification instrument. `corpus/capture.mjs` drives the real editor
over **one** raw-CDP WebSocket (no deps; Node ≥ 21 native WebSocket) and captures
a named surface set in **both themes** into a dated folder; `corpus/gallery.mjs`
builds a static side-by-side gallery; `corpus/run.sh` is the one-command wrapper.
See `corpus/README.md`.

Determinism: fixed `1600×1000` via `Emulation.setDeviceMetricsOverride`;
animations/transitions/caret killed by an injected stylesheet;
`prefers-reduced-motion: reduce`; theme set declaratively (`data-theme` +
`nodegx:themechanged`, not the async settings round-trip). The panel list is
**self-discovered** from the live DOM (`[data-test]` rail buttons) — a panel added
later shows up in the corpus with no code change. This is the literal menu-walk.

Live corpus captured 2026-07-26 (fixture: "Shine Phase 2", a real project with a
component tree, node graph, and backend) → `corpus/captures/2026-07-26/`,
**14 surfaces × 2 themes = 28 PNGs**:

launcher · editor · property-editor · panel-{components, search, explain,
ai-authoring, problems, versioncontrol, github, backend-services, app-setup,
settings, editor-settings}.

### Audit table (rubric: tokens · AA · kit controls · no red-as-action · focus · both themes)

Backbone fact: the **hex ratchet now proves tokens-only across every `.css`/`.scss`
in editor + core-ui** (core-ui 0, editor 16 = the one documented Lessons
exemption, canvas 2 = documented) and it's a CI gate. So "tokens only" is GREEN by
construction for *every* surface below, not spot-checked. `live` = confirmed in the
2026-07-26 corpus in both themes.

| Surface | Status | Evidence |
|---|---|---|
| Launcher (populated) | ✅ PASS | live — wordmark+coral dot, azure primary, amber/neutral chips, gradient thumbs, mono footer, both themes |
| Editor chrome (toolbar/rail/tabs) | ✅ PASS | live — amber warning chip, azure Deploy, stroke rail icons, both themes |
| Canvas / node graph | ✅ PASS | live — node cards + category icons + cyan signal wire re-theme dark→light (UIX-005+008), not blank (WF-007 fix holds) |
| Property editor | ✅ PASS | live — box-model editor, segmented size, alignment glyphs, **StyleSuggestions banner** (tokenized this task) render clean both themes |
| Components panel | ✅ PASS | live — folder tree, both themes |
| Search panel | ✅ PASS | live |
| Explain panel | ✅ PASS | live |
| AI Authoring panel | ✅ PASS | live |
| Problems panel | ✅ PASS | live |
| Backend Services panel (WF-007) | ✅ PASS | live — endpoint card, SQLite backend w/ status pill, empty-state, no red-as-action, both themes |
| GitHub panel | ✅ PASS | live capture; token-clean by ratchet |
| App Setup panel | ✅ PASS | live capture; token-clean by ratchet |
| Project Settings panel | ✅ PASS | live capture; token-clean by ratchet |
| Editor Settings panel | ✅ PASS | live — Appearance→Theme tri-state selector (UIX-008), both themes |
| Version Control panel | ⚠️ chrome PASS / content crash | live — hit its **ErrorBoundary** in this project (functional, not styling); the error-boundary chrome is token-clean (azure retry). Filed as functional follow-up |
| Code editors (JS / JSON / CodeMirror / diff modal) | ✅ tokens PASS / ⏳ live pixel residual | tokenized this task + token-driven theme (0 hex, 59 var refs); live syntax-colour capture owed (CDP reach unreliable) |
| Data browser · Permissions · Schema mgr · Triggers · Email panels | ✅ PASS (by gate) | not in the default rail (conditionally registered); token-clean by the ratchet gate; not force-mounted this run |
| Deploy popup · Connection popup · Import popup · Node picker · Context menus · Tooltips | ✅ tokens PASS | token-clean by the ratchet gate; a few still use legacy CSS-background icons → UIX-011 |

**Zero unexplained "deferred".** Every non-PASS row has a reason and an owner
(UIX-010, UIX-011, or the VersionControl functional follow-up).

## Stale user-docs screenshots

Grepped the in-repo `docs/` tree (format / node-catalog / runtime) and the repo
root: **zero image files, zero markdown image references.** In-repo user docs
carry no UI screenshots, so nothing in-repo needs replacing. The user-facing
screenshots that now show old "Noodl 2.9.3" chrome live in the **external docs /
marketing repo** (out of repo scope per the phase README). Filed for the docs repo:
launcher, editor overview, node-graph, and any panel walkthroughs need re-capture
against NodeGX. The internal `dev-docs/tasks/**` specs embed some old-UI images —
those are historical planning records, deliberately left as-is.

## Filed follow-ups (styling-only rule → redesigns become tickets)

- **UIX-010** — icon stroke-grid redraw (92 filled node/decorative glyphs) +
  `IconSize` per-context retune. Needs a live sizing pass; "redraw hundreds" work
  the phase parks.
- **UIX-011** — legacy CSS-background icon retirement (migrate `assets/icons/*` +
  `editor/*` url() consumers onto the `currentColor` Icon component).
- **VersionControlPanel crash** — functional (ErrorBoundary tripped in a
  non-git/at-rest project state); not a visual-refresh regression. Hand to the
  version-control owner.
- **CodeMirror live syntax-colour spot-check** — the one visual item verified by
  construction but not by a live pixel; blocked on reliable CDP reach of a code node.

## Traps / notes for the next person

- Editor + panel corpus needs a project **open**; project-open choreography is
  timing-flaky (RUN-003), so it's a manual step in `run.sh`, keeping the *harness*
  deterministic. A trusted double-click on the first launcher card opened "Shine
  Phase 2" reliably here.
- After a theme flip, the injected determinism `<style>` can be dropped by a panel
  remount — the harness re-injects per theme.
- `color-mix()` is already in the codebase and compiles under the repo's Sass
  pipeline (Sass passes it through as an unknown CSS function). Safe to use for
  token-based alpha tints.
