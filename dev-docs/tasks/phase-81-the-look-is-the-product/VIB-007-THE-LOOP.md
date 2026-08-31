# VIB-007 — The Loop *(rescoped 2026-08-31; was "The Brief")*

**Register rows V9, V10, V11, V15, V22, V23, V26, V28, V29, V32, V33, V4.**

## §1 Why this task was rescoped, and it was Richard's question that did it

> *"how can we bake the magic we achieved here into the basic way the MCP allows an LLM to understand
> the 'right' process and procedures and architecture and choices to make. Or are we stuck just
> building a library of examples…"* — Richard, 2026-08-31

The original scope was **INSTRUCTION**: *"move ambition into what the model reads every turn"*. That
scope is wrong, for three measured reasons.

**(a) The instruction already works, and it is not what the iteration fixed.** VIB-006's *first*
render was ~80% of the final page, because the session had read the doctrine, the rubric and the
compositions. What five render cycles then fixed was: a nav that silently lost two of its links at
390, a headline running to three lines, a stat label that wrapped, a quote card a line longer than its
neighbours, and one parameter that did nothing at all. **Not one of those is a taste judgment.** They
are rendering facts that only a picture reveals. Teaching harder would not have caught any of them.

**(b) Instruction demonstrably does not stick — this phase has the control.** Register **V17**:
*"V1 defeated a brand-new, gate-clean recipe written by a session that had just read V1."* A session
that had read the diagnosis of the trap shipped the trap. That is the strongest available evidence
that a rule which is prose loses to a rule which is a diagnostic.

**(c) There is nowhere left to put instruction.** Register **V35**: the resident tool surface is at
**8,279 of 8,280 tokens**. The next clause added to any tool description reds the gate. The constraint
picks the design: **tools and diagnostics, not a longer manual.**

## §2 🔴 The mapping — the honest test, run before this was written

The claim was: *most register rows fall out to a mechanism rather than to a paragraph.* Run over all
**41** rows (`README.md` §6), classifying each by the mechanism that would have **prevented** it:

| | rows | of which still live |
|---|---|---|
| **M1** — the render is mandatory, not optional | 5 | **5** |
| **M2** — a trap becomes an authoring-time diagnostic | 14 | **11** |
| **M3** — the gate fires on poverty, not only excess | 6 | **6** |
| **M4** — a higher authoring altitude (→ **VIB-013**) | 5 | 4 |
| **M5** — the corpus is generated from the compositions (→ **VIB-013**) | 5 | **0** |
| **retired by nothing** | 16 | 5 |

**Retired by a mechanism: 25 of 41 (61%). Of the LIVE debt: 18 of 23 (78%).**

⚠️ **The table above is the mapping as it was run, and is left as it was run.** Re-running
`demo/map-register-to-mechanisms.py` after **V22 closed** (§6) reads **22 live, 17 of 22 (77%), M2 at
10 live** — the movement of exactly one M2 row, which is the arithmetic working rather than a new
finding. **Re-run the script; do not trust either copy of the numbers.**

🔴 **The result that corrected the pitch: M5 retires five rows and NOT ONE of them is still open**
(V8, V25, V27, V33, V39 are all closed). M5 is **prevention, not cleanup** — it would have stopped
five defects that have each already been paid for by hand. That is a real argument for it and a real
argument for it going *after* M1–M3, and it is the opposite of the reason it was ranked last in the
original pitch.

⚠️ **The five live rows no mechanism retires, stated so the plan is not oversold**: V3 (template auth
logic — VIB-008's), V18 (devtool hygiene), V31 (a genuine vocabulary gap — no port takes a box-shadow
string; an expander could hide it, not close it), V35 (**not retirable — it is the constraint**) and
V41 (release, not authoring).

## §3 The three mechanisms this task builds

### M1 — the render is mandatory

Doctrine §11 already says *"you have not finished until you have looked at it."* It is **prose**, and
`render_report` exists and nothing requires it. Make the authoring flow unable to report a visual page
as done until a render has been taken and its findings are clean.

🔴 **Why this is first: it converts a taste problem into a feedback-loop problem.** A model is
mediocre at one-shot taste and good at iterating against a signal. It also makes M2 and M3
self-correcting — a diagnostic nobody is required to trigger is another paragraph.
Retires **V9, V11, V15, V26, V29**.

### M2 — a trap is a diagnostic, not a doctrine line

