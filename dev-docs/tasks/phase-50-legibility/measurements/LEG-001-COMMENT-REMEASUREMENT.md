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

> 🔴 **CORRECTION, 2026-08-12.** The paragraph this section originally carried — *"the concrete,
> untested lead is that LEG-001 shipped only half of itself… the documentation half has never been
> tried, and it is cheap"* — **was wrong**, and it was propagated into the phase handover as the
> recommended next move. **The doctrine half shipped in `a4793530` (2026-08-11 23:20:21 +0200)**, in
> `authoring.ts`'s AUTHORING CONTRACT and as `DECOMPOSITION_DOCTRINE_MD`'s **"Say why on the node"**
> bullet. The grep behind the claim searched `AUTHORING_TRAPS` and `dev-docs/best-practices/` — the
> two surfaces that commit **deliberately** left alone — and read their emptiness as the whole story.

**The doctrine was in front of the model, at turn 1.** This run began `2026-08-11T22:12:31Z`, **52
minutes after** that commit, and the bullet appears verbatim in the transcript at record 3 — the
`get_project_info` result of the **first turn**, the pushed channel LAS-007 measured as the one that
works:

> **Say why on the node.** A node's `label` says what it is for; its `comment` says why it is the way
> it is. Write one where the next reader would otherwise change something and break it…

So the zero was measured with **every lever this task specified already pulled**: the vocabulary row,
the one-sentence field description on the doors the model actually used, *and* the doctrine prose
delivered unasked before it wrote a single node. **There is no cheap untried documentation move.**

⚠️ The two surfaces that really are untouched are `AUTHORING_TRAPS` — excluded on purpose, because
every line there is a *silent failure this project measured* and a missing comment fails nothing — and
`dev-docs/best-practices/`, which is the **pull** channel LAS-007 measured at **zero** retrievals
across 42 turns. Shipping prose there is predictably inert for this measurement, so it cannot be the
next experiment.

That leaves the two readings below — and the correction above **re-ranks them**, because one of them
was quietly relying on the doctrine being absent:

- 🔴 **`label` and `comment` are not the same kind of ask — now the leading hypothesis.** A label
  names what is in front of you; a comment requires knowing a constraint the brief never stated. The
  storefront brief contains almost no décret-style rules, so a model with nothing to say may be
  *right* to say nothing — and this run's silence is then correct behaviour, not a failure to comply.
  ⚠️ If so, **this fixture cannot measure the field at all**, and every number taken against it is
  uninformative. The honest next step is a brief that **contains** external constraints — a
  regulatory threshold, a client's contractual limit, a rule the graph cannot state — which would
  also make the criterion testable rather than aspirational. **Do this before spending again.**
- ⚠️ **Salience — weakened, but not dead.** The word "comment" appears in none of the 39 assistant
  turns, which still looks like a field that was never *read* in a 29,477-character schema. But the
  original form of this reading proposed doctrine as the lever, and doctrine was already there, at
  turn 1, unasked. So if salience is the answer it is not prose that fixes it: what remains untried is
  a **worked example** carrying a comment (the `get_example` payloads), i.e. showing rather than
  telling. Cheaper than a paid run, and it does not collide with the fixture problem above — but note
  that it *also* cannot be measured on a brief with no constraints in it.
