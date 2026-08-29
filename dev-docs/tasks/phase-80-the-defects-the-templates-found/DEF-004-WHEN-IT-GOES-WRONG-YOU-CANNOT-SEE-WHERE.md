# DEF-004 — When it goes wrong you cannot see where

**Rank 4.** Sources: phase 77 **D2** and **D3**. Both **NONE**-owned.

Two rows about the same moment: a cloud function did the wrong thing, and the product cannot say
which node, or even that anything was wrong.

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
