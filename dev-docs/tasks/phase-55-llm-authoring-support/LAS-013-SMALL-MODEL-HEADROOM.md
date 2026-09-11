# LAS-013 — Headroom for small models: the refactor cliff and the 89-tool door

**Status:** 📋 open · **Track 4 (models)** · out of LAS-011's session-6 open-weight run
(**F40**, **F37**) · this is the task that decides whether the phase's claim is *"any competent
LLM"* or *"any competent LLM with a large context and a strong refactoring hand"*

## What session 6 measured

`Qwen/Qwen3.5-27B` (open weights, hosted on DeepInfra) replayed the storefront brief cold through
the new MCP driver. It is **not** a tool-calling failure — LAS-011's contingency did not trigger:

- It opened exactly as sonnet did: `get_project_info` → `get_style_vocabulary` → `create_plan`.
- It planned a sensible component tree.
- It recovered from ordinary rejections the way the phase predicts — `Columns` →
  `net.noodl.visual.columns` after an `unknown-node-type`, parameter-encoding fixes after
  `unknown-parameter`.

It then stopped at turn 32 with **one component built**, having had **16 of its 31 calls rejected**,
and wrote — unprompted, in its final message:

> *"the strict validation rules (particularly the `repeated-sibling-subtree` rule) are preventing
> the page from being saved. The validator requires that repeated structures be factored into
> components or driven from data…"*

It saw **19** `repeated-sibling-subtree` diagnostics. It could state the rule. It could not perform
the refactor the rule demands. **That is a capability finding on the model's own words**, which is
as good as transcript evidence gets.

**The gate is not wrong.** LAS-004 promoted that warning to authored-blocking on the strength of
haiku and sonnet recovering from it, and both cleared it again in this very session (5 hits and 3
hits). LAS-011's standing instruction is explicit and this task obeys it:

> *a mid-tier model looping forever on a now-blocking rejection is a capability finding that argues
> for smaller turns or more of LAS-007's attachments — **not** for weakening the gate.*

## Two problems, one population

### 1. The refactor cliff (F40)

"Three identical Groups" → "one component plus a repeater over data" is a **multi-step
transformation**: invent a component, decide its interface, move the subtree, replace the siblings
with instances or a `For Each`, author the data. The rejection asks for all of it in one turn. A
strong model does it; a 27B model reads the rejection, agrees with it, and cannot execute it.

Things to test rather than assume — in this order, cheapest first:

- **A worked fix in the rejection, not a recipe reference.** `repeated-sibling-subtree` already
  attaches `data-static-array-filter-repeater` (4 of qwen's 16 rejections carried a recipe) and it
  was not enough. Try attaching the *specific* rewrite: here are your three siblings, here is the
  component to make, here are the ports, here is the repeater.
- **A tool that performs the refactor.** `extract_component(component, nodeIds, name)` — structure
  over gate, the phase's own preference order. This is the strongest candidate and probably the
  real answer: the model does not have to be able to *do* the refactor, only to *ask for* it.
- **Smaller turns.** Accept a component with the repetition, then require the fix as a follow-up
  operation, so the model is never asked to hold "author it" and "factor it" at once.

### 2. The 89-tool door (F37)

Measured on the wire, not estimated: **turn one of the open-weight run billed 27,322 prompt
tokens** — 89 tool schemas (100,512 chars) plus 2,855 chars of server instructions plus a
1,235-char brief. **60 of the 89 tools and 63% of the schema bytes are backend admin** that a
storefront brief never touches.

Consequences, both real:

- **Any 32k-context client is locked out**, before it reads a word of the task. That includes the
  model this phase originally chose (F36).
- **It is resent every turn.** Qwen's 32-turn run billed **2.19M input tokens** — most of it the
  same tool list, over and over.
- The baselines never met this, because the `claude` CLI defers tools behind `ToolSearch` (haiku's
  session-1 transcript opens with **11** `ToolSearch` calls). A plain MCP client has no such thing.

The audit already named progressive disclosure and rated it *"mild yes for weak models… low
priority"* because no replay failure traced to catalog overload. **That rating is now out of date:**
it was made before any small-context client had ever been pointed at the server. Candidate shapes,
to be chosen on evidence:

- Register the ~50 backend-admin tools only when the project actually has a backend, or behind an
  explicit opt-in flag. Cheapest, and it removes 63% of the payload for a page-building session.
- A `--tools=authoring` server mode.
- A genuine search/disclose pair, the shape the `claude` CLI already proves works.

⚠️ Whatever is chosen must not quietly change the surface the acceptance runs were scored against —
re-run and re-score, or the matrix stops meaning anything.

## Acceptance

- A cold replay on a **mid-tier open-weight model** produces an architecturally correct page: the
  phase's own success line, still unmet.
- The tool payload for a page-building session measured before and after, in tokens on the wire.
- If the refactor cliff cannot be closed for a 27B model, that is **accepted with a written reason**
  and the README's claim narrows honestly — to the model class that actually works, named.

## Register

| # | Finding | State |
|---|---|---|
| F40 | LAS-004's authored-blocking `repeated-sibling-subtree` is a wall for a 27B model; it stopped at turn 32 and named the rule | 🔴 OPEN — this task, §1 |
| F37 | 89 tools = 27,322 prompt tokens on turn one, 63% of it backend admin; locks out every 32k-context client and is resent every turn | 🔴 OPEN — this task, §2 |
