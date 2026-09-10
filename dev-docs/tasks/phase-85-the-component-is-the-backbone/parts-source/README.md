# `parts-source` — the project the shelf's three parts were exported from

CMP-004 AC3 / CMP-005 AC5. This is a real NodeGX v2 project holding three components:

| component | shelf slug | nodes |
|---|---|---|
| `/Parts/Format Date` | `format-date` | 4 |
| `/Parts/Format Full Name` | `format-full-name` | 3 |
| `/Parts/Sanitise Email` | `sanitise-email` | 3 |

🔴 **This directory is the INPUT and `library/prefabs/<slug>/` is the OUTPUT.** The entries on the
shelf were not typed — each was written by `export_to_library` from the component here, with the
metadata in [`export-manifest.json`](export-manifest.json). `packages/noodl-mcp/tests/cmp004Parts.test.ts`
re-runs that export into a temp shelf on every run and compares every byte with what is shipped, so
**editing a shipped entry by hand reddens the suite and names the file**. To change a part: change
it here, re-export, and commit both sides.

The components were authored through `create_component` against a server started on this directory,
not by writing the v2 JSON — the same door an agent uses, so the writes were validated (0 errors,
0 warnings; `validate_project` reports 10 nodes / 32 endpoints).

## Why these three

Each is named in the phase's own task files as a part the product does not have:

- **Format Date** — CMP-005's worked example, and the demonstration of the thirteen tokens AC2 added.
- **Format Full Name** — CMP-003 measured `Format full name` as the single most-reused component in
  a real app (9 instantiations in LearnBook v5.1).
- **Sanitise Email** — CMP-004 §2's own sentence: *"A builder who writes a good `Sanitise email` has
  nowhere to put it."*

## ⚠️ A product defect found while building these, owner NONE

The `Expression` node **mints a phantom input port for every method name in a chained call**, plus
a matching `runOnChange-` checkbox for each. Measured by driving the real node's
`setup`/`nodeAdded.Expression` path:

| expression | ports minted |
|---|---|
| `email.trim().toLowerCase()` | `email`, 🔴 `toLowerCase` |
| `(first + ' ' + last).trim()` | `first`, `last`, 🔴 `trim` |
| `[first, last].filter(Boolean).join(' ')` | `first`, `last`, 🔴 `filter`, 🔴 `join` |
| `email.trim` | `email` — clean |

`parsePorts` is a text scan: a dotted path contributes only its root, so a method call whose
receiver is a bare identifier is fine, but the moment a chain puts a `)` before the `.`, the method
name is matched as a fresh identifier and `portsToIgnore` does not list it. Nothing breaks at
runtime — the name is bound as an unused argument — but **no string-manipulating `Expression` can
be written in NodeGX without shipping junk ports**, which is the CMP-003 thesis in miniature.

That is why all three parts use a `Function` node, whose `scriptInputs`/`scriptOutputs` are
declared rather than scraped. It is also the shelf's argument: somebody writes the awkward
JavaScript **once**, behind a clean `Component Inputs` interface, and nobody else writes it again.
