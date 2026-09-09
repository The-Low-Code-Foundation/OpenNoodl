# HLS-005 — The report does not say "nothing left over" when something was

The export's report is the product's own account of what it did. When it is wrong in the
*reassuring* direction, every downstream check inherits the error — and a CI pipeline has nobody to
notice.

## 1. The person sentence

**If the export drops something the author wired, the author is told — and a component the report
files under "nothing left over" really has nothing left over.**

## 2. What was reported

[#23](https://github.com/The-Low-Code-Foundation/NodeGX/issues/23): in a ten-page project, **7 of 25
component inputs** were emitted as props declared in the `Props` interface and never read. The
authored wire is gone and the value evaporates. **Five of the seven are in components the report
lists under *"Translated with nothing left over"*.**

The rule is not "colours survive, sizes do not". One input reached three sinks and two survived:

```
statusColor -> sr_fill.backgroundColor   translated (inline style)
statusColor -> sr_ptext.color            translated (inline style)
statusColor -> sr_pdot.backgroundColor   DROPPED, unreported
load        -> sr_fill.width             DROPPED, unreported
```

Where to start (measured 2026-09-09): the sentence is minted at
`emit/report.ts:404` and `emit/preflight.ts:301-302`; the prop/binding decision is around
`analyze/plan.ts:4655-4690`, which already documents two *authoring* defects the corpus carries
(an undeclared `Component Inputs` port, and a node whose ports are plugged the wrong way) —
🔴 **check first whether these seven are that, or a third thing.** The report distinguishing
"you did not declare it" from "we dropped it" is part of the fix either way.

## 3. Scope

- Find the actual rule that decides whether a binding is emitted. Name it. It is currently
  inferrable only by diffing outputs.
- Emit the bindings that should be emitted, or refuse them **loudly** — a `TODO(export)` marker and
  a report line, the mechanism the exporter already uses for everything else it cannot do.
- 🔴 **The report's arithmetic becomes an assertion**: "translated with nothing left over" is
  computed from what was emitted, not asserted alongside it. A component in that list with an
  unread prop is a contradiction the exporter should not be able to state.

## 4. Acceptance criteria

1. **(person)** Export a component with an input wired to a `width` and to a `backgroundColor`.
   Open the generated page. Both do what the canvas did — or the report names the one that did not,
   by input name and sink, and the component is not in the "nothing left over" list.
2. A gate over the corpus: **no generated component declares a prop it never reads.** Cardinality,
   over the emitted artefacts, not over the plan that intended them.
3. A gate: no component appears in "nothing left over" while carrying any refusal. This is the
   report contradicting itself, and it should be unrepresentable.
4. The seven inputs from #23 are each accounted for by name — emitted, or refused-and-reported —
   in a spec that names them.

## 5. Traps

- 🔴 **A source-text `toContain` passes on dead code.** Assert the prop is *read*, not that the
  string appears — and verify the consequence in the rendered output where the drive can reach it.
- 🔴 **Count the artefact, never the plan.** The report is generated from the same analysis that
  decided the drop; a check fed by its own producer cannot bootstrap. Read the emitted `.tsx`.
- ⚠️ #23's reproduction is a project we do not have. Reconstruct the shape from the table in the
  issue rather than asking the reporter for the project, and say in the spec that it is a
  reconstruction.
- ⚠️ Every generated prop is typed `any` today, which is why `tsc` cannot see this. If HLS-004
  tightens the prop contract, some of #23 may become a compile error — coordinate, and do not let
  HLS-004's gate be the only thing that catches it, because `any` returning would silently disarm it.
