# LEG-002 — the diagnostic, pointed the other way

**Status:** 📋 open · **Est. 2 d** · **Track: the gate** · after **LEG-001** · ⚠️ **polarity inverted
from the README**

## §1 — What the README specced

> A `SemanticValidator` warning on unlabelled non-trivial nodes… **Blocking for *authored* output**
> (the AAQ-009 `BLOCKING_WARNINGS` precedent), **advisory for hand-built**. Without this, LEG-001 is
> a suggestion the next prompt edit silently undoes.

The reasoning is sound and the aim is backwards.

## §2 — The measurement that inverts it

Counted 2026-08-10, `label` on every node in every graph in reach:

| Corpus | Nodes | Labelled |
|---|---:|---:|
| **Agent-authored** — eleven phase-55/58 model runs | 1,123 | **89.3%** |
| **Hand-authored** — 34 `library/` prefabs and modules | 1,333 | **20.3%** |
| Hand-authored — 3 QA fixtures | 137 | 10.2% |
| Every `project.json` in this repo | 5,509 | 19.7% |

A rule that **blocks authored output and advises hand-built output** would fire on the corpus that
already complies at 89% and stay silent on the corpus that complies at 20%. It would be a gate aimed
at the one population that does not need it.

So the polarity flips, and then it flips again into something quieter, because the honest reading of
those two columns is: **there is no compliance problem to gate.** Agents label. Humans mostly do
not, and always have not, and a hard rejection is the wrong instrument for a preference about
someone's own working style in their own graph.

**The rule ships advisory in both directions.** Not `AUTHORED_BLOCKING_WARNINGS`, not an error, in
the ProblemsPanel where everything else already is.

### The one row that argues for a gate, and why it still does not get one

```
 77/  88   88%  phase55-s6-haiku
  3/  19   16%  phase55-s6-qwen35-27b     ⚠️
  1/  94    1%  phase55-replay-haiku      ⚠️
```

Cheap models skip it. That is real, it matters for the per-role model story, and it is still not a
blocking-warning case: an unlabelled node **renders correctly**. Every code currently in
`AUTHORED_BLOCKING_WARNINGS` describes output that is *broken* — a value the runtime discards, a
page that renders blank, an instance parameter naming no port. Legibility is not that, and putting
it in that set redefines the set.

⚠️ And the audit finding that usually argues *for* gating argues against it here: hard rejections
carrying a suggestion were self-corrected at a 100% rate. **A rejection whose repair is "write a
better sentence" invites the model to satisfy it with `Group 3`** — the `Button 3` failure the
README ruled out of scope, arrived through the gate instead of through a generator.

## §3 — The rule

**`UnlabelledNode`**, `severity: 'info'` or `'warning'` — one code, in `DiagnosticCode`, with the
doc comment carrying this file's argument so the next reader does not re-derive it.

*Non-trivial* has to mean something checkable. Candidate definition, to be pinned against the corpus
before it ships:

- **skip** nodes whose type is its own explanation and which carry no configuration — a bare `Group`
  with one child, a `Component Inputs`/`Component Outputs` node;
- **skip** nodes where the catalog display name plus a single distinctive parameter already reads as
  a name — the same fallback `DiffFormatter.nodeName` already applies;
- **report** everything else: anything with children, anything with three or more authored
  parameters, anything with more than one outgoing connection.

⚠️ **Pin the definition against the corpus before choosing it.** Run the candidate over all 65
in-repo projects and the 35 test projects and print the hit counts. A rule that reports 4,400 of
5,509 nodes is not a diagnostic, it is a second copy of the node list, and the ProblemsPanel becomes
useless for the diagnostics that do describe breakage. **The number that decides this is the hit
count on the `library/` prefabs**, because that is the corpus a real user's graph most resembles.

## §4 — Where it must not go

- **Not in `AUTHORED_BLOCKING_WARNINGS`.** §2.
- **Not in the MCP write gate as an error.** `isBlockingForAuthoredOutput` is `severity === 'error'
  || AUTHORED_BLOCKING_WARNINGS.has(code)`; an info-severity code is correctly ignored by both
  clients with no further work. That is the desired outcome, not an omission — say so in the doc
  comment, or someone will "fix" it.
- **Not in `validate:project`'s failure count** in a way that turns a green corpus red. The corpus
  is a regression instrument for correctness; adding ~4,000 legibility hits to it destroys that.
  Count it separately or exclude it, deliberately and in writing.

## §5 — The exit criterion this task has to correct

README exit criterion 2:

> `agent-chat` is regenerated and its label coverage is above 90% — **the same fixture that currently
> reads 0 of 262**, so the number is comparable.

⚠️ **The comparison does not hold.** `agent-chat` was built **by hand** during AIX-005 on
2026-07-27 (`b95eddb4`), before the authoring vocabulary existed. Regenerating it with a current
model and getting >90% would measure nothing this phase did — `phase55-replay-sonnet` already reads
196/196 with no LEG task shipped.

Two things replace it, and both are honest:

1. **Regenerate `agent-chat` anyway**, because the repo's own flagship AI-authoring demonstration
   having 0 labels and 0 comments is embarrassing on its own terms and is what the README actually
   noticed. Frame it as **fixing a stale fixture**, not as evidence.
2. **The comparable number for this phase is comments, not labels** — baseline **1 in 2,045
   agent-authored nodes**, measured 2026-08-10, and it belongs to LEG-001.

## Acceptance

- `UnlabelledNode` exists, at info or warning severity, with a doc comment carrying the polarity
  argument and the measured numbers.
- **The corpus run is done and its counts recorded** before the definition is frozen: hits across
  the 65 in-repo projects, the 34 `library/` prefabs alone, and the eleven model runs. Three numbers,
  in the register.
- `isBlockingForAuthoredOutput` returns **false** for it, asserted by a spec, so a later edit to the
  blocking set cannot silently promote it.
- `validate:project`'s existing pass/fail is unchanged — proven by running it, not by reasoning
  about it.
- The ProblemsPanel row reads as advice and names the node it is about.

## Register

| # | Finding | State |
|---|---|---|
| L23 | Agents label at 89.3%, humans at 20.3%. **The README's gate is aimed at the compliant population** | ⚠️ measured, inverts the task |
| L24 | Every code in `AUTHORED_BLOCKING_WARNINGS` describes output that is *broken*. An unlabelled node renders fine; admitting it redefines the set | 📋 the argument |
| L25 | A rejection repaired by "write a better sentence" invites `Group 3`. The 100% self-correction finding cuts against gating here | ⚠️ standing |
| L26 | *Non-trivial* is undefined and the whole task depends on it. Pin it against the `library/` corpus first | 📋 the real work |
| L27 | README exit criterion 2 compares against a **hand-built 2026-07-27 fixture**. Corrected in §5 | ⚠️ corrected |
