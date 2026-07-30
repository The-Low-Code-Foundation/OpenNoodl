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

## §2 — Make the contract selectable — **done 2026-07-30**

Better than warning about three hardcoded names: let the author say which ports mean what. Default to
`Do`/`Success`/`Failure` because that is the right default for a *new* task template — not to protect
existing projects ([`COMPATIBILITY-POLICY.md`](../../reference/COMPATIBILITY-POLICY.md)). ~~Three enum
inputs populated from the template's actual ports.~~

That also removes the class-D smell rather than papering over it — the contract becomes data the
validator can check, instead of a string literal buried in the runtime.

> **Correction, written in place after building it: the enums are wrong, and criterion 4 is why.**
> An enum whose options come from another component has to be sent with `sendDynamicPorts`, and that
> is exactly what marks a node as having dynamic ports. `nonexistentPort.ts:73` then **skips** every
> port check on that node rather than reporting it — so the change intended to let the validator
> check this contract would have stopped it checking any of Run Tasks' ports at all. Static ports are
> also what `node-catalog.json` carries, which is what makes the feature reachable by the AI
> authoring loop; NDA-006 §3 made the same trade-off for the breakpoint ports.
>
> Shipped as **four static string inputs** — `taskStartInput`, `taskSuccessOutput`,
> `taskFailureOutput` and `taskErrorOutput` (§3's, optional) — all `allowEditOnly`, resolved through
> one `TEMPLATE_CONTRACT` table in `runtasks-template-contract.ts` that the runtime and the
> editor-time check both read.
>
> **The affordance moved rather than being dropped.** `checkTemplateContract` lists the ports the
> template actually has (`… it has "Done", "Broke"`), which does the dropdown's job and also covers
> one it could not: the author who renames the port on the *template* afterwards, and is not looking
> at the node they have broken.

## §3 — Report per-task failure — **done 2026-07-30**

Run Tasks aggregates. When one task in fifty fails, the author needs to know *which* and *why*, not
just that the batch failed. With NDA-004's error channel in place, surface per-task errors with the
item identity attached.

> **Built, with one thing the spec could not have known: "why" cannot come from this node.** The
> template's completion signal is a bare signal and carries no payload, so the only source of a
> reason is the template itself. One `run-tasks/task-failed` is raised per failing task with
> `itemIndex` and `itemId` (`Task 3 of 50 failed`), and the value of the template's `Error` output is
> attached when it has one.
>
> **That fourth port is optional and never warned about**, on §1's own grading reasoning one port
> further out: a task component that cannot explain its failures is a legitimate shape, and requiring
> the port would be the "a `Failure` port on a node that cannot fail" mistake again.

## §4 — Make the coupling visible

Design question rather than a fix: given CAN-001/CAN-002 (Phase 28) put labels and author text on
wires, is there a way to show the template contract on the canvas — a port summary on the Run Tasks
card, or a badge on the template component? An author should be able to see the coupling without
opening docs.

Recommend a summary on the node card listing the three resolved port names and whether each was
found. Cheap, and it makes §1's warning redundant in the good case.

> ### ✅ Done 2026-07-30
>
> The recommendation, built. `checkTemplateContract` now also writes the node-card **sub-label** —
> the slot NDA-015 §3 added and `resolvedtarget.ts` established the rules for — so a working Run
> Tasks node reads `/Task: Do → Success / Failure` on the canvas. §2 is what made this cheap: the
> three port names became node parameters resolved through one `TEMPLATE_CONTRACT` table, so there
> was already a single place that knew what the node would look for.
>
> **Only on success**, which is `resolvedtarget.ts`'s decision applied unchanged: a node with a
> problem gets no sub-label, because the warning channel is already reporting it and two reports of
> one fact on one card is noise. Using the same slot as clause (b) of the Binding Contract means the
> two features cannot disagree on a card.
>
> **The names are spelled out even at their defaults.** Suppressing them when nothing was customised
> would hide the contract from the only author it is for — someone who has never read the docs does
> not know there *is* one. The optional `Error` output is listed only when the template has it, since
> naming an absent port would read as a problem and I12 already fixed that its absence is not one.
>
> Seven rows (L1–L7). L2 is the one that makes L1 mean anything — with defaults everywhere an author
> who guessed the convention would be right regardless — and L7 pins that the sub-label is *cleared*
> when a working template is broken, not merely not re-set, since a card advertising a contract it no
> longer satisfies is worse than one that never showed one.

## Success criteria

1. ✅ Corpus row F1 green — a mismatched template produces a warning naming the missing port.
2. ✅ The QA fixture is green — updating the fixture is a legitimate part of this change if the
   default moves. (The defaults did not move, so no fixture change was needed.)
3. ✅ A failing task reports which item failed and why — identity always, reason when the template
   has an output that can carry one.
4. ✅ **Demonstrable as of 2026-07-30.** The catalog was regenerated and carries all four ports
   (`taskStartInput`, `taskSuccessOutput`, `taskFailureOutput`, `taskErrorOutput`), so
   `nonexistentPort` can check them — `RunTasks` reads `dynamicPorts: false` in the catalog, which is
   the whole reason §2 chose static string ports over the enums the section originally asked for. It
   was built-but-unprovable for one day. The design decision is recorded under §2.
5. ✅ **§4 built** — the template contract is summarised on the node card when it is satisfied. See
   the note under §4.
