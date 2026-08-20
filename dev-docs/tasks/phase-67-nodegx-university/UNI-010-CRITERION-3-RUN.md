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

> ## 🔴 AMENDED AFTER THE RUN — the paragraph above is WRONG, and it was wrong the way shared checkouts make things wrong
>
> **CN-001 landed mid-run.** `ed28a03c` — *"the render harness was blind to kits — and called it
> 'Rendered clean'"* — was committed at **00:31:29** and changed `render-from-disk.js` **on disk at
> 00:26:13**, by a peer working in this same checkout. Bundle write times: L1 `00:20:46`, L2
> `00:24:40`, L3 `00:25:49`, **L4 `00:27:18`, L5 `00:28:05`**.
>
> **So L1–L3 were scored on the old instrument and L4–L5 on the new one. The dataset is split, which
> is exactly what §3.3 was written to prevent.** Left uncorrected, this run's own recorded answer to
> "which instrument" would have been a lie.
>
> 🔴 **The trap, stated generally, because it is not phase-specific:** *a constraint checked at the
> start of a run is not discharged for the length of the run — in a shared checkout, an ordering
> constraint has to be re-checked at the END.* I read `git log`, found phase 69 had no code, wrote
> "discharged", and stopped thinking about it. Nothing about that check was wrong when I made it.
>
> ✅ **Measured, not argued away.** Rather than reason that lesson projects carry no kits, all three
> pre-CN-001 solutions were re-rendered on the new instrument:
>
> | | pre-CN-001 | post-CN-001 |
> |---|---|---|
> | L1 solution | `Rendered clean … 2 texts, 0 placeholders` | **identical** |
> | L2 solution | `Rendered clean … 4 texts, 0 placeholders` | **identical** |
> | L3 solution | `Rendered clean … 3 texts, 0 placeholders` | **identical** |
>
> **Both §8 findings were also reproduced end-to-end on the post-CN-001 instrument** — the L2 broken
> variant was reconstructed and still writes with F1–F4 all pass beside a `dead-placeholder-text`
> error, and the L4 blind control still reports `Rendered clean … 2 texts`. **The run's conclusions
> are instrument-independent**; the pre-registration's claim about which instrument was used is the
> only thing that needed correcting.
>
> ⚠️ And note what §8.2 now says about CN-001 specifically: CN-001 fixed *one* way this harness said
> "Rendered clean" about a page it had not properly drawn. **It did not fix the other one.** The
> start-page-only blindness survives it, measured above.

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

**Run 2026-08-16, eleventh session.** Five lessons authored, all five scored through `create_lesson`
over a real MCP stdio connection, F4 measured on the real render harness throughout.

## 6. The headline, before the detail

> ✅ **KEEP on the pre-registered rule — 5 of 5 install and are completable, and at least 3 are
> clean on the human read.**
>
> 🔴 **And the run produced positive evidence for the kill clause's first half at the same time.**
> Two structural holes in F4 were measured, each with a control pair: a lesson can score
> **F1–F4 all pass** while its own solution renders dead placeholders, and while the page it exists
> to teach is never rendered at all.

Both halves are the result. The rule's own parenthetical is the disposition: *"fix the format or the
brief **before shipping the feature**."* This graduates from experiment to feature **once §8's two
holes are closed**, and not before.

## 7. The five lessons

Every row is one `create_lesson` call over stdio, `NODEGX_RENDER_CLI` set, `allow_unrendered`
**not** passed.

