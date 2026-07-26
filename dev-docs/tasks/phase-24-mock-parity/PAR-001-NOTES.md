# PAR-001 — Launcher Parity — ownership map & findings

Implemented 2026-07-26 in a worktree rooted at `eeea5c2` (cline-dev tip; the
stale-base trap fired again — worktree started at `360cdc4`, hard-reset first).
Builds on UIX-006; the blank-capture placeholder logic (`e2bd955`) is untouched.

## Files changed (ownership map)

Tokens (ratchet-excluded / no-hex additions):
- `packages/noodl-core-ui/src/styles/custom-properties/spacing.css` — added
  missing mock steps: `--radius-5/7/10`; `--shadow-card`, `--shadow-card-hover`,
  `--shadow-toast` (dark defaults + light overrides, values verbatim from the
  mock). No existing values changed.
- `packages/noodl-core-ui/src/styles/custom-properties/colors.css` — added
  `--theme-color-avatar-gradient` (135deg `#7C5CFF → #4DA3FF`, mock does not
  retint on light), `--theme-color-avatar-fg` (white), and
  `--base-color-white-transparent-16` (card ghost). **No token-value drift
  found** — bg/fg/border/accent/warning/error values already matched the mock
  exactly in both themes.

Electron main:
- `packages/noodl-editor/src/main/main.js` — `trafficLightPosition: {x:20,y:20}`
  on the single BrowserWindow. Both mocks (launcher AND editor) use a 52px bar,
  so one inset serves both; PAR-003's editor topbar is the other consumer.

Launcher subtree (`packages/noodl-core-ui/src/preview/launcher/Launcher/`):
- `Launcher.module.scss` — ground moved to bg-0 (window ground; titlebar/
  sidebar/footer are the bg-1 panels), root font-size 13px.
- `components/LauncherHeader/*` — 120px reserved lights region (macOS only,
  `/Mac/.test(navigator.platform)`), tabs `margin-left: 28px`, avatar on the
  gradient token, anonymous avatar keeps the same gradient with a neutral
  person glyph (spec: never invent initials), `-webkit-app-region: drag` on the
  bar with `no-drag` on tabs/actions.
- `components/LauncherButton/*` — NEW: the mock `.btn` (13px/500, padding
  7px 13px, radius 7, gap 7; primary/secondary/ghost). Launcher-local on
  purpose; the editor-wide PrimaryButton keeps its own scale.
- `components/GitHubConnectButton/*` — rebuilt as mock secondary button with
  the 15px GitHub mark, label now "Connect GitHub" ("Connecting…" while busy);
  its scss shell deleted.
- `components/LauncherPage/*` — rebuilt: padding 28px 32px 20px, head row =
  Bricolage 600/24px −.015em h1 + spacer + 12px action slot, margin-bottom 20.
- `components/LauncherSearchBar/*` — rebuilt to the mock toolbar row: search
  box (bg-1, border-1, radius 8, padding 8px 12px, 14px stroke-1.5 glass icon,
  13px input, placeholder "Search projects", mono 10.5px kbd chip) + filter
  select in the same box treatment as a styled **native `<select>`** (options
  preserved) with the 12px chevron. **Cmd/Ctrl+K focuses + selects the search
  input** (window keydown listener, mac shows `⌘K`, others `Ctrl K`). New
  `LauncherSearchBar.module.scss`.
- `components/FolderTree/*` — FOLDERS side-label (10.5px/600, .07em,
  uppercase), 2px gaps, grow spacer pinning "New folder" (mock plus glyph,
  fg-3 side-item) to the bottom; rename/create inputs 13px/radius-7 on tokens;
  delete dialog restyled (radius-10, shadow-popup, launcher button scale);
  sentence case: "All projects", "New folder", "Delete folder".
- `components/FolderTreeItem/*` — rebuilt to the mock side-item: 13px/500
  fg-2, padding 7px 10px, radius 7, mock 15px stroke-1.5 folder glyph,
  right-aligned 11.5px/400 count (always shown, accent @ .75 when current),
  hover bg-3/fg-1, current = accent-soft + accent. Kept (not in mock, feature
  preservation): chevron expand/collapse for nested folders, hover rename/
  delete kebab (the count yields to it on hover), keyboard activation.
- `components/LauncherProjectCard/*` — shadows onto `--shadow-card/-hover`,
  radius-10 token, ghost initial to the mock's absolute right −8 / bottom −26
  at white 16% (was translate-based top-right at 15%), chips scoped to the
  mock 5px radius via `.Sub > *:not(.Edited)` (the shared Chip component ships
  radius-sm and was NOT edited — it is editor-wide), kebab shaped to
  26px/radius-6/bg-3-hover via a scoped `:global(button)` override of the
  shared ContextMenu trigger. Capture/placeholder/blank-detection logic
  untouched.
- `components/LauncherFooter/*` — plain 12px fg-3 text links (mock has no
  external-link icons; dropped the `ExternalLink` component, which hardwires
  one), hover fg-1, opened via `platform.openExternal`.
- `views/Projects.tsx` + NEW `views/Projects.module.scss` — 224px bg-1 sidebar
  (padding 16px 10px, border-r), fixed `repeat(3, 1fr)` 18px grid (was
  auto-fill minmax 260px), head row via LauncherButton ("Open project…" ghost,
  "New project" primary with 14px/1.8 plus), title "Recent projects"
  (sentence case), welcome empty state onto the mock type scale (h2 24px
  Bricolage, 13px body), no-results + folder-picker modal moved from inline
  styles onto the module.
