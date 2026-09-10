# FLD-013 — An agent learns what will not translate before it designs

> 🟢 **BUILT** — session 10 (2026-09-10). `packages/nodegx-export/src/structurePorts.ts` (new),
> `packages/noodl-mcp/src/catalog.ts`, `src/tools/catalogTools.ts`, `src/tools/responses.ts`.
> All five ACs measured; see §6.

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

---

## 6. What was built, and what each claim rests on — session 10, 2026-09-10

### 6.1 The shape, and the one place it departs from §3

`export` now travels with a node type on all three catalog surfaces, and it carries **three** things
rather than the one #37 asked for:

```json
"export": {
  "status": "translated",
  "structurePorts": ["size","shape","points","cornerRadius","svgSource","fillEnabled","fillColor",
                     "strokeEnabled","strokeWidth","strokeColor","strokeLineCap","startAngle","endAngle"],
  "contentPorts": []
}
```

That is `Circle`, measured over the real transport at `get_node_type`'s **default** detail. `status`
reads **`translated`** — the field the issue asked for, green, on the exact node that produced its
twenty-three refusals — and the thirteen ports beside it are the answer that is true.

🔴 **`contentPorts` is a second list and not part of `structurePorts`, deliberately.** `Range`'s
`min`/`max`/`step` refuse a wire, and `plan.ts`'s own comment says in as many words that they are
**not** structure: the wall is that the bound is not statically known, and a 0–100 slider is a wrong
answer confidently emitted. §5's first trap is *"any wording that implies 'this node will export' is
a lie"*; folding these into a field called `structurePorts` would have been the same species of
lie one level down. Same consequence, different reason, two fields.

⚠️ **The one departure from §3.** §3 says `list_node_types` emits the field *"only on non-translated
rows"*. Built as **non-translated OR refuses on a wire**, because the strict rule drops these nine:

`Circle`, `Radio Button Group`, `Video`, `net.noodl.controls.checkbox`, `net.noodl.controls.options`,
`net.noodl.controls.radiobutton`, `net.noodl.controls.range`, `net.noodl.visual.columns`,
`net.noodl.visual.icon`

— every one of them `status: "translated"`, `Circle` first. A listing silent about `Circle` is a
listing that would not have prevented #37, which is this task's whole premise. The nine cost **654
bytes** across the listing (§6.4).

### 6.2 The tables were moved, not copied — and `renderRole`'s switch went with them

`packages/nodegx-export/src/structurePorts.ts` holds `STRUCTURE_PORTS` and `CONTENT_BOUND_PORTS`
verbatim from `analyze/plan.ts`, which imports them back and remains their only writer.

🔴 **§5's last trap named the tables; the thing that actually had to move was `renderRole`'s
`switch (node.type)`.** The tables are keyed by *render role* and the MCP server has *type names*,
so without the mapping the tables are unreadable from outside. It is now `ROLE_OF_TYPE`, a
27-entry map in the same module, and `renderRole` looks its answer up there. `null` is a real
value in it (a `Router` has no role) and is distinguished from `undefined` (this table does not
decide this type) — the three cases decided by the graph rather than by the name (a component
instance, a kit node, the `catalog.isVisual` fallback) stayed in `renderRole`.

**What that refactor rests on:** the exporter's whole suite, **98 suites / 3,400 tests, exit 0**,
before and after. And a reverted arm, because a green that was never red grades nothing —
deleting `Circle: 'circle'` from `ROLE_OF_TYPE` takes `tests/visual-controls.test.ts` from
**52 passed** to **9 failed / 43 passed**.

### 6.3 🔴 The reverted arm found a hole shaped like the task

The second arm — removing `'startAngle'` from `STRUCTURE_PORTS.circle` — reddened **nothing**.

`visual-controls.test.ts` asserted four hand-picked circle ports (`shape`, `svgSource`, `points`,
`cornerRadius`). The other **nine** entries in that thirteen-port table were graded by no test in
the package, and `startAngle` — the port #37's dashboard wired, the port AC5 names — was one of
them. The table was right and nothing was holding it right.

Closed by a sweep that **reads the table instead of restating it**: every port in
`STRUCTURE_PORTS.circle` is wired in turn and must produce its defer note, under a
`expect(ports.length).toBe(13)` floor so a port *removed* from the table cannot make the test pass
by shrinking the loop. Two-sided, both directions.

**And the sweep grades behaviour, not just cardinality**, proved by a third arm that leaves the
table alone and breaks the code path — `(STRUCTURE_PORTS[role] ?? []).filter((p) => p !== 'startAngle')`
inside `visualDeferReason`. The sweep goes red and **names `startAngle`**:

