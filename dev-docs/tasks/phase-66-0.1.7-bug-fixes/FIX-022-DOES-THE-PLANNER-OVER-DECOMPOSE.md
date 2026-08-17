# FIX-022 — does the planner over-decompose?

**Opened and measured 2026-08-16, session 41.** Filed as a new task rather than reopening FIX-006,
which closed on its own four acceptance criteria.

---

## Where this came from

The user-test report's **first** complaint was not the `var` and not the regex. It was that the AI
*"made a Script node **inside a component** for this"* — a component that, in the reporter's judgement,
should not have existed.

FIX-006 measured the other two halves and closed on them: zero Script nodes, zero `var`, zero regex
across 10 treatment sessions on two models. It said so explicitly, and said equally explicitly what it
could not reach:

> ⚠️ **The decomposition half of the report is out of reach here.** … `AuthoringSession` is handed its
> `componentPath` up front — the "should this be a component at all" decision belongs to
> `decomposition.ts` and the planner.

That decision belongs to `PlanningSession` and to `DECOMPOSITION_PLANNING`. This task is the
instrument for it, and the answer.

---

## The answer, in three sentences

✅ **The defect is real and reproduces.** On the shipped default model, **5 of 10** plans for a single
derived value create a whole component for it — against the doctrine's own stated counter-rule.

🔴 **AAQ-008's decomposition doctrine is not the cause.** The same request planned against the
pre-AAQ-008 prompt creates a component **6 of 10** times. The arms are indistinguishable.

🔴 **A three-sample cell said the opposite, and would have been published.** The grid's n=3 cell read
**3/3 treatment vs 1/3 control** — a clean, quotable "the doctrine causes it". Seven more samples per
arm, same instrument and same configuration, dissolved it. **§5 is about that, and it is the finding
most likely to matter outside this task.**

---

## 1. The instrument

`packages/noodl-editor/scripts/aix002-measure/plan-harness.ts` → `dist/fix022-plan.cjs`.

The real `PlanningSession`, the real `planningSystemPrompt()`, the real context builder and the real
plan validator, against the real 44-component `git-repo-utf8` corpus project, with a
directly-constructed Anthropic provider bound to `.env`. No Electron, no UI.

It is a sibling of the FIX-006 authoring harness in the same directory and shares its plumbing
(`shared.ts` — repo root, `.env`, provider construction) and its esbuild recipe including the
`AiAssistantStore` stub. 🔴 **That sharing is deliberate and not tidiness**: the stub is the thing s39
had to repair after the authoring harness sat broken for eight days, and a second copy of it would be
a second thing to get wrong the next time the client's imports move.

**Why the grade is cheap and objective here.** A plan is structured data. `AuthoringPlan.operations`
carries `kind` and `target`, so "did it create a component, and what did it call it" is a count and a
list of strings — not a reading of prose, and not a model grading a model.

⚠️ **`projectDocs: {}` is passed explicitly.** `currentProjectDocs()` returns `{}` headlessly anyway
(no provider is installed outside the editor), so this states the harness's real condition rather than
relying on it, and it keeps `doc` operations out of the decomposition grade. **A real user whose
project has `docs/` may get an extra `doc` operation; nothing here measures that.**

---

## 2. The corpus, and why each request has a stated oracle

