# UIX-006: Launcher & First-Run Experience

## Metadata

| Field | Value |
|-------|-------|
| **ID** | UIX-006 |
| **Phase** | Phase 23 — Visual Refresh (Track I) |
| **Tier** | 2 — surfaces |
| **Priority** | 🟠 High (this is literally the first screen anyone sees) |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | ~1 week |
| **Prerequisites** | UIX-001; UIX-003 (toast, chips, buttons, search input) |
| **Branch** | `task/uix-006-launcher` |
| **Recommended executor** | 🟠 **Opus 4.8** |

## Objective

Rebuild the launcher's presentation to the mock — NodeGX wordmark, card grid with intact thumbnails, amber warnings, dismissable errors — and fix the first-impression defects around it (broken thumbnail capture, "Noodl 2.9.3" window title).

## Background

The launcher decides whether a new user reads the product as alive or abandoned, and today it stacks the failures: title bar says "Noodl 2.9.3", project thumbnails render as clipped white slivers, a persistent undismissable red toast squats in the corner, red is simultaneously brand and error, and projects render as sparse table rows. Architecturally it's the *easiest* Tier-2 surface: the launcher is React in core-ui (`packages/noodl-core-ui/src/preview/launcher/Launcher/` — `LauncherProjectCard`, `LauncherHeader`, `LauncherPage`, `LauncherFooter`, `LauncherSearchBar`, `TagSelector`; mounted via `ProjectsPage.tsx` in the editor), 14 of its 17 style modules already consume tokens, and it shares the app's token layer.

## Current State

- Header: "Noodl 2.9.3" + red GitHub CTA; tabs Projects/GitHub/Learn/Templates in old style.
- Project list: table-ish rows; thumbnail column renders broken white slivers (capture pipeline produces bad/missing images — root-cause unknown, investigate at task start).
- Warnings ("React 17 (Legacy Runtime)") as red exclamation icons.
- Error toast: fixed red banner, no dismiss, persists across launcher and editor.
- Footer: resource links; version display inconsistent with rebrand.
- Window title (Electron `BrowserWindow` title / titlebar text): still Noodl-branded — check `main.js`/window-creation and `productName` wiring from REV-007.

## Desired State

Per [mocks/nodegx-launcher-mock.html](./mocks/nodegx-launcher-mock.html):
- **Header:** NodeGX wordmark (display face + the coral brand dot — the coral's only sanctioned appearance) replacing the version string; tabs Projects/Learn/Templates/GitHub with accent underline active state; Connect-GitHub as *secondary* button; avatar.
- **Sidebar:** folders list with accent-soft active item + counts; New-folder at bottom; section label style from UIX-004's conventions.
- **Main:** "Recent projects" heading (display face); Open-project ghost + New-project primary; search input (⌘K hint) + sort select from the control kit.
- **Card grid** (3-up responsive): thumbnail area, name, "Edited N ago", chips — `Local only` neutral chip, `React 17 runtime` warning chip (amber, warning triangle); kebab menu per card (existing menu actions preserved).
- **Thumbnails — two-part fix:**
  1. Investigate the capture pipeline (find where project thumbnails are generated/stored; root-cause the white slivers). Fix if the cause is shallow (bounded to ~2 days).
  2. Regardless of (1): ship the **deterministic placeholder** for projects without a valid capture — per-project gradient (hue derived from project-name hash across the node-category hue set) + ghosted initial in the display face, per mock. No broken images can render, ever.
- **Error toast:** UIX-003's toast system — "Couldn't load {project}" with the actual reason and a Show-details action; sticky until dismissed; never blocks clicks to content behind it.
- **Empty states:** zero projects (first launch!) gets a real welcome state — short copy + New-project primary + Learn link. Zero search results gets a quiet empty message. (First launch is the actual first impression; don't skip it.)
- **Window titles:** launcher window and editor window titled NodeGX (project name — NodeGX pattern in editor); verify against REV-007's productName work rather than re-inventing.
- **Footer:** Documentation/YouTube/Discord quiet links; `NodeGX {version}` right-aligned in mono.

## Scope

### In Scope
- [ ] Header/wordmark/tabs/sidebar/footer restyle
- [ ] Card grid replacing rows (existing sort/filter/folder behaviors preserved)
- [ ] Thumbnail pipeline investigation + fix-or-document; deterministic placeholder art shipped unconditionally
- [ ] Warning + local-only chips via UIX-003 chips
- [ ] Toast migration on launcher surfaces
- [ ] First-launch and no-results empty states
- [ ] Window title audit (launcher + editor + any aux windows)
- [ ] Live-verify: fresh-profile launch (no projects), populated launch, project open, project-load failure path

### Out of Scope
- GitHub/Learn/Templates tab *contents* (they inherit tokens; deep restyles ride UIX-009)
- Learn lesson UI (LEARN-001 owns; UIX-009 checks token inheritance)
- Project create/clone dialogs beyond kit-level styling (UIX-004 dialog conventions apply)
- App icon / DMG branding (parked, REV-007)
- New launcher features (cloud sync indicators, etc.)

## Implementation Steps

1. Thumbnail root-cause investigation first (it may influence card design); write findings in NOTES.md; fix or scope-fence.
2. Placeholder-art component (name-hash hue + initial).
3. Header/tabs/sidebar/footer.
4. Card grid + chips + kebab.
5. Toast migration + failure-path verification (corrupt a scratch project's `project.json` deliberately).
6. Empty states; window titles.
7. Fresh-profile live pass + screenshots (userData trap from LEARN-001 notes: use a clean `--user-data-dir` for the first-launch check).

## Success Criteria

- [ ] Side-by-side with the mock: header, grid, chips, toast all read as the same design
- [ ] No broken/blank thumbnail can render (placeholder guarantees it); real captures show when valid
- [ ] Load-failure shows the new toast with reason + details; dismissable; nothing red except it
- [ ] First launch with zero projects presents the welcome state
- [ ] No "Noodl" string visible anywhere in launcher chrome or window titles
- [ ] Existing behaviors (open, folders, search, sort, kebab actions, GitHub connect) all still work

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Thumbnail pipeline is deeply broken (capture never runs post-rebrand) | Timebox investigation to 2 days; placeholder art makes the launcher whole without it; file the deep fix as a follow-up in PROGRESS.md |
| Card grid breaks folder drag/organization interactions | Inventory existing interactions first; preserve handlers on the new card component |
| Rebrand strings live in odd places (menus, about box) | `git grep -i noodl` scoped to user-visible strings in launcher/window-title paths; REV-007 docs list known locations |
| Fresh-profile testing pollutes the real profile | Dedicated user-data dir per LEARN-001's CDP/userData notes |

## References

- [mocks/nodegx-launcher-mock.html](./mocks/nodegx-launcher-mock.html)
- `packages/noodl-core-ui/src/preview/launcher/Launcher/`; `ProjectsPage.tsx`
- [UIX-003](./UIX-003-CONTROL-KIT.md) — toast/chips/inputs
- REV-007 rebrand notes — productName/title precedent

## Checklist

- [ ] Thumbnail investigation + placeholder
- [ ] Header/sidebar/grid/footer restyle
- [ ] Chips + toast + empty states + titles
- [ ] Fresh-profile and failure-path live verification; screenshots; CHANGELOG
