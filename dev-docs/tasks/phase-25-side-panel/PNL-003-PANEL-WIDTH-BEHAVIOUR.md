# PNL-003: Panel Width — Stop the Reset, Remember Per Panel, Snap & Collapse

## Metadata

| Field | Value |
|-------|-------|
| **ID** | PNL-003 |
| **Phase** | Phase 25 — Side Panel (Track J) |
| **Tier** | 1 — correctness |
| **Priority** | 🔴 Critical (this is the reported top complaint, and it is a bug) |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 3–4 days |
| **Prerequisites** | none |
| **Mock** | [`mocks/nodegx-side-panel-mock.html`](./mocks/nodegx-side-panel-mock.html) — "One rail, four modes"; this task delivers *docked*, *wide* and *hidden*. Floating and full are PNL-009. |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Opus 5** — the CSS is trivial; the state model (who owns the width, and when) is where this goes wrong |

## Objective

Make the side panel's width something the user sets once per panel and keeps, and give them a
keystroke to widen or hide it — replacing today's behaviour, which discards the width on every panel
switch and every window resize.

## Background

Reported as: *"When I'm building with Noodl on my small screen, I'm constantly expanding and shrinking
the side panel horizontally to be able to see what's going on in there."*

That is a rational response to a reset loop. In
[`EditorPage.tsx:79-110`](../../../packages/noodl-editor/src/editor/src/pages/EditorPage/EditorPage.tsx#L79-L110):

```ts
const updateSidebarSize = () => {
  const isTopology = SidebarModel.instance.ActiveId === 'topology';
  if (isTopology) setFrameDividerSize(Math.floor(window.innerWidth * 0.55));
  else setFrameDividerSize(380);            // ← every other panel
};
SidebarModel.instance.on(SidebarModelEvent.activeChanged, updateSidebarSize, eventGroup);
window.addEventListener('resize', updateSidebarSize);
updateSidebarSize();
```

So the width resets to 380px when you switch panels, and again when you resize the window. It is also
never persisted — `useState(undefined)` at line 77, with no load and no save — so it resets on project
open too. (Contrast `EditorDocument.tsx:389`, which *does* persist its own divider — the canvas/preview
split — through editor settings. The side panel was simply never wired up.)

Two more things compound it:

- [`SideNavigation.module.scss:9`](../../../packages/noodl-core-ui/src/components/app/SideNavigation/SideNavigation.module.scss#L9)
  sets `min-width: 380px` on the rail+panel root, which silently overrides the divider's own
  `sizeMin={200}`. The panel cannot be made narrower than 380px no matter what the divider says.
- There is no collapse, no snap and no keyboard shortcut, so "I need to see more of this panel" and
  "I need the canvas back" are both mouse drags.

### The topology special case is dead code

`'topology'` is referenced in
[`SidePanel.tsx:122`](../../../packages/noodl-editor/src/editor/src/views/SidePanel/SidePanel.tsx#L122)
(`isExpanded`) and `EditorPage.tsx:85`, but its registration in
[`router.setup.ts:92-100`](../../../packages/noodl-editor/src/editor/src/router.setup.ts#L92-L100)
is commented out (shelved feature). Both references are unreachable. The `.Root--expanded { width: 55vw }`
rule they drive is the *prototype* of the wide mode this task generalises. Delete the dead references
and keep the idea.

## Current State

| File | Line | What it does |
|---|---|---|
| `pages/EditorPage/EditorPage.tsx` | 77 | `useState(undefined)` — width not persisted |
| ″ | 83–95 | resets to 380 on `activeChanged` and on `resize` |
| ″ | 229–236 | the `FrameDivider`, `sizeMin={200}`, no `sizeMax` |
| `views/SidePanel/SidePanel.tsx` | 122 | dead `isExpanded = activeId === 'topology'` |
| `core-ui/.../SideNavigation/SideNavigation.module.scss` | 9–15 | `min-width: 380px`, `max-width: 55vw`, `&--expanded { width: 55vw }` |
| `pages/EditorPage/useSetupSettings.ts` | 13–33 | **the pattern to copy** — persists the active panel per project via `EditorSettings.instance.setMerge(ProjectModel.instance.id, {...})` |

`EditorSettings` (`utils/editorsettings.ts`) is a `Model` with `get`/`set`/`setMerge` over
`JSONStorage`, already used for per-project editor state keyed by `ProjectModel.instance.id`.

## Desired State

### 1. Width is owned per panel and persisted

Store widths alongside the existing per-project sidebar state, under the same project key
`useSetupSettings` already uses — e.g. `'editor-sidebar-widths': { [panelId]: number }`. Switching
panels **restores that panel's width**; dragging the divider updates the current panel's entry.

Seed sensible defaults per panel rather than one global 380: the mock uses Components 280, Search 340,
Explain/Build 400, Problems 420, Settings 460, Backend Services 560. These are proposals — a panel
whose default is obviously wrong when you see it in the real app should get a better one, and the
number should live next to the panel's `register()` call, not in a table in `EditorPage`.

Transient panels (Properties, Ports) are keyed like any other, and must not be written into the
"last active panel" setting — `useSetupSettings` already guards that with `!currentPanel.transient`;
match it.

### 2. A window resize does not change the panel width

Remove `updateSidebarSize` from the resize path entirely. The only thing a resize should do is clamp:
if the remembered width no longer leaves a usable canvas, cap it — do not overwrite the remembered
value, so restoring the window restores the width.

### 3. Wide is a toggle

`⌘\` (and a header button, and a double-click on the divider) snaps to `min(760px, 55vw)` and back to
the panel's own remembered width. This generalises the dead topology `55vw` case. Wide is **not**
persisted as the panel's width — it is a temporary state, so toggling off returns you to what you set.

Whether wide-ness itself persists across a panel switch is a real design question the mock doesn't
answer: it treats wide as per-session and clears it on switch. Ship that, and record it in NOTES as a
decision to revisit rather than an accident.

### 4. Collapse is real

`⌘B` hides the panel entirely, leaving the 52px rail. Clicking any rail icon restores the last width.
Dragging the divider left below the minimum also collapses (with a snap, so it isn't accidental).
Remove `min-width: 380px` so the divider's `sizeMin` applies; pick the real floor from the narrowest
panel that still works — 240px is the value the mock's compact breakpoint assumes.

⌘B is a browser/Electron-level shortcut in some contexts; check it isn't already bound (the editor
registers `⌘F`, `⌘D`, `⌘R`, `⌘⇧X`, `⌘⇧E` in `EditorPage.tsx:175-202`) and that it doesn't fire while
a text field has focus. Same for `⌘\`.

### 5. The divider is findable

An 8px hit area with a 2px accent line on hover, and `col-resize` throughout. While dragging, capture
the pointer so leaving the panel doesn't end the drag — related to PNL-002 but independently
necessary here, and the prototype's divider is a working reference.

## Scope

### In scope
- `EditorPage.tsx` width state, persistence, resize handling, keybindings.
- `SideNavigation.module.scss` min-width removal, divider affordance.
- `SidePanel.tsx` — delete the dead topology reference; render the two header controls (wide, hide).
- Per-panel default widths at the `register()` sites in `router.setup.ts`.
- `FrameDivider` — only if it can't express collapse/snap as-is. Prefer not to touch it; it is shared
  with `EditorDocument`'s canvas/preview split and a regression there is expensive.

### Out of scope
- **Floating and full modes** — PNL-009.
- The header's final chrome — PNL-005. This task renders its two buttons into `PanelHeader`'s existing
  `children` slot. **It must not create a second header component**; if the slot is inadequate, add to
  `PanelHeader` and note it for PNL-005 to absorb.
- Panel *content* reflow at new widths — PNL-004.
- `EditorDocument`'s own divider persistence, which already works.

## Acceptance

Live-verified via the `run-editor` skill:

1. Drag the panel to ~600px, switch to another panel and back. **It is still 600px.**
2. Give two panels different widths; switching between them switches width, both directions.
3. Resize the editor window; the panel width does not change. Shrink the window until the panel must
   be clamped, then restore it — the original width comes back.
4. Close the project and reopen it. Widths are still there, per panel.
5. `⌘\` widens; `⌘\` again returns to the set width. Double-clicking the divider does the same.
6. `⌘B` hides the panel; the rail remains and is usable; clicking a rail icon restores the last width.
7. Drag the divider fully left — it snaps to collapsed rather than leaving a 40px sliver.
8. Drag the panel to 240px; the narrowest panels are still usable (they will not be *pretty* until
   PNL-004 — that is expected, and worth a screenshot for PNL-004's "before").
9. Neither `⌘\` nor `⌘B` fires while typing in a panel text field.
10. `EditorDocument`'s canvas/preview divider still works and still persists.

Gates: editor `tsc` clean; `npm run test:ci` for `noodl-editor` green.

## Notes for the executor

- **Reproduce the reset first** — drag the panel wide, click another rail icon, watch it snap to 380.
  It takes ten seconds and it is the whole justification for this task.
- The width belongs to *one* owner. Today it is split between `EditorPage`'s `useState`, the
  `SideNavigation` CSS min/max, and the divider's own props, which is how the reset survived. Decide
  where it lives and make the other two derive from it.
- `useSetupSettings.ts` is the pattern for per-project persistence; use it rather than inventing a
  second storage location. Note that it stores under `ProjectModel.instance.id`, so widths are
  per-project — that is probably right (different projects, different panels), but say so as a
  decision.
- The CDP session needs `--target=NodeGX`, and the default target changes after a project opens —
  re-select it. Never `cdp reload`.
- Commit with a pathspec limited to your files.
