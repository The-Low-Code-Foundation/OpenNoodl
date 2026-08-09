# VER-010 — The component runner: no editor, no display

**Status:** 📋 specced, not started · **Est. 1 wk** · depends on **VER-009**, **VER-003** (`nodegx test`)

> Richard, 2026-08-09: *"Every time you make a new component, all the previous component tests run
> when you declare it done."*

That sentence is only true if a scenario can run **without a human, without the editor, and without a
display**. This task is that runner. It is also the task most likely to be over-estimated, because
three of its four pieces already exist in the repo and were built for other reasons.

## What already exists — do not rebuild it

Every row read in source, per the phase-56 house rule.

| Piece | Where | What it gives this task |
|---|---|---|
| **A single component mounted as root, headlessly** | [`render-from-disk.js`](../../../scripts/devtools/render-from-disk.js) reconstructs the exporter's `projectData` from a v2 project on disk and sets `rootComponent` **by name** | The whole "serve one component with no editor" problem, already solved and already used by MCP |
| **The harness that gives inputs a source** | `benchHarness()` ([componentBench.ts:342-350](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/componentBench.ts#L342-L350)) — one synthetic component, one node of type `<target legacyName>`, `parameters` = the static inputs, `rootNode = BENCH_NODE_ID` | **A pure JSON transform.** It takes models today, but the shape it emits is plain exported-component JSON. This is the piece people assume is editor-bound and is not |
| **Editor format code running in plain node** | [`editor-deps.ts`](../../../packages/noodl-mcp/src/editor-deps.ts) — *"Electron-free by construction (verified)"*, `loadV2Project` included | Loading and validating a project from node is a solved, shipped problem |
| **Driving a headless Chrome and reading the page** | [`render-report.js`](../../../scripts/devtools/render-report.js) over CDP — already reads computed styles, element counts, `scrollWidth` | The transport for reading outputs, and the visual half of §5 |

**So the runner is not a new subsystem. It is `benchHarness`'s JSON shape, applied to
`render-from-disk`'s reconstructed `projectData`, driven by `render-report`'s CDP client.** Estimate
accordingly, and if the probe in §1 says otherwise, change the estimate rather than the design.

## §1 The probe that decides the estimate — run it first

**Do not write code before these four answers exist in this file.**

1. **Is `benchHarness`'s output reachable from node?** It is exported from a module that also imports
   `ComponentModel`, `ProjectModel` and `Exporter`. `editor-deps.ts` demonstrates the pattern for
   pulling editor modules into node, but demonstrates it for `io/`, `schemas/` and `validation/`
   only. Either `benchHarness` is Electron-free too, or the ~10 lines that build the harness object
   move to a module that is. **Check, do not assume** — and if it moves, it moves; it must not be
   twinned. One substrate, two clients is settled from phase 56 and applies here verbatim.
2. **Can `render-from-disk` be handed a synthesised extra component?** It reconstructs `projectData`
   from disk; the harness is not on disk. Confirm there is a seam to splice one in, or add one.
3. **What can be read out of the page over CDP?** The runtime lives in the page, so the trace buffer
   and the node context are reachable by `Runtime.evaluate` — which is how the outputs get read
   without the editor's relay. Confirm the exact expression, and record it here.
4. **Does the viewer bundle have to be rebuilt first?** `render-from-disk`'s own header says the
   runtime under test is *"whatever `packages/noodl-viewer-react` last built"*. If CI must build the
   viewer before it can run a component test, that is a real minute count on every run and it
   belongs in the estimate and in VER-003's CI story.

## §2 What a run is

```
load project (node)
  → for each scenario:
      splice harness with the scenario's inputs as parameters
      → serve → headless Chrome → settle (VER-009 §4)
      → read declared outputs + trace emissions over CDP
      → compare against `expect`
  → report
```

One browser, many scenarios, reused — **not** one Chrome per scenario. A cold Chrome per case is how
a 200-scenario suite becomes a twenty-minute suite that nobody runs before declaring anything done,
which defeats the task's whole purpose.

⚠️ **Component isolation is per-scenario state, and state leaks.** Reusing one page across scenarios
means a scenario can pass because of what the previous one left behind. Reload the page between
scenarios (cheap — same browser, same served bundle) rather than trusting the runtime to be clean.
Prove it with a deliberately stateful fixture: two scenarios where the second passes only if the
first's state survived, and assert that it **fails**.

## §3 The output channel, headless

VER-009 §1 established that the bench's display-dialect channel cannot carry an expectation, and that
the fidelity read is on the declared interface only. That decision pays off here: **in the headless
runner there is no relay and no `ViewerConnection` at all** — the editor's whole message layer is
absent. What remains is the runtime, in a page, reachable by `Runtime.evaluate`.

So the runner reads the same two sources VER-009 defined, by a different transport:

- **values** — the fidelity read, evaluated in-page against the declared output ports;
- **signals** — the trace buffer, read in-page.

⚠️ **This is a second implementation of the read, and that is the risk in this task.** The editor
reads over the relay; the runner reads over CDP. If the two disagree about what an output was, the
bench goes green and CI goes red and nobody knows which lied. **Mitigation, and it is not optional:**
the comparison logic — the part that takes `(observed, expect)` and returns a verdict — is one module
imported by both. Only the *acquisition* differs. A spec asserts that a fixed observed-value payload
produces byte-identical verdicts through both paths.

## §4 The CLI

Folded into VER-003's `nodegx test`, not a second command:

```
nodegx test <project-dir>              # cloud-function cases AND component scenarios
nodegx test --components               # scenarios only
nodegx test --filter 'Card/*'
```

TAP + JSON reporters, non-zero exit on failure — VER-003's contract, unchanged. A component scenario
is another kind of case in the same report, because a builder who has to run two commands and read
two reports to find out whether their change broke anything will run one of them.

⚠️ **`--components` needs a browser and the base command must degrade gracefully without one.** A CI
image with no Chrome should run the function cases and report the component scenarios as **skipped
for a named reason**, never as passed. A suite that silently covers less than it appears to is the
exact failure this phase was created to answer — the catalog gate that read the working tree, the
font check that passed twice.

## §5 The visual half, and why it is only half

`render-report.js` already measures a rendered page: element counts, computed styles,
`scrollWidth > clientWidth`, font weights. Pointing it at a benched component gives **structural
visual assertions for free**:

- something was drawn at all;
- N rows rendered, not zero and not one;
- no horizontal overflow at the scenario's declared frame width;
- the text bound to an input actually appears in the DOM.

⚠️ **"Rendered clean" can mean nothing was drawn.** That is a measured failure of this exact harness
(phase 55) and the reason the first assertion in the list above is *something was drawn at all*. A
component scenario that asserts only "no findings" asserts nothing.

⚠️ **The harness has injected the whole project into `<body>`** before now. Any structural assertion
must be scoped to the harness's mounted subtree, not to the document.

**Pixel diffing is explicitly not in this task, and the argument is not cost.** Screenshot comparison
fails on font hinting, antialiasing, a one-pixel scrollbar and a different OS — so it produces
failures that are not defects, and a suite whose failures are usually noise gets re-run until green,
which is worse than having no suite because it launders untested code as verified. If pixel diffing
is ever built it needs a tolerance, a per-platform baseline story and an owner; file it, do not slip
it in here.

## §6 Not in scope

- **Determinism seams.** VER-002 owns the clock, the seed, the entropy and the HTTP cassettes, and a
  component scenario inherits them rather than re-specifying them. ⚠️ A component calling a `Now` or
  `Random` node is exactly as nondeterministic as a cloud function doing so, and a scenario pinned
  against an unfrozen clock is a test that fails at midnight. **VER-010 must not ship before VER-002
  covers the graph seams**, or the first thing builders learn about component tests is that they are
  flaky.
- **Running scenarios of components that need a backend.** BEN-006's dataset and the sandbox network
  shim are the sample-data story; a scenario that needs a live backend is out until VER-002's
  cassettes exist.

## Landmines

- ⚠️ **`--target=editor` over CDP hits the PREVIEW**, and `cdp reload` on a preview webview destroys
  the whole preview surface (BEN register B14). Neither applies to *this* runner — it drives its own
  Chrome — but they will bite anyone debugging it against the editor and they have each cost a
  session.
- ⚠️ **An occluded Electron clamps timers ~1000× and fires zero `ResizeObserver`.** A headless Chrome
  is not Electron, but "the settle period behaves differently when nothing is visible" is the same
  class of bug and the settle logic must be measured headless, not inferred from the bench.
- ⚠️ **The viewer webpack build is pre-ES2015 for iteration** — `Array.from`, never `[...set]` — in
  anything that ends up inside the bundle.
- ⚠️ **`NodeGraphModel.forEachNode` treats a truthy return as "stop".**
- ⚠️ **A component instance carries zero built-in ports** (LAS-001), so every parameter the harness
  sets must name a real declared input — `componentBench.ts:47` already says so, and the runner
  inherits it.

## Acceptance

**Spec**

- [ ] The verdict module is shared between editor and runner, and a fixed payload produces identical
      verdicts through both paths.
- [ ] `benchHarness`'s shape has exactly one implementation in the repo.
- [ ] A stateful fixture proves scenarios are isolated — the leak case **fails**.
- [ ] No Chrome → component scenarios report `skipped: no browser`, exit code unaffected, and the
      reason appears in the report.

**Live / CI**

- [ ] `nodegx test <dir> --components` runs green on *Puppy test 3* from a clean checkout with **no
      editor running and no display**, and the number of scenarios it reports matches the number on
      disk. (A suite that silently runs a subset is this repo's most-repeated gate failure — see
      `editor-spec-barrel-must-export`, where the count was the only tell.)
- [ ] Break a component; the run goes red, names the component, the scenario and the port, and exits
      non-zero. Fix it; green.
- [ ] Wall-clock for 20 scenarios recorded here as a number, with the browser-reuse and
      page-reload-per-scenario policy in force.

## Risks

| Risk | Mitigation |
|---|---|
| Two read paths drift | One shared verdict module; acquisition differs, comparison does not |
| Chrome-per-scenario makes the suite unusably slow | One browser, page reload between scenarios, wall-clock recorded in acceptance |
| The runner needs a viewer build and CI does not do one | Probe §1.4 answers this before the estimate is believed |
| Nondeterministic nodes make scenarios flaky on day one | Hard-ordered behind VER-002 |
| Scenarios silently skipped in CI | `skipped` is a first-class reported outcome with a reason, never folded into pass |
