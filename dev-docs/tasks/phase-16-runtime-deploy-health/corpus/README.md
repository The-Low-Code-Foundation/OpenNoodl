# RUN-001 corpus pass — React 18.3.1 vs React 19, compared head-to-head

The compatibility corpus and harness for RUN-001 slice 5. Renders every project
through **noodl-preview** (the real deploy path) twice — once with
`runtimeVersion` absent (React 18.3.1, the shipped default) and once with
`runtimeVersion: "react19"` — drives headless Chrome over raw CDP (no
dependencies; Node ≥ 21's native WebSocket), and diffs everything observable:

- console output and uncaught exceptions
- the probe event log the projects write to `window.__probe` (ordering, not
  just final state)
- rendered DOM (normalized: per-render instance GUIDs and the react19 script
  URLs, which differ by construction)
- computed styles (transform/opacity/visibility/z-index of every element)
- body text and a screenshot (byte compared)

## Running it

```bash
npm run build:editor:_viewer   # once, if external/deploy is stale
node dev-docs/tasks/phase-16-runtime-deploy-health/corpus/compare.mjs \
  --out /tmp/run001-corpus \
  dev-docs/tasks/phase-16-runtime-deploy-health/corpus/probes/* \
  packages/noodl-preview/tests/fixtures/hello-world \
  packages/noodl-preview/tests/fixtures/legacy \
  packages/noodl-editor/tests/testfs/import_proj{1,2,3,4,5} \
  packages/noodl-editor/tests/testfs/{sync_proj1,git-repo-utf8,reset-proj1-latest,watchproject,big-merge-test-mine}
```

Chrome is expected at the standard macOS path; override with `CHROME_BIN`.
Each project may carry a `probe-actions.json` (clicks/evals/waits the harness
replays identically on both runtimes).

## The probe projects

Purpose-built for the failure modes scanning cannot catch (the spec's §Testing
Plan): React 19's batching interacting with Noodl's per-frame dirty-flag
scheduler, and the post-findDOMNode DOM-element contract.

| Probe | Exercises | Asserts |
|---|---|---|
| `probe-signals` | chained signals (kick→A→B→C), fan-out from one signal, Counter/Switch value propagation, Timer | exact event ordering in `window.__probe` |
| `probe-animation` | Animate To Value driving `transformX` every frame — the setStyle direct-DOM fast path | final position (120), computed transforms, screenshots |
| `probe-router` | Page Router navigate + back, URL updates, **Router `boundingWidth`** (needs the DOM-element observer) | page content flips, bounding output goes 0→width |
| `probe-pagestack` | Component Stack push/pop with the default Push transition | mid-transition elements moving + clipped, final states |
| `probe-data` | Static Data → repeater, plus a Function-built array re-rendering a second repeater on click | rendered rows, build-event ordering |

## Results (2026-07-25, after the Router/Page Stack fix)

16 projects, both runtimes: **no behavioural differences.** Every probe's event
log, computed-style snapshot, body text, and screenshot is identical across
18.3.1 and 19.

What the pass found and what became of it:

1. **Router and Page Stack were missing the setDOMElement contract** — the one
   real 18-vs-19 delta. On 19, Router's `boundingWidth`/`boundingHeight`/
   `screenPosition*` outputs never fired (the bounding-box observer had no
   target once the findDOMNode fallback was gone), and both nodes' own
   `setStyle` calls (e.g. the stack's `overflow: hidden` during transitions)
   had no element. Fixed in this slice: both now attach `noodlRootRef` +
   `noodlNodeAsProp`, same as every other built-in. Re-probed: `routerWidth`
   goes `false→true` identically on both runtimes. A sweep of every
   `getReactComponent` in the viewer confirms no other built-in lacks the
   contract (Group/Video/Columns/Drag implement it directly).
2. **`<input>` attribute order** — React 19 sets `type` after the other
   attributes, 18 set it first. Visible only to innerHTML string comparison;
   computed styles and screenshots are identical. Documented for users, no fix
   needed.
3. **Per-render instance GUIDs differ run-to-run** on the *same* runtime
   (control experiment: two 18 runs). Harness noise, normalized away — not a
   runtime delta.
4. `import_proj2`/`import_proj3` have no renderable root (no `rootNodeId`, no
   export-root node) — excluded from render comparison; both runtimes report
   the same loader error.
5. `big-merge-test-mine` fails identically on both runtimes with the known
   DEBT-008 module incompatibility (`Class constructor Collection cannot be
   invoked without 'new'` from its bundled `se-topp-fovea` module) — failure
   parity confirmed, not a React delta.

## Authoring notes (for extending the corpus)

Legacy-format traps the probe authoring hit, so the next person doesn't:

- Function (`JavaScriptFunction`) connection properties are prefixed:
  `in-<name>` / `out-<name>`, never the bare script names.
- A Function **signal** output must be declared on the node:
  `"ports": [{ "name": "out-go", "plug": "output", "type": "signal" }]` —
  values self-register at runtime, signals do not (`Outputs.go()` silently
  no-ops without the declaration).
- Group's transform inputs are `transformX`/`transformY`, not `x`/`y`.
- Component Stack pages are a proplist plus per-page dynamic params:
  `pages: [{id, label}]`, `pageComp-<id>: "/Component"`, `startPageId`.
- Repeater templates receive item fields as **Component Inputs** (declare the
  ports on the template's Component Inputs node).
