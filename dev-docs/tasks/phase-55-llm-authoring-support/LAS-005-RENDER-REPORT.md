# LAS-005 — `render_report`: the feedback loop as a tool

**Status:** ✅ **done** 2026-08-08 (session 3) · **Track 2 (surface)** · ⭐ · closes audit **F5** and **F9** · §5 descoped with its blocker named (**F22**)

## The evidence

- Doctrine §11 ("you have not finished until you have looked at it") is **unfollowable** for an
  external agent: no render/measure/screenshot capability exists anywhere on the MCP surface
  (verified over all 88 tools).
- The loop that found every real defect across phases 54 and 55 costs **7.5 seconds** headless —
  `measurements/measure-project.js`, ~180 lines, built and proven in the audit (it independently
  re-found all three haiku defects from the DOM). Now
  [scripts/devtools/measure-from-disk.js](../../../scripts/devtools/measure-from-disk.js).
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

## What landed (2026-08-08)

| § | State |
|---|---|
| 1. Promote the script | ✅ `scripts/devtools/measure-from-disk.js` — free ports, Chrome discovery (`CHROME_PATH` first), `--json`, `--viewports`, `--screenshot full\|viewport\|none`, `--scale`, `--out`. Composes `render-from-disk.js`; the splicing logic is not forked. `npm run render:report` |
| 2. The report core | ✅ `scripts/devtools/render-report.js` — one module, two clients. `summarise()` is pure and specced against **recorded measurements from all three real builds** (`tests/fixtures/render/`) |
| 3. The MCP tool | ✅ `render_report`, read-only, unconditional. JSON report as text + each screenshot as MCP **image** content. Missing viewer bundle / Chrome / harness are actionable errors naming the command |
| 4. Close the loop at apply | ✅ `apply_plan` gains `render: 'summary' \| 'off'`, default summary when the plan wrote anything visual. Numbers only |
| 5. The editor client | 🔴 **descoped — see F22** |

**Measured, 2026-08-08, through a real MCP client against `phase55-replay-haiku`:** 7.7 s;
`4 errors, 3 warnings (dead-placeholder-text, broken-image, single-column-grid,
minimum-layout-width)`; two full-page PNGs at 60 KB and 48 KB (scale 0.4) in which the dead cards
and the one-column grid are legible.