Each is a **static predicate over the graph the model just wrote**, and `validate_component` already
returns diagnostics with suggested fixes. Every trap moved from prose to predicate deletes a paragraph
from the briefing *and* catches the model that got it wrong anyway.

| row | predicate |
|---|---|
| V22 | a `Component Inputs` with no `ports` and connections out of it — **14 hits**, purely static |
| V23 | a glyph name absent from the installed manifest |
| V28 | a raw px where a `--space` token fits; a `var()` in a units-typed port, which is dropped silently |
| V29 | a `maxWidth` on a `Text` inside a centred shell — the measure belongs to the shell |
| V32 | **configuration only**: run `raw-color-literal` in `catalog:examples`, which today does not |
| V33 | an image parameter empty **and** unfed by a connection — the row itself says only the connection list separates the good case from the bad |

✅ **This is already the proven pattern in this phase**: V20 was retired exactly this way — the fix was
a gate that rejects the undrawable icon value, not a doctrine line about it.
⚠️ **Ownership**: V1, V2, V14, V17, V21 and V38 are the same mechanism applied to the runtime-default
family and stay **VIB-005's** — do not duplicate them here.

### M3 — the gate fires on poverty

Every render/authoring gate detects excess; **nothing anywhere fires on poverty** (V10). VIB-006 and
the VIB-001 baseline now give real thresholds rather than taste:

| reading | baseline (SHITTY ×9) | VIB-006 (WORTHY) |
|---|---|---|
| distinct grounds on the page | 1 | **7** |
| `Image`/`Icon` nodes | 0 | **8 photographs + 5 glyphs** |
| distinct type sizes | 2 | **6** |

Candidate findings: a visual page with one ground and no media; one-weight typography as more than an
info; dead-viewport ratio (V15); a band whose gutter disagrees with its siblings (V26); a query or
repeater with no empty state (V4, doctrine §9).

🔴 **`oversized-page` is the proof the machinery already exists and is set too quiet.** It told
VIB-006 that a 90-node page had inlined sections that wanted to be components — correctly, and it was
an **INFO**, so it did not fail the run. **Promoting the poverty family from advice to pressure is
most of this mechanism.** Retires **V4, V9, V10, V14, V15, V26**.

## §4 Acceptance criteria

1. **AC1 — M1**: a visual page cannot be reported done without a render whose findings are clean.
   Demonstrated on a deliberately poor page: the door refuses, names why, and accepts after the fix.
2. **AC2 — M2**: the six predicates above ship as diagnostics with suggested fixes, each with a spec
   **and a mutation** that reds only its own row. 🔴 V22 must be **ruled by a render first**: whether a
   `For Each` feeds item properties into undeclared ports decides whether those **14** examples are
   broken or work by another route. **That render is this task's first job.**
3. **AC3 — M3**: at least three poverty findings fire on the VIB-001 baseline artefacts and are silent
   on the VIB-006 page. ⚠️ **Both arms are required** — a finding that fires on everything is noise,
   and a control that only ever passes has not been shown to work.
4. **AC4 — the A/B**: an agent given only the standard surfaces produces measurably richer output than
   the baseline, judged through README §3. ⚠️ This is the original close condition and it survives.
5. **AC5 — the budget**: `npm run catalog:merge:check` and the noodl-mcp suite are in this task's gate
   table. V35 means **any tool-description change reds the surface gate** — measure before widening.

## §5 Explicitly NOT in this task

- The section expander and generating the corpus from compositions — **VIB-013** (M4, M5).
- V1/V2/V14/V17/V21/V38 — **VIB-005**, same mechanism, different family.
- V31 (unreachable shadow tokens) — a real vocabulary gap, not a procedure gap. Stays open, unowned by
  a mechanism.

---

## §6 🔴 V22 RULED, 2026-08-31 — the 14 examples were broken, and M2's first predicate ships

AC2 named this task's first job: *"whether a `For Each` feeds item properties into ports that were
never declared is a runtime question, and the answer decides whether these are 14 broken examples or
14 that work by another route. It must be a render, not a reading."* It was a render.

### The experiment

`demo/build-vib007-v22.js` writes a two-arm project; `packages/nodegx-backend/tests/vib007-v22.look.ts`
renders it. `/Rows/Declared` and `/Rows/Undeclared` are byte-identical but for the `ports` array on
their `Component Inputs` node — asserted from disk, not asserted-to — and each is drawn by a `For Each`
over three `Static Data` records through the same connection. Each row's `Text` carries its own
placeholder as a parameter, so "the value was discarded" and "the value arrived empty" are different
pictures rather than the same blank.