"How many components did the planner create?" is not a grade — four creates is right for one request
and absurd for another. So each of the three requests in `plan-prompts.ts` carries an expected range,
**taken from the shipped prompt's own rules rather than from taste**: `DECOMPOSITION_PLANNING`'s
§"WHEN NOT TO FACTOR" (*"a single node; a wrapper with no name you would say out loud; a two-node group
used once"*) and its numeric trigger (*"three or more logic nodes cooperating on one job"*). A plan
breaking those breaks a rule the model was given, which anyone can check.

⚠️ **No request names a component, a node type, or a count** — the same discipline `fix006-string-math`
was written with. "Split it into three sections" would answer the question in the asking.

| slug | the request, in one line | expected creates | why |
|---|---|---|---|
| `trivial` | bigger article title, publication date underneath | **0** | Presentation only, on components that exist, naming no section. Any create is over-decomposition under any reading. |
| **`small-logic`** | show "4 min read", worked out from the body text length | **0** | 🔴 **The reported shape.** One derived value, below the doctrine's own three-node trigger. |
| `multi-section` | a settings page: edit profile, notification switches, delete account | **4–8** | Three sections a review would name out loud, plus the page, plus an `/App` update to register the route. |

🔴 **`multi-section` is not there to show the doctrine working — it is there to make a null readable.**
Running only the small request risks the worst outcome in this repo's experience: both arms plan zero
creates and it gets written up as *"no over-decomposition"* when what actually happened is that the
block never reached the model at all. §4 reports what that control actually did, which is not what it
was designed to do.

---

## 3. The two arms

🔴 **The control is the prompt BEFORE AAQ-008 — not the prompt with a hole in it.**

The obvious control is "delete `DECOMPOSITION_PLANNING` and send the rest", and it is wrong.
`planning.ts`'s HOW TO SCOPE bullet does not merely sit near the block; it **points at it by name**:

> *"Tight" is about relevance, not count — see COMPONENTS ARE THE UNIT OF GOOD WORK below, which is the
> other half of this rule and outranks any instinct to keep the number of operations down.*

Strip only the block and the control becomes a prompt carrying a dangling cross-reference to a section
that is not there — a state the product has never shipped. Any arm difference would then be
confounded: doctrine removed, or model confused by a broken reference?

AAQ-008 (`251a90f2`) changed exactly two things in `planning.ts`. It replaced

> `- Keep plans as small as the request allows. Two or three precise operations beat six vague ones.`

with the cross-referencing bullet, and it interpolated the block. **The control reverts both**, which
reproduces the last prompt that actually shipped without the doctrine. ⚠️ `DESIGN_PLANNING` arrived
later and is untouched by both arms.

**On the wire: 6,290 chars treatment, 3,992 control.** The difference is AAQ-008 and nothing else —
verifiable by anyone, with no API key:

```
node .../dist/fix022-plan.cjs --doctrine=on  --dump=/tmp/on.txt
node .../dist/fix022-plan.cjs --doctrine=off --dump=/tmp/off.txt
diff /tmp/on.txt /tmp/off.txt
```

`--dump` runs before the provider is built, so **the arms are checkable by someone who did not pay for
the run that produced the numbers.**

### The arms are gated, not merely careful

🔴 Every failure mode throws, in both directions — a control that silently failed to subtract would
produce two identical arms and read as *"the doctrine makes no difference"*, which is the exact false
negative the control exists to rule out. And the **treatment** arm sends the request untouched, so
nothing in it can go wrong silently: a prompt that had quietly stopped embedding the block would sail
through as "doctrine ON" and the whole grid would be comparing two controls. It is checked too.

✅ **The transform lives in `plan-doctrine-arm.ts` so a gate can hold it**, and
`tests-unit/phase-66/planDoctrineArm.test.ts` (**13 specs**, in `test:main`) checks it against the real
`planningSystemPrompt()` on every run — including that the control differs from the shipped prompt by
*exactly* the two AAQ-008 edits and nothing else. The reason is the one s39 wrote down: the harness is
in no `tsconfig` include, no jest project and no jasmine suite, and its only gate was a human choosing
to run it. **The transform is a set of hard-coded excerpts of a prompt other people edit** — the
failure should arrive when the prompt is reworded, not months later, mid-measurement.

✅ **The spec was checked in both directions**: with `revertToPreDoctrine` stubbed to a no-op, **7 of
13 go red**. A gate that cannot fail grades nothing.

---

## 4. What was measured

**Grid:** 2 models × 2 arms × 3 requests × n=3, plus a deepened `small-logic` cell at n=10 per arm.
**57 sessions**, all planned successfully, all valid. `claude-sonnet-5` is the shipped Anthropic
default; `claude-haiku-4-5` is the mid-tier probe, the same pair FIX-006 used. Effort `low`, as shipped.

### 🔴 The headline: `small-logic` on the shipped default, n=10 per arm

| arm | creates per session | rate |
|---|---|---|
| **doctrine ON** (shipped) | `1,0,1,0,0,0,1,1,1,0` | **5/10** |
| **doctrine OFF** (pre-AAQ-008) | `1,0,1,0,0,1,0,1,1,1` | **6/10** |

**The defect is real: about half the time, a single derived value gets its own component.** Every one
of those creates is a component named some variant of `Reading Time` or `Calculate Reading Time`, whose
stated intent is one computation — e.g. *"A small text component that computes estimated reading time
from the article body markdown (word count divided by average reading speed, rounded up) and renders it
as a short label like '4 min read'."*

**And the doctrine is not what causes it.** 5/10 against 6/10 is no difference at all.

✅ **The control arm's own prose corroborates the count**, which is worth more than the count alone.
One pre-doctrine session wrote its reasoning into the intent:

> *"Use a formula/expression node driven by the existing bodyTextMd input; **no new component needed
> since this is a single derived value, not a repeated or multi-node cluster**."*

That is the doctrine's counter-rule, applied correctly, by the arm that **was not given it** — while
the arm that was given it created the component. 🔴 **The counter-rule does not bind.** It is present,
it is numeric, it is stated in the same block, and it loses.

### The floor holds — this is not "the planner factors everything"

`trivial` planned **0 creates in all 12 grid sessions**, both models, both arms. The defect is
specific to work that has a *computation* in it, not to small work in general. That matters for any
fix: a blunt "factor less" instruction would be aimed at something that is not happening.

### ⚠️ The positive control did not do its job, and that limits everything above

`multi-section` was supposed to show the doctrine visibly firing, so that a null on `small-logic` could
be read as being about the model's judgement rather than about the block never arriving.

| model | doctrine ON | doctrine OFF |
|---|---|---|
| `claude-sonnet-5` | 5, 5, 5 | 5, **3**, 5 |
| `claude-haiku-4-5` | 4, 4, 4 | 4, 4, 4 |

**Both models find the three sections without being told to.** There is a ceiling: the request names
three things out loud, and a current model factors them either way. The single control-arm `3` on
sonnet is the only hint of a doctrine effect anywhere in the grid — and it is **n=3, the same sample
size that produced the false headline in §5**. It is not evidence.

🔴 **So the honest scope of this measurement is narrower than its design intended.** On this corpus, at
these sample sizes, **no arm difference was detected in either direction**. That is *not* the same as
"the doctrine does nothing" — the corpus has no request where a current model under-decomposes, so the
benefit AAQ-008 was written to deliver is **undemonstrated here rather than disproven**. What *is*
established is that the over-decomposition defect exists at ~50% on the shipped model and survives the
doctrine's removal, so **it is upstream of AAQ-008.**

### Haiku

`small-logic` on `claude-haiku-4-5`: **3/3 both arms** (n=3). Haiku creates the component every time
with or without the doctrine, and its `multi-section` counts are identical across arms. **On haiku the
grid separates nothing**, so nothing in it should be attributed to the doctrine either way.

⚠️ **Cost is `unknown` for every haiku session** — `claude-haiku-4-5-20251001` is not in the pricing
registry the harness reads, so `costUsd` comes back `null`. A reporting gap, not a measurement one.

**Cost:** **$0.32** across the 39 sessions that report one; 18 haiku sessions unpriced.

---

## 5. 🔴 The methodological finding: n=3 published the opposite answer

This is the part worth carrying out of the task.

The grid's `small-logic` cell on the shipped model read:

| arm | n=3 grid | n=10 |
|---|---|---|
| doctrine ON | **3/3** | 5/10 |
| doctrine OFF | **1/3** | 6/10 |

A pilot run before the grid had also created the component, making it **4/4** treatment. Three
consecutive creates in the treatment arm and one in three in the control is exactly the shape that gets
written up as *"the doctrine causes the reported defect"* — with a control arm, with a verified
subtraction, with a mechanism, and with a quotable prose corroboration sitting right there. **Every
quality check this repo asks for would have passed.** The instrument was not broken, the control was
not a no-op, the arms genuinely differed on the wire. The sample was just three.

Seven more samples per arm — same bundle, same configuration, no code changed between — moved it to
5/10 vs 6/10, and the effect vanished. Fisher's exact on 5/10 vs 6/10 is p = 1.0; on 3/3 vs 1/3 it is
p ≈ 0.4, i.e. **the n=3 result was never significant, and would have read as decisive anyway.**

✅ **What made this survivable was cost, not virtue.** A planning session is one turn and ~$0.004, so
deepening the cell cost about ten cents and four minutes. 🔴 **A per-cell n of 3 is a default worth
distrusting whenever the outcome is binary and the deepening is cheap** — and it is cheap far more
often than it looks, because the expensive part of these measurements is building the arms, not
sampling them.

⚠️ Note what this does **not** impugn: FIX-006's n=5 cells scored **0 across all 20 sessions** on their
criteria. A unanimous zero on a rate metric is a different claim from 3-of-3 on a coin-flip one.

---

## 6. What this task does not say

- **It does not say the doctrine should be removed.** The corpus cannot see its benefit (§4 ceiling),
  so removing it on this evidence would be trading a demonstrated null for an unmeasured risk.
- **It does not grade the authored graph.** Whether the created `Reading Time` component ends up
  containing a Script node is FIX-006's axis, and FIX-006 measured it: it does not.
- **Two models is not every model**, and the reporter's model is unknown.
- **One project.** `git-repo-utf8` is already heavily componentised (44 components), which plausibly
  primes the planner toward creating more. A flat project might behave differently.

---

## 7. Owed by Richard — one ruling

🟢 **The counter-rule does not bind. What should happen?**

The facts: ~50% of plans for a single derived value create a component for it; the doctrine's
§"WHEN NOT TO FACTOR" already forbids this in so many words; removing the doctrine does not fix it.

**(a) Accept it.** A `Reading Time` component is defensible — it is nameable, and it is reusable. The
report's complaint was arguably about the Script node inside it, which FIX-006 fixed.
**(b) Strengthen the counter-rule** so it binds: today it is prose in the same block that spends four
times as many words pushing the other way. The cheap version is a numeric floor stated the way the
positive rule states its trigger — *"a component whose whole job is one computed value is not a
component"*. ⚠️ **Cheap to write, and this harness measures it in ten minutes for ten cents** — the arm
plumbing is now reusable for any prompt edit, not just AAQ-008's.
**(c) Move it out of the prompt** and into `planAdvisories`, which already speaks to the model once and
to the human after — a create whose intent describes one derived value is a detectable shape.

⚠️ **Whatever is chosen, the fix must be measured against `multi-section` too** — the ceiling there
means it is currently the only guard against a "factor less" edit quietly undoing AAQ-008.

---

## 8. Gates

Taken this session, on this session's tree.

| Gate | Reading | When |
|---|---|---|
| **`noodl-editor` `test:main`** | ✅ **216 suites / 3363 tests, 0 failed** | **s41** |
| **`tests-unit/phase-66/planDoctrineArm.test.ts`** | ✅ **13/13**; **7/13 red** under a stubbed transform | **s41** |
| **`tsc` over `scripts/aix002-measure/*.ts`** (editor tsconfig) | ✅ **0 errors in harness files** | **s41** |
| **both bundles** | ✅ build clean; authoring harness smoke-tested past arg validation | **s41** |

⚠️ **`test:main` moved 214 → 216 suites and 3336 → 3363 tests since s40.** One suite and 13 tests of
that are this session's; the rest is peers'. **Re-measure; do not quote this figure as your own.**

**`test:ci` was not run, as a claim rather than a cost.** This session changed no editor source: two
new files under `scripts/`, one new file under `tests-unit/`, and a plumbing extraction within
`scripts/`. `test:ci` runs the jasmine specs under `packages/noodl-editor/tests/` and reaches none of
it. ⚠️ **If you edit `planning.ts` or `decomposition.ts` in response to §7, that reasoning does not
transfer.**

---

## 9. Reproducing this

```
node packages/noodl-editor/scripts/aix002-measure/build.mjs

# the arms, offline and free
node packages/noodl-editor/scripts/aix002-measure/dist/fix022-plan.cjs --doctrine=on  --dump=/tmp/on.txt
node packages/noodl-editor/scripts/aix002-measure/dist/fix022-plan.cjs --doctrine=off --dump=/tmp/off.txt
diff /tmp/on.txt /tmp/off.txt

# the headline cell, ~$0.09 and about eight minutes for both arms
for arm in on off; do
  node packages/noodl-editor/scripts/aix002-measure/dist/fix022-plan.cjs \
    --model=claude-sonnet-5 --doctrine=$arm --only=small-logic --repeats=10
done
```

⚠️ **`--model` is effectively required** — see the authoring harness's header for why the registry
default is no longer reachable through the stub.

Every session appends one JSON line to
`dev-docs/tasks/phase-66-0.1.7-bug-fixes/measurements/` — the full operation list with intents, the
grade, and the system-prompt length actually put on the wire. The intents quoted in §4 are read out of
those files, not transcribed from a terminal.

✅ It is plain Node and makes no editor process: **safe beside a live stack**, like `test:main`.

## ✅ RULED 2026-08-16 (session 42) — no numeric floor; the axis is REUSE, not size

Richard: *"I'd say no number. I sometimes create components with just one node inside, like a
function node, because I want to reuse that function in multiple places, or a 'pill' card with just
a group and a text for example."*

🔴 **Option (b), the numeric floor, is REJECTED — and it was s41's own recommendation.** A one-node
component is legitimate *when it is placed more than once*. A node count cannot tell that apart from
a component created for a single use, so any floor would forbid work the product owner does
deliberately.

🔴 **This retires the instrument's headline as stated.** The grade counted *"created a whole
component for that one derived value"* and **never checked how many times the plan places it**. By
this ruling, creation is not the defect — creation **for a single use** is. So **5/10 is an upper
bound on the real defect rate, not a measurement of it.**

✅ **Next step is a re-grade, not a build.** The 20 saved plans from s41 can be re-scored for
**instantiation count** with no new API calls. Only if a real single-use rate survives that is a rule
worth writing — and it must then be stated on the **reuse** axis (*"factor when it will be placed
more than once"*), which is what `DECOMPOSITION_PLANNING`'s positive rule already half-says, never on
node count.

## ✅ RE-GRADED 2026-08-16 (session 43) — the rate SURVIVES the reuse axis, 11/11 single-use

Re-scored the 20 saved plans (`measurements/…15-12-23…` ON, `…15-13-21…` OFF, both
`claude-sonnet-5`, slug `small-logic`, n=10 each) for **how many times the created component is
placed**. No API calls; the files were already on disk.

| arm | plans that create | of those, placed **once** | placed **twice or more** |
|---|---|---|---|
| doctrine **ON** | **5 / 10** (runs 1, 3, 7, 8, 9) | **5** | **0** |
| doctrine **OFF** | **6 / 10** (runs 1, 3, 6, 8, 9, 10) | **6** | **0** |

**Every creating plan is exactly two operations**: one `create`, and one `update` to
`/Visual Components/Article/Article` that places the new component **next to the author name** —
one parent, one site, no second placement anywhere in the plan. Ten of the eleven create a *visual*
component under `Visual Components/Article/`; OFF run 6 creates `Logic Components/Calculate Reading
Time` instead, and places that once too.

🔴 **So the ruling does not dissolve the finding — it sharpens it.** 5/10 and 6/10 were an upper
bound on the defect; measured on the reuse axis they are the defect, because the reuse that would
justify the factoring is absent in **every** case. There is a real single-use rate, and by §5's
ruling that is what a rule may address.

### ⚠️ Three bounds on this, stated because they would otherwise be assumed

1. 🔴 **The instrument is the plan's prose, not a graph.** A record carries `operations[].intent`,
   not an instance count — nothing here counted placements in a built project. "Placed once" is read
   from *one* operation doing the placing and its intent naming *one* site. An intent that quietly
   meant two placements would score as one; none of the eleven reads that way, but that is a reading.
2. 🔴 **One request, and it is a request with nowhere to reuse anything.** `small-logic` asks for a
   reading time beside the author name — a single site by construction. So this measures
   over-decomposition **where reuse is impossible**, which is the condition under which the ruling
   says creation is wrong. It says nothing about whether the planner recognises **genuine** reuse,
   because no arm contains any. ⚠️ **That is the missing control, and it is the one that prices the
   fix**: a rule pushing "don't factor for a single use" could damage exactly the case Richard
   builds on purpose, and there is currently no cell that would notice.
3. ⚠️ **n=10 per arm, and the ON/OFF gap is noise.** 5 vs 6 is one run. The doctrine is not measurably
   moving this.

### Reproducing the re-grade

```
node -e '
const fs=require("fs");
for (const f of process.argv.slice(1)) for (const l of fs.readFileSync(f,"utf8").trim().split("\n").map(JSON.parse)) {
  if (!l.grade.creates) continue;
  console.log(l.run, l.grade.createTargets, l.operations.map(o=>`${o.kind}:${o.target}`));
  l.operations.forEach(o=>console.log("   ",o.intent));
}' dev-docs/tasks/phase-66-0.1.7-bug-fixes/measurements/*15-12-23*.jsonl \
   dev-docs/tasks/phase-66-0.1.7-bug-fixes/measurements/*15-13-21*.jsonl
```

## ✅ THE REUSE CELL — BUILT + MEASURED 2026-08-17 (session 53)

The cell session 43 named as missing, and said was *"the one that prices the fix"*. It is a **guard**,
not a finding: before any rule is written against single-use factoring, there has to be a cell that
would notice the rule damaging the case Richard builds on purpose.

### 1. What was built

- **`reuse-available`** in `plan-prompts.ts` — the one corpus request where creating a component is
  **correct**. The same "Verified" badge is wanted at three sites that already exist: the article
  byline, a comment, and the profile card. ⚠️ It names three *places* and still names no component,
  no node type and no count of components — the same line `multi-section` draws.
- **`expect.minPlacementSites`** — the reuse half of the oracle. Set only on requests where reuse is
  genuinely available; on every other request reuse is impossible by construction, and demanding it
  would grade the request rather than the planner.
- **`plan-grade.ts`** 🆕 — the grader, extracted from `plan-harness.ts` for the reason the arm
  transform was: **`plan-harness.ts` calls `main()` at import, so nothing in it can be held by a
  spec.** It adds the placement metrics — `placements`, `singleUseCreates`, `reusedCreates`,
  `unplacedCreates`.
- **`tests-unit/phase-66/planGrade.test.ts`** 🆕 — **15 specs in `test:main`.**

### 2. 🔴 The placement metric is part prose, and the split is 5 / 6

Session 43's bound 1 said the instrument is *"the plan's prose, not a graph"*. That is right in
effect but not in cause, and the cause matters. LAS-006 (`cad33e6c`, **eight days before** s41's
run) gave `PlanOperation.instantiates` — *"component targets this one will place"*. Placement **can**
be structural. It usually is not filled: across s41's 20 saved `small-logic` plans, 11 created a
component, every one placed by exactly one update, and `instantiates` was present on **5 of those
11**.

🔴 **A structural-only grader would have scored the other 6 real placements as "created and never
placed" — an instrument blind spot arriving as a finding.** So a site counts on **either** signal and
the grade reports `structuralSites` / `proseOnlySites` separately, so a reader who distrusts prose can
read the structural number alone and see what rests on words.

✅ **Known-answer control: the mechanical grade reproduces s43's hand re-grade exactly.** Same
creating runs (ON 1,3,7,8,9; OFF 1,3,6,8,9,10), **11 creates, 11 single-use, 0 reused, 0 unplaced**,
evidence **5 structural / 6 prose-only**. The hand reading is now re-runnable.

✅ **Checked in both directions.** Three mutants, each applied with its diff printed back from the
file and the file restored byte-identical afterwards:

| mutant | result |
|---|---|
| prose evidence dropped (structural field only) | **3 specs red** |
| `unplacedCreates` merged into `singleUseCreates` | **1 spec red** |
| reuse oracle demands *every* create is reused | **1 spec red** |

### 3. What was measured

n=10 per arm, **arms interleaved pair by pair**, `claude-sonnet-5`, effort `low`, same corpus.

| `reuse-available` | doctrine ON | doctrine OFF |
|---|---|---|
| sessions that planned | **9 / 10** | **8 / 10** |
| created a component | **9 / 9** | **8 / 8** |
| …placed at all **3** sites | **9 / 9** | **8 / 8** |
| placed once (single-use) | **0** | **0** |
| within the oracle | **9 / 9** | **8 / 8** |

**Every one of the 17 planned sessions factored exactly one shared badge component and placed it at
all three sites.** Not one duplicated the markup into three components. The name is `Verified Badge`
in every session (three spellings, one of them `VerifiedBadge`). The doctrine moves nothing here
either: the arms are 9/9 and 8/8.

**Cost: $0.22** across 18 charged sessions — twice s43's estimate, because this request is bigger
than `small-logic`. ✅ Both arms archived in
`measurements/2026-08-17-fix022-reuse-{on,off}-claude-sonnet-5-n10.jsonl`.

### 4. 🔴 Three sessions failed on BILLING, and they would have read as the defect

The last pair of the grid, and one before it, returned
`Anthropic request failed: Your credit balance is too low`. **A session that never planned grades as
0 creates and fails `withinExpectation`** — which on this prompt is indistinguishable from *"the
planner refused to factor"*, the exact failure the cell exists to detect. Three instrument deaths
would have been reported as three findings.

✅ **Fixed in `summarise()`**: the oracle is now computed over `status === 'planned'` only, and the
excluded count is printed **with the provider's own note beside it**. ✅ **Exercised, not merely
written** — with the balance exhausted, a fresh run prints
`⚠️ 1 of 1 session(s) never planned — excluded from the grades below. First note: …` and no grade,
where before it printed `creates [0] … within 0/1`.

### 5. ⚠️ What this cell does and does not establish

- ✅ **It establishes a guard with a clean baseline.** 17/17 at the ceiling means any future prompt
  edit that makes the planner stop factoring for reuse shows up here immediately.
- 🔴 **It cannot show improvement, only regression.** 17/17 is the ceiling — the same shape as
  `multi-section`, and for the same reason. A rule that improved reuse behaviour would be invisible
  in this cell.
- 🔴 **It does NOT license "the planner is sensitive to reuse".** That would compare `small-logic`
  (~50% single-use factoring) against `reuse-available` (100% correct factoring) — two **different
  requests** differing in far more than whether reuse is available. Nothing here varied reuse
  availability while holding the request constant, so the tempting cross-cell conclusion is
  unmeasured.
- ⚠️ **One model, one project, one request.** Same bounds as §6.

### 6. 🟢 Still owed by Richard — the §7 ruling is unchanged and now safe to answer

The build queue for FIX-022 is empty. The evidence now says: single-use factoring runs at **5/10 and
6/10** where reuse is impossible (s41/s43), and **0/17** where it is available (s53). **Option (b)'s
successor — a rule stated on the reuse axis — can now be written and measured against a cell that
would catch it overshooting.** §7's (a) / (b) / (c) is still the open question.

⚠️ **And the account has no credit.** Any further measurement in this phase is blocked until that is
topped up.
