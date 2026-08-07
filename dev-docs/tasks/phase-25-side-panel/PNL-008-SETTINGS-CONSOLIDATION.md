# PNL-008: Three Settings Panels Become One

## Metadata

| Field | Value |
|-------|-------|
| **ID** | PNL-008 |
| **Phase** | Phase 25 — Side Panel (Track J) |
| **Tier** | 3 — surfaces |
| **Priority** | 🟡 Medium |
| **Difficulty** | 🟡 Medium (information architecture, plus persisted ids that other code references) |
| **Estimated Time** | 4–5 days |
| **Prerequisites** | PNL-005 (header). Wants PNL-004's `PanelRow`; will use it if landed. |
| **Mock** | [`mocks/nodegx-side-panel-mock.html`](./mocks/nodegx-side-panel-mock.html) — "Three settings panels become one" |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** |

## Objective

Reduce the rail's three settings destinations to one, behind a cog, with Project and Editor as tabs —
and stop the sun icon meaning "project settings".

## Background

Reported as: *"there are three settings panels, which is also weird, could be consolidated? … the sun
icon which is weird because the sun icon leads to settings."*

From [`router.setup.ts`](../../../packages/noodl-editor/src/editor/src/router.setup.ts):

| id | Name | Icon | Order | Contents |
|---|---|---|---|---|
| `app-setup` | App Setup | `IconName.Sliders` | 8.5 | Identity, SEO, PWA, Variables |
| `settings` | Project settings | `IconName.Setting` (reads as a sun) | 9 | Title, head code, navigation, runtime, sitemap, deploy |
| `editor-settings` | Editor settings | `IconName.SlidersHorizontal` | bottom | Appearance/theme, experimental panels & features, AI provider |

Two of the three are project-scoped and overlap — both own the app title, both own SEO-adjacent
settings. Two of the three use nearly identical slider glyphs. And `IconName.Setting` renders as a sun,
which reads as "appearance" if it reads as anything.

## Desired State

**One rail destination**, a cog, whose panel has a segmented control at the top: **Project** | **Editor**.

- **Project** absorbs App Setup wholesale — Identity, SEO, PWA, Variables become sections alongside
  navigation, runtime, sitemap and deploy. Resolve the duplicated app title to **one** control; decide
  which model field is canonical (`AppSetupPanel` writes through `ProjectModel.updateAppConfig`,
  `ProjectSettingsPanel` through the legacy `ProjectSettingsModel` + `Ports` view) and make the other
  read from it. **Do not leave two controls writing two fields** — that is a data bug waiting to happen,
  and if it turns out they already write different fields that both matter, say so and keep both with
  labels that distinguish them.
- **Editor** keeps appearance, experimental panels/features and the AI provider section unchanged.
- The cog replaces `IconName.Setting`'s sun. Either redraw `setting` as a cog or point the registration
  at a cog glyph that already exists — check UIX-010's finding that `IconSize` is inert at all call
  sites before assuming a size prop will do anything.

Section ordering inside Project matters more than it looks: identity first (it's what people come for),
deploy last (it's the exit), runtime and navigation in between. Group headers, not a flat list of eight
collapsibles.

## The migration hazards

These are the reason this task is not "easy":

1. **Panel ids are persisted.** `useSetupSettings.ts:13-19` stores the last active panel per project
   under `'editor-sidebar-panel'` and restores it on open. A project last closed on `app-setup` will
   try to restore a panel that no longer exists. It *does* guard with
   `SidebarModel.instance.getItems().find(...)` and falls back to `'components'` — so it degrades
   safely, but the user silently loses their place. Consider mapping retired ids to `settings` on read.
   PNL-003 stores per-panel widths under the same project key; keep the two migrations consistent.
2. **Code switches panels by id.** `Clippy.tsx:377` switches to `'editor-settings'`. Grep for every
   `switch('...')` call before renaming anything.
3. **There are already dead panel switches in the tree.** `NodeGraphContext.tsx:120` and
   `sidebarmodel.tsx:337` both `switch('cloud-functions')`, and no panel with that id has been
   registered since WF-007 retired Cloud Services. `switch()` silently no-ops for an unknown id, so
   these are invisible dead ends. Fix or delete them while you are in here, and note it.
4. **`ProjectSettingsPanel` hosts a legacy imperative `Ports` view** through `Frame` with its own
   `ProjectSettingsModel`. It works. Absorbing App Setup's React sections around it means React and
   legacy sections interleaving in one scroll container — verify ordering and spacing actually hold,
   and if the legacy view has to stay in one contiguous block, put it there rather than fighting it.
5. **Experimental panel toggles live in Editor settings** and drive which rail icons exist
   (`SidebarModel.instance.getExperimentalItems()`). Consolidating must not break the toggle that
   shows/hides the panel you are standing in.

## Scope

### In scope
- `router.setup.ts` registrations (three → one, plus the icon).
- `ProjectSettingsPanel` + `AppSetupPanel/sections/*` merge; `AppSetupPanel.tsx` retired.
- `EditorSettingsPanel` becomes a tab body rather than a panel root.
- The tab control, the id migration, and the dead-switch cleanup.

### Out of scope
- Redesigning any individual setting's control (PNL-004 owns row layout).
- The AI settings section's contents (AIX territory).
- Adding or removing any actual setting. This is where they live, not what they are.
- The `Sliders` / `SlidersHorizontal` icons themselves, which have other users — only this panel's
  registration changes.

## Acceptance

Live-verified via the `run-editor` skill, both themes:

1. The rail has **one** settings destination, with a cog that does not read as a sun.
2. Project tab: identity, SEO, PWA, variables, navigation, runtime, sitemap, deploy all present and
   functional — set a value in each group, close the project, reopen, confirm it stuck.
3. **The app title has one control**, and changing it updates everywhere it is consumed (window title,
   deploy metadata, `project.json`). Verify by reading `project.json`, not just the UI.
4. Editor tab: theme switch works, experimental toggles still show/hide rail panels, AI provider config
   saves and "Test connection" still runs.
5. **Migration**: with a project whose last active panel was `app-setup` (set it before upgrading, or
   hand-edit the stored setting), open the project. It lands on Settings — or at worst on Components —
   and does not error.
6. `Clippy`'s route to editor settings still works.
7. No `switch()` call in the tree targets an unregistered id (grep is the evidence).
8. Screenshots of both tabs, both themes, under `screenshots/pnl-008/`.

Gates: editor `tsc` clean; `npm run test:ci` for `noodl-editor` green; hex ratchet unchanged.

## Notes for the executor

- **The title-duplication question is the first thing to resolve**, before any UI work. If the two
  panels write different fields that are both consumed, this task's scope changes and it should be
  re-scoped rather than papered over.
- The alternative IA — keeping Editor settings pinned to the bottom of the rail (VS Code's convention,
  app-scoped vs project-scoped) and only merging App Setup into Project — is defensible and gets 3 → 2
  with less risk. The mock proposes one destination because the report asked why there were three. **If
  the two-tab panel turns out to feel wrong once built, the two-destination version is a sanctioned
  fallback** — record which you shipped and why.
- Commit with a pathspec limited to your files.