- `views/Templates.tsx` — onto LauncherPage (consistent head treatment).
- `views/LearningCenter.tsx` / `views/GitHubRepos.tsx` — sentence-case titles
  only ("Learning center", "GitHub projects").

Editor (launcher host / toast — toast is explicitly in the PAR-001 spec):
- `views/ToastLayer/components/ToastCard/ToastCard.module.scss` — radius-10,
  `--shadow-toast`, close button radius 5px. The UIX-003/006 card already had
  the mock anatomy (28px icon square, 13px/600 title, 12.5px body with code
  chips, accent + quiet actions, 22px close) — migrated in place, no fork.
- `views/ToastLayer/ToastLayerContainer.tsx` — toaster anchored right 20 /
  bottom 58 (mock; clears the 42px footer). This applies app-wide (same layer
  serves the editor); it was previously the react-hot-toast default 16/16.

## Mock details implemented (checklist)

- 52px titlebar, bg-1, border-b, padding 0 20, gap 16; lights inset via
  Electron + 120px reserved region (wordmark can never sit under the lights)
- Wordmark: 9px coral dot + Bricolage 600 17px −.01em (was already in from
  UIX-006; unchanged)
- Tabs: margin-left 28, 0 14 padding, full-height, 13px/500 fg-3→fg-1,
  2px accent underline inset 12/12, radius 2 top (mostly pre-existing)
- Connect GitHub secondary (bg-2, border-2, 15px mark, 7px 13px, radius 7);
  28px avatar, gradient 135deg 7C5CFF→4DA3FF, 11px/600 initials or neutral
  glyph on the same gradient
- Sidebar 224px bg-1, padding 16 10; FOLDERS label; item/count/current/hover
  styling; New folder pinned bottom
- Head row: sentence-case Bricolage h1 24px; ghost "Open project…"; primary
  "New project" with plus 14/1.8
- Toolbar: search 380px max with ⌘K chip AND working Cmd/Ctrl+K focus; select
  in the same box treatment, options preserved
- Grid 3×, gap 18; card bg-1/border-1/radius-10/shadow-card, hover −2px +
  shadow-card-hover + border-2, .14s behind prefers-reduced-motion; thumb
  16/9.2; ghost Bricolage 96px white-16% right −8 / bottom −26; meta 12 14 13,
  name 13.5/600 ellipsized, sub 12px, chips 10.5/600 radius 5 (neutral 500),
  amber warning chip with 10px triangle; kebab 26px radius 6
- Footer 42px, plain links, mono `NodeGX {version}`
- Toast: right 20 / bottom 58, 340px, radius 10, shadow-toast, mock anatomy
- Both themes: everything runs on `--theme-color-*` / shadow tokens (dark +
  light values both defined); zero raw hex outside colors.css — ratchet holds

## Could NOT match / deliberate deviations (no silent deferrals)

1. **Sort select shows filter options, not "Last opened".** The launcher has
   no sort state — the existing control filters by cloud-sync type ("All
   projects" / "Only local projects" / "Only git projects"). Per spec ("bind
   to the existing sort state — keep existing options") the mock-styled select
   binds to that existing filter state. Adding a real recency sort is new
   feature work, not restyling.
2. **Avatar initials**: rendered from the GitHub identity when connected
   (mock's "TK" is sample data); otherwise a neutral person glyph on the same
   gradient, exactly as the spec directs.
3. **Card thumbnails**: mock's first card shows a white app capture; real
   captures render when the pipeline has one (in-session), otherwise the
   deterministic UIX-006 gradient+ghost placeholder. Persistence across
   restarts remains disabled upstream (UIX-006 documented decision).
4. **Windows/Linux**: no traffic lights exist there; the 120px lights region
   is macOS-only. The pre-existing lack of DOM window controls on the
   frameless launcher on those platforms is unchanged (out of scope).
5. **User-folder rows keep chevron + hover kebab** (not in the mock): feature
   preservation (nested folders, rename/delete) beats literal parity here per
   the phase contract ("keep every behavior; apply the mock's treatment").
6. **Toast anchor 20/58 applies editor-wide** (single ToastLayer, spec says
   don't fork). In the editor view the toast now floats 58px up; if PAR-003
   wants a different editor anchor, it owns that call.
7. **`--shadow-win` / `--page`** from the mock are artifact-stage dressing
   (the floating window on the demo page) — not applicable inside a real
   maximized window; not ported.

## Needs live verification (orchestrator, primary checkout)

- macOS traffic lights actually centered in the 52px bar and clear of the
  wordmark (Electron y-inset rendering differs subtly by OS version).
- Cmd/Ctrl+K focus in the packaged/live app (webview focus stealing).
- Drag region: bar drags the window; tabs/buttons/avatar still click.
- Native `<select>` popup styling on macOS (options render natively — the
  closed control matches the mock; the open popup is OS chrome).
- 3-column grid at small window widths (mock is fixed 3-up at 1240px; cards
  compress below ~900px width).
- Light theme pass over the launcher (all values are tokens, but eyes-on).
- Toast position in the editor context (see deviation 6).
- FolderTree hover kebab vs count swap feel.

## Verification done here (static)

- `tsc --noEmit` in noodl-core-ui: 45 errors, all the known TS2307
  module-resolution baseline (`@noodl-versioning`/`@noodl-store`/
  `@noodl-viewer-cloud`), zero in touched files. noodl-editor: 0 errors.
- `npm run colors`: holding the line (canvas-paint-ts 2/2, noodl-editor
  16/16, core-ui absent at zero).
