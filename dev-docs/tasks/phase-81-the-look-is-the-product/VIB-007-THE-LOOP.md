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
