# TAB-003: Per-tab preview

## Metadata

| Field | Value |
|-------|-------|
| **ID** | TAB-003 |
| **Phase** | Phase 37 (Track V) |
| **Tier** | 1 |
| **Priority** | 🔴 Critical — "two projects open" means nothing if only one can run |
| **Difficulty** | 🟡 Medium |
| **Prerequisites** | TAB-001, TAB-002 (a preview connects to its tab's relay port) |

## Objective

Replace the single global preview window with one preview per project tab, docked or detached
independently.

## Current state

One module-global `FloatingWindow` created eagerly at
[`main.js:241`](../../../packages/noodl-editor/src/main/main.js#L241):

```js
const viewerWindow = new FloatingWindow();
```

`openViewer` **returns early if it is already open**
([`main.js:437`](../../../packages/noodl-editor/src/main/main.js#L437)) and sizes itself from
`win.getBounds()` ([`:442`](../../../packages/noodl-editor/src/main/main.js#L442)), parenting to
`win` ([`:455`](../../../packages/noodl-editor/src/main/main.js#L455)). `closeViewer` notifies the
one window ([`:434`](../../../packages/noodl-editor/src/main/main.js#L434)), and `project-closed`
closes it globally ([`:774`](../../../packages/noodl-editor/src/main/main.js#L774)).

The docked case is a `<webview>` inside the editor renderer
([`CanvasView.ts:12`](../../../packages/noodl-editor/src/editor/src/views/VisualCanvas/CanvasView.ts#L12),
[`VisualCanvas.tsx:92`](../../../packages/noodl-editor/src/editor/src/views/VisualCanvas/VisualCanvas.tsx#L92)),
which is already per-renderer and therefore **already per-tab for free**. Only the *detached* window
is global.

A separate set of ad-hoc floating windows is already keyed by id
([`floatingWindows[options.id]`](../../../packages/noodl-editor/src/main/main.js#L488)) — that is the
shape to copy, with `tabId` as the key.

## Scope

### In scope

- [ ] `viewerWindow` → `viewerWindows: Map<tabId, FloatingWindow>`, created lazily
- [ ] `openViewer` / `closeViewer` / `viewer-attach` / `viewer-detach` resolve their tab from
      `event.sender` rather than closing over `win`
- [ ] Detached preview geometry derives from the **window** and offsets per tab so two detached
      previews do not land exactly on top of each other
- [ ] `viewer-refresh`, `viewer-set-route`, `viewer-set-viewport-size`, `viewer-set-zoom-factor`,
      `viewer-set-inspect-mode`, `viewer-select-node`, `viewer-cookies` all become tab-scoped
      ([`main.js:786-800`](../../../packages/noodl-editor/src/main/main.js#L786-L800))
- [ ] Closing a tab closes its preview; closing the *window* closes all of them
- [ ] The renderer-crash handler stops calling the global `closeViewer()`
      ([`main.js:409`](../../../packages/noodl-editor/src/main/main.js#L409)) and closes only the
      crashed tab's preview
- [ ] Verify the docked `<webview>` path needs no change — assert it, do not assume it

### Out of scope

- Preview lifecycle when a tab is suspended (open question 1)
- Any change to the viewer frame itself beyond the port it dials (TAB-002)

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| `forwardIpcEvents` on the floating window forwards `editor-api-response` back to main ([`main.js:522`](../../../packages/noodl-editor/src/main/main.js#L522)); with N previews the reply must reach the right tab's callback map | Ride the same `(tabId, token)` keying TAB-002 introduces |
| Two detached previews stacked pixel-identically read as one broken window | Offset per tab index; low effort, high perceived quality |
| `viewer-attach` is sent unconditionally on renderer construction ([`router.tsx:126`](../../../packages/noodl-editor/src/editor/src/router.tsx#L126)) — with tabs, a new tab booting could close another tab's detached preview | Scope the handler to the sending tab. This is the specific bug the task exists to prevent; test it |
| `PreviewTokenInjector` and `ProjectDesignTokenContext` push theme tokens into the preview | Both are per-renderer already; confirm they resolve their own webview and not a global |

## Success criteria

- [ ] Two tabs previewing simultaneously, docked, each showing its own app
- [ ] Both detached simultaneously, in separate windows, not overlapping
- [ ] Refresh in tab A does not reload tab B's preview
- [ ] Closing tab A closes only its preview
- [ ] Crashing tab A's renderer leaves tab B's preview running
