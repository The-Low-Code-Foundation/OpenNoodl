# EXP-013 — "Not exportable yet", said where the node is placed

**Status:** 🔴 **NEW — the next first job of the phase, before EXP-011 Tier 2.8 row 1.**
**Owner:** P18. **Opened by:** Richard's ruling, 2026-09-03 (EXP-011 §50): *"we need to be super clear
when someone is doing code export which nodes can't be exported and what will happen, because if it's
'well your whole error pathway will just not work, sorry bud' then there's no point in exporting."*
**Priority:** 🔴 High. **Difficulty:** 🟡 Medium — the attribution half is the work; the badge is a wire.

## Objective

A person learns that a node will not export **at the moment they place it**, not at the moment they
export. And when they do export, the pre-flight names the nodes, says what each refusal silences
downstream, and gives a plain verdict when the loss is a pathway rather than a node: *change these
nodes, or wait for a release that translates them.*

## What is true today (measured, §50.2)

1. **A refusal cascades.** `analyze/plan.ts` refuses every node whose only trigger is a refused node,
   with the reason *"its Do is never fired by a translatable trigger"* — the record verbs, `Navigate`,
   `HTTP Request`, `Cloud Function`, the files. One `Run Tasks` in a flow silences everything behind
   it; one refused `On App Error` removes the whole error pathway. The pre-flight's sentence *"left
   out, never translated wrongly"* is true of the node and silent about the pathway.
2. **Nothing in the editor reads the ledger.** No badge in the node picker, nothing in the property
   panel. The first a person hears is `CodeExportModal`, which lists **components with refusal
   counts**, not node names. Names and reasons arrive in `EXPORT-REPORT.md` after the write.
3. **The ledger already carries the sentence per type** — `coverage-ledger.json`, 60 `deferred`
   rows, every exemption enforced to start *"scheduled — "* or *"deliberately out of scope — "*.
   The editor reaches `@nodegx/export` already (EXP-012's webpack alias), so the ledger is one import.

## Acceptance criteria

1. **The badge.** Every picker card and property-panel header for a type whose ledger status is not
   `translated` carries *"Not exportable yet"* (scheduled) or *"Not exportable"* (deliberately out of
   scope), with the ledger's reason on hover or expand, **read from `coverage-ledger.json`** — never a
   second list. Graded by a `tests-unit` spec that renders one card of each status and one
   `translated` control (jest can grade React here — memory `this-jest-can-grade-a-react-component`).
2. **The pre-flight names nodes.** `PreflightSummary` carries, per component, the refused nodes by
   type and label, not only a count; the modal renders them. Same list in `EXPORT-REPORT.md`.
3. **The cascade is attributed.** A refusal whose reason is *"never fired by a translatable trigger"*
   names the refused node that starves it (the `ctx.defer` sites in `plan.ts` carry no cause today —
   that is the code change). The pre-flight then says, per root refusal, *"…and N nodes are left out
   only because this one fires them"*, and the headline separates the two numbers: **N things the
   export has no rule for; M more silenced by them.** Assert cardinality: a fixture with one root
   refusal and three dependants reads 1 + 3, never 4.
4. **The verdict.** When a root refusal's cascade holds a backend verb, a navigation, or an
   `On App Error`, the modal leads with a plain sentence: *"This export would be missing a pathway,
   not a node: <the root>. Replace it or wait for a release that translates it."* Graded on two
   fixtures — one that trips it and one that does not — and the button text changes with it.
5. **The report file says the same** as the modal; `readme.ts`'s next steps list the root refusals
   first, since fixing a root fixes its cascade.
6. **Gates.** Editor `tsc -p tsconfig.json --noEmit` 0 (the editor compiles `@nodegx/export` non-strict
   — EXP-012's trap); `nodegx-export` tsc 0 and jest with the cascade rows; the `tests-unit` badge
   spec; `export-ledger:check` OK; picker floor unchanged (no translation moves).
7. **Driven.** The editor opened on a copy of a fixture holding a `Run Tasks` (or `On App Error`)
   feeding a `Cloud Function`: the badge shows on the placed node; the pre-flight reads *1 + N* and
   the verdict; screenshots in the scratchpad. `run-editor`, one heavy job at a time.

## Not in scope

- Translating any node (EXP-011).
- A picker filter that hides non-exportable nodes — Richard's ruling is *warn*, not *hide*.

## Where the pieces are

| piece | file |
|---|---|
| the ledger | `packages/nodegx-export/coverage-ledger.json` — `entries[].status`, `entries[].exemption` |
| the pre-flight data | `packages/nodegx-export/src/emit/preflight.ts` — `summarizePreflight`, `attention[]` |
| the modal | `packages/noodl-editor/src/editor/src/views/PopupLayer/CodeExportModal.tsx` |
| the cascade sites | `packages/nodegx-export/src/analyze/plan.ts` — `grep -na 'never fired by a translatable trigger'` |
| the report + readme | `packages/nodegx-export/src/emit/report.ts`, `readme.ts` |
| the picker card | `packages/noodl-editor/src/editor/src/views/NodePicker/components/NodePickerCard/` |
