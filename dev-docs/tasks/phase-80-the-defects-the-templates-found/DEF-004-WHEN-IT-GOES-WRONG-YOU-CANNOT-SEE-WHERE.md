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

## 4b. What is left

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
