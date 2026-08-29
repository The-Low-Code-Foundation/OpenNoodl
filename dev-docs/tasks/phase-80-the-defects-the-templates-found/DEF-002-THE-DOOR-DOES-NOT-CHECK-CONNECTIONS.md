# DEF-002 — The door does not check connections

**Rank 2.** Sources: phase 77 **D1** and **D10**, phase 78 **D1**. All three **NONE**-owned.

**One door, one task, three rules.** The MCP door validates *parameters* thoroughly and
**connections almost not at all**, so three different ways of wiring a graph wrong all come back
`isError: false`.

## 1. What was measured

### (a) A wire to a port that does not exist — phase 78 D1, by sabotage

Each of these came back with **exactly the same 46 `info dynamic-port-skipped` diagnostics as the
clean run** — no error, no warning, nothing about the wire:

| sabotaged | door said |
|---|---|
| `standing.isMember` → `standing.isMemberXX` (**component instance** output) | nothing |
| `send.in-name` → `send.in-nameXX` on a **`CloudFunction2`** whose endpoint declares the params | nothing |
| `goDetail.pm-announcementId` → `pm-noSuchParam` on a **`RouterNavigate`** | nothing |

🔴 **All three targets are components the door has already resolved on disk**, each declaring its
ports in a file the door reads. And `For Each.template` proves this is the door's job:
`repeater-template-unresolved` is **blocking**.

### (b) A `Failure` that reaches nobody — phase 77 D1

**Confirmed at HEAD, 2026-08-29:** `noodl-mcp/src/validate.ts` contains 8 occurrences of "failure"
and **every one is the `StructuralFailure` type or an unrelated comment**. There is no rule.

In a cloud function this is not a degraded result — the request only ends when something *sends*, so
an unreached `Failure` is a **thirty-second hang**. `publishPage` and `duplicatePage` shipped in a
real template with **zero** failure wires between them.

⚠️ The runtime half is already done and is not the gap: NDA-012 / ERG-001 made every node **report**
on its outcome ports. **A node that reports perfectly into an unwired port is exactly as silent as
one that never reported.**

### (c) A signal into a value port — phase 77 D10

A signal arriving at a value port writes true-then-false; the input queue holds one entry per input
name, so the two coalesce and the consumer runs **once, with `false`**.

🔴 **It bit an instrument built to measure a different defect.** Phase 78 D4's first twin wired
`failure` → `unknownNotice.visible` and the notice painted for the person whose query **succeeded**
and not for the one who was refused — exactly inverted. *An instrument built out of a seam you
already know is broken measures the seam.*

## 2. Scope

Three connection-level rules in `noodl-mcp/src/validate.ts`, each resolved from files the door
already reads:

1. **`connection-target-unresolved`** — resolve the three reference classes and refuse an unknown
   port: component instance → the target's `Component Inputs`/`Outputs` node (⚠️ **note the
   inversion**: `Component Inputs` declares *output*-plugged ports inside the component, and those
   are the *inputs* an instance exposes); `CloudFunction2` `in-*`/`out-*` → the target's
   `noodl.cloud.request`/`response` params; `RouterNavigate` `pm-*` → the target page's
   `PageInputs.pathParams` and the `{braces}` in `Page.urlPath`.
2. **`failure-reaches-nothing`** — over any component holding a `noodl.cloud.request`, refuse a
   node whose `Failure` edge reaches no `noodl.cloud.response`.
3. **`signal-into-value-port`** — refuse a connection whose source `isSignal` and whose target is
   not a signal input.

⚠️ **If a full check on (1) is too strong to land at once, the cheap half is worth having alone**:
emit an info **naming the wires that were not verified**, the way `dynamic-port-skipped` does for
parameters. Today the door's silence about connections reads as "checked and fine".

## 3. Acceptance criteria

1. **A person's sentence:** *when I mistype a port name, the thing I am building tells me, instead
   of drawing an empty screen I cannot explain.*
2. Each of phase 78 D1's **three sabotages** is refused by name.
3. `publishPage` **as it shipped before SBR-015** is refused by rule 2, and **as it ships now** is
   accepted. Two arms, one graph, one wire apart.
4. A signal wired to a value port is refused; the same signal wired to a signal port is accepted.
5. 🔴 **Every rule is mutation-graded.** A rule that passes both arms is not a rule.
6. `validate_component` and `validate_project` both carry them — **a check in a second pipeline is
   a duplicate first**; assert cardinality where the two producers meet.

## 4. Traps

- 🔴 **A gate can have a hole shaped like the defect — 14 times on record, and this exact rule was
  the 14th.** SBR-015's first version asked *"does this node reach a Response?"*, which is true of
  every node on a happy path, so it would have **passed the unfixed `publishPage`**. The **mutant**
  caught it, not the green arm. **Grade the failure edge, not the node.**
- 🔴 **The door checks params, not wires.** A nonexistent *instance port* passes silently today —
  ask what a diagnostic is *about* before trusting it to cover a neighbouring class.
- ⚠️ **Artefact node types are not authoring names.** `noodl.cloud.secret`,
  `noodl.cloud.addusertorole`, and a component instance's type is its **legacyName**
  (`/#__cloud__/site/ContactRecipient`). A hand-written type list is an **exclusion list that cannot
  fail** — assert the classification is **total** instead.
- ⚠️ **Two legitimate uses of an unwired `Failure` may exist** (an unprovisioned secret must still
  reach the picker; a bounced mail must still answer the visitor). Grade **where the edge lands**,
  not the port's presence.
- 🔴 **Interim template-scoped cover already exists and must not close this task.** `sb007Template.test.ts`
  and `tpl001Template.test.ts` §3 check two templates. **The door still ships the hole.**
