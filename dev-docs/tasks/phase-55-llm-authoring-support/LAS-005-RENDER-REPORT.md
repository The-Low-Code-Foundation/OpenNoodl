# LAS-005 — `render_report`: the feedback loop as a tool

**Status:** 📋 open · **Track 2 (surface)** · ⭐ · fixes audit **F5**

## The evidence

- Doctrine §11 ("you have not finished until you have looked at it") is **unfollowable** for an
  external agent: no render/measure/screenshot capability exists anywhere on the MCP surface
  (verified over all 88 tools).
- The loop that found every real defect across phases 54 and 55 costs **7.5 seconds** headless —
  [measurements/measure-project.js](measurements/measure-project.js), ~180 lines, built and
  proven in the audit (it independently re-found all three haiku defects from the DOM).
- The asymmetry that makes this the weak-model equalizer: sonnet improvised 80% of a verification
  loop through sandboxed Bash (curl-verifying 16 image URLs) and still shipped a motorcycle for a
  bud vase, because HTTP status is not looking. Haiku improvised nothing. The strong model brings
  the instinct; the surface must bring the eyes.

## Build

### 1. Promote the script

`measurements/measure-project.js` → `scripts/devtools/measure-from-disk.js`: free-port
allocation (it currently hardcodes 8621/9231), `--json`, `--viewports` flag, Chrome-binary
discovery with a clear error. It composes `render-from-disk.js` — whose export-contract header is
the map of traps; keep composing, do not fork the splicing logic.

### 2. The report core as a shared module

Extract the measurement JS + report shape into a module both the script and the MCP server import
(the `editor-deps` pattern decides where it lives — likely beside the script with a clean export,
since the MCP server already requires repo-relative files). Report contents, per viewport
(1280×900, 390×844 via device emulation — Chrome will not open real windows under ~500px):

- `scrollWidth` vs `clientWidth`, forced minimum layout width (the "cannot collapse below Npx"
  signature), worst offending elements
- font-weight and font-size sets across text nodes (`{"400"}` = no hierarchy)
- broken images (`complete && naturalWidth === 0`), image count
- empty decorated boxes; **dead-placeholder texts** (elements whose rendered text is a node-type
  default like "Text" — the haiku signature; derive the default-strings list from the catalog,
  not hardcoded)
- page height per viewport (reflow evidence), screenshot

### 3. The MCP tool

`render_report` — read-only, registered unconditionally (like the other read tools in
`server.ts`). Returns the JSON report **and the screenshots as MCP image content** so a multimodal
agent can look — the only fix wrong-subject images can ever have. Practicalities:

- Requires the built viewer bundle (`packages/noodl-editor/src/external/viewer/noodl.viewer.js`)
  and a Chrome binary. Absence of either is an **actionable error** naming the rebuild command /
  install, not a crash.
- Design tokens: `render-from-disk.js` already overlays `metadata.designTokens` (phase-54 F5 fix)
  and probes a running editor on :8574. The tool must not depend on an editor being up; verify the
  fallback path renders the project's own tokens correctly headless (phase-54 F4's lesson: the
  harness reconstructing token CSS is where the last two lies lived).
- Screenshot size: cap dimensions/scale so the response stays sane for MCP transport (the audit's
  full-page shots at deviceScaleFactor 0.5 were ~500KB — acceptable; make it a parameter).

### 4. Close the loop at apply

`apply_plan` gains `render: 'summary' | 'off'`, default **summary** when the plan touches any
visual component: the response appends the numeric report only (no screenshots — the agent calls
`render_report` for eyes). The agent that just applied a plan is told, in the same turn, "your
grid is one column, five images are broken, twelve texts render their placeholder".

### 5. The editor client (one substrate, two clients)

The in-editor loop's sandbox preview (AIX-008, `sandboxExport.ts`) is a human review surface with
no machine-readable output. Wire the same report module to the sandbox preview's frame so the
embedded agent can request the identical report. Scope honestly: if the sandbox's webview plumbing
makes this a phase of its own, land the MCP+script halves and file the editor half as a register
row with its blocker named — do not hold the tool hostage.

## Acceptance

- `render_report` on `phase55-replay-haiku` flags, from the report alone: dead placeholder texts
  on the cards, the one-column grid at desktop, 5 broken images, the 768px minimum layout width.
- On `phase55-replay-sonnet`: clean numbers, and the screenshots show the blobs — verifiably
  present in the returned images.
- `apply_plan` on a visual plan returns the summary without adding more than ~10s.
- Jest for the report module (against fixture DOMs or the two replay projects); live QA for the
  tool over a real server session. Standard gates green.

## Register

| # | Finding | State |
|---|---|---|
| — | | |
