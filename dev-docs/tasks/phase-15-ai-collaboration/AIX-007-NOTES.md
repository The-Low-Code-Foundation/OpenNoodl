# AIX-007 — As-Built Notes

**Status:** in progress · **Date:** 2026-07-26 · **Branch:** `cline-dev`

Cutting per-generation API cost on the authoring loop without degrading output
quality, and making the cost we report to ourselves correct.

---

## Step 1 — the baseline, re-measured

The spec's opening instruction was to re-run the slice-5 harness unchanged
rather than trust the numbers in the task doc, "because provider-side model
behaviour drifts". It did, and the re-measurement changed the target.

`measurements/aix007-step1-baseline-sonnet-5.jsonl` — `claude-sonnet-5`, the
full 8-prompt corpus, code unmodified, 480s per-session timeout:

| | AIX-002 slice 5 (2026-07-25) | AIX-007 step 1 (2026-07-26) |
|---|--:|--:|
| First-attempt valid | 8/8 | **7/8** |
| Mean $/component | $0.148 | **$0.1954** (repriced, see below) |
| Mean turns | 2.6 | 3.5 |
| Total output tokens | — | 69,785 |

**`article-list` no longer completes at all.** It ran 8 turns, made *zero*
submissions, burned 34,987 output tokens, and hit the 480s wall. On its own it
was $0.71 of the run's $1.56 — 45% of the corpus cost for a component that was
never produced. The spec predicted this prompt would be the sensitive one; it
turned out to be worse than predicted.

Reading its transcript names the failure exactly. Six documentation reads (one
of them a 26KB component), and then **two assistant turns with empty text and
no tool call at all**:

```
assistant len=0 tools=['get_node_types']   ×4, interleaved with tool results
assistant len=0 tools=[]                   ← nudge fires
assistant len=0 tools=['get_node_types']   ×2 more
assistant len=0 tools=[]                   ← second nudge → exhausted
```

34,987 completion tokens produced *zero* visible characters and zero tool
calls. With `display: 'omitted'`, that entire spend is reasoning. This is the
spec's diagnosis ("essentially all reasoning") in a more advanced state: the
model is not producing a bad component, it is thinking itself out of acting.
That makes it the sharpest available test of the effort hypothesis rather than
just the most expensive prompt.

So the success criterion "first-attempt validity holds at 8/8" is not
achievable against *this* baseline, and the spec anticipated exactly that by
insisting later claims be measured against the step-1 run. **The criterion this
task is held to is therefore: no prompt regresses from valid to invalid**
(7/8 held), with recovering `article-list` as an upside rather than a given.

### A note on the price correction

The registry priced `claude-sonnet-5` at $3/$15; the correct figure today is
$2/$10 (introductory, through 2026-08-31). Correcting it lowers every reported
cost by a third — which would look like a third of the target met for free.

It is not counted. `scripts/aix002-measure/analyse.mjs` re-prices **both** arms
from their raw token counts under one current table, so the baseline above is
already stated at $2/$10 and the reduction below is entirely from caching and
effort. The as-recorded figure in the step-1 JSONL is $0.2931/component at the
old prices; the instrument, not the result, is what changed.

---

## What was built

### 1. Cache-token accounting, before any optimisation

`AiUsage` gained `cacheReadTokens` and `cacheWriteTokens`, and
`calculateCostUsd` prices them at their own multipliers off the input rate
(`CACHE_READ_MULTIPLIER` 0.1, `CACHE_WRITE_MULTIPLIER` 1.25 — the 5-minute TTL;
the 1-hour TTL doubles the write and needs three reads to break even, which
this traffic shape does not deliver).

Two decisions worth recording:

- **`promptTokens` stays wire-faithful.** Anthropic reports the *uncached
  remainder* in `input_tokens` and the cached tokens in their own fields. We
  keep that split rather than folding them together, so the three fields never
  overlap and the cost function adds three independent terms instead of
  subtracting. The cost of that choice is that `promptTokens` **drops sharply**
  the moment caching is on, for no reason related to what was sent — so
  `totalPromptTokens(usage)` exists, and the harness reports it. Comparing raw
  `promptTokens` across the A/B would flatter the result by ~90%.
- **Zero is an answer, not a gap.** The fields are required, not optional, and
  a provider that does not cache reports zeroes. Optional fields would have
  spread `?? 0` through every consumer and made "we didn't measure" and "there
  was no cache" indistinguishable.

### 2. Opening turns reordered stable-first

`initialUserMessage` / `updateUserMessage` now return an `OpeningTurn`
(`content` + `cacheBoundary`) instead of a string, ordered:

