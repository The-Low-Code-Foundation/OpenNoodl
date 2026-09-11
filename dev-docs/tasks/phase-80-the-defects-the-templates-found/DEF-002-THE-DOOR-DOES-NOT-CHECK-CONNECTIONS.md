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

## 5. ✅ COMPLETE — 2026-08-29 (s1 landed 1a and 3; s2 landed 1b, 1c, 2 and AC6)

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

### ✅ AC6 met — `validate_project` now runs the precondition layer

**The reason it was open was bigger than this task recorded, and it is now closed for all thirteen
checks at once.** `validate_component`/`validate_project` → `validateOnDisk` ran the
`SemanticValidator` and stopped; only `validateCandidate` composed the preconditions. **An agent
calling `validate_project` to check its work got a strictly weaker answer than the door that let the
work in**, and adding rules to that layer could never have changed it.

**The live instance, on the project the MCP server was bound to while this was written:**
`Puppy test 3`'s `/Pages/Admin` wires `query.items` into the Function port `items`. A Function node's
ports are prefixed (`in-items`, `out-text` — `simplejavascript.ts` registers them so). The wire
reaches nothing; `validate_project` called that project clean.

#### The calibration pass — `scripts/def-002-corpus-preconditions.ts`, `npm run calibrate:preconditions`

🔴 **The honest denominator is not "what do the preconditions emit".** `rules/parameterValue` (D13)
already runs `checkParameterValues` on that door, so the naive count double-counts badly. The script
reports only what the semantic validator does **not** already report.

| population | errors | warnings | skip notes |
|---|---|---|---|
| the 94-project corpus | **24** | 69 | 1,355 → filtered |
| the 3 shipped examples | **0** | **0** | 12 → filtered |

