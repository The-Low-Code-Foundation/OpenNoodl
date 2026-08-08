# AWP-005 — The node-doc budget: `Group` costs 11,000 tokens

**Status:** 📋 open · **Track: the context** · out of **F44** · Richard asked for this directly:

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

## Register

| # | Finding | State |
|---|---|---|
| A9 | The tool description actively recommends a mode that has never worked. **Check the other `detail`/`summary` affordances in the surface for the same** — this one was invisible because nobody used it | 📋 to check |
| A10 | The 24,000-char driver truncation is a *rig* setting, not a product one, but it interacts: any payload above it arrives as broken JSON. After §1, re-measure the largest response against common client limits | ⚠️ interaction |
