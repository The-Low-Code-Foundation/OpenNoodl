# UNI-010 criterion 3 — the five-lesson run

**Status: PRE-REGISTERED 2026-08-16, before any lesson was authored.** Everything above the
"Results" heading was written and committed first, deliberately, so the decision rule cannot be
reshaped by what the run turned out to produce. Criterion 3 is the experiment UNI-010 exists for and
it is the last thing standing between the task and a verdict — an experiment whose success condition
is chosen after the data is not an experiment.

---

## 1. The decision rule, quoted rather than paraphrased

From [UNI-010](UNI-010-A-TUTORIAL-YOUR-OWN-CLAUDE-CAN-WRITE.md), "Kill / keep criteria
(pre-registered, so the experiment can fail honestly)":

> - **Kill** if the verifier passes lessons that still routinely dead-end in human hands, or if
>   authoring reliability is so low the verifier rejects nearly everything (the format is too hard
>   for the model — fix the format or the brief before shipping the feature).
> - **Keep** if ≥ 3 of 5 test-generated lessons install and are completable + worth completing.

And the evidence rule, from the same file:

> LEARN-009's harness output is the *evidence* (F1–F4 scored mechanically, per-lesson,
> regenerable); UNI-010's ≥3-of-5 is the *decision rule*.

### 1.1 The three words that need an operational definition

The rule has three clauses and only one of them is machine-answerable. Defining them now:

| Clause | Operationalised as | Who answers it |
|---|---|---|
| **installs** | `create_lesson` writes the bundle — i.e. `writeLessonBundle` returns `written: true`, which means `decideInstall(scorecard, 'local-ai').allowed` **and** F4 is not `not-checked`. This is the *same* table the editor applies at install, asked of the producer, so a bundle that writes is a bundle the launcher accepts | machine |
| **completable** | every step's `completeWhen` holds against the lesson's own solution and holds against **no** step in the starter — this is exactly F2 (both halves) — **and** F3 reports no error, so the addresses do not resolve to a decoy | machine |
| **worth completing** | a human read against the six-point pedagogy list in the brief, plus an explicit F5/F6 read. See §4 — and see §5 for why this is the weakest evidence in the run | human, and it is me |

**A lesson counts toward the ≥3 only if all three hold.** "Installs" alone is not the bar; the rule
says *and*.

## 2. The five lessons, chosen now

Chosen before authoring, and chosen to be **plausible user requests across the format's range** —
not chosen to be easy, and not chosen to be traps. Each is written as the sentence a user would
actually type at their own Claude, because that is the experiment's input.

| # | The request | Why this one |
|---|---|---|
| **L1** | *"Teach me how to put some text on a page and style it."* | The floor. If the format cannot carry the simplest possible lesson, nothing else matters |
| **L2** | *"A lesson on wiring a For Each to Static Data, assuming I know JavaScript."* | 🔴 **Richard's own example, verbatim from the task file.** Also walks straight into the two-vocabulary trap: the picker says *Repeater* and *Static Array*, the conditions must say `For Each` and `Static Data` |
| **L3** | *"Show me how to make a button that increments a counter."* | The `connection` verb, and the **shadowed-name** trap — `Button` is a real type name, of the deprecated node; the one in the picker is `net.noodl.controls.button` |
| **L4** | *"Teach me how to add a second page and navigate to it."* | Multi-component. Router registration, `RouterNavigate`, and the `previewRouteEquals` verb the brief warns cannot be replayed by the gate |
| **L5** | *"How do I show and hide something based on a value?"* | Conditional UI — and this repo's own recorded trap is that conditional UI goes through `mounted`, not `visible`, which is precisely the kind of thing a model describes from memory and gets wrong |

**These five are frozen.** If one proves impossible to author, that is a **failure of that lesson**
and it is scored as such. Swapping in an easier topic mid-run would be the experiment grading itself.

## 3. The protocol

1. Author the starter project and the solution project for the lesson.
2. Write the manifest.
3. Call **`create_lesson` over the real MCP stdio transport** (§3.2) with
   `NODEGX_RENDER_CLI` set, so F4 is genuinely measured.
4. Record the verdict verbatim. **This first call is the first-pass datum** (§3.1).
5. If refused, fix and call again — **at most three `create_lesson` calls per lesson**.

### 3.1 First pass is recorded separately, and it is the reliability number

The keep rule is about the final state — the tool is explicitly designed to be called again
(*"Fix and call it again"*). But the **kill** clause is about *authoring reliability*, and a rule
that only looks at the final state cannot see it. So two numbers come out of this run and both get
reported:

- **first-pass pass rate** — how many of five wrote a bundle on call #1. This is the reliability
  datum, and it is the one that speaks to *"the format is too hard for the model"*.
