# CMP-009 — The cheap path answers with confidence it has not got

Promoted from §7 by **session 12**, from the row s11 filed. 🔴 **The row's proposed fix was aimed at
the two weakest of the four holes.** s11 wrote *"carry `summary` and `antiPatterns` on the `ports`
response"*; re-measuring through the real functions found two sharper holes it does not touch, and
one of the row's own claims is wrong.

## The person sentence

**An author who asks what two ports mean is told what they mean — including that the node will be
dropped from the export, that the type was retired, and that the list the answer checked against is
not the whole list.**

## What `get_node_type({ports: [...]})` returns today

[`catalogTools.ts:107`](../../../packages/noodl-mcp/src/tools/catalogTools.ts#L107) short-circuits
above the summary path. Measured over the 27 real type-requests on that path, the response carries
`typeName`, `displayName`, `inputs`, `outputs`, `runtimeBehavior`, `notFound`, `notFoundNotes` — and
**drops** `antiPatterns`, `category`, `examples`, `examplesOmitted`, `export`, `hasDynamicPorts`,
`isVisual`, `summary`.

🔴 **s11's claim that it returns "no prose at all — no `runtimeBehavior`" is WRONG.**
`runtimeBehavior` is carried unconditionally when it exists, and has been since AWP-005
([`catalog.ts:871`](../../../packages/noodl-mcp/src/catalog.ts#L871)). 68 of 176 types have one and
88 have dynamic ports. Corrected here rather than in the row, because the row is history.
See [[measure-the-artefact-before-believing-the-task-file]].

## Why this path and not another

Re-derived independently of s11, over every transcript on this machine (25 files with calls, all
post-dating `detail` shipping 2026-07-25; range 2026-08-16 → 2026-09-10):

| shape | calls | | |
|---|---|---|---|
| default summary | 26 | | |
| **`ports: [...]`** | **18** | **27 type-requests** | |
| `detail: "full"` | 1 | | |
| | **45** | **105 type-requests** | |

✅ s11's counts reproduce exactly, including **26 of 27 ports-path requests being COLD** — no prior
survey of that type in that transcript. **The cheap path is a first contact, not a top-up.**

## The four holes, in the order the measurement ranks them

### 🔴 1. `notFound` is a bare absence claim against a list it knows is partial — 16 of 27

**16 of the 27 requests returned `notFound`. 13 of those 16 are on a type with dynamic ports**, i.e.
a type whose static port list is incomplete *by construction*. The response says *"these ports do not
exist"* and gives no signal that the list it checked is partial. Only **1 of the 16** got a
`notFoundNote` (DEF-003's `noBoxExit`, on `Text.paddingLeft`).

🔴 **The worst real case is the node this entire phase is about.** `Component Inputs` has **zero**
static inputs — its mechanism is `component-ports`, *"ports mirror the port names listed in this
node's `ports` parameter"*. A real call asked it for four ports and received
`inputs: [], outputs: [], notFound: [all four]`. A confidently empty answer about the node CMP-001
exists to teach.

This is [[assert-an-absence-with-a-known-firing-signal-beside-it]] shipped as a product surface.

### 🔴 2. The port-scoped response drops the port-scoped export warning — 3 live hits in 27

`export.structurePorts` / `contentPorts` **name ports**: a value arriving on one over a *wire* leaves
the node out of the exported code. FLD-013 put `export` on the summary for exactly this reason. The
path where you are *setting a port* does not get it.

| real call | asked | of which `structurePorts` |
|---|---|---|
| `net.noodl.visual.columns` | 9 ports | **all 9** |
| `net.noodl.visual.icon` | 5 ports | 3 |
| `Circle` | 4 ports | 2 |

Nine detailed port docs, and no mention that setting any of them over a wire drops the node.
Distribution over the catalog: `translated` 124, `deferred` 35, `stubbed` 1, `backend-only` 16 —
**52 of 176 types do not translate**, and 13 carry non-empty port lists.

### 3. Nothing says the type is deprecated — 30 of 176 types

`Animation` is deprecated. `getNodeTypePorts('Animation', ['cubicBezierP1X'])` returns a clean,
detailed, entirely unqualified answer. Its own catalog text already says
*"the type is deprecated in the catalog, so nobody building today is offered one"* — on
`export.badge.reason`, which hole 2 drops.

⚠️ **`antiPatterns` does not cover this: only 1 of the 30 deprecated types carries one.** s11's
proposed fix would have warned on 1 of 30.

🔴 **0 of the 27 real requests were on a deprecated type**, so a gate built on the traffic reads zero
in both arms — [[a-rule-reading-zero-in-both-arms-grades-nothing]]. The gate is therefore built on
`Animation`, which genuinely ships, and the zero is kept as a **labelled measurement**, not dressed
as a gate. Same discipline as CMP-007's invented token.

### 4. A first contact with no `summary` — 26 of 27

s11's half. The caller has, 26 times in 27, never seen this type before, and the response never says
what it is.

## The cost, measured on the real traffic through the real functions

Base: **32,201 B over 27 requests (1,193 B/request).**

| field | bytes | % of base | per request |
|---|---|---|---|
| `examples` | 8,739 | 27.1% | ~81 tok |
| `summary` | 3,354 | 10.4% | ~31 tok |
| `antiPatterns` | 2,487 | 7.7% | ~23 tok |
| `export` (whole) | 2,311 | 7.2% | ~21 tok |
| **`export` (ports-filtered)** | **1,159** | **3.6%** | **~11 tok** |
| `category` | 596 | 1.9% | ~6 tok |
| `deprecated` | 0 | 0.0% | 0 |

Carrying *everything* the summary carries costs **+58.3%, ~174 tok/request** — that undercuts the
only reason the path exists.

⚠️ **The percentages are against a deliberately tiny base and flatter the objection.** The four
fields this task carries total **~65 tokens per request**. Reading 21% as expensive is
[[a-budget-measured-on-a-fixture-is-a-budget-on-the-fixture]] pointed the other way: a percentage of
1,193 B is not a cost, it is a ratio.

🔴 **`examples` is deliberately NOT carried** — the single most expensive dropped field and the least
port-scoped. Recorded, not omitted, the way CMP-006 AC3 recorded `patterns`.

## Acceptance criteria

- **AC1** — a `notFound` entry on a type with dynamic ports carries the fact that the port list is
  partial **and names the mechanism**. Graded on `Component Inputs` (zero static ports,
  `component-ports`) and on a `declared-port-groups` type, both from the real traffic. A type with no
  dynamic ports must **not** gain the qualifier — the absence claim there is sound.
- **AC2** — the `ports` response carries `export`, with `structurePorts`/`contentPorts` **filtered to
  the ports asked for**. Graded on the three live-hit calls above, by their real argument lists.
- **AC3** — the `ports` response carries `deprecated`. Graded on `Animation`. The 0-of-27 traffic
  reading ships beside it as a labelled measurement.
- **AC4** — the `ports` response carries `summary` and `antiPatterns`; it does **not** carry
  `examples`. All three asserted, the exclusion included.
- **AC5** — the price is measured, not asserted: the added payload is printed on a **passing** run
  (the CN-006 trick), and `toolDisclosure` stays under budget. 🔴 Headroom was **5 tokens** at s11.
  Fund a description change, never bump the literal.
- **AC6** — control arms: each of AC1–AC4 has a spec that **reddens when that field alone is removed**,
  and every spec runs in every arm. 🔴 [[a-static-gate-cannot-see-reachability]] — s10 passed an AST
  gate with `if (false && …)`. Grade by running, not by reading the source.

## Not in scope

- The `detail: "full"` path. It is 1 call in 45 and already carries everything.
- `patterns` (259 entries, 130 types) — the larger half, left where CMP-006 AC3 left it.
- Whether any of this improves a built graph. That is CMP-002's question, and this task must not be
  read as answering it.