| | Lesson | Graded steps | Calls | F1 | F2 | F3 | F4 | Written |
|---|---|---|---|---|---|---|---|---|
| **L1** | Text on a page | 3 | 1 | pass | pass | pass | pass | ✅ |
| **L2** | A list from inline data (*Richard's example*) | 4 | **2** | pass | pass | pass | pass | ✅ |
| **L3** | A button that counts | 4 | 1 | pass | pass | pass | pass | ✅ |
| **L4** | A second page, and a way to reach it | 3 | 1 | pass | pass | pass | pass | ✅ |
| **L5** | Show and hide | 3 | 1 | pass | pass | pass | pass | ✅ |

- **Final pass rate: 5 of 5** (decision rule: ≥3). Cap of three calls never reached.
- **First-pass pass rate: 5 of 5 wrote a bundle on call #1** — and this number is *misleading on its
  own*, which is why §3.1 asked for it separately. **L2's first-pass bundle was defective in F4's own
  class and the gate wrote it anyway.** The second L2 call exists because *I* caught that by
  rendering the solution by hand, not because the tool refused anything. See §8.1.
- All five bundles carry `solution/` and are stamped `authoredBy: "ai"` by the producer.

⚠️ **The prediction in §3.4 did not happen.** The already-complete-in-the-starter refusal — predicted
in advance as the most likely first-pass failure — **fired zero times in five lessons**. Recorded as
a miss because it was written down first. The likely reason is that I built each starter by
*subtraction* from the solution, which makes ghostwriting structurally hard to commit; a model
building the two projects independently would be far more exposed to it, so this says less about the
trap than about my authoring route (§9).

## 8. 🔴 The two findings, each with a control pair

Both are about **F4**, the class the prior arc pre-registered as *"the top defect"*. Neither is
about a lesson being wrong; both are about the gate not being able to see that it was.

### 8.1 F4's verdict throws away the render harness's own defect findings

L2's row component declared its interface as `dynamicports`. The editor reads **`ports`** on a
`Component Inputs` node, and so does the harness's `liftInterface` — so the component had **no
interface at all**, and the Repeater's items reached nothing.

What the render harness said about that solution, unprompted:

```
[error] desktop: dead-placeholder-text — 3 elements render a node-type default instead of
content: 3× "Text". Nothing set those ports. The usual cause is a component instantiated with
parameters its Component Inputs node does not declare — the graph-side name for it is
interfaceless-instance.
```

What `create_lesson` said about the same solution, in the same call, using that same report:

```
F1 pass   F2 pass   F3 pass   F4 pass        written: true
```

**The control pair.** The fixed L2 (`ports` instead of `dynamicports`) renders `0 placeholders` and
is a genuinely working lesson. Its scorecard is **character-for-character identical** to the broken
one's — same four passes, same three F3 warnings. The two bundles differ in exactly one JSON key in
one node, one produces three blank rows for the learner and the other does not, and **the gate
cannot tell them apart.**

🔴 **Why**, precisely: `verifyLessonBundle` fails F4 on `!wholeSolution.valid` or
`!wholeSolution.rendered`, and `rendered` is `drawnElementCount > 0 && !reportsBlankRender(report)`.
The L2 page drew four elements — one real heading and three dead placeholders — so `rendered` is
true. The adapter had already collected the harness's error line into `findings`, and `findings`
does not participate in the verdict. **The evidence was in the payload and the rule did not read
it.**

⚠️ And note what this is *not*: it is not the "clean can mean EMPTY" trap the module was built
against, it is one level up from it. F4 correctly refuses to accept "no errors" as evidence and
insists on a drawn count — and then a **project-level** drawn count lets an unrelated heading
vouch for a broken mechanism. `validate_project` on the same directory reports **0 errors, 0
warnings**, so nothing else covers it either.

### 8.2 F4 renders the start page and nothing else, so a multi-page lesson's subject is unscored — ✅ **CLOSED 2026-08-20**

L4 teaches building an **About** page. Its solution renders **2 texts** — Home's heading and the
button's label. The About page is not rendered, because `render-report.js`'s reachability walk is
built around `startPage`.

**The control pair, run rather than reasoned about:**

| L4 solution variant | Direct render | `create_lesson` |
|---|---|---|
| as authored | `Rendered clean … 2 texts, 0 placeholders` | F1–F4 pass, written |
| **About page emptied of all content** | `Rendered clean … 2 texts, 0 placeholders` | *(F2 would catch it — a step addresses that Text)* |
| **an unbound `Text` added to the About page** — no condition addresses it | `Rendered clean … 2 texts, 0 placeholders` | **F1–F4 pass, written** |

The third row is the finding. A dead placeholder sitting on the page the lesson exists to teach is
invisible to F4 *and* to F2, and the bundle writes. The identical `2 texts` across all three rows is
the direct evidence that the About page is never visited.

🔴 **This one is upstream of UNI-010.** The harness itself reports *"Rendered clean"* for a project
whose second page is broken, so it is not only F4 that inherits it — `render_report` as a tool has
the same blind spot. **It belongs with phase 69's CN-001**, which is rewriting the same file.

> ## ✅ CORROBORATED at a lower layer, and my stated mechanism was the wrong half
>
> The phase-69 session took this observation and **measured it rather than relaying it**, at the
> HTTP layer instead of the render-count layer (`07b7ce7a`): `render-from-disk.js` serves `/` and
> **404s every other route**. Reproduced here on this run's own L4 fixture rather than taken on
> trust:
>
> ```
> GET /        -> 200      # the app boots, router lands on startPage
> GET /home    -> 404      # ...and /home is the START page's own urlPath
> GET /about   -> 404      # the page this lesson exists to teach
> ```
>
> 🔴 **`/home` 404ing is the part neither of us said first, and it moves the finding.** I wrote the
> mechanism as *"the reachability walk in `render-report.js` is a `startPage` walk"* — that is the
> **reporting** half, and it is true. The **serving** half is stricter: the harness answers exactly
> **one path, `/`**, and the SPA then boots to whatever the Router names. So it is not that the
> harness renders one *route*; it is that it can reach **no named route at all**.
>
> ⚠️ **The consequence is bigger than "a second page goes unrendered".** Anything a lesson teaches
> about `urlPath` — the Page node's own URL, route parameters, deep links — is **unmeasurable by
> this instrument**, including on the start page. F4 cannot see it, and neither can `render_report`.
>
> ✅ Worth recording as method: I was one relay away from filing the HTTP result as corroboration of
> my own reading. Running the three `curl`s myself is what turned up `/home`, which contradicted the
> mechanism I had already written down. **A corroboration you did not run is a conclusion, and it
> arrives with its scope dropped.**
>
> 🔴 **And CN-001 landed while this run was in progress (see §3.3's amendment) without closing it.**
> `ed28a03c`'s own message is *"the render harness was blind to kits — and called it 'Rendered
> clean'"*: **the same sentence, about a different blindness.** The blind control above was re-run
> on the post-CN-001 harness and still reports `Rendered clean … 2 texts`. Two independent routes to
> a falsely-green render report have now been found in this one file within a day, one fixed and one
> open — which is itself an argument for treating "did it draw?" as a probe that needs its own
> known-broken control on every route it claims to cover, not just on the route last fixed.

#### ✅ CLOSED 2026-08-20 — the harness renders every routed page

**Where:** `render-report.js` (`routedPages`, `reachableComponents`, the per-page loop),
`render-from-disk.js` (the serving half), `measure-from-disk.js` (coverage in the printout),
`noodl-mcp/src/render.ts` (the ceiling). **11 specs**, `tests-unit/uni-010/`.

**🔴 The defect was still live at HEAD, and this is the reading that proves it.** Three arms on a
five-route project, the third present so that the absence in the second means something — *a control
can read zero, so read a known-firing signal first*:

| arm | the same `dead-placeholder-text`, placed on | report |
|---|---|---|
| A | nowhere (baseline) | `Rendered clean … 0 placeholders` |
| **B** | **`/Pages/Thank You` (routed)** | **`Rendered clean … 0 placeholders` — `md5` IDENTICAL to A** |
| C | `/Pages/Landing` (start) | `2 errors … dead-placeholder-text` |

A and B were character-identical with timing stripped (`661b27a6…` both). C is the known-firing
signal: the instrument sees this defect perfectly well, on one page.

**After the fix**, A and B differ and B and C grade the same — the defect is graded wherever it sits:
A `0 errors, 1 warning`; B `2 errors, 1 warning (dead-placeholder-text, …)` naming
`/Pages/Thank You`; C the same two errors.

⚠️ **Arm A is not the clean baseline it was.** The `minimum-layout-width` warning on Thank You is a
**real pre-existing defect** in the fixture that nothing could see before. The "clean" reading was
never clean.

**✅ F4 inherits it with no change to the grader**, which was the design constraint: page findings
merge into the same `report.findings` array, and `renderDefectCodes` reads that. Driven through the
real function on arm B's actual report — `renderDefectCodes(report) -> ['dead-placeholder-text']`.
Parking them in a separate array would have been tidier and would have left F4 exactly as blind.

**🔴 The correction this section itself needs.** It says the About page is not rendered *"because
`render-report.js`'s reachability walk is built around `startPage`"*, and CN-001 sharpened that to
the server answering exactly one path. The walk is the right culprit; **the server was not.** The
runtime routes on the **hash** by default and a hash never reaches a server — `/#about` always
rendered the About page. Nothing ever navigated there. ⚠️ The trap: **fixing the 404 alone changes
no reading**, so a session that fixed it and re-measured would have concluded the harness still
could not see page two, having aimed at the wrong mechanism throughout.

**🔴 What it cost to do correctly — a regression that only appeared once every page was rendered.**
`listProbes` returns every knowable repeater in the *project*. Measuring page four against page
one's repeater accuses it of failing to render rows it never had: `phase55-replay-sonnet`, the build
phase 55 calls **correct** and a pinned control recorded as reporting *none*, came back with **14
`empty-list` errors** — a gate rejecting the correct answer, which would have been F4 failing sound
lessons. Probes are now scoped to the components a page can reach, and both pinned controls are
restored: sonnet `Rendered clean (1 observation)`, haiku still its two defects.

**⚠️ Two costs, stated rather than smoothed.**
- **Wall clock**: ~4.3s per extra page (two viewports). One page 7.3s → eight pages **40.9s**. The
  MCP ceiling was 90s behind a comment claiming ~7.5s, putting the cliff at about **twenty pages** —
  a large but ordinary project killed mid-run for no reason its author could see. Raised to 240s.
- **Coverage is now stated**: `pages: N/M measured`, a `[skipped]` line per unreachable page, and a
  clause appended to the summary sentence itself when any page was skipped. Otherwise `Rendered
  clean` over two never-visited pages is the same over-broad claim in a new place.

**Controls run with the branches disabled**, because a spec that passes without its mechanism
measures nothing: SPA fallback off → 2 of 4 serving specs fail and both control specs still pass;
probe scoping off → the 14-error control fails; URL construction off → both navigation specs fail.

## 9. The human read — F5, F6, and "worth completing"

Done per step, as §4 required. The summary first: **F6 is where these lessons are weak, it is weak
in one direction, and the direction has a cause.**

**Five steps across four lessons check less than their prose asks for.** In every case the condition
is the *lenient* one:

| Step | Prose asks for | Condition checks | Consequence if the learner does only what is checked |
|---|---|---|---|
| L1 step 4 | Font Size large **and Align X `center`** | both params are *set* | cosmetic — the heading is left-aligned |
| L2 step 2 | label, **Type = `json`**, and this JSON | type is `Static Data`, `json` is set | 🔴 **real** — Type left on `csv` gives an empty list three steps later |
| L3 step 2 | label the node **and set Label to `Add one`** | the node is a Button | cosmetic — an unlabelled button |
| L4 step 2 | create the page **via the Router's Pages list**, then add the Text | the Text exists and says the right thing | 🔴 **real** — a component created outside the router is unreachable and step 4's navigation silently does nothing |
| L5 step 2 | add the Switch **and turn on On From Start** | the node is a Switch | mild — the text starts hidden, so step 4's "click and it appears" reads inverted |

🔴 **The cause is structural, not carelessness, and it is worth stating plainly:** **F2 punishes a
condition that is too strong and nothing punishes one that is too weak.** A condition that fails to
hold against the solution is a hard refusal; a condition that holds too easily is invisible to every
class. So the gradient an authoring model sits on points at under-checking, and it points there on
*every* lesson. F6 is the class that would catch it and F6 is human-only by definition.

⚠️ **L4's row is also a format gap, not only an authoring choice.** The thing that needed checking is
"the Router's `pages.routes` contains this component", and the vocabulary has no comfortable way to
say it — `paramsEqual` on a nested object with an array in it is the only route, and it is brittle
enough that no author would reach for it. This is the one place in the run where I could not have
written a better condition with the verbs available.

> ✅ **CLOSED 2026-08-16 (slice 4) — `routerLists`.** The gap is now a verb; §12.4 has the design, the
> control pair and what it cost. 🔴 **The rest of this table is untouched**, and deliberately: the
> other four rows are authoring choices that better authoring *could* have made, and no verb fixes
> the gradient that produced them.

**F5 (variant-blind):** thin. L3 step 5 demands the direct `currentCount → text` wire and would
reject an equally correct route through an Expression or String node; L1 step 3's exact-string
`paramsEqual` would reject `Hello, NodeGX ` with a trailing space and say nothing useful. Neither is
severe. F5 is the class this run is least able to speak to, because a single author writing both the
lesson and the "alternative" solution is not a source of genuine variation.

**Worth completing**, against the brief's own pedagogy list: **L1, L3 and L5 clean** — one idea, 3–5
steps, instruction before explanation, nothing outside the editor. **L2 clean but for the `type`
hole.** **L4 carries the router-registration hole**, which is the only one in the set that can leave
a learner with a lesson marked complete and an app that does not work.

So the ≥3 is met even on the strictest reading available: three lessons are clean on all three
clauses without qualification.

## 10. ✅ What this closes that was not criterion 3's job

**`create_lesson` over the real stdio transport — driven, and it works.** This was item 2 on the
phase's next-session list and was recorded as blocked on Richard.

- A server spawned as `node packages/noodl-mcp/dist/noodl-mcp.cjs <project> --allow-writes`, spoken
  to over newline-delimited JSON-RPC: `initialize` → `notifications/initialized` → `tools/list` →
  `tools/call`.
- 🔴 **The `lesson` group is deferred, so the first `tools/list` returns 20 tools and none of them is
  `create_lesson`.** It takes `find_tools({group: "lesson"})` to reveal them, after which
  `tools/list` returns 23. **Reaching the tool is a conversation, not a call** — a client that does
  not refresh on `notifications/tools/list_changed` needs `--all-tools`, which the server says
  itself.
- Every scorecard in §7 came back through that connection.

⚠️ **What it does not close.** Richard's **registered** servers still run a pre-slice-2 build and
cannot reach these tools; that needs a restart, or a repackage if one loads from `/Applications/…`.
Still his call. What is now known is that the tools work over a transport at all, which nobody had
established.

## 11. Limitations, revisited now that the numbers exist

§5 predicted the author bias would push the **first-pass rate up**. It did — 5 of 5 — and that
number should be read as an **upper bound**, not a measurement. Two specifics:

- I built every starter by **subtraction from the solution**, which is why the ghostwriting refusal
  never fired (§7). A model building two projects independently is much more exposed to it.
- I consulted `get_node_type` and `get_example` over the transport before authoring, which is what
  the brief instructs — but I also knew *which* traps to look for.

And the bias did **not** protect me from the one thing that mattered: a well-informed author still
shipped an F4-class defect on the first call, and the gate wrote it. **That is the strongest single
data point in the run**, precisely because it happened under favourable conditions.

⚠️ **The pedagogy grader was the author**, as declared. The §9 table is offered as rows a later
reader can disagree with individually rather than as a verdict.

## 12. What should happen next

1. ✅ **§8.1 CLOSED 2026-08-16** (`eff91029`), and it was the verdict change this said it was.
   `renderDefectCodes()` joins `countDrawnElements` in `lessondrawncount.ts` — one rule, both
   adapters — `WholeSolutionResult.renderDefects` carries the codes past the prose, and F4 fails on
   them as **`solution-renders-broken`**, kept separate from `solution-renders-nothing`.

   🔴 **Broader than this item asked for, on purpose.** Naming `dead-placeholder-text` would have
   left `empty-list`, `broken-image` and `content-not-visible` — all `error` in the harness today —
   in the identical hole, and excluded whatever it grows next. It reads the harness's own severity
   instead. `blank-render` is excluded because `rendered` already answers it: one defect, one
   accusation.

   ✅ **Graded as a control pair, not a case.** The new specs were re-run with the new branch
   disabled: **three fail, and all 25 pre-existing ones still pass**, so the branch is the only
   thing that moved. The pair is also pinned on *recorded* renders rather than invented ones —
   `phase55-replay-haiku` (68 drawn, several of them the word "Text") now reports
   `['dead-placeholder-text', 'broken-image']`, and `phase55-replay-sonnet`, the build phase 55
   calls correct, still reports `[]`.

   ⚠️ **One scope call made and worth knowing about:** the learner's "check my work" summary read
   *"Your app renders — 4 elements drawn, with no blocking problems"* over the same evidence. The
   sentence is fixed; **the verdict deliberately is not.** A learner mid-build has placeholders they
   have not filled in yet — that is what progress looks like — so failing them on these codes would
   be the "gate that rejects the correct answer" pointed at the one person who cannot argue with it.
   The authoring gate grades a *finished* solution; the two surfaces read one field and reach
   different conclusions from it, which is the point.

   ⚠️ **What it does not close: §8.2 is untouched**, so a defect on any page but the start page is
   still invisible — including to this new check, which can only see what the render rendered.
2. ✅ **DONE 2026-08-20 — §8.2 is closed**, and it fixed `render_report` and F4 together as this item
   predicted. 🔴 **It did not travel with CN-001.** Phase 69 closed 20/20 on 2026-08-18 with this
   recorded inside CN-001 as *"still OPEN"*, so the item outlived the phase that owned it and stayed
   reachable only from a closed task file. ⚠️ *A finding parked in another phase's task inherits that
   phase's lifecycle* — CN-001 was the right place for the fix and the wrong place for the ticket.
3. ✅ **§12.3 DONE 2026-08-16 (slice 4).** The brief now carries *"🔴 Check what your prose actually
   asked for"* — the gradient named out loud, with the one question to ask (*if the learner does only
   what the conditions check, does the app work?*) and the two shapes it took in this run: **you told
   them a value and checked only that something is set**, and **you told them a route and checked the
   destination**. Two specs pin it; a brief that quietly dropped the sentence would leave §9's
   finding with nothing acting on it.

   ⚠️ **The brief's F4 paragraph was also stale and is corrected in the same change.** It read *"a
   solution that validates and draws nothing on screen"* — true before slice 3, and since then F4
   also fails on what the render says about what it *did* draw. It now says so, **and says out loud
   that F4 renders the start page only** (§8.2), so an author of a multi-page lesson is told their
   subject is unscored rather than left to infer it. A model authoring against the older sentence
   would have read a rendered page as a scored one.
4. ✅ **§12.4 DONE 2026-08-16 (slice 4) — `routerLists`.** The one hole in the run that better
   authoring could not have closed now has a verb:

   ```json
   { "routerLists": "/#__page__/About" }                          // any router lists it
   { "node": "App:%Router", "routerLists": "/#__page__/About" }   // that one does
   ```

   ✅ **Graded as the control pair the finding actually was**, because the finding was never "a
   lesson was wrong" — it was *"two projects that differ in whether the learner's app works score
   identically."* Both arms are in the spec: the same About page, the same heading, differing only in
   the router's `routes` array. The old condition **passes both** (asserted, as the finding rather
   than as a regression guard); the verb separates them. Re-run with the evaluation branch disabled:
   **14 of the 25 new specs fail and all 251 pre-existing pass**, so the branch is the only thing
   that moved.

   🔴 **Three judgements inside it worth not re-deriving:**

   - **`node` is optional, and that is the design, not a convenience.** Unscoped it asks the question
     the learner's app cares about — *is this page reachable from anywhere* — without making the
     author address a Router node whose location they may not know, and without handing them a
     `%Router` type-only path that F3 would then have to argue about. Scoped, it names one router,
     which a lesson teaching a Page Stack or nested routing needs. It compiles to **no `path` key at
     all** rather than `path: ''`, which would resolve to no component and make the condition
     permanently false — a silent never-completes, the class F1 exists for.
   - **The semantics are borrowed, not restated.** `ROUTER_NODE_TYPES`, `readRouterPagesValue` and
     `isSamePage` come from `pageRegistration.ts` — the module the editor's own apply path writes
     `routes` with. 🔴 **The purity claim was measured rather than asserted**, because the fifth
     amendment in [RULINGS.md](RULINGS.md) is precisely about a module-header claim nobody could
     falsify: two sidecar builds back to back, with and without the import, are **5,911,294 and
     5,911,848 bytes**, and `readRouterPagesValue` is already present in the *control*. The edge
     costs **554 bytes of my own code and no new dependency**.
   - **It cost zero MCP tool surface**, which was the ⚠️ this item carried. `create_lesson` takes the
     manifest as an **opaque passthrough envelope** on purpose, so a new condition verb never reaches
     a tool schema. Argued from the diff rather than re-measured: `git diff --stat` over
     `noodl-mcp/src/tools/` and `instructions.ts` is empty, so no input to the budget changed. **The
     57 free tokens are still free, and phase 69's CN-006/CN-009 are not competing with this.**

   ⚠️ **One thing the control run found in my own spec, and it is the more useful half.** Two of the
   F2 tests asserted only `F2: 'fail'` — and *passed with the verb disabled*, because a condition
   that is false everywhere fails F2 too, for a reason that has nothing to do with the lesson. **A
   failure that would look identical if the mechanism were missing measures nothing.** Both now
   assert the finding **code** (`dead-on-solution`, `already-satisfied-in-starter`), which is why the
   control's failure count went from 12 to 14.

   ⚠️ **What it does not close: the authoring gradient is still one-directional.** The verb gives an
   author a way to say the thing; nothing makes them. That is F6, and F6 is human by definition —
   item 3 is the whole of the lever.

   > 🔴 **WHERE SLICE 4 ACTUALLY LANDED — it is not in a commit of its own.** All nine files were
   > staged and then swept into a **peer's** commit, [`43b2e521`](.) *"feat(fix-004): the Number()
   > operator and the log block, slices A and B"*, between `git add` and `git commit` — a sibling
   > session ran an all-paths commit in the same second. **Nothing is lost and nothing is wrong in
   > the tree**; the files in `43b2e521` are byte-identical to what was written and reviewed here.
   > What is wrong is the *record*: 674 lines of UNI-010 work sit under a phase-66 Blockly message.
   >
   > 🔴 **The consequence to act on, for whoever owns FIX-004:** `43b2e521` cannot be reverted or
   > re-authored without taking UNI-010 slice 4 with it. **Deliberately not rewritten** — rewriting a
   > commit another live session has just made, on a checkout that session is still working in, is a
   > worse hazard than a mixed message.
   >
