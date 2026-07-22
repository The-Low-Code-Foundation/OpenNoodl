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
npm run dev:debug                    # full stack + CDP endpoint, logs to .logs/dev.log
npm run dev:debug -- --quiet         # same, file logging only
npm run dev:debug -- --inspect-main  # also open a main-process inspector on :9229
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
npm run cdp -- services                   # are the dev servers and builds up?
npm run cdp -- eval "document.title"      # run JS in the renderer
npm run cdp -- console 20000              # stream console + uncaught exceptions
npm run cdp -- screenshot shot.png        # PNG via the compositor
npm run cdp -- dom ".launcher" html       # innerText or outerHTML of a selector
npm run cdp -- wait ".project-list" 30000 # block until a selector appears
npm run cdp -- click "button.create"      # real trusted click, React handlers fire
npm run cdp -- type "input[name=x]" "hi"  # focus + insert text, fires onChange
npm run cdp -- reload                     # reload, e.g. to catch startup errors
npm run cdp -- targets                    # list CDP targets
```

**Start with `health`.** It reports whether the mount point has children. A window
that opens but renders nothing is the failure mode this app is prone to, and
`health` catches it in one call.

**Two renderers.** The editor and the project preview are separate windows, so
separate CDP targets. Every command takes `--target`:

```bash
npm run cdp -- health --target=viewer            # the preview window
npm run cdp -- screenshot preview.png --target=viewer
```

`--target=editor` is the default. The viewer target only exists while a preview
is running; asking for it otherwise is an error rather than a silent fall back to
the editor.

`click` and `type` go through `Input.dispatchMouseEvent` / `Input.insertText`, not
synthetic DOM events, so React's handlers, focus and `:active` behave as they do
for a real user. `el.click()` from `eval` bypasses most of that — prefer these.

Startup exceptions are captured automatically: `dev:debug` attaches to each page
as it appears and writes `[renderer:exception]` lines into `.logs/dev.log`, so a
boot crash is in the log before you get there. `console` + `reload` is still the
way to watch them live.

## Screenshots — use CDP, not `screencapture`

`npm run cdp -- screenshot` renders through the browser compositor. It needs **no
OS permission**, works when the window is behind others, and covers everything
inside the window — which is nearly all of an Electron app.

**A black rectangle from macOS `screencapture` means a missing permission, not a
crashed app.** macOS gates screen capture behind Privacy & Security → Screen &
System Audio Recording, and the permission belongs to the *capturing* process —
your terminal or VS Code — not to OpenNoodl. The desktop and dock still render
normally, so the result looks exactly like an app that failed to paint. This has
already cost one session several steps chasing a crash that never happened.

If you have a black frame and are unsure which it is, run `npm run cdp -- health`.
`reactMounted: true` means the app is fine and your capture path is not.

Reach for the native path only for things outside the renderer — the OS window
frame, native menus, native dialogs, multi-window layout. That needs the
permission granted to Terminal / VS Code (then restart that app), and
Playwright's `_electron` driver is the better tool if you need it repeatedly.

Read screenshots back with the Read tool. A blank frame from *CDP* is a real
failure.

## Logs

`.logs/dev.log` holds everything: viewer, cloud runtime, editor main process, and
the renderer console (mirrored into main process stdout in dev). Grep it rather
than scrolling:

```bash
grep -iE "error|exception|failed" .logs/dev.log | grep -viE "sass|deprecat"
```

Services: web server on 8574, cloud functions on 8577, renderer dev server on
8080, CDP on 9222, main-process inspector on 9229 when asked for.
`npm run cdp -- services` probes all of them, plus the freshness of the viewer
and cloud-runtime builds in `src/external` — those are webpack watch builds
rather than servers, so they have no port to probe.

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

Both are gitignored now, and `npm run check:artefacts` fails if they are ever
committed again — a tracked bundle is what let a months-old build masquerade as
source. If a change appears to have no effect, suspect a stale bundle before
suspecting the change.

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
