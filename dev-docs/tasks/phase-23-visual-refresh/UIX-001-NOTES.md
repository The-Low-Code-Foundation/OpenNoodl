# UIX-001 Notes — Design Tokens & Typography Foundation

Date: 2026-07-26. Executor: Fable 5, direct on `cline-dev`.

## Reconciliation decisions (duplicate collapse)

The two `colors.css` copies diverged in exactly three ways; survivor = core-ui path, reconciled as follows:

| Divergence | Decision | Why |
|---|---|---|
| Node scales: core-ui "vibrant", editor "desaturated" | **Editor's desaturated values kept** | They are what the app actually renders today; changing node hues is UIX-005's job, not this task's |
| `fonts.css`: editor had per-weight `Inter-*` family vars | **Dropped; all 35 call sites converted** to `var(--font-family)` + `font-weight` | Per-weight families can't survive the move to a system stack |
| `animations.css`: `--speed-quick` 300ms (core-ui) vs 400ms (editor) | **300ms kept** | Snappier matches the refresh; only sub-perceptual risk |

`spacing.css` copies were identical. Editor's `custom-properties/` directory deleted; editor + viewer-frame import `@noodl-core-ui/styles/custom-properties/*` (webpack alias + tsconfig path already existed).

## Call-site classification (the review artifact)

Full grep audit of `var(--theme-color-primary*)`, `var(--theme-color-notice*)`, raw `--base-color-red-*`/`--base-color-yellow-*`, and hardcoded `#d21f3c`, across all packages (two independent Explore agents, 2026-07-26).

**Headline: zero DANGER call sites were riding on `primary`.** Every error/delete/failure state in both packages already routes through `--theme-color-danger`. The azure flip was therefore safe with no action→danger conversions.

Counts:
- ACTION (stays `primary`, now azure, no edit needed): ~152 in noodl-editor + 85 in noodl-core-ui — focus rings, active/selected states, CTAs, links, spinners, progress, accent chrome.
- WARNING (genuine warnings/running states on `notice`, no edit needed — `notice` now aliases warning amber): 16 in editor (migration WarningBanner/ReportStep, LocalBackendCard ephemeral notices, ExecutionHistory `running` states, permissions/email/triggers callouts, DataBrowser BulkActions) + 5 in core-ui (Text/Label/Icon/TextButton/NotificationFeedbackDisplay notice variants).
- Hardcoded `#d21f3c`: none. Raw red/yellow base uses: none live (2 inline syntax-highlight hexes with yellow-* comments in `AiAssistant/templates/helper.ts` + `InspectPopup.tsx` JSON theme — decorative, left for UIX-002).

Conversions made:
1. `core-ui/components/typography/Title.module.scss` — `is-variant-notice` was mis-wired to `primary`; → `--theme-color-notice`. (The one real mis-wire found.)
2. Notice-used-as-accent chrome → `primary`, so it doesn't turn amber under the new warning color: `.csp-button` (cloudservicespopup), `.popup-button` (popuplayer), `.create-node-docs a` (createnewnodepanel), `.property-editor-highlight` (propertyeditor), `.components-panel-isroot` (componentspanel). Text-on-fill also moved to `--theme-color-on-primary`. Bonus fix: their hovers referenced `--theme-color-notice-hover`, which **was never defined** (silent no-op) → `--theme-color-primary-highlight`.
3. Soft-ambiguous, deliberately left: data-type swatches (`TableRow.tsx` String→azure, Boolean→amber via notice; `DataGrid` TypeBoolean) — decorative type palette, candidates for a dedicated palette later; `DataBrowser .BulkActions` amber attention bar kept as warning.

### Undefined-token sweep (bonus)

32 `--theme-color-*` names were referenced in styles but never defined anywhere (silent fallbacks/no-ops), e.g. `-accent`, `-primary-hover`, `-primary-rgb`, `-error`, `-fg-disabled`, `-notice-shade`, `-node-*-3`. All now defined as a COMPAT ALIASES block in canonical `colors.css` (dark + light-literal overrides). UIX-002 should migrate call sites to canonical names.

## Typography decisions

- **Display face: ship Bricolage Grotesque 600 as bundled woff2** (40,056 bytes, OFL). Rationale: the approved mocks use it, the exact woff2 was embedded in the mock (extracted from `mocks/nodegx-editor-mock.html`, no network dependency), and the cost is one 40KB file. Locations: `noodl-core-ui/src/assets/fonts/Bricolage/` + `noodl-editor/src/assets/fonts/Bricolage/` (fonts are duplicated per package like Inter already is, because css-loader runs `url:false` and @font-face must live in each statically-served stylesheet: editor `assets/css/style.css`, core-ui `styles/global.css`).
- UI face = system stack; Inter demoted (its @font-face rules and ttfs remain on disk for UIX-002 to mop up; nothing references the `Inter-*` per-weight families anymore).
- Type scale settled at 10/11/**12.5**/13/**14.5**/**17**/18/24 (bold = changed from 12/14/16). Deliberate, small global bump per mocks.

## Palette notes

- Legacy alias chains preserved: `grey-*`/`teal-*` → new neutrals, `yellow-*` → azure scale (yellow was the original primary), `error-*` → red scale. Untouched call sites shift automatically.
- `--theme-color-signal` red→cyan `#35C3E8`, `--theme-color-data` gray→emerald `#45D08A` (wire tokens; canvas painter reads no CSS so canvas is unaffected until UIX-005).
- Light theme `.theme-light` block is live CSS but inert (no element carries the class). Light `fg-default-shy` darkened `#66717E`→`#616C79` to clear AA on tinted grounds.
- Contrast matrix: all documented pairings AA for their role (full matrix in `dev-docs/guidelines/DESIGN-TOKENS.md`).

## Residuals

- Light-theme `success` `#12915B` is 4.0:1 on white — AA-large only; UIX-008 should darken it if used for body-size text.
- The soft-ambiguous type swatches above (UIX-002/UIX-005 territory).
- Storybook (`noodl-core-ui`) untouched apart from canonical files; visual check of stories not performed.
