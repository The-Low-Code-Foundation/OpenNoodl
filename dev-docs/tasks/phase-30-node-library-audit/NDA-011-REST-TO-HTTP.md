# NDA-011: REST → HTTP consolidation

## Metadata

| Field | Value |
|-------|-------|
| **ID** | NDA-011 |
| **Phase** | Phase 30 — Node Library Audit & Remediation (Track O) |
| **Tier** | 3 |
| **Priority** | 🟡 Medium — the workaround (use HTTP Request) already exists |
| **Difficulty** | 🟢 Low–Medium — mostly an assessment, then a deprecation |
| **Estimated Time** | 1 week |
| **Prerequisites** | None |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟢 **Sonnet 5** |

## Objective

Confirm the HTTP Request node is a practical superset of the REST node, then **deprecate the REST
node's DSL rather than improve it**.

## The position

Richard: "The REST node is a fine idea in theory, but a mess in practice. I dunno who thought of this
cute little rest custom language you need to use, but it's shit and nobody uses it."

The audit agrees, and the reason is not aesthetic. There are now **two HTTP nodes** covering
overlapping ground — [`restnode.ts`](../../../packages/noodl-runtime/src/nodes/std-library/data/restnode.ts)
at 671 lines and [`httpnode.ts`](../../../packages/noodl-runtime/src/nodes/std-library/data/httpnode.ts)
at 1,078 — and the newer one does not need a DSL. Improving the DSL would mean investing in the worse
of two overlapping paths.

**This task's first output is therefore an assessment, not a change.** If HTTP Request turns out not
to cover something REST does, that is a finding and the task re-scopes.

## §1 — Capability comparison (do this first)

Produce a table: every capability the REST node's resource DSL expresses, against whether HTTP Request
can express it. Pay attention to the things a DSL is actually good at and a port list is not:

- multiple related endpoints declared once,
- path templating and parameter substitution,
- shared auth/headers across a resource,
- response shaping.

If HTTP Request covers all of it, proceed to §2. If not, the gap list becomes the spec for §2 instead.

## §2 — Delete or deprecate, on merit

Assuming §1 confirms the superset:

1. Remove REST from the node picker. The register already shows **4 deprecated nodes still in the
   picker** — do not add a fifth, and fix those four here since the mechanism is identical.
2. **Decide deletion on maintenance cost, not on installed base.** Per
   [`COMPATIBILITY-POLICY.md`](../../reference/COMPATIBILITY-POLICY.md) (2026-07-30), legacy Noodl
   projects are no longer a reason to keep a node alive — the previous instruction here ("existing
   projects must keep running; deprecated means hidden, not removed") is **void**. If REST is a true
   subset of HTTP Request, deleting it removes a permanently-maintained duplicate; a project that
   used it fails loudly at load and the importer flags the node. That is the preferred outcome.
   Keeping it needs its own argument.
3. Attempt the mechanical REST → HTTP Request rewrite — the DSL is structured, so it is plausibly
   within reach, and it is exactly the kind of conversion the legacy importer
   ([LIB-006](../phase-21-library-and-import/LIB-006-LEGACY-IMPORT-ASSIST.md)) should own. Timebox
   it; where it fails, emit a report entry rather than a shim.

## §3 — Clean up HTTP Request while you are here

[`httpnode.ts`](../../../packages/noodl-runtime/src/nodes/std-library/data/httpnode.ts) carries six
separate variants of the same guard at lines 353, 369, 407, 444, 453 and 462:

```js
if (value !== undefined && value !== null)          // :353
if (value !== undefined && value !== null && value !== '')  // :369
if (value !== undefined)                            // :444
```

Three different opinions about what "empty" means, in one file. That is defect class A2 in
concentrated form and it is why an empty header or query param behaves differently depending on which
one it goes through. Normalise to one helper, following whatever [NDA-003](./NDA-003-EMPTY-VALUE-CONTRACT.md)
settles.

Also: `HTTP Request.responseHeaders` is one of the 13 `object`-typed outputs that can reach almost
nothing (see [NDA-014](./NDA-014-TYPE-DEAD-ENDS.md)). Worth confirming it is usable at all today.

## Success criteria

1. The §1 comparison table exists and is committed, whatever it concludes.
2. If the superset holds: REST is out of the picker, its deletion-vs-deprecation call is recorded
   with a maintenance-cost reason, and a conversion path (mechanical or reported) exists.
3. The four already-deprecated-but-visible nodes are out of the picker too.
4. `httpnode.ts` has one empty-value helper, not six inline guards.
