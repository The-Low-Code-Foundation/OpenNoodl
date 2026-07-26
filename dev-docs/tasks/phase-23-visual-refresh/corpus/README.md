# UIX-009 Visual-QA screenshot corpus

The phase's verification instrument. A scripted CDP run captures a named set of
editor surfaces in **both themes** into a dated folder; a trivial static gallery
puts them side by side. "Did we regress the UI" becomes a diffable question
instead of a vibe.

## One command

```bash
dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh
```

This kills any stale dev stack, launches `npm run dev:debug` (CDP on :9222),
waits for the renderer, runs `capture.mjs`, and builds `gallery.html` from the
newest capture folder. Open `gallery.html` in a browser.

## What it captures

`capture.mjs` connects to the editor renderer over **one** CDP WebSocket and, for
each of `dark` then `light`:

- **launcher** — when the launcher window/state is showing
- **editor** — the full editor once a project is open
- **panel-\<data-test\>** — it self-discovers every rail panel button from the
  live DOM (`[data-test]` under nav/sidebar/toolbar chrome) and walks them all.
  This is the "menu-walk": the panel list is not hardcoded, so a panel added
  later shows up in the corpus automatically.

Determinism (so a diff means something):

- fixed size `1600×1000` via `Emulation.setDeviceMetricsOverride`
- every `animation`/`transition`/`caret` killed by an injected stylesheet
- `prefers-reduced-motion: reduce` forced
- theme set declaratively — `data-theme` attribute + the `nodegx:themechanged`
  event the canvas repaints on — not through the async settings round-trip

## The fixture project

Editor + panel captures need a project **open**. For a comparable corpus, always
open the **same** project. The designated fixture is any small project that
exercises the surfaces the rubric cares about — at minimum a component with a few
node types and one **JavaScript/Function node** (so the CodeMirror chrome and its
syntax theme are in the corpus in both themes).

Project-open is left as a manual step on purpose: the open choreography (launcher
card double-click, or `App.instance.openProject`) is timing-flaky per RUN-003's
live-editor traps, and baking it into the harness would make the *harness* flaky.
The capture itself is deterministic. Recipe:

1. `run.sh` brings up the editor at the launcher.
2. Open the fixture project once (double-click its card, or open via the menu).
3. Re-run just the capture against the now-open editor:
   ```bash
   node dev-docs/tasks/phase-23-visual-refresh/corpus/capture.mjs
   ```
4. Build/refresh the gallery:
   ```bash
   node dev-docs/tasks/phase-23-visual-refresh/corpus/gallery.mjs \
     dev-docs/tasks/phase-23-visual-refresh/corpus/captures/<newest>
   ```

The harness never hard-fails on a missing surface — it captures whatever state
each window is in and reports what it got, so a launcher-only run and a
project-open run both produce a valid (smaller/larger) corpus.

## Before/after diffing

```bash
node gallery.mjs <afterDir> <beforeDir>
```

renders before|after columns per surface+theme. Note: a true phase-23 "before"
set does not exist — UIX-001 landed before this harness was built (see
PROGRESS.md), so the earliest reference images are the `screenshots/after-*`
folders. Going forward, this corpus IS the baseline: capture it before a change,
capture it after, diff the two folders.

## Files

| File | Role |
|---|---|
| `capture.mjs` | raw-CDP capture harness (no deps; Node ≥ 21) |
| `gallery.mjs` | static before/after gallery generator (no deps) |
| `run.sh` | one-command wrapper (launch → capture → gallery) |
| `captures/<stamp>/` | one dated folder per run + `manifest.json` |
| `gallery.html` | generated; open in a browser |