```
✕ every port in the circle structure table defers, swept from the table itself
  + Array [ +   "startAngle",
```

### 6.4 AC3 — the ratchet, and what the field costs

`list_node_types` had **no size assertion at all** before this. Measured on the wire
(pretty-printed — what a client is billed for), default filter, 143 rows:

| | wire bytes | ≈tokens | JSON bytes |
|---|---|---|---|
| before | 47,860 | 11,965 | 36,327 |
| after | **58,386** | **14,597** | **43,382** |

**+10,526 wire bytes, +22.0%.** Attributed rather than assumed, on the JSON figures where the
fields separate (+7,055):

| what | bytes | share |
|---|---|---|
| `badge` on the ten deferred picker rows | 3,890 | 55% |
| empty `structurePorts`/`contentPorts` arrays | 1,154 | 16% |
| the two port lists where they are non-empty | 654 | 9% |
| the `"export": {…}` wrapper and `status` on 36 rows | ~1,357 | 19% |

⚠️ **The 1,154 bytes of empty arrays are deliberately not trimmed.** Omitting them would save 2.7%
of the delta and reintroduce exactly the ambiguity AC5 exists to remove — absent and empty must not
be the same answer. The ceiling is set at **62,000** wire bytes, 3,614 above the reading, with a
`> 40,000` floor beneath it so a listing that collapsed to nothing could not pass.

### 6.5 AC2 and AC4

**AC2, the cardinality: 143 picker rows in, 143 classified, 0 unclassified.** With a presence
control, because a join that classifies everything it is handed proves nothing unless `undefined`
is reachable: `exportInfoOf('Nonesuch Node')` and `exportInfoOf('/Pages/Home')` both return
`undefined`. 🔴 **That `undefined` is a real answer and is not "will not export"** — a kit node's
export is decided by its kit (EXP-010) and a component instance's by its component, and emitting
`structurePorts: []` for one would claim a measurement nobody has made.

**AC4: the `nodeDocBudget` ceilings were NOT moved, because nothing went red.** Re-measured rather
than assumed — the ceiling case is still `Group`, **13,689 → 13,718 tokens** against a 14,300
ceiling, so the headroom the ratchet's own convention preserves went 611 → **582**. Worst single
summary 1,725 of 3,000. The 8,280-token `toolDisclosure` gate reads **8,275, 5 under, unchanged**:
§5's second trap says do not put this in the tool *descriptions*, and nothing was. What tells an
agent the field exists is `exportCoverage.note` in the listing payload — in-band, paid for once.

### 6.6 The stale docstring, and why the fix is not a new number

§3 asked for the stale `ledger.ts:83` prose (*"97 of the 127"*) to be fixed. The ledger now says
**117 of 127 (92%)**. The sentence was removed rather than corrected, with the reason written where
the next person will read it: a prose copy of a computed number, in the file whose entire argument
is that there is only one list. `ExportCoverage.percent`'s rounding illustration was re-derived to
the live numbers.

### 6.7 What was run

| gate | reading |
|---|---|
| `nodegx-export` full suite | **98 suites / 3,400 passed / 1 skipped, exit 0** |
| `noodl-mcp` full suite | 104 suites, **2 failed / 102 passed**; 3 tests |
| `noodl-mcp` new spec `fld013ExportReach` | **11/11** |
| `noodl-mcp` `nodeDocBudget` + `toolDisclosure` | 33/33 |
| `tsc --noEmit`, both packages | 0 |
| `noodl-mcp` esbuild bundle | exit 0; `structurePorts` present in `dist/noodl-mcp.cjs` |

⚠️ **The two red `noodl-mcp` suites are pre-existing and were re-proved against *this* change**, not
inherited: `def018-def020-layout-drive` (D28) and `sbr009ThemeEditorDrive` (two AC2 arms). Every
changed file was snapshotted, `git show HEAD:<path>` written over it, the two new files moved aside,
and the pair re-run: **identically 3 failed / 15 passed**. Restored and md5-verified byte-identical
both ways. Never `git stash` on this checkout.

🔴 **The three resolvers were all checked, because they are the trap this package carries.** The
typechecker (`tsconfig` `paths`), jest (`moduleNameMapper`) and esbuild (`build.mjs` `alias`) each
have their own `@nodegx/export` route; the bare specifier is aliased in all three, which is why
`catalog.ts` imports the index and not a subpath. `dist/noodl-mcp.cjs` was rebuilt and grepped —
a stale `dist/` is how a merged field stays invisible.
