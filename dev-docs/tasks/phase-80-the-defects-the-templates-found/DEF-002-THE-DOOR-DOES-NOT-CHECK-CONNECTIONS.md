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

---

## 5. 🟡 PARTIAL — 2026-08-29

### ✅ Rule 1(a) landed — the component instance

`validation/connectionTargets.ts` + 12 specs. The first of D1's three sabotages is refused **by
name**, with the clean graph as its control on every case.

🔴 **The inversion is the one way to get this wrong, and it is now graded.**
`componentmodel.getPorts()` collects a `haveComponentPorts` node's `getPorts('input')` and
republishes each with **`plug: 'output'`** — and vice versa. So a port authored `plug: "output"` is
an instance **input**, and `plug: "input"` is an instance **output**. A checker holding that
backwards refuses every correct graph and accepts every broken one, **and would still pass a suite
that only tested one direction.** Both directions have a refusal case and an acceptance case.

`ComponentInterface` gained `outputs` beside `inputs`. ⚠️ **Both node types in
`COMPONENT_PORT_TYPES` feed both directions** — `componentmodel` filters on `haveComponentPorts` and
never on which of the two node types carries it, so "Component Inputs" and "Component Outputs" are a
convention of the canvas, not a rule of the derivation.

**Calibration:** the members-area template builds through `create_component`, so all 19 components
and every instance port in the template *that found this defect* pass the new error. MCP 892/892,
`test:main` 6278/6278, `test:ci` at the floor (2889/4, all `AIX-006` by name).

### 🔴 AC6 is NOT met, and the reason is bigger than this task recorded

AC6 asks that **`validate_component` and `validate_project` both carry the rules**. They carry
**none of the precondition layer at all** — and that is not a fact about DEF-002's rules, it is a
fact about all thirteen.

| door | what it runs |
|---|---|
| `create_component` / `update_component` / `apply_plan` → **`validateCandidate`** | `SemanticValidator` **+ `preconditionDiagnostics`** (13 checks) |
| **`validate_component`** / **`validate_project`** → **`validateOnDisk`** | `SemanticValidator`, and stops |

🔴 **An agent calling `validate_project` to check its work gets a strictly weaker answer than the
door that let the work in.** `checkNavigation`, `checkInstanceInterfaces`, `checkParameterValues`,
`checkFunctionNodePorts`, `checkRepeaterTemplate` and the rest are all invisible to it. A clean
`validate_project` therefore does **not** mean what a reader takes it to mean, and adding rules to
the precondition layer will never change that.

⚠️ **Not fixed here on purpose.** Several of those checks were deliberately calibrated *against
graphs an agent just wrote* (their own headers say so, at length), and `validate_project` also runs
over hand-authored projects. Putting them on that door is a false-positive-tolerance decision with
its own corpus evidence — the same call `authoredCandidate.ts` already records having made twice.
**It needs one calibration pass over the corpus, and that pass answers it for all thirteen at
once.**

### ⬜ Still open in this task

| part | state |
|---|---|
| 1(a) component instance | ✅ done |
| 1(b) `CloudFunction2` `in-*`/`out-*` → the endpoint's request/response params | ⬜ needs a new index off the same views |
| 1(c) `RouterNavigate` `pm-*` → the page's `PageInputs.pathParams` + `{braces}` in `urlPath` | ⬜ same |
| 2 `failure-reaches-nothing` | ⬜ — and 🔴 **DEF-002 read `noodl-mcp/src/validate.ts` and concluded "there is no rule". True, but the rules do not live there**: they are `noodl-editor/src/editor/src/validation/rules/`. Checked at HEAD: `unwiredOutcome` fires on a different shape entirely (unchanged declared, `done`+`failure` wired, neither `unchanged` nor `completed`), so the gap is real — but it was concluded from the wrong file, which is the third time a row in this family has been |
| 3 `signal-into-value-port` | ✅ **done** — see below |
| AC6 both pipelines | 🔴 blocked on the calibration pass above |

### ✅ Rule 3 landed — a signal into a value port

`rules/signalIntoValuePort.ts` + 9 specs. **A `rules/` rule, not a precondition** — so unlike 1(a) it
reaches `validate_project` *and* the write gate. That difference is what AC6 is about, and it is
worth noticing that the two halves of one task landed on opposite sides of it.

Nothing covered it, checked rather than assumed: `typeIncompatibleConnection` names *"a signal is
involved"* as **sufficient** for compatibility — correct for a signal into a signal, and precisely
why nobody was asking about the *direction*.

#### 🔴 D10's mechanism is wrong at HEAD, and the diagnostic says what the runtime does instead

D10 (and this task's §1(c)) describe it as *"the two writes coalesce and the consumer runs once, with
`false`"*. At HEAD, `Node.prototype._setPulseFromConnection` queues **one** entry (`SIGNAL_PULSE`),
and the drain loop plays it as `setInputValue(name, true)` then `setInputValue(name, false)` **in the
same pass**. So the setter runs **twice** and the port **settles at `false`**.

⚠️ Not pedantry: *"runs once with false"* and *"settles at false"* predict different things for a port
with a side-effecting setter, and a diagnostic that states the wrong mechanism teaches the wrong
repair. **The row was relayed from a measurement of an older runtime.** Read the caller.

#### 🔴 `error` was tried, and the corpus gate refused it — correctly

**Exactly one firing across the 96-project corpus**, and it is a **true positive**:
`big-merge-test-mine`'s `/SessionData/Setup session` wires `Switch.switchedToOn` into
`Script Downloader.startLoad`.

Verified in the node definition rather than inferred — `startLoad` is
`type: 'boolean', default: true, displayName: 'Load on start'`, described as *"whether the scripts
are fetched as soon as the node appears, **rather than waiting for Load**"*, and `load` is the signal
input beside it that the author meant. The pulse settles `startLoad` at `false`, so **that project's
scripts never load**.

So the rule is right and the project is broken — **and a rule that breaks CI over one real defect in
an old import is a rule people switch off.** `warning` + membership of `AUTHORED_BLOCKING_WARNINGS`
is the seam that already exists for exactly this split: advisory on a project somebody imported,
**blocking on a graph an agent just wrote**. The set's own charter is *"output that is broken — a
value the runtime discards"*, and a value input receiving a pulse discards it in the most literal way
available.

#### Gates

`test:ci` **2889 specs, 4 failures, all `AIX-006` by name** — the floor, unmoved. `test:main`
6287/6287. MCP **891/891**, and every shipped template runs through `validate_project`, which now
runs this rule: none fires.
