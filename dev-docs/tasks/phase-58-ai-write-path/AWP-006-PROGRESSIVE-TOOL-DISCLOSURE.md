# AWP-006 — 22,968 tokens before the model reads the brief

**Status:** 📋 open · **Track: the context** · **F37**, measured in session 6 and unchanged in session
8 · supersedes [LAS-013](../phase-55-llm-authoring-support/LAS-013-SMALL-MODEL-HEADROOM.md) §2

## The number, and that it has not moved

Write-mode `noodl-mcp` advertises **89 tools**. As OpenAI function schemas that is **100,512
characters**, plus **2,852 characters** of server instructions, sent on **every single turn**.

Turn one of the session-8 replays billed **22,968 prompt tokens** — tools, instructions, and a
1,235-character brief. Identical to session 6's measurement (`tools=89 schemaChars=100512`), so
nothing has drifted and the number can be trusted.

**F37 measured that 60 of the 89 tools and 63% of the schema bytes are backend admin** — a storefront
brief touches none of them.

## What it costs, on real runs

Because the surface is resent every turn, the cost is `floor × turns` regardless of what the model does:

| run | turns | billed input | fixed floor | share |
|---|---|---|---|---|
| DeepSeek V4 Pro | 60 | 4,410,622 | 1,378,080 | **31%** |
| Kimi K3 (run 2) | 57 | 5,725,954 | 1,309,176 | **23%** |
| Kimi K3 (run 1, void) | 34 | 2,716,964 | 780,912 | **29%** |

**Roughly 30% of every agent-authoring bill is a tool list, most of which is for a subsystem the task
never touches.**

## The premise that changed since LAS-013

LAS-013 filed this as *headroom for small models* — the 27B's 32k window could not hold the surface at
all, and F36's model was locked out entirely. **Session 8 removed that framing:** both DeepSeek V4 Pro
and Kimi K3 have **1,048,576-token** contexts, so the surface fits with enormous room to spare and
neither was blocked by it.

**So this is no longer a capability problem. It is a cost problem, and it applies to every client at
every size** — including Claude, which only escapes it because the `claude` CLI defers tools behind
its own search step (haiku's session-1 transcript opens with **11** `ToolSearch` calls). That is why
"the same surface" was never the same surface across the matrix's rows, and why sonnet's pass is not
evidence that the surface is fine.

## The fix

### §1 Serve a task-shaped surface, not the whole catalogue

The 89 tools are not one audience. Authoring a page needs the graph, catalog and render tools;
provisioning a backend needs the backend admin set; neither needs the other. Options, cheapest first:

- **Server-side profiles.** The server already takes `--allow-writes`; a `--profile authoring` that
  advertises the authoring set and omits backend admin is a small change with most of the win.
  ⚠️ **The backend tools must remain reachable** — an app with `Record` nodes genuinely needs them,
  and `provision_backend` is deliberately not a plan operation. A profile that makes them
  unreachable trades a cost problem for a capability problem.
- **Progressive disclosure.** One `find_tools` entry point plus a small core, the rest fetched on
  demand — the shape the `claude` CLI already uses, and the reason the Claude rows never met F37.
  More work; also the only option that scales as the surface grows.
- **Schema slimming.** Independent of both, and worth measuring first: 100,512 characters over 89
  tools averages 1,130 characters per tool. Some of that is prose that belongs in one place rather
  than repeated per tool.

**Recommend measuring the split before choosing.** If backend admin is 63% of bytes, a profile alone
gets the floor to roughly 8,000 tokens, which is most of the available win for a fraction of the work.

### §2 Do not break the two rules the matrix depends on

⚠️ **Narrowing the surface is an operator intervention the baselines did not get.** LAS-010 recorded
this deliberately: the driver's `--tools` flag can already narrow the surface and was **not** used for
the acceptance runs, because comparability was the point.

So: **if this task changes the served surface, re-run all rows rather than comparing across surfaces**
— LAS-010's own instruction, and it now has teeth, because a 29% cost cut would otherwise look like a
model improvement.

⚠️ **A tool the model cannot see is a capability the product does not have.** The failure mode to
watch is not cost, it is a model that never provisions a backend because it never knew it could. Any
disclosure scheme must be checked against a brief that *needs* the hidden half — an app with `Record`
nodes and auth — not only against the storefront.

## The combined target

With AWP-005, modelled against the two runs' actual per-turn bills:

| | billed today | tool-surface lever | node-doc lever | would bill | cut |
|---|---|---|---|---|---|
| DeepSeek V4 Pro | 4.41M / $5.73 | −898k / $1.17 | −381k / $0.50 | 3.13M / **$4.07** | **29%** |
| Kimi K3 | 5.73M / $16.32 | −853k / $2.43 | −796k / $2.27 | 4.08M / **$11.62** | **29%** |

Conservative — it assumes the same documents are still read and the same number of turns taken.

## Acceptance

- `--list-tools` reports the authoring surface under **8,000 tokens** including server instructions.
- Every backend tool remains reachable in the mode a backend app needs, and there is a fixture brief
  that exercises it.
- Turn-one prompt tokens on a replay drop from 22,968 to under 10,000, measured on the wire the same
  way F37 was.
- A replay of the storefront brief on DeepSeek V4 Pro (the cheapest complete builder, $5.83) after
  AWP-005 and AWP-006, with the new numbers recorded beside session 8's row and the surface change
  named — per LAS-010's re-run rule.

## Register

| # | Finding | State |
|---|---|---|
| A11 | LAS-013 §2 filed this as a small-model capability problem. **1M-context models make it purely a cost problem**, which changes the fix from "make it fit" to "stop paying for it" | ✅ premise corrected, session 8 |
| A12 | The `claude` CLI has always deferred tools behind `ToolSearch`, so **no Claude row in the matrix has ever met the surface a plain MCP client gets**. Any cross-rig comparison must say so | ⚠️ standing caveat |
