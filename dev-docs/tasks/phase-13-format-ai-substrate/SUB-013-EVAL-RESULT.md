# SUB-013 §4 — does `parameterEncoding` help a small local model?

**Run 2026-07-30.** Harness: `npm run catalog:encoding:eval -- --catalog <path> --repeats 3`
(`scripts/node-catalog/encoding-eval.js`, tasks in
`scripts/node-catalog/fixtures/encoding-eval-tasks.json`).

The spec requires this result to be recorded **including if it is negative**. It is mixed, and the
mixed part is the interesting part.

## What was run

| | |
|---|---|
| Model | `llama3.2:latest` (3B), local, via Ollama, `temperature: 0` |
| Tasks | 12 authoring prompts over 9 dynamic-port node types; `States` ×3, hardest first |
| Conditions | **without** — the node's catalog entry as it stood before SUB-013, `dynamicPorts` prose included. **with** — the identical entry plus `parameterEncoding`. Nothing else differs. |
| Grading | The model's own `parameters` object is fed to the node's real dynamic-port hook. A key is correct when the hook generates a port with that name. No answer key, and no way for the grader to drift from the runtime. |

## Result

| Metric | without | with |
|---|---|---|
| Overall score (key precision × required-port recall) | 8% | **17%** |
| Key precision | 8% | **18%** |
| Required-port recall | 8% | **21%** |
| Keys matching a documented formula | 17% | **44%** |
| Fully correct answers (of 12) | 3 | **6** |
| Wrote every seed parameter | 67% | 58% |
| Replies that parsed as JSON | 100% | 94% |

Per task, `with` beat `without` on `expression` (0% → 100%) and matched it everywhere else. Only
`string-format` was solved in both conditions.

## Reading

**The field helps, and the behavioural claim is still not established.** Both halves are real.

Every accuracy metric roughly doubles, and formula-shaped keys go up 2.6×. The direction is
consistent across five independent measures, so the encodings demonstrably transfer *something* a
3B model could not induce from the prose. On the pre-registered bar in the harness — `with` must
beat `without` by more than 10 percentage points on overall score — the observed +9pp lands just
short, and the harness prints **inconclusive**. That verdict is kept rather than argued away.

Absolute performance is the more important number: **17% is not usable**. A 3B model given these
encodings still cannot author a `States` node. All three `States` tasks scored zero in both
conditions. So SUB-013's motivating claim — that documented encodings let a small open-weight
model author dynamic-port nodes — is **not demonstrated at 3B**, and should not be repeated as
though it were.

What the field is *not* refuted as: the §2 design. The failures are not authors misreading the
patterns. They are one tier below.

## What the failures actually were

Two failure modes, and neither is fixed by changing the pattern format.

1. **Merging two formulas into one.** `transitiondef-idle-scale` (the node has
   `transitiondef-<state>` and `value-<state>-<value>`; the model spliced them),
   `type-true-bgColor`, `transition-on-bgColor`. The model has the pieces and assembles them
   wrongly.
2. **Camel-casing a name that is interpolated verbatim.** `bgColor` for a value called
   `bg color`, in every single attempt — despite `notes` saying names are interpolated verbatim
   *and* the `example` field showing a key with a space in it. This is the exact case the task was
   written around, and stating it twice did not stop a 3B model normalising it.

Both are capability limits at this size rather than gaps in what is documented.

## A correction worth keeping

The first run of this evaluation reported **0% in both conditions** and would have been recorded
as a flat negative. It was a fixture bug, not a result.

Five tasks said things like *"an Object node exposing the properties `title` and `price`"* while
`requires` demanded `prop-title` and `prop-price`. The model answered `{"properties":
"title,price"}` — which is **correct**. The ports *are* generated from that parameter; the
`prop-` keys are only needed to give one a *value*, which the instruction never asked for. The
grader was marking a right answer wrong.

Generalisable: **an eval's task text and its scoring key are two statements of the same
requirement, and they can disagree.** The tell was the shape of the failure — a clean, plausible,
*short* answer scoring zero. Rewriting the instructions to ask for values moved the same model
from 0%/0% to 8%/17% with no change to the model, the prompt format, or the encodings.

## Limits of this measurement, stated plainly

- **`--repeats 3` bought nothing.** At `temperature: 0`, 23 of 24 task/condition groups returned
  byte-identical answers across all three. Effective n is **12 per condition**, not 36. Anyone
  re-running this for statistical power must raise the temperature first.
- **The frontier arm was not run.** §4 asks for three conditions; the third (a frontier model with
  encodings, as a ceiling) needs an API key, and the Anthropic key is out of credit
  (`LIVE-PROVIDER-PASS.md`). So there is no measured ceiling to say how much of the remaining 83%
  is the model and how much is the documentation.
- **One model, one size.** Whether the field's value grows or shrinks between 3B and, say, 30B is
  unmeasured. The hypothesis in the spec — that this matters *more* as models get smaller —
  predicts a peak somewhere in between, and nothing here tests that.
- **Three of the spec's suggested nodes were substituted.** §4 names `For Each`, `Set Variable`
  and `Component Inputs`; all three are `known: false` residue, so there is no encoding to
  A/B and the harness refuses them. `Model2`, `Component State` and `NavigationClosePopup` took
  their places.

## What would change the verdict

A mid-size model (7B–14B) run through the same harness. If the pattern holds — every metric
doubling — the absolute numbers there would be in usable territory, and that is the claim worth
making. The harness takes a `--model` flag and needs nothing else.
