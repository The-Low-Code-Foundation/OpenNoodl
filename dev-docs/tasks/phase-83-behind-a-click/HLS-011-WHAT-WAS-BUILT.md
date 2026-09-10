# HLS-011 — what was built

**Session 13, 2026-09-10.** The phase's own end-to-end pass, and the last task on the board.

> **On a machine with no display server, a shell creates an app, authors it, builds it and serves
> it — and what is served is what the editor would draw for the same project.**

**4 of 4 acceptance criteria.** The drive is
[`packages/nodegx-export/tests/hls011/`](../../../packages/nodegx-export/tests/hls011/) — one
command, `./run.sh`.

## 1 — Where it ran, and why that had to be asserted rather than assumed

🔴 **A headless box is a claim about the environment.** §4 of the task file says so: *"a headless
container, not a Mac with the window closed."* So step 0 of the drive measures the machine before it
measures anything else, and the drive fails if the machine is not the one the sentence names:

```
platform      linux/arm64            node   v22.23.2
DISPLAY       null                   WAYLAND_DISPLAY  null
/tmp/.X11-unix  absent
google-chrome  ""   chromium  ""   chromium-browser  ""   firefox  ""
```

`node:22-bookworm-slim`, with `@nodegx/export` installed from a `npm pack` tarball — **not from the
checkout**. There is no `packages/` above it, which is C72's shape, and no repo to fall back to.

## 2 — The route, measured

| step | what happened |
|---|---|
| 1. `create_project` over MCP | 8 files, 4 docs (`BRIEF`, `ARCHITECTURE`, `CONVENTIONS`, `decisions/000-initial-scope`). Six tools advertised before the bind; 20 after it |
| 2. author over MCP | `create_component Components/Gauge`, `update_component Pages/Home`, `create_component Pages/Readings` — all accepted, `validate_project` clean |
| 3. `nodegx export` | `--dry-run` **exit 4**, then export **exit 0**, **16 files** |
| 4. `npm ci` → `npm install` → `npm run build` | **`npm ci` exit 1**; `npm install` exit 0; `npm run build` **exit 0** — `tsc -b && vite build`, `index-DCJqBbfe.js` 264.60 kB, built in ~1.5 s |
| 5. what is on the pages | both pages server-rendered through `react-dom/server`, with no browser |
| 6. `nodegx serve` + HTTP | *"Listening on 127.0.0.1:8899 — this machine only."* `/` → **200**, 395 bytes, a shell; `/assets/index-DCJqBbfe.js` → **200**, 264,597 bytes, carrying the heading. A fetch to the box's own non-loopback address: **refused** |
| 7. `nodegx render` | **exit 8**, naming both paths it looked in and `NODEGX_RENDER_CLI` |
| 8. the viewer, on the host | the same project, in Chrome, through the runtime the editor draws with |

✅ **Reproducible across containers.** Three independent runs from three fresh scratch directories
produced the same asset filename — `dist/assets/index-DCJqBbfe.js` — at the same **264,597** bytes.
The hash is content-addressed, so that is the emitter, the compiler and the bundler all landing on
the same bytes from the same graph, three times.

