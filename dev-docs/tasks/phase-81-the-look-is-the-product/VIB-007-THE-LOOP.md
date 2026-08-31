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

---

## §8 🔴 AC3 BUILT, 2026-08-31 — the gate fires on poverty, and V10 closes

AC1's own closing line named this: *"a mandatory render is where a poverty finding would be read, and
until M3 ships the gate is silent on the exact failure the VIB-001 baseline is made of — a page that
renders perfectly clean and is worth nothing to look at."* It was built.

### 🔴 The measurement came first, and §3's own table was the wrong number

§3 M3 tabulates *"distinct grounds on the page: baseline 1, VIB-006 7"*. That number is counted in
`vib006-landing.look.ts` over **`nodes.json` parameters** — it is a fact about the graph. A render
finding sees a rendered DOM, and there is no reason the two agree. So nothing was designed until
`packages/nodegx-backend/tests/vib007-m3-measure.look.ts` had rendered both arms through the real
instrument with the starter assets installed (VIB-003 / V19 — measuring VIB-006 without them prices
the empty arm and calls it the page).

What a real Chrome returned, `templates/members-area` at its door beside the VIB-006 page:

| | baseline (4 door pages × 2 viewports) | VIB-006 |
|---|---|---|
| visible texts | 3–10 | **73** |
| largest rendered type | 14–30px | **94px** desktop / 48px phone |
| distinct type sizes | 2–5 | **9** |
| images / icons | **0 / 0**, every row | **7 / 20** |
| distinct full-bleed grounds | 0–2 | **6–7** |

⚠️ **Two of those columns did not exist before this session.** `images.icons` and `grounds` are new
measurements, and both had to be, because the finding they feed cannot be honest without them:

- **Icons.** README §2's tell is *"no imagery **and no iconography**"*. A page of five glyphs and no
  photographs satisfies half of it. 🔴 The DOM was **probed, not inferred**: `IconGlyph` has four
  branches and the font one renders `span.lucide.icon-sprout` **with no `ndl-icon-glyph` class on
  it** — a selector written from the module's own constant would have counted zero on a page with
  ten. The universal half is a `::before` whose content is a Private Use Area codepoint, which is
  what an icon font *is*; restricting to U+E000–U+F8FF is what stops a bullet counting as an icon.
- **Grounds.** Every gradient band on the VIB-006 page reports `backgroundColor: rgba(0, 0, 0, 0)`
  and carries its whole identity in `background-image`, so the existing colour-only accent/neutral
  count read **6** grounds on a page that has 8. `background-image` is read first and wins.

### The three, and why they are the rubric's rather than the data's

Each is one of the WordPress-starter tells README §2 lists **verbatim**, restricted to the three a
render can see. The numbers only calibrate what the rubric already names:

| finding | README §2, verbatim | predicate |
|---|---|---|
| `single-ground` | *"one background colour end to end"* | fewer than 2 distinct full-bleed grounds |
| `no-imagery` | *"No imagery and no iconography anywhere on the page"* | 0 images **and** 0 icons |
| `no-display-type` | *"headline under ~48px on desktop"* | largest type < 48px, **desktop viewports only** |

🔴 **`DISPLAY_TYPE_MIN_PX` is 48 because README §2 says 48**, and the corpus is the check on it, not
the source of it. The seven recorded measurement fixtures in `noodl-mcp/tests/fixtures/render` are
four independent authors' real builds — haiku, sonnet, kimi, the ecommerce reference — and **every
one tops out at exactly 48 or 60px**, while the two templates Richard ruled SHITTY top out at 30. The
threshold falls in a gap the corpus put there. A ratio fitted to the two artefacts under test would
have landed at 2.6 and meant nothing.

⚠️ **Desktop only, because that is the only width the rubric gives a number for.** A phone threshold
would have been invented, and what this cannot see is stated rather than guessed: a page whose
desktop headline is fine and whose phone headline collapses is not this finding's business.

### The reading, both arms, by a real Chrome

| arm | `no-imagery` | `no-display-type` | `single-ground` |
|---|---|---|---|
| baseline `members-area` door, 8 viewport-rows | **8 of 8** | **4 of 4 desktop rows** | **6 of 8** |
| **VIB-006 page**, desktop + phone | **0** | **0** | **0** |