🔴 **Arm A is the control and it is read first.** Without a known-firing arm, "arm B shows no value"
is indistinguishable from "the repeater never ran", "the `Static Data` did not parse" and "the harness
served the wrong page".

### The reading, at all four widths

| arm | `Component Inputs` | rows drawn | rows showing the record's value | rows showing the placeholder |
|---|---|---|---|---|
| A | `ports: [{ label, output, * }]` | 3 | **3** | 0 |
| B | no `ports` array | **3** | **0** | **3** |

**The answer is no: an undeclared port delivers nothing.** `verdicts/vib-007/2026-08-31/v22-door/`.

🔴 **The repeater still creates the right NUMBER of instances.** That is what made this survivable for
so long — the page keeps its shape and loses its content, so every structural check passes. It is the
same class as VIB-003's lost band, where `textChars` was 606 and `unreachablePx` was 0.

The mechanism, read afterwards to explain the picture rather than to predict it: `foreach.tsx:595`
iterates `itemNode._inputs` — the **declared** inputs — so an undeclared port is never offered the
value. `runtasks.ts:430` is the identical loop, which matters because one of the 14 is placed by
`RunTasks`, the second `_forEachModel` producer named in `foreachitem.ts`'s own header.

### ⚠️ The register row was right about the population and wrong about what it consists of

V22 said *"every one a repeater/`For Each` item component"*. Re-derived from the placers:

| how the component is placed | count |
|---|---|
| `For Each` template | 10 |
| `RunTasks.taskTemplate` | 1 |
| **direct instance** (`/Media Frame`, `vis-wrapper-component-children`) | **1** |
| **placed by nothing at all in its own example** (`/Task Detail`, `/Project Membership`) | **2** |

All four cases are repaired by the same edit, so nothing about the fix changes — but "all 14 are
repeater rows" would have made the ruling look narrower than it is, and two of them are an example
defining a component it never instantiates, which is a different (weaker) finding hiding inside this
one. 🔴 **A relayed count decays more slowly than the sentence attached to it.**

### What shipped

1. **`DiagnosticCode.UndeclaredComponentPort`** (`undeclared-component-port`, **error**) and
   `checkUndeclaredComponentPorts` — the third question in the interface family.
   {@link checkInstancePorts} asks whether a port has a direction; `checkComponentPortDirection` asks
   whether it has the right one; this asks whether it **exists**. Both neighbours read the ports a node
   *declares*, so a node declaring none was silent to both.
   ⚠️ The predicate is **wired − declared**, not "has no `ports` array": a node declaring two of the
   three ports it wires is the same defect for the third. All 15 hits happened to declare nothing; the
   check is not written to that accident.
2. **On the corpus gate** (`scripts/validate-examples.ts`). Switched on, it found **16 undeclared ports
   across 14 files** — 53/67 — matching an independent sweep exactly. That gate could not previously
   have asked: its `toNormProject` maps ports to names only, so "declared" and "wired" were never in
   the same place. **A hole shaped exactly like the defect**, again.
