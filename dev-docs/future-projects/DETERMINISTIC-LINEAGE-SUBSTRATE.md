# FUTURE: Deterministic Data Lineage as a Substrate Service

> **Document Type:** Future Project Scoping
> **Status:** Idea / Not scheduled
> **Origin:** DEBT-012 (2026-07-24 pre-revival salvage audit) — the retirement of the VIEW-005 Data Lineage panel
> **Prerequisites:** Node catalog (SUB-004), v2 project format, semantic validator (SUB-006)
> **Priority:** Low — Explain Mode already answers the human-facing version of this question

## Executive Summary

The phase-4 Data Lineage panel tried to answer a good question — *"where does this
value come from, and where does it go?"* — and failed. It was **retired from reach**
in DEBT-012 (unregistered, not deleted). This note records the idea worth keeping so
the next attempt does not repeat the panel's mistakes: if deterministic lineage is
ever wanted, build it as a **headless substrate service over the catalog + v2 files**
that several features consume, *not* as another panel that walks the live graph.

## Why the panel-first attempt failed

The panel is documented in
[VIEW-005/NOT-PRODUCTION-READY.md](../tasks/phase-4-canvas-visualisation-views/VIEW-005-data-lineage/NOT-PRODUCTION-READY.md).
The core defect was structural, not a tuning problem:

- **It enumerated ports instead of following wires.** A simple 3-node chain
  (Variable → String → Text) produced 40+ "upstream" steps because every
  unconnected input port was treated as a source, and signal/metadata/style ports
  were swept in alongside real data ports.
- **No ground-truth port model.** With no catalog to say which ports are data vs
  signal vs style vs metadata, the filtering was a pile of ad-hoc heuristics
  (skip `changed`/`fetched`, "primary ports only", depth caps). Five documented
  fix attempts each shaved a little noise and none fixed the shape.
- **It was coupled to live UI state.** Tracing ran off canvas selection and
  context-menu events, so half the bugs were "panel shows *No node selected*"
  timing races that had nothing to do with lineage itself.
- **It duplicated Explain Mode.** Explain already answers the human-facing version
  of the question correctly, grounded in the catalog. A second, wrong answer next
  to a right one is a net negative.

The lesson: lineage is a **graph-analysis computation that needs a real port-type
model and no UI coupling** — exactly the two things the panel lacked.

## The idea worth keeping: lineage as a substrate service

Rebuild it as a pure, headless service — no panel, no selection listeners — that
takes a project and a node/port and returns a lineage graph, deterministically.

### What it would consume

- **The node catalog (SUB-004)** — the authoritative port model: which ports are
  data, signal, style, metadata; which are dynamic; input vs output. This is the
  thing that lets the tracer *follow wires between data ports* instead of
  enumerating every port. The panel had no such source of truth.
- **The v2 project format** — connections as first-class, resolvable wire records
  (source node/port → target node/port), plus component-boundary crossings
  (component inputs/outputs) so lineage can traverse into and out of child
  components without guessing.
- **(Optionally) live pulse data** from the Trigger Chain recorder for a
  *runtime-observed* lineage overlay — "these wires actually carried data during
  this interaction" — layered on top of the static structural lineage.

### Who would use it (consumers, not a panel)

- **The semantic validator (SUB-006)** as info-findings: "this Text.text is driven
  by an unconnected source", "this value has no downstream consumer" — dead-wire
  and orphan detection that the enrichment pass already gestures at.
- **Explain Mode grounding** — when explaining a node, cite its actual upstream
  sources and downstream effects by name, computed rather than paraphrased.
- **AI authoring/review agents** — before an edit, ask "what feeds this?" and
  "what breaks if I change this?" as a structured query, so a proposed change can
  be checked against the real data-flow closure (cf. AIX-003's dependency
  closures, AIX-004/005).
- **A future visualization** could still render it — but as a *view over a correct
  service*, the panel being the last thing built, not the first.

### Shape

A pure function, roughly `traceLineage(project, catalog, { nodeId, port, direction, maxDepth })`
→ a DAG of `{ node, port } → { node, port }` edges with component-boundary markers,
fully unit-testable against fixture projects (the TDD discipline the panel skipped).
No `EventDispatcher`, no `NodeGraphContext`, no `setTimeout` selection races.

## Explicitly out of scope for any revival

- Reviving `views/panels/DataLineagePanel/` — it is queued for deletion (DEBT-010).
  A new service starts from the catalog, not from that code.
- Patching `utils/graphAnalysis/lineage.ts` — it is left in place for now only so
  the dead panel compiles for one release cycle; it is **not** the seed of the
  substrate service (it is the port-enumeration approach that failed). The substrate
  tracer is a fresh, catalog-driven implementation.

## References

- [DEBT-012 — Data-Flow Tracker Salvage](../tasks/phase-14.5-revival-debt/DEBT-012-DATAFLOW-TRACKER-SALVAGE.md)
- [VIEW-005 — NOT PRODUCTION READY](../tasks/phase-4-canvas-visualisation-views/VIEW-005-data-lineage/NOT-PRODUCTION-READY.md)
- [PRE-REVIVAL-SALVAGE-AUDIT.md §4](../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md)
- Related: SUB-004 (catalog), SUB-006 (validator), AIX-003 (graph-native review), AIX-004/005 (agent grounding, live pulse data)