**AC3's both arms, met.** The control is the only artefact in the repo a person has ruled WORTHY, and
it is asserted to be *rich by every axis the three read* — so a fixture that quietly lost its
photographs reddens rather than turning arm 2 into a tautology.

### 🔴 A field that was never measured is UNKNOWN, never zero

The seven older fixtures predate `grounds` and `images.icons`. A predicate reading `undefined` as
"none" would have reported *"no imagery"* about four builds that ship sixteen photographs. Every
poverty predicate requires its field to **exist**; the specs run all six older fixtures through and
assert silence. This is the `all([])` trap — an absence is only assertable beside a signal known to
fire, and here the signal is the field being present at all.

### ⚠️ They are warnings, and that is a decision — register V42

VIB-007 §3 hoped for *"promoting the poverty family from advice to pressure"*. What shipped is
pressure, not a gate, and the reason is a distinction the instrument cannot make: **README §2 exempts
app-chrome pages from the marketing tells these encode**, and nothing in a render tells a landing page
from a settings page. At `error` they would block `done` (VIB-007 M1) on every honest form in every
project. Recorded as **V42, owner NONE** — it needs a ruling on whether a page should declare its kind.

So the pressure is applied where it is honest — in the sentence, on the `done: true` arm:

> `done: true`, `doneBecause: "Rendered, and nothing is broken — but it measures as a default
> template: no-imagery, no-display-type, single-ground. Nothing here blocks; look at the screenshot
> before calling it finished."` plus a `looksLike` block naming each tell.

🔴 Because *"Rendered, and the render is clean"* over a page measuring as a WordPress starter is the
**AWP-004 shape for the third time in this phase**: a summary out-claiming what was established. All
nine baseline pages render clean. The field is named `looksLike` rather than `warnings` deliberately —
a model reading *warnings* beside `done: true` has already been told which to believe.

### 🔴 The defect AC3 found by measuring: the WORTHY page could never be certified

Rendering the control turned up **`dead-placeholder-text`, severity `error`, at both viewports** on the
VIB-006 page — which means the one artefact a person has ruled WORTHY **could not be reported done by
the mechanism AC1 built to report it**, and had not been able to since the day AC1 shipped.

The cause: `StatTile`'s value `Text` hardcodes `"0"` as the fallback its `Component Inputs` feeds, and
the fourth tile legitimately sets `value: "0"` — *"0 air miles in the boxes"*, a real statistic and the
best line on the page. `overriddenDefaults` therefore listed `"0"` as a placeholder, and the finding
asserted the stronger of two readings as determined fact: *"That value is only ever visible when the
input does not arrive, so it did not arrive."* It arrived.

🔴 **A refused value and a never-requested value are the same picture and have opposite fixes.** The
graph separates them and was already on disk: a literal that **any instance supplies verbatim for the
port that feeds it** is ambiguous and is now dropped — per site, because one word can be a genuine dead
fallback in one component and deliberate content in another. The control is asserted beside it: `Title`,
`Body`, `Quote`, `Name` and `Heading` are all still reported, and Kimi K3's own fixture case still
fires. After the fix the VIB-006 page renders **zero findings at both viewports** — the first time it
has been certifiable.

⚠️ This was not an AC3 sub-goal. It became the first job because it **failed AC3's accepts arm**: the
control could not be shown silent while an unrelated error was firing on it.

### What shipped

1. **`@nodegx/render-measure`** — `images.icons`, `grounds`, `text.largestFontSize` in
   `measureExpression`; `SingleGround` / `NoImagery` / `NoDisplayType`; `DISPLAY_TYPE_MIN_PX`,
   `MIN_DISTINCT_GROUNDS`, `POVERTY_MIN_TEXTS`; and **`POVERTY_FINDINGS` / `isPovertyFinding`**, so
   *which codes mean poverty* is written once rather than copied into every consumer.
   ⚠️ The module's own warning bit on the first edit: **a backtick in a comment inside
   `measureExpression` ends the template literal**, and it surfaces as a syntax error hundreds of
   lines away.
2. **`scripts/devtools/render-report.js`** — the `overriddenDefaults` fix above, and the new
   constants re-exported so a spec reads README §2's number instead of restating it.
3. **`noodl-mcp`** — `RenderVerdict.poverty`, `povertyFindings()`, the `done: true` sentence above,
   and `looksLike` on the completion block for every door.
4. **`packages/nodegx-backend/tests/vib007-m3-measure.look.ts`** — the harness the design was measured
   from, kept, because it is the thing to re-run when either artefact moves.