**All 24 errors were read, not sampled:** 16 `unprefixed-function-port` (verified against the
runtime's `in-`/`out-` registration *and* the wires on disk), 5 `repeater-without-template`, 3
`repeater-with-visual-children`. Every one is a true positive. D13's precedent applies exactly —
*"expect this to go red on real projects; that is the point, and it must not be softened"* — and it
costs nothing here: **this door reports, it does not reject.** `AUTHORED_BLOCKING_WARNINGS` is
untouched and still applies only where a write is accepted.

⚠️ **The skip notes are filtered by CODE, not by severity.** `MonotoneTypography` is also an `info`
and it is a *finding*, not a note about a check that did not run. The severity filter
`rules/parameterValue` uses is correct there — `checkParameterValues` emits no other info — and here
it would silently drop it.

### ✅ Rules 1(b) and 1(c) landed — the adapter-minted ports

`validation/derivedPortTargets.ts` + 15 specs. The other two of D1's three sabotages, refused by
name. Their ports are not an interface, so `checkConnectionTargets` could not answer them: an editor
adapter mints them from parameters on nodes inside the **target** component.

🔴 **This task file's §1(c) was wrong, and building from it would have been wrong twice.** It sourced
the `pm-` names from *"`PageInputs.pathParams` and the `{braces}` in `Page.urlPath`"*. At HEAD,
`RouterNavigateAdapter.updatePortsForNode` reads `pathParams` **and `queryParams`**, and `urlPath`
**not at all** — so that sentence would have refused every legitimate query-parameter wire (a false
positive) and accepted a name that mints no port (a false negative). Both halves are graded arms.
**The same decay §3 found in D10's mechanism, in the same file. Read the caller.**

⚠️ `parseNameList` is **imported** from the adapters, not re-implemented: it splits on `,` **without
trimming**, so `"a, b"` really does mint `pm- b`, and a checker that helpfully trimmed would refuse
the port the editor made.

**Calibration: zero across the 94-project corpus — and that number is only readable beside its
arms.** The corpus holds **14 real prefixed wires** the check reads and accepts; a sabotaged copy of
the members template (`in-name`→`in-nameXX`, `pm-announcementId`→`pm-noSuchParam`) yields **exactly
2** errors. A clean corpus, not a dead checker.

### ✅ Rule 2 landed — a `Failure` edge that reaches no response

`validation/rules/failureReachesNothing.ts` + 9 specs. **A `rules/` rule**, so it reaches both doors.

🔴 **It grades the failure EDGE, not the node — the 14th hole, as a permanent arm.** SBR-015's first
version asked *"does this node reach a Response?"*, true of every node on a happy path, so it would
have passed the unfixed `publishPage`. That mutant now kills three specs.

**AC3's pair is real and it is in the corpus.** `Test site builder` holds `publishPage` as it
shipped — **7** firings inside it. `SBR-015 Zero Section Drive` holds it as it ships now — **0**.
One graph, one wire apart.

🔴 **The first version fired 249 times, and that was a finding about the checker.** 67 were
`noodl.cloud.response` nodes — **a response IS the send**, so requiring its own failure to reach a
response is an infinite regress, and it was firing on both arms of its own acceptance pair. With
that one principled exemption: **182 firings, 12 projects, all "no wire"**. The largest class
(`JavaScriptFunction`, 100) is real — a throwing Function raises `failure`
(`simplejavascript.ts:508`), so inside a cloud function that is a hang.

⚠️ **Not in `AUTHORED_BLOCKING_WARNINGS` yet, and one step from it.**

🔴 **The reason first recorded here was wrong, and a peer's counter-measurement is what forced the
re-reading.** It said the promotion was blocked because the shipped templates *"really do leave
failure edges unanswered"*. **They do not.** What blocked it were **two false positives in the
rule**, both on `submitContactForm` — the one graph written to honour this task's own trap:

| firing | why it was wrong |
|---|---|
| `mail.failure` unwired | `mail.completed → res.send` already answers. **`completed` fires after every invocation *whatever the outcome*** (`outcome.ts`), so it answers the failure path too — and the trap *"a bounced mail must still answer the visitor"* names this graph by name. |
| `compose.failure` unwired | a **parallel branch** (`recipient → save → stored → mail → res`) still answers, so a throw in `compose` costs the work, not the reply. |

Both are now exits, each with an arm and a control. The second asks **"is a response reachable
*without* this node"** — the *inverse* of the 14th-hole mutant, which asked "does this node reach a
response". The pre-SBR-015 `publishPage` still fires, because its one worker is the only route.

**Corpus: 249 → 182 → 33.** The shipped templates are **clean**. What remains blocking the promotion
is **two deliberately-malformed test probes** (`probe/RunTasksCrossRuntime`, `probe/RunTasksMissing`)
that exercise a different check and fail this one on the way past — the `PageWithoutPageNode`
situation exactly. **Wire those two probes' `failure` or exempt them, then add the code to the set.**

⚠️ **The peer's diagnosis was wrong too, in the opposite direction**, and the shape is worth keeping:
they proposed excluding components with **no `Response` node**, which the rule has done since it was
written, and their metric counted **only failure wires that exist**, so it was structurally blind to
the two *unwired* ports that were actually firing. **Two measurements, both real, neither one
answering the question — and the answer was in neither.**

### ✅ §2 promoted, and what promoting it shadowed

`FailureReachesNothing` is now in `AUTHORED_BLOCKING_WARNINGS` (`6b721df6`): with both false
positives fixed it costs nothing — MCP **899/899** and `test:main` **6315/6315** with it in the set,
stable across three runs. **The "4 failures" recorded earlier was a flake**, a peer running suites
concurrently — the documented canary.

⚠️ **It did shadow something, and no spec could have caught it.** The two `RunTasks` probes in
`sb004RunTasksTemplate.test.ts` were authored with **no connections**, so the door began rejecting
them for `failure-reaches-nothing` instead of answering what they ask. Both assert only
`typeof isError === 'boolean'` — true either way — so nothing went red. Wired now, and they read
`isError=false codes=[]` again.

🔴 **That reading is not a new finding: it is DEF-010 (SB-009) acceptance criterion 1, verbatim** —
*"Arms C and D of `sb004RunTasksTemplate.test.ts` invert"*. It was very nearly filed as a fresh row,
and the standing rule that would have caught it is **grep the register for the behaviour, not the
words**. Recorded in SB-009 instead, where the task already lives.

### ✅ All parts closed

| part | state |
|---|---|
| 1(a) component instance | ✅ `validation/connectionTargets.ts`, 12 specs |
| 1(b) `CloudFunction2` `in-*`/`out-*` | ✅ `validation/derivedPortTargets.ts`, in 15 specs |
| 1(c) `RouterNavigate` `pm-*` | ✅ same module — and the task file's description of it was wrong |
| 2 `failure-reaches-nothing` | ✅ `validation/rules/failureReachesNothing.ts`, 9 specs |
| 3 `signal-into-value-port` | ✅ `validation/rules/signalIntoValuePort.ts`, 9 specs |
| AC6 both pipelines | ✅ `validateOnDisk` composes the preconditions, calibrated |

⚠️ **One thing this task found and did not own:** three diagnostic codes had stacked doc blocks above
them in the wrong order, so only the last reached a member — `ConnectionUnknownInstancePort` and
`UnprefixedFunctionPort` shipped with **no hover documentation** and two blocks documented nothing.
Reattached in `c8e0f262`, no text changed.

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
