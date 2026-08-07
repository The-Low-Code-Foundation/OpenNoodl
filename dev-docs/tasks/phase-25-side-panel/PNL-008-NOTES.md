# PNL-008 — Three settings panels become one: notes

**Status:** ✅ Code complete — 2026-07-27. **Live QA owed** (see "Could not verify").
**Spec:** [PNL-008-SETTINGS-CONSOLIDATION.md](./PNL-008-SETTINGS-CONSOLIDATION.md)
**Commits:** `268a262d` (consolidation), `e47ebc38` (ids + dead switches), `e97ea73a` (the cog), `fbac6d9b` (gate) — plus this file.

**IA shipped: the mock's — one destination, Project | Editor tabs.** Not the
two-destination fallback. Reasoning in "Which IA, and why" below.

---

## 1. The title duplication (finding F15) — resolved, with the trace

This was the first thing to settle and it changed the shape of the task, so it
goes first.

There were not two fields. There were **three**, and only two of them are real.

| Field | Written by | Read by | Reaches a build? |
|---|---|---|---|
| `settings.htmlTitle` | Project settings → legacy `Ports` view, group "General", label "Title" | `html-processor.ts:45` → `{{#title#}}` in the built `index.html`; `main/src/web-server.js:72` for the editor's own preview server; `noodl-preview/src/loader.ts:224`; the VCS settings diff label | **Yes — as the `<title>` text.** `ignoreInExport: true`, so it is deliberately *absent* from the export JSON's data |
| `metadata.appConfig.identity.appName` | App Setup → Identity section | `noodl-viewer-react/src/api/config.ts:37` → `Noodl.Config.appName`; `:42` → the Open Graph title's default; `validation.ts:148` | **Yes — as data**, via `exporter/json.ts:42` copying all metadata into the export |
| `metadata.title` | nothing — present in `project-examples/agent-chat/project.json` only | **nothing, anywhere** | round-trips through save/export; no reader |

`getSettings`/`setSettings` and `getAppConfig`/`updateAppConfig` are wholly
separate storage on `ProjectModel` (`this.settings` vs `this.metadata`), with
different serialization slots and different event channels. Neither reads the
other; there is no fallback in either direction.

### So: the sanctioned "both matter" outcome, not the merge

The spec allowed for this explicitly, and it is what the evidence supports. One
is a **page title**, the other is the **app's name as data**. Collapsing them
would have meant one of:

- making `appName` canonical and having the build read it — which needs a *new
  IPC surface*, because `web-server.js` runs in the main process and
  `projectGetSettings` only ships `project.settings`; and it would newly expose
  the title in the deployed export JSON, undoing `ignoreInExport`; **or**
- making `htmlTitle` canonical — which would break `Noodl.Config.appName` for
  every user-authored Function node that reads it.

Both are behaviour changes to the build, out of this task's scope.

### What shipped instead

Both controls, **in one section, adjacent, labelled for what they do**:

- **App name** → `identity.appName`. Help: *"Read at runtime as
  `Noodl.Config.appName`, and the default for the Open Graph title."*
- **Browser tab title** → `settings.htmlTitle`. Help: *"The `<title>` of the
  built and previewed page."*

`htmlTitle` is filtered out of the legacy `Ports` view
(`ProjectSettingsModel.getPorts()`), so there is now **exactly one control per
field in the whole editor**. It is filtered rather than removed from the port
list itself, because `exporter/util.ts:126` and `DiffList.tsx:300` both read
`NodeLibrary.getProjectSettingsPorts()` directly and still need the entry — it is
where `ignoreInExport` and the "General: Title" diff label live.

**Plus one behaviour, so they stop drifting apart by accident.** Renaming the app
carries the browser title with it *while the two agree or the title has never
been set*; once someone types a different browser title, they are diverged on
purpose and the rename stops touching it. This is the slug-follows-title rule
applied to a page title. It fixes the common confusion in the other direction
too: before, setting "App name" and nothing else left the built page titled
"Noodl Viewer".

**Deviation, stated plainly:** the spec asked for the title to become *one
control*. It is two, because the fields are two and both are consumed — which is
the outcome the spec names as sanctioned when that turns out to be true. What was
removed is the *ambiguity*: two panels, each with a control that reads like "the
title", neither saying which.

`metadata.title` is inert and was left alone (`project-examples/agent-chat/project.json`
is off-limits this session anyway). Deleting it is safe whenever someone wants to.

---

## 2. Which IA, and why

Shipped **one destination with Project | Editor tabs** — the mock's proposal —
rather than the sanctioned two-destination fallback.