5. **Two fixtures recorded from real renders**: `vib001-members-join-door.json` and
   `vib006-landing-worthy.json`, so AC3's evidence is checkable without a browser.
   ⚠️ A frozen fixture answers the question its subject asked on the day it was recorded — the
   `.look.ts` is what re-derives them.

### Gates (2026-08-31) — 🔴 every row is an EXIT STATUS

| gate | reading |
|---|---|
| `vib007-m3-measure.look.ts` (real Chrome, both arms) | **exit 0** |
| `tests/vib007PovertyFindings.test.ts` | **exit 0** — **22/22**, incl. every mutation, both accepts arms and the six older fixtures |
| the three render specs together (poverty + `vib007RenderGate` + `renderReportModule`) | **exit 0** — 75/75 |
| `@nodegx/render-measure` purity | **exit 0** — 5/5 |
| `npm run typecheck:mcp` | **exit 0** |
| `npm run typecheck:editor` | **exit 0** |
| `noodl-editor/tests-unit/bld-014` (the render-measure consumers) | **exit 0** — 49/49 |
| `npx jest --config packages/noodl-mcp/jest.config.js` (full) | ⚠️ **exit 1 — 82 suites / 1083 tests, 2 failed**, both in the `provision.test.ts` + `projectOwnsBackend.test.ts` pair. **Measured as not this session's**: the same pair run at **HEAD** fails **identically (3 failed / 20 passed)**, `projectOwnsBackend` alone passes 12/12 both at HEAD and with these changes, the failing set *moves between runs*, and neither suite imports anything changed here. ⚠️ A peer session was editing this checkout's editor/schema code throughout |
| `npm run typecheck:backend-tests` | ⚠️ **not run** — settled as un-runnable on this box (OOM, exit 134). CI `pr.yml:39` covers it |
| `npm run test:ci` | ⚠️ **not run.** Checked rather than assumed: `lessondrawncount.ts` gates on `severity === 'error'`, so three new `warning` findings are invisible to the lesson grader |
| `npm run catalog:examples` / `catalog:merge:check` | ⚠️ **not run** — no corpus, example or port edit this session |

### What AC3 does NOT close

**AC2 still owes five predicates** (V23, V28, V29, V32, V33) and **AC4 — the A/B through the Judge —
is untouched.** §3 M3 claims this retires V4, V9, V14, V15 and V26 as well as V10; only **V10** is
closed here. The other five name measurements nothing in this session takes — a dead-viewport ratio, a
band whose gutter disagrees with its siblings, a repeater with no empty state. 🔴 §2's mapping
classifies a row by the mechanism that would have **prevented** it, which is not the same claim as
*"the defect is now fixed"*.

---

## §9 🔴 AC2's TAIL BUILT, 2026-08-31 — four of the five, and three register rows were wrong

§6 left AC2 owing **V23, V28, V29, V32, V33**. Four are built. **V29 is not**, and §9.6 says why in a
sentence rather than leaving it to be inferred.

🔴 **The headline is not the four checks. It is that three of the five rows did not survive being
measured** — and in two cases the predicate §3 tabled would have condemned correct authoring,
including the phase's only WORTHY artefact. This is the fourth, fifth and sixth time in this phase
that a register row has been found materially wrong when the thing it describes was finally
measured (after V5, V6, V7 and V12).

### 9.1 V32 — the corpus gate now runs `raw-color-literal`, and it cost one repair

The row is a sentence about what a green gate claims: a `"boxShadowColor": "rgb(15 23 42 / 0.08)"`
passed `catalog:examples` **66/66 strict, warnings-as-errors**, and was caught by a person reading
the gate's header. *"The gate is green"* and *"the corpus has no raw colours"* were different claims
and only the first was true.

**Blast radius measured before the switch, not after.** Across all 67 examples the whole
`checkParameterValues` set reports **one** `raw-color-literal`: `var-avatar-picker-responsive`'s
`Color` node holding `#3366ff`. That is what made this the cheapest of the four families LAS-007
deferred, rather than a rerun of the F14 argument.