```
Reference material for this project. Your task is at the END of this message…
--- PROJECT OVERVIEW ---     ┐
--- NODE CATALOG ---         ├─ stable: identical for every component in a project
--- STYLE VOCABULARY ---     ┘
                             ← cacheBoundary
--- YOUR TASK ---
Build a new component at "…" / Revise the existing component "…"
[update mode: --- CURRENT COMPONENT --- …]
What it should do: <description>
```

In update mode the current component source moved from *ahead of* the
reference blocks to *after* the boundary — it is per-request data, and leaving
it in front would have made the shared prefix unreachable for every update.

The risk the spec flagged (the request now arriving after a large context
block) is handled by the lead-in sentence pointing at the tail, and by the task
being last — which is also the strongest recency position. No mitigation
restatement was needed; see the validity results below.

### 3. `cache_control` in the Anthropic adapter

Three breakpoints, against a hard cap of four:

1. **End of the system prompt.** Anthropic renders `tools` → `system` →
   `messages`, so one marker here covers the tool definitions too.
2. **End of the opening turn's reference blocks**, from the `cacheBoundary`.
3. **End of the newest turn** — the growing conversation prefix. This is what
   makes turn N+1 read turns 1..N.

The breakpoint count is **budgeted, not checked afterwards**: an over-budget
request is a 400 with no partial success to fall back on. `toAnthropicMessages`
takes a `maxBoundaries` cap and `buildParams` reserves one marker for system
and one for the newest turn.

> A spec caught a real defect here. The first implementation guarded only the
> newest-turn marker and let the mapper split every boundary-carrying turn it
> found — four such turns produced five markers and would have been rejected
> outright by the API. The authoring loop only ever sets one boundary, so no
> live run would have found it.

The `cacheBoundary` field is a **hint, not an instruction**: providers without
prefix caching ignore it and send the turn whole. Splitting changes how a
request is billed, never what it says — a spec asserts the two halves
concatenate back to the original bytes.

### 4. `output_config.effort`

`AiChatRequest.effort` (`low` … `max`) is plumbed to `output_config.effort`,
gated on a new `capabilities.effort` flag so it is never sent to a model that
would reject it. The authoring loop passes `AUTHORING_EFFORT` explicitly rather
than inheriting: unset means Anthropic's default of `high`, which is the
expensive end of the range and was not a decision anybody had made.

---

## Steps 3–4 — reorder + caching, measured at the baseline's effort

`measurements/aix007-cached-sonnet-5-effort-high.jsonl`. Run at `--effort=high`
**deliberately**: `high` is Anthropic's default, which is what the baseline
inherited, so this arm changes the prompt ordering and the caching and nothing
else.

| | baseline | + reorder + caching |
|---|--:|--:|
| Mean $/component | $0.1954 | **$0.1024 (−47.6%)** |
| First-attempt valid | 7/8 | 7/8 — no prompt regressed |
| Cache hit rate | 0% | 76.1% |
| Cache verified (turn 2+) | 0/8 | **8/8 multi-turn sessions** |
| Mean turns | 3.50 | 2.75 |
| Output tokens | 69,785 | 59,168 |
| Mean latency | 106s | 94s |

The spec's step-3 concern — that moving the request behind a large context
block would degrade quality — did not materialise: every prompt that was valid
on the first attempt before still is.

### Decomposing the win, so the claim survives scrutiny

The candidate used fewer turns and fewer output tokens, which caching cannot
cause: identical bytes reach the model either way. Re-pricing the candidate's
own token counts *as if nothing were cached* separates the two:

| | $/component | share |
|---|--:|--:|
| Baseline | $0.1954 | |
| Candidate, priced with no caching | $0.1499 | −23.3% ← behaviour |
| Candidate, priced with caching | $0.1024 | −31.7% ← caching |
| | | **−47.6% combined** |

**The caching mechanism alone clears the ≥30% target.** The behavioural 23.3%
is real money but weaker evidence: one run per arm, so it is some mix of the
reorder genuinely helping (the task is now last, labelled `--- YOUR TASK ---`,
in the strongest recency position) and ordinary run-to-run variance. The
headline claim rests on the part that is measured exactly, from the provider's
own cache-token fields, not inferred from a cost delta.

---

## Step 5 — the effort sweep

Full corpus at each level, caching on, `claude-sonnet-5`. The rejected levels
are the evidence, so all three are kept in `measurements/`.

| Effort | $/component | vs baseline | First-attempt valid | Output tok | Mean turns | Mean latency |
|---|--:|--:|--:|--:|--:|--:|
| *baseline (uncached, inherited `high`)* | $0.1954 | — | 7/8 | 69,785 | 3.50 | 106s |
| `high` | $0.1024 | −47.6% | 7/8 | 59,168 | 2.75 | 94s |
| `medium` | $0.0809 | −58.6% | 7/8 | 41,980 | 3.00 | 74s |
| **`low`** | **$0.0352** | **−82.0%** | **8/8** | **11,957** | **2.25** | **16s** |

