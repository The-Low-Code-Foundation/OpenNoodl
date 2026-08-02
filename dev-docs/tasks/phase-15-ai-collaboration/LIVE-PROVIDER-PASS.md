# Phase 15 — the live-provider pass

**Date:** 2026-07-27
**Model:** `claude-sonnet-5`, effort `low` (AIX-007's measured default)
**Spend:** $1.96 recorded across all modes
**Artifacts:** `measurements/live/` — one `<mode>.jsonl` per mode plus every
document, plan and candidate the runs produced
**Harness:** `packages/noodl-editor/scripts/aix15-live/`

At the end of phase 15 every task was built, and the phase carried one shared
gap: **nothing outside the AIX-002 authoring loop had ever met a real model.**
Update mode, project-scope planning, the scoping conversation, the docs retrofit
and Explain Mode were all verified with injected chat functions returning
fixtures, which proves the plumbing and says nothing about what a model does.
This is that pass.

It is worth stating what kind of evidence this is. These runs do not prove the
features work — the specs already did that. They prove something the specs
structurally cannot: that the *contracts* hold up against output nobody wrote to
fit them. Every defect below is of that shape.

---

## What the runs closed

| Task | Criterion that was waiting | Result |
| --- | --- | --- |
| AIX-002 | Live run of update mode | **Closed.** Both revisions kept **100%** of base node ids (6/6, 4/4), so an update is reviewable as a diff rather than a rewrite. $0.088 for two. |
| AIX-004 | Register and accuracy tuning | **Closed, no tuning needed.** 42 citations across three answers, **0 unresolved, 0 bare node ids**, 12/12 grounded terms. The follow-up ("what happens if the connection drops halfway through an answer?") correctly described the `Last-Event-ID` resume path. |
| AIX-005 | "AIX-002 can author with these nodes" — the last undemonstrated criterion | **Closed.** Two requests naming no node type produced seven distinct agentic types: SSE + TextAccumulator for the streaming panel, GlobalStore + Set + Subscribe + StateHistory + Undo for the shared draft. First-attempt valid both times, $0.07. |
| AIX-010 | Criteria 1–4 | **Closed.** Read 7/7 components of `agent-chat` in 60,843 of 160,000 chars, and called it a pattern showcase rather than a product — which is what it is. Hedged with `> TODO:` exactly where it was inferring, including "no backend code or contract was available to this review". |
| AIX-011 | Criterion 1 (plan quality) | **Closed.** Five- and four-operation plans, correctly ordered, reusing the project's existing `Is user logged in?` component and spotting that the App shell needs a nav entry for a new page. |
| AIX-012 | Criteria 1 and 2 (conversation quality; it cannot build) | **Closed.** The conversation led rather than followed — it pushed back on giving "add a book" its own page and raised persistence unprompted — and converged on 3 pages / 3 objects / 2 out-of-scope items / 1 rejected alternative / 1 open question, which `planFromScope` turned into a 3-operation plan. $0.033. |

---

## Three defects, all found by running rather than by reasoning

### 1. A malformed submission killed the session instead of being repaired

`claude-sonnet-5` submits `nodes` as a **JSON string** rather than an array often
enough that it happened on the very first update-mode session.
`(payload.nodes ?? []).map(…)` in `buildCandidate` threw a `TypeError` straight
out of `AuthoringSession`, discarding every turn the user had already paid for —
over a mistake the model corrects immediately when told.

`SubmitPayload` types these fields as arrays, but it is built by an unchecked
cast over tool arguments the model wrote, so the type is a claim about what
*should* arrive rather than about what does. Non-array `nodes`, `connections`,
`visual_roots` and per-node `ports` are now rejected as repairable, and
`handleSubmit` catches whatever else `buildCandidate` cannot read.

The re-run shows the loop doing exactly what it is for:

```
✗ submit rejected (1 problem(s))
    submit_component: `nodes` must be an array — got string.
✓ submit accepted
```

This is the one defect here that could have cost a user real work, and no
fixture would ever have produced it.

### 2. The scoping conversation wrote a brief that contradicted itself

The model assumed "no accounts for now" on turn 1 and recorded it in
`outOfScope`. The user asked for email/password sign-in on turn 3. The model
recorded the Login page and the auth backend — and left the stale line in place.
The brief then said the app has no accounts on the same page as it said how
people log in.

`mergeScope` was never the problem: it replaces rather than appends, and a spec
now proves a later turn can shrink a list. The tool schema already said "each
field you supply REPLACES the previous value" — and that was not enough, because
a model reads `record_scope` as "record what is new". What was missing was the
*consequence*, which is now stated in both the schema and the system prompt: when
a decision changes, re-send that whole list without the entry that is no longer
true.

Re-run after the fix: the contradiction is gone, and `audience` — which the user
had stated in passing ("about twelve of us, all on our phones") and the model had
dropped — is now recorded too.

### 3. `CONVENTIONS.md` hands the model rules it must not follow

The template seeds six `(example)` rules, and the file reaches the model
verbatim — `renderDocForPrompt` only truncates. So a project created from a
conversation that agreed **three pages** ships

> `- (example) Do not add a Router; this app is a single page.`

into every authoring turn, under a header saying these rules must be followed and
outrank the model's own defaults.

Criterion 5's mechanical half was asserted — that the `CONVENTIONS.md` written at
creation is what the context builder hands over — but nobody had checked whether
what is *in* it is safe to hand over. The examples now disown themselves in the
same text both the model and the user read, rather than the prompt being filtered
into meaning something different from the file.

---

## Two findings recorded, not fixed

**`update /App` fails repeatedly.** Both plans ended on it and both failed: one
`exhausted` after four submits, one lost to the credit ceiling. One data point is
noise; the first is not, and it is unexplained. `/App` is the router host, and an
update session for it is the one case where the candidate must preserve routing
the agent cannot see. Worth a targeted run when credit is restored.

> **Closed 2026-08-02** — and it was not about the router. `/App` is the one
> component of 44 whose `project.json` entry has no `id`, so every candidate
> failed the schema check on a field `submit_component` cannot express. The hunt
> also turned up a worse defect on the update that *did* succeed: pre-existing
> `unknown-node-type` errors were charged to the agent, which retyped four
> module-provided nodes to `Text` while keeping their ids — a clean-looking
> diff over destroyed content. See AIX-011-NOTES.md, "The two live residuals".

**Project-scope authoring costs 5–6× standalone authoring per component.**
AIX-007 measured $0.035/component standalone. Inside a plan fan-out it was
$0.18–0.22 — each session carries the plan context and more of the project
(`/Pages/Author Profile` used 94,544 context chars). This is criterion 6's real
answer and it is not a regression, but it does mean a five-operation plan is a
~$0.90 action, which the panel does not currently say anywhere.

Also worth noting: **neither plan contained a `doc` operation**, so AIX-011
criterion 7's doc-authoring turn still has no live sample. The mechanism is spec
-covered on real files; what it *writes* is unmeasured.

> **Closed 2026-08-02.** The reason was mechanical, not editorial: the planning
> prompt permits a doc operation "only when the project's docs are listed in the
> overview material", and nothing ever listed them — `PlanningSession` built its
> context with no docs at all. With that fixed, two runs produced two plans with
> a doc operation in each. Both revisions are pure additions that keep every
> line the human wrote. See AIX-011-NOTES.md and `--mode=plan-docs`.

---

## The live editor pass

Driven over CDP against a running editor.

**AIX-012 — the launcher AI card.** Verified. "Start with AI" is present with the
right copy ("…Nothing is built until you say so"), correctly disabled, and it
names the reason — "AI is turned off. Pick a provider and add a key to use it." —
with a "Set up AI…" route. This is the replacement for the "Coming soon" badge
the task found already shipped, and it behaves as specified.

**AIX-009 — the DocsPanel.** Mounts and renders. It lists the three documents,
shows the empty state with the line the whole four-task group rests on ("not a
description of the graph, which Explain Mode narrates from the live version"),
and offers "Create docs folder" and per-file "Create from template".

Worth recording for anyone looking for it: the panel is registered
`experimental: true` and lands in `SidebarModel.experimentalItems`, not `items`.
It only appears once `experimental.panel.project-docs` is set in EditorSettings.
That is a gate, not a bug — but it is why "the DocsPanel has never been mounted in
a running editor" survived as a residual for so long: it is not in the rail by
default.

**AIX-010 — the review banner, and a layout defect.** The banner renders inside
the DocsPanel with both controls. Measured, the dismiss button **overflowed the
panel's right edge by 3px** at the panel's own width, because the two labels sit
in an `HStack` with no wrap and neither fits beside the other. The panel is
resizable down to 240px, where the primary button alone does not fit a row.

A banner whose "no thanks" is the half you cannot reach is worse than no banner —
it reads as an offer you are not allowed to decline. Fixed by letting the row
wrap; measured again with the style applied live, the dismiss button drops to a
second row and its overflow goes from **+3px to −247px**.

---

## What is still owed

| Owed | Why it is not done |
| --- | --- |
| AIX-011's `update /App` diagnosis; AIX-003's live author→review→partial-accept round trip; AIX-008's run against a real provider | **The Anthropic key ran out of credit mid-run** (`author-profiles`, `update /App`). Every remaining live run is blocked on topping it up. `OPENAI_API_KEY` is present and would work, but it measures a different model against criteria AIX-007 set on sonnet-5, so it answers a different question. |
| AIX-003's clean-session UI smoke (exclude/restore, Before/After, walkthrough, Accept-N-of-M); AIX-008's sample-data/real-backend toggle; AIX-011's plan panel flow | Each needs a *scripted* AI session driven through the real panel — the no-provider technique AIX-008 used. Reachable without credit, but it is a harness of its own and was not built here. |
| AIX-010's dismissal-across-restart and the 240px layout | Needs an editor restart cycle and a panel resize; the banner fix above is the part that mattered. |
| AIX-003's 40+ node fresh-reviewer test | Needs **a human who has not seen the change**. No amount of tooling substitutes for this one. |
| AIX-002's Gate G2 demo | A signed build shipped for a full quarter alongside the LEARN-006 pilots. A calendar and a business decision, not an engineering task. |

---

## Reproducing

```bash
node packages/noodl-editor/scripts/aix15-live/build.mjs
node packages/noodl-editor/scripts/aix15-live/dist/aix15-harness.cjs --mode=plan
```

`--mode=update|agentic|plan|scope|review|explain|plan-docs`, `--only=<slug>`,
`--model=`, `--effort=`, `--outdir=`. Keys come from the repo-root `.env`.

**`--model=` is not optional in practice.** Without it the registry default
resolves through `EditorSettings`, which this bundle stubs, and the run dies on
"No model specified for the Anthropic provider" before making a request. Every
run recorded here used `--model=claude-sonnet-5`.

The AIX-002 harness (`scripts/aix002-measure`) is untouched: its flags and JSONL
shape are a published measurement artifact, so this is a sibling rather than an
extension.
