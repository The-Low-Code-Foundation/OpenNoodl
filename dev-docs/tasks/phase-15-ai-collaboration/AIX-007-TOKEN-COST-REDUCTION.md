# AIX-007: Token Cost Reduction — Caching, Effort, Routing, and Honest Accounting

## Metadata

| Field | Value |
|-------|-------|
| **ID** | AIX-007 |
| **Phase** | Phase 15 — AI Collaboration (Revival Track C) |
| **Priority** | 🟠 High (per-generation cost is a positioning claim, not just a bill) |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | ~1 week |
| **Prerequisites** | None hard. AIX-001 (client/adapters) and AIX-002 (authoring loop + measurement harness) are shipped and are what this task edits |
| **Branch** | `task/aix-007-token-cost` |
| **Recommended executor** | 🟠 **Opus 4.8** — mechanical changes with an unusually sharp feedback loop (the harness already measures the target metric), but the prefix reordering touches prompt structure that AIX-002 measured at 8/8 validity, so "don't regress quality while cutting cost" needs judgment. |

## Objective

Cut per-generation API cost on the authoring loop without measurably degrading output quality, and make the cost we report to ourselves and to users actually correct.

Target: **≥30% reduction in mean cost per authored component** against the AIX-002 slice-5 baseline, with first-attempt validity holding at 8/8 on the same corpus.

## Background

AIX-002 slice 5 measured the loop live against real providers, so this task starts with a real baseline rather than a guess ([AIX-002-NOTES.md §Slice 5](./AIX-002-NOTES.md), raw JSONL in [measurements/](./measurements/)):

| Model | n | Mean turns | Mean prompt tok | Mean completion tok | Mean $/component |
|---|--:|--:|--:|--:|--:|
| `claude-sonnet-5` | 8 | 2.6 | 26,767 | 4,501 | $0.148 |
| `claude-opus-4-8` | 3 | 2.0 | 16,154 | 1,379 | $0.115 |

Two properties of that baseline decide what is worth optimising:

- **Input dominates.** For `hello-cta`: 15,970 prompt tokens against 831 completion tokens — **79% of spend is input**. Anything that reduces re-sent input beats anything that shrinks the emitted artefact.
- **Cost is superlinear in turns**, because every turn re-sends the whole conversation. 2 turns → 15,970 prompt tokens; 4 turns → 64,350. The `article-list` session alone was $0.542 of the $1.183 corpus total.

A cost review of the shipped code found four specific, unexploited levers. None of them is "send less context" — the context system is already doing the hard part (the 1,034,585-byte [node-catalog.json](../../../packages/noodl-types/src/node-catalog.json) reaches the model as a 2,067-char overview plus on-demand type detail, a ~500× compression). The waste is in *how we call the API*, not in what we decide to say.

## Current State

### 1. No prompt caching anywhere

