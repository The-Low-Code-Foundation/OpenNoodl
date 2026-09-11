# HLS-003 — 🔴 The graph the CLI exports is the graph the author saw

**The load-bearing task, and it is in neither issue.** #36 ran the export chain headlessly and
reported it "worked first time". That is a statement about the runner. Nothing has ever compared the
exporter's reading of a project to the editor's.

## 1. The person sentence

**What the author sees on the canvas is what gets exported — and if it ever is not, the export says
so instead of shipping the difference.**

## 2. The seam, measured

`packages/noodl-editor/src/editor/src/models/ProjectPatches/projectLoadSeam.ts` is the registry, and
it is explicit:

> `applyPatches(content)` immediately before `ProjectModel.fromJSON(content)`. `fromJSON` does
> **not** apply patches […] So a project can differ from itself in a large number of stored
> parameters depending only on *who opened it*. The editor sees one graph; a headless render, an
> export or the MCP server sees another.

The exporter is registered in `NON_FROMJSON_READERS` with disposition **`does-not-apply`** —
*"Reads the project files directly."* `parseProject.ts` imports no patch pass; confirmed at HEAD.

It is not alone. **Three** headless readers are on that side: the exporter, `noodl-mcp`'s
`ProjectStore`, and template generation. The migration that runs on the editor's side
(`applyRunOnValueChangeMigration`) rewrites stored parameters — for every node whose control signal
is wired it writes `runOnChange-<input>: false`.

🔴 **The registry's own warning about the number:** measured at 56 writes on the site-builder
template at `cdd842fc`, 65 two days later, and **0 at HEAD** — and *"a zero here does NOT mean the
seam closed. It means this one template stopped exercising it."* The count is quoted with
`familyNodes` beside it because **a zero with no family nodes found is a broken instrument, not an
absence.**

Phase 77's D5 is what this looks like when it bites: 37 nodes rewritten on load in a fresh project,
and the site's root URL rendering no page at all.

## 3. Scope

- Measure the disagreement, over the **corpus that exists** (the shipped templates and the projects
  in the test fixtures), not a project minted for the measurement. Every reading quotes `writes`
  **beside** `familyNodes` and `signalDrivenNodes`.
- Decide and implement the export's side of the seam. The options are real and this task takes one
  with a written reason: the exporter applies the patches; or the patches stop being a load-time
  rewrite; or the export **refuses** when the two readings differ and says which nodes.
- Whichever is chosen, a gate that reddens when a fourth headless reader appears on the wrong side —
  extending `def007-project-load-seam.test.ts`, which today cannot see a reader that never
  constructs a `ProjectModel` and says so.

## 4. Acceptance criteria

1. **(person)** Author a project in the editor with a node whose control signal is wired and whose
   governed input is left unstated. Export it from the CLI. Open the exported page. It behaves the
   way the canvas behaved — or the export refused and named that node.
2. The disagreement is measured on ≥3 real projects, each reading carrying its `familyNodes` control.
   🔴 **A zero is reported as "this project does not exercise the seam", never as "the seam is
   closed".**
3. A **presence control**: a project constructed to exercise the seam produces a non-zero reading
   with the same instrument. Without this, AC2's zeros mean nothing.
4. A mutant: the chosen mechanism removed, the difference reappears, and the gate reddens.
5. `def007-project-load-seam.test.ts` fails on a newly added headless reader that does not declare
   its disposition.

## 5. Traps

- 🔴 **`all([])` is the answer you wanted.** Assert this absence only beside a known-firing signal —
  AC3 exists for exactly that and is not optional.
- 🔴 **Do not "fix" this by making the exporter call `applyPatches` and calling it done.** That makes
  the export agree with the editor and leaves the MCP server and template generation disagreeing
  with both — and template generation writes JSON that is *never loaded*, so it must be correct as
  written (phase 78 D14). The decision is about what a project on disk **means**, and the answer has
  to hold for all three readers or explicitly not.
- ⚠️ The registry is a hand-maintained list. It is not the safeguard — the test is. If you are here
  because that test failed, you are being asked to make a decision, not to append a row to make it
  green.