**`low` wins on every axis at once**, which is not the trade-off the spec
expected to find. It is not merely the cheapest level that held validity — it
is the only level that reached 8/8, and it did so while being 6.6× faster.

The decisive case is `article-list`, the prompt the spec named as sensitive:

| | `high` | `medium` | `low` |
|---|---|---|---|
| Outcome | exhausted, 480s wall | exhausted, 480s wall | **authored, first attempt** |
| Turns | 7 | 7 | 3 |
| Output tokens | 32,256 | 31,417 | **3,376** |

At `high` and `medium` this prompt burns ~32k reasoning tokens across seven
turns and **never submits anything**. Its transcript is a run of documentation
reads separated by five-figure thinking spends, ending in an assistant turn
with no text and no tool call. At `low` it reads what it needs, submits, and
passes the gate on the first attempt.

So the spec's success criterion — *"the `article-list` outlier's completion
tokens drop materially, or the spec records why `high` effort is worth
keeping"* — resolves the first way, by 90%.

The reading: above `low`, the model spends its budget deliberating instead of
acting, and the loop's turn budget runs out before its reasoning does. The
validation gate is what makes a first attempt good; extra thinking ahead of
that gate was buying nothing the gate wasn't already providing.

**Chosen: `AUTHORING_EFFORT = 'low'`.** The honest caveat is in the residuals.

## Step 6 — the default model

Same corpus, same effort, same caching — only the model changes:

| Model (`--effort=low`) | $/component | First-attempt valid | Mean turns | Mean latency |
|---|--:|--:|--:|--:|
| `claude-opus-4-8` *(was the default)* | $0.0923 | 8/8 | 2.13 | 23s |
| **`claude-sonnet-5`** | **$0.0352** | 8/8 | 2.25 | 16s |

Validity is a tie at the ceiling, so the tie is broken on cost: Sonnet is
**2.6× cheaper and faster**, and `isDefault` moved to it. Opus remains in the
registry, one click away in Editor Settings.

Worth noting for anyone tempted to reach for a bigger model: **Opus at `low`
($0.0923) still costs less than Sonnet at `high` ($0.1024), and beats it on
validity.** On this workload the effort setting matters more than the model
tier — which is an argument for measuring the knob before paying for the tier.

## Step 7 — A/B against the step-1 baseline

Baseline vs the shipping configuration (`claude-sonnet-5`, caching on,
`effort: low`), both priced under the same current table:

| | Baseline | Shipped | |
|---|--:|--:|---|
| **Mean $/component** | $0.1954 | **$0.0352** | **−82.0%** |
| First-attempt validity | 7/8 | **8/8** | improved |
| Prompts regressed valid → invalid | — | **0** | |
| Cache hit rate | 0% | 73.2% | |
| Cache verified on turn 2+ | 0/8 | **8/8** | |
| Total input tokens | 432,662 | 198,672 | −54% |
| Total output tokens | 69,785 | 11,957 | −83% |
| Mean turns | 3.50 | 2.25 | |
| Mean latency | 106s | **16s** | 6.6× faster |

Against the spec's success criteria:

- ✅ **≥30% cost reduction** — 82%, and 31.7% from the caching mechanism alone
  even if the behavioural improvement is credited entirely to variance.
- ✅ **Validity holds; no prompt regresses** — 7/8 → 8/8.
- ✅ **`cache_read_input_tokens > 0` on turn 2+ of every multi-turn session** —
  8/8, asserted by the harness (`cacheStats.cacheVerified`), not inferred.
- ✅ **`article-list`'s completion tokens drop materially** — 32,256 → 3,376.
- ✅ **Cost/component and cache-hit rate re-runnable in one command** — the
  harness prints both, the JSONL carries per-turn usage, and `analyse.mjs`
  reproduces the whole A/B from the archives without re-spending anything.
- ⚠️ **Reported cost matches the provider's billed figure** — *not verified.*
  See residuals.

---

## A defect this work surfaced (fixed)

The 480s harness timeout was making every timed-out session report as
`exhausted` — "the loop gave up" — when it had actually been cancelled.

The cause is a seam between two reasonable local decisions. The Anthropic
adapter deliberately **resolves** rather than throws on abort, so a caller
keeps whatever text arrived, and it sets `stopReason: 'aborted'`. But
`AuthoringSession` only handled cancellation on the *throw* path. A resolved
abort arrives as a response with no tool calls — indistinguishable, to the
code, from a model that replied with prose — so it fell into the nudge path,
spent another turn, and finished `exhausted`.

In the editor that means a user pressing **Cancel** could see "exhausted"
instead of "cancelled", and burn an extra API call on the way. Fixed by
checking `stopReason` before the nudge path, with a spec.