Three things decided it:

1. **The mock puts the gear at the bottom of the rail**, after `railSpacer`
   (`nodegx-side-panel-mock.html:752`). That is the slot Editor settings already
   occupied. So the "app-scoped settings live at the bottom" convention the
   fallback was protecting is *not* given up by consolidating — it is where the
   one destination goes. The registration is `placement: 'bottom'`.
2. **It is exactly VS Code's shape**, which the fallback was arguing from: one
   gear, one Settings surface, User | Workspace tabs. The fallback's premise —
   that app-scope and project-scope want separate destinations — is not what VS
   Code actually does.
3. The risk the fallback avoids is layout risk in the tabbed panel, and that
   turned out to be avoidable in a way that does not touch the panel chrome at
   all (next section).

Rail: `settings`, `placement: 'bottom'`, `order: 1`, name **"Settings"**,
`defaultWidth: 460`, `IconName.Setting` (now a cog).

### Section order in Project

Identity → SEO → PWA → Variables → *(legacy port groups: General/head code,
Navigation, Experimental features)* → Runtime → Sitemap → Deploy → Open project
folder.

Identity first because it is what people come for; deploy last because it is the
exit; "Open project folder" moved from the top to the bottom for the same reason
— it was the first thing in the panel and it is the least-used thing in it.

---

## 3. The layout decision that made the tabs cheap

The obvious build — `<Tabs>` holding the two tab bodies — is wrong here, twice:

- `Tabs.Root` is `height: 100%; overflow: hidden`, and its **segmented** variant
  deliberately *stretches* its content pane rather than scrolling it, because
  UIX-013 built it for full-height panes that scroll themselves. Dropped into
  `BasePanel`'s scroll container it clips the settings at the panel height and
  the panel stops scrolling — PNL-001's exact defect, reintroduced.
- The alternative (BasePanel stops scrolling, each tab body scrolls itself) moves
  the scrollbar 16px inboard of the panel edge — undoing PNL-001's other fix —
  and puts two extra elements between the legacy ports view and its scroller.

**`Ports.renderGroups()` walks `this.el.parentElement.parentElement` to save and
restore its scroll position** (`DataTypes/Ports.ts:170` and `:196`). That is a
hardcoded two-level walk: `Frame`'s div is level one, the scroll container must
be level two. It is shared with the property editor, so it cannot be changed
here. Any wrapper between them silently breaks scroll restoration on every
re-render of the legacy ports — silently, because nothing throws; the panel just
jumps to the top.

**So:** `Tabs` is used as a controlled segmented *control* (`activeTab` +
`onChange`, `content: null`), and the active tab's sections render as its
**siblings** — direct children of the one panel-owned scroll container, exactly
as every other panel's sections are. `ProjectSettingsTab` and `EditorSettingsTab`
therefore return fragments, not wrappers.

This also keeps `BasePanel`'s `> * { flex: 0 0 auto }` (PNL-001) applying to each
section rather than to a wrapper, and keeps `.ChildrenContainer`'s padding — and
therefore the `panel-body` container's content box, and therefore
`panel-bands.scss`'s −34px arithmetic — untouched. **No band number is restated
anywhere in this task's CSS.**

`Tabs.Root`'s `height: 100%` is overridden with `UNSAFE_style` rather than a
class in this panel's own module: two single-class selectors tie on specificity
and the winner is then whichever stylesheet the bundler emitted last.

### The tab strip

`position: sticky; top: 0`, full-bleed to the scroll container's padding box
(negative inline margin + matching padding, reading `--spacing-panel-padding`
rather than restating 16px), with its top inset cancelled and re-given so it does
not appear to jump on the first scroll. Sticky degrades to static if anything
upstream ever breaks it — the strip still renders and still works.

### `Frame` gets `isContentSize`

PNL-004 flagged that `Frame` sets `height: 100%` on its host, pinning the legacy
ports block to the full panel height regardless of content. `Frame` already had
`isContentSize` / `isFitWidth` props; they are now used. This is why Runtime no
longer sits below a tall empty gap.

---

## 4. Panel ids, and three switches that pointed at nothing

### The migration

Three keys live under the project's id in `EditorSettings`:
`editor-sidebar-panel` (here), `editor-sidebar-widths` (PNL-003),
`editor-sidebar-float-rects` (PNL-009). All are keyed by panel id.

`useSetupSettings` now maps retired ids on read, and the three are handled
consistently but **not identically**:

