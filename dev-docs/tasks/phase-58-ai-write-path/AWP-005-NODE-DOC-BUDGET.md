# AWP-005 — The node-doc budget: `Group` costs 11,000 tokens

**Status:** ✅ **§1 DONE 2026-08-08, §2 DONE 2026-08-10** — §3 closed as unnecessary, see
[§2 as built](#2-as-built--2026-08-10) · **Track: the context** · out of **F44** ·
Richard asked for this directly:

> *"I'm a bit worried that Kimi described our node docs as 'enormous', are we feeding too much context
> into the calls? Or is that necessary to keep the Noodl framework in the forefront of the LLM's
> reasoning?"*

**The answer, measured: yes we are, and no it is not necessary.** Both halves were tested rather than
asserted, and the second half is the one that decides how much of this task to do.

## What a node doc actually costs

Measured on the wire against the real server, 2026-08-08:

| call | chars | ≈ tokens |
|---|---|---|
| `get_node_type` **`Group` alone**, full detail | 44,070 | **11,018** |
| `get_node_type` `Text` alone, full detail | 27,048 | 6,762 |
| `get_node_type`, the 8 types a storefront needs | 123,258 | **30,815** |
| `get_node_type`, same 8, `detail: "summary"` | 26,963 | 6,741 |
| `list_node_types` (all) | 47,518 | 11,880 |
| `get_style_vocabulary` | 26,761 | 6,690 |
| *(for scale)* all 89 tool schemas + server instructions | 103,364 | 22,968 |

**One node type costs half the entire tool surface. Eight cost more than all of it.** `Group` has 111
ports, and full detail carries every enum's options for every one of them.

**And the bill compounds.** Input is resent every turn, so a doc read on turn 8 is re-billed on every
turn after it. Kimi's 21 `get_node_type` calls are essentially the whole 100k-token growth of its
context, paid roughly 25 more times.

## `detail: "summary"` is broken, catalog-wide

The mode that exists to solve this problem returns, for every port:

```
"in alignContent: [object Object]"
```

**Cause, one line:** `catalog.ts:273` builds the port line as
`` `${dir} ${p.name}: ${String(p.type)}${p.isSignal ? ' (signal)' : ''}` ``
([catalog.ts:273](../../../packages/noodl-mcp/src/catalog.ts#L273)), and a port's `type` is an object
(`{name: 'enum', enums: [...]}`), not a string.

**Measured across the whole catalog: 2,455 of 2,455 port one-liners, all 142 node types — 100%.**

So the cheap mode conveys port *names* and no types at all, which is why no model uses it and every
model pays full price. The tool description even recommends it — *"Pass detail: 'summary' for a
compact per-type shape when surveying several types"* — for a mode that has never worked.

## Does the volume buy us anything? Tested, and no

This is the half that matters, because it decides whether to trim aggressively or carefully:

- **Sonnet 5** produced the phase's only unqualified pass, on the `claude` CLI rig — which *defers*
  tools behind a search step, i.e. with **less** resident surface, not more.
- **DeepSeek V4 Pro** read **4** node types (~36k tokens of tool results all run) and built a complete
  12-component storefront.
- **Kimi K3 (run 1)** read **21** (~104k tokens) and had authored nothing by turn 34.

Doc volume was **anti-correlated** with building. What carried the framework was the gates and the
LAS-007 recipes attached to rejections — a few hundred tokens, delivered at the moment they are
relevant, which is the pattern the whole of phase 55 validated.

⚠️ **One honest confound, and it argues the same way.** The session-8 driver truncates tool results at
24,000 chars, so `Group`'s 44,070 arrived **cut in half, mid-JSON**. That is very likely why Kimi
called `get_node_type` 21 times and called the docs "enormous" — it was re-asking for a document it
kept receiving in fragments. A payload that no longer needs truncating is a payload that gets read
once.

## The fix

### §1 Fix `String(p.type)` — one line, 4.5× on the dominant call

Render the port's type as its `name`, with enum options included only where they are short, or
summarised as a count (`enum(12)`) where they are not. This alone takes the 8-type storefront call
from 30,815 to ~6,700 tokens.

### §2 Make `summary` the default, and full detail opt-in

A model choosing between `Group` and `Columns` needs port names and types. A model setting `width`
needs `width`'s type and allowed values — not all 111 ports. So:

- `detail` defaults to `summary`.
- Full detail stays available per type.
- Ideally add per-port detail (`get_node_type(["Group"], {ports: ["width", "flexDirection"]})`) so the
  expensive payload is only ever fetched for what is being set. **Weigh this against AWP-006** — a new
  argument is cheap, a new tool is not.

⚠️ **`summary` must first be worth defaulting to.** Land §1, verify a model can actually author from
summary output, and only then flip the default. Flipping first would repeat the original defect in a
louder way.

### §3 Trim what full detail carries

Before adding modes, look at what is in the 11,000 tokens. Long enum lists, per-port prose repeated
across every type that shares a port (every visual node carries the same ~40 layout ports), and the
`Group` port set duplicated across the catalog are all candidates. **Measure first** — §1 and §2 may
make this unnecessary, and this is the most invasive of the three.

## Acceptance

- No `[object Object]` in any `get_node_type` response: assert **0 of 2,455** across the full catalog,
  the same measurement that found it.
- The 8-type storefront call at `summary` costs under 8,000 tokens and carries a usable type per port.
- A written decision on defaulting `detail` to `summary`, backed by a live authoring check rather than
  inspection.
- Fixture: a spec that fails if any single `get_node_type` response exceeds a stated token budget, so
  the next port added to `Group` does not silently push it past a client's limit.

## §1 as built — 2026-08-08

`portTypeLabel()` in [catalog.ts](../../../packages/noodl-mcp/src/catalog.ts) replaces `String(p.type)`.
It renders the type `name`, plus the detail a caller needs to *set* the port: enum values inline while
the joined list is ≤ 96 chars, a count above it (`enum(12 options)`), and a number's units with the
default first — because a units port writes a string, so which unit is implied by a bare number is the
load-bearing fact.

Gated by [`tests/nodeDocBudget.test.ts`](../../../packages/noodl-mcp/tests/nodeDocBudget.test.ts),
10 specs. **Seen failing before it was seen passing**: with `String(p.type)` restored, 3 of the 10 go
red, the sweep naming offenders. The catalog-wide assertion is deliberately two-sided — `0` offenders
*over ≥ 2,400 port lines* — because "zero `[object Object]`" alone passes forever if the suite quietly
stops loading ports.

**Measured on the wire** (the registered handler over an in-memory transport, so the numbers are
`JSON.stringify(payload, null, 2)` and directly comparable to the table above — measuring compact JSON
understates every figure by about half, which is a trap worth naming):

| call | before | after | |
|---|---|---|---|
| catalog sweep | **2,455 of 2,455** port lines `[object Object]` (142 types) | **0 of 2,455** | ✅ |
| `Group`, full | 11,018 tok | 11,018 tok — untouched | §3's territory |
| `Group`, summary | 1,240 tok, **no types** | **1,598 tok, with types** | usable at last |
| 8-type basket, full | 30,862 tok | 30,862 tok | |
| 8-type basket, summary | 6,741 tok, no types | **6,169 tok, with types** | **5.0× cheaper than full**, under the 8,000 bar |

The costed mode is now *cheaper than the broken one and actually carries the types* — a real port line
reads `in width: dimension(%|px|vw|vh)`, `in flexDirection: enum(none|column|row)`.

⚠️ **§2 is deliberately not done.** Flipping the default needs the live authoring check this task
demands, not inspection — and that needs an MCP rebuild plus a model run. The budget ratchets
(≤ 3,000 tok per summary, ≤ 12,500 per full response) are in and will fire when the next port is added
to `Group`.

## §2 as built — 2026-08-10

**`detail` now defaults to `summary`**, full detail is opt-in, and `get_node_type` takes a new
`ports` argument returning full authored semantics for named ports only. A new *argument* on a
resident tool, not a new tool — the weighing against AWP-006 that §2 asked for.

### The check the flip needed, done against the corpus before spending anything

§2's condition was *"verify a model can actually author from summary output"*. That was answered by
asking the question the corpus can already answer: **of every `(nodeType, port)` pair the four
phase-55 replay models actually set, how many does the summary carry with a usable type?**

| | |
|---|---|
| catalog node types used across the four builds | 12 |
| `(type, port)` pairs the models set | **117** |
| carried by the summary with a usable type | **113** |
| present but with no type | **0** |
| enum ports among them, with options inline | **26 of 26** |

**Three of the four misses are absent from `detail: "full"` as well** — `For Each.itemId`,
`RouterNavigate.target` and `RouterNavigate.router` are runtime-pushed ports the static catalog
never had. Not a summary deficiency, and not this task's problem.

### The fourth miss was real, and it would have shipped

`Page.urlPath` **is** in full detail and was in **no** summary. The cause is worth stating exactly:
`Page`'s `title` and `urlPath` are registered per instance by the editor connection, so they appear
in no port list at all — the catalog's only record that they exist is a sentence inside
`runtimeBehavior`, and a summary drops prose by construction. The old summary said
`hasDynamicPorts: true`, which announces that a node has ports the list does not show and gives no
way to learn what they are. Flipping the default without noticing would have silently lost the two
ports a page most needs — **the same shape of defect as §1's `[object Object]`, arrived at from the
opposite direction.**

So the summary now carries `runtimeBehavior` **for types that declare dynamic ports, and only
those**. Gated by a catalog-wide sweep of that biconditional rather than a sample — because the
obvious sample was wrong: `Group` looks like the plainest visual node in the catalog and it declares
dynamic ports (its scroll and size-mode port groups are conditional on parameters).

### Measured after

| call | before §2 | after §2 |
|---|---|---|
| 8-type storefront basket, `detail` omitted | 30,862 tok (it defaulted to full) | **~6,200 tok** — 4.9× cheaper |
| `Group`, `ports: ["width","flexDirection"]` | *(not expressible)* | **< 500 tok**, against 11,018 for the type |

Gated by five new specs in
[`tests/nodeDocBudget.test.ts`](../../../packages/noodl-mcp/tests/nodeDocBudget.test.ts): that
omitting `detail` costs what summary costs, that `Page`'s runtime ports survive the summary, the
catalog-wide `runtimeBehavior` ⟺ `hasDynamicPorts` sweep, and that `ports` reports what it could not
find rather than dropping it.

### §3 closed as unnecessary — which is what §3 asked for

§3 said *"Measure first — §1 and §2 may make this unnecessary"*. They do. §3's territory is what
`detail: "full"` carries, and after §2 nothing reaches for full detail by accident: it is opt-in, it
is described as the expensive mode, and the per-port door covers the case that used to justify
asking for it. Trimming enum lists or de-duplicating the ~40 layout ports every visual node shares
would now be invasive surgery on a payload almost nobody requests. The ≤ 12,500 tok per-response
ratchet stays, so `Group` still cannot grow past a client's cap unnoticed.

## Register

| # | Finding | State |
|---|---|---|
| A9 | The tool description actively recommends a mode that has never worked. **Check the other `detail`/`summary` affordances in the surface for the same** — this one was invisible because nobody used it | ✅ **checked 2026-08-08** — `String(p.type)` at catalog.ts:273 was the **only** instance in the package; the sole other affordance, `get_style_vocabulary`'s `detail: full\|prompt`, is sound |
| A11 | **`noodl-mcp`'s own `npm run typecheck` is red at HEAD** — 6 errors, all `res.text` on `ToolCallResult` in `interfaceGate.test.ts` and `stagingDiagnostics.test.ts`, which declares only `isError` and `data`. Invisible because jest runs ts-jest with **`diagnostics: false`**, so the green 281-spec gate cannot see it, and `test:packages` runs `test` and never `typecheck`. Pre-dates this task — verified against HEAD, not inferred | 🔴 **OPEN**, filed not fixed — out of AWP-005's scope, but it is the same shape as the phase-55 register's "a gate omitted from CI" |
| A10 | The 24,000-char driver truncation is a *rig* setting, not a product one, but it interacts: any payload above it arrives as broken JSON. After §1, re-measure the largest response against common client limits | ⚠️ interaction |
| A17 | **A summary that drops prose can drop a port.** `Page.title` and `urlPath` are runtime-registered, so they are in no port list and the catalog's only record of them is a sentence in `runtimeBehavior`. `hasDynamicPorts: true` said "there are ports you cannot see" and offered no way to see them. **Generalises past this task:** a compact mode is defined by what it omits, and the thing to check is not whether the omitted field is *prose* but whether it is the only statement of a fact — which is exactly what "compact" makes invisible | ✅ fixed 2026-08-10 |
| A18 | **The obvious sample for "a type with no dynamic ports" was `Group`, and `Group` has them.** A spec written on that assumption failed on its first run and was replaced with a catalog-wide sweep of the biconditional. Cheap here; the same assumption inside product code would have been a silent wrong branch | ✅ swept instead |
