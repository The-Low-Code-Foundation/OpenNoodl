# UIX-006 — Launcher & First-Run — ownership map & findings

Working notes for the phase-23 launcher refresh. Territory: the core-ui launcher
subtree + the editor's ProjectsPage mount + window-title/version strings.

## Files owned / touched

core-ui (`packages/noodl-core-ui/src/preview/launcher/Launcher/`):
- `Launcher.tsx` — drop standalone `<TabBar>` (tabs move into the header row per
  mock), reorder tabs to Projects/Learn/Templates/GitHub, thread `appVersion`.
- `LauncherContext.tsx` — add `appVersion` to the context value.
- `components/LauncherHeader/*` — NodeGX wordmark (coral brand dot, display face),
  inline tabs with accent underline, Connect-GitHub as a SECONDARY button, avatar.
  Kills the "Noodl 2.9.3" version string and the dev-only mock/real toggle.
- `components/LauncherFooter/*` — quiet Documentation/YouTube/Discord links +
  right-aligned `NodeGX {version}` in mono.
- `components/LauncherProjectCard/*` — card-grid card: top thumbnail (capture OR
  deterministic placeholder), name, "Edited N ago", chips (Local only neutral,
  React 17 runtime amber-warning), kebab. Preserves onClick + context-menu actions.
- `views/Projects.tsx` — 3-up card grid (was table rows), first-launch welcome
  empty state + no-results empty state, react17 migrate/read-only moved into the
  kebab menu (so the compact card keeps that capability). Folder sidebar preserved.

editor (`packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx`):
- pass `appVersion={platform.getVersion()}`; drop the empty-`<svg>` thumbnail
  fallback (pass `undefined` so the card renders its placeholder); polish the two
  load-failure toasts to `Couldn't load "<name>"` + Show-details.

## Chips / toast / tokens — reused, not reinvented
- Chip: `packages/noodl-core-ui/src/components/common/Chip` (UIX-003) — its docstring
  literally names "Local only" and "React 17 runtime". `ChipVariant.Warning` = amber.
- Toast: `packages/noodl-editor/.../views/ToastLayer` (UIX-003) already supports
  `title`, actions ("Show details"), auto "Dismiss", sticky-by-default errors,
  dismissable close. ProjectsPage already routes launcher errors through it.
- Tokens: `packages/noodl-core-ui/src/styles/custom-properties/colors.css` (UIX-001).
  Brand coral = `--theme-color-brand` (wordmark dot ONLY). Display face =
  `--font-family-display` (Bricolage Grotesque). No raw hex — `npm run colors` ratchet
  is per-package; placeholder gradients use node-category tokens + `color-mix`.

## THUMBNAIL ROOT CAUSE (investigation)

Two separate "thumbnail" systems exist; only one is the project card thumbnail:
- `utils/thumbnailcache.js` — asset/file thumbnails (50x50), NOT project cards. Irrelevant.
- Project card thumbnail = `ProjectModel.getThumbnailURI()`, surfaced through
  `LocalProjectsModel` as `project.thumbURI`, mapped to card `imageSrc` in ProjectsPage.

Capture pipeline (`views/documents/.../UseCaptureThumbnails.ts` →
`VisualCanvas/CanvasView.captureThumbnail()` via `webview.capturePage()`) runs every
20s while a project is OPEN and calls `ProjectModel.setThumbnailFromDataURI(...)`.
That updates the in-memory model + live launcher, so a capture DOES exist for the
currently-open project in-session.

The white slivers have two shallow causes, both fixed by this task's card redesign +
placeholder, and one deep cause that is a deliberate design decision, NOT a bug:

1. (shallow, geometry) Old `.Image` was a 100px-wide left strip with no fixed height,
   `background-size: cover`. Short cards → a thin vertical sliver. The new card puts
   the thumb in a full-width 16:9.2 top area, so the sliver geometry is gone.
2. (shallow, fallback) ProjectsPage set `imageSrc` to an EMPTY `<svg>` data URI for
   projects with no capture → rendered as a blank white box. Fixed: pass no image and
   let the card render the deterministic placeholder; `<img onError>` also falls back.
3. (deep, NOT fixed — out of the 2-day box) Persistence across reloads is intentionally
   disabled in the legacy save path: `projectmodel.ts` has `thumbnailURI` commented out
   in BOTH `toJSON()` (serialize, ~line 1313) and the constructor restore (~line 144).
   The v2 `ProjectExporter`/`ProjectImporter` path DOES round-trip it. Re-enabling the
   legacy path would inline a ~400px base64 data-URI into the git-tracked `project.json`
   on every save — a real bloat/vcs tradeoff, which is almost certainly why it was
   disabled. Not a shallow bug; left as a documented follow-up. The placeholder makes
   the launcher whole without it, and live in-session captures still show.

Net: the deterministic placeholder ships UNCONDITIONALLY; no broken/blank image can
render regardless of capture state.

## Stale-base trap
HEAD started at `360cdc4` (ancient). Reset to `7cbf665` per task instructions before
any work. Spec + mock confirmed present after reset.

## Live verification needed from the PRIMARY checkout (not this worktree)
lerna exec targets the main checkout, so run these from there, fresh `--user-data-dir`
(LEARN-001 userData trap) for the first-launch check:
- Fresh profile → launcher first-launch welcome empty state (zero projects).
- Populated launcher → 3-up card grid, placeholder gradients + ghosted initials,
  a real in-session capture showing for a currently/recently open project.
- Search with no matches → quiet no-results empty state.
- Deliberately corrupt a scratch project's `project.json` → load-failure toast
  ("Couldn't load …", Show details, dismissable, nothing red but the toast).
- Window title reads NodeGX (already `<title>NodeGX</title>`); confirm no "Noodl 2.9.3"
  anywhere in launcher chrome.