🔴 **The repair needed a ruling, and got one.** `var(--primary)` reaching a colour port *through a
`Color` variable node* is a runtime question. `Color`'s `cast` is `(value) => value`, which is a
reading of one file. `packages/nodegx-backend/tests/vib007-v32.look.ts` renders three arms on one
page: a `Color` node holding a hex (the known-firing signal), the same wiring holding
`var(--primary)`, and a `Text` whose `color` **parameter** is that token with no node in between.
Arms B and C paint the identical `rgb(37, 99, 235)`; arm A paints `rgb(51, 102, 255)`; zero console
errors. ⚠️ **B is compared against C, never against a literal** — a hard-coded `rgb(37, 99, 235)`
would be a second copy of `DefaultTokens.ts` that reddens when the palette moves and nothing breaks.

⚠️ **Also measured: the switch leaves a hole, and in the corpus the hole is luck.**
`checkParameterValues` can only reach a port the catalog declares, so a colour on a
**dynamically-discovered** port is invisible to it — `anim-hover-highlight`'s `Color Blend.color-0`
and `color-1` are two raw hexes the gate still cannot see. They are also **correct authoring**:
`Color Blend`'s own port description reads *"the inputs must be 6-digit hex, since any other notation
yields nonsense"*, so a token would break them. A different dynamic-port node would not have that
excuse. Pinned in the spec so it is known rather than assumed → register **V43**.

### 9.2 V33 — a picture with no source, and the connection list is the whole predicate

`ui-image-scrim-band` shipped `"backgroundImage": ""` with nothing wired into it, through a gate
running it 66/66 strict. The instructive half is the control in the same sweep:
`ui-card-grid-repeater`'s identical `"src": ""` **is** connection-fed and is *correct*. Two empty
strings, opposite verdicts, and only the wires separate them — so the obvious form of this check, a
static "no empty image parameters" sweep, would be wrong about one of the only two in the corpus.

`DiagnosticCode.UnsourcedImage` (`unsourced-image`, **warning**) and `checkImageSources` ship in
`validation/imageSource.ts`, on the corpus gate and on the authoring door
(`authoredCandidate.ts`, reading `connectedInputs` — the set that already answers *is this input
fed*). An **absent** parameter is not a hit; only an explicitly empty one is.

🔴 **The corpus asked for a narrowing before the check existed.** `ui-image-scrim-band`'s own
description ends *"Leaving it empty is not broken: the gradient alone is still a designed ground"* —
and it is right: `backgroundImage` and `backgroundGradient` compose into one CSS declaration. Without
an exemption this check would have contradicted the recipe it was written for, trading a V33 for a
V39. **The narrowing is the rule, not a concession to it**, and the mutation test restores the
pre-repair value *with the gradient deleted* so the exemption is proved scoped rather than absolute.

⚠️ **Warning, not error, and that is a decision**: an agent that places an Image in one call and
wires it in the next is momentarily in this state. It is nonetheless fatal in `catalog:examples`,
which runs warnings-as-errors — the gate V33 actually walked through. Whether the poverty family
should ever refuse is **V42**.

### 9.3 V23 — the predicate as tabled would have condemned the WORTHY page

§3's table says *"a glyph name absent from the installed manifest"*. Measured over all 67 examples
before anything was written: **16 glyph values, of which 7 render but sit outside the curated 212 —
and 5 of those 7 are on `ui-landing-page`**, the VIB-006 page Richard ruled *"it looks fucking
pro"*. **Not one corpus glyph fails to render.** A check written to that sentence fires on a page a
person has already ruled beautiful, for glyphs that draw perfectly. That is `dead-placeholder-text`
(§8) one section later.

**The two lists are different claims, and the product ships the proof.** The starter manifest's own
`_note`: *"This is a curated starter set. The bundled font contains all 1998 Lucide glyphs and
styles.css has a rule for every one of them, so any name from lucide.dev can be added."* The library
module's copy of the same manifest lists all **1998**, of which the starter's 212 is a strict subset.

 - absent from the **stylesheet** → draws nothing. A defect. The corpus has **none**.
 - absent from the curated **manifest** → renders, but the editor's picker cannot offer it, so a
   model copying the corpus writes a value a person then cannot find in the UI. **That is V23's
   actual complaint**, and the repair is to widen the list, not to flag the artefact.

