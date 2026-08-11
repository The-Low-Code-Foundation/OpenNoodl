# LEG-001 — the re-measurement. It came back zero

**2026-08-12.** One cold replay of the storefront brief, on the merged tree, with `comment` declared
and verified present in the served schema. Richard authorised the spend before it was run.

## The number

| | this run | LEG-001's control arm |
|---|---:|---:|
| nodes authored | **182** | — |
| **nodes carrying `metadata.comment`** | **0** | baseline 1 in 2,045 |
| nodes carrying `label` | **103 (56.6%)** | 89.3% across the corpus |
| write/stage calls carrying a `comment` field | **0 of 24** | — |
| assistant turns mentioning the word "comment" | **0 of 39** | — |

**The strongest control is inside this one run.** Same model, same brief, same session, two *optional*
declared fields on the same node schema: `label` was used 103 times, `comment` zero. Nothing about
provider, brief or surface differs between them.

⚠️ **"Judge the comments, do not count them" is vacuous here — there are none to read.** The failure
mode the acceptance criterion guarded against (100% coverage of *"This is a Group"*) did not arise,
and neither did the success.

## What this refutes

LEG-001's argument was a natural experiment: *"An optional field with a single clear sentence of
description got 100% compliance from every frontier model. This task is that sentence, written for
the other field."* The sentence shipped, verbatim, and reached the model:

> Why this node is the way it is — a constraint, a rule, or a decision with an alternative. Omit when
> the type and label already say it.

**The inference did not transfer.** Declaring the field was necessary — a model cannot write what
nothing names — but on this evidence it is **not sufficient**. `label` and `comment` differ in
something the vocabulary row does not carry.

## Why this is a real zero and not a broken rig

Each of these was verified **before** the run, and each would have produced a false zero:

1. 🔴 **`noodl-mcp` serves `dist/noodl-mcp.cjs`, not `src/`.** The bundle on disk was built at 21:19,
   before LEG-001 merged, and a freshly started server advertised `create_component` node fields as
   `id, type, label, x, y, parent, children, parameters, variant, ports` — **no `comment`**. Rebuilt
   (`node packages/noodl-mcp/build.mjs`, 117 ms) and re-probed before spending a penny. Had this run
   gone against the stale bundle, the phase's flagship claim would have been recorded as refuted by
   its own evidence.
2. **The field is on every door this model actually used.** It used `stage_plan_operation` ×17 and
   `update_component` ×7. Both were probed over stdio and both carry `comment` with the full
   sentence. ⚠️ `update_component` and `stage_plan_operation` nest nodes under `set`/`operations`, so
   a probe that walks `properties.nodes.items.properties` finds nothing and reads like a second
   failure — search the stringified schema instead.
3. **The run is a competent one, not a stall.** `score-run.js`: 12 components, 1 page, 25 connections
   across 48 endpoints, 5 Component Inputs components with 17 ports, 4 For Each, 5 Columns. It
   finished on its own (`stop: model-finished`), it did not exhaust its turns.

## The run, reproducibly

```
node scripts/devtools/mcp-model-driver.js \
  --project "<dir>" --base-url https://api.deepinfra.com/v1/openai \
  --model deepseek-ai/DeepSeek-V4-Pro --api-key-env DEEPINFRA_API_KEY \
  --prompt-file leg001-prompt.txt --max-turns 60 --max-tokens 16384 --temperature 0.2 \
  --price-in 1.30 --price-out 2.60 --out leg001-comment-transcript.jsonl
```

Project minted per STOREFRONT-BRIEF.md protocol step 1 — `create_project` with name `Kiln & Co.` and
the brief verbatim as `request`. ⚠️ `create_project` is **disabled on a bound server**; start the
server with no project directory to reach bootstrap mode (5 tools), and the argument is `directory`,
not `path`. Prompt is 1,231 chars, inside the documented 1,235–1,248 band.

`run-end`: **39 turns, 66 tool calls, 2,718,599 in / 32,599 out, $3.6189, 1,135 s.** Tool surface 20
advertised, rising to 23 after a `list_changed`; schema 29,477 chars (~7,907 tokens/turn) against the
phase-58 baseline's 28,297 — the difference is this field and the phase-62 changes.

Transcript and prompt are beside this file. Artefact: `NodeGX test projects/leg001-comment-measure`.

## The instrument

`scripts/legibility/scan-comments.js`, new with this measurement, because the 1-in-2,045 baseline was
computed by hand and had **no committed instrument**. It reproduces three independently-stated facts
unchanged, which is why it is trusted here: zero comments across all twelve model runs, exactly one
comment in the whole of `NodeGX test projects/` and it is in a project called `test`, and
`project-examples/agent-chat` at 0 labels and 0 comments of 262 nodes.

⚠️ It reads **v2** projects, and `scan-labels.js` does not. Every corpus project is legacy
`project.json`; anything authored today is v2, and a legacy-only reader reports it as zero nodes —
indistinguishable from a model that wrote nothing.

⚠️ Its denominator is broader than LEG-002 §2's (1,998 nodes for the twelve model runs where
`scan-labels.js` says 1,126). The *numerators* agree — 1,006 labelled against LEG-001's 1,003 — so
the gap is in what is admitted as a countable node. Quote rates against one instrument, never across
two.

## What to do about it — and what not to

**Do not re-run this and hope.** One more frontier model at $3.62 buys another n=1.

The concrete, untested lead is that **LEG-001 shipped only half of itself**. §5 of the task specifies
a doctrine half — one or two sentences in `AUTHORING_TRAPS` and the doctrine markdown on *when a
comment is worth writing*, matched to §4's three cases. **It is not there**: no mention of comments in
`AUTHORING_TRAPS` or anywhere in `dev-docs/best-practices/`. The task's own ordering rule was
*structure > gate > documentation*, with doctrine following rather than replacing the vocabulary row.
The structural half is in and measured at zero; **the documentation half has never been tried**, and
it is cheap.

Two further readings worth holding, neither yet evidence:

- **The model never engaged with the field at all** — not once in 39 turns. This does not look like a
  judgement that no node warranted a comment; it looks like a field that was never read, in a
  29,477-character schema. If so, the lever is salience (doctrine, an example, the `get_example`
  payloads), not wording.
- **`label` and `comment` are not the same kind of ask.** A label names what is in front of you; a
  comment requires knowing a constraint the brief never stated. The storefront brief contains almost
  no décret-style rules, so a model with nothing to say may be *right* to say nothing. ⚠️ If that is
  true, this fixture cannot measure the field, and the honest next step is a brief that **contains**
  external constraints — which would also make the criterion testable rather than aspirational.