This is why the run at `high` reports `article-list` as `exhausted` rather
than `cancelled`: those measurements predate the fix. The cost figures are
unaffected — only the status label was wrong.

---

## Residuals

- **Our cost figure has not been reconciled against Anthropic's billed
  figure.** The arithmetic is specced and the token counts come from the
  provider's own `usage` fields, but "our number equals the invoice" needs
  console access and is a human step. Until it is done, treat the cost readout
  as *internally* consistent rather than *externally* verified. **Whether an
  agent could close this instead was measured on 2026-08-02 — it cannot, and
  the five-minute human version is written out below.**

### Why an agent cannot close the reconciliation (measured, 2026-08-02)

Anthropic does expose the two endpoints that would answer it —
`GET /v1/organizations/usage_report/messages` and
`GET /v1/organizations/cost_report` — but they take an **Admin API key**
(`sk-ant-admin…`), which only an organisation owner can mint from the Console.
The project's `.env` key is a workspace key and is refused.

That is not an inference from the key prefix. Three probes with the repo's own
`ANTHROPIC_API_KEY`, same headers, same request:

| Request | Result |
|---|---|
| `POST /v1/messages` | **200** — the key is live and works for inference |
| `GET /v1/organizations/cost_report` | **401** `authentication_error: invalid x-api-key` |
| `GET /v1/organizations/usage_report/messages` | **401** — same |
| `GET /v1/organizations/not_a_real_report` | **404** `not_found_error` |

The 404 on a made-up sibling route is what makes the 401s meaningful: the
reporting routes **exist** and are rejecting this *class* of key, rather than
not existing at all. So the blocker is a credential an agent cannot create,
not a missing API.

**If Richard ever puts an admin key in the environment, this becomes
automatable** — `usage_report/messages` returns per-model token counts that
`calculateCostUsd` can be run against directly, which is a stronger check than
comparing dollars.

### The five-minute human version

Anthropic's Console shows cost **by day and by model**, and the two
2026-07-25 runs are the tightest comparison available because each used one
model and the totals are recorded here.

1. Console → **Usage** (or **Cost**), set the date range to **2026-07-25** and
   group by model.
2. Compare against the sums below — these are `metrics.costUsd` totalled
   straight out of `measurements/`, recomputed 2026-08-02:

| Date | Model | Our recorded cost | Console figure |
|---|---|--:|---|
| 2026-07-25 | `claude-sonnet-5` | **$1.1825** (8 components) | ? |
| 2026-07-25 | `claude-opus-4-8` | **$0.3458** (3 components) | ? |
| 2026-07-26 | all AIX-007 sweep arms | **$4.8310** (baseline $2.3448 + high $0.8194 + medium $0.6470 + low $0.2817 + opus-low $0.7381) | ? |

3. **Our figure should be a floor, not a match.** Anything else run against
   the same key on those days is in the Console total and not in ours, so a
   Console figure *higher* than the table is expected and uninformative; a
   Console figure *lower* than ours means our arithmetic over-charges, which
   is the failure this residual exists to catch. The 2026-07-25 rows are the
   ones worth reading — that day's spend was the measurement runs.

The headline **$0.0352/component** is the `low` arm's $0.2817 ÷ 8; if the
2026-07-25 rows reconcile, the same pricing table produced that number.
- **`low` was chosen on a corpus of eight small components.** Every prompt
  improved, and the margin is far too large to be noise — but the corpus does
  not contain a genuinely large or architecturally ambiguous component, and
  that is exactly where more deliberation could still pay. The mitigation is
  that `effort` is now a per-call-site setting: if a harder authoring mode
  appears, it can ask for more without changing anyone else. Re-sweep before
  assuming `low` generalises.
- **One run per arm.** The cost and latency deltas are large enough to act on;
  the 23.3% behavioural share of the step-4 result is not separable from
  run-to-run variance without repeats.
- **Anthropic only.** OpenAI and Ollama report zero cache tokens and are
  priced correctly for that, which is honest rather than aspirational. The
  seam (`cacheBoundary`, `AiUsage`, `CacheTokens`) is provider-agnostic, so
  adding OpenAI's `prompt_tokens_details.cached_tokens` later is a small
  change in one adapter.
- **Explain mode and review still inherit `effort: undefined`**, i.e.
  Anthropic's `high`. They get the adapter-level caching win for free, as the
  spec intended, but nobody has measured what effort suits them. Given what
  the sweep found on the authoring loop, that is worth its own look.
- **`get_component` remains a large handout.** `article-list` pulled a 32,863
  character component in one read. Out of scope here (the spec ring-fences
  context sizes), but it is the largest single uncached payload left in the
  loop.
