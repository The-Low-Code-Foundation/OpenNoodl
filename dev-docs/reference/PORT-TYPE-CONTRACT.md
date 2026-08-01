# The Port Type Contract

**Status:** Normative decision. Decided 2026-07-29 (phase 30, NDA-014 §1), on the spec's
recommendation: **option A now** (give the dead-end types outbound casts), **option C as the
direction** (separate "declared type" from "connection compatibility"). Option B alone — making `*`
the honest default — is rejected because it throws away exactly the type information NDA-005 and
the AI authoring loop need.

## The defect this closes

The typecast table ([`nodelibraryexport.ts:202-268`](../../packages/noodl-runtime/src/nodelibraryexport.ts#L202-L268))
is the single source of what the editor lets an author wire. Before this decision:

```
object → []            array → [collection]           color → []
```

An `object`-typed output could reach **4** of the library's 1,750 input ports, while an untyped
Function output defaulted to `*` and connected anywhere — so declaring the accurate type made a
port strictly less useful than leaving it alone. The 13 `object` outputs stranded this way include
`HTTP Request.responseHeaders`, `Query Data.firstRecord`, and every Cloud Data `error` output —
the very objects the Failure Contract needs wireable.

## The rule

> **Declaring a port's true type must never make it less connectable than leaving it untyped.**
> A type is a promise about the value, not a fence around the wire. Whenever the value has an
> obvious, lossless-enough rendering in another type, the cast exists.

## Decision A — the casts to add now

| From | To | Conversion | Rationale |
|---|---|---|---|
| `object` | `string` | `JSON.stringify(value)` | "wire it to a Text node and see it" — the reported symptom |
| `array` | `string` | `JSON.stringify(value)` | same; also unstrands `array` beyond `collection` |
| `color` | `string` | resolved color string, as `context.styles.resolveColor` already produces | a Color variable's output currently reaches only `color` inputs |

Deliberately **not** added: `object → array` (Object.values is a guess about intent, not a cast),
anything → `signal`, and inbound casts *into* `object` beyond the existing `string → object`
(which `setInputValue` implements by eval, [`node.ts:308-339`](../../packages/noodl-runtime/src/node.ts#L308-L339)).
Casts are additive only — nothing that connects today stops connecting.

### The conversion has to actually run

The table gates the editor; it converts nothing. `setInputValue` already has the inbound half — a
string arriving at an `object`/`array` port is parsed. The outbound half must mirror it: a
non-null `object`/`array` value arriving at a **`string`-typed** input is `JSON.stringify`ed
before the input's own cast runs, otherwise the new wire renders `[object Object]` and the cast is
worse than the fence it replaced. Same guarded-reporting pattern as the eval branch (circular
structures raise through the error channel and deliver `''`). Scope the mirror to inputs whose
declared type is `string` — do not stringify into `*` inputs, which legitimately receive objects.

> ⚠️ **Amended 2026-08-01 after building it, and the wording above is the pre-amendment text.**
> The clause is phrased over the **runtime shape of the value** ("a non-null `object`/`array` value
> arriving at a `string`-typed input"). Implemented literally it also fires for an object handed to
> a string port **directly through `setInputValue`** — which is not a wire at all — and for one
> arriving from a `*`-typed *output*. Both break behaviours that were already pinned:
> `net.noodl.TextAccumulator` refusing an object chunk and naming the mis-wiring (NDA-004 B1), and
> the `Object` node dereferencing a plain object wired to `Id` (NDA-012 C3).
>
> **As built, the cast is a property of a wire between two declared ports**: source declared
> `object`/`array`, target declared `string`, applied in `_setValueFromConnection`. That is what the
> table above actually describes — a cast *from* one port type *to* another. Rows
> `NDA-014 scope: …` in `nda-014-outbound-string-cast.test.ts` pin it.
>
> ⚠️ Two things had to be plumbed before the cast could fire at all, and neither was obvious from
> this document: a declared `string` port carried **no type at runtime** (`nodedefinition.ts`
> `typesToSaveInInput`), and the Function node registered its author-declared outputs with **no
> type** (`registerOutputIfNeeded`, where the type lives in the `outtype-<label>` parameter). See
> FINDINGS `TT-i`. **Richard to confirm the amended wording.**

### Function/Script output enum

With the casts in place, choosing `Object` on a Function output is no longer strictly worse than
`*` — criterion 3 of NDA-014 is satisfied by making the choice honest rather than by removing it.
The default for an undeclared output stays `*` (`simplejavascript.ts:442`).

## Direction C — where this is going (not built in phase 30)

The real defect is that one field does two jobs: **describing the value** (for the property panel,
the semantic validator, and the AI authoring loop) and **gating the wire** (connection legality).
The target model splits them:

- Every port declares its true type. Declaration is documentation + validation signal, always safe
  to state.
- Connection compatibility is computed: exact match, declared cast, or structural rule — with `*`
  meaning "unknown", not "compatible with everything by fiat".
- The editor may then distinguish "connectable losslessly" from "connectable via cast" in the UI,
  which the single-field model cannot express.

Any type added to the library between now and then must come with its outbound casts declared, or
an explicit note in the table that it is intentionally terminal (`domelement`, `reference`, `font`
are legitimately terminal today).

## Applying a table change (checklist, NDA-014 §2)

The table is read by four consumers; a change is not landed until all four have been regenerated
or re-run:

1. `nodelibraryexport.ts` — the source of truth.
2. The node catalog (`packages/noodl-types/src/node-catalog.json`) — regenerate.
3. The register (`node scripts/node-audit/register.js`) — regenerate.
4. The semantic validator + QA fixture corpus — re-run; no new validation errors.

Then verify in the editor that each of the 13 `object` outputs has at least one sensible
destination, and that a Function `object` output wired to a Text node shows JSON.