[`anthropic.ts:243`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/providers/anthropic.ts#L243) sets `params.system = system` as a plain joined string. There is no `cache_control` in the AI client, either provider adapter, or any prompt builder. Every turn pays full input price for a prefix that is byte-identical to the previous turn's.

### 2. The opening message is ordered cache-hostile

[`prompts/authoring.ts:104-121`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/prompts/authoring.ts#L104-L121) builds `initialUserMessage` as one string in this order:

```
Build a new component at "<path>".
What it should do:
<request.description>          ← VARIES per request
--- PROJECT OVERVIEW ---       ← stable per project
--- NODE CATALOG ---           ← stable globally
--- STYLE VOCABULARY ---       ← stable per project
```

The one part that changes on every request sits **in front of** everything stable. Caching is a prefix match, so this ordering defeats a breakpoint even if one were added. `updateUserMessage` has the same shape with `currentComponentSource` also ahead of the stable blocks.

### 3. Adaptive thinking runs at default effort, uncapped

[`anthropic.ts:254-256`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/providers/anthropic.ts#L254-L256) sets `thinking: { type: 'adaptive', display: 'omitted' }` and never sets `output_config.effort`, so every call runs at the API default of `high`. The cost of that is visible in the measurements: `article-list` billed **23,254 completion tokens while emitting 2,486 chars of visible payload** — essentially all reasoning — and took 266s against a 7–50s norm.

### 4. Cost accounting cannot see cache tokens, and one price is stale

`AiUsage` ([`client/types.ts`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/types.ts)) carries only `promptTokens` / `completionTokens`, and [`usage.ts`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/providers/usage.ts) multiplies those by flat registry rates. Once caching lands, cache reads bill at ~0.1× and cache writes at ~1.25× — so **adding caching without extending accounting would make our own cost telemetry wrong**, in the flattering direction. Separately, the registry prices `claude-sonnet-5` at $3/$15 ([`models.ts:102-109`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/models.ts#L102-L109)); introductory pricing is $2/$10 through 2026-08-31.

### 5. Default model is the expensive tier

`claude-opus-4-8` carries `isDefault: true` ([`models.ts:91-100`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/models.ts#L91-L100)) at $5/$25. On the three prompts both models ran, Sonnet 5 was cheaper at identical validity (3/3 first-attempt each): $0.302 vs $0.346. Not a large gap, but the default is currently set to the pricier side of a tie.

## Desired State

- The stable prefix (system prompt + catalog overview + project overview + style vocabulary) is **cacheable and actually cached**, verified by non-zero `cache_read_input_tokens` on turn 2 of every multi-turn session.
- Opening messages are ordered **stable-first, variable-last**, in both create and update mode.
- Reasoning depth is a **deliberate setting per call site**, not an inherited default — with the authoring loop's value chosen by measurement rather than assumption.
- `AiUsage` reports cache-read and cache-write tokens, `calculateCostUsd` prices them correctly, and registry prices are current.
- The default model is the cheapest tier that holds first-attempt validity on the corpus.
- The harness reports cost per component as a first-class metric, so this is re-checkable in one command forever.

## Scope

### In Scope

- [x] `cache_control` support in the Anthropic adapter: system as a block array with a breakpoint, plus a breakpoint on the growing conversation prefix
- [x] Reorder `initialUserMessage` / `updateUserMessage` to stable-first; split the opening turn into content blocks so a breakpoint can sit at the stable/variable boundary
- [x] `output_config.effort` plumbed through `AiChatRequest` → adapter, with a measured default for the authoring loop
- [x] `AiUsage` extended with `cacheReadTokens` / `cacheWriteTokens`; `calculateCostUsd` updated; registry prices refreshed
- [x] Model default re-decided on measured evidence
- [x] Harness: report cost/component, cache-hit rate, and effort in the JSONL; an `--effort=` flag for sweeps
- [x] A/B verification against the slice-5 baseline, recorded in the As-Built section

### Out of Scope

- **Shrinking the context handouts.** The budget system is measured at ~22% utilisation; the problem is repetition, not volume. Do not touch `ContextBuilder`'s handout sizes.
- **Reducing turn count by weakening the validity gate.** The gate is why the loop is cheap; 8/8 first-attempt is the asset.
- **OpenAI/Ollama cache parity.** Anthropic first (it is the default provider and the measured one). Leave the seam provider-agnostic; do not build the others speculatively.
- **MCP server token cost** (SUB-008) — those tokens are spent in the *user's* agent (Claude Code/Desktop), not by us. Worth a note, not work.
- **Explain mode / review** call sites — same client, so they inherit the adapter-level wins for free. Do not restructure their prompts in this task.

## Implementation Steps

1. **Lock the baseline.** Re-run the slice-5 harness unchanged and archive the JSONL. Every later claim is measured against *this* run, not against the numbers in the table above (provider-side model behaviour drifts).
2. **Accounting first, before any optimisation.** Extend `AiUsage` + `calculateCostUsd` + refresh registry prices. Doing this first means every subsequent step is measured by an instrument that is already correct — and it is the step that prevents optimistic self-reporting.
3. **Reorder the opening messages** (stable-first). Re-run the harness. This step alone changes no cost; it must show **no validity regression** before caching is layered on, or the reorder and the caching become confounded.
4. **Add `cache_control`** in the adapter: one breakpoint at the end of the stable prefix, one on the last block of the most recent turn. Respect the 4-breakpoint cap and the 20-block lookback. Verify with `cache_read_input_tokens > 0` on turn 2.
5. **Sweep effort** (`low` / `medium` / `high`) over the full corpus. Pick the lowest level that holds 8/8 first-attempt validity. Record the sweep table — the rejected levels are the evidence.
6. **Re-decide the default model** on the sweep results.
7. **A/B and record**: baseline vs optimised, on cost, validity, turns, and latency.

## Success Criteria

- [x] Mean cost per authored component drops **≥30%** — **82.0%** ($0.1954 → $0.0352); 31.7% from caching alone vs the step-1 baseline on the same 8-prompt corpus
- [x] No prompt regresses from valid to invalid — the re-measured baseline was **7/8** (`article-list` exhausted); the shipped config reaches **8/8**
- [x] `cache_read_input_tokens > 0` on turn 2+ of every multi-turn session — 8/8, asserted by the harness
- [ ] Reported `costUsd` matches the provider's own billed figure — **NOT VERIFIED**, needs console access (residual in AIX-007-NOTES.md)
- [x] The `article-list` outlier's completion tokens drop materially — 32,256 → **3,376** (−90%), and it goes from exhausted to first-attempt valid
- [x] Cost/component and cache-hit rate are in the harness JSONL and re-runnable in one command

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Prefix reordering degrades output quality — the request now arrives *after* a large context block | This is the real risk of the task. Step 3 isolates it: reorder alone, re-run, compare validity **before** caching lands. If quality drops, keep a short restatement of the task at the tail of the opening turn (cheap, and the cache boundary sits before it). |
| Lower effort degrades the hard prompts specifically | Sweep on the **full** corpus, not a spot check. `article-list` and `pill-row` are the sensitive ones; judge on those. Per-call-site effort is supported by design, so the loop can differ from explain mode. |
| Caching silently does nothing (a stray varying byte in the prefix) | Assert on `cache_read_input_tokens` in the harness output, not on cost alone. A cost drop can come from elsewhere; a non-zero cache read cannot. |
| Cache-token accounting lands wrong and flatters the result | Step 2 puts accounting before optimisation, and a success criterion checks our number against the provider's billed number. |
| Short sessions limit the payoff (2–3 turns, 5-minute TTL) | Real, and it bounds the win — most of the gain is turn 2 re-reading turn 1, plus consecutive authoring in one project. Do not reach for the 1-hour TTL to chase it: at 2× write cost it needs ≥3 reads to break even, which this traffic shape will not reliably deliver. |
| Registry price refresh goes stale again | The prices are already a maintenance liability; note the intro-pricing expiry (2026-08-31) in a comment beside the entry. |

## References

- [AIX-002-NOTES.md](./AIX-002-NOTES.md) §Slice 5 — the measured baseline and the harness
- [measurements/](./measurements/) — raw per-session JSONL (token counts, cost, transcripts)
- `packages/noodl-editor/scripts/aix002-measure/` — the harness this task extends
- AIX-001 (client, adapters, model registry), AIX-006 (style vocabulary, the newest context handout)
- `shared/prompt-caching.md` conventions: prefix-match invariant, 4-breakpoint cap, 20-block lookback, cache-read verification

## Checklist

- [x] Baseline re-run archived
- [x] Usage accounting extended; prices refreshed
- [x] Opening messages reordered; no-regression run recorded
- [x] `cache_control` landed; cache reads verified non-zero
- [x] Effort sweep recorded; default chosen (`low`)
- [x] Default model re-decided (`claude-sonnet-5`)
- [x] A/B recorded in As-Built; CHANGELOG
