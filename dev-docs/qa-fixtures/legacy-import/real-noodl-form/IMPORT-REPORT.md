# Import report

Imported from `<fixture>/real-noodl-form` ("Export") on 2026-08-02T00:00:00.000Z.

NodeGX is a fresh start, and legacy projects import on a best-effort basis. This file is the honest half of that: every construct in the imported set is accounted for below, nothing was silently dropped, and anything that could not be converted is still in the project — visibly marked, with its original type and parameters — rather than deleted.

## Verdict

**PROCEED** — Everything in this project converted unchanged. There is nothing to repair.

- Nothing was left unconverted.

## Summary

| Outcome | Constructs |
|---|---|
| Could not be converted (`placeholder`) | 0 |
| Not carried across (`dropped`) | 0 |
| Converted, with changes (`converted-with-changes`) | 0 |
| Converted — notes (`converted`) | 82 |
| **Total assessed** | **82** |

0 entries below. The remaining 82 constructs used current node types and converted without comment — they are counted, not listed.

## For your AI assistant

This report is addressed to an assistant as much as to you. The machine-readable form is `import-report.json` beside this file — an assistant should read that rather than parse this prose.

- Every entry with outcome `placeholder` is a node still present in the project, with its original type name, parameters and wiring intact. Nothing was dropped; you do not need the source project to know what was there.
- Look each `equivalents` type up in the node catalog (SUB-004/005) before proposing a replacement — the ports differ between a legacy node and its replacement more often than not, and `portChanges` lists the ones we know about.
- Propose repairs through the authoring loop (AIX-002) as a whole-component candidate. It arrives as a reviewable diff against the live component; the user accepts or rejects it. Do not edit nodes in place.
- The semantic validator (SUB-006) will reject a candidate that leaves a placeholder unresolved or wires a port that does not exist. Run it before submitting; its diagnostics are the fastest way to find a wrong port name.
- When `verdict.recommendation` is `rebuild`, say so to the user before offering repairs. A specification to rebuild from is a better deliverable than twenty partial fixes, and the entries below are that specification.
