# CWF-014 — The Request node believes anything

**From:** [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) §6 row 14, approved 2026-08-05.
**Status:** ✅ **BUILT 2026-08-06** — slices 1 and 2, driven end to end. Slice 3 is deliberately not
built (it never was in scope) and one adjacent consumer is deferred; see *What was built* below.

> ## ⚠️ The three-debts claim does not hold, and it was checked before the design was fixed
>
> **One debt is paid — this one. One was already closed by a different fix. One is untouched.**
>
> - **AIB-001 is not open.** It shipped **2026-08-03**, all four slices, all six criteria
>   (`AiAssistant/validation/parameterValues.ts`, `tests-unit/aib-001/`), and it was never this hole:
>   it validates **authoring-time parameter values against catalog port types, in the editor, before
>   a plan is applied**. CWF-014 validates **runtime request-body values against a function's own
>   declared contract, on the server**. Different values, different reader, different moment. Nothing
>   built here pays anything AIB-001 wanted.
> - **ERG-005 is open and is untouched by this.** Its defect is that a *component's* interface types
>   are derived in `ComponentModel.getPorts()` and written nowhere — `ProjectModel.toJSON()` emits no
>   `ports` key at all. A cloud function's request contract is a different mechanism on a different
>   node, and typing it moves nothing across that boundary. What the two now share is a
>   **vocabulary** (the port-type names) and a **stance** — explicit type selection with inference/
>   `*` as the default, which is Richard's ERG-005 §2 answer of 2026-08-06. This design does not
>   contradict it and is not blocked by it.
> - **What the payoff actually is** is downstream, not sideways: CWF-001's param-mapping UI, the
>   Cloud Function node's `in-` ports, and an OpenAPI generator now have a contract to read
>   (`requestParamSpecs`, exported). That is one debt paid and three tasks unblocked — a good trade,
>   but it is not the same sentence as "one design against three debts", and a design justified by
>   three debts that pays one should be smaller. **It was made smaller**: see the declaration
>   decision below.

## The mechanism, exactly

A cloud function declares its inputs as a comma-separated `params` string. The runtime splits it and
mints one `pm-<name>` output per entry, typed **`'*'`** — the `namedports/list` rule at
[request.ts:65-111](../../../packages/noodl-viewer-cloud/src/nodes/cloud/request.ts#L65-L111) and the
matching push in `setup()` — each a getter straight onto the parsed request body.

That is the entire contract. There is no type, no required flag, no default, no shape. A function
expecting `{ total: number }` and given `{ total: "banana" }` runs happily and fails somewhere
downstream — or worse, doesn't fail, and writes `"banana"` into a record.

## Why this was thought to be one design against three debts

The claim as written (and now checked — see the banner):

- ~~**AIB-001** — nothing validates parameter *values* anywhere in the AI authoring path.~~
  **Stale.** Closed 2026-08-03, and about a different set of values.
- **ERG-005** — component interface types exist in a table in the editor and never leave it, so
  nothing downstream can check them. **True, and not paid here.**
- **Here** — a function's public interface is a comma-separated list of names. **Paid.**

A cloud function is the case where it hurts most, because a function is an **HTTP endpoint**: its
caller is not the graph next door, it is a supplier's webhook, a mobile app, another team. An
endpoint with no request contract is not an API.

## Slices

### Slice 1 — the declaration

Replace / extend `params` with a proplist of rows: **name, type, required, default**. Types from the
port-type vocabulary already in the runtime (`string`, `number`, `boolean`, `object`, `array`,
`date`) — do not invent a parallel type language
([PORT-TYPE-CONTRACT](../../reference/PORT-TYPE-CONTRACT.md)).

> ⚠️ **Built as sibling parameters, not a proplist.** `params` is untouched and still says *which*
> parameters exist; each name `N` may carry `ptype-<N>`, `preq-<N>` and `pdef-<N>`. That is
> `simplejavascript`'s `intype-<label>`/`outtype-<label>` idiom — how this codebase has always
> attached a type to a name in a name list — and it was chosen over a proplist for three reasons,
> each of which shrank the build:
>
> 1. **A function with no declaration is byte-identical on disk.** No key is written until an author
>    sets one, so backward compatibility is not a migration, it is the absence of one.
> 2. **No new property-editor control.** Each row is an ordinary `enum`/`boolean`/`string` port with
>    `allowEditOnly`, so the panel already renders it and the connection bar already hides it. A
>    proplist would have needed a bespoke editor on the CWF-001/`SwitchCasesEditor` model — editor
>    UI that this task could not have driven live.
> 3. **No new dynamic-port dialect.** Three more `namedports/list` rules over the same parameter,
>    plus one optional field (`typeFromParameter`) that reads a sibling parameter for a port's type.
>    The rule stays a *question about parameters*, which is the line `dynamicPortRules` draws.
>
> The Response node inherits this shape unchanged when its turn comes, which was the design
> constraint at the bottom of this file.

⚠️ **Backward compatibility is not optional here** — every existing function and the shipped
templates use the string form. Accept both: a plain `params` string means "all `*`, all optional",
exactly as today. The migration is the author opting in per row.

⚠️ The dynamic-port rule on the editor side is `namedports/list` and it must agree port-for-port
with the runtime's split — WFA-009 records what happens when they disagree (empty entries dropped,
repeats collapsed, in *both* places). A typed row list needs the same agreement re-established, and
the same trap applies: **a port that appears in the editor and not in the export is worse than no
port**.

### Slice 2 — enforcement

- Missing required → **400** with a body naming the field. Not 500, not a graph error.
- Wrong type → 400, unless a lossless coercion applies (the runtime's typecast table already defines
  which — `string → number` is declared; reuse it rather than deciding again).
