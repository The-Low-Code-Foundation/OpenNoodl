# DEF-004 — When it goes wrong you cannot see where

**Rank 4.** Sources: phase 77 **D2** and **D3**. Both **NONE**-owned.

Two rows about the same moment: a cloud function did the wrong thing, and the product cannot say
which node, or even that anything was wrong.

## 0. Driven first, 2026-08-29 — and the file was right about (a), which is not the same as measured

Last session's rule: **find the claim that is a reading rather than a measurement and drive that
one first.** §1's *"one step per author `Log` line and nothing else"* was read out of
`WorkflowRunner.createLogSink`. It is now driven — three real functions through a real
`BackendService`, reading `executions.sqlite`:

| graph | HTTP | record `status` | `steps` |
|---|---|---|---|
| Request → UUID → UUID → Response (**no Log**) | 200 | `success` | **`[]`** |
| the same graph with **one Log spliced in** | 200 | `success` | **1**, `nodeId: log`, `net.noodl.Log` |
| Request → Secret(**never provisioned**) → Response **on the `failure` edge** | 200 | **`success`** | **`[]`** |

✅ **§1's reading holds.** Unlike DEF-003's rows, this one measured true: the recorder is reachable
from the cloud path, and a `Log` line is the only thing that reaches it.

🔴 **The third row is the finding, and it is not in this file.** A run in which a node **failed** —
`secret/unavailable` — is recorded as **`status: "success"` with zero steps**. Two separate reasons,
and both need naming:

1. The execution record's `success` is derived from **the HTTP status code alone**
   (`WorkflowRunner.run`: `statusCode >= 200 && < 300`). A graph that wires `failure → Response`
   answers 200, so the record says the run succeeded. That is AC1's *"tells me it worked when it
   did not"* arriving at the **record**, not only at the `completed` port — (a) and (b) are one
   defect seen from two ends.
2. **The information already exists, fully attributed, and is thrown away.** `reportOutcome`'s
   failure path raises on the error bus, and the raised event carries exactly the columns
   `execution_steps` has empty:

   ```
   {"nodeId":"sec","componentName":"/#__cloud__/failing",
    "nodeType":"noodl.cloud.secret","code":"secret/unavailable","message":"Secret: …"}
   ```

   In the cloud runtime the only subscriber is `createConsoleErrorSubscriber` — a bare
   `console.error`. Not the structured logger, no request id, no execution record. **Captured in
   the drive**, so this is measured too.

⚠️ **The error bus is the WRONG channel to fix this on, and it is worth saying why before someone
tries.** It hangs off `NodeContext`, which is **one per `CloudRunner`**, and two cloud functions
run concurrently in that one context (`runcontext.ts` says so, and
`cloud-array-vocabulary.test.ts` pins it). A bus subscriber cannot tell whose request an event
belongs to. The channel that can is the one CWF-013 already built for exactly this reason:
`NodeScope.runContext`, set per request and inherited down every component instance.

✅ **So the seam is `Node.prototype.beginOutcome` / `reportOutcome`** — per **invocation**, already
carrying `done` / `unchanged` / `failure` plus a code and a message, and with `this.nodeScope` in
hand to reach the run. Every action node in the product goes through it. §3.1's *"record a step per
node"* is therefore **a step per action invocation**, which is also the only reading of it that has
a status to record: a `String Format` does not succeed or fail.

🔴 **Two producers now meet at one table.** The `Log` step written by `createLogSink` and the
outcome step written for the same `Log` node are the same row twice — *a check in a second pipeline
is a duplicate first.* One producer, and a spec that **asserts the cardinality**.

## 1. (a) `execution_steps` records what the author logged, never what the graph ran

🔴 **The cause recorded in phase 77 D2 is wrong, and this is the third wrong reading of this row.**
D2 says step recording *"is wired to the workflow engine, and a cloud function's graph is run by a
different executor that never calls it."*

**Measured at HEAD:** the cloud function path **does** call the recorder.
`packages/nodegx-backend/src/workflow/WorkflowRunner.ts:261` sits inside the **`Log` node handler**:

```ts
if (execLogger) {
  // A step per line, started and completed in the same breath
  const stepId = execLogger.startNode({
    nodeId: (entry && entry.nodeId) || 'log',
    nodeType: 'net.noodl.Log',        // ← hardcoded
    ...
  });
  execLogger.completeNode(stepId, true);
}
```

