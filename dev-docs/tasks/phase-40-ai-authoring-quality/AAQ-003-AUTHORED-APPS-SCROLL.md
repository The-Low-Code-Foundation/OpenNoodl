# AAQ-003 — Authored apps scroll

**Finding:** #8 — every AI-created page is stuck at the top of the viewport, in this app and the
previous test app.
**Status:** open

## The mechanism, verified

`bodyScroll` is a **project setting**, default off (`project-settings.ts:67`). When off:

- the viewer adds no `body-scroll` class, so `#root`'s ancestor keeps `overflow: clip`
  (`static/viewer/index.html:55`, `viewer.jsx:183-187`);
- the app root group is `position: fixed` (`nodecontext.ts:923-926`).

Content taller than the viewport is simply clipped — no scrollbar, no scroll container, by design.
Hand-built Noodl projects either enable Body Scroll in project settings (page-like apps) or put
scroll on an inner Group (app-like shells with their own scroll regions). **Nothing in the AI path
does either**, and nothing warns. It is not a preview bug — the deployed app would clip identically.

## The doctrine to encode (confirm with Richard, then write it down)

- A **page-like** app (marketing page, listing site, docs) wants `bodyScroll: true` — the browser
  scrolls, position: fixed headers work as on the web.
- An **app-like** shell (dashboard with sidebar, chat) wants `bodyScroll: false` with explicit
  scroll-enabled Groups for each scrolling region.
- The scoping conversation already knows which kind it is building (it records pages and audience);
  the scope should carry the choice and the provisioner of project settings should apply it.

## What to build

1. **Scope → setting**: the scoping/plan path records the scroll mode and applies `bodyScroll` to the
   project settings at apply time (undoable alongside the plan, same pattern as `setCloudServices`).
   Default for AI-created projects: `true` unless the scope is explicitly app-like.
2. **Prompt doctrine**: the authoring prompt's layout section states the two modes and when to
   scroll-enable a Group (`nativeScroll`/scroll section on Group — verify the exact port names from
   the catalog before writing them into the prompt; do not trust this file's memory of them).
3. **Validation**: a warning (blocking for authored output) when an authored page's root chain can
   overflow with no scroll surface anywhere — i.e. `bodyScroll` off, no scroll-enabled ancestor, and
   the page root's children use content-driven heights. Calibrate on the corpus; if the static
   analysis cannot be made reliable, drop the rule and rely on AAQ-007's rendered inspection instead
   (a screenshot shows a clipped page immediately) — record the decision here.

## Acceptance criteria

1. Cold replay of the puppy brief: the listing page scrolls in the editor preview, in a detached
   preview window, and on a phone via the LAN URL.
2. A dashboard-style brief gets an app-like shell whose list regions scroll independently while the
   shell stays fixed — driven live, not inferred.
3. The setting is visible and correct in Project Settings after apply, and undo restores the prior
   value.

## Traps

- Seam 3 of the diagnosis session lives in the same files (`web-server.js` token injection): the
  detached-preview check in criterion 1 doubles as a regression check for it.
- HMR does not reach `main.js`/`web-server.js`; full Electron restart to verify anything there.
- `nodecontext.ts:923` reads the setting at root-group creation — check whether a mid-session
  settings change propagates without reload before promising live behaviour in the panel copy.
