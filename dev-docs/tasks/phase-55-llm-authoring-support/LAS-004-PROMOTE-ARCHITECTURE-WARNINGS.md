# LAS-004 — Promote the architecture warning, add the page-size backstop

**Status:** 📋 open · **Track 1 (gates)**

## The evidence

`repeated-sibling-subtree` fired correctly on **every measured build** — 3 warnings on the Opus
baseline's exact failure, 2 on haiku's, 1 on sonnet's — and blocked nothing, anywhere. It is the
only architecture gate in the system and it is advisory through every door (verified:
`AUTHORED_BLOCKING_WARNINGS` at
[authoredCandidate.ts:149](../../../packages/noodl-editor/src/editor/src/validation/authoredCandidate.ts#L149)
is `UnknownParameter`, `UnitlessDimension`, `UnresolvedNavigation`, `PageWithoutPageNode` — all
wiring-level).

Meanwhile the audit's classification says hard rejections were self-corrected at a 100% rate even
by the mid-tier model. The gate that already speaks the right sentence needs to stop whispering.

## Build

### 1. Promote `RepeatedSiblingSubtree` to authored-blocking

- Add its code to `AUTHORED_BLOCKING_WARNINGS`. The corpus is untouched by construction — the
  authored policy never applies to `validate:project` (the file's own doc-comment, verified).
- **First**: sweep the AI-suite fixtures for hand-laid trios. The `PageWithoutPageNode` precedent
  is the governing lesson, in both directions: fixtures teaching a refused shape get corrected
  (they were asserting the wrong thing), and the correction is not a suppression. Expect hits —
  the fixtures predate the doctrine.
- The rule's message already offers both exits (one component instantiated N times, or a
  Repeater) — with LAS-002 landed, that text now actually reaches the staging agent, and with
  LAS-007 it carries the recipe. Sequence this task after LAS-002 so a newly-blocking gate arrives
  speaking.

### 2. New rule: the oversized page (info severity)

A **page** component (has a `Page` node / registered route) whose own graph exceeds a threshold →
**info**: "this page wanted to be several components" (doctrine §0's ~25-node line).

- **Info, not warning, deliberately.** The audit showed cold models already decompose when the
  doctrine reaches them; this is a backstop against the 66-node regression, not a pressure toward
  over-factoring (best-practices 01: "over-factoring is its own mess"). It must never block.
- Threshold from the corpus: run a node-count census of page components across the ~95 projects
  and pick the knee, recording the numbers — not the doctrine's prose number. If the corpus knee
  disagrees with ~25, the corpus wins and the doctrine gets a footnote.
- Count the page's **own** nodes (instances count as 1) — the whole point is that a page of six
  instances is the ideal.

## Acceptance

- `ecommerce-example`'s `Pages/Home` (66 nodes, 3 trios): rejects as authored output on the
  trios; draws the page-size info.
- The two cold-replay Homes (7 and 8 nodes): pass both checks untouched.
- Sonnet's `Sections/InfoStrip` (the 4-identical-siblings quartet): rejects as authored output.
- Editor jest count does not drop (fixture sweep done right — compare the passing COUNT, `Tests:
  0` is a compile failure); noodl-mcp suite green; corpus census recorded in the register.

## Register

| # | Finding | State |
|---|---|---|
| — | | |
