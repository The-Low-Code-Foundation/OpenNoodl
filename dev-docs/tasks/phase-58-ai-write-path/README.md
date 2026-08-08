# Phase 58 — The AI write path is not the editor's write path (Track AWP)

**Created:** 2026-08-08
**Status:** 📋 specced, not started. Tasks are **[TASKS.md](TASKS.md)** (AWP-001…006).
**Origin:** Richard, 2026-08-08, on reading the session-8 replay results:

> *"We need to write some serious task docs to unfuck the AI building system based on our findings."*

**Every claim about existing code in this phase's files was read in source and, where it is a claim
about behaviour, verified by running it.** Keep that rule for anything added — it is the only reason
the session-8 findings are trustworthy, and three of the six findings it produced were things the
documents already on disk got wrong.

## The premise, in one sentence

Two 2026-class open-weight models each built a correct storefront through MCP, and **neither page
appeared on screen** — one because of a field our own writer omits and the editor derives, the other
because the instrument that was supposed to catch it said "Rendered clean".

## What session 8 actually measured

Full evidence in [phase-55/LAS-011 §"Session 8"](../phase-55-llm-authoring-support/LAS-011-ACCEPTANCE-MATRIX.md).
The short version, because this phase exists entirely because of it:

| | DeepSeek V4 Pro | Kimi K3 |
|---|---|---|
| built | 12 components, 5 interfaces, repeater with `template`, 4 `Columns` | 11 components, 75 connections / 140 endpoints, 8 component outputs |
| `validate:project` | 0 errors, 0 warnings, 108 nodes | 0 errors, 0 warnings, 149 nodes |
| what rendered | **nothing** | a stray dialog, and nothing else at 390px |
| what the report said | `blank-render`, blaming the page's `Page` node and Router — both correct | **"Rendered clean: 83 texts, 10 images"** |
| cost of the confusion | 18 turns, then it dismantled its own page at the turn cap | 4 turns, because it guessed better |

**Neither failure was a model failure.** That is the finding, and it is why this phase is about our
code rather than about prompting.

## The four things that are actually broken

### 1. Our writer can produce files the editor cannot (F43) — AWP-001, AWP-002

`visual_roots` is `.optional()` on all three MCP write doors and **appears in no tool description
anywhere**. Omit it and the component has no `visualRoots`; the runtime renders a component instance
from `componentModel.roots` and empty means nothing is drawn.

In the editor that field is **derived** — `NodeGraphModel.getVisualRootIds()` recomputes it inside
`toJSON()`, so every editor save repairs it. **The editor self-heals and MCP does not.** An
agent-authored project is the only way to produce this file, which is exactly why six sessions of
phase 55 never saw it: haiku, sonnet and qwen all happened to volunteer the field.

The general defect is not the field. It is that **the format has a conformance guard for one
producer and none for the other** — `tests/io/schema-drift.test.ts` and the round-trip suite both
test editor → v2 → editor. Nothing tests MCP → v2 → editor/runtime. AWP-002 is the task that stops
the next F43, and it is the flagship.

### 2. The instruments misdirect, and one of them poisons its own control (F43, F45) — AWP-003, AWP-004

- `blank-render`'s message names the two causes it knows about — a missing `Page` node, an unrouted
  page — and DeepSeek had neither. It is a *guess presented as a diagnosis*, and it cost 18 turns.
- **It also defeats the experiment you would use to find it.** Both models ran the same probe — put a
  text node somewhere and see if anything draws. Kimi put its probe on the existing page, saw it
  render, and correctly blamed its components. DeepSeek put its probe in a **new** component, which
  was invisible for the same reason, and concluded the viewer bundle was stale. One placement
  difference, opposite conclusions.
- `render_report` passed Kimi's page with `findings: []` while desktop `pageHeight` was **exactly**
  the viewport height (clipped, not scrolling) and phone `overflowingCount` was **43**. Both signals
  were already in the report. Neither raised anything.

This is the third distinct way the eyes have passed an unbuilt page — F38 was content never drawn,
session 6 had two "clean" verdicts on near-empty pages, and this is content drawn and pushed out of
view. **The pattern is that the report only fails what it has a specific check for, and reports
"clean" for everything else** — including "clean" as a positive claim, which it has never earned.