- the **active panel** is remapped *and the tab that absorbed it is requested* —
  App Setup reopens on Project, Editor settings on Editor. The user does not just
  land somewhere valid, they land where they left off.
- the **width** and **float rect** entries are **dropped, not carried over**.
  Carrying `app-setup`'s width onto `settings` would overwrite the width the user
  had already chosen for the surviving panel. Dropping is also order-independent,
  which matters: `useSidePanelLayout` reads the width map *during render*, before
  this effect runs, so anything that had to land first could not.

**Trap found while writing it:** `EditorSettings.setMerge` deep-merges and can
only ever *add* — handing it a filtered map leaves the retired entries exactly
where they were. Writing `undefined` for the retired keys is the one thing it
will do (`deepMerge` assigns it straight through; `JSON.stringify` drops it on
the next store).

Retired map (`settingsPanelRoute.ts`):

| stored id | lands on | tab |
|---|---|---|
| `app-setup` | `settings` | Project |
| `editor-settings` | `settings` | Editor |
| `cloud-functions` | `components` | — |

### The dead switches

Both confirmed dead, both removed, and one was worse than the spec said:

- `NodeGraphContext.tsx:120` switched to `cloud-functions` on entering a backend
  component. Unregistered since WF-007. **And its partner at `:124` could never
  have fired either** — it read `if (ActiveId === 'cloud-functions')`, and
  `ActiveId` cannot equal an id you cannot switch to. Both gone; the `setActive`
  call that was actually working stays.
- `sidebarmodel.tsx:347` used the same dead id as `hidePanels`'s backend
  fallback, so deselecting a node inside a backend component fell back to
  *nothing*. Now `components`, as the frontend branch always did. Dropping the
  branch also drops `sidebarmodel`'s import of `NodeGraphContextTmp`, and with it
  a circular edge between the sidebar model and the node-graph context.
- `Clippy.tsx:377` switched to `editor-settings`, which is a tab now. It goes
  through `openSettingsPanel('editor')`, so it still lands on the AI section
  rather than dumping you on Project settings.

**Acceptance item 7 is now an assertion, not a grep** — see the gate below.
Remaining literal `switch()` sites: two (`'components'`, `'search'`), both
registered. The two experimental-panel switches (`ExplainPanel_ID` from the node
context menu, `AiAuthoringPanel_ID` from the canvas HUD) are each guarded by a
registration check at their call site; verified, unchanged.

---

## 5. The icon

`setting.svg` was **literally a sun**: one circle, `r=2.2`, and eight rays. It is
now the mock's `#i-gear` — two concentric circles (`r=4.4` ring, `r=1.6` hub) and
eight 2.1px spokes at the outer radius.

Redrawn rather than repointed at another glyph, because **all eight call sites of
`IconName.Setting` mean "settings" or "configure"** — the rail, `ComponentXRayPanel`
(×2), `TriggerChainDebuggerPanel` (×2), `PermissionsPanel`, `EmailPanel`,
`VersionControlPanel` and `GitStatusButton` — and none of them meant "sun". It
also makes the pair consistent: `setting_fill.svg` was **already a filled cog**.

UIX-010's finding that `IconSize` is inert at all ~130 call sites was checked
first; no size prop was involved and none would have helped.

---

## 6. Files

New: `views/panels/SettingsPanel/` — `SettingsPanel.tsx`, `SettingsPanel.module.scss`,
`ProjectSettingsTab.tsx`, `EditorSettingsTab.tsx`, `settingsPanelRoute.ts`, `index.ts`,
`ProjectSettingsModel.ts` (moved), `sections/` (eight sections + one merged
`sections.module.scss`).

Retired: `AppSetupPanel/`, `ProjectSettingsPanel/`, `EditorSettingsPanel/` — gone.

**Deviation:** the spec's scope says "`ProjectSettingsPanel` + `AppSetupPanel/sections/*`
merge". They were merged into a **new `SettingsPanel/` directory** rather than into
`ProjectSettingsPanel/`, because the surviving panel is not the project settings panel
— leaving editor-settings sections in a directory named `ProjectSettingsPanel` would be
a worse lie than the churn is worth. Section files moved with `git mv`, so the history
follows.

**`AiSettings/` was left where it is.** The prompt permitted moving it. It has an
external importer (`AiAssistant/templates/function-query-database/gpt-4-version.ts`
imports `AI_ASSISTANT_ENABLED_SUGGESTIONS_KEY` from it), its contents are AIX
territory, and moving it buys nothing but merge risk.

