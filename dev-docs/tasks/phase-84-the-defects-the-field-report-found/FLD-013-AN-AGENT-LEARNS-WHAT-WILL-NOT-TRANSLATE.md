# FLD-013 — An agent learns what will not translate before it designs

🔴 **The field this issue asks for would not have prevented the problem this issue describes.** Ship
it as asked and the next agent makes the same mistake against the same node.

## 1. The person sentence

**An agent choosing nodes for an app it intends to export learns, before it designs, which of them
refuse — and on which ports.**

## 2. What was reported, and what the code says

[#37](https://github.com/The-Low-Code-Foundation/NodeGX/issues/37): `list_node_types` and
`get_node_type` return no export information, so a dashboard was designed on `Circle`/Shape and only
at export time did **23 refusals** appear. Requested:
`export: { status, badge, reason }`.

Measured 2026-09-09 — **the easy parts are all true:**

- `nodegx-export/src/ledger.ts:40` — `ledgerEntryOf(typeName)` returns `{typeName, status, exemption?}`;
  `:61` — `exportBadgeOf(typeName)` returns `{kind, label, reason}` and is `undefined` for anything
  not `deferred`. `exportCoverage()` at `:89`, `alphaNotice()` at `:102`.
- **Counted from the JSON, not quoted:** 176 entries — translated 124, deferred 35, backend-only 16,
  stubbed 1. `pickerCoverageFloor: 117`, `pickerCoverageTotal: 127`. ⚠️ The docstring at `:83` still
  says "97 of the 127" — stale prose beside computed numbers.
- Attach points are the response builders, not the tool wrappers: `catalog.ts:259`, `:600`, `:657`,
  `:700`; types `NodeTypeRow` (`:235`), `NodeTypeDetail` (`:358`), `NodeTypeSummary` (`:476`).
- ✅ **The dependency fear is unfounded.** `@nodegx/export` is `private: true` with no build, but
  `noodl-mcp/src/editor-deps.ts:29` **already imports another package's TypeScript by relative path**
  and esbuild bundles it — the documented pattern. `ledger.ts`'s only import is the JSON, and
  `resolveJsonModule` is on. Proved by running a spec that imports both.
- **Budget, measured:** the 8,280-token gate (`toolDisclosure.test.ts:83`) covers **descriptions and
  instructions, not responses**. `list_node_types` today is 143 rows / 36,566 bytes / ≈9.1k tokens.
  `status` on every row costs **+12.9%**; the full badge on only the **10 deferred** picker rows costs
  **+10.6%**. All 143 picker rows join the ledger — no misses.

🔴 **And here is why the issue as written fails.** `Circle` is `status: "translated"`, with the note
*"inline SVG with the runtime arc paths computed at generation time"*. The requested field would have
read **green** on the exact node that produced all 23 refusals. The refusal is **per parameter
source**, not per type: `visualDeferReason` (`analyze/plan.ts:19285`) refuses when any of
`STRUCTURE_PORTS[role]` arrives over a wire, and `circle`'s list (`:19194-19209`) is `size, shape,
points, cornerRadius, svgSource, fillEnabled, fillColor, strokeEnabled, strokeWidth, strokeColor,
strokeLineCap, startAngle, endAngle` — nearly every port it has.

## 3. Scope

- `get_node_type`: emit `export: {status, badge, reason}` unconditionally. ~60 bytes on a 5,410-byte
  `Group` summary — negligible against the `nodeDocBudget` ratchet.
- `list_node_types`: emit the field **only on non-translated rows**, plus one payload-level summary
  line from `exportCoverage()`/`alphaNotice()` so an agent knows silence means translated.
- 🔴 **Ship `export.structurePorts` too** — "a wire into any of these refuses this node" — sourced
  from `STRUCTURE_PORTS`/`CONTENT_BOUND_PORTS` (`plan.ts:19161`, `:19227`). They are module-private
  consts today; moving them into a small exported module beside `ledger.ts` is the only non-trivial
  part of this task, and without it the feature is decorative.
- Re-export from `editor-deps.ts` with a named block, following the file's own convention.
- Fix the stale `:83` docstring while you are in the file.

## 4. Acceptance criteria

1. **(person)** An agent calls `get_node_type` on `Circle` **before** designing and learns that a
   wire into `startAngle` will refuse the node. 🔴 **This AC is not satisfied by
   `status: "translated"` alone** — that is the whole point of the task.
2. Every picker row joins the ledger, asserted as a **cardinality**: 143 rows in, 143 classified. A
   join that silently misses is how a "not exportable" badge goes missing.
3. `list_node_types` size is asserted against a ratchet, which does not exist today. Record the
   before and after byte counts in the spec.
4. `get_node_type` stays under the existing `nodeDocBudget` ceiling for the storefront types, and the
   baseline is re-recorded deliberately, not bumped to make a red go green.
5. A spec asserts `structurePorts` for `Circle` contains `startAngle`, and that a node with no
   structure ports reports an empty list rather than the field being absent — absent and empty must
   not be the same answer.

## 5. Traps

- 🔴 **A per-type status is a fact about the type, not about the graph.** Any wording that implies
  "this node will export" is a lie for every structure-port wire. Word the field as what it is.
- ⚠️ Do not add the field to the tool **descriptions** — that budget is the one that is actually
  gated, and it is nearly full.
- ⚠️ `exportBadgeOf` returns `undefined` for translated types. Emitting `badge: undefined` on 133
  rows costs bytes for nothing; omit the key.
- ⚠️ Moving `STRUCTURE_PORTS` out of `plan.ts` touches the export's hot path. Move, do not copy — a
  second copy of that table will drift, and this repo has already paid for a drifting second copy of
  a palette.
