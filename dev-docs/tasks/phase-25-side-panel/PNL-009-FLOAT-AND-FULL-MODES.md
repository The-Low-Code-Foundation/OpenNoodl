# PNL-009: Floating & Full Panel Modes

## Metadata

| Field | Value |
|-------|-------|
| **ID** | PNL-009 |
| **Phase** | Phase 25 — Side Panel (Track J) |
| **Tier** | 4 — expansion |
| **Priority** | 🟡 Medium (the most speculative task in the phase — see *Validate before building*) |
| **Difficulty** | 🔴 Hard (re-parenting panels that host legacy imperative views) |
| **Estimated Time** | 1–1.5 weeks |
| **Prerequisites** | PNL-003 (mode state), PNL-005 (header + mode group) |
| **Mock** | [`mocks/nodegx-side-panel-mock.html`](./mocks/nodegx-side-panel-mock.html) — Floating and Full in the mode switcher; drag the floating panel by its header |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Opus 5** |

## Objective

Add two more panel modes — floating over the canvas, and filling the editor area — and move the
existing ad-hoc full-screen panels onto the second one so there is a single full-screen code path.

## Validate before building

This is the part of the concept Richard explicitly wanted to poke at first: *"I don't have a good
answer to what it should look like… I'm just spitballing."* The rest of the phase stands without it.

**Before implementing, confirm the need with the interactive mock in front of you.** Specifically:

- Is *floating* solving a real problem that PNL-003's wide toggle doesn't already solve? Floating earns
  its keep when you need to watch the canvas *and* read a panel — Explain, Build, the data browser. If
  ⌘\ turns out to be enough, floating is complexity for its own sake and this task should shrink to
  just the Full-mode consolidation, which has independent justification (below).
- Is *full* wanted for ordinary panels, or only for the data surfaces that already do it?

If the answer to either is "no", **re-scope this task rather than building it**, and record the
decision. A half-wanted docking system is the kind of thing that becomes permanent debt.

## Background — Full mode has justification regardless

Four panels already go full-screen, each by hand. `LocalBackendCard` renders `SchemaPanel`,
`DataBrowser`, `PermissionsPanel` and three more through `createPortal(…, document.body)` into a
`position: fixed; inset: 0` overlay with an 85%-black scrim
([`LocalBackendCard.module.scss:77-89`](../../../packages/noodl-editor/src/editor/src/views/panels/BackendServicesPanel/LocalBackendCard/LocalBackendCard.module.scss#L77-L89),
`LocalBackendCard.tsx:268-340`).

That pattern has real costs: the rail is unreachable while it's open, there is no keyboard escape route
by construction, the scrim is a hardcoded `rgba(0,0,0,.85)` that predates the light theme, and it is
implemented six times in one file. Making Full a supported panel mode replaces all six with one path
and gives those surfaces a rail, a header and an Escape key.

## Desired State

### Full

The panel occupies the editor area to the right of the rail. The rail stays live, so switching panels
works from full mode. `Escape` and the header's mode button return to docked. The six portal call sites
in `LocalBackendCard` become "open panel X in full mode".

Those surfaces are currently *not* registered sidebar panels — they are components rendered from a card.
Decide whether they become registered (transient) panels, which is the clean answer and makes them
addressable, or whether full mode accepts an ad-hoc child. Prefer registration; note the choice.

### Floating

The panel detaches into a card over the canvas: draggable by its header, resizable, `shadow-float`
elevation, position and size remembered **per panel** (alongside PNL-003's widths). Constrained to the
editor area so it can't be dragged out of reach. The canvas takes the full width underneath.

This stays **in-window** — one React root, one theme subscription. A real second `BrowserWindow` is
explicitly parked in the phase README and is not a smaller version of this task.

## The hard part

Several panels host **legacy imperative views** inside React via `Frame`:

- `propertyeditor` — legacy `View` subtrees per data type
- `ProjectSettingsPanel` — a `Ports` view over `ProjectSettingsModel`
- `componentports`

Re-parenting a DOM subtree (which is what changing from docked to floating does if implemented naively)
will unmount and remount those views, and there is no guarantee they survive it — legacy views bind
listeners in `render()` and may hold direct DOM references. **Test this on `propertyeditor` first**,
before building any of the polish. If they can't survive re-parenting:

- Implement the modes as *CSS-only* transitions where possible — `position: absolute` + insets on the
  same element, never a different parent — which is how the mock does it and is the reason it works
  there; or
- Exempt the legacy-hosting panels from floating (docked and full only) and say so in the UI by
  disabling the button rather than letting it break.

Either is an acceptable outcome. Silently remounting a legacy view and hoping is not.

## Scope

### In scope
- Full mode, and migrating the six `LocalBackendCard` portals onto it.
- Floating mode, if validated: drag, resize, per-panel position persistence, constraints.
- `Escape` handling and focus management for both.
- The header mode group's float/full buttons (the slot comes from PNL-005).

### Out of scope
- **A second OS window** — parked in the phase README.
- **Multi-panel layouts** — two panels at once, a right-hand rail. Parked.
- Redesigning the data browser / schema / permissions surfaces. This task changes how they are *hosted*.
- The `TopologyMapPanel`'s dead `55vw` expansion, which PNL-003 already deleted.

## Acceptance

Live-verified via the `run-editor` skill, both themes:

1. **Full**: open Backend Services in full mode. The rail still works; switching panels stays in full;
   `Escape` returns to docked at the previous width.
2. **The portal migration**: open Data, Schema and Permissions for a running local backend. Each opens
   as a full panel with a header and a close/escape route. The old `position: fixed` overlay CSS and the
   `createPortal` calls are gone, not merely unused — grep is the evidence.
3. **The scrim**: whatever replaces `rgba(0,0,0,.85)` is token-driven and correct on light.
4. **Floating**: drag a floating panel around; it stays inside the editor area. Resize it. Switch panels
   and come back — position and size are remembered per panel. Close the project and reopen — same.
5. **The legacy-view test**: put `propertyeditor` (or whichever legacy-hosting panel) into each mode and
   back. Its inputs still work, its popouts still open and position correctly, and no listeners are lost
   (change a property value after each transition). If the panel is exempted instead, its float button
   is visibly disabled with a reason.
6. A floating panel does not trap focus, and `⌘B` still hides it.
7. Screenshots of both modes, both themes, under `screenshots/pnl-009/`.

Gates: editor `tsc` clean; `npm run test:ci` for `noodl-editor` green; hex ratchet unchanged or improved
(deleting the hardcoded scrim should improve it).

## Notes for the executor

- **Do the Full-mode portal consolidation first.** It has justification independent of the concept, it
  deletes code, and it de-risks the harder half.
- The mock's modes are CSS-only — the panel element never changes parent. That is not an accident;
  read it before choosing an implementation.
- Popouts and popups are positioned against the panel's screen rect. A floating panel moves; verify a
  colour picker opened from a floating panel appears in the right place, and that PNL-002's dismissal fix
  still behaves when the panel isn't where popups assume it is.
- Commit with a pathspec limited to your files.