So a cloud function writes **one step per author `Log` line and nothing else**. The site-builder
template contains **zero** `Log` nodes (`site-builder.content.json`, `grep -c net.noodl.Log` → **0**),
which is the entire explanation of the SBR-006 drive's *"3 executions, 0 steps"*.

✅ **This makes the fix smaller than D2 assumed.** The recorder is already reachable from the cloud
path with a live `execLogger`. What is missing is a call where the graph **steps**, not a second
executor.

⚠️ **`ExecutionLogger.startNode`/`completeNode` are complete and correct.** Neither the logger nor
the schema is the defect — `node_id`, `node_type`, `node_name`, `step_index`, `status`,
`error_message` are all there and unused.

## 2. (b) `completed` reads as success, and the product has already been told so once

`outcome.ts`: `completed` *"fires after every invocation, whatever the outcome"*. Wired into a record
write or a Response's `send` it therefore reports success **after a failure**. In the shipped
site-builder it was wired into both — `publishPage` marked a page `published` after a run that set
no section's access rules.

> 🔴 **CORRECTED 2026-08-29 (s6). The paragraph above is written in the present tense about a state
> that ended the day before, and that tense is what gave AC4 its wrong shape.**
>
> **SBR-015 (`48ad4dfc`, phase 77, 2026-08-28) already repaired both wires in the template**, changing
> them to `done`. Measured at HEAD: `publishPage` has **zero** `completed` wires; the wire that marks
> the page published is `RunTasks.done → SetDbModelProperties.store`, and `RunTasks.failure` and
> `.unchanged` both reach a refusal Response. The whole shipped template carries exactly **two**
> `completed` wires, and neither is `publishPage`'s.
>
> This is the third wrong reading of this row (§1 records the first two), and it is the same shape
> each time: **the file was read, the artefact was not.** *Measure the artefact, not the task file* —
> and when a task file states a defect in the present tense, `git log` the artefact before believing
> the tense. What survived correction is the *mechanism*: `completed` into a commit is a real defect,
> it really did ship, and §4c builds the rule for it. What did not survive is AC4's list of targets.

🔴 **This is a recurrence, not a discovery.** `outcome.ts`'s own FH-022 / TALK-006 note records
Richard hitting the `done`/`completed` pair on `Condition` and reading two identically-behaving ports
as the vocabulary doubling up. **The repair then was wording.** This is the same confusion arriving
with a data-integrity consequence, which is the evidence that the wording fix did not reach far
enough.

## 3. Scope

1. **Record a step per node** on the cloud-function path, using the recorder that is already wired
   in. The `Log` handler's step stays; it stops being the only one.
2. **A rule about where `completed` lands** — `completed` reaching a record write or a
   `noodl.cloud.response.send` is a diagnostic. Belongs beside DEF-002's rules, same door, same run.

⚠️ **Do not "fix" (b) by banning `completed`.** Two uses in `outcome.ts` are correct and documented:
an unprovisioned secret must still reach the picker, and a bounced mail must still answer the
visitor. **The rule is about where it lands, not about the port.**

## 4. Acceptance criteria

1. **A person's sentence:** *when my published page comes back wrong, I can see which step did it —
   and the app does not tell me it worked when it did not.*
2. A cloud function invocation writes **one step per node executed**, with `status` and, on a
   failure, `error_message`.
3. Driven, not asserted: **run the SBR-006 drive's `publishPage` and read `executions.sqlite`** —
   the row that said *3 executions, 0 steps* now names the node.
4. A graph wiring `completed` into a record write is refused **by name**; the two legitimate uses in
   `outcome.ts` are **accepted** in the same run. 🔴 That pair is the whole test — a rule that
   refuses both has banned the port.
5. Mutation-graded.

## 4a. What was built — (a) CLOSED 2026-08-29, (b) still open

**The seam is `Node.beginOutcome` / `reportOutcome`, on `NodeScope.runContext`.** A step is opened
when an action starts and closed when it reports, carrying `done` / `unchanged` / `failure` and, on
a failure, the code and message. `NodeRunContext` gained `beginStep` / `endStep`;
`WorkflowRunner.createLogSink` became `createRunContext` and fills them from the `ExecutionLogger`
that was already there.

| | before | after |
|---|---|---|
| Request → UUID → UUID → Response | `[]` | 3 steps, named, in order |
| the real `publishPage`, SB-015's seed | 0 steps | **6 steps**, including the `Run Tasks` **worker**'s |
| Secret unprovisioned, handled on `failure` | `success`, `[]` | `success` + **one `error` step** naming `sec` and why |