**The app is two pages and one reusable component, and it is that app on purpose.** It carries an
`Expression` doing arithmetic on a component input (HLS-004 / issue #24) and a component input wired
to a `width` (HLS-005 / issue #23). The readings are chosen so that no number on the screen is also a
number in the graph: `reading * 4 + 2` over 6, 11 and 3 gives **26, 46, 14**. A page showing `6`
would be showing the input; a page showing `26` has run the arithmetic.

## 3 — AC2 and AC3: the two renderers, side by side

**By content, not by count** — and identical, not merely overlapping:

```
                    the built React app          the viewer (what the editor draws)
Home       Kettle Log — every boil, counted Morning 26 Evening 46      ← character-for-character equal
Readings   Readings, most recent first Latest 14                       ← character-for-character equal
```

The arithmetic ran in both. The URL was read back after every navigation (C74's lesson) and neither
route moved.

🔴 **They differ in exactly one place, and the export said so before anyone looked.** The viewer
applies the three authored bar widths as inline styles — **120%, 200%, 64%**, exactly the three
`barWidth` inputs in the graph. The built app applies **none**. `EXPORT-REPORT.md` carries the
reason, by node, by port:

```
- wire into gauge_bar.width from component input "barWidth" has no rendered sink on Group —
  the property renders from its authored parameter only, so the wire is dropped, reported
```

…and the emitted `Gauge.tsx` carries a `TODO(export)` marker saying the same thing where the element
would have been. ✅ **AC3 is closed by the refusal being *named*, not by the two agreeing** — and
`host-compare.mjs` decides that by **reading the report**, so a silent divergence fails the drive
rather than passing as a named one. **The gap itself is real and is filed as C75.**

⚠️ **And the pre-flight refused it first.** `nodegx export --dry-run` exited **4** on this project —
*something will not translate* — before a single file was written. A CI pipeline gating on
`--dry-run` stops at the gate and reads the report, which is what exit 4 was built for. This is the
first time that code has been provoked by a project somebody authored rather than by a fixture.

## 4 — 🔴 The phase's own recipe does not run

**`npm ci` exits 1.** The export ships no lockfile, so:

```
npm error code EUSAGE
npm error The `npm ci` command can only install with an existing package-lock.json or
npm error npm-shrinkwrap.json with lockfileVersion >= 1.
```

The phase's person sentence ([README §1](README.md#1-the-person-sentence-for-the-whole-phase)), its
end condition (§6) and HLS-011's own route all say **`npm ci && npm run build`**. HLS-008's *"What
is NOT established"* had already noticed and called it *"the criterion's word is wrong, not the
drive"* — this is the same fact with a pipeline behind it. The **generated `EXPORT-REPORT.md` is
correct** and says `npm install && npm run build`; the phase's prose is the thing that is wrong, and
a person following the phase document into a GitHub Action gets a red first step. **C76.**

The drive measures `npm ci` and **grades `npm run build`**, deliberately: whether `npm ci` works is
the finding, not the pass condition.

## 5 — AC4: the mutant, and it is issue #24 coming back

One line in `src/emit/component.ts:5915` — `scopeCast`, HLS-004's fix — made to return its argument
unchanged, rebuilt, repacked, and installed instead. **The same drive script, the same container,
the same authored app.**

| arm | tarball md5 | result |
|---|---|---|
| clean | `92781c77b8e9717e6ecd74c92add73bc` | all 8 steps green |
| mutant | `1f5ea71a24f217864c883823232d4b95` | **step 4 red**, **step 6 red** |

```
src/components/Gauge.tsx(8,13): error TS18048: 'reading' is possibly 'undefined'.
```

That is [#24](https://github.com/The-Low-Code-Foundation/NodeGX/issues/24)'s error, on this drive's
own app, produced by removing the fix that closed it. Step 6 went red as a consequence — *"There is
no folder at /work/export/dist."* — which is the honest downstream reading and not a second check.

✅ **The restore is proved, not asserted:** the tarball re-packed after putting `component.ts` back
is **byte-identical** to the one packed before the mutant (`92781c77…` both times), so the two arms
differ by exactly the one line.

⚠️ **Step 5 stayed GREEN under the mutant, and that is the sharpest thing here.** `vite build --ssr`
strips types, so the content probe rendered both pages perfectly from source that `tsc` refuses.
**The content probe cannot see a type error and the build gate cannot see a wrong number.** Each says
something the other cannot, and a drive with only one of them would have shipped believing itself.

## 5b — And then the editor opened it, because an agent asked

🔴 **The last step of the route is the phase's whole subject in one line.** The project the container
authored was copied, and opened in a running editor **over HLS-009's relay** — not by hand, not from
the launcher:

```
[drive] find_tools({query:"editor"}) -> revealed: … open_in_editor …
[drive] open_in_editor isError=false
{ "ok": true, "disposition": "open", "projectName": "Kettle Log" }
```

The window title reads **Kettle Log**, and the canvas draws:

```
Kettle Log — every boil, counted
Morning
26                    ▬▬▬▬▬▬▬▬▬▬  (the bar)
Evening
46                    ▬▬▬▬▬▬▬▬▬▬
```

**26 and 46** — the same numbers the built React app server-rendered in a container with no browser,
now on a canvas a person is looking at. And the bars are there, which is what makes C75 legible at a
glance rather than as a diff: the editor draws a bar the export declined to give a width.

⚠️ Opened on a **copy**. Opening a project writes into it (`.mcp.json`, `CLAUDE.md`, the recent
list), and the artefact the container produced is the evidence.

## 6 — What this leaves

- **`./run.sh` is the whole thing**, and running it *is* how AC1 was closed: a fresh scratch
  directory, one command, nothing invented, no undocumented flag.
- **The two halves are a pair, not a compromise.** `nodegx render` exits 8 in the container and the
  viewer reads the same project on the host: the refusal and the reading are one fact from two
  sides, and the drive asserts both.
- **A dependency-free MCP stdio client** (`mcpclient.mjs`, ~80 lines) — newline-delimited JSON-RPC,
  no SDK to install. 🔴 It rejects on the server's **exit**, not only on a timeout: the first version
  turned a correct one-line refusal (*"Starting with no project directory needs --allow-writes"*)
  into three minutes of silence.
- **C75** and **C76** filed. Nothing found here blocks an acceptance criterion.

## 7 — What is NOT established

- 🔴 **The loopback reading is NOT a second machine, and does NOT close HLS-006's person halves.**
  A fetch from the container's own non-loopback address was refused, which proves the socket refuses
  a non-loopback peer — the same thing HLS-006 already measured. **One container's network namespace
  is not a second host.** HLS-006 AC1 and AC4 say *"from a second machine on the same network"* and
  stay half-closed. (Raised by the peer session that built HLS-006, before this was written down.)
- **No backend.** The app stores nothing, so `provision_backend`, HLS-013's cloud functions and
  every `/__backend` path are untouched by this drive.
- **Nothing was clicked.** Both readings are of a page as it renders. HLS-007's warning stands: an
  image, and a server-rendered string, prove pixels rather than reachability.
- **One project.** The corpus gates in `nodegx-export` cover the export across 42 projects; this
  adds one app with two shapes chosen to be awkward.
- **`nodegx deploy` is not in the chain**, because it does not exist — R4 is still Richard's.
- **The container is arm64.** Nothing here was run on x86, and nothing in it is arch-sensitive as far
  as this drive can see, which is not the same as knowing.
