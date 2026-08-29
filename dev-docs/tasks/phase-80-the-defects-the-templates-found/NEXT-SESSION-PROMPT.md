# Phase 80 — next session

## State: DEF-001, DEF-002, DEF-003, DEF-004, DEF-016 closed. **DEF-006's scope closed; its (c) is not.**

**s7 (2026-08-29)** took DEF-006. Read `DEF-006-…md` **§6 first** — the sections above it are
written in the present tense and two of their present-tense claims have been acted on.

| commit | what |
|---|---|
| `<this session>` | **DEF-006 (a)+(b)** — the inert parameter, the rule that was wrong about two more, the corpus, the gate, and `find_tools` finding a group by what it is for |

Gates at close: `test:ci` **2889 specs, 4 failures, all four `AIX-006 style vocabulary` by name**
(the floor, fresh seed 75151) · `noodl-mcp` **956/956** · `typecheck:editor`,
`typecheck:editor-tests`, `typecheck:mcp`, `catalog:check`, `catalog:merge:check`,
`catalog:groups:check`, `docs:nodes:check` clean · `catalog:examples` **60/62 — red, and it was
red before this session too**; see below, it is somebody's.

---

## 🔴 The finding, in one paragraph

**The audit the task asked for found one defect; running the same instrument over the corpus the
defect was copied from found eleven, and two of those were the instrument.** DEF-006 (a) is one
composition setting a `borderWidth` under its own `borderStyle: 'none'`. But a composition's
parameters are *copied verbatim from a shipped recipe*, so the same value was in `ui-split-hero`,
and three more recipes had the identical shape, and five controls carried a `label` with `useLabel`
defaulting to `false` — `logic-consent-gate` demonstrated a consent form whose four checkboxes
render **no words at all**. The last two would not go away, and they were right not to:
`iconSourceType` **defaults to `icon`**, so `ui-slide-over`'s close button renders its icon
perfectly and the validator was calling it dead. `conditionIsUnsatisfied` answered from the
**authored** parameter bag; the canonical evaluator asks `getParameter`, whose tail is
`return port ? port.default : undefined`. And `portConditions.test.ts` — the gate written to hold
those two evaluators to one contract — modelled the canonical one as a bare bag lookup, deleting
the only behaviour they differed on.

## What to do next

**DEF-006 (c)** is the natural continuation and **§6.4 is already the work-list**: six compositions,
each with a named source node in `ui-form-field` or `ui-empty-state`, and exactly one judgement in
it (`field_error` reads the raw `--red-700`; the semantic `--destructive` is what a preset can
actually move). ⚠️ It needs a window when nobody is regenerating `templates/members-area`.

Otherwise: **DEF-017 C1**, or **DEF-007** — read its **§1.1**, which changes that task's premise
and makes it the owner of P77's D11.

Also open: **DEF-008**, **DEF-009**, **DEF-014**, **DEF-015**, and the four carried from phase 76
by reference (**DEF-010/011/012/013** — three say their fix needs a corpus sweep, and that sweep is
shared work to be done **once**).

🔴 **The standing instruction still pays.** *Find the claim in your task that is a reading rather
than a measurement, and drive that one first.* Four sessions running: s4 deleted two of three rows,
s5 found a defect the file did not contain, s6 found the defect had been fixed the day before, s7
found the rule was wrong about two of the eleven cases it reported.

## 🔴 What this session paid for, that the next one should not re-buy

- **A "0" from an instrument that resolved nothing.** The first audit run printed `total inert: 0`
  and, above it, twenty `NO TYPE` lines — the catalog is keyed `typeName`, not `name`. The right
  answer at that moment was 1; a blind instrument would have reported 0 and been believed. ✅ **Print
  the denominator beside the count**, always: the spec that landed has a companion asserting there
  are more than 20 conditional parameters for it to be about at all.
- 🔴 **A gate cannot find what its own model deletes.** `portConditions.test.ts` stood in for
  `NodeGraphNode.getParameter` with `(name) => parameters[name]`. That stand-in was the divergence.
  This is the **second** file in the repo to write that sentence about itself — `validate-examples.ts`
  has it verbatim about `plug`. ✅ When a test fakes the thing it is comparing against, **list what
  the fake drops** and ask whether the difference is the point of the test.
- ✅ **Measure a semantics change on the real corpus, and sabotage it to prove the zero.** 3 findings
  removed / 0 added across compositions + 62 examples + 40 projects (1,601 nodes). Letting defaults
  *win* instead moved the same measurement to **70 added** — which is what makes the 0 a reading
  rather than a broken loop.
- ⚠️ **`catalog:merge:check` went stale and my first candidate was a peer.** `node-definition.d.ts`
  was modified by somebody else and fitted perfectly. The actual input was
  `docs/node-catalog/examples/` — **mine**. `merge.js` reads `EXAMPLES_DIR`; grep the script before
  attributing its staleness. *Elimination over an unchecked candidate list*, caught this time by
  reading the script rather than the tree.
- ✅ **A tripwire fired and the right response was to re-decide, not to widen quietly.**
  `kitTools.test.ts` carried a control asserting a subject-query reveals nothing, written *"to fail
  the day somebody widens the purpose line"*. The widening went into a `keywords` field that no
  description renders — **8,255 tokens before, 8,255 after** — so the cost the trade was deferred
  over is zero, and the test now asserts the opposite with the number in its comment.

## Traps carried

- ✅ **The sibling sweep worked, in the direction that is benign — and only because it was named.**
  `tpl001Components.ts` and `tpl001Template.test.ts` carried DEF-006's AC5 work
  (`compositionsStillNeedingInertBorderWidthRemoval`, §4b and its control) *and* a peer's in-flight
  TPL-001/D29 change. They were deliberately left out of `e337325c` rather than committed by
  pathspec, because a pathspec commit takes a sibling's unstaged edits. The peer's own commit
  `0430a3a8` then swept the DEF-006 hunks in — **and said so in its message**. Nothing lost.
  ⚠️ The habit that made it safe was leaving them and *recording* it; had it not been recorded, a
  `git checkout --` on either file would have destroyed both halves and neither of us would have
  known which half was missing.
- ⚠️ **`test:ci`'s 2889/4 was measured with a peer's uncommitted `packages/noodl-runtime/` and
  `tests-unit/sb-017/` edits in the tree**, because `test:ci` webpacks the working tree. The floor
  held and all four failures are the named AIX-006 four, so the reading is sound — but the `gitHead`
  in the readout names the last commit, not what was compiled.
- 🔴 **`catalog:examples` is a PR gate (`pr.yml:210`) and it is RED at HEAD**, 60/62, unchanged
  before and after this session. Two recipes from `c0d6c86f` (2026-07-23) now fire rules that were
  promoted later — `failure-reaches-nothing` by **DEF-002**, on 2026-08-29. Registered in `TASKS.md`
  with owner `NONE`. It fails every PR until somebody takes it, and the fix is ~20 minutes.
- ⚠️ **The rule is now correct about defaults but still bag-only about `null`.** An authored `null`
  shadows the default (matching `getParameter`), but `evalClause`'s `NOT SET` treats `null` as unset
  where the canonical evaluator does not. No condition in the shipped catalog is reached by it;
  recorded so it is a known limit rather than a surprise.
- ⚠️ Carried and still true: a stale `packages/noodl-mcp/dist/noodl-mcp.cjs` makes a *running* MCP
  server answer from old code — measure by running the tool's functions from `src`.
