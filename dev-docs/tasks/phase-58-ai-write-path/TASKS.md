# Phase 58 — the tasks (AWP: the AI write path)

**Created:** 2026-08-08, out of [README.md](README.md) and the session-8 replays recorded in
[phase-55/LAS-011](../phase-55-llm-authoring-support/LAS-011-ACCEPTANCE-MATRIX.md).

**Every claim about existing code in these files was read in source, and every behavioural claim was
verified by running it** — the visual-roots diagnosis was settled by rendering the same project four
ways on a copy, not by reading. Keep that rule for anything added.

**The exit test:** a model that has never seen NodeGX builds the storefront brief through MCP, never
passes `visual_roots`, and gets a page on screen — or is told exactly which component is missing one.
Then re-replay on DeepSeek V4 Pro (~$4) and put the row beside session 8's.

## The one-line premise

Two 2026-class open-weight models each built a correct storefront and **neither page appeared**. One
was defeated by a field our writer omits and the editor derives; the other was passed as
*"Rendered clean"* while invisible. **Neither failure was a model failure.**

| Task | File | One line | State |
|---|---|---|---|
| AWP-001 | [AWP-001-DERIVE-VISUAL-ROOTS.md](AWP-001-DERIVE-VISUAL-ROOTS.md) | derive `visualRoots` in the writer so it cannot be omitted; report it back; derive on read | ✅ **done 08-08** |
| AWP-002 ⭐ | [AWP-002-WRITE-PATH-CONFORMANCE.md](AWP-002-WRITE-PATH-CONFORMANCE.md) | **the flagship** — MCP output must survive the editor's own round trip; the gate that catches the *next* F43 | ✅ **done 08-08** |
| AWP-003 | [AWP-003-DIAGNOSE-THE-BLANK-PAGE.md](AWP-003-DIAGNOSE-THE-BLANK-PAGE.md) | a blank page must be diagnosed and the component named, not guessed at from a list of causes | 📋 open |
| AWP-004 | [AWP-004-EYES-THAT-FAIL-AN-INVISIBLE-PAGE.md](AWP-004-EYES-THAT-FAIL-AN-INVISIBLE-PAGE.md) | stop calling a page "clean" because no known check fired; three checks these runs earned | 📋 open |
| AWP-005 | [AWP-005-NODE-DOC-BUDGET.md](AWP-005-NODE-DOC-BUDGET.md) | `Group` costs 11,000 tokens and `detail:"summary"` is broken for 100% of ports | 🟡 **§1 done 08-08** |
| AWP-006 | [AWP-006-PROGRESSIVE-TOOL-DISCLOSURE.md](AWP-006-PROGRESSIVE-TOOL-DISCLOSURE.md) | 22,968 tokens of tool schemas resent every turn, ~30% of every bill, 63% of it backend admin | 📋 open |

## Suggested order, and why

1. **AWP-001** first — smallest, highest severity, and it produces AWP-002's first fixture. An agent
   can author an invisible app until this lands.
2. **AWP-002** immediately after, and **watch it fail before AWP-001 lands** — a gate never seen
   failing is not known to work, and this repo has caught two green-looking checks that way.
3. **AWP-005 §1** is a one-line fix worth 4.5× on the dominant call. Cheap enough to take any time.
4. **AWP-003 + AWP-004** together — they are the two halves of "the instruments told a model the wrong
   thing", and they share fixtures (DeepSeek's project is the positive control for one and the
   negative control for the other).
5. **AWP-006** last of the six: the largest change, and its acceptance wants AWP-005 already in so the
   re-replay measures both levers at once.

## Standing constraints

- **Structure > gate > documentation.** F43 had no derivation, no gate *and* no documentation, and
  adding a `.describe()` is the fix that comes to mind first and helps least.
- **If a task changes the served tool surface, re-run every matrix row** rather than comparing across
  surfaces — LAS-010's rule, and a 29% cost cut would otherwise read as a model improvement.
- **A tool the model cannot see is a capability the product does not have.** Test every disclosure
  scheme against a brief that needs the hidden half.
- **Node attribution in the DOM is still impossible** (LAS-012 §3: the viewer stamps no node id).
  Everything specced here is measurable without it. Do not let a task grow into that.
- **The four replay projects are real agent output and free.** Use them as fixtures rather than
  authoring synthetic ones — but do not rewrite them, they are evidence.

## What is deliberately not here

- **Prompting changes.** Nothing in this phase changes what we tell a model to do.
- **LAS-013 §1 (`extract_component`)** stays filed in phase 55, **with its premise corrected**:
  `repeated-sibling-subtree` cost DeepSeek one rejection and Kimi two, both recovered. F40 is a
  small-model cliff, not an open-weight one, so that task is a lower priority than it looked.
  LAS-013 §2 is superseded by AWP-006.
- **A second benchmark model sweep.** Session 8 answered the model question for now: hosted open
  weights work, DeepSeek V4 Pro is the value pick at $5.83, and the recommendation per role is
  unchanged.