- Default applied when absent.
- ⚠️ The rejection must happen **before the graph runs**, in `sendRequest`, next to the existing
  `allowNoAuth` check ([request.ts:110-131](../../../packages/noodl-viewer-cloud/src/nodes/cloud/request.ts#L110-L131)).
  That check is the precedent: it throws before anything downstream sees the request.

> ⚠️ **"Reuse the typecast table rather than deciding again" only half-answers, and the missing half
> is not small.** Two things checked at
> [`nodelibraryexport.ts:202-268`](../../../packages/noodl-runtime/src/nodelibraryexport.ts#L202-L268):
>
> - **The table converts nothing.** It declares which *wires between two declared ports* are legal;
>   the conversions live in `Node.setInputValue` and `Node._setValueFromConnection`. A request body
>   is not a wire, so what is reusable is the table's *judgement of what is lossless enough*, not any
>   code. Every coercion built here is a row of that table in that direction — `string → number`,
>   `string → boolean`, `number → string`, `boolean → number`, `object → string`.
> - **The table has no inbound row for `date` at all** (only `date → string`). JSON cannot carry a
>   date natively, so a `date` parameter had to be decided here: an ISO string via `Date.parse`, or
>   an epoch number, and nothing else. That decision is recorded in `requestContract.ts` rather than
>   inherited, because there was nothing to inherit.
>
> And one deliberate divergence: `setInputValue` turns a string into an object/array by **`eval`**.
> A request body is attacker-controlled, so this path is `JSON.parse` and nothing else.

### Slice 3 — the payoff nobody asked for

Once a function declares its inputs with types, three things become derivable rather than authored:

- **[CWF-001](CWF-001-CALL-FUNCTION-PARAMS.md)'s param mapping UI** knows what a step must supply.
- The **agent** authoring path gets a contract to check against (AIB-001's actual want).
- An OpenAPI description of the backend's functions becomes a generator, not a project.

Do not build those here. Do check the declaration shape against CWF-001's needs before fixing it —
one conversation now, or two incompatible shapes later.

**Checked against CWF-001, 2026-08-06.** CWF-001 needs, for a chosen function, the list of keys a
step may supply and what each one takes. `requestParamSpecs(parameters)` is exactly that list —
pure, catalog-free, exported from the package entry — and `WorkflowRunner` already walks a bundle's
components to find the Request node (`findRequestNode`, used by `functionAllowsNoAuth`), so serving
the contract next to the function list is a read, not a new mechanism. The shapes do not collide.

## What was built

| Slice | Where |
|---|---|
| 1 — the declaration | `nodes/cloud/requestContract.ts` (the pure rule), four `namedports/list` rules + a matching `setup()` in `request.ts`, and `typeFromParameter` in the editor's `dynamicPortRules.ts` |
| 2 — enforcement | `sendRequest` throws `CloudFunctionBadRequestError` after the `allowNoAuth` check and before the graph sees anything; `WorkflowRunner.run` and `.invokeFunction` answer **400** with `code: 'function/bad-request'` and a `fields` array |
| 3 | Not built, as instructed. `requestParamSpecs` is the seam the three consumers read |

**Deferred deliberately: the Cloud Function node's `in-` ports.** `CloudFunctionAdapter` mints one
`'*'` input per request parameter for the *calling app*, and typing them from `ptype-` is about six
lines. It is not done here because a typed `in-` port narrows connection legality on a canvas an
author already has wired, and this task was run without an editor — a change of that class needs a
live drive, not a green unit test.

## Done when

- ✅ A function with a typed, required parameter returns **400 with the field name** when it is
  absent, and the graph does not run — proven by the absence of the Response node's `result` in the
  body, which is the only observable that separates "refused" from "ran and complained".
- ✅ A `"42"` supplied to a `number` parameter arrives as `42` by the declared typecast, and
  `"banana"` is a 400.
- ✅ Every existing function with a plain `params` string behaves **exactly** as before — the WFA-009
  suites pass, and `cwf-014-typed-request-bodies.test.ts` re-drives the untyped function against the
  very body that is a 400 next door.
- ⚠️ **Editor ports and exported ports agree — pinned, not canvas-driven.** The parity suite
  (`wfa-009-dynamic-port-parity.test.ts`) runs the real `setup()` and the real editor evaluator over
  45 parameter states including six typed ones, and `namedPortsRule.test.ts` grades the committed
  `cloud-node-library.json`. A canvas drive is still owed, and is the one criterion this run could
  not meet: the session was run under an explicit "do not launch the editor".

## Traps

- ⚠️ **A saved project applies a parameter before the port exists** (the repo's recurring load-order
  trap; jest never reproduces it). Drive this from a saved, reopened project, not only from tests.

  **Met, and it was real.** `NodeScope.setNodeParameters` walks `Object.keys(parameters)` and drops
  any parameter whose input does not exist yet, so a `ptype-total` read before `params` would have
  been discarded silently — an untyped body in production behind a green suite. The Request node now
  overrides `registerInputIfNeeded`, and `cwf-014-typed-request-bodies.test.ts` ships a fixture whose
  JSON lists the contract rows **first** as well as one that lists them last. Verified by removal:
  with the hook disabled, 11 of that file's 15 tests fail.
- ⚠️ The Response node has the same `params` shape. This task does **not** type it — but whatever
  shape is chosen here, the Response node will inherit it later. Design as though it will.

  **It can, unchanged.** `requestContract.ts` is written against a parameter bag, not against the
  Request node, and the three rules are `plug`-agnostic. Typing a Response is adding the same four
  rules with `plug: 'input'` and coercing on the way *out*.