Also touched: `router.setup.ts` (three registrations → one; kept minimal and
additive, as PNL-009 may be in this file too), `useSetupSettings.ts`, `Clippy.tsx`,
`NodeGraphContext.tsx`, `sidebarmodel.tsx`, `setting.svg`.

**Left alone, deliberately — two stale comments in other agents' files:**
`ExecutionHistoryPanel.tsx:22` says it is registered "between backend-services and
app-setup", and `SidePanel.tsx:126` names `ProjectSettingsPanel`. Both are prose,
both are now wrong, neither is mine this session.

---

## 7. The gate

`dev-docs/tasks/phase-23-visual-refresh/corpus/settings-consolidation.mjs`
(beside `panel-chrome.mjs` and `panel-geometry.mjs`, whose harness it shares).

**Static half — needs no editor, run it anywhere:**

| | |
|---|---|
| S1 | exactly one settings destination registered; `app-setup` and `editor-settings` are gone |
| S1b | it is `placement: 'bottom'` |
| S2 | **every string literal handed to `switch()` anywhere under the editor's src is a registered id** |
| S3 | every `RETIRED_PANEL_IDS` value is registered; every key is not |
| S4 | `setting.svg` has two concentric circles — a cog, not a sun |

S2 resolves both registration forms (`id: 'components'` and `id: ExplainPanel_ID`,
the latter by finding `export const *_ID` across the source) and strips
commented-out registrations first, so it cannot go green on ids nothing can reach.
**Negative-tested**: pointing `EditorPage.tsx:155` at `cloud-functions` turns it
red with the file and line. This is the check that would have caught WF-007's
orphans, and it keeps working after this task is forgotten.

**Live half (`--live`, the default; CDP, project open):** L1 one rail button →
one panel titled "Settings" with exactly one `panel-header`; L2 both tabs; L3
Project holds all eight groups; L4 exactly one "App name" row, one "Browser tab
title" row, and no third row labelled "Title"; **L5 the three-step title round
trip asserted against `project.json` on disk**, with the project's original
titles restored in a `finally`; L6 Editor holds appearance/experimental/AI and a
Theme row; L7 screenshots, both tabs, both themes.

Robustness copied from `panel-chrome.mjs`: per-step CDP timeouts that record and
continue, JSON flushed as it goes, screenshots before assertions, and **every
injected style released in a `finally`**.

### Results so far

```
$ node dev-docs/tasks/phase-23-visual-refresh/corpus/settings-consolidation.mjs --no-live
  ✓ S1 — one settings destination ('settings'), 19 panels registered in total
  ✓ S1b
  ✓ S2 — 2 literal switch() call sites, all registered
  ✓ S3 — app-setup→settings, editor-settings→settings, cloud-functions→components
  ✓ S4 — setting.svg is a cog (two concentric circles + spokes)
  ✓ clean.

$ npx tsc -p packages/noodl-editor --noEmit      # clean
$ node scripts/hex-color-ratchet.js              # noodl-editor 16/16, holding
$ npx sass … SettingsPanel.module.scss           # compiles
```

---

## 8. Live-QA checklist — run in order, from the PRIMARY checkout

Prereq: `nohup setsid npm run dev:debug -- --quiet > /dev/null 2>&1 &`, then open
a project with at least one backend component and one warning.

**Do the scripted gate first** — it covers items 1, 3, 7 and most of 2 and 4, and
its failures name files:

```
node dev-docs/tasks/phase-23-visual-refresh/corpus/settings-consolidation.mjs \
  --project /path/to/the/open/project \
  --json /tmp/pnl008.json
```

Then by hand, **in both themes**:

| # | Acceptance | Steps |
|---|---|---|
| 1 | one destination, a cog | Rail has **no** App Setup and **no** Editor settings icon. One gear at the bottom. Look at it: two rings and eight spokes, not a disc with rays. |
| 2 | Project groups round-trip | Set a value in **each** group — SEO ogTitle, PWA short name, a custom variable, React version, sitemap toggle, deploy base url, head code (legacy). Close the project (⌘W / back to projects), reopen. Every value is still there. |
| 2b | the legacy block | Head code / Navigation / Experimental features render **as one contiguous block** with their own group headers, between Variables and Runtime — and **no longer occupy the full panel height** when nearly empty (the `isContentSize` fix). Scroll the panel, edit a legacy value, confirm the scroll position is **not** reset (that is the `parentElement.parentElement` walk). |
| 3 | one title control | App Identity shows **App name** and **Browser tab title** and nothing else titled "Title". Rename the app → the browser title follows. Type a different browser title → renaming again leaves it alone. Read `project.json`: `metadata.appConfig.identity.appName` and `settings.htmlTitle`. Then **deploy or preview** and check the browser tab actually says the browser title. |
| 4 | Editor tab | Theme select switches the whole editor. Toggle an experimental panel off and on → the rail icon disappears and comes back **while you are standing in Settings** (Settings is not experimental, so it cannot hide itself). AI provider: pick one, paste a key, "Test connection" runs. |
| 5 | migration | Quit. Hand-edit the editor settings store: set `<projectId>.editor-sidebar-panel` to `"app-setup"`, and add `<projectId>.editor-sidebar-widths["app-setup"] = 999`. Relaunch and open that project. It lands on **Settings, Project tab**, no error, and the panel is **not** 999px wide. Repeat with `"editor-settings"` → lands on Settings, **Editor** tab. Repeat with `"cloud-functions"` → lands on Components. |
| 6 | Clippy | With no AI provider configured, open Clippy → "Open editor settings" → lands on Settings **with the Editor tab already selected**, AI section reachable. |
| 7 | dead switches | Open a backend (cloud) component: the panel does **not** flicker or blank. Select a node, then deselect: falls back to Components, not to an empty panel. |
| 8 | geometry | At **240px** and at **760px**: nothing overflows sideways; the tab strip stays two buttons; the sticky strip stays under the header while you scroll to Deploy and does not leave a transparent band. At a **760px window height** the panel scrolls to its true last pixel. |

Then re-run the neighbouring gates, which this task can regress:

```
node dev-docs/tasks/phase-23-visual-refresh/corpus/panel-chrome.mjs   --json /tmp/chrome.json
node dev-docs/tasks/phase-23-visual-refresh/corpus/panel-geometry.mjs --json /tmp/geom.json
```

Screenshots land in `screenshots/pnl-008/`.

---

## 9. Could not verify

Everything here is verifiable — none of it was, from this worktree, and the
reason is structural rather than an excuse: **`npx lerna exec` resolves the
package root to the MAIN checkout**, so an editor launched from this worktree
executes main-checkout code and any result would be unrelated to this diff. The
same goes for `npm run test:ci`.

Not run, in rough order of how much I would like it run:

1. **The live half of the gate**, including the L5 disk round trip. The static
   half is green and negative-tested; the live half has never executed. Its CDP
   selectors (`[data-test="settings-tab-project"]`, the `PanelRow-module__Label`
   class match, `window.__nodeGraphEditor.activeComponent.owner._retainedProjectDirectory`)
   are reasoned from the source, not observed. **Expect to fix a selector.**
2. **Acceptance 2, 4 and 5 round trips** — close/reopen, the experimental toggle,
   the migration. All three need a real project lifecycle.
3. **`npm run test:ci` for `noodl-editor`.** No test in the tree references the
   three retired panels (grepped), so I expect it green, but I did not run it.
4. **The sticky tab strip.** The negative-margin/re-padding arithmetic is
   reasoned against `BasePanel.module.scss`, not seen. Worst case it is
   cosmetically off by 16px or shows a translucent band; it cannot break layout.
   Item 8 in the checklist is aimed at it.
5. **The cog at 17px on the rail.** The path data is the mock's verbatim, but the
   mock's `#i-gear` uses `stroke-linecap: butt` on the spokes and this codebase's
   glyphs mostly use `round`; I kept `butt` to preserve the mock's proportions.
   Worth one look.
6. **Screenshots** (acceptance 8) — none captured. The gate produces them.
7. **The `Ports` scroll-restoration walk.** I reasoned that `Frame` must stay a
   direct child of the scroll container and built to that, but I did not observe
   the restoration working before or after. Checklist item 2b.

## 10. Filed for someone else

- `ExecutionHistoryPanel.tsx:22` and `SidePanel.tsx:126` carry comments that name
  panels this task retired. Prose only; other agents' files this session.
- `metadata.title` / `metadata.description` in `project-examples/agent-chat/project.json`
  are read by nothing in the repo. Safe to delete whenever that file is free.
- `TabBar` (`core-ui/components/layout/TabBar`) has **no real consumer** — its one
  apparent hit is a same-named CSS class in `CanvasTabs`. A dead-code candidate.
- The build's `<title>` still cannot see `appConfig`. If the "App name is the one
  true title" design in `phase-3/TASK-007-app-config/CONFIG-004-seo-integration.md:99`
  is ever wanted, it needs a `projectGetMetaData` IPC channel for `web-server.js`
  and a decision about `ignoreInExport`.
