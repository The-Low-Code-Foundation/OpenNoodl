# NDA-009: Run Tasks — a contract you can see

## Metadata

| Field | Value |
|-------|-------|
| **ID** | NDA-009 |
| **Phase** | Phase 30 — Node Library Audit & Remediation (Track O) |
| **Tier** | 2 |
| **Priority** | 🟠 High — "a nightmare to set up, no information when it fucks up" |
| **Difficulty** | 🟢 Low–Medium — the cause is known and narrow |
| **Estimated Time** | 1–2 weeks |
| **Prerequisites** | None. §3 wants NDA-004's error channel |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟢 **Sonnet 5** |

## Objective

Stop Run Tasks failing silently when the task component does not happen to use the three magic port
names, and make the coupling visible on the canvas.

## The defect

Run Tasks drives its task component entirely by **string match**. The file says so itself:

> "there is no port wiring between the template and this node, which is why the signal names
> `'Success'` and `'Failure'` are matched by string below"
> — [`runtasks.ts:24-28`](../../../packages/noodl-runtime/src/nodes/std-library/runtasks.ts#L24-L28)

- It pulses an input literally named `'Do'`
  ([`runtasks.ts:234`](../../../packages/noodl-runtime/src/nodes/std-library/runtasks.ts#L234)).
- It listens for outputs literally named `'Success'` and `'Failure'`
  ([`runtasks.ts:347-351`](../../../packages/noodl-runtime/src/nodes/std-library/runtasks.ts#L347-L351)).

Name your component's output `Done` instead of `Success` and **nothing happens, forever, with no
warning**. The four existing `sendWarning` calls
([`runtasks.ts:246-258`](../../../packages/noodl-runtime/src/nodes/std-library/runtasks.ts#L246-L258))
cover other conditions and not this one — which is why the node reads as broken rather than
misconfigured.

Compounding it: `sendSignalOnInput(taskComponent, 'Do')` reaches into another component's scope to
pulse it. There is no wire, so **there is nothing on the canvas that explains the coupling**. An
author cannot see what Run Tasks expects of the template, and cannot see that the template does not
provide it.

## §1 — Validate the contract, loudly

When a template is selected, check it has an input named `Do` and outputs named `Success` and
`Failure`. If any is missing, warn immediately in the editor — at selection time, not at run time —
naming the missing port and what it is for.

This is the minimum viable fix and it closes corpus row F1 on its own. Ship it first; it converts a
silent dead end into a solvable problem.

## §2 — Make the contract selectable

Better than warning about three hardcoded names: let the author say which ports mean what, defaulting
to `Do`/`Success`/`Failure` so existing projects are unaffected. Three enum inputs populated from the
template's actual ports.

That also removes the class-D smell rather than papering over it — the contract becomes data the
validator can check, instead of a string literal buried in the runtime.

## §3 — Report per-task failure

Run Tasks aggregates. When one task in fifty fails, the author needs to know *which* and *why*, not
just that the batch failed. With NDA-004's error channel in place, surface per-task errors with the
item identity attached.

## §4 — Make the coupling visible

Design question rather than a fix: given CAN-001/CAN-002 (Phase 28) put labels and author text on
wires, is there a way to show the template contract on the canvas — a port summary on the Run Tasks
card, or a badge on the template component? An author should be able to see the coupling without
opening docs.

Recommend a summary on the node card listing the three resolved port names and whether each was
found. Cheap, and it makes §1's warning redundant in the good case.

## Success criteria

1. Corpus row F1 green — a mismatched template produces a warning naming the missing port.
2. Existing projects using `Do`/`Success`/`Failure` are unaffected; verify against the QA fixture.
3. A failing task reports which item failed and why.
4. The semantic validator can check the Run Tasks contract, which it cannot today.