3. **On the authoring door** (`authoredCandidate.ts`, guarded on `wires` like its neighbours), so
   `create_component` / `update_component` / `validate_component` reject it with the line to add.
   `packages/noodl-mcp/tests/vib007UndeclaredPortDoor.test.ts` pins the rejection, the message's
   **Repeater clause** (all but two of the hits are placed by a repeater, and "an instance parameter is
   discarded" reads as not-my-case to an author who places no instances by hand), and — the half a gate
   family has got wrong before — that the **correct** component is still accepted.
4. **The 14 examples repaired**: 16 ports declared. Surgical text insertion, not a JSON round-trip —
   48 of the 67 files disagree with any single formatter, so re-emitting them would have buried a
   16-line repair in a 67-file reflow. `data-run-tasks-batch`'s `success` is typed `signal`, not `*`,
   because `Outputs.success()` is a signal.
5. **Regenerated `node-catalog-enriched.json`** and verified **through the door**: `listExamples()` →
   67, and a sweep over `getExample()` finds **80 interface wires, 0 undeclared**. ✅ V40's discipline
   applied on its first opportunity — and `catalog:merge:check` **did red** on the corpus edit before
   the regeneration, which is the gate working.

### Gates (2026-08-31) — 🔴 every row is an EXIT STATUS

| gate | reading |
|---|---|
| `vib007-v22.look.ts` | **exit 0** — 3/3, four viewports, `errors=0` on every shot |
| `npm run catalog:examples` | **exit 0** — **67/67** strict (it read **53/67** the moment the check was switched on, before the repair) |
| `npm run catalog:merge:check` | **exit 0** after regeneration; **exit 1 before it**, on this session's corpus edit |
| `npx jest --config packages/noodl-mcp/jest.config.js` | **exit 0** — **80 suites / 1048 tests** (was 79/1045; this task adds one suite of three) |
| `noodl-editor/tests-unit/vib-007/undeclaredComponentPort.test.ts` | **exit 0** — 8/8, including the corpus **mutation** |
| 14 neighbouring editor validation specs | **exit 0** — 14 suites / 192 tests |
| `npm run typecheck:editor` | **exit 0** |
| `npm run typecheck:backend-tests` | ⚠️ **not run** — settled as un-runnable on this box (OOM, exit 134, even at two files). CI `pr.yml:39` covers it |

### What AC2 still owes

V22 is one of six predicates. **V23, V28, V29, V32, V33 are unbuilt.** V32 is the cheapest by a
distance — it is *configuration only* (run `raw-color-literal` in `catalog:examples`) and it now has a
worked precedent in this section for what switching a check on over an existing corpus costs.

---

## §7 🔴 AC1 BUILT, 2026-08-31 — the render is mandatory, and "done" is a thing only a render can say

AC1 was this task's own first call — *"it converts a taste problem into a feedback-loop problem"* —
and the handoff put it ahead of AC2's tail. It was built.

### What was measured before anything was written

The seam was **not** what §3 M1 assumed. Read from the door as it actually is:

| | state before this session |
|---|---|
| `apply_plan` | **already renders by itself** when the plan wrote anything visual (LAS-005 §4), and appends the numbers |
| `create_component` / `update_component` | **never render**, and LAS-006's own note calls this *"the door a page most often comes through without a plan"* |
| anything | **nothing turns a render finding into a refusal**, and nothing anywhere records that a render happened |

So M1's gap was never *"add a render"*. It was that **the render's numbers were appended to a
response whose top-level shape said success**, and `validate_project` — the call a model makes to ask
whether its work is good — could answer yes about a project nobody had ever looked at. 🔴 That is the
same failure one level up as the render report that said *"Rendered clean: 83 texts, 10 images"* over
content nobody could reach (AWP-004), and the same shape as VIB-001's own *legible-and-operable-is-not-a-grade*:
**a structural pass proxying for the thing actually being asked.**

### 🔴 The design decision, and the first design was wrong

The first shape was **the door refuses the write** — render the staged overlay before `apply_plan`
commits, and reject a plan whose page renders dirty. It is buildable (a project copy is ~3.4 MB, tens
of milliseconds against an 8-second render) and it is **wrong on M1's own argument**. M1 exists
because *"a model is mediocre at one-shot taste and good at iterating against a signal"*. A door that
will not save a page until it renders clean **destroys the loop it was built to create** — you cannot
fix what you were not allowed to write.

✅ So: **this refuses to certify, never to write.** Writes stay open, looking becomes unavoidable, and
`done` becomes a thing only a clean render can produce. The one refusal that *is* a refusal sits where
a caller can actively avoid looking, and it is refused **before any write**:

> `apply_plan` with `render: "off"` on a plan that wrote something visual → **rejected, nothing
> written.** The environment escape (`NODEGX_RENDER_DISABLED`) is deliberately untouched: it belongs
> to whoever runs the server — CI, a container with no Chrome — not to the model authoring the page.

### What shipped

1. **`src/renderVerdict.ts`** — `verdictFor(report)` and the `RenderLedger`.
   - 🔴 **The blocking family is measured, not chosen.** `nodegx-render-measure` already grades its own
     findings and the five it calls `error` are exactly the five that mean unfinished — blank render,
     a repeater that built no rows, a text still showing a node-type default, a broken image, content
     nobody can reach. The predicate is **the severity**; retyping the list here would be a second copy
     to drift. Everything at `warning` is reported and does not block.
   - 🔴 **An unmeasured routed page is not a clean page.** `render-report.js` already refuses to let a
     summary out-claim its coverage; the verdict follows it, or "done" over a page nobody could address
     would be AWP-004 wearing this module's face.
   - **Staleness is a content signature, not bookkeeping.** Component bytes + `nodegx.routes.json` +
     `nodegx.styles.json` + `_registry.json` are hashed; `assets/` and `noodl_modules/` go in by
     (path, size, mtime), because a `broken-image` is fixed by the *file* arriving and a signature
     blind to assets would certify a page whose photographs had been deleted. ⚠️ Stated bound: a
     replacement of identical size *and* mtime is invisible — a `touch -r` away, and nothing does it
     by accident.
   - **In memory, and strict when it knows nothing.** It writes nothing into the project (opening one
     already writes three files). A fresh session over a finished project reports `done: false,
     'nobody has looked'` — the honest epistemic state, eight seconds from cleared.
2. **`src/tools/completion.ts`** — one completion block for every door. `done` is present on **both**
   arms, because a field that appears only when something is wrong is a field whose absence has to be
   interpreted, and the absence of a warning is exactly what a model reads as success.
3. **The doors**: `render_report` records the verdict and prints it **as the first content block,
   before the JSON**; `apply_plan` refuses `render:"off"` on a visual plan and carries the verdict
   *above* its `note`; `create_component`/`update_component` invalidate the ledger and report the state
   they have put the project into; **`validate_project` now answers `done`**.
   ⚠️ A **page-scoped** `render_report` deliberately does **not** certify — it is a reading about one
   page, and recording it as the project's verdict would launder that reading into the app.
4. **`drawsSomething()` moved into `src/visualRoots.ts`.** `apply_plan` asked it of a staged operation
   and `create_component` was about to ask it of a candidate — the exact three-twins shape BCN-003 is
   about, caught before the second copy existed.

### The demonstration — AC1's actual close

`demo/build-vib007-m1.js` writes a deliberately poor page: a `Text` with **no `text` parameter** (the
node draws its own type name) and an `Image` pointing at a photograph that is not in the project.
Everything else about it is tidy — tokens for every colour and space, a real heading, a scrolling
spine — **which is the point**: it passes every structural check and it is three empty words and a
grey rectangle. `packages/noodl-mcp/tests/vib007-m1.door.ts` drives the real door over it with a real
Chrome (outside `testMatch`, like a `.look.ts`, so it cannot redden a gate):

| step | reading |
|---|---|
| 1 | `validate_project` → **NOT DONE** — *"nothing has rendered this project in its current state, so nobody has looked at it"* |
| 2 | `render_report` (real Chrome) → **NOT DONE — 4 blocking findings**: `dead-placeholder-text` and `broken-image`, at desktop **and** phone. `validate_project` agrees and lists them |
| 3 | the fix through `update_component` (real copy for the three dead texts) + the photograph placed → **still NOT DONE**, because nobody has looked since |
| 4 | 🔴 `render_report` → **DONE — "Rendered, and the render is clean."** and `validate_project` says `done: true` |

🔴 **Step 4 is the arm that makes the other three mean anything.** A gate that never accepts is
indistinguishable from a gate that is broken — the half this repo's icon gate and V22's own door spec
each had to be given, and the third time in this phase.

⚠️ **`mustFix` lists each defect once per viewport and is not deduped by code.** A finding that fires
at 390 and not at 1280 is a different page; the spec asserts the code **set** and the viewport
**count** separately, so a silent collapse to one viewport is caught rather than passing.

### Gates (2026-08-31) — 🔴 every row is an EXIT STATUS

| gate | reading |
|---|---|
| `tests/vib007-m1.door.ts` (real Chrome) | **exit 0** — 4/4, the four steps above |
| `tests/vib007RenderGate.test.ts` | **exit 0** — 12/12, incl. the signature **mutation** and the accepts arm |
| `npx jest --config packages/noodl-mcp/jest.config.js` | see the handoff's table |
| the surface budget spec | **exit 0** — 🔴 **8,274 tokens, six under 8,280.** The `render` parameter's new description is *shorter* than the one it replaced, which handed back **5 tokens** against V35's recorded 1 |
| `npm run typecheck:mcp` | **exit 0** |

### What AC1 does NOT close

**No register row was closed by this.** §2's mapping classifies rows by the mechanism that would have
**prevented** them, which is not the same claim as "the defect is now fixed": V9's instruction surfaces
are unchanged, V11's door-state instrument is VIB-001's, and V15/V26/V29 are measurements nothing here
takes. M1 makes the loop mandatory; the rows close when their own defects do.

⚠️ **AC3 (M3, the poverty findings) is the one this most obviously enables** — a mandatory render is
where a poverty finding would be read, and until M3 ships the gate is silent on the exact failure the
VIB-001 baseline is made of: a page that renders perfectly clean and is worth nothing to look at.