- **final pass rate** — how many of five wrote a bundle within three calls. This is the ≥3-of-5
  decision rule.

🔴 **The three-call cap is part of the pre-registration.** An unbounded fix-and-retry loop makes the
gate meaningless — with enough attempts a model converges on anything, and the resulting "5 of 5"
would measure my persistence rather than the format. Three is chosen because the refusals are
designed to be actionable in one round; needing more than three is itself a finding.

### 3.2 What is driven, and what is not — stated in advance

The tenth session's drive of criterion 2 recorded its own boundary honestly: *"the stdio transport
was NOT driven … `create_lesson`-over-MCP remains untested end to end."* The reason given was that
Richard's **registered** servers run a pre-slice-2 build and repointing them is his call.

That reason does not extend to a server **this session spawns from the checkout**, which is
peer-safe and touches nothing of Richard's. So this run drives the real transport:

- a server started as `node packages/noodl-mcp/dist/noodl-mcp.cjs <project> --allow-writes`,
- spoken to over **real stdio JSON-RPC** — `initialize`, `tools/list`, `tools/call`,
- reaching `create_lesson` through the deferred `lesson` group exactly as a client would.

⚠️ **What that still does not prove:** that *Richard's registered* servers can reach these tools.
They cannot, until they are restarted against a build carrying slice 2 — and if one loads from
`/Applications/…` it needs a repackage, not a rebuild. That remains his call and this run does not
close it. What it does close is whether the tools work *over a transport at all*, which nobody had
established.

### 3.3 F4 must be really measured, and the instrument is named

`NODEGX_RENDER_CLI=<repo>/scripts/devtools/measure-from-disk.js`. Without it F4 comes back
`not-checked` and the run would be scoring **the class the prior arc predicted would dominate** as
unmeasured, which would make any verdict much weaker than it looked.

🔴 **The ordering constraint, discharged explicitly.** UNI-010 records that phase 69's **CN-001**
rewrites `render-from-disk.js` — the far end of this chain — and that criterion 3 must not straddle
it. Checked before starting: `git log` on that file shows its most recent commit is `439ab76c`
(AWP-001/002), and phase 69 has **no code at all**. **All five lessons in this run are therefore
scored on the pre-CN-001 instrument**, which is the recorded answer to "which".

### 3.4 The trap this run is most likely to hit, named before it happens

From the criterion 2 drive: *"the harness refuses a lesson whose steps are already done in the
starter … the natural way to author a lesson is to build the finished thing and describe it, at
which point the starter you ship IS the solution. A model told 'write me a lesson' has every reason
to return exactly that."*

**Predicted here, in advance: this will be the most common first-pass refusal.** Writing that down
now so that if it *isn't*, that is a result too, rather than something quietly not mentioned.

## 4. The human read (F5, F6, "worth completing")

Per lesson, and written before knowing the machine verdict where possible:

- **F6 — text/graph divergence.** For every step: what does the prose ask for, and what does the
  condition check? Any gap in either direction is an F6. This is done as a table, per step, not as
  an impression.
- **F5 — variant-blind.** For every step: is there an obviously correct alternative way a learner
  would do this that the condition would reject? (e.g. a condition demanding an exact label when any
  label would do.)
- **Worth completing** — against the brief's own pedagogy list: one idea, 3–6 steps, instruction
  before explanation, nothing the editor cannot do, no leaving the editor, sample-data keys matching
  the bindings.

## 5. 🔴 The limitation that most weakens this run, stated up front

**The author of these lessons and the grader of their pedagogy are the same model, in the same
session, and that model has read this phase's entire trap list.** Both halves of that are a problem
and they are different problems:

1. **The author is over-informed.** A real user's Claude gets `get_lesson_brief` and nothing else.
   I have read `lessonbundleverify.ts`, the criterion 2 write-up, and every trap in this phase's
   notes. **This biases the first-pass number upward, and the first-pass number is the reliability
   datum.** So: the reliability figure this run produces is an **upper bound** on what a real user's
   Claude would achieve, and it must be reported as one. It is not a estimate with error bars around
   it — the bias has a known sign.
2. **The pedagogy grader is the author.** F5 and F6 are human classes *because* no gate scores them,
   and an author reading their own lesson is the weakest possible reader of it. Nothing in this run
   fixes that. It is mitigated only by doing the read as an explicit per-step table (§4) rather than
   as a judgement, so a later reader can disagree with the rows rather than with the conclusion.

⚠️ **Neither limitation is a reason not to run it.** They are a reason the write-up must not claim
more than "the format can carry five lessons authored by a well-informed model, and here is what the
gate caught". If the run *fails* under those favourable conditions, that is a strong result in the
kill direction — a well-informed author failing is worse news than a naive one failing.

---

# Results

_Nothing below this line was written before the run._