| Build | errors | warnings | what it said |
|---|---|---|---|
| `phase55-replay-haiku` | 4 | 3 | 29× "Text", 5/5 images broken, a 4-item Columns grid one column wide, a 768px floor |
| `phase55-replay-sonnet` | 0 | 0 | clean; one info observation about three stacked banners |
| `ecommerce-example` | 0 | 1 | will not collapse below 525px |

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
| F9 | `render-from-disk.js` lifted every `Component Inputs` port as `plug: 'input'` and every `Component Outputs` port as `'output'`, ignoring the plug the project declared. `componentmodel.getPorts()` **inverts**: a node port plugged `output` becomes a component port plugged `input`, i.e. an input. `liftInterface` now mirrors it, including the `"input,output"` case, which is why it is a flatMap. `--print-project` was added so the reconstruction is testable without a browser. | ✅ fixed |
| F15 | **The handover's predicted consequence of F9 is false, and it is the twelfth wrong premise.** It said `ecommerce-example` "renders *only* under the harness that rewrites the plug" and would "start rendering as dead cards" once fixed. A/B measured (old derivation vs new, same Chrome, same project): **byte-identical** — 49 text leaves, 4 images, 0 broken, 2373px desktop page height, 0 placeholder strings. The reason: `ProductCard` is never instantiated as a component-instance node anywhere. Its only reference in the whole project is `foreach_64.parameters.template`. The other two builds are untouched for their own reasons — sonnet's interface ports are plugged `output` (correct), haiku's are declared on a `Group` (not an interface at all). **Measured blast radius of the fix across all three builds: zero.** It is still the right fix — the instrument must not publish an interface the product will not — but it did not repair anything, and no screenshot in this phase changes. | 📝 recorded |
| F16 | **Phase 54's reference build has a hole under its own headline.** `ecommerce-example`'s featured-products band renders the eyebrow, the heading and the blurb and then **nothing**: `foreach_64` is fed by a `DbCollection2` over collection `Product`, and the project carries **no `cloudservices` in its metadata at all**, so the query has nowhere to go — in this harness and in the editor alike. It is not a harness limitation. Two phases of screenshots missed it because `measurements/ecom-desktop.png` is a **viewport-only** capture that stops one band above the gap. That is why `render_report` captures the full page by default. Not fixed here: repairing it means provisioning a backend and seeding a collection, which is a change to a fixture project, not to the tool. | 🔴 filed |
| F17 | `render-from-disk.js` probed a running editor on `:8574` for the `:root` token block **unconditionally**, and the editor serves the tokens of whatever project **it** has open. The audit's own `measurements/haiku-full.png` is the casualty: `phase55-replay-haiku` has no `metadata` key at all, yet that shot is in `ecommerce-example`'s terracotta rather than the shipped blue this session measures. Every colour judgement made from that image was made about the wrong palette. The probe is now opt-in (`--editor-tokens`); the default is the project's own `metadata.designTokens` over the shipped defaults, which is what the editor would itself show for that project. | ✅ fixed |
| F18 | The first `single-column-grid` predicate — "≥3 look-alike siblings sharing one left edge" — scored **5 hits on `ecommerce-example` and 4 on the replay this phase calls correct**, against 2 true ones. Every false positive was a footer link list (240×17px items in a 240px parent) or a paragraph block (1168×56px). Calibrated on the three measured builds: a `Columns` node that produced one column is a **warning** (the author asked for a grid in the one node that makes grids); look-alike siblings need 120px height, 300px width, 60% of their parent and a parent at least half the viewport, and are **info** — sonnet's three full-bleed category banners are stacked on purpose, and a warning that fires on those is a warning an agent learns to ignore. Final: haiku 4 errors / 3 warnings, sonnet 0 / 0 (one observation), ecommerce 0 / 1. | ✅ calibrated |
| F22 | **§5 (the editor client) descoped, and the blocker is not the one the task expected.** It guessed "the sandbox's webview plumbing". That plumbing is fine: `SandboxPreview.tsx:86` holds an `Electron.WebviewTag` ref and `PreviewTokenInjector` already reaches into it on `dom-ready`, so `webview.executeJavaScript(measureExpression(...))` is a handful of lines. The real blocker is **where the shared substrate lives**. The pure half (`measureExpression` + `summarise` + the thresholds) is plain CJS under `scripts/` precisely so the CLI runs in a fresh checkout with no build step — and the editor bundle cannot import it without either dragging `child_process`/`ws` into the renderer or compiling it, and `scripts/` is not shipped in a packaged editor at all. The three ways out (a dependency-free `render-measure.js` both import; a new no-build package; move it into the editor and give the CLI a build step) are a packaging decision, not a wiring one. Remaining work once decided: ~50 lines plus live QA in the editor. Not held hostage: the phase's exit test (LAS-011) runs on the MCP surface, and the editor sandbox already has a human looking at it. | 🔴 filed, blocker named |
| F20 | **Found by its own spec, before the code shipped.** `resolveRenderCli` copied `resolveServiceEntry`'s shape, where an env override that points at nothing falls through to auto-discovery. Here that is actively wrong: in a repo checkout the fallback *exists*, so the spec that meant to assert "no harness installed" instead spawned a real Chrome and timed out at 5s. Setting `NODEGX_RENDER_CLI` is a deliberate act and a typo in it must say so. Now an error naming the path; the divergence from `resolveServiceEntry` is written down where it lives. | ✅ fixed |
| F21 | `packages/noodl-mcp`'s `tsc --noEmit` has **6 pre-existing errors**, all in session-2 test files (`res.text` on `ToolCallResult`, which has no such property — `interfaceGate.test.ts` ×4, `stagingDiagnostics.test.ts` ×2, both from `1b9e344a`). The suite never sees them: `jest.config.js` sets `diagnostics: false`. Zero errors in `src/`. Not a gate today, and not fixed here because it is another task's test file — but a typecheck that is red and unwatched is the `test:main` shape, and it will be someone's wrong premise. | 🔴 filed |
| F19 | Sonnet's "blue blobs" measured, since the harness was open: absolute `<div>`s at `calc(100% - 12px)` square, `border-radius: 9999px`, `background: var(--primary)` — the badge pills, filling their cards. That is exactly **F7**, the unsized-decorated-absolute-box trap LAS-003 already gates at authoring time. Deliberately **not** given a render-side twin here: a second heuristic for one defect is a second dialect, and unlike LAS-003's it could not be calibrated over the corpus (there is no corpus render). The screenshots carry it, which is the acceptance criterion's own claim. | 📝 recorded, no action |