5. ✅ **DONE 2026-08-16 (slice 5) — `derive_starter`, and this run is where its argument comes from.**
   Not on this list when it was written, because §7's zero-refusals line and §11's reading of it are
   what turned "not ergonomic" (slice 2's phrasing) into a defect worth building against: **every
   starter here was built by subtraction from the solution, the ghostwriting refusal fired zero times
   in five lessons, and that number is a property of my authoring route rather than of the trap.** A
   model building the two projects independently walks straight into it, because the natural way to
   author a lesson is to build the finished thing and describe it.

   `derive_starter({ solution_dir, starter_dir, manifest })` subtracts each graded step from a copy of
   the solution and **replays every graded step against what it produced**, writing nothing if one
   still holds.

   🔴 **The postcondition is measured rather than guaranteed, and that is deliberate.** A derivation
   that promised F2′ by construction would make the gate's F2′ check vacuous for every lesson authored
   this way — *a check that cannot fail is one nobody audits*. Replaying through the real evaluator
   keeps F2′ meaningful on a second, independent code path, and both arms are pinned: the derived
   starter passes it, the solution used as its own starter still fails it.

   ⚠️ **What it does not fix is §9's gradient** — a lenient condition now produces a lenient
   *starter* as well as a lenient check. The brief says so at the point of use; F6 is still the only
   thing that catches it.

   > ⚠️ **And the gate numbers split across the sweep, which is worth stating rather than smoothing.**
   > `test:main` **206 / 3196** was measured on slice 4 *alone* and is exactly the floor's 205 / 3171
   > plus this slice's one file and 25 specs — predicted, not discovered, and therefore attributable.
   > **HEAD after the sweep is 207 / 3211**, re-run rather than inferred; the extra suite and 15 tests
   > are the peer's `tests-unit/fix-004/blocks.spec.ts`. Neither number is wrong and they answer
   > different questions.