✅ **AC2, AC3 and AC5 met.** `def004-execution-steps.test.ts` (9) and
`def004-publish-page-steps.test.ts` (5). Five mutants, all killed: the step never opened
(**11 red**), the bridge removed (1), the duplicate guard disarmed (2), the log sink writing its
own row again (1), `endStep` always reporting success (2).
🔴 **AC4 — the `completed` rule at the door — is NOT built.** (b) is untouched; see §4b.

### What it does not see, said plainly

🔴 **A step is an action invocation. A node that neither succeeds nor fails records nothing.** A
`DbCollection2` that returns rows is invisible in the record; the same node *failing* is visible,
through a second bridge in `raiseRuntimeError` for the population that never adopted the outcome
contract (`Static Data`, `DbCollection2`, every Function node's value-driven path — eighteen
std-library modules). **So the list is: every action, plus every failure.** A query that quietly
returned the wrong rows is still not in it. That is a real gap and it is the next thing to argue
about, not a detail.

⚠️ **The execution's own `status` is still derived from the HTTP answer alone, deliberately.** A
graph that wires `failure → Response` and answers 200 did not fail; what was missing was the row
underneath. Both halves are pinned by name in the suite so the choice cannot drift into an
accident.

### 🔴 Three things this cost, that the next reader should not re-buy

1. **A mutant that killed nothing was the finding, and it was MY spec that was wrong.** The arm
   labelled *"a node that never adopted the outcome contract"* used a `JavaScriptFunction` that
   throws, chosen off a `sendSignalOnOutput('failure')` grep hit. `simplejavascript.ts` has
   **both** paths, and its signal-driven `run` goes through `beginOutcome` — so the spec was a
   second test of the outcome path wearing a label that said otherwise, and removing the bridge
   entirely still passed 14/14. **A population derived from one grep is a hypothesis about the
   population.** `Static Data` is the honest arm.
2. **Adding a method to `Node.prototype` broke fourteen specs at once.** The duplicate guard was
   first written as a `_reportOutcomeSignals` helper; several suites build a node as **a bag of
   bound prototype methods** and never construct one, so the call was simply absent. The guard is
   inline now, and the reason is in the code. **`Node.prototype` is a published surface to the
   spec population, not only to the product.**
3. **Two wrong instruments before the right one, on the same assertion.** "The steps are the
   graph's own nodes" was first checked against ids typed out of `site-builder.content.json`, then
   against `SB004_COMPONENTS`. Both went red on ids the run really did produce: **the MCP door
   rewrites node ids on write** (`sections` → `sections-3`, `page` → `page-8`), and `Run Tasks`
   instantiates its **worker** inside the run, so the worker's nodes belong in that record. Only
   the **deployed bundle** could answer. ⚠️ **The template file and an authored project therefore
   carry different node ids for the same function** — noted here because anything that joins a
   record back to a canvas has to know that.

## 4b. What was left after (a) — ✅ **CLOSED by §4c, 2026-08-29**

- **AC4 — a rule about where `completed` lands**, beside DEF-002's rules (they live in
  `packages/noodl-editor/src/editor/src/validation/diagnostics.ts`, not in `noodl-mcp`).

  🔴 **AC4 contradicts itself, and the measurement is below.** It asks for `completed` reaching a
  record write **or a `noodl.cloud.response.send`** to be refused by name, while requiring the two
  documented legitimate uses to be accepted in the same run. **Those two uses are not in
  `outcome.ts`** — that file holds the port's *wording*, no graphs — they are in the shipped
  site-builder, and every `completed` wire in every shipped template is one of them:

  | template component | from | to |
  |---|---|---|
  | `/#__cloud__/site/ContactRecipient` | `noodl.cloud.secret` | `JavaScriptFunction.run` |
  | `/#__cloud__/submitContactForm` | `noodl.cloud.sendemail` | **`noodl.cloud.response.send`** |

  The second is the one AC4 names as the defect. *An unprovisioned secret must still reach the
  picker* and *a bounced mail must still answer the visitor* — the second **is** a `completed`
  into a `send`, and refusing it bans the port on the only graph that ships it.

  ✅ **So the rule is not about the target node type.** What distinguishes SBR-006's defect from
  `submitContactForm` is what the wire *claims*: `publishPage` marked a page `published` — it
  wrote a **success fact** about work that may not have happened. Answering the caller regardless
  is the port working as designed. The rule has to be about a `completed` reaching a **write**
  whose payload asserts the outcome, not about `send`. 🔴 **Two of three shipped `completed` wires
  would be false positives under AC4 as written — measure the corpus before writing the
  predicate, and treat AC4's target list as a hypothesis.**
  ⚠️ **The blocking arm has NO positive instance in any shipped template** (zero `completed` wires
  into a record write), so it needs a deliberately-malformed probe graph — the same shape DEF-002
  left two of behind.