So V23 ships as a repair with a gate: `icon-inbox`, `icon-sprout` and `icon-recycle` added to the
curated set (**212 → 215**), and `tests-unit/vib-007/corpusGlyphsAreAuthorable.test.ts` to stop the
corpus drifting off it again. ⚠️ The *correct* diagnostic — a glyph with no stylesheet rule at all —
has **zero** corpus hits and needs the project's `noodl_modules/`, which the pure value rule
deliberately cannot read (`parameterValues.ts`'s `icon` docblock says so). It belongs at the door,
where `readIconSets` already reads the manifest, and is **not built** → register **V44**.

### 9.4 V28 — both of the row's claims were wrong, and the rule that survives is narrow

**Claim 2, *"a `var()` in a units-typed port, which is dropped silently"* — disproved by a render.**
`vib007-v28.look.ts` draws four arms differing only in `width`: explicit `200px` reads **200**,
`var(--space-16)` reads **64** — exactly the token's value — no width at all reads **708**, and the
same token on `paddingLeft` insets by **64**. The value is **honoured**. Arm C is what makes that a
measurement rather than an inference: *dropped* and *resolved to something unexpected* are different
verdicts and only a rendered no-width arm separates them. A diagnostic written to the row's sentence
would have told authors that correct, working code was broken.

**Claim 1, *"30 raw pixel numbers where a `--space` token belongs"* — re-derived to 1.** Of **402**
spacing parameters in the corpus, **401** are tokenised. The 15 that look most like the family are
`Columns` `marginX`/`marginY`, and those are correct: `Columns.tsx`'s own note reads *"autofold
genuinely needs a number… A tokenised `marginX` still folds as though the gutter were 0, and a
tokenised `minWidth` disables `autoFit` entirely."*

What ships is `DiagnosticCode.RawSpacingLiteral` (`raw-spacing-literal`, **warning**) — the spacing
half of the doctrine's *"never emit a raw hex or px when a token fits"*, which until now was enforced
for colour only. **Narrowed twice, both from measurements:** the gutters are outside the port set,
and the rule fires only when a `--space` token matches the value **exactly**, so its advice is always
a token that exists. `paddingTop: 13` is a different finding and this is not it. One corpus hit,
repaired (`logic-toggle-details-panel`'s `paddingTop: 8` → `var(--space-2)`).

### 9.5 🔴 Two defects this session's own specs found in this session's own code

Worth more than the four checks, because both were invisible to every green gate:

1. **The new rule silently downgraded an existing error.** `paddingTop: "16px"` on a units-typed port
   is not untokenised — it is **dropped**, and `InvalidParameterValue` has always reported it as an
   **error** whose message is literally *"dropped silently"*. Reading the `"16px"` string as a
   spacing literal made the new rule fire first and `continue`, replacing that error with a warning
   about tokens: an author would have been told their spacing was off-system when it was about to
   vanish. Caught by `tests-unit/aib-001/parameterValues.test.ts` — a **neighbour's** spec, not this
   task's. 🔴 **A new check that quietly downgrades an old one is worse than no check, and only
   running the neighbourhood finds it.**
2. **A guard that was dead on arrival.** The rule was first written `node.type !== COLUMNS_TYPE &&
   SPACING_PORTS.has(name)`. `Columns` declares `marginX`/`marginY` and **no padding port at all**,
   and neither margin is in `SPACING_PORTS` — so the type test could never have excluded anything.
   It read as the thing protecting the fold while the port set was doing all the work. Removed, and
   the spec now asserts the real mechanism. **A dead guard is worse than no guard**: the next reader
   trusts it.

The spacing scale table was also short by four tokens (`--space-20/24/28/32`), found on the first run
of the spec that **derives** the scale from `DefaultTokens.ts` rather than restating it — the second
copy of a palette drifts, so it is graded rather than trusted.

### 9.5b 🔴 A THIRD defect, found by a peer's suite after the commit — and the caveat it exposed

`03c327c8` reddened two rows in `tests-unit/def-003/threeAuthoringActs.test.ts` (a **P80** file),
reported by the P80 session. Both are `expect(one(...)).toEqual([])` where `one()` is **unfiltered**,
sitting inside describe blocks whose subjects are `unitless-dimension` and `unknown-parameter`. One
carries an explicit anti-widening tripwire: *"Without this row the rule could be widened to every
units port and still pass."*

**The tripwire fired on a true statement and its stated concern was untouched.** It guards
`unitless-dimension` — a rule about whether a bare number is *ambiguous* — from spreading to ports
where it is not. `raw-spacing-literal` is a different code on a different axis saying the value
duplicates a token, and it was **measured at the door before anything was edited**:
`create_component` with `paddingLeft: 24` returns **`isError: false`** and carries the finding as a
warning. That is exactly `raw-color-literal`'s relationship with a perfectly valid `#2563eb`.

Both rows now assert the **set of codes** rather than total silence. ⚠️ **The guarantee is stronger
in that form, not weaker**: `toEqual([])` could only say *nobody speaks*; the set says exactly **who
may**, so a fourth rule arriving on that value still trips the row and names itself. A sweep for
every other emptiness assertion over a spacing value found no further casualties — `aib-001`'s
`errors()` filters to `severity === 'error'`, so a warning never reaches it.

🔴 **The caveat this exposed, which the corpus could not have shown.** The rule's noise was estimated
from the corpus — 402 spacing parameters, **401 tokenised** — and *the corpus is the most tokenised
artefact set that exists*, so it was the wrong population for that question. `paddingLeft: 24` is
ordinary, correct authoring and now draws a warning in every project. That is the deliberate
`raw-color-literal` bargain (**553** corpus occurrences, warning-level, *"imported content is not
wrong for being untokenised, it is just untokenised"*) and this rule sits inside it — but the
estimate was made on a population that could not have revealed it, and the next rule aimed at a
user-facing value should be priced against a real project, not against `docs/node-catalog/examples`.

✅ **The mechanism worth keeping: a check landed in a shared loop is graded by suites in OTHER
tasks' directories.** §9.5's downgrade was caught by `aib-001`; this was caught by `def-003` — after
the commit, by a peer. ⚠️ And the shape the peer named: **`validation/` was CLEAN in the working
tree, so a dirty-tree check said "not mine". It was committed.** `git log -- <path>` is what found it.

### 9.6 What AC2 still owes — one predicate

**V29 is unbuilt.** *"A `maxWidth` on a `Text` inside a centred shell — the measure belongs to the
shell."* It is the last of the six and it is the one with a **ruling already attached** (Richard,
2026-08-31: *"the structural page divs have a max width… white space to the left and right
equally"*), so the predicate does not need an experiment first the way V22 and V28 did. ⚠️ It does
need a decision the other four did not: `maxWidth` appears **42 times** in the corpus, by far the
largest raw-px population measured this session, so the blast radius is real and the narrowing is
most of the work. Read §9.4 for what happened the last time a row's number was taken at face value.

### Gates (2026-08-31) — 🔴 every row is an EXIT STATUS

| gate | reading |
|---|---|
| `vib007-v32.look.ts` (real Chrome, three arms) | **exit 0** — 1/1, `consoleErrors []` |
| `vib007-v28.look.ts` (real Chrome, four arms) | **exit 0** — 1/1, `consoleErrors []` |
| `npm run catalog:examples` | **exit 0** — 67/67 strict, with three more checks switched on |
| `catalog:examples` on a mutated copy (V32) | **exit 1** — 66/67, the one raw colour named |
| `npm run catalog:merge:check` | **exit 0** after regeneration; **exit 1 before it**, on this session's corpus edits |
| the four new specs + `undeclaredComponentPort` + `phase-55` | **exit 0** — 6 suites / 50 tests |
| editor `validation|parameterValue|diagnostic|vib-007` | **exit 0** — **16 suites / 219 tests** |
| `npm run typecheck:editor` | **exit 0** |
| `npm run typecheck:mcp` | **exit 0** |
| full `noodl-mcp` suite | ⚠️ **exit 1 — 83 suites / 1085 tests, 4 failed.** See below |
| `npm run typecheck:backend-tests` | ⚠️ **not run** — OOMs on this box (exit 134). CI `pr.yml:39` covers it |
| `npm run test:ci` | ⚠️ **not run** — a peer session had `scripts/start.ts` and a community `npm run dev` live in this checkout throughout |

🔴 **The red suites are `provision.test.ts` + `projectOwnsBackend.test.ts` again, and it was measured
rather than argued.** Neither file imports **anything** this session touched — `grep -c validation`
over both returns **0**, and every change here is in `validation/`, the corpus, `scripts/` or specs.
The **failing set moves between runs**: the full-suite run failed 4 (three in `provision`, one in
`projectOwnsBackend`), the pair run alone failed **3 / 20 passed** — a *different* three, with
`projectOwnsBackend` green. And a peer session (P80 s41) announced and was running `dev:debug` plus a
community dev server against this checkout for the whole session, which is a plausible holder of the
durable backend state these two contend on. **This is the third handoff to record the same pair.**
