---
name: run-editor
description: Launch the OpenNoodl Electron editor and inspect it headlessly — evaluate JS in the renderer, stream console output and uncaught exceptions, capture screenshots, query the DOM. Use whenever asked to run, start, debug, or screenshot the editor, or to confirm a change works in the real app rather than only in tests.
---

# Running and debugging the OpenNoodl editor

The editor is an Electron app. You can drive and inspect it entirely from the
terminal — you do not need to look at the window, and you do not need macOS
screen-recording permission.

## Launch

```bash
npm run dev:debug              # full stack + CDP endpoint, logs to .logs/dev.log
npm run dev:debug -- --quiet   # same, file logging only
```

Always launch in the background and wait for the compile — it takes 60-90s:

```bash
nohup npm run dev:debug -- --quiet > /dev/null 2>&1 &
until grep -q "launching Electron" .logs/dev.log; do sleep 15; done
sleep 30   # renderer bundle still has to load
```

`npm run dev` also works and now behaves correctly, but has no CDP endpoint.

## Inspect

```bash
npm run cdp -- health                     # is React mounted? one-shot verdict
npm run cdp -- eval "document.title"      # run JS in the renderer
npm run cdp -- console 20000              # stream console + uncaught exceptions
npm run cdp -- screenshot shot.png        # PNG via the compositor
npm run cdp -- dom ".launcher" html       # innerText or outerHTML of a selector
npm run cdp -- wait ".project-list" 30000 # block until a selector appears
npm run cdp -- reload                     # reload, e.g. to catch startup errors
npm run cdp -- targets                    # list CDP targets
```

**Start with `health`.** It reports whether `#root` has children. A window that
opens but renders nothing is the failure mode this app is prone to, and `health`
catches it in one call.

To capture a startup crash, run `console` in the background and then `reload` —
errors thrown during boot are otherwise gone before you attach.

Read `screenshot` output with the Read tool; a blank frame is a real failure.

## Logs

`.logs/dev.log` holds everything: viewer, cloud runtime, editor main process, and
the renderer console (mirrored into main process stdout in dev). Grep it rather
than scrolling:

```bash
grep -iE "error|exception|failed" .logs/dev.log | grep -viE "sass|deprecat"
```

Services: web server on 8574, cloud functions on 8577, renderer dev server on
8080, CDP on 9222.

## Traps specific to this repo

**`ELECTRON_RUN_AS_NODE`** — VS Code sets this in integrated terminals and the
extension host. With it set, the Electron binary boots as plain Node,
`require('electron').app` is `undefined`, and the app dies before opening a
window. `scripts/start.ts` and the webpack dev config both strip it now, but if
you invoke `electron` yourself, strip it: `env -u ELECTRON_RUN_AS_NODE ...`.

**Stale bundles.** Two entry points are built artefacts:

- `src/editor/index.bundle.js` (renderer) — only loaded when
  `process.env.devMode !== 'yes'`. `main.js` sets that in dev so the webpack dev
  server is used instead. If you ever see production React in a dev stack trace,
  the app is running the stale disk bundle.
- `src/main/main.bundle.js` (main process) — the actual Electron entry.
  `scripts/start.ts` rebuilds it on every dev launch. Before that existed, main
  process edits did nothing in dev.

If a change appears to have no effect, suspect a stale bundle before suspecting
the change.

**Single instance.** The app takes a single-instance lock; a second launch exits
with "Noodl is already running". Kill the old one first:

```bash
pkill -f "OpenNoodl/node_modules/electron/dist"
pkill -f "lerna exec"
```

Use those precise patterns. `pkill -f Electron` also matches VS Code, Discord and
any other Electron app the user is running.

## Tests

`npm run test:editor` (windowed) and `npm run test:ci` (headless) run the Jasmine
suite inside Electron. Both exit non-zero on failure. See
`dev-docs/reference/DEBUG-INFRASTRUCTURE.md`.