- **AC1's second half is only half-served.** The steps now say which node failed. Whether the
  *record* should say a run "succeeded" while carrying an `error` step is the argument §4a leaves
  open, and it is the same argument (b) is about one layer up.
- ⚠️ **Nothing drives `MAX_STEPS_PER_RUN`** (1000, announced once as `function.steps.suppressed`).
  Named rather than left silent; a graph that reaches it is a `Run Tasks` loop and building one in
  a spec costs more than the cap is currently worth.

## 4c. (b) CLOSED 2026-08-29 — the rule, and why it is not the rule AC4 asked for

**`completed-commits-unchecked`**, at
`packages/noodl-editor/src/editor/src/validation/rules/completedCommitsUnchecked.ts`, registered
immediately after `failureReachesNothing` and promoted into `AUTHORED_BLOCKING_WARNINGS`.
`def-004/completed-commits-unchecked.test.ts` — **21 specs**.

### 🔴 The predicate, and the four instances that chose it

§4b was right that AC4 contradicts itself and **still had the wrong replacement**. It proposed
*"a `completed` reaching a **write** whose payload asserts the outcome"*. Driven: that does not
separate the corpus either. `publishPage`'s `published` flag and `submitContactForm`'s `received`
flag are both booleans, both committed by a `completed`, and **both come from a node that is not
downstream of the completing one**. On payload provenance they are identical.

All four shipped instances, on every structural axis:

| wire | commit? | failure routed to the **same** commit? | |
|---|---|---|---|
| `publishPage` `RunTasks.completed → Set….store` | yes | **no** — sole wire | ❌ defect |
| `duplicatePage` `RunTasks.completed → response.send` | yes | **no** — sole wire | ❌ defect |
| `submitContactForm` `sendemail.completed → response.send` | yes | **yes** — `save.failure`, `stored.failure` | ✅ correct |
| `ContactRecipient` `secret.completed → JavaScriptFunction.run` | **no** | — | ✅ correct |

✅ **The discriminator is whether a Failure route reaches the same commit.** Where one does, the
author **has** enumerated the bad outcomes and `completed` is genuinely the carry-on-regardless leg
the port is for. Where none does, `completed` is not supplementary — it is the only exit, used as
if it meant success. `submitContactForm` proves it: `received` is set by `stored`, which runs on
`save.done`, so `received: true` means *the message was stored* and a bounced mail does not make it
false. That graph is correct, and AC4 as written refuses it.

🔴 **AC4's target list was a hypothesis and is now a permanent arm.** The spec keeps AC4's own words
as a predicate and asserts it fires on `submitContactForm` — the graph the same criterion requires
it to accept. **SBR-015's template gate escapes the contradiction only by also requiring
`type === 'RunTasks'`**, a hand-list wearing a predicate: its comment says the rule is about where
the wire lands, its code is about the source node type, and the two disagree. It cannot see the
same defect from a `sendemail` or a `DbModel2`. The probe graph in the spec is exactly that case.

### ✅ Not a duplicate — measured before it was written

*A check in a second pipeline is a duplicate first.* Run against the real pre-SBR-015 graphs,
`failureReachesNothing` fires on `prep`, `prep-2` and `afterCopy` — the `JavaScriptFunction`s — and
**never on the `RunTasks` carrying the `completed` wire**, because `prep.out-pageId →
res.pm-pageId` answers the caller without passing through it, so `answeredWithout` excuses it. The
two rules ask different questions and this one covers the hole in the other: DEF-002's asks *is the
caller answered at all* (a 30s hang); this defect answers the caller perfectly well, with a lie.
Both arms are pinned, including a known-firing control — `expect([])` from a rule that never speaks
proves nothing.

### ✅ The corpus, and the blocking promotion it justifies

`scripts/def-004-corpus-completed.ts` (`npm run calibrate:completed`). Over **179 projects and 319
cloud-function components**:

