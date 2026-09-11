# HLS-011 — the drive

**On a machine with no display server, a shell creates an app, authors it, builds it and serves it —
and what is served is what the editor would draw for the same project.**

```sh
./run.sh                 # a fresh scratch directory
./run.sh /tmp/hls011     # a named one, so you can read what it left
```

Needs **docker** (for the headless half) and **Chrome + the viewer bundle** (for the comparison
half). Everything else it builds.

## Why it is two halves and not one

The headless half runs in `node:22-bookworm-slim`: no `DISPLAY`, no `WAYLAND_DISPLAY`, no
`/tmp/.X11-unix`, and no browser on the `PATH`. **Step 0 asserts all of that before it measures
anything** — "a headless box" is a claim about the environment, and a drive that assumes it is
measuring something else. A Mac with the window closed is not a machine with no display server.

The comparison half runs on the host, because it needs Chrome and the 14 MB viewer bundle. That is
not a gap in the drive; it is the drive's subject. `nodegx render` inside the container exits **8**
and says so, naming every path it looked in and the `NODEGX_RENDER_CLI` escape. **The refusal in the
container and the reading on the host are the same fact from two sides.**

## What is compared, and why that is the load-bearing part

Two renderers, one project:

- the **exporter** translates the graph into React, and `tsc -b && vite build` compiles it;
- the **viewer** — the runtime the editor draws with — interprets the same graph directly.

`host-compare.mjs` reads the built pages through `react-dom/server` (in the container, with no
browser) and the same pages through the viewer (here, in Chrome) and requires the text to be
**identical**, not merely to contain the same words. That is HLS-003's claim verified from the far
end, and it is the clause of the phase's end condition that could still be false with every command
shipped.

🔴 **Where they differ, the difference has to be *named*.** The one divergence this app provokes on
purpose — a component input wired to a `Group`'s `width` — is allowed only because
`EXPORT-REPORT.md` says so, by node, port and reason. `host-compare.mjs` reads the report to decide
that; it does not assume it. A silent divergence fails.

## The app it authors, and why it is that app

`app.mjs`. Two shapes are in it because two earlier tasks in this phase found defects in them:

- an **`Expression` doing arithmetic on a component input** — HLS-004 / issue #24, where the
  exporter's own wrapper emitted `TS18048: possibly undefined` and the export did not build;
- a **component input wired to a `width`** — HLS-005 / issue #23, where a sink in neither the style
  table nor the content table fell through both in silence.

The readings are chosen so no number on the page is also a number in the graph: `reading * 4 + 2`
over 6, 11 and 3 gives **26, 46, 14**. A page showing `6` would be showing the input. A page showing
`26` has run the arithmetic.

## Making it fail

`MUTANT=1` is not wired into `run.sh`, deliberately — a mutant that lives in the runner is a mutant
nobody re-derives. To reproduce the one this task ran, change `scopeCast` in
`src/emit/component.ts` to return its argument unchanged, `npm run build`, `npm pack`, and install
that tarball instead. The drive goes red at step 4 with **the exact error from issue #24**, and red
again at step 6 because there is no `dist/` to serve.

⚠️ **Step 5 stays green under that mutant**, and that is worth knowing: `vite build --ssr` strips
types, so the content probe cannot see a type error. Only `npm run build`'s `tsc -b` can. Each of
the two says something the other cannot.

## Not a jest spec

`.mjs`, not `.test.ts`, for the same reason as `hls007-drive.ts`: this needs docker and a browser,
and a suite that is red on every machine without them is not a gate. Calling it one would be this
phase's own C46/C47 mistake.
