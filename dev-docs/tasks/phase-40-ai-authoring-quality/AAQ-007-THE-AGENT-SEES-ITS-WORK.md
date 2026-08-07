# AAQ-007 — The agent sees its work

**Origin:** the bar itself. A Claude artifact is good because the loop is *write → render → look →
fix*. Our pipeline is write → validate → ship: the agent has never once seen a pixel of what it
built. Every quality doctrine in this phase (identity, styling depth, layout) is enforceable only if
the agent can check its own output against it.
**Depends on:** AAQ-006 (it is a phase of the agent's session), AAQ-005 (`render_preview` /
`get_render_report` tools)
**Status:** open

## What exists to build on

- **AIX-008 sandbox preview**: per-clientId export seam renders an exact staged candidate in a real
  viewer. This is the render surface; the mount-path routing defect noted in its memory is a
  prerequisite check.
- **run-editor / CDP tooling**: screenshots, console streaming, DOM queries against the preview are
  already how live QA drives the editor. The same capabilities, exposed as substrate tools, are the
  agent's eyes.
- **Phase-36 observability**: runtime warnings/errors already flow through the trace substrate;
  `get_render_report` should read from it, not scrape the console.

## The loop

After the agent stages a component (or the whole changeset):

1. `render_preview(changeset, page, viewport, theme)` → renders in the sandbox.
2. `get_render_report` returns:
   - a screenshot (the model is multimodal; this is the single highest-value input),
   - console errors/warnings and runtime diagnostics (phase 36),
   - layout metrics: elements overflowing the viewport, zero-height containers, text at browser
     default font (the finding-#9 fingerprint), contrast measurements against the token set,
     unscrollable overflow (finding #8's fingerprint).
3. The agent fixes what it sees and resubmits — bounded by a fix budget (N rounds / token ceiling),
   with each round's screenshot kept in the session so review can show *why* the agent changed
   things.

Both viewports (mobile + desktop) and both themes for the final pass; single viewport during
iteration to keep cost sane.

## What to build

1. The two substrate tools, editor binding over the AIX-008 seam + CDP capture.
2. The layout-metrics probe (a script evaluated in the preview — reuse the uix-009 screenshot-corpus
   harness patterns and the pol39 drivers rather than writing a third prober).
3. The session phase in the harness: on-by-default final self-review pass; optional per-component
   quick pass behind a setting until cost data exists.
4. Review UI: the staged changeset's review shows the agent's final screenshot beside the diff —
   the reviewer sees what the agent saw.

## Acceptance criteria

1. Seeded defect test: hand the agent a staged page with a 228%-wide image, browser-default text,
   and a clipped column (the three real fingerprints from Richard's page); the self-review pass
   catches and fixes all three without human prompting.
2. The fix loop respects its budget and reports rounds + cost in the run UI.
3. Screenshots in both themes attach to the session record and survive reopen (AAQ-004).
4. The cold puppy replay's final screenshot is visually indistinguishable from what the user sees in
   a real preview window (same tokens resolved — the seam-3 regression check).
5. External parity: `render_preview`/`get_render_report` work through `noodl-mcp` so Claude Code
   gets the same eyes. Driven once live.

## Traps

- `--target=editor` attaches to the PREVIEW; closing a webview CDP target white-screens the editor
  (pol-010 lesson). The capture path must use the sandbox's own target, never the editor's.
- A fake is an unchecked claim; five ways a driver fakes a pass (phase-38 closing memory). The
  seeded-defect test exists so the loop is proven on defects we *know* are present.
- Detached previews lost design tokens before seam 3; if screenshots come from a serving path other
  than the fixed one, tokens silently vanish again and the agent "fixes" phantom problems.
- Token cost: screenshots are cheap, but N rounds × M components is not. Budget first, then loosen.