| | |
|---|---|
| `completed` wires reaching a commit | **34** |
| refused | **20** |
| accepted | **14** |
| false positives | **0** |

The split is exact. The 20 are `publishPage`/`duplicatePage` in ten copies of the site-builder
predating SBR-015, every one carrying literally the wire that task repaired — true positives by
construction, since the repaired template spells it `done`. The 14 are all `submitContactForm →
send`. 🔴 **The second corpus's zero is explained rather than bare**: 82 further projects hold 257
cloud-function components and **no `completed` wires at all**. `completed` is a rare port — authors
reach for `done` — so the blast radius of making this blocking is small, and that is measured.

⚠️ **The honest limit on this denominator: 15 of the 17 projects with any `completed` wire are
copies of one template.** The rule is calibrated against one author's habits. The 257-component
corpus is what stops that being invisible, not what fixes it.

### ✅ AC5 — mutation-graded, 8 mutants, 8 killed

The failure-route guard disarmed (5 red) · commit narrowing removed (1) · cloud scope removed (1) ·
reachability made untargeted (4) · `unchanged` dropped from the negative set (1) · `done` graded
instead of `completed` (7) · direct failure wires not seeded (4) · the catalog check inverted (7).

🔴 **`unchanged` killed nothing on the first run — that was the finding.** It was in the rule and
exercised by no arm. It belongs there (`RunTasks` fires it on an empty list, and the shipped
`publishPage` routes it), so the arm was added rather than the port removed, with a negative
control beside it: a `done` wire into the same commit does **not** clear the finding.

### 🔴 Three things this cost, that the next reader should not re-buy

1. **A literal NUL byte in a template literal made the file invisible to `grep`, and I "fixed"
   the wrong thing.** The composite Map key was written `` `${a}\0${b}` `` — which is the **house
   idiom** (`author.ts` keys connections that way, `unlabelledNode.ts` uses `'\0root'`, five files
   in all) and is *correct*: a node id or a derived port name can contain a space, and two pairs
   must never collapse to one key. But a literal NUL makes `grep` call the whole file binary and
   **return nothing at all, with exit 0** — which is how three mutants silently failed to apply.
   The fix was not to remove the NUL but to write it as the `\0` **escape**: same value, greppable
   file. ⚠️ **I first read the deliberate idiom as corruption**, because my instrument had lied
   about the file and I doubted the file rather than the instrument.
2. **A mutation harness needs an assert that the mutant applied.** Three of eight silently did not
   (zsh ate the backticks, then the NUL). Without `assert old in s`, that run reads as *"three
   mutants killed nothing"* — a finding about the rule, when it was a finding about the harness.
   *A mutant killing nothing is the finding* only once you know it ran.
3. **The task file's tense was the defect.** §2 described a state SBR-015 had ended the previous
   day, in the present tense, and AC4 was written from it — which is how a criterion came to demand
   a rule that refuses the one graph it also requires be accepted. **`git log` the artefact before
   believing a task file's tense.**

### What is still open

- **AC1's second half.** The steps say which node failed; whether the *record* should say a run
  "succeeded" while carrying an `error` step is still the argument §4a left open. Unchanged by this.
- ⚠️ **The rule is cloud-only, deliberately.** A browser-side `store` fired on `completed` is the
  same shape in front of somebody who can see it did not work, and the browser population is large
  and uncalibrated. Widening it is a separate measurement, not a one-line change.
- ⚠️ **`noodl.cloud.sendemail`'s `send` is not treated as a commit**, though it is a signal input
  spelled the same as a Response's. Sending a mail asserts no fact about upstream work. Named in the
  rule and pinned by a spec so the decision cannot drift into an accident.

## 5. Traps

- 🔴 **This row has now been diagnosed wrong three times, each time from the caller list rather than
  from the caller.** Read `WorkflowRunner.ts:261` in place before believing any statement about what
  the cloud path does or does not call.
- ⚠️ **`execution_steps` being empty is not evidence the writer is missing** — a template with no
  `Log` nodes produces an empty table through a working writer. **Reconcile against a graph that
  does have one** before concluding anything.
- 🔴 **The drive artefact still exists**: `SBR-006 Admin Drive` (backend `backend_mtdg3sdziq5nw`,
  token `drive-token-sbr006`) holds s9's three calls. That is the before-arm; do not overwrite it.
- 🔴 `completed` is **the one outcome port that cannot mean success**. Any spec asserting success by
  watching `completed` is asserting the defect.