### 3. The context we send is mostly not doing the job we think it is (F37, F44) — AWP-005, AWP-006

Measured on the wire, not estimated:

| | ≈ tokens |
|---|---|
| `get_node_type` **`Group` alone**, full detail | **11,000** |
| `get_node_type`, the 8 types a storefront needs | **30,815** |
| all 89 tool schemas + server instructions, **resent every turn** | 22,968 |

One node type costs half the entire tool surface; eight cost more than all of it. `detail: "summary"`
exists, is 4.5× cheaper, and emits `[object Object]` in place of every port's type — **2,455 of 2,455
port lines across all 142 node types**, one `String()` on an object.

**And the volume is not what keeps the framework salient.** This was tested rather than assumed:
sonnet produced the phase's only unqualified pass on the rig that *defers* tools behind a search
step; DeepSeek read **4** node types and built a complete 12-component app; Kimi read **21** and had
authored nothing by turn 34. What carried the framework was the gates and the recipes attached to
rejections — a few hundred tokens, delivered exactly when relevant.

**Target, modelled against the two runs' real per-turn bills: a 29% cut, on both, independently.**

| | billed today | tool-surface lever | node-doc lever | would bill |
|---|---|---|---|---|
| DeepSeek V4 Pro | 4.41M tok / $5.73 | −898k / $1.17 | −381k / $0.50 | **3.13M / $4.07** |
| Kimi K3 | 5.73M tok / $16.32 | −853k / $2.43 | −796k / $2.27 | **4.08M / $11.62** |

Conservative: it assumes the model still reads the same documents. A smaller surface plausibly also
means fewer turns, which compounds.

### 4. Still open from phase 55, and adopted here — LAS-013

[LAS-013](../phase-55-llm-authoring-support/LAS-013-SMALL-MODEL-HEADROOM.md) (F40's refactor cliff,
F37's door) stays where it is filed, but **session 8 changed its premise and that must be recorded
before anyone works it**: `repeated-sibling-subtree` cost DeepSeek **one** rejection and Kimi **two**,
both recovered without comment, against the 27B's 19-and-stop. **F40 is a small-model cliff, not an
open-weight cliff.** LAS-013's §2 (the 89-tool door) is superseded by AWP-006 here; its §1
(`extract_component`) is still worth doing and is now a lower priority than it looked.

## What this phase is not

- **Not a prompting phase.** No task here changes what we tell a model to do. Every one changes what
  our code does, what it writes, or what it reports back. If a fix can be phrased as "explain it
  better in the tool description", it is the wrong fix — see the ordering rule below.
- **Not a re-run of the benchmark.** The acceptance criteria are mechanical. A replay is how we
  confirm the phase worked, not how we decide whether a task is done — but see the exit test.

## The ordering rule this phase inherits and enforces

Phase 55 settled it and F43 is the clearest case yet: **structure > gate > documentation.**

1. **Structure** — make the wrong thing impossible. `visualRoots` should be derived, so it cannot be
   omitted (AWP-001).
2. **Gate** — if it can still be wrong, reject it at the door with a recipe (AWP-002).
3. **Documentation** — only for what genuinely cannot be structural.

`visual_roots` had no documentation *and* no derivation *and* no gate. Adding a `.describe()` to it
would have been the worst of the three available fixes, and it is the one that comes to mind first.

## The exit test

A model that has never seen NodeGX builds the storefront brief through MCP, and:

1. every component it writes is renderable **without it ever passing `visual_roots`** (AWP-001);
2. if it writes something the editor could not produce, the write is **rejected with the reason**,
   not accepted (AWP-002);
3. when a page is blank, the report names **which component** and why, not a guess about the page
   (AWP-003);
4. no page it builds is ever reported "clean" while invisible (AWP-004);
5. it spends **under 16,000 tokens per turn** on fixed surface and node docs combined (AWP-005/006).

Then re-run the storefront replay on DeepSeek V4 Pro — the cheapest complete builder measured, at
$5.83 — and compare against session 8's row. That is the phase's own benchmark, and it costs about
$4 to run.
